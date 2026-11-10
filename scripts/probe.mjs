#!/usr/bin/env node
/**
 * Probes the live site the way the app does (Status workflow):
 *  1. GET /                  the app loads
 *  2. POST /api/sync         "Turn on parent dashboard" with a throwaway family + PIN
 *  3. POST /api/parent       open the dashboard with that PIN
 *  4. POST /api/parent       delete the throwaway family again (cleanup)
 *  5. Privacy: noindex on every response, robots.txt disallows all, crawlers and AI agents get 403
 * Prints status codes and bodies so failures (WAF blocks, origin errors, validation) are visible.
 */
const base = (process.env.APP_URL || 'https://cml-math-coach.seolith.com').replace(/\/+$/, '');
const headers = {
  'content-type': 'application/json',
  origin: base,
  referer: base + '/',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
};
const familyId = 'probe_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const pin = '7391';

async function step(label, path, init) {
  try {
    const res = await fetch(base + path, init);
    const text = await res.text();
    const server = res.headers.get('server') ?? '';
    const ray = res.headers.get('cf-ray') ?? '';
    const body = text.length > 300 ? text.slice(0, 300).replace(/\s+/g, ' ') + '…' : text.replace(/\s+/g, ' ');
    console.log(`${res.ok ? '✔' : '✘'} ${label}: HTTP ${res.status} (${res.headers.get('content-type') ?? '-'}; ${server}${ray ? ' ray ' + ray : ''}) ${path === '/' ? '' : body}`);
    return res.status;
  } catch (e) {
    console.log(`✘ ${label}: ${e.message}`);
    return 0;
  }
}

console.log(`Probing ${base}`);
await step('App loads', '/', { headers: { 'user-agent': headers['user-agent'] } });
const sync = await step('Turn on dashboard (POST /api/sync)', '/api/sync', {
  method: 'POST', headers,
  body: JSON.stringify({ familyId, pin, child: { name: 'Probe', grade: 2 }, snapshot: { v: 1 }, attempts: [] })
});
await step('Open dashboard (POST /api/parent)', '/api/parent', { method: 'POST', headers, body: JSON.stringify({ familyId, pin }) });
if (sync === 200) await step('Clean up (delete probe family)', '/api/parent', { method: 'POST', headers, body: JSON.stringify({ familyId, pin, action: 'delete' }) });

// ---------- privacy: not searchable, not for crawlers or AI agents ----------
console.log('\nPrivacy');
const check = (ok, label, detail) => console.log(`${ok ? '✔' : '✘'} ${label}${detail ? ': ' + detail : ''}`);
const BOTS = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'GPTBot/1.2', 'ChatGPT-User/1.0', 'ClaudeBot/1.0', 'Claude-User/1.0', 'PerplexityBot/1.0', 'CCBot/2.0', 'HeadlessChrome/131.0'];
try {
  const home = await fetch(base + '/', { headers: { 'user-agent': headers['user-agent'] } });
  const html = await home.text();
  check(/noindex/.test(home.headers.get('x-robots-tag') ?? ''), 'X-Robots-Tag on the app', home.headers.get('x-robots-tag') ?? 'missing');
  check(/<meta name="robots" content="noindex/.test(html), 'robots meta tag');
  const api = await fetch(base + '/api/parent', { method: 'POST', headers, body: '{}' });
  check(/noindex/.test(api.headers.get('x-robots-tag') ?? ''), 'X-Robots-Tag on the API', `HTTP ${api.status}`);
  const robots = await (await fetch(base + '/robots.txt', { headers: { 'user-agent': BOTS[1] } })).text();
  check(/User-agent: \*\s+Disallow: \/\s*$/m.test(robots), 'robots.txt disallows everything');
  for (const ua of BOTS) {
    const r = await fetch(base + '/', { headers: { 'user-agent': ua } });
    check(r.status === 403, `${ua.match(/[A-Za-z-]*(bot|user|headless)[A-Za-z-]*/i)?.[0] ?? ua} is refused`, `HTTP ${r.status}`);
  }
} catch (e) {
  check(false, 'Privacy checks', e.message);
}
