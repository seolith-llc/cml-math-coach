import { describe, expect, it } from 'vitest';
import { NOINDEX, guard, isBot, withNoindex } from '../server/guard';
import { onRequest } from '../functions/_middleware';

const req = (path: string, ua: string | null) => new Request('https://cml-math-coach.seolith.com' + path, { headers: ua ? { 'user-agent': ua } : {} });

describe('keep crawlers and agents out', () => {
  it('blocks search crawlers, AI crawlers/agents, previews and automation', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'Claude-User/1.0', 'PerplexityBot/1.0', 'CCBot/2.0 (https://commoncrawl.org/faq/)', 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
      'meta-externalagent/1.1', 'Applebot-Extended', 'Mozilla/5.0 (compatible; AhrefsBot/7.0)', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36', 'python-requests/2.32', 'Scrapy/2.11', 'Wget/1.21'
    ]) expect(isBot(ua), ua).toBe(true);
  });

  it('lets real browsers and our own jobs through', () => {
    for (const ua of [
      'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'curl/8.5.0', 'node'
    ]) expect(isBot(ua), ua).toBe(false);
    expect(isBot(null)).toBe(false);
  });

  it('serves robots.txt to everyone, refuses bots elsewhere', async () => {
    const r = guard(req('/robots.txt', 'GPTBot/1.2'))!;
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('Disallow: /');
    expect(guard(req('/', 'GPTBot/1.2'))!.status).toBe(403);
    expect(guard(req('/api/parent', 'ClaudeBot/1.0'))!.status).toBe(403);
    expect(guard(req('/', 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) Safari/604.1'))).toBeNull();
  });

  it('middleware marks every app response noindex', async () => {
    const res = await onRequest({ request: req('/', 'Mozilla/5.0 (iPad) Safari/604.1'), next: async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }) });
    expect(res.headers.get('x-robots-tag')).toBe(NOINDEX);
    expect(res.headers.get('content-type')).toBe('text/html');
    expect(withNoindex(new Response('x', { status: 404 })).status).toBe(404);
  });
});
