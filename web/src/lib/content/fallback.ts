/**
 * Baked fallback content — a fully-resolved SiteContent object mirroring the
 * prototype's WENDLO_DEFAULTS (prototype/config.js).
 *
 * This is what the site renders whenever there is no Sanity project configured
 * (see lib/content/index.ts). Copy — including smart quotes and emoji — is
 * preserved VERBATIM from the prototype.
 *
 * Image fields point at the assets already copied into /public. Where the
 * prototype used an empty image string ('' → baked default), the baked default
 * URL is inlined here directly.
 */

import type {
  AboutPage,
  BlogPage,
  ContactPage,
  HomePage,
  MusicPage,
  ServiceId,
  SiteContent,
  SiteSettings,
  SongEntry,
  TourPage,
} from './types';

/** Baked default asset URLs (public/ paths). */
export const DEFAULT_ASSETS = {
  logo: '/wendlo-logo.gif',
  stripes: '/defaults/stripes.jpg',
  homeHero: '/defaults/home.jpg',
  aboutHero: '/defaults/about.jpg',
  tourHero: '/defaults/shows.jpg',
  contactPolaroids: '/defaults/contactv2.png',
} as const;

/** Fixed service order (WENDLO_DEFAULTS.music.services). */
const SERVICES: ServiceId[] = [
  'spotify',
  'apple',
  'amazon',
  'deezer',
  'itunes',
  'napster',
  'tidal',
  'youtube',
];

/**
 * Build the 8 fixed listen-link rows for a song from the subset of services
 * that are actually enabled in the prototype. Unlisted services default to
 * `{ url: '', enabled: false }` (mirrors config.js where amazon/deezer/… are
 * `{url:'',on:false}`).
 */
function listenLinks(
  on: Partial<Record<ServiceId, string>>,
): SongEntry['links'] {
  return SERVICES.map((service) => {
    const url = on[service];
    return url
      ? { service, url, enabled: true }
      : { service, url: '', enabled: false };
  });
}

const settings: SiteSettings = {
  title: 'Wendlo',
  description:
    'Wendlo — warm, slightly unserious pop. Music, tour dates, and merch.',
  announcement: {
    enabled: false,
    text: 'Click here to join our email list! 💌',
    page: 'contact',
  },
  design: {
    accent: '#E0A32B',
    logo: { url: DEFAULT_ASSETS.logo },
    stripes: { url: DEFAULT_ASSETS.stripes },
  },
  // Array order = nav order (WENDLO_DEFAULTS.pages.order); merged with
  // enabled + labels. Text-label pages are about + blog.
  pages: [
    { pageId: 'home', enabled: true, label: 'home', isTextLabel: false },
    { pageId: 'about', enabled: false, label: 'about', isTextLabel: true },
    { pageId: 'tour', enabled: true, label: 'tour', isTextLabel: false },
    { pageId: 'contact', enabled: true, label: 'contact', isTextLabel: false },
    { pageId: 'music', enabled: true, label: 'music', isTextLabel: false },
    { pageId: 'store', enabled: true, label: 'store', isTextLabel: false },
    { pageId: 'blog', enabled: false, label: 'blog', isTextLabel: true },
  ],
  connections: {
    emailWebhookUrl: '',
    contactWebhookUrl: '',
    shopify: {
      domain: 'fep1gx-a1.myshopify.com',
      token: '13038a835c47c3e30b20f34cd745adfc',
      apiVersion: '2024-10',
    },
    bandsintown: {
      artist: 'id_14800723',
      appId: 'e013532ece4ef52f851d48a4d3730c70',
    },
    googleForm: { enabled: false, label: 'Fill out our form', url: '' },
  },
};

const home: HomePage = {
  hero: {
    url: DEFAULT_ASSETS.homeHero,
    focalDesktop: '50% 50%',
    focalMobile: '50% 42%',
  },
  emailCtaEnabled: true,
  emailCtaText: 'join our email list!',
  clickHereEnabled: true,
};

