// Edge Function: send-email
// Sends transactional email via Resend. Used for welcome, reminders, follow-ups.
// Secrets: RESEND_API_KEY, EMAIL_FROM (optional, defaults to Resend's sandbox).
// Gated by feature flag email_enabled AND the presence of RESEND_API_KEY, so it
// safely no-ops until Leo adds a key.
//
// POST body: { to, subject, body (plain text), html? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      .eq("key", "email_enabled").maybeSingle();
    const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    if (!flag?.enabled || !apiKey) {
      // Not an error — email just isn't configured yet.
      return new Response(JSON.stringify({ skipped: true, reason: "email disabled" }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, html } = await req.json();
    const from = (Deno.env.get("EMAIL_FROM") ?? "Harvest Your Passion <onboarding@resend.dev>").trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body, html: html ?? undefined }),
    });
    if (!res.ok) throw new Error(`Resend error: ${res.status} ${await res.text()}`);
    const out = await res.json();
    return new Response(JSON.stringify({ id: out.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
