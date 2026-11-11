/** POST /api/feedback: a message from the in-app Feedback button (see server/userFeedback.ts). */
import { handle } from '../../server/parent';
import { mailerFrom, type Env } from '../../server/env';
import { submitFeedback } from '../../server/userFeedback';

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  return handle(request, env.DB, (db, body) => submitFeedback(db, body, { mailer: mailerFrom(env), to: env.FEEDBACK_TO || env.MAIL_REPLY_TO }));
}
