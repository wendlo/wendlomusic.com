/**
 * GROQ query + raw-result types for the whole site.
 *
 * A single batched query fetches the 7 singletons (siteSettings + 6 page docs)
 * plus published blogPosts, projected as closely as possible to `SiteContent`.
 * The pieces that CAN'T be projected 1:1 in GROQ — Sanity image objects and the
 * Portable Text blog body — are pulled through as raw shapes and finished in the
 * TS mapping layer (lib/content). Field names mirror the schema summary exactly.
 *
 * Singleton document ids equal their type name (see src/sanity/structure.ts:
 * `.documentId(type)`), so each singleton is fetched by `*[_id == 'type'][0]`.
 */

import type { PortableTextBlock } from '@portabletext/react';
import type {
  FormFieldKey,
  FormFieldType,
  PageId,
  ServiceId,
  SocialPlatform,
} from '@/lib/content/types';
import type { SanityHeroValue, SanityImageValue } from './image';

/* ------------------------------------------------------------------ *
 * Raw projected shapes (pre-mapping)
 * ------------------------------------------------------------------ */

export interface RawAnnouncement {
  enabled?: boolean | null;
  text?: string | null;
  page?: PageId | null;
}

export interface RawDesign {
  accent?: string | null;
  logo?: SanityImageValue | null;
  stripes?: SanityImageValue | null;
}

export interface RawNavPage {
  pageId?: PageId | null;
  enabled?: boolean | null;
  label?: string | null;
  isTextLabel?: boolean | null;
}

export interface RawGoogleForm {
  enabled?: boolean | null;
  label?: string | null;
  url?: string | null;
}

export interface RawConnections {
  emailWebhookUrl?: string | null;
  contactWebhookUrl?: string | null;
  shopify?: {
    domain?: string | null;
    token?: string | null;
    apiVersion?: string | null;
  } | null;
  bandsintown?: { artist?: string | null; appId?: string | null } | null;
  googleForm?: RawGoogleForm | null;
}

export interface RawSiteSettings {
  title?: string | null;
  description?: string | null;
  announcement?: RawAnnouncement | null;
  design?: RawDesign | null;
  pages?: RawNavPage[] | null;
  connections?: RawConnections | null;
}

export interface RawHomePage {
  hero?: SanityHeroValue | null;
  emailCtaEnabled?: boolean | null;
  emailCtaText?: string | null;
  clickHereEnabled?: boolean | null;
}

export interface RawAboutPage {
  hero?: SanityHeroValue | null;
  heading?: string | null;
  body?: string | null;
}

export interface RawTourPage {
  hero?: SanityHeroValue | null;
  bandsintownArtist?: string | null;
  bandsintownAppId?: string | null;
  emptyText?: string | null;
  emptyLinkText?: string | null;
  emptyLinkUrl?: string | null;
}

export interface RawListenLink {
  service?: ServiceId | null;
  url?: string | null;
  enabled?: boolean | null;
}

/** Discriminated by the synthesized `type` from `_type` via select(). */
export interface RawSongEntry {
  type: 'song';
  id?: string | null;
  title?: string | null;
  tag?: string | null;
  blurb?: string | null;
  art?: SanityImageValue | null;
  source?: string | null;
  links?: RawListenLink[] | null;
}

export interface RawYoutubeEntry {
  type: 'youtube';
  id?: string | null;
  /** TS wants `title`; derived from caption in mapping. */
  caption?: string | null;
  url?: string | null;
}

export type RawMusicEntry = RawSongEntry | RawYoutubeEntry;

export interface RawMusicPage {
  services?: ServiceId[] | null;
  entries?: RawMusicEntry[] | null;
}

export interface RawCtaButton {
  label?: string | null;
  sub?: string | null;
}

export interface RawLicensing {
  name?: string | null;
  email?: string | null;
}

export interface RawSocialLink {
  id?: string | null;
  platform?: SocialPlatform | null;
  label?: string | null;
  url?: string | null;
  enabled?: boolean | null;
}

export interface RawFormField {
  key?: FormFieldKey | null;
  label?: string | null;
  type?: FormFieldType | null;
  required?: boolean | null;
  placeholder?: string | null;
}

