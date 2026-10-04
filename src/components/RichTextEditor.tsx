'use client';

import dynamic from 'next/dynamic';

/**
 * The rich text box, loaded only when it is first shown. Visitors never open it, and the editor
 * library is most of the weight, so it must stay out of the public page's bundle (ADR 0007).
 */
export const RichTextEditor = dynamic(() => import('./RichTextEditorImpl').then((m) => m.RichTextEditorImpl), {
  ssr: false,
  loading: () => <div className="min-h-[140px] rounded-xl border border-ink/20 bg-white" aria-hidden />,
});
