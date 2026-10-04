import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { MAX_RICH_LENGTH, looksLikeHtml, richToPlain } from '@/lib/rich';

/**
 * The allow-list for the rich text Sam writes with the pencil (ADR 0007). Runs on every save, so
 * whatever reaches the database is safe to render with dangerouslySetInnerHTML. Deliberately
 * small: paragraphs, line breaks, bold, italic, underline, lists and links. No styles, no images.
 */
export function sanitizeRichHtml(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      // Internal links stay in the tab; external ones open a new one without leaking the referrer.
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        const out: Record<string, string> = { href };
        if (/^https?:\/\//i.test(href)) Object.assign(out, { target: '_blank', rel: 'noreferrer' });
        return { tagName, attribs: out };
      },
    },
  });
  // Blank paragraphs inside the text are kept (that is how Sam makes a gap); at the very start and
  // end they are only stray Enter presses.
  const empty = '(?:<p>(?:<br\\s*/?>)?</p>)';
  return clean.replace(new RegExp(`^(?:${empty})+`, 'i'), '').replace(new RegExp(`(?:${empty})+$`, 'i'), '').trim();
}

/**
 * For fields where empty is allowed (a text block, a service description). Plain text passes
 * through trimmed; rich text is sanitised, and "nothing but blank paragraphs" becomes ''.
 */
export function cleanRichField(raw: string, maxPlain: number): { ok: true; value: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!looksLikeHtml(text)) {
    return text.length > maxPlain ? { ok: false, error: 'That text is too long.' } : { ok: true, value: text };
  }
  const value = sanitizeRichHtml(text);
  if (!richToPlain(value)) return { ok: true, value: '' };
  if (value.length > MAX_RICH_LENGTH) return { ok: false, error: 'That text is too long.' };
  return { ok: true, value };
}

export type RichCheck ={ ok: true; value: string } | { ok: false; error: string };

/** Sanitise, then apply the same rules the plain editor has: not empty, not too long, no control characters. */
export function checkRichValue(raw: unknown): RichCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'That is not text.' };
  const value = sanitizeRichHtml(raw);
  if (!richToPlain(value)) return { ok: false, error: 'This cannot be empty. Use Revert to restore the original.' };
  if (value.length > MAX_RICH_LENGTH) return { ok: false, error: 'That is too long. Shorten it and try again.' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    return { ok: false, error: 'That contains characters that cannot be saved.' };
  }
  return { ok: true, value };
}
