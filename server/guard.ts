/**
 * Keep the app out of search engines and away from crawlers and AI agents.
 * Runs on every request (functions/_middleware.ts): known bots get 403, everything gets noindex headers.
 * robots.txt stays readable for everyone so well-behaved bots learn to stay away.
 */

/** Search crawlers, AI crawlers/assistants/agents, SEO and archive bots, and headless automation. */
const BOT = new RegExp(
  [
    // search engines
    'googlebot', 'google-inspectiontool', 'googleother', 'google-extended', 'storebot-google', 'adsbot', 'mediapartners-google', 'bingbot', 'bingpreview', 'msnbot',
    'slurp', 'duckduckbot', 'duckassistbot', 'baiduspider', 'yandex', 'sogou', 'exabot', 'seznambot', 'naver', 'yeti', 'qwantify', 'mojeek', 'petalbot', 'applebot',
    // AI crawlers, assistants and agents
    'gptbot', 'chatgpt-user', 'oai-searchbot', 'openai', 'claudebot', 'claude-web', 'claude-user', 'claude-searchbot', 'anthropic', 'perplexitybot', 'perplexity-user',
    'ccbot', 'bytespider', 'amazonbot', 'meta-externalagent', 'meta-externalfetcher', 'facebookbot', 'facebookexternalhit', 'cohere', 'diffbot', 'youbot',
    'mistralai', 'ai2bot', 'timpibot', 'omgili', 'webzio', 'img2dataset', 'scrapy', 'firecrawl', 'jina', 'phindbot', 'kangaroo', 'iaskspider', 'novaact',
    // SEO, archives, previews
    'ahrefs', 'semrush', 'mj12bot', 'dotbot', 'rogerbot', 'screaming frog', 'serpstat', 'dataforseo', 'ia_archiver', 'archive.org_bot', 'heritrix',
    'twitterbot', 'linkedinbot', 'slackbot', 'discordbot', 'telegrambot', 'whatsapp', 'skypeuripreview', 'embedly', 'pinterest',
    // automation
    'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'python-requests', 'python-urllib', 'aiohttp', 'httpx', 'go-http-client', 'java/', 'libwww', 'wget',
    // generic
    '\\bbot\\b', 'crawler', 'spider', 'crawling'
  ].join('|'),
  'i'
);

export const NOINDEX = 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate';

export const ROBOTS_TXT = `# Private app: please don't crawl, index, train on or fetch any of it.
User-agent: *
Disallow: /
`;

export function isBot(userAgent: string | null): boolean {
  return !!userAgent && BOT.test(userAgent);
}

/** Decide what to do with a request before it reaches the app. */
export function guard(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.pathname === '/robots.txt') return new Response(ROBOTS_TXT, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': NOINDEX, 'cache-control': 'public, max-age=3600' } });
  if (isBot(request.headers.get('user-agent'))) return new Response('Forbidden', { status: 403, headers: { 'content-type': 'text/plain', 'x-robots-tag': NOINDEX } });
  return null;
}

/** Every response carries noindex, so nothing is indexed even if a crawler gets through. */
export function withNoindex(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('x-robots-tag', NOINDEX);
  return out;
}
