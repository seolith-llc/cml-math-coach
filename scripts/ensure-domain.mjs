#!/usr/bin/env node
/**
 * CI helper: makes sure the production domain is attached to the Pages project (idempotent) and prints its status.
 * Needs CLOUDFLARE_API_TOKEN (Cloudflare Pages: Edit) and CLOUDFLARE_ACCOUNT_ID. DNS records are never changed here.
 */
const API = 'https://api.cloudflare.com/client/v4';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, PROJECT_NAME: project = 'cml-math-coach' } = process.env;
const host = new URL(process.env.APP_URL || 'https://cml-math-coach.seolith.com').host;

async function cf(method, path, body) {
  const res = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error((json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`);
  return json.result;
}

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
  else console.log(`::warning::${host} is "${domain.status}". It needs a DNS CNAME ${host} → ${project}.pages.dev (Cloudflare DNS creates it when you attach the domain in the dashboard; a different existing record blocks it).`);
} catch (e) {
  console.log(`::warning::Could not check the custom domain: ${e.message}`);
}
