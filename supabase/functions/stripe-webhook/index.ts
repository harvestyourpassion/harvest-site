// Edge Function: stripe-webhook
// Handles Stripe events. On checkout.session.completed it records a payment and
// upgrades/creates the client to active. Verifies the Stripe signature.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.
//
// Configure endpoint in Stripe dashboard → this function URL. No JWT (public),
// deploy with `--no-verify-jwt`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verify(payload: string, sig: string, secret: string): Promise<boolean> {
  // Stripe signature: t=timestamp,v1=hmac
  const parts = Object.fromEntries(sig.split(",").map((p) => p.split("=")));
  const signed = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}

Deno.serve(async (req) => {
  try {
    const sig = req.headers.get("stripe-signature") ?? "";
    const payload = await req.text();
    const secret = (Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "").trim();
    if (!await verify(payload, sig, secret)) {
      return new Response("bad signature", { status: 400 });
    }
    const event = JSON.parse(payload);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const pkgId = s.metadata?.package_id;
      const coachId = s.metadata?.coach_id;
      const email = s.customer_details?.email ?? s.customer_email;
      const name = s.customer_details?.name ?? email;

      // Link to the client's Roots profile (they signed in with Google to book,
      // so the profiles row already exists via the auth trigger).
      let profileId: string | null = null;
      if (email) {
        const { data: prof } = await supa.from("profiles").select("id").eq("email", email).maybeSingle();
        profileId = prof?.id ?? null;
      }

      // Find or create the client, linked to their profile + activated.
      let clientId: string | null = null;
      if (email && coachId) {
        const { data: existing } = await supa.from("clients").select("id")
          .eq("coach_id", coachId).eq("email", email).maybeSingle();
        if (existing) {
          clientId = existing.id;
          await supa.from("clients").update({ status: "active", package_id: pkgId, user_id: profileId })
            .eq("id", existing.id);
        } else {
          const { data: created } = await supa.from("clients").insert({
            coach_id: coachId, email, name, user_id: profileId,
            status: "active", package_id: pkgId,
          }).select("id").maybeSingle();
          clientId = created?.id ?? null;
        }
      }

      // 1) Record the payment. Flag admin-account purchases as test data (#8).
      const ADMIN_EMAILS = ["harvestyourpassionllc@gmail.com", "leandro.castillo.1994@gmail.com", "leandrocastillo@harvestyourpassion.com", "tacoslosprimos99@gmail.com"];
      const isTest = !!email && ADMIN_EMAILS.indexOf(email.toLowerCase()) !== -1;
      await supa.from("payments").insert({
        client_id: clientId, package_id: pkgId,
        amount: (s.amount_total ?? 0) / 100,
        stripe_payment_id: s.payment_intent ?? s.id,
        status: "succeeded", paid_at: new Date().toISOString(), is_test: isTest,
      });

      // ===== Post-payment onboarding automation =====
      if (clientId && coachId) {
        // 2) Timeline entry.
        await supa.from("client_activity").insert({
          client_id: clientId, type: "payment",
          description: "Payment received for " + name + " — onboarding started.",
        });

        // 3) Contract to sign (14-day expiry).
        const expires = new Date(Date.now() + 14 * 864e5).toISOString();
        await supa.from("contracts").insert({
          coach_id: coachId, client_id: clientId, status: "pending", expires_at: expires,
        });
      }

      // 4) In-app onboarding checklist for the client (uses allowed notification types).
      if (profileId) {
        const notes = [
          { type: "action_item", title: "Welcome to Harvest 👋", body: "Your workspace is ready. Here are your next steps." },
          { type: "survey_due", title: "Complete your intake", body: "A few questions so Leo can prepare for your first session." },
          { type: "contract_expiring", title: "Sign your coaching agreement", body: "Review and sign to confirm your engagement." },
          { type: "action_item", title: "Schedule your first session", body: "Pick a time that works for you." },
        ];
        for (const n of notes) {
          await supa.from("notifications").insert({
            user_id: profileId, type: n.type, title: n.title, body: n.body, channel: "in_app",
          });
        }
      }

      // 5) Best-effort welcome email (no-op if the email function/flag is off).
      try {
        await supa.functions.invoke("send-email", {
          body: {
            to: email,
            subject: "Welcome to Harvest Your Passion",
            body: "Hi " + name + ",\n\nYour coaching journey is underway. Next: complete your intake, sign your agreement, and schedule your first session — all in your account.\n\n— Leo",
          },
        });
      } catch (_e) { /* email optional */ }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
