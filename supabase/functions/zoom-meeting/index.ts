// Edge Function: zoom-meeting
// Creates a Zoom meeting via Server-to-Server OAuth and returns join/start URLs.
// Secrets (set with `supabase secrets set`): ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
// ZOOM_CLIENT_SECRET. Gated by feature flag zoom_integration_enabled.
//
// POST body: { topic, start_time (ISO), duration (min), session_id? }
// Returns: { join_url, start_url, meeting_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function zoomToken(): Promise<string> {
  const id = Deno.env.get("ZOOM_ACCOUNT_ID")!;
  const cid = Deno.env.get("ZOOM_CLIENT_ID")!;
  const secret = Deno.env.get("ZOOM_CLIENT_SECRET")!;
  const basic = btoa(`${cid}:${secret}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${id}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) throw new Error(`Zoom token failed: ${res.status}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Feature flag check
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: flag } = await supa.from("feature_flags").select("enabled")
      .eq("key", "zoom_integration_enabled").maybeSingle();
    if (!flag?.enabled) {
      return new Response(JSON.stringify({ error: "Zoom integration disabled" }), {
        status: 503, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const token = await zoomToken();
    const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: body.topic ?? "Harvest Coaching Session",
        type: 2, // scheduled
        start_time: body.start_time,
        duration: body.duration ?? 60,
        timezone: body.timezone ?? "America/Phoenix",
        settings: { join_before_host: true, waiting_room: true },
      }),
    });
    if (!res.ok) throw new Error(`Zoom create failed: ${res.status} ${await res.text()}`);
    const m = await res.json();

    // Persist onto the session if provided
    if (body.session_id) {
      await supa.from("sessions").update({
        zoom_link: m.join_url, zoom_meeting_id: String(m.id),
      }).eq("id", body.session_id);
    }

    return new Response(
      JSON.stringify({ join_url: m.join_url, start_url: m.start_url, meeting_id: m.id }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
