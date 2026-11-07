/**
 * /privacy — Wendlo's plain-language privacy notice.
 *
 * EVERY claim here is backed by code — keep them in lock-step:
 *   - form fields ............ src/lib/forms.ts (FORM_FIELD_KEYS, SHEET_COLUMNS)
 *   - where submissions go ... src/app/api/submit/route.ts (Sheets [separate
 *                              tabs for messages and sign-ups; sign-ups get a
 *                              "Mailing list" status column, values in
 *                              sheets.ts MAILING_LIST_STATUS], Kit (src/lib/kit.ts)
 *                              state 'active' (single opt-in) + "Website
 *                              signups" form [email
 *                              list only; name, email, location, meal, signup
 *                              page URL (Referer) — never the message], Resend
 *                              notify [+ the same mailing-list status line],
 *                              Turnstile, Upstash)
 *   - rate-limit storage ..... src/lib/ratelimit.ts + the keys/TTLs in route.ts
 *   - cart / checkout ........ src/app/rooms/_client/StoreIsland.tsx, src/lib/shopify.ts
 *   - video embeds ........... src/app/rooms/MusicRoom.tsx (youtube-nocookie.com)
 *   - third-party assets ..... src/app/layout.tsx (jsDelivr icons), next.config.ts
 * If any of those change (new analytics, new processor, new field), update this
 * page and its "Last updated" date in the same commit.
 *
 * Server component. Never throws on missing env/network: getSiteContent()
 * falls back to baked content and resolveReachableEmail() never throws.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getSiteContent } from '@/lib/content';
import { resolveReachableEmail } from '@/lib/contactEmail';
import '@/styles/privacy.css';

export const metadata: Metadata = {
  title: 'Privacy — Wendlo',
  description:
    'What the Wendlo website collects, why, who handles it, and how to get it changed or deleted.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/privacy' },
};

/** Re-check the contact address (MX lookup) at most hourly. */
export const revalidate = 3600;

const LAST_UPDATED = '7 November 2026';

/** Hostname of a Sanity-configured submission webhook, or '' (never throws). */
function webhookHost(raw: string | undefined): string {
  const v = raw?.trim();
  if (!v) return '';
  try {
    return new URL(v).hostname;
  } catch {
    return 'a webhook service';
  }
}

