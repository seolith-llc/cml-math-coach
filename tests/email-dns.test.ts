import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs CI helper without type declarations
import { planEmailDns, unquote } from '../scripts/email-dns-plan.mjs';

const base = { zone: 'seolith.com', mailFrom: 'bounce.seolith.com', region: 'us-east-1', records: [], ses: { kind: 'domain', mailFromDomain: null } };

describe('email DNS plan (scripts/email-dns.mjs)', () => {
  it('on a clean zone: creates MX + SPF at the MAIL FROM name, a monitor-only DMARC, and sets SES', () => {
    const p = planEmailDns(base);
    expect(p.conflicts).toEqual([]);
    expect(p.create).toEqual([
      { type: 'MX', name: 'bounce.seolith.com', content: 'feedback-smtp.us-east-1.amazonses.com', priority: 10 },
      { type: 'TXT', name: 'bounce.seolith.com', content: 'v=spf1 include:amazonses.com ~all' },
      { type: 'TXT', name: '_dmarc.seolith.com', content: 'v=DMARC1; p=none' }
    ]);
    expect(p.ses).toEqual({ mailFromDomain: 'bounce.seolith.com' });
  });

  it('adds the DMARC report address when given, and rejects one that is not an email', () => {
    expect(planEmailDns({ ...base, dmarcRua: 'dmarc@seolith.com' }).create[2].content).toBe('v=DMARC1; p=none; rua=mailto:dmarc@seolith.com');
    expect(planEmailDns({ ...base, dmarcRua: 'nope' }).conflicts.join()).toMatch(/isn't an email/);
  });

  it('is idempotent: everything already in place → nothing to do', () => {
    const p = planEmailDns({
      ...base,
      records: [
        { type: 'MX', name: 'bounce.seolith.com', content: 'feedback-smtp.us-east-1.amazonses.com', priority: 10 },
        { type: 'TXT', name: 'bounce.seolith.com', content: '"v=spf1 include:amazonses.com ~all"' },
        { type: 'TXT', name: '_dmarc.seolith.com', content: '"v=DMARC1; p=none"' }
      ],
      ses: { kind: 'domain', mailFromDomain: 'bounce.seolith.com' }
    });
    expect(p.create).toEqual([]);
    expect(p.ses).toBeNull();
    expect(p.conflicts).toEqual([]);
    expect(p.ok).toHaveLength(3);
  });

  it('never changes an existing DMARC record (it is only reported)', () => {
    const p = planEmailDns({ ...base, records: [{ type: 'TXT', name: '_dmarc.seolith.com', content: 'v=DMARC1; p=quarantine; rua=mailto:x@y.com' }] });
    expect(p.create.some((r: { name: string }) => r.name === '_dmarc.seolith.com')).toBe(false);
    expect(p.keep.join()).toMatch(/p=quarantine.*left as is/);
  });

  it('stops on conflicts instead of overwriting', () => {
    const mx = planEmailDns({ ...base, records: [{ type: 'MX', name: 'bounce.seolith.com', content: 'mx.other.net' }] });
    expect(mx.conflicts.join()).toMatch(/already has MX mx\.other\.net/);
    const spf = planEmailDns({ ...base, records: [{ type: 'TXT', name: 'bounce.seolith.com', content: 'v=spf1 include:_spf.google.com ~all' }] });
    expect(spf.conflicts.join()).toMatch(/already has SPF/);
    const cname = planEmailDns({ ...base, records: [{ type: 'CNAME', name: 'bounce.seolith.com', content: 'x.example.com' }] });
    expect(cname.conflicts.join()).toMatch(/CNAME/);
    const otherFrom = planEmailDns({ ...base, ses: { kind: 'domain', mailFromDomain: 'mail.seolith.com' } });
    expect(otherFrom.conflicts.join()).toMatch(/different MAIL FROM \(mail\.seolith\.com\)/);
  });

  it('never targets the root domain, and needs a verified domain identity in SES', () => {
    expect(planEmailDns({ ...base, mailFrom: 'seolith.com' }).conflicts.join()).toMatch(/subdomain/);
    expect(planEmailDns({ ...base, mailFrom: 'bounce.other.com' }).conflicts.join()).toMatch(/subdomain/);
    expect(planEmailDns({ ...base, ses: { kind: 'email' } }).conflicts.join()).toMatch(/no verified domain identity/);
    expect(planEmailDns({ ...base, region: 'useast1' }).conflicts.join()).toMatch(/AWS region/);
  });

  it('reads TXT content the way Cloudflare returns it (quoted, possibly in chunks)', () => {
    expect(unquote('"v=spf1 include:amazonses.com ~all"')).toBe('v=spf1 include:amazonses.com ~all');
    expect(unquote('"v=DMARC1; p=none" "; rua=mailto:a@b.co"')).toBe('v=DMARC1; p=none; rua=mailto:a@b.co');
  });
});
