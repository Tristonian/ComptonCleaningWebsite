'use client';

import { useEffect, type ElementType, type KeyboardEvent, type MouseEvent } from 'react';
import { useEditMode } from '@/components/EditMode';
import { cy } from '@/content/cy';
import { RICH_CLASSES, toDisplayHtml, toRichHtml } from '@/lib/rich';

/**
 * One editable piece of text.
 *
 *     <Ed id="home.hero.title" as="h1" className="...">Window cleaning, done properly</Ed>
 *
 * The English default is the children; the Welsh default comes from `src/content/cy.ts` by id,
 * falling back to English if there isn't one. A saved override for the current language wins.
 *
 * With edit mode off this renders exactly what a visitor sees: the tag, the className, the text.
 * No wrapper, no data attribute. When on, the node becomes a button that selects it; selection
 * is drawn with `outline` (see globals.css) so it can never shift the layout being judged.
 */
export function Ed({
  id,
  as: Tag = 'span',
  className,
  children,
  label,
  rich = false,
}: {
  id: string;
  as?: ElementType;
  className?: string;
  /** The English default. A plain string: this is a text node, not a slot. */
  children: string;
  label?: string;
  /**
   * Body copy that can have paragraphs, bold, lists and links (ADR 0007). Shown through a `div`
   * whatever `as` says, because the paragraphs inside are `<p>` and cannot nest in a `<p>`.
   */
  rich?: boolean;
}) {
  const { locale, editing, selected, select, register, currentOf } = useEditMode();

  const welsh = locale === 'cy' ? cy[id] : undefined;
  const defaultText = welsh ?? children;
  const machine = welsh !== undefined;

  useEffect(() => {
    register(id, rich ? toRichHtml(defaultText) : defaultText, machine, rich);
  }, [id, defaultText, machine, rich, register]);

  const text = currentOf(id) ?? defaultText;

  if (rich) {
    const html = toDisplayHtml(text);
    const cls = `${className ?? ''} ${RICH_CLASSES}`;
    if (!editing) return <div className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
    return (
      <div
        className={cls}
        data-ed={id}
        data-ed-selected={selected === id || undefined}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label ?? id}`}
        onClick={(e) => {
          // A link inside the text must not navigate away from the page being edited.
          e.preventDefault();
          e.stopPropagation();
          select(id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            select(id);
          }
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (!editing) return <Tag className={className}>{text}</Tag>;

  function choose(e: MouseEvent | KeyboardEvent) {
    // These nodes sit inside links and buttons: without this, tapping a nav label navigates
    // away from the page being edited.
    e.preventDefault();
    e.stopPropagation();
    select(id);
  }

  return (
    <Tag
      className={className}
      data-ed={id}
      data-ed-selected={selected === id || undefined}
      role="button"
      tabIndex={0}
      aria-label={`Edit ${label ?? id}`}
      onClick={choose}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') choose(e);
      }}
    >
      {text}
    </Tag>
  );
}
