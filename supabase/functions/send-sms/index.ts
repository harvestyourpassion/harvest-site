// Edge Function: send-sms
// Sends an SMS via Twilio. Used for session reminders (48h/24h/1h) and alerts.
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
// Gated by feature flag twilio_sms_enabled.
//
// POST body: { to (E.164), body }

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
      .eq("key", "twilio_sms_enabled").maybeSingle();
    if (!flag?.enabled) {
      return new Response(JSON.stringify({ error: "SMS disabled" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { to, body } = await req.json();
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const tok = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${tok}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    if (!res.ok) throw new Error(`Twilio error: ${res.status} ${await res.text()}`);
    const msg = await res.json();
    return new Response(JSON.stringify({ sid: msg.sid, status: msg.status }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
