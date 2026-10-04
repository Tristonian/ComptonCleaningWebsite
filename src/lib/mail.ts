import 'server-only';
import { NOTIFY_FROM } from '@/lib/business';
import { getEnv } from '@/lib/env';

/** An inline image: reference it in the HTML as `<img src="cid:CONTENT_ID">`. */
export interface InlineImage {
  filename: string;
  contentBase64: string;
  contentType: string;
  contentId: string;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  inline?: InlineImage[];
}

/**
 * Send through Resend's REST API (a plain fetch: no SDK needed on Workers).
 * `RESEND_API` is the API key. `MAIL_FROM` overrides the sender, e.g. `onboarding@resend.dev` while
 * the domain is not yet verified in Resend (that sender can only reach the Resend account owner).
 * Throws on any non-2xx so the caller can log it; never logs the key.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = getEnv('RESEND_API');
  if (!key) throw new Error('RESEND_API is missing or empty');
  const address = getEnv('MAIL_FROM') ?? NOTIFY_FROM;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Compton Cleaning website <${address}>`,
      // `to` may be a comma-separated list (ENQUIRY_TO="sam@..., someone@...").
      to: mail.to.split(',').map((a) => a.trim()).filter(Boolean),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      ...(mail.inline?.length
        ? {
            attachments: mail.inline.map((i) => ({
              filename: i.filename,
              content: i.contentBase64,
              content_type: i.contentType,
              content_id: i.contentId,
            })),
          }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
