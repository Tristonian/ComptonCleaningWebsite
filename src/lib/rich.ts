// Pure helpers for rich text (ADR 0007), shared by server and client code and unit tested.
//
// Rich text is stored as a small, sanitised subset of HTML (see rich-sanitize.ts). Everything
// Sam typed before the rich editor existed is plain text, so every reader goes through
// `toRichHtml`, which turns plain text into paragraphs and leaves real rich text alone.

/** Room for markup on top of the 2000 characters of words the plain limit allows. */
export const MAX_RICH_LENGTH = 8000;

/** Escapes only what the editor itself escapes, so a re-saved default compares equal to the default. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** True for values the rich editor saved: they always open with a paragraph or a list. */
export function looksLikeHtml(value: string): boolean {
  return /^\s*<(p|h2|h3|ul|ol|blockquote|hr)[\s>/]/i.test(value);
}

/** Plain text to paragraphs: a blank line starts a new paragraph, a single newline is a line break. */
export function plainToRichHtml(text: string): string {
  const t = text.replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  return t
    .split(/\n[ \t]*\n/)
    .map((para) => `<p>${escapeHtml(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function toRichHtml(value: string): string {
  return looksLikeHtml(value) ? value : plainToRichHtml(value);
}

/** What the editor loads: the empty-paragraph placeholder below becomes a truly empty paragraph again. */
export function toEditorHtml(value: string): string {
  return toRichHtml(value).replace(/<p><br\s*\/?><\/p>/gi, '<p></p>');
}

/**
 * What the page shows. An empty paragraph has no height in a browser, which is exactly how a blank
 * line Sam typed would silently vanish; a line break inside it gives it one line of height.
 */
export function toDisplayHtml(value: string): string {
  return toRichHtml(value).replace(/<p><\/p>/gi, '<p><br></p>');
}

/** The words only, for "Original: ..." lines and emptiness checks. */
export function richToPlain(html: string): string {
  return html
    .replace(/<\/(p|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/** Tailwind classes that give rich text its paragraph gaps and lists (Tailwind's reset removes both). */
export const RICH_CLASSES =
  '[&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:underline [&_ul:last-child]:mb-0 [&_ol:last-child]:mb-0 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-bold [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-ink/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-4 [&_hr]:border-t [&_hr]:border-ink/20';
