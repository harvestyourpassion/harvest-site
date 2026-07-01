# Pointing harvestyourpassion.com to Netlify

Your site is live at `harvest-your-passion.netlify.app`. These steps move the
custom domain `harvestyourpassion.com` from Wix to Netlify. **Do this when you're
ready to cut over from the old Wix site** — until DNS changes propagate, the Wix
site stays up.

## 0. Before you start
- Have the 70 blog posts migrated into Content (done — verify at `/content`).
- Decide a cutover time; DNS can take 1–48h to propagate globally.
- You'll need access to your **domain registrar** (where you bought the domain —
  possibly Wix, GoDaddy, Google Domains/Squarespace, Namecheap, etc.).

## 1. Add the domain in Netlify
1. Netlify → your site → **Domain management** → **Add a domain**.
2. Enter `harvestyourpassion.com` → **Verify** → add it.
3. Netlify will also offer `www.harvestyourpassion.com` — add both. Set the
   **primary domain** to whichever you prefer (recommend `www` redirecting to
   apex, or apex — either is fine; be consistent).

## 2. Point DNS at Netlify (recommended: Netlify DNS)
**Option A — Netlify DNS (simplest, gives automatic HTTPS + apex support):**
1. In Netlify → Domain management → **Set up Netlify DNS** for the domain.
2. Netlify shows **4 nameservers** like:
   ```
   dns1.p03.nsone.net
   dns2.p03.nsone.net
   dns3.p03.nsone.net
   dns4.p03.nsone.net
   ```
   (yours will differ — copy the exact ones Netlify shows)
3. At your **registrar**, replace the current nameservers with those 4.
4. Wait for propagation. Netlify auto-provisions the Let's Encrypt SSL cert.

**Option B — Keep your DNS host, add records:**
If you'd rather not move nameservers, add these at your DNS host:
| Type | Name | Value |
|------|------|-------|
| `A` | `@` (apex) | `75.2.60.5` (Netlify's load balancer) |
| `CNAME` | `www` | `harvest-your-passion.netlify.app` |

Then in Netlify → Domain management, click **Verify DNS configuration**.
(Netlify's apex IP can change — prefer Option A if your registrar supports
nameserver changes.)

## 3. If the domain is currently on Wix
- If you **bought the domain through Wix**: Wix → Domains → your domain →
  **Advanced / Nameservers** → change to "Use external nameservers" and enter
  Netlify's 4 (Option A). Wix may require the domain be disconnected from the
  Wix site first.
- If the domain is at a **separate registrar** but *pointed* at Wix: just change
  the nameservers/records at that registrar (above); no Wix action needed.

## 4. Force HTTPS + www/apex redirect
1. Netlify → Domain management → **HTTPS** → ensure the certificate is issued
   (may take a few minutes after DNS resolves), then **Force HTTPS**.
2. Confirm the non-primary host redirects to the primary (Netlify does this
   automatically once both are added).

## 5. Verify
- Visit `https://harvestyourpassion.com` and `https://www.harvestyourpassion.com`
  — both should load the Netlify site over HTTPS.
- Check the padlock (valid cert) and that old Wix URLs (`/post/...`) you care
  about still resolve or are redirected (see note below).

## 6. Preserve old blog URLs (optional but recommended for SEO)
Your Wix posts lived at `/post/<slug>`. The new blog uses `/blog/?id=<uuid>`.
To avoid breaking inbound links, tell me and I'll add `_redirects` rules mapping
each old `/post/<slug>` to its new blog post once the content is migrated (the
source URLs are stored on each imported item).

---
**Rollback:** if anything looks wrong, revert the nameservers/records at your
registrar back to Wix's — propagation reverses the same way.