export interface RawContactForm {
  fields?: RawFormField[] | null;
  submitLabel?: string | null;
  successText?: string | null;
}

export interface RawContactPage {
  polaroids?: SanityImageValue | null;
  heading?: string | null;
  bookingEmail?: string | null;
  licensing?: RawLicensing | null;
  messageButton?: RawCtaButton | null;
  emailButton?: RawCtaButton | null;
  googleForm?: RawGoogleForm | null;
  socials?: RawSocialLink[] | null;
  messageForm?: RawContactForm | null;
  emailForm?: RawContactForm | null;
}

export interface RawBlogPage {
  heading?: string | null;
}

export interface RawBlogPost {
  id?: string | null;
  title?: string | null;
  slug?: string | null;
  date?: string | null;
  cover?: SanityImageValue | null;
  excerpt?: string | null;
  /** Portable Text block array (rendered via @portabletext/react). */
  body?: PortableTextBlock[] | null;
  published?: boolean | null;
}

/** The full batched query result. Any singleton may be null (unseeded). */
export interface RawSiteContent {
  settings: RawSiteSettings | null;
  home: RawHomePage | null;
  about: RawAboutPage | null;
  tour: RawTourPage | null;
  music: RawMusicPage | null;
  contact: RawContactPage | null;
  blog: RawBlogPage | null;
  posts: RawBlogPost[] | null;
}

/* ------------------------------------------------------------------ *
 * GROQ
 * ------------------------------------------------------------------ */

/** Shared image projection: keep the asset ref + hotspot for the url builder. */
const IMAGE = `{ "asset": asset, hotspot, crop }`;

/** Hero projection: nested image + the two focal strings. */
const HERO = `{ "image": image${IMAGE}, focalDesktop, focalMobile }`;

/**
 * One batched query. Singletons are fetched by their fixed id (== type name).
 * `posts` fetches published blogPosts newest-first.
 */
export const siteContentQuery = /* groq */ `{
  "settings": *[_id == "siteSettings"][0]{
    title,
    description,
    announcement,
    "design": design{
      accent,
      "logo": logo${IMAGE},
      "stripes": stripes${IMAGE}
    },
    pages[]{ pageId, enabled, label, isTextLabel },
    "connections": connections{
      emailWebhookUrl,
      contactWebhookUrl,
      shopify{ domain, token, apiVersion },
      bandsintown{ artist, appId },
      googleForm{ enabled, label, url }
    }
  },
  "home": *[_id == "homePage"][0]{
    "hero": hero${HERO},
    emailCtaEnabled,
    emailCtaText,
    clickHereEnabled
  },
  "about": *[_id == "aboutPage"][0]{
    "hero": hero${HERO},
    heading,
    body
  },
  "tour": *[_id == "tourPage"][0]{
    "hero": hero${HERO},
    bandsintownArtist,
    bandsintownAppId,
    emptyText,
    emptyLinkText,
    emptyLinkUrl
  },
  "music": *[_id == "musicPage"][0]{
    services,
    entries[]{
      "type": select(
        _type == "songEntry" => "song",
        _type == "youtubeEntry" => "youtube"
      ),
      "id": _key,
      _type == "songEntry" => {
        title,
        tag,
        blurb,
        "art": art${IMAGE},
        source,
        links[]{ service, url, enabled }
      },
      _type == "youtubeEntry" => {
        url,
        caption
      }
    }
  },
  "contact": *[_id == "contactPage"][0]{
    "polaroids": polaroids${IMAGE},
    heading,
    bookingEmail,
    licensing{ name, email },
    messageButton{ label, sub },
    emailButton{ label, sub },
    googleForm{ enabled, label, url },
    socials[]{ id, platform, label, url, enabled },
    messageForm{ fields[]{ key, label, type, required, placeholder }, submitLabel, successText },
    emailForm{ fields[]{ key, label, type, required, placeholder }, submitLabel, successText }
  },
  "blog": *[_id == "blogPage"][0]{
    heading
  },
  "posts": *[_type == "blogPost" && published == true] | order(date desc){
    "id": _id,
    title,
    "slug": slug.current,
    date,
    "cover": cover${IMAGE},
    excerpt,
    body,
    published
  }
}`;
