#!/usr/bin/env node
/**
 * Creates or updates the WAF rate-limiting rule that protects /api/tts on the custom domain.
 * Idempotent: the rule is identified by its `ref`, and other rules in the zone are left untouched.
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN  needs Zone → Zone WAF → Edit (and Zone → Zone → Read to look up the zone id)
 *   CLOUDFLARE_ZONE_ID    optional; otherwise looked up from ZONE_NAME
 *   ZONE_NAME             default seolith.com
 *   APP_HOST              default cml-math-coach.seolith.com
 *   RL_REQUESTS / RL_PERIOD / RL_TIMEOUT   default 20 requests / 10 s, block 10 s (allowed on every plan)
 */
const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');
const zoneName = process.env.ZONE_NAME || 'seolith.com';
const host = process.env.APP_HOST || 'cml-math-coach.seolith.com';
const REF = 'cml-math-coach-tts-rate-limit';

async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok && json.success !== false, json };
}

function explain(r, what) {
  const msgs = (r.json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ');
  let hint = '';
  if (r.status === 403 || /authentication|permission|unauthorized/i.test(msgs))
    hint = '\nThe API token needs: Zone → Zone WAF → Edit, and Zone → Zone → Read, for the seolith.com zone.';
  return new Error(`${what} failed (HTTP ${r.status}) ${msgs}${hint}`);
}

let zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (!zoneId) {
  const z = await cf('GET', `/zones?name=${encodeURIComponent(zoneName)}`);
  if (!z.ok) throw explain(z, 'Looking up zone');
  zoneId = z.json.result?.[0]?.id;
  if (!zoneId) throw new Error(`Zone ${zoneName} not found for this token. Set CLOUDFLARE_ZONE_ID or grant Zone → Read.`);
}

const rule = {
  ref: REF,
  description: `Rate limit premium voice API (${host}/api/tts)`,
  expression: `(http.host eq "${host}" and http.request.uri.path eq "/api/tts")`,
  action: 'block',
  enabled: true,
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: Number(process.env.RL_PERIOD || 10),
    requests_per_period: Number(process.env.RL_REQUESTS || 20),
    mitigation_timeout: Number(process.env.RL_TIMEOUT || 10)
  }
};

const phase = `/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`;
const current = await cf('GET', phase);
let existing = [];
if (current.ok) existing = current.json.result?.rules ?? [];
else if (current.status !== 404) throw explain(current, 'Reading rate-limit rules');

// Keep every other rule exactly as it is; only replace ours.
const keep = existing
  .filter((r) => r.ref !== REF)
  .map(({ id, ref, description, expression, action, action_parameters, enabled, ratelimit }) =>
    ({ id, ref, description, expression, action, action_parameters, enabled, ratelimit }));
const put = await cf('PUT', phase, { rules: [...keep, rule] });
if (!put.ok) throw explain(put, 'Saving rate-limit rule');

const saved = put.json.result.rules.find((r) => r.ref === REF);
console.log(`✔ Rate-limit rule active on ${host}/api/tts: ${rule.ratelimit.requests_per_period} requests / ${rule.ratelimit.period}s per IP, block ${rule.ratelimit.mitigation_timeout}s (rule id ${saved?.id}).`);
console.log(`  Other rate-limit rules kept: ${keep.length}`);
