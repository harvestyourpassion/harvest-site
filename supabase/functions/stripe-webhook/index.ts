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
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
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

      // Find or create client by email for this coach.
      let clientId: string | null = null;
      if (email && coachId) {
        const { data: existing } = await supa.from("clients").select("id")
          .eq("coach_id", coachId).eq("email", email).maybeSingle();
        if (existing) {
          clientId = existing.id;
          await supa.from("clients").update({ status: "active", package_id: pkgId })
            .eq("id", existing.id);
        } else {
          const { data: created } = await supa.from("clients").insert({
            coach_id: coachId, email, name: s.customer_details?.name ?? email,
            status: "active", package_id: pkgId,
          }).select("id").maybeSingle();
          clientId = created?.id ?? null;
        }
      }

      await supa.from("payments").insert({
        client_id: clientId, package_id: pkgId,
        amount: (s.amount_total ?? 0) / 100,
        stripe_payment_id: s.payment_intent ?? s.id,
        status: "succeeded", paid_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
