'use client';

/**
 * ContactIsland — the interactive contents of the Contact room's glass card
 * plus the message/email/Google-Form modal sheet.
 *
 * Ports the prototype's renderContact() + openSheet()/openGoogleForm()/
 * onFormSubmit() behavior:
 *  - message & email buttons (each label + sub) open the sheet with the
 *    matching form definition.
 *  - optional Google-Form CTA (only when googleForm.enabled && url) opens the
 *    sheet with the embedded iframe.
 *  - socials row (enabled + url only), mapped to Tabler brand icons.
 *  - the sheet renders every field from the content form definition, does
 *    required + email validation locally, and shows the successText state.
 *
 * Submit POSTs to /api/submit (MIGRATION-PLAN §6.1): kind + values +
 * turnstile token + honeypot. Loading state on the submit button; success →
 * the successText panel; failure → an inline error pointing at bookingEmail.
 * The Turnstile widget renders ONLY when NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * set — its script loads lazily when a form sheet opens; when unset the form
 * submits without a token and the server skips verification.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ContactForm,
  ContactPage,
  SocialPlatform,
} from '@/lib/content/types';
import { HONEYPOT_FIELD, type SubmissionKind } from '@/lib/forms';

/** prototype SOCIAL_ICONS map (platform → Tabler icon class). */
const SOCIAL_ICONS: Record<SocialPlatform, string> = {
  instagram: 'ti-brand-instagram',
  tiktok: 'ti-brand-tiktok',
  facebook: 'ti-brand-facebook',
  youtube: 'ti-brand-youtube',
  spotify: 'ti-brand-spotify',
  apple: 'ti-brand-apple',
  soundcloud: 'ti-brand-soundcloud',
  twitter: 'ti-brand-x',
  bandcamp: 'ti-brand-bandcamp',
  other: 'ti-link',
};

type SheetKind = 'message' | 'email' | 'gform';

