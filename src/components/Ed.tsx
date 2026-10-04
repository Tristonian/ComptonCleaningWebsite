'use client';

import { useEffect, type ElementType, type KeyboardEvent, type MouseEvent } from 'react';
import { useEditMode } from '@/components/EditMode';
import { cy } from '@/content/cy';

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
}: {
  id: string;
  as?: ElementType;
  className?: string;
  /** The English default. A plain string: this is a text node, not a slot. */
  children: string;
  label?: string;
}) {
  const { locale, editing, selected, select, register, currentOf } = useEditMode();

  const welsh = locale === 'cy' ? cy[id] : undefined;
  const defaultText = welsh ?? children;
  const machine = welsh !== undefined;

  useEffect(() => {
    register(id, defaultText, machine);
  }, [id, defaultText, machine, register]);

  const text = currentOf(id) ?? defaultText;

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
