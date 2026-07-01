// Edge Function: google-calendar
// Two-way Google Calendar sync for coach availability.
//   action "connect":   store the coach's refresh token (from OAuth consent)
//   action "status":     is the coach connected?
//   action "disconnect": remove the connection
//   action "freebusy":   busy intervals for a date range (to exclude booked time)
//   action "create-event": push a session onto the calendar (with Zoom link)
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. Gated by feature flag google_calendar_sync_enabled
// (except "connect"/"status", which must work so the coach can link first).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

function supaClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function freshAccessToken(supa: any, coachId: string): Promise<string | null> {
  const { data: tok } = await supa.from("calendar_tokens").select("*").eq("coach_id", coachId).maybeSingle();
  if (!tok?.refresh_token) return null;
  // Reuse a still-valid access token.
  if (tok.access_token && tok.token_expiry && new Date(tok.token_expiry).getTime() > Date.now() + 60000) {
    return tok.access_token;
  }
  const body = new URLSearchParams({
    client_id: (Deno.env.get("GOOGLE_CLIENT_ID") ?? "").trim(),
    client_secret: (Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "").trim(),
    refresh_token: tok.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  const t = await res.json();
  const expiry = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await supa.from("calendar_tokens").update({ access_token: t.access_token, token_expiry: expiry, updated_at: new Date().toISOString() }).eq("coach_id", coachId);
  return t.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supa = supaClient();
    const { action, coach_id, refresh_token, access_token, email, time_min, time_max, session_id } = await req.json();
    if (!coach_id) return json({ error: "coach_id required" }, 400);

    if (action === "connect") {
      if (!refresh_token) return json({ error: "no refresh_token — re-consent with access_type=offline" }, 400);
      await supa.from("calendar_tokens").upsert({
        coach_id, email, refresh_token, access_token,
        token_expiry: new Date(Date.now() + 3300 * 1000).toISOString(),
        is_active: true, updated_at: new Date().toISOString(),
      }, { onConflict: "coach_id" });
      return json({ connected: true });
    }

    if (action === "status") {
      const { data: tok } = await supa.from("calendar_tokens").select("email,is_active").eq("coach_id", coach_id).maybeSingle();
      return json({ connected: !!tok?.is_active, email: tok?.email ?? null });
    }

    if (action === "disconnect") {
      await supa.from("calendar_tokens").delete().eq("coach_id", coach_id);
      return json({ disconnected: true });
    }

    // Sync actions are flag-gated.
    const { data: flag } = await supa.from("feature_flags").select("enabled").eq("key", "google_calendar_sync_enabled").maybeSingle();
    if (!flag?.enabled) return json({ skipped: true, reason: "calendar sync disabled" });

    const token = await freshAccessToken(supa, coach_id);
    if (!token) return json({ busy: [], reason: "not connected" });

    if (action === "freebusy") {
      const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ timeMin: time_min, timeMax: time_max, items: [{ id: "primary" }] }),
      });
      if (!res.ok) throw new Error(`freebusy failed: ${res.status} ${await res.text()}`);
      const fb = await res.json();
      return json({ busy: fb.calendars?.primary?.busy ?? [] });
    }

    if (action === "create-event") {
      const { data: s } = await supa.from("sessions").select("*, clients(name,email)").eq("id", session_id).maybeSingle();
      if (!s) return json({ error: "session not found" }, 404);
      const start = new Date(s.scheduled_at);
      const end = new Date(start.getTime() + (s.duration_minutes ?? 60) * 60000);
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Coaching — ${s.clients?.name ?? "Client"}`,
          description: s.zoom_link ? `Zoom: ${s.zoom_link}` : "Harvest coaching session",
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: s.clients?.email ? [{ email: s.clients.email }] : [],
        }),
      });
      if (!res.ok) throw new Error(`event create failed: ${res.status} ${await res.text()}`);
      const ev = await res.json();
      await supa.from("sessions").update({ google_event_id: ev.id }).eq("id", session_id);
      return json({ event_id: ev.id, html_link: ev.htmlLink });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
