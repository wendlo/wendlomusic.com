/**
 * Standalone seed script — populates a Sanity dataset from the baked fallback
 * content so a fresh project renders identically to the no-Sanity build.
 *
 * Run manually (never in the build / CI):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID=... \
 *   NEXT_PUBLIC_SANITY_DATASET=production \
 *   SANITY_API_WRITE_TOKEN=... \
 *   npx tsx scripts/seed.ts
 *
 * It upserts the 7 singletons (siteSettings + 6 page docs), the song/youtube
 * entries, socials, and form definitions, plus the sample blog post — uploading
 * the /public/seed art + /public/defaults hero images as Sanity image assets.
 *
 * `@sanity/block-tools` is NOT installed here, so the blog body is written as
 * simple Portable Text blocks (parsed from the fallback's raw HTML).
 */

import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient, type SanityClient } from '@sanity/client';
import { fallbackContent } from '../src/lib/content/fallback';
import type {
  BlogPost,
  MusicEntry,
  SocialLink,
  SongEntry,
} from '../src/lib/content/types';

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2024-10-01';
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID');
  process.exit(1);
}
if (!token) {
  console.error('Missing SANITY_API_WRITE_TOKEN (needs write access)');
  process.exit(1);
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

/** Project root (scripts/ lives directly under web/). */
const ROOT = resolve(__dirname, '..');
const PUBLIC = join(ROOT, 'public');

/* ------------------------------------------------------------------ *
 * Asset upload (cached per public path)
 * ------------------------------------------------------------------ */

const assetCache = new Map<string, string>();

/**
 * Upload a /public-relative asset (e.g. "/seed/art-shadow.jpg") as an image
 * asset and return a Sanity image object referencing it. Returns `undefined`
 * when the file is missing on disk (so the room's baked default applies).
 */
async function uploadImage(
  publicPath: string,
): Promise<{ _type: 'image'; asset: { _type: 'reference'; _ref: string } } | undefined> {
  const rel = publicPath.replace(/^\//, '');
  const filePath = join(PUBLIC, rel);
  if (!existsSync(filePath)) {
    console.warn(`  ! asset missing, skipping: ${publicPath}`);
    return undefined;
  }
  let assetId = assetCache.get(publicPath);
  if (!assetId) {
    const filename = rel.split('/').pop() ?? 'image';
    const asset = await client.assets.upload('image', createReadStream(filePath), {
      filename,
    });
    assetId = asset._id;
    assetCache.set(publicPath, assetId);
    console.log(`  ↑ uploaded ${publicPath} → ${assetId}`);
  }
  return { _type: 'image', asset: { _type: 'reference', _ref: assetId } };
}

/* ------------------------------------------------------------------ *
 * Portable Text (simple HTML → blocks; no @sanity/block-tools)
 * ------------------------------------------------------------------ */

let keyCounter = 0;
const key = () => `k${(keyCounter++).toString(36)}${Date.now().toString(36)}`;

interface PTSpan {
  _type: 'span';
  _key: string;
  text: string;
  marks: string[];
}
interface PTBlock {
  _type: 'block';
  _key: string;
  style: string;
  markDefs: Array<{ _key: string; _type: 'link'; href: string }>;
  children: PTSpan[];
}

/** Decode the handful of HTML entities the fallback body uses. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Parse inline HTML (strong/em/a) within one block into Portable Text spans. */
function parseInline(html: string): {
  children: PTSpan[];
  markDefs: PTBlock['markDefs'];
} {
  const children: PTSpan[] = [];
  const markDefs: PTBlock['markDefs'] = [];
  // Tokenise on the supported inline tags.
  const re = /<(strong|em|a)(?:\s+href="([^"]*)")?>([\s\S]*?)<\/\1>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const [, tag, href, inner, plain] = match;
    if (plain !== undefined) {
      const text = decode(plain);
      if (text) children.push({ _type: 'span', _key: key(), text, marks: [] });
      continue;
    }
    const text = decode((inner ?? '').replace(/<[^>]+>/g, ''));
    if (!text) continue;
    const marks: string[] = [];
    if (tag === 'strong') marks.push('strong');
    else if (tag === 'em') marks.push('em');
    else if (tag === 'a' && href) {
      const defKey = key();
      markDefs.push({ _key: defKey, _type: 'link', href: decode(href) });
      marks.push(defKey);
    }
    children.push({ _type: 'span', _key: key(), text, marks });
  }
  return { children, markDefs };
}

/** Convert the fallback's raw-HTML body into simple Portable Text blocks. */
function htmlToBlocks(html: string): PTBlock[] {
  const blocks: PTBlock[] = [];
  const re = /<(p|h3|blockquote)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const [, tag, inner] = match;
    const style = tag === 'h3' ? 'h3' : tag === 'blockquote' ? 'blockquote' : 'normal';
    const { children, markDefs } = parseInline(inner);
    blocks.push({ _type: 'block', _key: key(), style, markDefs, children });
  }
  return blocks;
}

/* ------------------------------------------------------------------ *
 * Document builders
 * ------------------------------------------------------------------ */

const FB = fallbackContent;

/** Default hero focal → the schema's heroImage shape (no image = default). */
async function heroDoc(
  publicPath: string,
  focalDesktop?: string,
  focalMobile?: string,
) {
  const image = await uploadImage(publicPath);
  return {
    _type: 'heroImage',
    ...(image ? { image } : {}),
    ...(focalDesktop ? { focalDesktop } : {}),
    ...(focalMobile ? { focalMobile } : {}),
  };
}

