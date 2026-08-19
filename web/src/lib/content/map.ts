/**
 * Map a raw GROQ result (`RawSiteContent`) onto the exact `SiteContent` shape.
 *
 * Design rules:
 *   - Images resolve via lib/sanity/image; an EMPTY image leaves the field OFF
 *     (undefined) so the room's baked default asset applies. For non-optional
 *     `ResolvedImage`/`HeroImage` fields we fall back to the baked default from
 *     `fallbackContent` so the field is always a concrete renderable URL.
 *   - Any missing singleton or field falls back to the corresponding baked
 *     value, so a partially-seeded dataset still renders completely.
 *   - `blogPost.body` arrives as Portable Text; it is serialized to the same
 *     HTML-string shape the fallback uses so `SiteContent.body: string` holds
 *     and the room renders it unchanged.
 */

import type { PortableTextBlock } from '@portabletext/react';
import { resolveHero, resolveImage } from '@/lib/sanity/image';
import type {
  RawContactForm,
  RawMusicEntry,
  RawSiteContent,
} from '@/lib/sanity/queries';
import { fallbackContent } from './fallback';
import type {
  BlogPost,
  ContactForm,
  ContactPage,
  HeroImage,
  MusicEntry,
  ResolvedImage,
  ServiceId,
  SiteContent,
  SongEntry,
  YoutubeEntry,
} from './types';

const FB = fallbackContent;

/** Coalesce a nullable to a fallback, treating null/undefined as absent. */
function or<T>(value: T | null | undefined, fallback: T): T {
  return value === null || value === undefined ? fallback : value;
}

/** Resolve a hero, defaulting to the baked room hero when the image is empty. */
function hero(
  raw: Parameters<typeof resolveHero>[0],
  fallback: HeroImage,
): HeroImage {
  return resolveHero(raw, 2400) ?? fallback;
}

/** Resolve a plain image, defaulting to a baked asset when empty. */
function image(
  raw: Parameters<typeof resolveImage>[0],
  fallback: ResolvedImage,
): ResolvedImage {
  return resolveImage(raw, 1600) ?? fallback;
}

/* ---- Portable Text → HTML string (matches the fallback body shape) ---- */

