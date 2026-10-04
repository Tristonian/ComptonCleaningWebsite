'use client';

import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { RICH_CLASSES } from '@/lib/rich';

/**
 * The rich text box Sam writes with, adapted from HairByRachel's `RichTextEditor` and cut down to
 * what a brochure site needs: bold, italic, underline, bullets, numbers, links. Enter starts a new
 * paragraph and Enter on an empty line leaves a visible blank line, which is the whole point (ADR 0007).
 * The server sanitises again on save; this toolbar just keeps the common case sensible.
 *
 * `value` is only read once, when the box mounts: give it a `key` to load different text.
 */
export function RichTextEditorImpl({
  value,
  onChange,
  autoFocus = false,
  minHeight = 96,
}: {
  value: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      // Headings, code, quotes, rules and strikethrough are not offered, so they are not parsed either.
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
    ],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: false,
    editorProps: { attributes: { 'aria-label': 'Text', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  function insertLink() {
    if (!editor) return;
    const url = window.prompt('Link address (https://…, or tel:… for a phone number). Leave empty to remove the link.');
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    if (url.trim() === '') chain.unsetLink().run();
    else chain.setLink({ href: url.trim() }).run();
  }

  if (!editor) return <div className="rounded-xl border border-ink/20" style={{ minHeight: minHeight + 44 }} />;

  return (
    <div className="rounded-xl border border-ink/20 bg-white focus-within:border-brand">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink/10 p-1.5">
        <Tool label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </Tool>
        <Tool label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </Tool>
        <Tool
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </Tool>
        <Tool
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </Tool>
        <Tool
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </Tool>
        <Tool label="Link" active={editor.isActive('link')} onClick={insertLink}>
          🔗
        </Tool>
        <span className="ml-auto pr-1 text-xs text-ink/50">Enter = new paragraph</span>
      </div>
      <EditorContent
        editor={editor}
        className={`p-3 text-base text-ink [&_.ProseMirror]:outline-none [&_a]:text-brand ${RICH_CLASSES}`}
        style={{ ['--rich-min' as string]: `${minHeight}px` }}
      />
      <style>{`.ProseMirror{min-height:var(--rich-min,96px)}`}</style>
    </div>
  );
}

function Tool({
  children,
  label,
  active,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      // Keep the text selection: a plain click would blur the editor before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium ${
        active ? 'bg-brand text-white' : 'text-ink hover:bg-ink/10'
      }`}
    >
      {children}
    </button>
  );
}
