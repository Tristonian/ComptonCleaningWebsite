/**
 * The strip across the top of every /admin page: a clear way back to the public website, who is
 * signed in, and sign out. Plain server markup (no client JS), so it works on a bad connection.
 */
export function AdminBar({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-ink/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <a
          href="/"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-bold text-brand-deep ring-1 ring-brand-deep/30"
        >
          <span aria-hidden>←</span> Back to the website
        </a>
        {email && (
          <form action="/api/auth/logout" method="post" className="flex items-center gap-2">
            <span className="hidden max-w-[10rem] truncate text-xs text-ink/70 sm:inline">{email}</span>
            <button type="submit" className="rounded-lg px-2 py-2 text-sm font-semibold text-ink/80 ring-1 ring-ink/20">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
