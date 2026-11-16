/**
 * Pure planning for scripts/email-dns.mjs: given what exists (DNS records in the zone, the SES identity),
 * decide what to create. No network, so it is unit-tested (tests/email-dns.test.ts).
 *
 * Rules, chosen so this can never break the domain's other email (seolith.com also carries Google Workspace):
 *   - the root domain's records (SPF, MX) are never read for changes and never touched;
 *   - an existing DMARC record is never changed, only reported;
 *   - a record at the MAIL FROM name that differs from what SES needs is a conflict: nothing is applied.
 */

/** TXT content from the Cloudflare API may come wrapped in quotes and split into chunks. */
export const unquote = (s) => String(s ?? '').replace(/"\s+"/g, '').replace(/^"|"$/g, '').trim();

/**
 * @param {object} p
 * @param {string} p.zone             e.g. "seolith.com"
 * @param {string} p.mailFrom         e.g. "bounce.seolith.com" (must be a subdomain of the zone)
 * @param {string} p.region           SES region, e.g. "us-east-1"
 * @param {string} [p.dmarcRua]       optional address for DMARC aggregate reports
 * @param {{type:string,name:string,content:string,priority?:number}[]} p.records  records at the mailFrom name and _dmarc.<zone>
 * @param {{kind:'domain'|'email'|'missing', mailFromDomain?:string|null}} p.ses
 * @returns {{ ok: string[], create: {type:string,name:string,content:string,priority?:number}[], ses: null|{mailFromDomain:string}, keep: string[], conflicts: string[] }}
 */
export function planEmailDns({ zone, mailFrom, region, dmarcRua, records, ses }) {
  const out = { ok: [], create: [], ses: null, keep: [], conflicts: [] };
  const lc = (s) => String(s).toLowerCase().replace(/\.$/, '');
  zone = lc(zone);
  mailFrom = lc(mailFrom);

  if (!mailFrom.endsWith('.' + zone) || mailFrom === zone) {
    out.conflicts.push(`MAIL FROM ${mailFrom} must be a subdomain of ${zone} (never the root domain itself)`);
    return out;
  }
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(region)) out.conflicts.push(`"${region}" doesn't look like an AWS region`);

  const at = (name) => records.filter((r) => lc(r.name) === name);

  // 1) MX at the MAIL FROM name → SES's feedback endpoint for the region
  const mxTarget = `feedback-smtp.${region}.amazonses.com`;
  const here = at(mailFrom);
  if (here.some((r) => r.type === 'CNAME')) out.conflicts.push(`${mailFrom} has a CNAME, so it can't also have the MX and TXT records SES needs`);
  const mx = here.filter((r) => r.type === 'MX');
  if (mx.length === 0) out.create.push({ type: 'MX', name: mailFrom, content: mxTarget, priority: 10 });
  else if (mx.length === 1 && lc(mx[0].content) === mxTarget) out.ok.push(`MX ${mailFrom} → ${mxTarget}`);
  else out.conflicts.push(`${mailFrom} already has MX ${mx.map((r) => r.content).join(', ')} (SES needs only ${mxTarget})`);

  // 2) SPF at the MAIL FROM name (not the root domain)
  const spfWanted = 'v=spf1 include:amazonses.com ~all';
  const spf = here.filter((r) => r.type === 'TXT' && /^v=spf1\b/i.test(unquote(r.content)));
  if (spf.length === 0) out.create.push({ type: 'TXT', name: mailFrom, content: spfWanted });
  else if (spf.length === 1 && unquote(spf[0].content) === spfWanted) out.ok.push(`SPF ${mailFrom}: ${spfWanted}`);
  else out.conflicts.push(`${mailFrom} already has SPF "${spf.map((r) => unquote(r.content)).join('" and "')}"`);

  // 3) DMARC for the zone: created only if there is none; an existing one is reported, never changed
  const dmarcName = '_dmarc.' + zone;
  const dmarc = at(dmarcName).filter((r) => r.type === 'TXT' && /^v=DMARC1\b/i.test(unquote(r.content)));
  if (dmarc.length) out.keep.push(`DMARC already published at ${dmarcName}: "${unquote(dmarc[0].content)}" (left as is)`);
  else {
    if (dmarcRua && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(dmarcRua)) out.conflicts.push(`DMARC report address "${dmarcRua}" isn't an email address`);
    out.create.push({ type: 'TXT', name: dmarcName, content: `v=DMARC1; p=none${dmarcRua ? `; rua=mailto:${dmarcRua}` : ''}` });
  }

  // 4) SES: a custom MAIL FROM needs a verified *domain* identity
  if (ses.kind !== 'domain') out.conflicts.push(`SES has no verified domain identity for ${zone} (found: ${ses.kind}); a custom MAIL FROM needs one`);
  else if (lc(ses.mailFromDomain ?? '') === mailFrom) out.ok.push(`SES MAIL FROM is ${mailFrom}`);
  else if (ses.mailFromDomain) out.conflicts.push(`SES already uses a different MAIL FROM (${ses.mailFromDomain}); not replacing it`);
  else out.ses = { mailFromDomain: mailFrom };

  return out;
}
