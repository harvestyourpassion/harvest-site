# Harvest Platform — Remaining Work vs Spec v2.0

_As of this build. ✅ = done · 🟡 = partial · ❌ = not built · 🔒 = needs Leo (keys/action) · ⏸ = deferred per spec_

## Integrations — pending YOUR action (code is done + deployed, flag-gated)
- 🔒 **Twilio phone number** — provision a number, set `TWILIO_PHONE_NUMBER`; flip `twilio_sms_enabled`. Until then SMS reminders no-op.
- 🔒 **Email (Resend)** — add `RESEND_API_KEY` + `EMAIL_FROM`, flip `email_enabled`. Until then welcome/reminder emails no-op.
- 🔒 **Zoom** — flip `zoom_integration_enabled` to make real Zoom links (calls succeed but no-op while off).
- 🔒 **Google Calendar** — in Garden → Settings click **Connect Google Calendar**, then flip `google_calendar_sync_enabled`. (Two-way sync code is live: freebusy + event push.)
- 🔒 **Reminder cron** — scheduled every 15 min; only actually sends once Twilio/email above are on.

## Recently completed ✅
- ✅ **Messaging** (A) · **Act As Client** (D) · **Discuss Next Session** (B) · **Session Templates** · **Convert prospect→client** · **Assign From Anywhere**
- ✅ **Client survey fill-out + contract e-signature** (`/coaching/next-steps.html`)
- ✅ **Session Plans** (per-client topic tracks)
- ✅ **Coach Connection view** (`/coaching/coach.html` — shared resources, request session, message, upcoming)
- ✅ **4-tier operating modes** (Simple/Guided/Builder + Custom reserved; builder-only gating)
- ✅ **Content platform-version generator + knowledge relationships**
- ✅ **70 Wix posts migrated** (published) + 3 local drafts
- ✅ **Admin nav/feature-flag UI** (Garden Settings) — nav toggles, store hidden, principles/learn toggleable
- ✅ **PWA push** (subscriptions + send-push fn; needs browser subscribe + flag flip)
- ✅ **Mobile bottom-nav + nav a11y labels**
- ✅ **Dev panel hidden in production**; **session/hour/week pluralization**
- ✅ **DNS cutover guide** (`DNS-SETUP.md`)

## Roots — remaining
- ❌ **Coach Connection view** (client side): shared resources, request-a-session, items visible to coach
- 🟡 **4-tier modes** (Simple/Guided/Builder/Custom): `mode` field exists; UI gating + "unlock" prompts not wired (Custom is ⏸)
- 🟡 **Item relationships** (directional): table exists; linking UI not built (cross-tab tags only)
- 🟡 **Saved views / templates** on the new cloud schema: verify persistence
- 🟡 **Notifications in Roots** (overdue/due-soon surfacing)

## Garden — remaining
- ❌ **Session Plans** (PD topic library, plan builder, per-client track)
- ❌ **Coupons/discounts** UI (table exists)
- 🟡 **Coach Inbox** — basic (prospects + upcoming); missing comments/completions/missed-habits/surveys/messages/items-to-discuss
- 🟡 **Client Profile tabs** — Overview/Timeline/Sessions done; Notes/Progress/Documents/Shared not
- 🟡 **Post-Session one-button automation** — basic follow-up done; full checklist (auto-assign actions/resources/reminders/summary) partial
- 🟡 **Survey delivery**: builder + responses done; client-facing fill-out form + auto-send on signup ❌
- 🟡 **Contracts**: coach can mark signed; client-facing e-signature ❌

## Content — remaining
- ❌ **Platform version generator** (LinkedIn/Facebook/Instagram text from one source) — `platform_versions` unused
- ❌ **Knowledge Relationships** UI (link content → principles/businesses/books/frameworks)
- ❌ **Universal Assignment** (content → client/path/library)
- 🟡 **Ideas Bank** tagging/search; **Published Archive** with assignment counts

## Website — remaining
- 🟡 **About** page not rebuilt on H-components (works, but off-system styling)
- 🟡 **Two booking paths** to consolidate: legacy `/coaching/` portal vs `/coaching/book.html` (paid). Pick one.
- ⏸ **Store** — placeholder + disable toggle (per spec, deferred)

## Platform-wide — remaining
- ❌ **Realtime** (Supabase Realtime for live notifications / Coach Inbox / item changes)
- ❌ **PWA push notifications** (VAPID keys + subscription flow; SW shell exists)
- ❌ **Admin feature-flag / app_settings UI** (business name, brand color, toggles — currently API-only)
- ❌ **Trigger-based email sending** (email_templates fire on booking/reminder/post-session)
- ❌ **google-calendar**: availability_overrides (specific-date exceptions) UI

## Polish — remaining
- ❌ Roots mobile **HBottomNav** (currently hamburger)
- ❌ Accessibility audit (keyboard nav, ARIA, contrast pass across all screens)
- ❌ Performance (lazy-load, query tuning)
- ❌ Cross-browser (Safari iOS / Firefox) verification
- 🟡 Loading/empty/error states — present in new screens; audit older ones

## Deferred (per spec — not needed now)
- ⏸ VIP scheduling overrides w/ permissions · Advanced analytics/reporting · Multi-user editorial workflow · Template marketplace · Custom mode (theming) · Free downloadable resources

## Audit (Claude_Feedback_Batch_July1) — status
- HIGH (11): ✅ all done
- MEDIUM (17): ✅ all done
- LOW: done — #1 #2 #3 #8 #12 #14 #15 #16 #27 #30 #33 #37 #38 #44 #45 #47 #52 #53
  · code-verified, needs live browser test — #48 (pin logic correct), #50 (per-section
    aggregation works; cross-section "income−bills" = deferred Formula sections), #51 (Roots audit)
  · deferred/follow-up — #25 sent-survey tracking (partial), #26 per-client survey override,
    #40 test-as-client (Act As Client exists), #46 About admin-editable, #49 cross-user tab share (not built)
- BACKLOG #58 Quick Connect — not started (per Leo, after audit)
