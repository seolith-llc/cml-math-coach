import { describe, expect, it, vi } from 'vitest';
import { onRequestGet, toBytes } from '../functions/api/tts';

const mp3 = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]);
const env = (impl?: () => Promise<unknown>) => ({ AI: { run: vi.fn(impl ?? (async () => mp3)) } });
const req = (qs: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Request(`https://cml-math-coach.seolith.com/api/tts?${qs}`, { headers });

describe('/api/tts function', () => {
  it('returns mp3 audio for valid requests', async () => {
    const e = env();
    const res = await onRequestGet({ request: req('v=luna&t=' + encodeURIComponent('Hello there')), env: e });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(mp3);
    expect(e.AI.run).toHaveBeenCalledWith('@cf/deepgram/aura-2-en', { text: 'Hello there', speaker: 'luna', encoding: 'mp3' });
  });
  it('rejects bad input and cross-site use', async () => {
    expect((await onRequestGet({ request: req('v=luna&t='), env: env() })).status).toBe(400);
    expect((await onRequestGet({ request: req('v=robot&t=hi'), env: env() })).status).toBe(400);
    expect((await onRequestGet({ request: req('v=luna&t=' + 'a'.repeat(601)), env: env() })).status).toBe(413);
    expect((await onRequestGet({ request: req('v=luna&t=hi', { 'sec-fetch-site': 'cross-site' }), env: env() })).status).toBe(403);
    expect((await onRequestGet({ request: req('v=luna&t=hi', { referer: 'https://evil.example/' }), env: env() })).status).toBe(403);
  });
  it('reports model failures as 502', async () => {
    const res = await onRequestGet({ request: req('v=luna&t=hi'), env: env(async () => { throw new Error('boom'); }) });
    expect(res.status).toBe(502);
  });
  it('normalises every output shape Workers AI may return', async () => {
    const b64 = btoa(String.fromCharCode(...mp3));
    for (const out of [mp3, mp3.buffer, b64, { audio: b64 }, new Response(mp3), new Response(mp3).body]) {
      expect(new Uint8Array(await toBytes(out) as ArrayBuffer)).toEqual(mp3);
    }
  });
});

import { LIMITS, rateLimit } from '../functions/api/tts';

/** Minimal in-memory stand-in for the Workers Cache API. */
class FakeCache {
  store = new Map<string, string>();
  async match(r: Request) {
    const v = this.store.get(r.url);
    return v === undefined ? undefined : new Response(v);
  }
  async put(r: Request, res: Response) {
    this.store.set(r.url, await res.text());
  }
}

describe('rate limiting', () => {
  it('allows up to the per-minute limit, then asks to retry', async () => {
    const c = new FakeCache() as unknown as Cache;
    const t0 = Date.UTC(2026, 10, 1, 12, 0, 5);
    for (let i = 0; i < LIMITS[0].max; i++) expect(await rateLimit(c, 'https://x', '1.2.3.4', t0)).toBe(0);
    expect(await rateLimit(c, 'https://x', '1.2.3.4', t0)).toBe(55);
    expect(await rateLimit(c, 'https://x', '5.6.7.8', t0)).toBe(0); // other visitors unaffected
    expect(await rateLimit(c, 'https://x', '1.2.3.4', t0 + 60_000)).toBe(0); // next minute
  });

  it('returns 429 from the endpoint but still serves cached clips', async () => {
    const fake = new FakeCache();
    (globalThis as unknown as { caches: unknown }).caches = { default: fake };
    try {
      const e = { AI: { run: vi.fn(async () => new Uint8Array([1, 2, 3])) } };
      const mk = (t: string) => new Request(`https://cml-math-coach.seolith.com/api/tts?v=luna&t=${t}`, { headers: { 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '9.9.9.9' } });
      let last = 200;
      for (let i = 0; i <= LIMITS[0].max; i++) last = (await onRequestGet({ request: mk('word' + i), env: e })).status;
      expect(last).toBe(429);
      expect(e.AI.run).toHaveBeenCalledTimes(LIMITS[0].max);
      const again = await onRequestGet({ request: mk('word0'), env: e }); // cached -> not limited
      expect(again.status).toBe(200);
      expect(e.AI.run).toHaveBeenCalledTimes(LIMITS[0].max);
    } finally {
      delete (globalThis as unknown as { caches?: unknown }).caches;
    }
  });
});