type PTChild = { _type?: string; text?: string; marks?: string[] };
type PTMarkDef = { _key?: string; _type?: string; href?: string };
type PTBlock = {
  _type?: string;
  style?: string;
  children?: PTChild[];
  markDefs?: PTMarkDef[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Render one block's inline children (strong/em + link annotations). */
function renderChildren(block: PTBlock): string {
  const defs = block.markDefs ?? [];
  return (block.children ?? [])
    .map((child) => {
      let html = escapeHtml(child.text ?? '');
      const marks = child.marks ?? [];
      // Decorators
      if (marks.includes('strong')) html = `<strong>${html}</strong>`;
      if (marks.includes('em')) html = `<em>${html}</em>`;
      // Link annotation (mark key references a markDef)
      const linkKey = marks.find((m) => m !== 'strong' && m !== 'em');
      if (linkKey) {
        const def = defs.find((d) => d._key === linkKey);
        if (def?.href) {
          html = `<a href="${escapeHtml(def.href)}">${html}</a>`;
        }
      }
      return html;
    })
    .join('');
}

/** Serialize a Portable Text array into the prototype's raw-HTML body shape. */
function portableTextToHtml(
  blocks: PortableTextBlock[] | null | undefined,
): string {
  if (!blocks || blocks.length === 0) return '';
  return (blocks as PTBlock[])
    .map((block) => {
      if (block._type !== 'block') return '';
      const inner = renderChildren(block);
      switch (block.style) {
        case 'h3':
          return `<h3>${inner}</h3>`;
        case 'blockquote':
          return `<blockquote>${inner}</blockquote>`;
        default:
          return `<p>${inner}</p>`;
      }
    })
    .join('');
}

/* ---- Sub-mappers ---- */

function mapMusicEntry(raw: RawMusicEntry, index: number): MusicEntry | null {
  const id = or(raw.id, `m${index + 1}`);
  if (raw.type === 'youtube') {
    if (!raw.url) return null;
    const entry: YoutubeEntry = {
      type: 'youtube',
      id,
      title: or(raw.caption, ''),
      url: raw.url,
    };
    if (raw.caption) entry.caption = raw.caption;
    return entry;
  }
  // song
  const song: SongEntry = {
    type: 'song',
    id,
    title: or(raw.title, ''),
    tag: or(raw.tag, ''),
    blurb: or(raw.blurb, ''),
    art: image(raw.art, { url: '' }),
    source: or(raw.source, ''),
    links: (raw.links ?? []).map((l) => ({
      service: l.service as ServiceId,
      url: or(l.url, ''),
      enabled: or(l.enabled, false),
    })),
  };
  return song;
}

function mapForm(raw: RawContactForm | null | undefined, fb: ContactForm): ContactForm {
  if (!raw) return fb;
  return {
    submitLabel: or(raw.submitLabel, fb.submitLabel),
    successText: or(raw.successText, fb.successText),
    fields: raw.fields
      ? raw.fields.map((f) => {
          const field = {
            key: f.key ?? 'name',
            label: or(f.label, ''),
            type: f.type ?? 'text',
            required: or(f.required, false),
          } as ContactForm['fields'][number];
          if (f.placeholder !== null && f.placeholder !== undefined) {
            field.placeholder = f.placeholder;
          }
          return field;
        })
      : fb.fields,
  };
}

/* ---- Top-level mapper ---- */

/**
 * Map the raw batched GROQ result onto `SiteContent`. Any absent singleton or
 * field falls back to the baked equivalent, so a partial dataset still renders.
 */
export function mapSiteContent(raw: RawSiteContent): SiteContent {
  const s = raw.settings;
  const h = raw.home;
  const a = raw.about;
  const t = raw.tour;
  const m = raw.music;
  const c = raw.contact;
  const b = raw.blog;

  const settings: SiteContent['settings'] = {
    title: or(s?.title, FB.settings.title),
    description: or(s?.description, FB.settings.description),
    announcement: {
      enabled: or(s?.announcement?.enabled, FB.settings.announcement.enabled),
      text: or(s?.announcement?.text, FB.settings.announcement.text),
      page: or(s?.announcement?.page, FB.settings.announcement.page),
    },
    design: {
      accent: or(s?.design?.accent, FB.settings.design.accent),
      logo: image(s?.design?.logo, FB.settings.design.logo),
      stripes: image(s?.design?.stripes, FB.settings.design.stripes),
    },
    pages:
      s?.pages && s.pages.length > 0
        ? s.pages.map((p, i) => ({
            pageId: or(p.pageId, FB.settings.pages[i]?.pageId ?? 'home'),
            enabled: or(p.enabled, true),
            label: or(p.label, ''),
            isTextLabel: or(p.isTextLabel, false),
          }))
        : FB.settings.pages,
    connections: {
      emailWebhookUrl: or(
        s?.connections?.emailWebhookUrl,
        FB.settings.connections.emailWebhookUrl,
      ),
      contactWebhookUrl: or(
        s?.connections?.contactWebhookUrl,
        FB.settings.connections.contactWebhookUrl,
      ),
      shopify: {
        domain: or(
          s?.connections?.shopify?.domain,
          FB.settings.connections.shopify.domain,
        ),
        token: or(
          s?.connections?.shopify?.token,
          FB.settings.connections.shopify.token,
        ),
        apiVersion: or(
          s?.connections?.shopify?.apiVersion,
          FB.settings.connections.shopify.apiVersion,
        ),
      },
      bandsintown: {
        artist: or(
          s?.connections?.bandsintown?.artist,
          FB.settings.connections.bandsintown.artist,
        ),
        appId: or(
          s?.connections?.bandsintown?.appId,
          FB.settings.connections.bandsintown.appId,
        ),
      },
      googleForm: {
        enabled: or(
          s?.connections?.googleForm?.enabled,
          FB.settings.connections.googleForm.enabled,
        ),
        label: or(
          s?.connections?.googleForm?.label,
          FB.settings.connections.googleForm.label,
        ),
        url: or(
          s?.connections?.googleForm?.url,
          FB.settings.connections.googleForm.url,
        ),
      },
    },
  };

  const home: SiteContent['home'] = {
    hero: hero(h?.hero, FB.home.hero),
    emailCtaEnabled: or(h?.emailCtaEnabled, FB.home.emailCtaEnabled),
    emailCtaText: or(h?.emailCtaText, FB.home.emailCtaText),
    clickHereEnabled: or(h?.clickHereEnabled, FB.home.clickHereEnabled),
  };

  const about: SiteContent['about'] = {
    hero: hero(a?.hero, FB.about.hero),
    heading: or(a?.heading, FB.about.heading),
    body: or(a?.body, FB.about.body),
  };

  const tour: SiteContent['tour'] = {
    hero: hero(t?.hero, FB.tour.hero),
    bandsintownArtist: or(t?.bandsintownArtist, FB.tour.bandsintownArtist),
    bandsintownAppId: or(t?.bandsintownAppId, FB.tour.bandsintownAppId),
    emptyText: or(t?.emptyText, FB.tour.emptyText),
    emptyLinkText: or(t?.emptyLinkText, FB.tour.emptyLinkText),
    emptyLinkUrl: or(t?.emptyLinkUrl, FB.tour.emptyLinkUrl),
  };

  const music: SiteContent['music'] = {
    services: or(m?.services, FB.music.services),
    entries: m?.entries
      ? m.entries
          .map((e, i) => mapMusicEntry(e, i))
          .filter((e): e is MusicEntry => e !== null)
      : FB.music.entries,
  };

  const fbc = FB.contact;
  const contact: ContactPage = {
    polaroids: image(c?.polaroids, fbc.polaroids),
    heading: or(c?.heading, fbc.heading),
    bookingEmail: or(c?.bookingEmail, fbc.bookingEmail),
    licensing: {
      name: or(c?.licensing?.name, fbc.licensing.name),
      email: or(c?.licensing?.email, fbc.licensing.email),
    },
    messageButton: {
      label: or(c?.messageButton?.label, fbc.messageButton.label),
      sub: or(c?.messageButton?.sub, fbc.messageButton.sub),
    },
    emailButton: {
      label: or(c?.emailButton?.label, fbc.emailButton.label),
      sub: or(c?.emailButton?.sub, fbc.emailButton.sub),
    },
    googleForm: {
      enabled: or(c?.googleForm?.enabled, fbc.googleForm.enabled),
      label: or(c?.googleForm?.label, fbc.googleForm.label),
      url: or(c?.googleForm?.url, fbc.googleForm.url),
    },
    socials: c?.socials
      ? c.socials.map((sl) => ({
          id: or(sl.id, ''),
          platform: sl.platform ?? 'other',
          label: or(sl.label, ''),
          url: or(sl.url, ''),
          enabled: or(sl.enabled, false),
        }))
      : fbc.socials,
    messageForm: mapForm(c?.messageForm, fbc.messageForm),
    emailForm: mapForm(c?.emailForm, fbc.emailForm),
  };

  const posts: BlogPost[] = raw.posts
    ? raw.posts.map((p, i) => ({
        id: or(p.id, `p${i + 1}`),
        title: or(p.title, ''),
        slug: or(p.slug, ''),
        date: or(p.date, ''),
        cover: image(p.cover, FB.about.hero),
        excerpt: or(p.excerpt, ''),
        body: portableTextToHtml(p.body),
        published: or(p.published, false),
      }))
    : FB.blog.posts;

  const blog: SiteContent['blog'] = {
    heading: or(b?.heading, FB.blog.heading),
    posts,
  };

  return { settings, home, about, tour, music, contact, blog };
}
