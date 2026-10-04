import { Ed } from '@/components/Ed';
import { ContactForm } from '@/components/ContactForm';
import { HeroMenu, StickyBar } from '@/components/SiteNav';
import { FIRST_CLEAN_PENCE, PHONE_DISPLAY, PHONE_SMS, PHONE_TEL, REVIEW_URL, formatPence } from '@/lib/business';

const section = 'mx-auto max-w-2xl scroll-mt-14 px-4 py-10';
const h2 = 'mb-4 text-3xl font-black uppercase italic tracking-tight text-brand-deep';

/** Rendered by both `/` and `/cy`; the language comes from the layout, not from here. */
export function HomePage() {
  return (
    <main>
      {/* Hero: the business card. CCS, the squeegee, the web address, the phone number. */}
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-deep via-brand to-[#14b8cf] px-4 pb-12 pt-20 text-center text-white">
        <HeroMenu />
        <div className="mx-auto flex max-w-sm items-center justify-center gap-2">
          <Ed id="brand.name" as="h1" className="text-8xl font-black italic leading-none tracking-tighter">
            CCS
          </Ed>
          <Squeegee />
        </div>
        <Ed id="brand.web" as="p" className="mt-3 text-lg font-bold tracking-wide">
          ComptonCleaning.co.uk
        </Ed>
        <a
          href={PHONE_TEL}
          className="mx-auto mt-5 flex w-fit items-center gap-2 bg-white px-4 py-2 text-2xl font-bold text-brand-deep"
        >
          <span aria-hidden>📞</span>
          <span>{PHONE_DISPLAY}</span>
        </a>
        <Ed id="brand.tagline" as="p" className="mt-5 text-sm font-bold uppercase tracking-widest">
          Windows | Gutters | Patios
        </Ed>
      </header>

      <StickyBar />

      {/* About: the intro, with no heading of its own. */}
      <section className={section}>
        <Ed id="about.body" as="p" className="text-lg">
          {'Compton Cleaning Services offer regular, affordably priced window cleaning services in Bristol, Chepstow, Caldicot and Newport, especially the BS16 and BS5 areas. Other services are gutter cleaning and repair, pressure washing and render cleaning.'}
        </Ed>
        <Ed id="about.base" as="p" className="mt-3 text-ink/70">
          {'We’re currently based in Lyde Green, Bristol.'}
        </Ed>
      </section>

      <section id="services" className={section}>
        <Ed id="services.title" as="h2" className={h2}>
          Services
        </Ed>
        <div className="grid gap-6">
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <Ed id="services.windows.title" as="h3" className="mb-2 text-xl font-bold">
              Window cleaning
            </Ed>
            <Ed id="services.windows.body" as="p" className="text-ink/80">
              {'We specialise in regular window maintenance. A regular clean includes windows, frames, doors and sills. Optional extras include interiors, glass roofs and complete conservatory cleaning.'}
            </Ed>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <Ed id="services.gutters.title" as="h3" className="mb-2 text-xl font-bold">
              Gutters
            </Ed>
            <Ed id="services.gutters.body" as="p" className="text-ink/80">
              {'Gutter work can include removing debris from the gutter and/or downpipe, cleaning the exteriors and fascias, or repairing the gutters.'}
            </Ed>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <Ed id="services.other.title" as="h3" className="mb-2 text-xl font-bold">
              Other jobs taken on
            </Ed>
            <Ed id="services.other.body" as="p" className="text-ink/80">
              Pressure washing · Render cleaning · Minor exterior repairs
            </Ed>
          </article>
        </div>
      </section>

      <section id="prices" className={`${section} text-center`}>
        <Ed id="prices.title" as="h2" className={h2}>
          Prices
        </Ed>
        <Ed id="prices.first.label" as="p" className="text-ink/80">
          The average cost of a first clean for a terraced or semi-detached home is
        </Ed>
        <Ed id="prices.first.amount" as="p" className="my-2 text-6xl font-black text-brand-deep">
          {formatPence(FIRST_CLEAN_PENCE)}
        </Ed>
        <Ed id="prices.factors.title" as="p" className="mt-6 font-bold">
          Factors to consider
        </Ed>
        <Ed id="prices.factors.list" as="p" className="text-ink/80">
          Size · Location · Urgency
        </Ed>
        <Ed id="prices.regular" as="p" className="mt-6 rounded-xl bg-brand/10 p-4 font-semibold text-brand-deep">
          Price reductions for regular cleans
        </Ed>
        <a href="#contact" className="mt-6 inline-block rounded-xl bg-brand-deep px-6 py-3 font-bold text-white">
          <Ed id="prices.cta">For the best price, contact us</Ed>
        </a>
      </section>

      <section id="contact" className={section}>
        <Ed id="contact.title" as="h2" className={h2}>
          Contact us
        </Ed>
        <Ed id="contact.intro" as="p" className="mb-3">
          Contact via text or call
        </Ed>
        <div className="mb-6 flex gap-3">
          <a href={PHONE_TEL} className="flex-1 rounded-xl bg-brand-deep px-4 py-3 text-center font-bold text-white">
            <Ed id="nav.call">Call</Ed> {PHONE_DISPLAY}
          </a>
          <a href={PHONE_SMS} className="rounded-xl px-4 py-3 font-bold text-brand-deep ring-2 ring-brand-deep">
            <Ed id="nav.text">Text</Ed>
          </a>
        </div>
        <Ed id="contact.form.title" as="h3" className="mb-3 text-xl font-bold">
          Contact form
        </Ed>
        <ContactForm />
      </section>

      <section id="reviews" className={section}>
        <Ed id="reviews.title" as="h2" className={h2}>
          Reviews
        </Ed>
        <Ed id="reviews.empty" as="p" className="text-ink/70">
          Customer reviews are coming soon.
        </Ed>
        <a
          href={REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-xl bg-brand-deep px-6 py-3 font-bold text-white"
        >
          <Ed id="reviews.cta">Leave us a Google review</Ed>
        </a>
      </section>

      <footer className="bg-ink px-4 py-6 text-center text-sm text-white/70">
        <Ed id="footer.copy" as="p">
          © Compton Cleaning Services
        </Ed>
      </footer>
    </main>
  );
}

/** The squeegee from the card: a handle, a head, a blade. Decorative. */
function Squeegee() {
  return (
    <svg viewBox="0 0 60 110" className="h-24 w-auto" aria-hidden fill="currentColor">
      <rect x="22" y="0" width="5" height="70" rx="2" transform="rotate(8 24 35)" />
      <rect x="2" y="52" width="56" height="12" rx="2" transform="rotate(-8 30 58)" />
      <rect x="18" y="70" width="6" height="38" rx="2" transform="rotate(8 21 89)" />
    </svg>
  );
}
