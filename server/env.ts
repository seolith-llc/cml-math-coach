import type { DB } from './parent';
import type { Mailer } from './email';
import { sendSes } from './ses';

export interface Env {
  DB?: DB;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  /** e.g. "CML Math Coach <coach@seolith.com>" (the domain must be verified in SES) */
  MAIL_FROM?: string;
  MAIL_REPLY_TO?: string;
  CRON_SECRET?: string;
  /** Public site URL for links in emails; defaults to the request's origin. */
  APP_URL?: string;
}

export function mailerFrom(env: Env): Mailer | undefined {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.MAIL_FROM) return undefined;
  const creds = { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, region: env.AWS_REGION || 'us-east-1' };
  return (m) => sendSes(creds, { ...m, from: env.MAIL_FROM!, replyTo: env.MAIL_REPLY_TO || undefined });
}

export function originFor(env: Env, request: Request): string {
  const url = (env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '');
  return url;
}
