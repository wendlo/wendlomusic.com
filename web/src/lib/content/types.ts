/**
 * Wendlo content model — TypeScript interfaces.
 *
 * Mirrors MIGRATION-PLAN.md §3 (the Sanity schema) as the site's *resolved*
 * content shape. These are the types produced AFTER a content source (Sanity,
 * or the baked fallback) has been resolved into plain data for rendering.
 *
 * Image handling:
 *   - A plain image resolves to `{ url: string }`.
 *   - A hero image resolves to `{ url; focalDesktop?; focalMobile? }` where the
 *     focal strings are CSS `object-position` values (e.g. "50% 42%").
 * `url` is always a concrete, renderable URL (a baked default asset when the
 * source image was empty — see lib/image.ts + lib/content/fallback.ts).
 */

/* ------------------------------------------------------------------ *
 * Shared / primitive value objects
 * ------------------------------------------------------------------ */

/** A plain resolved image. `url` always points at a renderable asset. */
export interface ResolvedImage {
  url: string;
}

/**
 * A resolved hero image. Focal strings are CSS object-position values
 * ("X% Y%"). `focalDesktop` → `--focal` (default "50% 50%"); `focalMobile`
 * → `--focal-m` (falls back to `focalDesktop`, then center).
 */
export interface HeroImage {
  url: string;
  focalDesktop?: string;
  focalMobile?: string;
}

/** Fixed page identifiers (§3.4). Array order = nav order. */
export type PageId =
  | 'home'
  | 'about'
  | 'tour'
  | 'contact'
  | 'music'
  | 'store'
  | 'blog';

/** The 8 fixed listen services, in fixed order (§3.9 / §3.12). */
export type ServiceId =
  | 'spotify'
  | 'apple'
  | 'amazon'
  | 'deezer'
  | 'itunes'
  | 'napster'
  | 'tidal'
  | 'youtube';

/** Social platform enum (§3.18) — drives the platform icon. */
export type SocialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'spotify'
  | 'apple'
  | 'soundcloud'
  | 'twitter'
  | 'bandcamp'
  | 'other';

/** Form field input kinds (§3.20). */
export type FormFieldType = 'text' | 'email' | 'textarea';

/** Fixed form-field keys (§3.20) — drive columns/merge mapping downstream. */
export type FormFieldKey =
  | 'name'
  | 'email'
  | 'subject'
  | 'message'
  | 'location'
  | 'meal';

/* ------------------------------------------------------------------ *
 * siteSettings (§3.1 – §3.5)
 * ------------------------------------------------------------------ */

/** Site-wide announcement bar (§3.2). */
export interface Announcement {
  enabled: boolean;
  text: string;
  /** Target page the bar navigates to; render-time fallback contact→home. */
  page: PageId;
}

/** Theming (§3.3). `logo`/`stripes` resolve to a URL (baked default if empty). */
export interface DesignSettings {
  /** Accent hex, default "#E0A32B". Injected as an inline CSS custom prop. */
  accent: string;
  /** Logo image; empty in source → baked /wendlo-logo.gif. */
  logo: ResolvedImage;
  /** Stripes background; empty in source → baked /defaults/stripes.jpg. */
  stripes: ResolvedImage;
}

/** One nav entry (§3.4). Fixed set of 7, drag-reordered. */
export interface NavPage {
  pageId: PageId;
  enabled: boolean;
  label: string;
  /** true for text-label pages (about + blog); false for GIF-art pages. */
  isTextLabel: boolean;
}

/** Shopify connection (§3.23). */
export interface ShopifySettings {
  domain: string;
  token: string;
  apiVersion: string;
}

/** Bandsintown connection (§3.24). */
export interface BandsintownSettings {
  artist: string;
  appId: string;
}

/** Optional Google-Form fallback CTA (§3.17). */
export interface GoogleForm {
  enabled: boolean;
  label: string;
  url: string;
}

/** Band-owned integration config (§3.5). Secrets live in env, not here. */
export interface ConnectionSettings {
  emailWebhookUrl: string;
  contactWebhookUrl: string;
  shopify: ShopifySettings;
  bandsintown: BandsintownSettings;
  googleForm: GoogleForm;
}

/** siteSettings singleton (§3.1). */
export interface SiteSettings {
  title: string;
  description: string;
  announcement: Announcement;
  design: DesignSettings;
  /** Single ordered array collapsing order + enabled + labels. */
  pages: NavPage[];
  connections: ConnectionSettings;
}

/* ------------------------------------------------------------------ *
 * homePage (§3.6)
 * ------------------------------------------------------------------ */

