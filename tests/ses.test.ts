import { describe, expect, it, vi } from 'vitest';
import aws4 from 'aws4';
import { sendSes, sesRequestBody, signV4 } from '../server/ses';

const creds = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' };

describe('AWS SigV4', () => {
  it('matches the AWS documentation example (IAM ListUsers)', async () => {
    const h = await signV4({
      method: 'GET', url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08', service: 'iam', region: 'us-east-1',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' }, body: '', creds, date: new Date('2015-08-30T12:36:00Z')
    });
    expect(h.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, SignedHeaders=content-type;host;x-amz-date, Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7'
    );
  });

  it('matches the aws4 reference library for an SES v2 send', async () => {
    const date = new Date('2026-11-08T23:07:00Z');
    const body = JSON.stringify(sesRequestBody({ from: 'Coach <coach@seolith.com>', to: 'parent@example.com', subject: 'Hi ✓', html: '<b>x</b>', text: 'x', headers: { 'List-Unsubscribe': '<https://x/u>' } }));
    // aws4 also signs content-length (both are valid SigV4), so sign the same header set for a like-for-like check
    const len = String(new TextEncoder().encode(body).length);
    const ours = await signV4({ method: 'POST', url: 'https://email.us-east-1.amazonaws.com/v2/email/outbound-emails', service: 'ses', region: 'us-east-1', headers: { 'content-type': 'application/json', 'content-length': len }, body, creds, date });
    vi.useFakeTimers({ now: date });
    const ref = aws4.sign({ host: 'email.us-east-1.amazonaws.com', path: '/v2/email/outbound-emails', method: 'POST', service: 'ses', region: 'us-east-1', headers: { 'content-type': 'application/json' }, body }, creds);
    vi.useRealTimers();
    expect(ours.authorization).toBe((ref.headers as Record<string, string>).Authorization);
  });
});

describe('sendSes', () => {
  const mail = { from: 'Coach <coach@seolith.com>', to: 'p@example.com', subject: 'S', html: '<p>h</p>', text: 't', headers: { 'List-Unsubscribe': '<https://x/u>' } };
  it('posts a signed SES v2 request and returns the message id', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ MessageId: 'abc' }), { status: 200 }));
    expect(await sendSes({ ...creds, region: 'us-east-2' }, mail, f as unknown as typeof fetch)).toBe('abc');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://email.us-east-2.amazonaws.com/v2/email/outbound-emails');
    expect((init.headers as Record<string, string>).authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-2\/ses\/aws4_request/);
    const sent = JSON.parse(init.body as string);
    expect(sent.Content.Simple.Headers).toEqual([{ Name: 'List-Unsubscribe', Value: '<https://x/u>' }]);
  });
  it('retries without custom headers if SES rejects them, and surfaces other errors', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Invalid header name' }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ MessageId: 'ok2' }), { status: 200 }));
    expect(await sendSes({ ...creds, region: 'us-east-1' }, mail, f as unknown as typeof fetch)).toBe('ok2');
    expect(JSON.parse((f.mock.calls[1][1] as RequestInit).body as string).Content.Simple.Headers).toBeUndefined();
    const g = vi.fn(async () => new Response(JSON.stringify({ message: 'Email address is not verified.' }), { status: 400 }));
    await expect(sendSes({ ...creds, region: 'us-east-1' }, mail, g as unknown as typeof fetch)).rejects.toThrow(/not verified/);
  });
});
