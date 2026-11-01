/**
 * Cloudflare Pages Function: GET /api/tts?v=<speaker>&t=<text>
 * Returns natural-sounding MP3 speech from Workers AI (Deepgram Aura-2).
 *
 * - The Workers AI binding `AI` is declared in wrangler.toml, so no API keys live in the app.
 * - Responses are cached at the edge (and by the service worker), so repeated phrases are free and instant.
 * - Guard rails: speaker allow-list, text length cap, same-origin check. For stronger abuse protection,
 *   add a Cloudflare rate-limiting rule on /api/tts (see docs/DEPLOY.md).
 */

interface Env {
  AI: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
}

interface Ctx {
  request: Request;
  env: Env;
  waitUntil?: (p: Promise<unknown>) => void;
}

export const MODEL = '@cf/deepgram/aura-2-en';
export const MAX_CHARS = 600;
export const SPEAKERS = [
  'amalthea', 'andromeda', 'apollo', 'arcas', 'aries', 'asteria', 'athena', 'atlas', 'aurora', 'callista',
  'cora', 'cordelia', 'delia', 'draco', 'electra', 'harmonia', 'helena', 'hera', 'hermes', 'hyperion',
  'iris', 'janus', 'juno', 'jupiter', 'luna', 'mars', 'minerva', 'neptune', 'odysseus', 'ophelia',
  'orion', 'orpheus', 'pandora', 'phoebe', 'pluto', 'saturn', 'thalia', 'theia', 'vesta', 'zeus'
];

const err = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Workers AI may hand back a stream, bytes, a Response, base64 text or { audio: base64 }. */
export async function toBytes(out: unknown): Promise<ArrayBuffer | Uint8Array> {
  if (out instanceof ReadableStream) return new Response(out).arrayBuffer();
  if (out instanceof Response) return out.arrayBuffer();
  if (out instanceof ArrayBuffer || out instanceof Uint8Array) return out;
  if (typeof out === 'string') return fromBase64(out);
  if (out && typeof out === 'object' && typeof (out as { audio?: unknown }).audio === 'string') return fromBase64((out as { audio: string }).audio);
  throw new Error('Unexpected TTS output');
}

function sameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const ref = request.headers.get('referer') ?? request.headers.get('origin');
  if (!ref) return true; // some privacy modes strip both
  try {
    return new URL(ref).host === url.host;
  } catch {
    return false;
  }
}

export async function onRequestGet(ctx: Ctx): Promise<Response> {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const text = (url.searchParams.get('t') ?? '').replace(/\s+/g, ' ').trim();
  const speaker = (url.searchParams.get('v') ?? 'luna').toLowerCase();
  if (!text) return err(400, 'Missing text');
  if (text.length > MAX_CHARS) return err(413, `Text longer than ${MAX_CHARS} characters`);
  if (!SPEAKERS.includes(speaker)) return err(400, 'Unknown voice');
  if (!sameOrigin(request, url)) return err(403, 'Forbidden');
  if (!env.AI) return err(503, 'Premium voice is not configured');

  const cacheKey = new Request(`${url.origin}/api/tts?v=${speaker}&t=${encodeURIComponent(text)}`);
  const edge = typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : undefined;
  const hit = await edge?.match(cacheKey);
  if (hit) return hit;

  let audio: ArrayBuffer | Uint8Array;
  try {
    audio = await toBytes(await env.AI.run(MODEL, { text, speaker, encoding: 'mp3' }));
  } catch (e) {
    return err(502, `TTS failed: ${(e as Error).message}`);
  }
  const res = new Response(audio as BodyInit, {
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-voice': speaker
    }
  });
  if (edge) {
    const put = edge.put(cacheKey, res.clone());
    if (ctx.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return res;
}
