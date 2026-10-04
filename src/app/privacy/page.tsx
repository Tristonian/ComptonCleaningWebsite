export const metadata = {
  title: 'Privacy | Compton Cleaning',
  description: 'What Compton Cleaning Services collects when you get in touch, why, and who looks after it.',
};

const h2 = 'mt-8 text-xl font-black text-brand-deep';

/**
 * Plain-English privacy notice for the contact form. Facts here must match the code: if a new
 * service touches visitors' data (analytics, a new map or email provider), update this page first.
 * Sam should read it and confirm the contact details and how long he keeps enquiries.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <a href="/" className="text-sm font-bold text-brand-deep">
        ← Back to the website
      </a>
      <h1 className="mt-4 text-3xl font-black uppercase italic tracking-tight text-brand-deep">Privacy</h1>
      <p className="mt-3 text-ink/80">
        Compton Cleaning Services (Sam Compton) is a small local window-cleaning business. This page says what we do with
        your details when you contact us through this website.
      </p>

      <h2 className={h2}>What we collect</h2>
      <p className="mt-2 text-ink/80">
        Only what you type into the contact form: your name, address and postcode, a phone number and/or email, the
        service you are interested in, how you heard about us (if you say), and any notes. If you drop or confirm a pin
        on the map, or tap &ldquo;Use my location&rdquo;, we also receive that location. We do not read your location
        unless you ask us to.
      </p>
      <p className="mt-2 text-ink/80">
        To stop spam we keep a scrambled (hashed) version of your internet address for a short while. We cannot turn it
        back into your address.
      </p>

      <h2 className={h2}>Why we use it</h2>
      <p className="mt-2 text-ink/80">
        To reply to your enquiry, give you a price, and carry out and look after the work if you go ahead. We do not sell
        your details, and we do not use them for advertising by other companies.
      </p>

      <h2 className={h2}>Who handles it for us</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/80">
        <li>Cloudflare: runs the website and forwards our email.</li>
        <li>Neon: stores enquiries in a database.</li>
        <li>Resend: sends the enquiry email to us and our replies to you.</li>
        <li>Mapbox: draws the map and the map picture in the enquiry email from your pin or postcode.</li>
        <li>postcodes.io: checks that a postcode is real (it receives the postcode only).</li>
      </ul>
      <p className="mt-2 text-ink/80">Some of these companies process data outside the UK under standard safeguards.</p>

      <h2 className={h2}>Cookies</h2>
      <p className="mt-2 text-ink/80">
        Visitors get no tracking, advertising or analytics cookies. A sign-in cookie is only set for the business owner
        when they log in to edit the site.
      </p>

      <h2 className={h2}>How long we keep it</h2>
      <p className="mt-2 text-ink/80">
        For as long as we need it to deal with your enquiry and any work for you. You can ask us to delete it at any time.
      </p>

      <h2 className={h2}>Your rights</h2>
      <p className="mt-2 text-ink/80">
        You can ask to see what we hold about you, have it corrected or deleted, or object to how we use it. Email{' '}
        <a href="mailto:hello@comptoncleaning.co.uk" className="font-bold text-brand-deep underline">
          hello@comptoncleaning.co.uk
        </a>
        . If you are unhappy with how we handle your data you can complain to the Information Commissioner&rsquo;s Office
        (ico.org.uk).
      </p>
    </main>
  );
}