async function siteSettingsDoc() {
  const s = FB.settings;
  return {
    _id: 'siteSettings',
    _type: 'siteSettings',
    title: s.title,
    description: s.description,
    announcement: { _type: 'announcement', ...s.announcement },
    design: {
      _type: 'designSettings',
      accent: s.design.accent,
      // logo/stripes empty in fallback → leave off so defaults apply.
    },
    pages: s.pages.map((p) => ({ _type: 'navPage', _key: p.pageId, ...p })),
    connections: {
      _type: 'connectionSettings',
      emailWebhookUrl: s.connections.emailWebhookUrl,
      contactWebhookUrl: s.connections.contactWebhookUrl,
      shopify: { _type: 'shopifySettings', ...s.connections.shopify },
      bandsintown: { _type: 'bandsintownSettings', ...s.connections.bandsintown },
      googleForm: { _type: 'googleForm', ...s.connections.googleForm },
    },
  };
}

async function homePageDoc() {
  return {
    _id: 'homePage',
    _type: 'homePage',
    hero: await heroDoc(
      FB.home.hero.url,
      FB.home.hero.focalDesktop,
      FB.home.hero.focalMobile,
    ),
    emailCtaEnabled: FB.home.emailCtaEnabled,
    emailCtaText: FB.home.emailCtaText,
    clickHereEnabled: FB.home.clickHereEnabled,
  };
}

async function aboutPageDoc() {
  return {
    _id: 'aboutPage',
    _type: 'aboutPage',
    hero: await heroDoc(
      FB.about.hero.url,
      FB.about.hero.focalDesktop,
      FB.about.hero.focalMobile,
    ),
    heading: FB.about.heading,
    body: FB.about.body,
  };
}

async function tourPageDoc() {
  return {
    _id: 'tourPage',
    _type: 'tourPage',
    hero: await heroDoc(
      FB.tour.hero.url,
      FB.tour.hero.focalDesktop,
      FB.tour.hero.focalMobile,
    ),
    bandsintownArtist: FB.tour.bandsintownArtist,
    bandsintownAppId: FB.tour.bandsintownAppId,
    emptyText: FB.tour.emptyText,
    emptyLinkText: FB.tour.emptyLinkText,
    emptyLinkUrl: FB.tour.emptyLinkUrl,
  };
}

async function musicEntryDoc(entry: MusicEntry) {
  if (entry.type === 'youtube') {
    return {
      _type: 'youtubeEntry',
      _key: entry.id,
      url: entry.url,
      ...(entry.title ? { caption: entry.title } : {}),
    };
  }
  const song: SongEntry = entry;
  const art = await uploadImage(song.art.url);
  return {
    _type: 'songEntry',
    _key: song.id,
    title: song.title,
    tag: song.tag,
    blurb: song.blurb,
    ...(art ? { art } : {}),
    ...(song.source ? { source: song.source } : {}),
    links: song.links.map((l) => ({ _type: 'listenLink', _key: l.service, ...l })),
  };
}

async function musicPageDoc() {
  const entries = [];
  for (const e of FB.music.entries) entries.push(await musicEntryDoc(e));
  return {
    _id: 'musicPage',
    _type: 'musicPage',
    services: FB.music.services,
    entries,
  };
}

function socialDoc(sl: SocialLink) {
  return { _type: 'socialLink', _key: sl.id, ...sl };
}

function formDoc(form: typeof FB.contact.messageForm) {
  return {
    _type: 'contactForm',
    fields: form.fields.map((f) => ({
      _type: 'formField',
      _key: f.key,
      ...f,
    })),
    submitLabel: form.submitLabel,
    successText: form.successText,
  };
}

async function contactPageDoc() {
  const c = FB.contact;
  const polaroids = await uploadImage(c.polaroids.url);
  return {
    _id: 'contactPage',
    _type: 'contactPage',
    ...(polaroids ? { polaroids } : {}),
    heading: c.heading,
    bookingEmail: c.bookingEmail,
    licensing: { _type: 'licensing', ...c.licensing },
    messageButton: { _type: 'ctaButton', ...c.messageButton },
    emailButton: { _type: 'ctaButton', ...c.emailButton },
    googleForm: { _type: 'googleForm', ...c.googleForm },
    socials: c.socials.map(socialDoc),
    messageForm: formDoc(c.messageForm),
    emailForm: formDoc(c.emailForm),
  };
}

async function blogPageDoc() {
  return { _id: 'blogPage', _type: 'blogPage', heading: FB.blog.heading };
}

async function blogPostDoc(post: BlogPost) {
  const cover = await uploadImage(post.cover.url);
  return {
    _id: `blogPost-${post.slug}`,
    _type: 'blogPost',
    title: post.title,
    slug: { _type: 'slug', current: post.slug },
    date: post.date,
    ...(cover ? { cover } : {}),
    excerpt: post.excerpt,
    body: htmlToBlocks(post.body),
    published: post.published,
  };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

async function main() {
  console.log(`Seeding project ${projectId} / dataset ${dataset}\n`);

  console.log('Building singletons…');
  const singletons = [
    await siteSettingsDoc(),
    await homePageDoc(),
    await aboutPageDoc(),
    await tourPageDoc(),
    await musicPageDoc(),
    await contactPageDoc(),
    await blogPageDoc(),
  ];

  console.log('Building blog posts…');
  const posts = [];
  for (const p of FB.blog.posts) posts.push(await blogPostDoc(p));

  console.log('\nCommitting…');
  const tx = client.transaction();
  const all: Array<{ _id: string; _type: string; [k: string]: unknown }> = [
    ...singletons,
    ...posts,
  ];
  for (const doc of all) tx.createOrReplace(doc);
  await tx.commit();

  console.log(
    `\n✓ Seeded ${singletons.length} singletons + ${posts.length} blog post(s).`,
  );
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
