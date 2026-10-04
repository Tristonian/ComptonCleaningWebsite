import { Ed } from '@/components/Ed';
import { ContactForm } from '@/components/ContactForm';
import { getEnv } from '@/lib/env';
import { HeroHeader } from '@/components/HeroHeader';
import { HeroMenu, StickyBar } from '@/components/SiteNav';
import { getAppearance } from '@/lib/appearance';
import {
  EMAIL_FROM,
  FIRST_CLEAN_PENCE,
  PHONE_DISPLAY,
  PHONE_SMS,
  PHONE_TEL,
  REVIEW_URL,
  WHATSAPP_URL,
  formatPence,
} from '@/lib/business';

const section = 'mx-auto max-w-2xl scroll-mt-14 px-4 py-10';
const h2 = 'mb-4 text-3xl font-black uppercase italic tracking-tight text-brand-deep';

/**
 * Rendered by both `/` and `/cy`; the language comes from the layout, not from here.
 * The Mapbox token is a PUBLIC token (restricted to our URLs in the Mapbox dashboard); it is read
 * here at request time and handed to the form, so no build-time env var is needed.
 */
export async function HomePage() {
  const mapboxToken = getEnv('MAPBOX_TOKEN');
  const appearance = await getAppearance();
  return (
    <main>
      {/* Hero: the business card. CCS, the squeegee, the web address, the phone number. */}
      <HeroHeader colour={appearance.heroColour}>
        <HeroMenu />
        <Ed id="brand.name" as="h1" className="sr-only">
          Compton Cleaning Services
        </Ed>
        {/* The active logo: Sam's upload (R2) or the shipped card artwork. Admin: /admin/appearance. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={appearance.logo.src}
          alt=""
          width={appearance.logo.width}
          height={appearance.logo.height}
          className="hero-logo"
        />
        <a
          href={PHONE_TEL}
          className="hero-fade mx-auto mt-5 flex w-fit items-center gap-2 bg-white px-4 py-2 text-2xl font-bold text-brand-deep"
        >
          <span aria-hidden>📞</span>
          <span>{PHONE_DISPLAY}</span>
        </a>
        <Ed id="brand.tagline" as="p" className="hero-fade mt-5 text-sm font-bold uppercase tracking-widest">
          Windows | Gutters | Patios
        </Ed>
      </HeroHeader>

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
        <a
          href={PHONE_TEL}
          className="mb-3 block rounded-xl bg-brand-deep px-4 py-3 text-center text-lg font-bold text-white"
        >
          <Ed id="nav.call">Call</Ed> {PHONE_DISPLAY}
        </a>
        <div className="mb-6 grid grid-cols-3 gap-3 text-center font-bold text-brand-deep">
          <a href={PHONE_SMS} className="rounded-xl px-2 py-3 ring-2 ring-brand-deep">
            <Ed id="nav.text">Text</Ed>
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl px-2 py-3 ring-2 ring-brand-deep">
            <Ed id="nav.whatsapp">WhatsApp</Ed>
          </a>
          <a href={`mailto:${EMAIL_FROM}`} className="rounded-xl px-2 py-3 ring-2 ring-brand-deep">
            <Ed id="nav.email">Email</Ed>
          </a>
        </div>
        <Ed id="contact.form.title" as="h3" className="mb-3 text-xl font-bold">
          Contact form
        </Ed>
        <ContactForm mapboxToken={mapboxToken} />
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