export default async function PrivacyPage() {
  const { contact, settings } = await getSiteContent();
  const email = await resolveReachableEmail(contact.bookingEmail);
  const mailto = `mailto:${email}`;
  const gformOn = contact.googleForm.enabled && !!contact.googleForm.url;
  // route.ts also POSTs submissions to these Sanity-set webhook URLs. Disclose
  // the recipient automatically whenever one is set (hostname only — the path
  // is a secret).
  const emailHook = webhookHost(settings.connections?.emailWebhookUrl);
  const contactHook = webhookHost(settings.connections?.contactWebhookUrl);

  return (
    <main className="pv">
      <header className="pv-top">
        <Link className="pv-logo" href="/" aria-label="Wendlo — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wendlo-logo.gif" alt="Wendlo" width={2500} height={441} />
        </Link>
        <Link className="pv-back" href="/">
          ← back to the site
        </Link>
      </header>

      <article className="pv-doc">
        <p className="pv-date">Last updated {LAST_UPDATED}</p>
        <h1>Privacy</h1>

        <div className="pv-short">
          <h2>The short version</h2>
          <ul>
            <li>
              We only collect what you type into our two forms — plus your IP
              address, briefly, to keep out spam.
            </li>
            <li>
              We only add people to the email list through our sign-up form,
              and every email has an unsubscribe link. Getting our emails
              without having signed up? Unsubscribe, or email us and we’ll
              delete your address.
            </li>
            <li>No analytics, no ad trackers, and we don’t sell your data.</li>
            <li>
              Want something changed or deleted? Email{' '}
              <a href={mailto}>{email}</a>.
            </li>
          </ul>
          <p className="pv-sign">— Wendlo</p>
        </div>

        {/* UK/EU GDPR Art. 13(1)(a): the controller's legal identity. */}
        <section>
          <h2>Who we are</h2>
          <p>
            We’re Wendlo, a band — legally, Jacob and Chelsea Hamilton, doing
            business as Wendlo Music LLC. This notice covers wendlomusic.com. We decide
            what happens to the information you give us here, which makes us the
            “controller” under UK and EU data-protection law. You can reach us
            about anything on this page at <a href={mailto}>{email}</a>.
          </p>
        </section>

        <section>
          <h2>What we collect, and why</h2>

          <h3>Joining the email list</h3>
          <p>
            Your <strong>name</strong> and <strong>email address</strong>{' '}
            (required), and if you choose to tell us: <strong>where you live</strong>,{' '}
            <strong>the best meal you’ve ever eaten</strong>, and{' '}
            <strong>a message</strong> for us. A city or postcode is plenty for
            where you live — we use it to know where our people are and to tell
            you about shows nearby. The meal question is just for fun.
          </p>
          <p>
            <strong>Why we’re allowed to:</strong> your consent. You join the
            list by sending the sign-up form, and we keep a record of when you
            did. You can withdraw consent any time by unsubscribing or emailing
            us.
          </p>

          <h3>Sending us a message</h3>
          <p>
            Your <strong>name</strong> and <strong>email address</strong>{' '}
            (required), an optional <strong>subject</strong>, and your{' '}
            <strong>message</strong>. We use it only to read and reply to you —
            it doesn’t add you to the email list.
          </p>
          <p>
            <strong>Why we’re allowed to:</strong> our legitimate interest in
            answering people who write to us (bookings, events, love letters).
          </p>

          <h3>Keeping the forms safe</h3>
          <p>
            When you submit a form, our server uses your{' '}
            <strong>IP address</strong> to stop spam and abuse: it counts
            submissions per IP address and per email address, and ignores
            accidental double-sends. The forms may also run a bot check from
            Cloudflare (details below). <strong>Why we’re allowed to:</strong>{' '}
            our legitimate
            interest in keeping the forms working and free of spam.
          </p>

          <h3>Buying merch</h3>
          <p>
            Your cart (which items, sizes, prices and quantities) is saved only
            in your own browser so it’s still there next time. When you hit
            checkout, the cart is sent to Shopify and checkout opens on
            Shopify’s own pages. Anything you enter there — name, address,
            payment — is collected by Shopify, and we receive the order details
            we need to send you your stuff. <strong>Why we’re allowed to:</strong>{' '}
            it’s needed to fulfil your order.
          </p>

          <h3>Just browsing</h3>
          <p>
            We don’t run analytics or advertising trackers, and we don’t build
            profiles of visitors. Like every website, the services that deliver
            our pages, images and fonts see your IP address and browser details
            as part of sending them to you, and our host keeps short-lived
            technical logs of those requests (see the list below).
          </p>
        </section>

        <section>
          <h2>Who handles it for us</h2>
          <p>
            We use a few services to run the site. They process your information
            on our behalf, for the purposes above:
          </p>
          <dl className="pv-list">
            <dt>Vercel</dt>
            <dd>
              Hosts the website and runs the server code that handles the forms.
              Like any host, it keeps short-lived request logs that include your
              IP address and browser details.
            </dd>

            <dt>Google (Google Sheets and Gmail)</dt>
            <dd>
              Google Sheets is our record of every form submission, kept in our
              own private spreadsheet. Messages and email-list sign-ups go on
              separate tabs, and each row holds the date and time and everything
              you filled in. Sign-up rows also have a “Mailing list” column
              where our server notes what happened with your sign-up — for
              example, that you were added to the list, that you were already on
              it, or that you weren’t added. Nothing else about you is added. Our email
              inbox is Gmail, so emails you send us — and the notification
              emails described below — are stored there.
            </dd>

            <dt>ImprovMX</dt>
            <dd>
              Forwards email sent to our @wendlomusic.com addresses (like the
              one on this page) to our Gmail inbox, and keeps a short log of
              the emails it has forwarded.
            </dd>

            <dt>Kit (Kit, Inc., US)</dt>
            <dd>
              Runs the email list — <em>email-list sign-ups only</em>. It gets
              your email address, name, and — if you told us — where you live
              and your best meal (never your message), plus the web address of
              the page you signed up on. You’re on the list as soon as you
              sign up, and Kit sends our newsletters. Kit is based in the US and
              acts as our processor under its data processing agreement.
            </dd>

            <dt>Resend</dt>
            <dd>
              Sends us a notification email for each form submission (either
              form) containing what you filled in (for sign-ups, also the same
              “Mailing list” note as in our spreadsheet), with your email address as
              the reply-to so we can reply straight to you. Resend keeps a copy
              in its sending logs for a limited time.
            </dd>

            <dt>Cloudflare (Turnstile)</dt>
            <dd>
              A bot check that loads when you open one of our forms (when it’s
              switched on). Cloudflare sees your IP address and browser signals
              to tell people from bots, and when you submit, our server sends
              Cloudflare the check’s one-time token together with your IP
              address to confirm it.
            </dd>

            <dt>Upstash</dt>
            <dd>
              Short-term storage for the spam limits. It holds your IP address
              (deleted automatically about 10 minutes after your last
              submission), a scrambled one-way hash of your email address (about
              1 hour after your last submission), and one-way hashes used to
              spot duplicate submissions and reused bot-check tokens (10 and 5
              minutes). Nothing else.
            </dd>

            {emailHook || contactHook ? (
              <>
                <dt>Form backup ({emailHook || contactHook})</dt>
                <dd>
                  {emailHook && contactHook
                    ? 'A copy of every form submission'
                    : emailHook
                      ? 'A copy of every email-list sign-up'
                      : 'A copy of every message'}{' '}
                  — everything you filled in, plus the date and time — is also
                  sent to{' '}
                  {emailHook && contactHook && emailHook !== contactHook
                    ? `${emailHook} (sign-ups) and ${contactHook} (messages)`
                    : emailHook || contactHook}
                  , which we use as a backup record.
                </dd>
              </>
            ) : null}

            <dt>Shopify</dt>
            <dd>
              Runs our merch store: product listings, cart and checkout. Product
              photos in the store load straight from Shopify’s servers.
            </dd>

            <dt>YouTube (Google)</dt>
            <dd>
              Plays the videos in the Music section, using YouTube’s
              privacy-enhanced player (youtube-nocookie.com). See “Cookies”
              below.
            </dd>

            <dt>Sanity</dt>
            <dd>
              Stores the site’s words and photos and serves the images. It
              doesn’t store information about visitors; its image servers see
              your IP address when sending you photos, like any web server.
            </dd>

            <dt>jsDelivr</dt>
            <dd>Serves the icon font used for the site’s icons.</dd>

            <dt>Bandsintown</dt>
            <dd>
              Our show listings come from Bandsintown; our server fetches them,
              so your browser doesn’t talk to Bandsintown until you click a
              Tickets or RSVP link.
            </dd>

            {gformOn ? (
              <>
                <dt>Google Forms</dt>
                <dd>
                  If you fill in the embedded Google Form on our contact card,
                  Google collects your answers and its own terms apply.
                </dd>
              </>
            ) : null}
          </dl>
          <p>
            We don’t sell your information, share it for advertising, or give
            it to anyone else unless the law requires us to.
          </p>
        </section>

        <section>
          <h2>International transfers</h2>
          <p>
            Most of these services are US companies, so your information may be
            stored or processed in the United States. Where it leaves the UK or
            EU, we rely on the safeguards those companies provide for that,
            such as the EU–US Data Privacy Framework and its UK extension, or
            the standard contractual clauses approved by the UK and EU. For
            example, Kit (our email list) relies on the Data Privacy Framework
            (including its UK extension), backed where needed by the EU’s
            standard contractual clauses and the UK’s International Data
            Transfer Agreement.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <ul>
            <li>
              <strong>Messages:</strong> as long as we need to reply and follow
              up, then we delete them from our records and inbox.
            </li>
            <li>
              <strong>Email list:</strong> until you unsubscribe or ask us to
              delete it. If you unsubscribe, Kit keeps your subscriber record
              (your address, the details above and a history of the emails we
              sent you) marked as unsubscribed so you aren’t emailed again — ask
              us if you’d rather it was deleted completely. Signing up again
              through our form puts you back on the list. Unsubscribing
              doesn’t remove your sign-up row from our Google
              Sheet; that stays until you ask us to delete it.
            </li>
            <li>
              <strong>Spam-limit data:</strong> deleted automatically within
              about an hour of your last submission, as described above.
            </li>
            <li>
              Ask us to delete your information any time and we will — from our
              records, the email list and our inbox.
            </li>
          </ul>
        </section>

        <section>
          <h2>Cookies and storage</h2>
          <p>
            This site doesn’t set cookies for visitors and uses no analytics or
            advertising trackers. What it does use:
          </p>
          <ul>
            <li>
              <strong>Your cart</strong> is kept in your browser’s local storage
              (under “wendlo_cart”). It never leaves your device until you check
              out, and you can clear it by emptying the cart or your browser
              data.
            </li>
            <li>
              <strong>YouTube:</strong> videos use YouTube’s privacy-enhanced
              mode. The player loads automatically once the Music section is on
              or near your screen, which shares your IP address and browser
              details with YouTube. YouTube (Google) may store its own data in your browser
              (cookies or similar storage) when the player loads, and more once
              you press play, under Google’s privacy policy.
            </li>
            <li>
              <strong>Shopify checkout</strong> opens on Shopify’s pages, which
              set their own cookies under Shopify’s privacy policy.
            </li>
            <li>
              <strong>Bot check:</strong> Cloudflare Turnstile (when switched
              on) loads only once you open a form, and is used only to tell
              people from bots — not by us to track you or for advertising.
            </li>
          </ul>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            Under UK GDPR and EU GDPR you can ask us to:
          </p>
          <ul>
            <li>show you the information we hold about you (and get a copy);</li>
            <li>correct it, or delete it;</li>
            <li>stop or limit how we use it, or object to it being used;</li>
            <li>send it to you, or to someone else, in a usable format;</li>
            <li>
              withdraw your consent to the email list at any time (unsubscribe
              link in every email) — this doesn’t affect anything we did before.
            </li>
          </ul>
          <p>
            Wherever you live — including the US — just ask and we’ll do the
            same. Email <a href={mailto}>{email}</a>; we’ll reply within one
            month and won’t charge you.
          </p>
          <p>
            We don’t make decisions about you by purely automated means, other
            than the automatic spam and bot checks on the forms.
          </p>
          <p>
            If you’re unhappy with how we’ve handled your information, please
            tell us first. You can also complain to the UK Information
            Commissioner’s Office (
            <a href="https://ico.org.uk/make-a-complaint/" rel="noopener">
              ico.org.uk
            </a>
            ) or, in the EU, to the data-protection authority where you live (
            <a
              href="https://www.edpb.europa.eu/about-edpb/about-edpb/members_en"
              rel="noopener"
            >
              list of EU authorities
            </a>
            ).
          </p>
        </section>

        <section>
          <h2>Contact us</h2>
          <p>
            Questions, requests, or just checking what we have on you:{' '}
            <a href={mailto}>{email}</a>.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            If we change how the site handles your information, we’ll update
            this page and the date at the top.
          </p>
        </section>

        <footer className="pv-foot">
          <Link className="pv-back" href="/">
            ← back to the site
          </Link>
        </footer>
      </article>
    </main>
  );
}
