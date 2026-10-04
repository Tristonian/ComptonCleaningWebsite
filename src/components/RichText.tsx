import { RICH_CLASSES, toDisplayHtml } from '@/lib/rich';

/**
 * Shows rich text (ADR 0007). `dangerouslySetInnerHTML` is safe because the only writers are
 * session-checked server actions that run the value through `sanitizeRichHtml` first, and plain
 * text from before the rich editor is escaped by `toRichHtml`.
 *
 * Always a `div`: the paragraphs inside are `<p>`, which cannot nest in a `<p>`.
 */
export function RichText({ html, className = '' }: { html: string; className?: string }) {
  return <div className={`${className} ${RICH_CLASSES}`} dangerouslySetInnerHTML={{ __html: toDisplayHtml(html) }} />;
}
