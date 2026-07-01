// Edge Function: send-push
// Sends a web push notification to all of a user's subscriptions.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
// Gated by feature flag push_enabled.
//
// POST body: { user_id, title, body, url? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: flag } = await supa.from("feature_flags").select("enabled").eq("key", "push_enabled").maybeSingle();
    if (!flag?.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "push disabled" }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    webpush.setVapidDetails(
      (Deno.env.get("VAPID_SUBJECT") ?? "mailto:harvestyourpassionllc@gmail.com").trim(),
      (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim(),
      (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim(),
    );

    const { user_id, title, body, url } = await req.json();
    const { data: subs } = await supa.from("push_subscriptions").select("*").eq("user_id", user_id);
    const payload = JSON.stringify({ title: title ?? "Harvest Your Passion", body: body ?? "", url: url ?? "/" });

    let sent = 0;
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e: any) {
        // 404/410 = expired subscription → clean up.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supa.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
    return new Response(JSON.stringify({ sent, total: subs?.length ?? 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
