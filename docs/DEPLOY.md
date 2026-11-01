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

## Rollback
Workers & Pages → cml-math-coach → **Deployments** → choose an earlier deployment → **Rollback**.
