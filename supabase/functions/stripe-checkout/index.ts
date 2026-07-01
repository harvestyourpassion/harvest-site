// Edge Function: stripe-checkout
// Creates a Stripe Checkout Session for a coaching package and returns its URL.
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Gated by feature flag stripe_payments_enabled.
//
// POST body: { package_id, client_email, success_url, cancel_url }
// Returns: { url }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: flag } = await supa.from("feature_flags").select("enabled")
      .eq("key", "stripe_payments_enabled").maybeSingle();
    if (!flag?.enabled) {
      return new Response(JSON.stringify({ error: "Payments disabled" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { package_id, client_email, success_url, cancel_url } = await req.json();
    const { data: pkg } = await supa.from("packages").select("*").eq("id", package_id).maybeSingle();
    if (!pkg) throw new Error("Package not found");

    const key = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", success_url ?? "https://harvest-your-passion.netlify.app/coaching/?paid=1");
    form.set("cancel_url", cancel_url ?? "https://harvest-your-passion.netlify.app/coaching/");
    if (client_email) form.set("customer_email", client_email);
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(pkg.price) * 100)));
    form.set("line_items[0][price_data][product_data][name]", pkg.name);
    form.set("metadata[package_id]", package_id);
    form.set("metadata[coach_id]", pkg.coach_id);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) throw new Error(`Stripe error: ${res.status} ${await res.text()}`);
    const session = await res.json();
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