const about: AboutPage = {
  hero: {
    url: DEFAULT_ASSETS.aboutHero,
    focalDesktop: '50% 50%',
    focalMobile: '50% 40%',
  },
  heading: 'Two people, a pile of songs, and a van.',
  body: 'Warm, slightly unserious pop — about love, naps, and the people at the top who could stand to be a little nicer.',
};

const tour: TourPage = {
  hero: {
    url: DEFAULT_ASSETS.tourHero,
    focalDesktop: '50% 50%',
    focalMobile: '24% 42%',
  },
  bandsintownArtist: 'id_14800723',
  bandsintownAppId: 'e013532ece4ef52f851d48a4d3730c70',
  emptyText: 'No shows on the books right now.',
  emptyLinkText: 'Get notified on Bandsintown ↗',
  emptyLinkUrl: 'https://www.bandsintown.com/a/14800723',
};

const music: MusicPage = {
  services: SERVICES,
  entries: [
    {
      type: 'song',
      id: 'm1',
      title: 'Untethered',
      tag: 'Single',
      blurb:
        '“We all need to be grounded sometimes — in the arms of a loved one.”',
      art: { url: '/seed/art-untethered.jpg' },
      source: '',
      links: listenLinks({
        spotify: 'https://open.spotify.com/track/74e6w4agZGH0ylgs5ayNst',
        apple:
          'https://music.apple.com/us/album/untethered-single/1826150148',
      }),
    },
    {
      type: 'song',
      id: 'm2',
      title: 'Must Be Nice!',
      tag: 'Single',
      blurb:
        '“An ode to the people at the top who pay no mind to everyone else.”',
      art: { url: '/seed/art-mustbenice.jpg' },
      source: '',
      links: listenLinks({
        spotify: 'https://open.spotify.com/track/5CHCxB9CdsRbXQ9XAk7h8g',
        apple:
          'https://music.apple.com/us/album/must-be-nice/1817539414?i=1817539415',
      }),
    },
    {
      type: 'youtube',
      id: 'm3',
      title: 'Wendlo • September [Official Video]',
      url: 'https://www.youtube.com/watch?v=Dpzbv2AZ-dw',
    },
    {
      type: 'song',
      id: 'm4',
      title: 'Wasting Time With You',
      tag: 'Single',
      blurb: '“What’s all this other stuff for?? I just wanna hang out!”',
      art: { url: '/seed/art-wasting.jpg' },
      source: '',
      links: listenLinks({
        spotify: 'https://open.spotify.com/track/5UhkNRrD7irazpKbSuZ8R1',
        apple:
          'https://music.apple.com/us/album/wasting-time-with-you-single/1803715184',
      }),
    },
    {
      type: 'song',
      id: 'm5',
      title: 'Shadow',
      tag: 'Single',
      blurb: '“Started as a voice memo line — ‘let me be your shadow…’”',
      art: { url: '/seed/art-shadow.jpg' },
      source: '',
      links: listenLinks({
        spotify: 'https://open.spotify.com/track/6Bmte0o9RDfxgh534B1ubR',
        apple:
          'https://music.apple.com/us/album/shadow/1574915394?i=1574915395',
      }),
    },
    {
      type: 'song',
      id: 'm6',
      title: 'Downtown',
      tag: 'Single',
      blurb: '“Growing up in Alaska, I had pictures of moving to a big city…”',
      art: { url: '/seed/art-downtown.jpg' },
      source: '',
      links: listenLinks({
        spotify: 'https://open.spotify.com/track/1p8IGe4y3GWmTHUz1anSz1',
        apple:
          'https://music.apple.com/us/album/downtown-single/1467650995',
      }),
    },
  ],
};

