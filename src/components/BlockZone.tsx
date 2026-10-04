'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from '@/components/EditMode';
import { RichText } from '@/components/RichText';
import { RichTextEditor } from '@/components/RichTextEditor';
import { toEditorHtml } from '@/lib/rich';
import { MAX_PHOTO_BYTES, ZONES, blockText, type Block, type ZoneId } from '@/lib/blocks-shared';
import { PhotoError, shrinkPhoto } from '@/lib/photo-resize';
import {
  addPhotoBlockAction,
  addTextBlockAction,
  deleteBlockAction,
  placeBlockAction,
  updateBlockTextAction,
} from '@/app/block-actions';

/**
 * A place on the page where Sam can add photos and text and arrange them (pencil mode only; visitors
 * just see the blocks). Arranging: drag a block (mouse) or use the ▲ ▼ buttons (phones, where drag
 * does not exist). ▲ at the top of a zone moves a block to the end of the zone above, ▼ at the bottom
 * to the start of the zone below. Dropping image files from the desktop onto a zone uploads them.
 * Every action is also checked on the server; this component only drives the UI.
 */

const MOVE_ID = 'application/x-compton-block';
const BIG = 1_000_000; // "the end" for placeBlock, which clamps

/**
 * GIFs go up untouched (re-encoding would flatten the animation), so the server's size cap applies to
 * the file as chosen; every other type is shrunk in the browser first.
 */
async function prepare(file: File): Promise<{ file: File; width: number; height: number }> {
  if (file.type !== 'image/gif') return shrinkPhoto(file);
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError(`${file.name} is over 1.5 MB. Shrink or shorten the GIF and try again.`);
  const bmp = await createImageBitmap(file);
  const size = { file, width: bmp.width, height: bmp.height };
  bmp.close();
  return size;
}

const STATIC_ORDER: string[] = ZONES.map((z) => z.id);