interface FormState {
  values: Record<string, string>;
  errors: Record<string, boolean>;
  submitted: boolean;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------------ *
 * Turnstile (only active when the public site key is configured)
 * ------------------------------------------------------------------ */

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<void> | null = null;

/** Lazily inject the Turnstile api.js exactly once (called on sheet open). */
function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!turnstileLoader) {
    turnstileLoader = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        turnstileLoader = null;
        reject(new Error('turnstile script failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return turnstileLoader;
}

/** Visually-hidden styles for the honeypot wrapper (no CSS file changes). */
const HONEYPOT_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

type SubmitStatus = 'idle' | 'sending' | 'error';

export interface ContactIslandProps {
  contact: ContactPage;
}

export function ContactIsland({ contact }: ContactIslandProps) {
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [form, setForm] = useState<FormState>({
    values: {},
    errors: {},
    submitted: false,
  });
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorText, setErrorText] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef('');

  const openSheet = useCallback((kind: SheetKind) => {
    setForm({ values: {}, errors: {}, submitted: false });
    setStatus('idle');
    setErrorText('');
    setHoneypot('');
    setSheet(kind);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const def: ContactForm | null =
    sheet === 'message'
      ? contact.messageForm
      : sheet === 'email'
        ? contact.emailForm
        : null;

  const title =
    sheet === 'message'
      ? contact.messageButton.label
      : sheet === 'email'
        ? contact.emailButton.label
        : contact.googleForm.label;

  const formSheetOpen = sheet === 'message' || sheet === 'email';

  // Lazily load + render the Turnstile widget when a form sheet opens.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !formSheetOpen) return;
    let cancelled = false;
    tokenRef.current = '';
    loadTurnstile()
      .then(() => {
        if (cancelled || !widgetHostRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => {
            tokenRef.current = token;
          },
          'expired-callback': () => {
            tokenRef.current = '';
          },
          'error-callback': () => {
            tokenRef.current = '';
          },
        });
      })
      .catch(() => {
        // script blocked/failed — submit proceeds without a token; the
        // server rejects only when the secret key is configured.
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // widget host already unmounted — nothing to clean
        }
      }
      widgetIdRef.current = null;
      tokenRef.current = '';
    };
  }, [formSheetOpen, sheet]);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!def || status === 'sending') return;

      // mirror prototype onFormSubmit validation (required + email shape)
      const errors: Record<string, boolean> = {};
      let ok = true;
      for (const f of def.fields) {
        const v = (form.values[f.key] ?? '').trim();
        if (f.required && !v) {
          errors[f.key] = true;
          ok = false;
        }
        if (f.type === 'email' && v && !EMAIL_RE.test(v)) {
          errors[f.key] = true;
          ok = false;
        }
      }
      if (!ok) {
        setForm((s) => ({ ...s, errors }));
        return;
      }

      const kind: SubmissionKind = sheet === 'email' ? 'email' : 'contact';
      setStatus('sending');
      setErrorText('');
      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind,
            values: form.values,
            turnstileToken: tokenRef.current || undefined,
            successText: def.successText,
            [HONEYPOT_FIELD]: honeypot,
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          reason?: string;
        } | null;

        if (res.ok && json?.ok) {
          setStatus('idle');
          setForm((s) => ({ ...s, errors: {}, submitted: true }));
          return;
        }

        setStatus('error');
        setErrorText(
          json?.reason === 'unconfigured'
            ? `This form isn't connected yet — email us at ${contact.bookingEmail}`
            : `Something broke — email us at ${contact.bookingEmail}`,
        );
      } catch {
        setStatus('error');
        setErrorText(`Something broke — email us at ${contact.bookingEmail}`);
      }
    },
    [def, form.values, sheet, status, honeypot, contact.bookingEmail],
  );

  const setValue = (key: string, value: string) =>
    setForm((s) => ({ ...s, values: { ...s.values, [key]: value } }));

  const gformEnabled = contact.googleForm.enabled && !!contact.googleForm.url;
  const socials = contact.socials.filter((s) => s.enabled && s.url);

  return (
    <>
      <div className="contact-block">
        <div className="contact-card">
        <h2>{contact.heading}</h2>
        <div className="cbtns">
          <div className="cgroup">
            <button
              className="cbtn"
              type="button"
              onClick={() => openSheet('message')}
            >
              {contact.messageButton.label}
            </button>
            <span className="csub">{contact.messageButton.sub}</span>
          </div>
          <div className="cgroup">
            <button
              className="cbtn"
              type="button"
              onClick={() => openSheet('email')}
            >
              {contact.emailButton.label}
            </button>
            <span className="csub">{contact.emailButton.sub}</span>
          </div>
        </div>
        {gformEnabled ? (
          <button
            className="cbtn gform"
            type="button"
            onClick={() => openSheet('gform')}
          >
            {contact.googleForm.label}
          </button>
        ) : null}
        <div className="cmail">
          or email us at{' '}
          <a href={`mailto:${contact.bookingEmail}`}>{contact.bookingEmail}</a>
          <br />
          For licensing inquiries contact {contact.licensing.name} at{' '}
          <a href={`mailto:${contact.licensing.email}`}>
            {contact.licensing.email}
          </a>
        </div>
        <div className="follow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="follow-lbl"
            src="/follow-along-white.gif"
            alt="follow along"
          />
          <div className="socials">
            {socials.map((s) => (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener"
                aria-label={s.label}
                title={s.label}
              >
                <i className={`ti ${SOCIAL_ICONS[s.platform] ?? SOCIAL_ICONS.other}`} />
              </a>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* sheet / modal — mirrors prototype #sheet > .panel */}
      <div
        className={`sheet${sheet ? ' open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
      >
        <div className="panel">
          {sheet === 'gform' ? (
            <>
              <button className="x" type="button" onClick={closeSheet}>
                &times;
              </button>
              <h3>{contact.googleForm.label}</h3>
              <iframe
                className="gframe"
                src={contact.googleForm.url}
                loading="lazy"
                title={contact.googleForm.label}
              />
            </>
          ) : def ? (
            form.submitted ? (
              <>
                <button className="x" type="button" onClick={closeSheet}>
                  &times;
                </button>
                <div className="success">
                  <i className="ti ti-mail-heart" />
                  <h3>{def.successText}</h3>
                  <p>— Wendlo</p>
                </div>
              </>
            ) : (
              <>
                <button className="x" type="button" onClick={closeSheet}>
                  &times;
                </button>
                <h3>{title}</h3>
                <form data-kind={sheet} onSubmit={onSubmit}>
                  {def.fields.map((f) => (
                    <div key={f.key}>
                      <label>
                        {f.label}
                        {f.required ? <em> *</em> : null}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          data-key={f.key}
                          rows={3}
                          placeholder={f.placeholder ?? ''}
                          className={form.errors[f.key] ? 'err' : undefined}
                          value={form.values[f.key] ?? ''}
                          onChange={(e) => setValue(f.key, e.target.value)}
                        />
                      ) : (
                        <input
                          data-key={f.key}
                          type={f.type === 'email' ? 'email' : 'text'}
                          placeholder={f.placeholder ?? ''}
                          className={form.errors[f.key] ? 'err' : undefined}
                          value={form.values[f.key] ?? ''}
                          onChange={(e) => setValue(f.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  {/* honeypot — hidden from real users, filled by naive bots */}
                  <div style={HONEYPOT_STYLE} aria-hidden="true">
                    <label htmlFor={`hp-${HONEYPOT_FIELD}`}>Company</label>
                    <input
                      id={`hp-${HONEYPOT_FIELD}`}
                      name={HONEYPOT_FIELD}
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>
                  {TURNSTILE_SITE_KEY ? (
                    <div
                      ref={widgetHostRef}
                      style={{ marginTop: 14 }}
                      data-testid="turnstile-host"
                    />
                  ) : null}
                  <button
                    className="submit"
                    type="submit"
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending…' : def.submitLabel}
                  </button>
                  {status === 'error' && errorText ? (
                    <p
                      role="alert"
                      style={{ color: '#c0392b', fontSize: 13, marginTop: 12 }}
                    >
                      {errorText}
                    </p>
                  ) : null}
                </form>
              </>
            )
          ) : null}
        </div>
      </div>
    </>
  );
}
