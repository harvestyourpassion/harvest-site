# Harvest Edge Functions (Phase 6 — Integrations)

These run on Supabase Edge (Deno). They are written and committed but **not yet
deployed** — deploying needs the Supabase CLI and a Supabase access token, which
must be done from Leo's machine (Claude doesn't have a Supabase access token).

All integrations are **feature-flag gated** in the `feature_flags` table and stay
OFF until you flip them on. Secrets live server-side only (never in client code).

## Functions
| Function | Purpose | Flag |
|----------|---------|------|
| `zoom-meeting` | Create a Zoom meeting (S2S OAuth), attach to a session | `zoom_integration_enabled` |
| `stripe-checkout` | Create a Stripe Checkout Session for a package | `stripe_payments_enabled` |
| `stripe-webhook` | Record payment + activate client on success | `stripe_payments_enabled` |
| `send-sms` | Twilio SMS (session reminders/alerts) | `twilio_sms_enabled` |
| `google-calendar` | *(TODO)* sync sessions ↔ Google Calendar | `google_calendar_sync_enabled` |

## One-time deploy

```bash
# 1. Install CLI (if needed): https://supabase.com/docs/guides/cli
# 2. Authenticate (opens browser for an access token):
supabase login
# 3. Link this repo to the project:
supabase link --project-ref rjjhuugtwwimsijnmvwy

# 4. Set secrets (values are in Life Operating System/.credentials.md):
supabase secrets set \
  ZOOM_ACCOUNT_ID=... ZOOM_CLIENT_ID=... ZOOM_CLIENT_SECRET=... \
  STRIPE_SECRET_KEY=rk_test_... STRIPE_WEBHOOK_SECRET=whsec_... \
  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+1...
# (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

# 5. Deploy:
supabase functions deploy zoom-meeting
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe calls it unauthenticated
supabase functions deploy send-sms
```

## Enable an integration

```sql
update feature_flags set enabled = true where key = 'stripe_payments_enabled';
```

## Stripe webhook setup
After deploying `stripe-webhook`, in the Stripe dashboard add a webhook endpoint
pointing at the function URL, subscribe to `checkout.session.completed`, copy the
signing secret into `STRIPE_WEBHOOK_SECRET`, and re-deploy.

## Twilio
Provision a phone number first (Twilio console → Phone Numbers), then set
`TWILIO_PHONE_NUMBER`. Trial accounts can only SMS verified numbers.

## Post-payment automation (live)
`stripe-webhook` on `checkout.session.completed` now: links the client to their
Roots profile + activates them, records the payment, creates a pending contract,
seeds an in-app onboarding checklist (notifications), logs the timeline, and
fires a best-effort welcome email. The booking success page then lets the client
pick a slot from `availability`, which creates the session and attaches a Zoom
link via `zoom-meeting`.

## Additional functions
- `send-email` — Resend-backed; gated by `email_enabled` flag + `RESEND_API_KEY`.
  Enable: `supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Harvest <you@yourdomain>"`
  then `update feature_flags set enabled=true where key='email_enabled';`
  Deploy: `supabase functions deploy send-email`.
- `send-reminders` — call on a schedule; sends 48h/24h/1h session reminders via
  `send-sms`/`send-email` (both flag-gated). Deploy:
  `supabase functions deploy send-reminders`.

## Reminder cron (when ready)
Needs a Twilio number (`TWILIO_PHONE_NUMBER`) and/or `email_enabled`. Schedule
`send-reminders` every 15 min — easiest via Supabase Dashboard → Database →
Cron (pg_cron + pg_net), calling the function URL with the service-role key. Or
any external cron hitting the function URL.

## Still TODO
- `google-calendar`: needs an OAuth refresh-token flow (store per-coach token,
  refresh, two-way sync availability ↔ events). Scoped but not yet written.
