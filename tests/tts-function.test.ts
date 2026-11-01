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