const contact: ContactPage = {
  polaroids: { url: DEFAULT_ASSETS.contactPolaroids },
  heading: 'Get in touch',
  bookingEmail: 'hello@wendlomusic.com',
  licensing: { name: 'Low Profile NYC', email: 'yo@lowprofilenyc.com' },
  messageButton: {
    label: 'Send us a message',
    sub: 'Booking, event inquiries, or love letters 👩‍❤️‍👨',
  },
  emailButton: {
    label: 'Join our email list',
    sub: 'Become a Wendling',
  },
  googleForm: { enabled: false, label: 'Fill out our form', url: '' },
  socials: [
    {
      id: 'ig',
      platform: 'instagram',
      label: 'Instagram',
      url: 'https://www.instagram.com/wendlomusic',
      enabled: true,
    },
    {
      id: 'tt',
      platform: 'tiktok',
      label: 'TikTok',
      url: 'https://www.tiktok.com/@wendlomusic',
      enabled: true,
    },
    {
      id: 'fb',
      platform: 'facebook',
      label: 'Facebook',
      url: 'https://www.facebook.com/wendlomusic',
      enabled: true,
    },
    {
      id: 'yt',
      platform: 'youtube',
      label: 'YouTube',
      url: 'https://www.youtube.com/@wendlo',
      enabled: true,
    },
    {
      id: 'sp',
      platform: 'spotify',
      label: 'Spotify',
      url: 'https://open.spotify.com/artist/7Gv2m6LRpBmAheRectfl2E',
      enabled: true,
    },
    {
      id: 'am',
      platform: 'apple',
      label: 'Apple Music',
      url: 'https://music.apple.com/us/artist/wendlo/1251092804',
      enabled: true,
    },
    {
      id: 'sc',
      platform: 'soundcloud',
      label: 'SoundCloud',
      url: 'https://soundcloud.com/wendlo',
      enabled: false,
    },
  ],
  messageForm: {
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'subject', label: 'Subject', type: 'text', required: false },
      { key: 'message', label: 'Message', type: 'textarea', required: true },
    ],
    submitLabel: 'Send',
    successText: 'Got it — we read everything. 💌',
  },
  emailForm: {
    fields: [
      {
        key: 'name',
        label: "What's your name?",
        type: 'text',
        required: true,
        placeholder: '',
      },
      {
        key: 'email',
        label: 'Do you have an email address?',
        type: 'email',
        required: true,
        placeholder: 'under_score@hotmail.com',
      },
      {
        key: 'location',
        label: 'Where do you live?',
        type: 'text',
        required: false,
        placeholder: 'Full address, or just a postal code :)',
      },
      {
        key: 'meal',
        label: "What's the best meal you've ever eaten?",
        type: 'text',
        required: false,
        placeholder: '',
      },
      {
        key: 'message',
        label: 'Anything else to say?',
        type: 'textarea',
        required: false,
        placeholder: 'If you have a message for Wendlo, put it here!',
      },
    ],
    submitLabel: 'Join',
    successText: 'Welcome, Wendling! 🎉',
  },
};

const blog: BlogPage = {
  heading: 'Notes from the van',
  posts: [
    {
      id: 'p1',
      title: 'Hello from the van',
      slug: 'hello-from-the-van',
      date: '2026-06-20',
      cover: { url: DEFAULT_ASSETS.aboutHero },
      excerpt:
        'A little corner of the internet where we overshare about songs, snacks, and highway exits.',
      body: '<p>Hi. We’re Wendlo, and this is the blog — the part of the site where nobody makes us keep it short.</p><p>Expect tour diaries, demos that may never come out, and a running list of the best gas-station snacks in North America (currently topped by a boiled peanut situation in Georgia we’re still thinking about).</p><p>If you want these in your inbox instead, join the email list. We only send the good stuff.</p>',
      published: true,
    },
  ],
};

/** The complete baked fallback content. */
export const fallbackContent: SiteContent = {
  settings,
  home,
  about,
  tour,
  music,
  contact,
  blog,
};
