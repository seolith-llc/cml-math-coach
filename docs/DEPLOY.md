# Deployment: Cloudflare Pages + cml-math-coach.seolith.com

Hosting is **Cloudflare Pages**, deployed by the GitHub Actions workflow
[`.github/workflows/deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml):

| Trigger | Result |
|---|---|
| Push to `main` | Run tests and build, then deploy to **production** (`cml-math-coach.pages.dev` and the custom domain) |
| Pull request | Run tests and build, then deploy to a **preview** URL (shown in the job summary) |
| Missing secrets | Tests and build still run, and the deploy is skipped with a warning |

Response headers (security headers, `no-cache` for the service worker, long caching for hashed assets,
`Permissions-Policy: microphone=(self)`) live in [`public/_headers`](../public/_headers).

## One-time setup

### 1. Create a Cloudflare API token
Cloudflare dashboard → **My Profile → API Tokens → Create Token → Custom token**
- Permissions: **Account → Cloudflare Pages → Edit**
- Account resources: the account that owns `seolith.com`
- Copy the token.

Find the **Account ID**: dashboard → Workers & Pages (right sidebar), or the 32-character id in the dashboard URL.

### 2. Add the secrets to GitHub
https://github.com/seolith-llc/cml-math-coach/settings/secrets/actions → **New repository secret**
- `CLOUDFLARE_API_TOKEN` = the token
- `CLOUDFLARE_ACCOUNT_ID` = the account id

Then **Actions → Deploy to Cloudflare Pages → Run workflow** (or push to `main`). The first run creates the
`cml-math-coach` Pages project and publishes `https://cml-math-coach.pages.dev`.

### 3. Add the custom domain
Cloudflare dashboard → **Workers & Pages → cml-math-coach → Custom domains → Set up a custom domain** →
`cml-math-coach.seolith.com` → Activate.
- If `seolith.com` uses Cloudflare DNS (orange cloud), the CNAME record is created automatically, and HTTPS is ready within a few minutes.
- If DNS is hosted elsewhere, add `CNAME  cml-math-coach  →  cml-math-coach.pages.dev` at your DNS provider and wait for verification.

> Add the domain in the Pages project first, *then* let it create the DNS record. A CNAME added by hand
> before the domain is attached to the project returns a 522 error.

### 4. Optional: turn off GitHub Pages
The earlier GitHub Pages workflow has been removed. If you enabled Pages in repository settings, you can
disable it (Settings → Pages → Source: None).

## Premium voice (Workers AI)
The coach's natural voice comes from the Pages Function [`functions/api/tts.ts`](../functions/api/tts.ts), which calls
**Workers AI → `@cf/deepgram/aura-2-en`** through the `AI` binding declared in [`wrangler.toml`](../wrangler.toml).
There are no extra API keys. Usage is billed to the Cloudflare account under Workers AI (it has a daily free allocation, so check
Workers AI pricing for current rates).

- Clips are cached at the Cloudflare edge and in the app's service worker, so each sentence is generated only once.
- Guard rails: 40-voice allow-list, 600-character cap, same-origin check.
- **Rate limiting, two layers:**
  1. *In the function:* each IP may make 40 **new** clips per minute and 1,500 per day at each Cloudflare location. Cached clips are never counted.
     This covers every hostname, including `*.pages.dev`, which the zone's WAF does not protect. Over the limit, the app returns 429 and the app uses the device voice for a minute.
  2. *WAF rule on the custom domain:* allows 20 requests per 10 s per IP, then blocks for 10 s (these values work on every plan). Apply or update it with
     **Actions → Cloudflare rate limit → Run workflow**, which runs `scripts/cloudflare-rate-limit.mjs`. It's idempotent and keeps other rules.
     The token needs **Zone → Zone WAF → Edit** and **Zone → Zone → Read** for `seolith.com`. Either add those to `CLOUDFLARE_API_TOKEN`,
     or store a separate token as the `CLOUDFLARE_WAF_TOKEN` secret, which takes precedence. `CLOUDFLARE_ZONE_ID` is optional.
- If Workers AI is unavailable or the device is offline, the app automatically uses the device voice.
- Local testing with the function: `npm run build && npx wrangler pages dev dist` (needs `wrangler login`).

## Parent dashboard storage (D1)
The dashboard data lives in a Cloudflare **D1** database named `cml-math-coach`. The deploy workflow runs
[`scripts/ensure-d1.mjs`](../scripts/ensure-d1.mjs), which creates the database if it's missing, applies
[`migrations/`](../migrations) (idempotent), and binds it as `DB` for that deploy.

- **Token permission needed:** add **Account → D1 → Edit** to `CLOUDFLARE_API_TOKEN`. Without it the site still deploys,
  but turning on the dashboard shows "storage is not set up yet".
- Endpoints: `POST /api/sync` (the child's device uploads results, which needs the private family id) and `POST /api/parent` (read or delete, which needs the family id **and** the PIN).
- Security: only `sha256(familyId)` and a PBKDF2 hash of the PIN are stored. After 5 wrong PINs the family is locked for 15 minutes. Requests must be same-origin.
- Privacy: stored data is the child's first name, grade, topic results, answers given, time spent and test scores. "Turn off and delete online data" in Settings erases it.

## Weekly progress email (Amazon SES)
How it works: the scheduled workflow [`hourly.yml`](../.github/workflows/hourly.yml) calls `POST /api/hourly`
with `Authorization: Bearer <CRON_SECRET>` every hour. The same call sends device reminders and parent nudges. The function sends only inside
**Sunday 5 pm – Monday 6 am America/Chicago**, at most once per family per week, and skips families with no practice for 4+ weeks.
Emails go out through the SES v2 API, signed with SigV4 in [`server/ses.ts`](../server/ses.ts) (no SDK).

**One-time setup**
1. **SES:** in the AWS console (choose a region, e.g. us-east-1) → Amazon SES → *Identities* → **Create identity → Domain** `seolith.com`.
   Add the DKIM CNAME records it shows to Cloudflare DNS. Optionally set a custom MAIL FROM domain for better deliverability.
2. **Production access:** new SES accounts are in the *sandbox* and can only send to verified addresses.
   Request production access (SES → Account dashboard), or verify your own email address while testing.
3. **IAM user** with only this permission, then create an access key:
   ```json
   { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": "ses:SendEmail", "Resource": "*" }] }
   ```
4. **GitHub → Settings → Secrets and variables → Actions**
   - Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CRON_SECRET` (a random string of at least 16 characters; generate one with
     `openssl rand -base64 32`)
   - Variables (optional): `AWS_REGION` (default `us-east-1`), `MAIL_FROM` (default `CML Math Coach <coach@seolith.com>`), `MAIL_REPLY_TO`
   - `FEEDBACK_TO` (optional): where in-app feedback is emailed; defaults to `MAIL_REPLY_TO`. Triage it with Actions → **Feedback**.
5. Re-run **Deploy to Cloudflare Pages**. It copies these into the Pages project's secrets. `APP_URL` is in `wrangler.toml`.
6. On the parent dashboard, add your email, confirm it, and press **Send a test now**.
   To try the weekly run itself: Actions → **Hourly** → Run workflow with *force_weekly*.

**Safety:** confirmation links expire after 3 days and only work once. Link opens show a button and the change happens on POST, so mail scanners can't
confirm or unsubscribe on the parent's behalf. Confirmation and test emails are capped at 5 per family per day.
Every weekly email has `List-Unsubscribe` and `List-Unsubscribe-Post` (one-click) headers.

## Reminders (web push) and nudges
- No setup is needed. The VAPID key pair is generated on first use and kept in D1 (`kv`). Subscriptions are stored in `push_subs`, and only real push-service endpoints (Apple, Google, Mozilla, Microsoft) are accepted.
- Encryption (RFC 8291) and VAPID (RFC 8292) are in `server/push.ts`, tested against the independent `http_ece` decoder.
- Check delivery with Actions → **Status** (subscriptions, last reminder, nudge state, email log).

## Private access (Cloudflare Access)

The app is private: it is not indexed (robots.txt, `X-Robots-Tag: noindex`), crawlers and AI agents are refused
(`functions/_middleware.ts`), and Cloudflare Access puts a sign-in in front of every page and API, on the custom domain,
`cml-math-coach.pages.dev` and every preview. Invited people sign in with a one-time code sent to their email;
a sign-in lasts 30 days on a device (the iPad Home Screen app signs in once, inside the app).

One-time setup:

1. **Zero Trust:** Cloudflare dashboard → **Zero Trust** → choose a team name and the **Free** plan (up to 50 users).
2. **Service token for CI** (deploy smoke tests, the hourly job, the Status probe): Zero Trust → Access →
   Service credentials → **Service Tokens** → Create, name **`math-coach-ci`**, duration **Non-expiring**.
   Copy the Client ID and Client Secret into the GitHub secrets **`CF_ACCESS_CLIENT_ID`** and **`CF_ACCESS_CLIENT_SECRET`**.
3. **API token permissions:** edit the existing Cloudflare token (or create one and store it as **`CLOUDFLARE_ACCESS_TOKEN`**) with
   Account → **Access: Apps and Policies** → Edit, **Access: Service Tokens** → Read,
   **Access: Organizations, Identity Providers, and Groups** → Edit.
4. **Who may sign in:** GitHub secret **`ACCESS_ALLOWED_EMAILS`**: the invited addresses, separated by commas
   (yourself, the parents, the testers). It is a secret so the addresses never appear in this public repository.
5. Run **Actions → Cloudflare Access** with **apply** unticked first: a preview that changes nothing. It confirms the Zero Trust
   organization and that the one-time PIN login is reused as is, counts the other applications (never changed, and their names and
   hostnames are never printed, since these logs are public), warns if any of them already covers a Math Coach hostname, and lists
   what is still missing. Then run it again with **apply** ticked: it creates or updates only "Math Coach" and "Math Coach email links"
   (app-scoped policies, nothing shared with other applications) and checks the live result. Re-run it whenever the list changes.
   Each invited person who signs in uses one Zero Trust seat (Free plan: 50).

Exceptions: the service-worker scripts (`/sw.js`, `/push-sw.js`, `/workbox-*.js`: generic code, no data) skip the sign-in,
because browsers refuse a redirect when checking for an app update; without this an installed copy would stay on an old
version and never show the sign-in page. `/api/email/confirm` and `/api/email/unsubscribe` also skip the sign-in so a parent can confirm or unsubscribe
(including Gmail's one-click unsubscribe). Both are protected by their own signed tokens.

## Rollback
Workers & Pages → cml-math-coach → **Deployments** → choose an earlier deployment → **Rollback**.
