/** Every request: keep crawlers and AI agents out, and mark everything noindex (see server/guard.ts). */
import { guard, withNoindex } from '../server/guard';

export async function onRequest({ request, next }: { request: Request; next: () => Promise<Response> }): Promise<Response> {
  return guard(request) ?? withNoindex(await next());
}
