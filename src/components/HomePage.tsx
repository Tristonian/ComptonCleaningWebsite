import { Ed } from '@/components/Ed';
import { ContactForm } from '@/components/ContactForm';
import { getEnv } from '@/lib/env';
import { BlockZone } from '@/components/BlockZone';
import { Hideable } from '@/components/Hideable';
import { AddServiceButton, CustomServiceCard } from '@/components/ServiceTools';
import { listBlocks } from '@/lib/blocks';
import { zoneOrder } from '@/lib/blocks-shared';
import { getHiddenSections } from '@/lib/sections';
import { listServices } from '@/lib/services-custom';
import { getOptions } from '@/lib/form-options';
import { AppearanceEditor } from '@/components/AppearanceEditor';
import { HeroHeader } from '@/components/HeroHeader';
import { HeroMenu, StickyBar } from '@/components/SiteNav';
import { getAppearance } from '@/lib/appearance';
import { isTakingCalls } from '@/lib/schedule';
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
  const [appearance, blocks, services, hidden, serviceList, sourceList, takingCalls] = await Promise.all([
    getAppearance(),
    listBlocks(),
    listServices(),
    getHiddenSections(),
    getOptions('service'),
    getOptions('source'),
    // Sam's call hours (Settings, Calendar). Fails open: if they cannot be read the Call button shows.
    isTakingCalls(),
  ]);
  const order = zoneOrder(services.map((s) => s.id));
  const zb = (zone: string) => blocks.filter((b) => b.zone === zone);
  const hide = (id: string) => hidden.includes(id);
  return (
    <main>
      {/* Hero: the business card. CCS, the squeegee, the web address, the phone number. */}
      <HeroHeader colour={appearance.heroColour}>
        <HeroMenu hidden={hidden} />
        <AppearanceEditor />
        <Ed id="brand.name" as="h1" className="sr-only">
          Compton Cleaning Services
        </Ed>
        {/* The active logo: Sam's upload (R2) or the shipped card artwork. Admin: /admin/appearance.
            Tapping it (most useful once it has shrunk into the bar) goes back to the top of the page. */}
        <a href="#" aria-label="Back to the top" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={appearance.logo.src}
            alt=""
            width={appearance.logo.width}
            height={appearance.logo.height}
            className="hero-logo"
          />
        </a>
        {takingCalls ? (
          <a
            href={PHONE_TEL}
            className="hero-fade mx-auto mt-5 flex w-fit items-center gap-2 bg-white px-4 py-2 text-2xl font-bold text-brand-deep"
          >
            <span aria-hidden>📞</span>
            <span>{PHONE_DISPLAY}</span>
          </a>
        ) : (
          <a href="#contact" className="hero-fade mx-auto mt-5 block w-fit max-w-xs bg-white px-4 py-2 text-center text-lg font-bold text-brand-deep">
            <Ed id="hero.away">{'I’m not working right now. Leave me a message.'}</Ed>
          </a>
        )}
        <Ed id="brand.tagline" as="p" className="hero-fade mt-5 text-sm font-bold uppercase tracking-widest">
          Windows | Gutters | Patios
        </Ed>
      </HeroHeader>

      <StickyBar hidden={hidden} />

      <Hideable id="about" label="Intro" hidden={hide('about')}>
        {/* About: the intro, with no heading of its own. */}
        <section className={section}>
          <Ed id="about.body" as="p" rich className="text-lg">
            {'Compton Cleaning Services offer regular, affordably priced window cleaning services in Bristol, Chepstow, Caldicot and Newport, especially the BS16 and BS5 areas. Other services are gutter cleaning and repair, pressure washing and render cleaning.'}
          </Ed>
          <Ed id="about.base" as="p" rich className="mt-3 text-ink/70">
            {'We’re currently based in Lyde Green, Bristol.'}
          </Ed>
        </section>
        <BlockZone zone="intro" blocks={zb('intro')} order={order} />
      </Hideable>

      <Hideable id="services" label="Services" hidden={hide('services')}>
        <section id="services" className={section}>
          <Ed id="services.title" as="h2" className={h2}>
            Services
          </Ed>
          <div className="grid gap-6">
          <Hideable id="service-windows" label="Window cleaning" hidden={hide('service-windows')}>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
              <Ed id="services.windows.title" as="h3" className="mb-2 text-xl font-bold">
                Window cleaning
              </Ed>
              <BlockZone zone="service-windows-top" compact blocks={zb('service-windows-top')} order={order} />
              <Ed id="services.windows.body" as="p" rich className="text-ink/80">
                  {'We specialise in regular window maintenance. A regular clean includes windows, frames, doors and sills. Optional extras include interiors, glass roofs and complete conservatory cleaning.'}
                </Ed>
              <BlockZone zone="service-windows" compact blocks={zb('service-windows')} order={order} />
            </article>
          </Hideable>
          <Hideable id="service-gutters" label="Gutters" hidden={hide('service-gutters')}>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
              <Ed id="services.gutters.title" as="h3" className="mb-2 text-xl font-bold">
                Gutters
              </Ed>
              <BlockZone zone="service-gutters-top" compact blocks={zb('service-gutters-top')} order={order} />
              <Ed id="services.gutters.body" as="p" rich className="text-ink/80">
                  {'Gutter work can include removing debris from the gutter and/or downpipe, cleaning the exteriors and fascias, or repairing the gutters.'}
                </Ed>
              <BlockZone zone="service-gutters" compact blocks={zb('service-gutters')} order={order} />
            </article>
          </Hideable>
          <Hideable id="service-other" label="Other jobs taken on" hidden={hide('service-other')}>
            <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
              <Ed id="services.other.title" as="h3" className="mb-2 text-xl font-bold">
                Other jobs taken on
              </Ed>
              <BlockZone zone="service-other-top" compact blocks={zb('service-other-top')} order={order} />
              <Ed id="services.other.body" as="p" rich className="text-ink/80">
                  Pressure washing · Render cleaning · Minor exterior repairs
                </Ed>
              <BlockZone zone="service-other" compact blocks={zb('service-other')} order={order} />
            </article>
          </Hideable>
            {services.map((svc) => (
              <CustomServiceCard
                key={svc.id}
                service={svc}
                topBlocks={zb(`svc-${svc.id}-top`)}
                blocks={zb(`svc-${svc.id}`)}
                order={order}
                hidden={hide(`svc-${svc.id}`)}
              />
            ))}
            <AddServiceButton />
          </div>
        </section>
        <BlockZone zone="services" blocks={zb('services')} order={order} />
      </Hideable>

      <Hideable id="prices" label="Prices" hidden={hide('prices')}>
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
          <Ed id="prices.factors.list" as="p" rich className="text-ink/80">
            Size · Location · Urgency
          </Ed>
          <Ed id="prices.regular" as="p" className="mt-6 rounded-xl bg-brand/10 p-4 font-semibold text-brand-deep">
            Price reductions for regular cleans
          </Ed>
          <a href="#contact" className="mt-6 inline-block rounded-xl bg-brand-deep px-6 py-3 font-bold text-white">
            <Ed id="prices.cta">For the best price, contact us</Ed>
          </a>
        </section>
        <BlockZone zone="prices" blocks={zb('prices')} order={order} />
      </Hideable>

      <section id="contact" className={section}>
        <Ed id="contact.title" as="h2" className={h2}>
          Contact us
        </Ed>
        <Ed id="contact.intro" as="p" rich className="mb-3">
          Contact via text or call
        </Ed>
        {takingCalls ? (
          <a
            href={PHONE_TEL}
            className="mb-3 block rounded-xl bg-brand-deep px-4 py-3 text-center text-lg font-bold text-white"
          >
            <Ed id="nav.call">Call</Ed> {PHONE_DISPLAY}
          </a>
        ) : (
          <Ed id="contact.away" as="p" className="mb-3 rounded-xl bg-brand/10 px-4 py-3 text-center text-lg font-bold text-brand-deep">
            {'I’m not working right now. Leave me a message.'}
          </Ed>
        )}
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
        <ContactForm
          mapboxToken={mapboxToken}
          serviceOptions={serviceList.options}
          sourceOptions={sourceList.options}
          extraServices={services
            .filter((svc) => !hide(`svc-${svc.id}`))
            .map((svc) => ({ value: `svc-${svc.id}`, en: svc.titleEn, cy: svc.titleCy || svc.titleEn }))}
        />
      </section>

      <Hideable id="reviews" label="Reviews" hidden={hide('reviews')}>
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
        <BlockZone zone="reviews" blocks={zb('reviews')} order={order} />
      </Hideable>

      <footer className="bg-ink px-4 py-6 text-center text-sm text-white/70">
        <Ed id="footer.copy" as="p">
          © Compton Cleaning Services
        </Ed>
        <p className="mt-2">
          <a href="/privacy" className="underline">
            Privacy
          </a>
        </p>
      </footer>
    </main>
  );
}
