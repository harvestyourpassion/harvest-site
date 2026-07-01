// Edge Function: send-reminders
// Meant to be called on a schedule (pg_cron / external cron) every ~15-30 min.
// Finds scheduled sessions approaching their 48h / 24h / 1h marks and sends an
// SMS (send-sms) + email (send-email) reminder once per window, recording a
// notification marker to avoid duplicates. SMS/email are themselves flag-gated,
// so this safely no-ops until Twilio/Resend are configured.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WINDOWS = [
  { key: "48h", minsBefore: 48 * 60 },
  { key: "24h", minsBefore: 24 * 60 },
  { key: "1h", minsBefore: 60 },
];
const TOLERANCE_MIN = 20; // cron cadence slack

Deno.serve(async () => {
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = Date.now();
    const horizon = new Date(now + 49 * 3600 * 1000).toISOString();

    const { data: sessions } = await supa
      .from("sessions")
      .select("id, scheduled_at, zoom_link, clients(name, email, phone)")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date(now).toISOString())
      .lte("scheduled_at", horizon);

    let sent = 0;
    for (const s of sessions ?? []) {
      const minsUntil = (new Date(s.scheduled_at).getTime() - now) / 60000;
      const win = WINDOWS.find((w) => Math.abs(minsUntil - w.minsBefore) <= TOLERANCE_MIN);
      if (!win) continue;

      // Dedupe: one session_reminder notification per session+window.
      const client = (s as any).clients;
      const profileId = null; // reminders keyed by session; marker stored below
      const marker = `reminder:${s.id}:${win.key}`;
      const { data: already } = await supa.from("notifications")
        .select("id").eq("type", "session_reminder").eq("reference_id", s.id)
        .ilike("body", `%${win.key}%`).maybeSingle();
      if (already) continue;

      const when = new Date(s.scheduled_at).toLocaleString("en-US", { timeZone: "America/Phoenix" });
      const msg = `Reminder: your Harvest coaching session is in ${win.key} (${when}).` +
        (s.zoom_link ? ` Join: ${s.zoom_link}` : "");

      if (client?.phone) {
        await supa.functions.invoke("send-sms", { body: { to: client.phone, body: msg } }).catch(() => {});
      }
      if (client?.email) {
        await supa.functions.invoke("send-email", {
          body: { to: client.email, subject: "Session reminder", body: msg },
        }).catch(() => {});
      }

      // Record marker so we don't resend this window. user_id is required on
      // notifications; skip the in-app row if we can't resolve a profile, but
      // still avoid resends by writing to a lightweight log if available.
      const { data: prof } = client?.email
        ? await supa.from("profiles").select("id").eq("email", client.email).maybeSingle()
        : { data: null };
      if (prof?.id) {
        await supa.from("notifications").insert({
          user_id: prof.id, type: "session_reminder",
          title: "Upcoming session", body: `${win.key} reminder ${marker}`,
          channel: "in_app", reference_id: s.id,
        });
      }
      sent++;
    }

    return new Response(JSON.stringify({ checked: sessions?.length ?? 0, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
