'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/content/shared';
import { resetNodeAction, saveNodeAction } from '@/app/actions';
import { Inspector } from '@/components/Inspector';

/**
 * Edit mode: the "pencil anywhere" (ADR 0004), ported from the LesK demo and trimmed to wording.
 *
 * Two ideas do the work, same as LesK:
 *  - Defaults live in the markup (`<Ed id="x">default</Ed>`), so making text editable costs one
 *    line and the database only ever holds what was changed.
 *  - Edits preview locally and commit explicitly, so typing shows on the page immediately.
 *
 * `canEdit` is a UI hint only. The server actions re-check the session on every call.
 */

type Registered = { text: string; machine: boolean };

type EditModeValue = {
  locale: Locale;
  canEdit: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
  selected: string | null;
  select: (key: string | null) => void;
  /** Each <Ed> reports its shipped default for this language. */
  register: (key: string, text: string, machine: boolean) => void;
  registered: (key: string) => Registered | undefined;
  /** The saved override, if any. */
  overrideOf: (key: string) => string | undefined;
  /** What is shown right now: unsaved draft, else saved override, else undefined (use default). */
  currentOf: (key: string) => string | undefined;
  preview: (key: string, text: string) => void;
  discard: (key: string) => void;
  isDirty: (key: string) => boolean;
  commit: (key: string) => Promise<{ ok: boolean; error?: string }>;
  revert: (key: string) => Promise<{ ok: boolean; error?: string }>;
  busy: boolean;
};

const Ctx = createContext<EditModeValue | null>(null);

export function useEditMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEditMode must be used inside <EditModeProvider>');
  return ctx;
}

export function EditModeProvider({
  locale,
  overrides,
  canEdit,
  children,
}: {
  locale: Locale;
  overrides: Record<string, string>;
  canEdit: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editingOn, setEditingOn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // A ref, not state: hundreds of nodes register during first render and each would otherwise
  // trigger a re-render of the whole tree.
  const defaults = useRef<Map<string, Registered>>(new Map());

  const editing = editingOn && canEdit;

  // Turning edit mode off, or switching language, drops unsaved previews: "off" should mean
  // "show me what is actually saved".
  useEffect(() => {
    if (!editing) {
      setSelected(null);
      setDrafts({});
    }
  }, [editing]);
  useEffect(() => {
    setSelected(null);
    setDrafts({});
  }, [locale]);

  const register = useCallback((key: string, text: string, machine: boolean) => {
    defaults.current.set(key, { text, machine });
  }, []);
  const registered = useCallback((key: string) => defaults.current.get(key), []);

  const overrideOf = useCallback((key: string) => overrides[key], [overrides]);
  const currentOf = useCallback((key: string) => drafts[key] ?? overrides[key], [drafts, overrides]);

  const preview = useCallback((key: string, text: string) => setDrafts((d) => ({ ...d, [key]: text })), []);
  const discard = useCallback(
    (key: string) =>
      setDrafts((d) => {
        const { [key]: _gone, ...rest } = d;
        return rest;
      }),
    [],
  );
  const isDirty = useCallback((key: string) => key in drafts, [drafts]);

  const commit = useCallback(
    async (key: string) => {
      const draft = drafts[key];
      if (draft === undefined) return { ok: true };
      setBusy(true);
      // Retyping the shipped default is not an edit. Storing it would pin the page to today's
      // wording, so a later change in code would silently fail to appear.
      const def = defaults.current.get(key);
      const result =
        def && draft.trim() === def.text
          ? await resetNodeAction(locale, key)
          : await saveNodeAction(locale, key, draft);
      setBusy(false);
      if (result.ok) {
        discard(key);
        router.refresh();
        return { ok: true };
      }
      return { ok: false, error: result.error };
    },
    [drafts, locale, discard, router],
  );

  const revert = useCallback(
    async (key: string) => {
      setBusy(true);
      const result = await resetNodeAction(locale, key);
      setBusy(false);
      if (result.ok) {
        discard(key);
        router.refresh();
        return { ok: true };
      }
      return { ok: false, error: result.error };
    },
    [locale, discard, router],
  );

  const value = useMemo<EditModeValue>(
    () => ({
      locale,
      canEdit,
      editing,
      setEditing: setEditingOn,
      selected,
      select: setSelected,
      register,
      registered,
      overrideOf,
      currentOf,
      preview,
      discard,
      isDirty,
      commit,
      revert,
      busy,
    }),
    [locale, canEdit, editing, selected, register, registered, overrideOf, currentOf, preview, discard, isDirty, commit, revert, busy],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {canEdit && <PencilToggle />}
      {editing && selected && <Inspector />}
    </Ctx.Provider>
  );
}

/** The floating pencil. Rendered only for signed-in admins. */
function PencilToggle() {
  const { editing, setEditing } = useEditMode();
  return (
    <button
      type="button"
      onClick={() => setEditing(!editing)}
      aria-pressed={editing}
      aria-label={editing ? 'Stop editing' : 'Edit this page'}
      className={`fixed bottom-4 right-3 z-[60] flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg backdrop-blur print:hidden ${
        editing ? 'bg-brand text-white' : 'bg-white/90 text-brand-deep ring-1 ring-ink/10'
      }`}
    >
      <span aria-hidden>✏️</span>
      {editing ? 'Editing: tap any text' : 'Edit'}
    </button>
  );
}
