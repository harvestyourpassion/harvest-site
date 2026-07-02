# Fixing Google Calendar "App isn't verified" (#36)

When you click **Connect Google Calendar** in Garden → Settings, Google may warn
"Google hasn't verified this app." That's because the OAuth consent screen
requests **sensitive Calendar scopes** (`calendar.readonly`, `calendar.events`),
which trigger Google's verification requirement for public use.

## Quick unblock (works today, for you)
While unverified, the app still works for **you and any accounts you add as test
users**:
1. Google Cloud Console → project **harvest-your-passion** → **APIs & Services →
   OAuth consent screen**.
2. Under **Test users**, add each of your emails (harvestyourpassionllc@gmail.com,
   leandro.castillo.1994@gmail.com, leandrocastillo@harvestyourpassion.com).
3. On the warning screen during connect, click **Advanced → Go to Harvest Your
   Passion (unsafe)** → allow. The calendar connects normally.

## Proper fix (for clients / public, no warning)
To remove the warning for everyone you need Google verification:
1. OAuth consent screen → **Publishing status → Publish app** (moves from
   Testing to In production).
2. For the **sensitive/restricted Calendar scopes**, Google requires a
   verification submission: an app homepage, a privacy-policy URL, a demo video
   showing the scope usage, and justification. Submit under **"Prepare for
   verification."**
3. Verification typically takes a few days to a couple of weeks.

## Notes
- The **login** Google OAuth (basic profile/email) is already published and does
  NOT need this — only the added Calendar scopes do.
- If you'd rather avoid verification for now: coaching still works without
  calendar sync (booking uses your set availability). Calendar free/busy is an
  enhancement, gated behind `google_calendar_sync_enabled`.
- Privacy policy: you'll need a `/privacy` page for verification — say the word
  and I'll add one.
