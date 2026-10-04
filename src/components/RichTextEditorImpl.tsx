'use client';

import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import { FontSize } from '@/lib/tiptap-font-size';
import { RICH_CLASSES } from '@/lib/rich';

/**
 * The rich text box Sam writes with, adapted from HairByRachel's `RichTextEditor` and cut down to
 * what a brochure site needs: size, colour, bold, italic, underline, alignment, bullets, numbers, links. Enter starts a new
 * paragraph and Enter on an empty line leaves a visible blank line, which is the whole point (ADR 0007).
 * The server sanitises again on save; this toolbar just keeps the common case sensible.
 *
 * `value` is only read once, when the box mounts: give it a `key` to load different text.
 */
const FONT_SIZES = [
  { label: 'Size', value: '' },
  { label: 'Small', value: '14px' },
  { label: 'Large', value: '20px' },
  { label: 'X-Large', value: '28px' },
  { label: 'Huge', value: '36px' },
];

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
      // Same set as Rachel's editor: two heading sizes, quotes and rules are on; code and strikethrough are not offered.
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        strike: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
        <select
          aria-label="Text size"
          className="h-9 rounded-lg border border-ink/20 bg-white px-1 text-sm text-ink"
          value={(editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''}
          onChange={(e) => {
            const size = e.target.value;
            if (size) editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
            else editor.chain().focus().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
          }}
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="color"
          aria-label="Text colour"
          title="Text colour"
          className="h-9 w-9 cursor-pointer rounded-lg border border-ink/20 bg-white p-0.5"
          value={(editor.getAttributes('textStyle').color as string | undefined) ?? '#1a1a1a'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <Tool label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          ⯇
        </Tool>
        <Tool label="Centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          ≡
        </Tool>
        <Tool label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          ⯈
        </Tool>
        <Tool label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Tool>
        <Tool label="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </Tool>
        <Tool label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          ❝
        </Tool>
        <Tool label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          —
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
