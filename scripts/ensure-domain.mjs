#!/usr/bin/env node
/**
 * CI helper: makes sure the production domain is attached to the Pages project (idempotent) and prints its status.
 * Needs CLOUDFLARE_API_TOKEN (Cloudflare Pages: Edit) and CLOUDFLARE_ACCOUNT_ID.
 * DNS: when a domain isn't active yet and its name has no DNS record at all, adds the one CNAME it needs
 * (<host> → <project>.pages.dev, proxied) with CLOUDFLARE_DNS_TOKEN (Zone DNS: Edit) if set. Existing records are never changed.
 */
const API = 'https://api.cloudflare.com/client/v4';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, PROJECT_NAME: project = 'cml-math-coach' } = process.env;
const HOSTS = [...new Set([new URL(process.env.APP_URL || 'https://puzzletrail.seolith.com').host, 'puzzletrail.seolith.com', 'cml-math-coach.seolith.com'])];

async function cf(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error((json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
  return json.result;
}

/** Adds <host> CNAME <project>.pages.dev in the parent zone when the name has no record at all. True when added. */
async function addCname(host) {
  const dnsToken = process.env.CLOUDFLARE_DNS_TOKEN || token;
  const zoneName = host.split('.').slice(-2).join('.');
  const dns = async (method, path, body) => {
    const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${dnsToken}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error((json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
    return json.result;
  };
  try {
    const zone = (await dns('GET', `/zones?name=${zoneName}`))?.[0];
    if (!zone) return false;
    const existing = await dns('GET', `/zones/${zone.id}/dns_records?name=${host}`);
    if (existing.length) {
      console.log(`DNS ${host}: ${existing.map((r) => `${r.type} ${r.content}`).join(', ')} (left as is)`);
      return false;
    }
    await dns('POST', `/zones/${zone.id}/dns_records`, { type: 'CNAME', name: host, content: `${project}.pages.dev`, proxied: true, ttl: 1, comment: 'Puzzle Trail (scripts/ensure-domain.mjs)' });
    return true;
  } catch (e) {
    console.log(`DNS ${host}: could not add the CNAME (${e.message})`);
    return false;
  }
}

for (const host of HOSTS) {
  try {
    const base = `/accounts/${account}/pages/projects/${project}/domains`;
    let domain = (await cf('GET', base)).find((d) => d.name === host);
    if (!domain) {
      domain = await cf('POST', base, { name: host });
      console.log(`Attached ${host} to ${project}`);
    }
    const v = domain.validation_data || {};
    const vr = domain.verification_data || {};
    console.log(`Domain ${host}: status=${domain.status}${v.status ? ` validation=${v.status}` : ''}${v.error_message ? ` (${v.error_message})` : ''}${vr.error_message ? ` verification: ${vr.error_message}` : ''}`);
    if (domain.status === 'active') console.log(`✔ ${host} is active on Pages`);
    else if (await addCname(host)) console.log(`::notice::Added DNS CNAME ${host} → ${project}.pages.dev; the domain turns active within minutes (next deploy confirms).`);
    else console.log(`::warning::${host} is "${domain.status}". It needs a DNS CNAME ${host} → ${project}.pages.dev (Cloudflare DNS creates it when you attach the domain in the dashboard; a different existing record blocks it).`);
  } catch (e) {
    console.log(`::warning::Could not check the custom domain: ${e.message}`);
  }
}