export interface HomePage {
  hero: HeroImage;
  emailCtaEnabled: boolean;
  emailCtaText: string;
  clickHereEnabled: boolean;
}

/* ------------------------------------------------------------------ *
 * aboutPage (§3.7)
 * ------------------------------------------------------------------ */

export interface AboutPage {
  hero: HeroImage;
  heading: string;
  /** PLAIN multiline (white-space:pre-line); NOT Portable Text. */
  body: string;
}

/* ------------------------------------------------------------------ *
 * tourPage (§3.8)
 * ------------------------------------------------------------------ */

export interface TourPage {
  hero: HeroImage;
  bandsintownArtist: string;
  bandsintownAppId: string;
  emptyText: string;
  /** Blank = no link. */
  emptyLinkText: string;
  emptyLinkUrl: string;
}

/* ------------------------------------------------------------------ *
 * musicPage (§3.9 – §3.12)
 * ------------------------------------------------------------------ */

/** One per-service listen link (§3.12). Only enabled && url render on site. */
export interface ListenLink {
  service: ServiceId;
  url: string;
  enabled: boolean;
}

/** A song card (§3.10). Alternates art/text sides on the page. */
export interface SongEntry {
  type: 'song';
  id: string;
  title: string;
  tag: string;
  /** Smart-quotes preserved. */
  blurb: string;
  art: ResolvedImage;
  /** Smart link this was imported from (enables Re-import); may be empty. */
  source: string;
  /** 8 fixed-service rows, rendered in `MusicPage.services` order. */
  links: ListenLink[];
}

/** A full-width inline YouTube embed (§3.11). */
export interface YoutubeEntry {
  type: 'youtube';
  id: string;
  /** Admin-only, still stored; used as embed title. NOT shown to visitors. */
  title: string;
  url: string;
  /** Admin-only caption; NOT shown to visitors. */
  caption?: string;
}

/** Discriminated union of the mixed entries array. */
export type MusicEntry = SongEntry | YoutubeEntry;

export interface MusicPage {
  /** Fixed order; drives ListenLink rendering order. */
  services: ServiceId[];
  /** Single ordered mixed array; order = page order. */
  entries: MusicEntry[];
}

/* ------------------------------------------------------------------ *
 * contactPage (§3.14 – §3.20)
 * ------------------------------------------------------------------ */

/** A labelled CTA button (§3.15). */
export interface CtaButton {
  label: string;
  sub: string;
}

/** Sync/licensing contact (§3.16). */
export interface Licensing {
  name: string;
  email: string;
}

/** A social link (§3.18). */
export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
  enabled: boolean;
}

/** One form field (§3.20). `placeholder` used by emailForm fields only. */
export interface FormField {
  key: FormFieldKey;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
}

/** A contact form definition (§3.19). */
export interface ContactForm {
  fields: FormField[];
  submitLabel: string;
  /** Post-submit copy. */
  successText: string;
}

export interface ContactPage {
  polaroids: ResolvedImage;
  heading: string;
  bookingEmail: string;
  licensing: Licensing;
  messageButton: CtaButton;
  emailButton: CtaButton;
  googleForm: GoogleForm;
  socials: SocialLink[];
  /** Fixed keys name/email/subject/message. */
  messageForm: ContactForm;
  /** Fixed keys name/email/location/meal/message; fields carry placeholder. */
  emailForm: ContactForm;
}

/* ------------------------------------------------------------------ *
 * blogPage / blogPost (§3.21 – §3.22)
 * ------------------------------------------------------------------ */

/** A blog post (§3.22). List view is newest-first by date. */
export interface BlogPost {
  id: string;
  title: string;
  /** Stable per-post URL slug. */
  slug: string;
  /** ISO date (YYYY-MM-DD); drives newest-first sort. */
  date: string;
  cover: ResolvedImage;
  excerpt: string;
  /**
   * Prototype post body as an HTML string (p/h3/blockquote/bold/italic/link).
   * Portable Text migration is a later phase; the fallback keeps the raw HTML.
   */
  body: string;
  /** Explicit site-visibility flag, distinct from CMS draft state. */
  published: boolean;
}

export interface BlogPage {
  heading: string;
  posts: BlogPost[];
}

/* ------------------------------------------------------------------ *
 * Bundled site content
 * ------------------------------------------------------------------ */

/** Everything the site needs to render, resolved into plain data. */
export interface SiteContent {
  settings: SiteSettings;
  home: HomePage;
  about: AboutPage;
  tour: TourPage;
  music: MusicPage;
  contact: ContactPage;
  blog: BlogPage;
}
