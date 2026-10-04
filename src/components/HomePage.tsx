import { Ed } from '@/components/Ed';
import { LangSwitch } from '@/components/LangSwitch';

/** Rendered by both `/` and `/cy`; the language comes from the layout, not from here. */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-4 py-12">
      <div className="flex items-center justify-between">
        <Ed id="brand.name" as="p" className="text-sm font-semibold uppercase tracking-wide text-brand">
          Compton Cleaning
        </Ed>
        <LangSwitch />
      </div>
      <Ed id="home.hero.title" as="h1" className="text-3xl font-bold text-brand-deep">
        Window cleaning, done properly
      </Ed>
      <Ed id="home.hero.body" as="p" className="text-ink/80">
        Full site coming soon.
      </Ed>
      <a href="tel:" className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-white">
        <Ed id="nav.call">Call</Ed>
      </a>
    </main>
  );
}