export function BlockZone({
  zone,
  blocks,
  compact = false,
  order = STATIC_ORDER,
  label: labelOverride,
}: {
  zone: ZoneId;
  blocks: Block[];
  compact?: boolean;
  /** Every zone top to bottom (custom services included), for the up/down buttons at a zone's ends. */
  order?: string[];
  label?: string;
}) {
  const { editing, locale } = useEditMode();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const files = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  if (!editing && blocks.length === 0) return null;

  const label = labelOverride ?? ZONES.find((z) => z.id === zone)?.label ?? zone;

  async function run(what: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(what);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Something went wrong.');
      else router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function upload(picked: File[]) {
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return setError('Those are not images. Use PNG, JPG or WebP photos.');
    setError(null);
    let problem: string | null = null;
    for (let i = 0; i < images.length; i++) {
      setBusy(`Uploading photo ${i + 1} of ${images.length}…`);
      try {
        const small = await prepare(images[i]);
        const body = new FormData();
        body.set('file', small.file);
        body.set('zone', zone);
        body.set('width', String(small.width));
        body.set('height', String(small.height));
        const r = await addPhotoBlockAction(body);
        if (!r.ok) problem = r.error;
      } catch (e) {
        problem = e instanceof PhotoError ? e.message : 'A photo could not be uploaded.';
      }
    }
    setBusy(null);
    if (problem) setError(problem);
    router.refresh();
  }

  /** Where a drop at this height lands: before the first block whose middle is below the pointer. */
  function indexAt(clientY: number): number {
    const items = list.current?.querySelectorAll<HTMLElement>('[data-block]') ?? [];
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return items.length;
  }

  function move(b: Block, i: number, dir: -1 | 1) {
    const z = order.indexOf(zone);
    if (dir === -1 && i === 0) {
      if (z === 0) return;
      return run('move', () => placeBlockAction(b.id, order[z - 1], BIG));
    }
    if (dir === 1 && i === blocks.length - 1) {
      if (z === order.length - 1) return;
      return run('move', () => placeBlockAction(b.id, order[z + 1], 0));
    }
    // Index is in "list as it is now" terms: up = before the previous item, down = after the next one.
    return run('move', () => placeBlockAction(b.id, zone, dir === -1 ? i - 1 : i + 2));
  }

  const small = 'rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold text-brand-deep shadow ring-1 ring-ink/20 disabled:opacity-40';

  return (
    <div
      className={`${compact ? 'mt-4' : 'mx-auto max-w-2xl px-4 py-3'} ${editing ? 'my-2 rounded-xl outline-dashed outline-2 outline-offset-[-2px] outline-brand-deep/40' : ''}`}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        setDropAt(indexAt(e.clientY));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
      }}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        const at = indexAt(e.clientY);
        setDropAt(null);
        const id = e.dataTransfer.getData(MOVE_ID);
        if (id) return void run('move', () => placeBlockAction(id, zone, at));
        if (e.dataTransfer.files.length) void upload([...e.dataTransfer.files]);
      }}
    >
      {editing && <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-deep/70">{label}</p>}

      <div ref={list} className="flex flex-col gap-4">
        {blocks.map((b, i) => (
          <div key={b.id}>
            {dropAt === i && <div className="mb-2 h-1.5 rounded bg-brand-deep" />}
            <div
              data-block
              draggable={editing}
              onDragStart={(e) => {
                e.dataTransfer.setData(MOVE_ID, b.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDropAt(null)}
              className={`relative ${editing ? 'cursor-grab rounded-xl ring-1 ring-ink/20 active:cursor-grabbing' : ''}`}
            >
              {b.kind === 'image' && b.hash ? (
                <figure className="flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/img/${b.hash}`}
                    alt={blockText(b, locale)}
                    width={b.width ?? undefined}
                    height={b.height ?? undefined}
                    loading="lazy"
                    draggable={false}
                    className="h-auto w-auto max-w-full rounded-2xl"
                  />
                  {blockText(b, locale) && (
                    <figcaption className="mt-2 text-sm text-ink/70">{blockText(b, locale)}</figcaption>
                  )}
                </figure>
              ) : (
                <RichText html={blockText(b, locale)} className="text-lg" />
              )}

              {editing && (
                <div className="absolute right-2 top-2 flex gap-1.5">
                  <button type="button" aria-label="Move up" disabled={!!busy} className={small} onClick={() => move(b, i, -1)}>
                    ▲
                  </button>
                  <button type="button" aria-label="Move down" disabled={!!busy} className={small} onClick={() => move(b, i, 1)}>
                    ▼
                  </button>
                  <button
                    type="button"
                    aria-label={b.kind === 'image' ? 'Edit caption' : 'Edit text'}
                    disabled={!!busy}
                    className={small}
                    onClick={() => {
                      setEditingId(b.id);
                      setDraft(b.kind === 'image' ? blockText(b, locale) : toEditorHtml(blockText(b, locale)));
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    disabled={!!busy}
                    className={`${small} !text-red-700`}
                    onClick={() => {
                      if (confirm(b.kind === 'image' ? 'Delete this photo?' : 'Delete this text?')) {
                        void run('delete', () => deleteBlockAction(b.id));
                      }
                    }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>

            {editing && editingId === b.id && (
              <div className="mt-2 rounded-xl bg-white p-3 shadow ring-1 ring-ink/20">
                <div className="text-xs font-semibold text-ink/70">
                  {b.kind === 'image' ? 'Caption' : 'Text'} ({locale === 'cy' ? 'Cymraeg' : 'English'})
                  <div className="mt-1 font-normal">
                    {b.kind === 'image' ? (
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-ink/20 p-2 text-base text-ink"
                      />
                    ) : (
                      <RichTextEditor key={`${b.id}:${locale}`} value={draft} onChange={setDraft} autoFocus />
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    className="flex-1 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    onClick={async () => {
                      await run('save', () => updateBlockTextAction(b.id, locale, draft));
                      setEditingId(null);
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-ink ring-1 ring-ink/20"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {dropAt === blocks.length && dropAt > 0 && <div className="h-1.5 rounded bg-brand-deep" />}
      </div>

      {editing && (
        <>
          {blocks.length === 0 && (
            <p className="rounded-xl py-6 text-center text-sm font-semibold text-brand-deep/70">
              {dropAt === 0 ? 'Drop it here' : 'Nothing here yet. Add a photo or some text, or drag photos in.'}
            </p>
          )}
          <input
            ref={files}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => {
              const picked = [...(e.target.files ?? [])];
              e.target.value = '';
              if (picked.length) void upload(picked);
            }}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} className={small} onClick={() => files.current?.click()}>
              📷 Add photos
            </button>
            <button type="button" disabled={!!busy} className={small} onClick={() => run('add', () => addTextBlockAction(zone))}>
              ➕ Add text
            </button>
          </div>
          {busy && busy !== 'move' && busy !== 'save' && busy !== 'delete' && busy !== 'add' && (
            <p role="status" className="mt-2 text-sm font-semibold text-brand-deep">
              {busy}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
