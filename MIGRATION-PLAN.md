# Wendlo — Option B build plan (Next.js + Sanity)

> Authoritative migration blueprint for rebuilding **wendlomusic.com** as a single Next.js 15 App-Router application with an embedded Sanity Studio, deployed as one Vercel project. This plan supersedes the localStorage/`config-published.json` prototype console and folds in the accepted review fixes (one-click publish, submit rate-limiting, a Submissions read route, accessible store gallery, the tablet-portrait layout branch, and the Google service-account footguns).

---

## 1. Overview & target stack

The current site is a single `index.html` SPA driven by a bespoke admin console that layers `localStorage` over a baked default config, previews via a `postMessage(targetOrigin:'*')` bridge, and publishes by writing a `config-published.json`. Content, secrets, and layout logic all live in the browser. Option B replaces that entirely: **Sanity is the single source of truth**, the site is server-rendered for real first paint and SEO, secrets move to Vercel env, and the band self-edits in a real authenticated Studio with live click-to-edit preview.

The one surviving "default" concept is **empty image → baked brand asset** (handled at render time in `lib/defaults`), *not* config merging.

| Concern | Choice |
| --- | --- |
| Framework | **Next.js 15**, App Router, React Server Components, TypeScript |
| Styling | Plain CSS + CSS Modules (no Tailwind) — exact `clamp()`/`--ease`/keyframes ported verbatim |
| CMS | **Sanity** (embedded Studio at `/studio`), GROQ, `next-sanity` |
| Hosting | **Vercel** (one project, prod + preview scopes) |
| Fonts | `next/font` self-hosted **Fraunces**; **Montserrat** as Proxima-Nova stand-in until the Adobe Fonts kit is licensed |
| Merch | **Shopify** Storefront GraphQL (server grid + client `cartCreate`) |
| Email list | **Mailchimp** Marketing API (double opt-in, status `pending`) |
| Submissions record-of-truth | **Google Sheets** (append), read back via a session-gated route |
| Transactional email | Resend / Postmark / SendGrid (band notifications) |
| Spam | **Cloudflare Turnstile** (server `siteverify`) |
| Rate-limit / idempotency | **Vercel KV / Upstash Redis** (sliding-window + idempotency key) |
| Shows | **Bandsintown** REST (server fetch, cached) |
| Revalidation | Sanity publish webhook → `revalidateTag(_type)` (ISR) |
| Live preview | Sanity **Presentation** tool + Next `draftMode()` + `<VisualEditing/>` |

---

## 2. Repository / file-tree structure

Single repo, single Next app with the Studio mounted inside it.

```
/ (repo root)
├── package.json
├── next.config.ts            # images.remotePatterns: cdn.sanity.io, i.ytimg.com, cdn.shopify.com; typedRoutes
├── tsconfig.json
├── sanity.config.ts          # Studio at /studio: schema, structure, Presentation, custom inputs/actions
├── sanity.cli.ts             # projectId/dataset for `sanity dataset`/`deploy`/migrations
├── .env.local                # gitignored
├── .env.example              # every var below, documented
├── .gitignore
├── .nvmrc
├── README.md
├── scripts/
│   └── seed.ts               # one-off @sanity/client seed → matches prototype exactly
├── public/
│   ├── nav/                  # *-white.gif + *-mustard.gif (10 fixed brand files)
│   ├── wendlo-logo.gif
│   ├── click-here-white.gif
│   ├── follow-along-white.gif
│   ├── w-tile.png            # favicon + OG tile
│   └── defaults/             # home.jpg, about.jpg, shows.jpg, contactv2.png, stripes.jpg (baked hero/bg defaults)
└── src/
    ├── app/
    │   ├── layout.tsx                       # html/body, next/font, global CSS, generateMetadata(siteSettings), announcement bar, <VisualEditing/> (gated on draftMode)
    │   ├── (site)/
    │   │   ├── layout.tsx                   # renders the client Shell; server-fetches all room content once, passes as props
    │   │   ├── page.tsx                     # the single public entry "/"; one batched GROQ fetch; <Rooms>
    │   │   └── rooms/
    │   │       ├── HomeRoom.tsx  AboutRoom.tsx  TourRoom.tsx  ContactRoom.tsx
    │   │       ├── MusicRoom.tsx  StoreRoom.tsx  BlogRoom.tsx        # server components (pixel-faithful markup)
    │   │       └── _client/
    │   │           ├── Shell.tsx            # translateX track + go(page) + moving nav + reduced-motion + hash routing
    │   │           ├── ContactSheet.tsx     # modal forms + Turnstile + POST /api/submit
    │   │           ├── ShowsPanel.tsx       # Bandsintown hydration + scroll hint
    │   │           ├── StoreGrid.tsx        # accessible card→lightbox base + hover-scrub enhancement
    │   │           ├── Cart.tsx             # localStorage cart + Shopify cartCreate
    │   │           └── BlogView.tsx         # list <-> article (Portable Text server-rendered)
    │   ├── studio/[[...tool]]/page.tsx      # NextStudio catch-all; force-dynamic; robots noindex
    │   └── api/
    │       ├── submit/route.ts              # Node; contact + email pipeline (KV rate-limit → Turnstile → Sheets → Mailchimp → notify)
    │       ├── proxy/route.ts               # Node; smart-link fetcher, allowlisted + SSRF-guarded, Studio-session gated
    │       ├── submissions/route.ts         # Node; Studio-session-gated server-side Sheets READ for SubmissionsTool
    │       ├── revalidate/route.ts          # Node; Sanity webhook → revalidateTag(_type)
    │       ├── draft-mode/enable/route.ts   # defineEnableDraftMode
    │       ├── draft-mode/disable/route.ts  # clears draftMode cookie
    │       └── tour/route.ts                # OPTIONAL cached Bandsintown wrapper (else fetched in RSC)
    ├── lib/
    │   ├── env.ts                           # typed/validated env; un-escapes Google PEM \n; throws at boot on missing secret
    │   ├── sanity/
    │   │   ├── client.ts                    # createClient (CDN prod) + token'd preview client
    │   │   ├── queries.ts                   # all GROQ tagged strings
    │   │   ├── fetch.ts                     # sanityFetch(query, params, {tags}) — draftMode-aware + next.tags
    │   │   └── image.ts                     # urlFor + focal helper → --focal / --focal-m
    │   ├── shopify.ts                       # server products (tagged) + client cartCreate
    │   ├── bandsintown.ts                   # getUpcomingShows() server fetch, revalidate ~900s
    │   ├── defaults.ts                      # '' → baked-asset map (DEFAULT_ASSETS parity)
    │   ├── youtube.ts                       # ytId() regex shared by render + Studio validator
    │   ├── ratelimit.ts                     # KV sliding-window + idempotency helpers
    │   └── forms.ts                         # shared form-field types + server validation
    ├── styles/
    │   ├── tokens.css                       # CSS custom props ported verbatim
    │   ├── globals.css
    │   └── rooms.css                        # room/nav/hero/store/contact/blog CSS incl. exact clamp()/keyframes/media queries
    └── sanity/
        ├── schemas/
        │   ├── index.ts
        │   ├── documents/                   # siteSettings, homePage, aboutPage, tourPage, musicPage, contactPage, blogPage, blogPost
        │   └── objects/                     # navPage, designSettings, connectionSettings, announcement, heroImage, songEntry,
        │                                    #   youtubeEntry, listenLink, socialLink, contactForm, formField, ctaButton,
        │                                    #   licensing, googleForm, shopifySettings, bandsintownSettings
        ├── structure.ts                     # singletons + blogPost list + Dashboard + Submissions + "Publish all changed"
        ├── inputs/                          # DualFocalInput, ListenLinkMatrix, YouTubeUrlInput, AccentColorInput,
        │                                    #   NavManagerInput, SmartLinkImportAction, TestConnectionInput
        ├── actions/
        │   └── PublishAllChanged.tsx        # one-click global publish (prototype PUBLISH parity)
        └── tools/
            ├── DashboardTool.tsx            # read-only stats + connection health
            └── SubmissionsTool.tsx          # Sheets-backed inbox (via /api/submissions)
```

---

## 3. Sanity schema (type by type)

Every field the band can edit today has a home below. Documents are singletons unless noted; page singletons are enforced via `structure.ts` + the singleton action pattern. The `heroImage.image` fields keep `hotspot:true` only to seed the desktop focal — the two independent CSS object-positions are stored explicitly (see Open Decisions).

### 3.1 `siteSettings` — document (singleton, id `siteSettings`)

Global meta, SEO, announcement, theming, page/nav config, band-owned connection URLs.

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | SEO `<title>` base. Default `Wendlo`. |
| `description` | text | Meta/share description. |
| `announcement` | object (`announcement`) | Site-wide bar. Edited on the Home screen in the console. |
| `design` | object (`designSettings`) | accent / logo / stripes theming. |
| `pages` | array of `navPage` | **Single ordered array** collapsing order + enabled + labels. Array order = nav order. Validation: exactly the 7 fixed `pageId`s present; `home` enabled. Edited via `NavManagerInput` (drag-reorder). |
| `connections` | object (`connectionSettings`) | The only band-owned connection config. |

### 3.2 `announcement` — object

| Field | Type | Notes |
| --- | --- | --- |
| `enabled` | boolean | Show/hide the bar. |
| `text` | string | Banner copy (emoji allowed). |
| `page` | string | Target `pageId` enum `home\|about\|tour\|contact\|music\|store\|blog`, rendered as a Studio select. **Validation:** must reference a *currently-enabled* page; render-time fallback to `contact` then `home` (mirrors prototype `go()`), so the bar never points at a disabled room. |

### 3.3 `designSettings` — object

| Field | Type | Notes |
| --- | --- | --- |
| `accent` | string | Hex, default `#E0A32B`. `AccentColorInput` (picker + hex + presets Mustard/Persimmon/Teal/Butter), 6-hex validation. Injected as inline `--persimmon` override on the site root. **Does not** affect nav GIF art. |
| `logo` | image | Empty → default `/wendlo-logo.gif` (CSS-inverted white). Custom shown as-is (drops the invert). No hotspot. |
| `stripes` | image | Empty → `/defaults/stripes.jpg`. Background behind music/store/contact/blog. |

### 3.4 `navPage` — object (array item in `siteSettings.pages`)

Fixed set of 7, drag-reordered.

| Field | Type | Notes |
| --- | --- | --- |
| `pageId` | string | enum `home\|about\|tour\|contact\|music\|store\|blog`. Read-only, not user-addable. |
| `enabled` | boolean | `home` locked `true` via validation. |
| `label` | string | Editable **only** for `about` + `blog` (text-nav pages); GIF-art pages read-only. `isTextLabel` gates the input so GIF labels can't be changed. |
| `isTextLabel` | boolean | `true` for about + blog; `false` for GIF pages. Drives label editability. |

### 3.5 `connectionSettings` — object

Band-editable integration config; **secrets live in env** (see manifest). This object holds only the genuinely band-owned URLs plus optional self-edit overrides.

| Field | Type | Notes |
| --- | --- | --- |
| `emailWebhookUrl` | url | Optional legacy passthrough POST target. Pipeline is `/api/submit`; kept only if the band wants an extra target. |
| `contactWebhookUrl` | url | Same, for the message form. |
| `shopify` | object (`shopifySettings`) | RECOMMEND env; include only for self-edit. |
| `bandsintown` | object (`bandsintownSettings`) | RECOMMEND env; `appId` is public but infra-ish. |
| `googleForm` | object (`googleForm`) | Optional Google-Form fallback CTA, aliased from Contact. |

### 3.6 `homePage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `hero` | object (`heroImage`) | Empty image → `/defaults/home.jpg`. **Ken-Burns applies here only.** |
| `emailCtaEnabled` | boolean | Email CTA toggle. |
| `emailCtaText` | string | e.g. `join our email list!` |
| `clickHereEnabled` | boolean | Hand-drawn arrow GIF (`/click-here-white.gif`) toggle. |

### 3.7 `aboutPage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `hero` | object (`heroImage`) | Empty → `/defaults/about.jpg`. |
| `heading` | string | About heading. |
| `body` | text | **PLAIN multiline** (line breaks → paragraphs, `white-space:pre-line`). NOT Portable Text — matches prototype. |

### 3.8 `tourPage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `hero` | object (`heroImage`) | Empty → `/defaults/shows.jpg`. `focalMobile` default `24% 42%`. |
| `bandsintownArtist` | string | e.g. `id_14800723`. RECOMMEND env override; field kept for self-edit + Test action. |
| `bandsintownAppId` | string | RECOMMEND env. `TestConnectionInput` does a live events fetch. |
| `emptyText` | string | Empty-state copy when no upcoming shows. |
| `emptyLinkText` | string | Blank = no link. |
| `emptyLinkUrl` | url | Empty-state link target. |

### 3.9 `musicPage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `services` | array of string | **Fixed order** `['spotify','apple','amazon','deezer','itunes','napster','tidal','youtube']`. Hidden/read-only in Studio; drives `ListenLinkMatrix` ordering. **Must ship** — the matrix ordering depends on it (was dropped in one inventory draft). |
| `entries` | array of `songEntry \| youtubeEntry` | Single ordered mixed array; order = page order. Drag-reorder. Songs alternate art/text sides automatically; YouTube full-width. |

### 3.10 `songEntry` — object (array item in `musicPage.entries`)

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Song title. |
| `tag` | string | `Single` / `EP` / `Cover`. |
| `blurb` | text | Smart-quotes preserved. |
| `art` | image | Square cover. Auto-filled from smart-link `og:image` on import (uploaded as a Sanity asset by `SmartLinkImportAction`); still manually overridable. |
| `links` | array of `listenLink` | 8 fixed-service rows `{service,url,enabled}`. Rendered via `ListenLinkMatrix` in `music.services` order. Only `enabled && url` render on site. |
| `source` | url | Smart link this was imported from; enables the Re-import action. |

### 3.11 `youtubeEntry` — object (array item in `musicPage.entries`)

| Field | Type | Notes |
| --- | --- | --- |
| `url` | url | Any watch/share/shorts/`youtu.be` URL. `YouTubeUrlInput` shows live validity via `ytId()`. |
| `caption` | string | Admin-only caption; **NOT shown to visitors**. |

### 3.12 `listenLink` — object (array item in `songEntry.links`)

| Field | Type | Notes |
| --- | --- | --- |
| `service` | string | enum `spotify\|apple\|amazon\|deezer\|itunes\|napster\|tidal\|youtube` (fixed 8, read-only). |
| `url` | url | Per-service listen URL. |
| `enabled` | boolean | Off **or** empty url = hidden on site. |

### 3.13 `heroImage` — object (reused by home/about/tour)

| Field | Type | Notes |
| --- | --- | --- |
| `image` | image (`hotspot:true`) | Null/empty → frontend uses the baked per-room default (`lib/defaults`). Native hotspot seeds the desktop focal. |
| `focalDesktop` | string | `X% Y%` object-position (desktop → `--focal`). Set by `DualFocalInput` or derived from hotspot. Default `50% 50%`. |
| `focalMobile` | string | `X% Y%` (mobile → `--focal-m`). **Separate value** — native hotspot stores only one, so `DualFocalInput` captures the second click. Falls back to `focalDesktop` then center. |

### 3.14 `contactPage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `polaroids` | image | Empty → `/defaults/contactv2.png`. No hotspot. |
| `heading` | string | Contact heading. |
| `messageButton` | object (`ctaButton`) | `{label, sub}`. |
| `emailButton` | object (`ctaButton`) | `{label, sub}`. |
| `bookingEmail` | string (email) | Also becomes the `NOTIFY_EMAIL_TO` default. |
| `licensing` | object (`licensing`) | `{name, email}`. |
| `socials` | array of `socialLink` | Drag-ordered. |
| `googleForm` | object (`googleForm`) | `{enabled, label, url}`. |
| `messageForm` | object (`contactForm`) | `fields[] + submitLabel + successText`. Fixed keys `name/email/subject/message`. |
| `emailForm` | object (`contactForm`) | `fields[] + submitLabel + successText`. Fixed keys `name/email/location/meal/message`; fields carry `placeholder`. |

### 3.15 `ctaButton` — object

| Field | Type | Notes |
| --- | --- | --- |
| `label` | string | Button label. |
| `sub` | string | Button subtitle. |

### 3.16 `licensing` — object

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Sync/licensing contact name. |
| `email` | string | Licensing email. |

### 3.17 `googleForm` — object

| Field | Type | Notes |
| --- | --- | --- |
| `enabled` | boolean | Show the Google-Form fallback CTA. |
| `label` | string | CTA label. |
| `url` | url | iframe target. |

### 3.18 `socialLink` — object (array item in `contactPage.socials`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable id (`ig/tt/fb/yt/sp/am/sc`), auto-generated on add; preserved for seed. |
| `platform` | string | enum `instagram\|tiktok\|facebook\|youtube\|spotify\|apple\|soundcloud\|twitter\|bandcamp\|other` — drives the Tabler icon. |
| `label` | string | Display name. |
| `url` | url | Link. |
| `enabled` | boolean | Show/hide (SoundCloud `false` by default). |

### 3.19 `contactForm` — object (`messageForm` / `emailForm`)

| Field | Type | Notes |
| --- | --- | --- |
| `fields` | array of `formField` | Fixed-key questions. |
| `submitLabel` | string | `Send` / `Join`. |
| `successText` | string | Post-submit copy (returned by `/api/submit`). |

### 3.20 `formField` — object (array item in `contactForm.fields`)

| Field | Type | Notes |
| --- | --- | --- |
| `key` | string | **Read-only fixed key** (`name/email/subject/message/location/meal`). Drives Sheets columns + Submissions display + Mailchimp merge mapping. Not band-editable. |
| `label` | string | Visible question text (editable). |
| `type` | string | enum `text\|email\|textarea`. |
| `required` | boolean | Validation flag. |
| `placeholder` | string | Used by `emailForm` fields only. |

### 3.21 `blogPage` — document (singleton)

| Field | Type | Notes |
| --- | --- | --- |
| `heading` | string | e.g. `Notes from the van`. |

### 3.22 `blogPost` — document (one per post, list view newest-first by date)

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Post title. |
| `slug` | slug | **NEW** — stable per-post URL / reference (prototype used id `p1`); source from title. |
| `date` | date | Drives newest-first sort. |
| `cover` | image | 16:9. |
| `excerpt` | text | List/summary copy. |
| `body` | array (Portable Text) | Prototype HTML (`p/h3/blockquote/bold/italic/link`) → Portable Text (styles `normal/h3/blockquote`, marks `strong/em/link`). Migrated via `@sanity/block-tools` `htmlToBlocks` at seed. Rendered with `@portabletext/react` — **no** `dangerouslySetInnerHTML`. |
| `published` | boolean | Explicit **site-visibility** flag, kept DISTINCT from Sanity's own draft state, to preserve exact prototype behavior. |

### 3.23 `shopifySettings` — object (on `connectionSettings`)

| Field | Type | Notes |
| --- | --- | --- |
| `domain` | string | Storefront domain (else env). |
| `token` | string | Public Storefront token. |
| `apiVersion` | string | `2024-10`. |

### 3.24 `bandsintownSettings` — object (on `connectionSettings`)

| Field | Type | Notes |
| --- | --- | --- |
| `artist` | string | Artist id. |
| `appId` | string | App id (else env). |

---

## 4. Routes & rendering

| Route | Type | Rendering | Data sources | Notes |
| --- | --- | --- | --- | --- |
| `/` | page | Server Component, static + **ISR via tag revalidation** (tags: every page `_type` + `blogPost`). Content wrapped in a client `Shell` owning translateX, moving nav, Ken-Burns, reduced-motion, hash routing. | One batched GROQ fetch of all singletons + published `blogPost`s + services/socials/entries. Shopify products + Bandsintown shows fetched in their room RSCs (separately cached). | Replaces the prototype SPA. **All 7 rooms server-rendered** inside the scroller so first paint has real content (no defaults→remote flash). Dynamic bits hydrate client-side. Layout mode via CSS media queries (SSR-safe), replacing `autoFit()`. |
| `/studio/[[...tool]]` | page | `force-dynamic`, client (`NextStudio`), `noindex`. | Sanity (authenticated). | Embedded Studio; real Sanity auth replaces the prototype `passHash` login. Hosts custom inputs + Dashboard + Submissions + Presentation + **Publish-all** action. |
| `/api/submit` | route (POST, Node) | Dynamic, no cache. | KV, Turnstile, Google Sheets, Mailchimp, email provider. | Single endpoint for both forms. |
| `/api/proxy` | route (GET, Node) | Dynamic, `Cache-Control: no-store`. | Allowlisted smart-link HTML. | Studio-session-gated SSRF-hardened fetcher for the music importer. |
| `/api/submissions` | route (GET, Node) | Dynamic, no cache. | Google Sheets (server-side READ). | **Studio-session-gated.** Backs `SubmissionsTool`; Sheets creds never reach the Studio client. |
| `/api/revalidate` | route (POST, Node) | Dynamic. | Sanity webhook payload. | Verifies `SANITY_REVALIDATE_SECRET` (`parseBody`), then `revalidateTag(_type)`. |
| `/api/draft-mode/enable` | route (GET, Node) | Dynamic. | Sanity (validates preview URL). | `defineEnableDraftMode`; sets `draftMode()` cookie, redirects into `/`. Backs Presentation live preview (replaces the `?preview=1` postMessage bridge). |
| `/api/draft-mode/disable` | route (GET) | Dynamic. | none | Clears `draftMode()` cookie, redirects home. |
| `/api/tour` | route (GET, Node) | Cached (`revalidate ~900s`) **OPTIONAL** | Bandsintown REST. | Server wrapper so `app_id`/artist stay server-side. Omit if `TourRoom` RSC calls `lib/bandsintown` directly. |

### 4.1 The horizontal-rooms Shell (deep-linking, back, focus)

The signature slider is one continuous `%`-measured translateX track, so real per-room routes would destroy the slide animation and shared nav. It stays a single `/` route with a client `Shell`; **the URL hash is the source of truth** for the visible room:

- **SSR-honoring deep links:** on mount, `Shell` reads the incoming `#room` and sets the initial transform **without animation** (the prototype "instant" variant) — a shared `/#store` never flashes home then jumps.
- **Back button:** each `go(page)` pushes a history entry, so browser Back navigates between rooms.
- **Guarding:** unknown or **disabled** page ids fall back to `contact` then `home` (mirrors `go()`); disabled pages are not deep-linkable.
- **A11y:** on room change, move focus to the room heading and `aria-live` announce the room name (screen-reader users otherwise get no route announcement).

### 4.2 Responsive layout (autoFit parity)

`autoFit()` picked mobile when `innerWidth <= 640` **OR** (`innerWidth < 900` **&&** portrait). A single `max-width:640px` query would drop the 641–899px tablet-held-upright case. Ship **both** conditions applying the `.mobile` layout:

```css
@media (max-width: 640px) { /* .mobile layout */ }
@media (max-width: 899px) and (orientation: portrait) { /* .mobile layout */ }
```

Verify on iPad portrait during pixel-diff.

### 4.3 Motion & reduced-motion

Port `--ease: cubic-bezier(.72,0,.18,1)`, the `0.68s` slide, `0.6s` nav-dock transition, `24s` Ken-Burns `@keyframes kb`, and `1.6s` scroll-hint `bob` **verbatim**. Under reduced motion, disable *all three*, not just the slide:

```css
@media (prefers-reduced-motion: reduce) {
  .track { transition: none; }        /* opacity fade instead of slide */
  .hero { animation: none; }          /* kill Ken-Burns */
  .scroll-hint { animation: none; }   /* kill bob */
}
```

Nav active state swaps `-white.gif → -mustard.gif` (**asset swap, not a CSS filter**); nav art keeps its baked color and is unaffected by `design.accent`.

---

## 5. Data fetching, preview & the one-click publish story

### 5.1 Clients & fetch wrapper

`lib/sanity/client.ts` exposes a CDN client (`useCdn:true`, public env) for production reads and a token'd preview client (`SANITY_API_READ_TOKEN`, `useCdn:false`, `perspective:'previewDrafts'`) for drafts. `lib/sanity/fetch.ts` `sanityFetch(query, params, {tags})`:

- inspects Next `draftMode()` — **enabled** → token'd preview client, no cache; **disabled** → CDN client with `next: { tags, revalidate: false }` so pages are static until a tag is invalidated.

### 5.2 Cache tags & revalidation

One tag per document `_type` (`siteSettings`, `homePage`, `aboutPage`, `tourPage`, `musicPage`, `contactPage`, `blogPage`, `blogPost`) plus `shopify-products` and `bandsintown-shows`. The `/` fetch attaches **all** page-content tags. A Sanity **on-publish webhook** → `POST /api/revalidate` → `parseBody` verifies the signature → `revalidateTag(body._type)`. So editing e.g. the About hero republishes and only `aboutPage`-tagged output refreshes; no full rebuild.

Shopify/Bandsintown carry their **own** tags with time-based revalidate as a backstop (products `~600s`, shows `~900s`); there is no webhook to bust them on stock/show change. **Documented staleness:** a grid can be up to ~600s stale, so `availableForSale` shown in SSR may be wrong at add time — see §6.4 for the client-side re-check at `cartCreate`.

### 5.3 Live preview (replaces the postMessage bridge)

Use the Sanity **Presentation** tool in `sanity.config.ts` with `previewUrl → /api/draft-mode/enable`. Editors open Presentation, which loads `/` in an iframe in draft mode; `sanityFetch` detects `draftMode()` and returns unpublished draft content, live-reloading via `next-sanity`'s `useLiveMode` / `<VisualEditing/>` (enabled in the root layout **only when draftMode is on**). This gives real live preview + click-to-edit overlays, reuses the same RSC render path (preview == production), and eliminates the bespoke `targetOrigin:'*'` `wendlo-config`/`wendlo-device`/`wendlo-goto` bridge and its origin-validation hole.

### 5.4 One-click publish (prototype PUBLISH parity — **accepted fix**)

The prototype gave the band a single mental model: edit a **draft**, hit **PUBLISH** once (draft → live), or **Discard**. Sanity's default publish is **per-document**, so editing 5 rooms would mean 5 publish clicks — a regression for a non-technical band.

**Fix:** ship a custom **"Publish all changed"** Studio action/tool (`src/sanity/actions/PublishAllChanged.tsx`, surfaced in `structure.ts`) that publishes every drafted singleton + post in one click, restoring the single global PUBLISH. Presentation still shows a clear per-doc publish affordance for granular control. **Call this UX change out to the band before cutover and train on it** (see §9).

The prototype's baked-defaults → `config-published.json` → `localStorage` precedence and `deepMerge` are fully replaced by Sanity as single source of truth. The only surviving "default" is empty-image → baked-asset, resolved in `lib/defaults` at render time.

---

## 6. Integration route designs

### 6.1 `/api/submit` (POST, Node) — contact + email pipeline

Single endpoint for `messageForm` + `emailForm`. **Order matters** (record-of-truth must not be lost):

1. **Rate-limit / idempotency (accepted fix).** `lib/ratelimit.ts` on **Vercel KV / Upstash**: per-IP + per-email sliding window, plus an idempotency key on the submission so a retried/replayed request is a no-op. Also enforce Turnstile token **single-use** server-side. Turnstile alone is not a rate limiter — a bot with fresh tokens could otherwise hammer Sheets/Mailchimp.
2. **Turnstile** `siteverify` (fail → 400, nothing else runs).
3. **Validate** fields vs `messageForm`/`emailForm` defs (name + email required, email regex).
4. **Google Sheets append** — timestamped row of ALL fields. **Must succeed or 5xx** (loud failure so no submission is silently lost).
5. **Mailchimp** upsert member `status:'pending'` (double opt-in), `name → FNAME`, `location`/`meal` → merge fields/tags (**email kind only**).
6. **Notification email** via provider, `Reply-To` = submitter (best-effort).
7. Return JSON `{ ok, successText }`.

**Env:** `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `TURNSTILE_SECRET_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID`, `EMAIL_PROVIDER_API_KEY`, `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`.

> **Google service-account footguns (accepted fix).** `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` is a PEM with newlines. `lib/env.ts` **must** normalize it (`replace(/\\n/g, '\n')`) or signing fails. The spreadsheet **must** be shared with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as Editor and the **Sheets API enabled** in the GCP project, or every append 403s. A startup/health check surfaces this early; the loud-5xx behavior is preserved.

### 6.2 `/api/proxy` (GET, Node) — hardened smart-link fetcher

Fetches a smart-link page's raw HTML for the Studio music importer.

- **Studio-session gated** (editor-only).
- **https-only**; hostname **allowlist**: `distrokid.com` + `*.distrokid.com`, `hyperfollow.com` + `*.hyperfollow.com`, `tunecore.com` + `*.tunecore.com`, `ffm.to`, `lnk.to` + `*.lnk.to`.
- **SSRF IP guard:** reject loopback/private/link-local/`169.254.169.254`/`::1`/`fc00::/7`; pin the resolved IP (DNS-rebinding-safe).
- **`redirect:'manual'`**, re-validating each `Location` host against the allowlist per hop.
- **3MB / 15s caps**, realistic UA, returns `text/plain` `no-store`.
- Parsing (`og:title`/`og:image` + 8 service regexes with HTML-entity decode) happens in the **Studio client**, so the server never fetches the extracted third-party URLs.
- **Drops** the prototype's public CORS-proxy fallbacks (allorigins/corsproxy).

> **Allowlist completeness (accepted fix).** Real DistroKid/TuneCore links can 302 through hops (`distrokid.com`, occasionally shortener domains). Manual re-validation hard-fails (400) on any legit hop not listed, silently breaking valid imports. Make **`PROXY_ALLOWED_HOSTS` the single source of truth**, **log rejected hops**, and confirm the real redirect chains during Phase 4 so Philip can widen the list **without a redeploy**.

### 6.3 `/api/submissions` (GET, Node) — Submissions inbox read (accepted fix)

`SubmissionsTool` cannot read Google Sheets from the Studio client without leaking creds. This route is **Sanity-session-gated**, does the Sheets **read server-side**, and returns tabbed rows to the tool (mark-read/reply-mailto/CSV export are client-side over this data). **Sheets creds never ship to the browser.** (v1 fallback if descoped: a linkout to the Google Sheet.)

### 6.4 Shopify — `lib/shopify.ts`

- **Server:** `products(first:24)` GROQ→GraphQL for the grid, cached tag `shopify-products` (`~600s`). Demo-grid fallback on error/unconfigured.
- **Client (`Cart.tsx`):** `cartCreate` mutation → `window.open(checkoutUrl)`. **Re-check `availableForSale` at `cartCreate`** (Shopify returns `userErrors`) so a sold-out variant added from a stale grid fails gracefully instead of checking out.
- Cart is **localStorage-only, client-only** — guard all `window`/`localStorage` access; don't server-render the cart badge/count (SSR hydration safety).
- **Env:** `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`, `NEXT_PUBLIC_SHOPIFY_API_VERSION`.

### 6.5 Bandsintown — `lib/bandsintown.ts`

`getUpcomingShows()`: `GET rest.bandsintown.com/artists/{artist}/events?app_id=&date=upcoming`, `revalidate ~900s`, tag `bandsintown-shows`, normalize empty/error → `emptyText`/`emptyLinkUrl` states. Called in `TourRoom` RSC (or via `/api/tour` if hydrated client-side). **Env:** `NEXT_PUBLIC_BANDSINTOWN_ARTIST_ID`, `NEXT_PUBLIC_BANDSINTOWN_APP_ID`.

### 6.6 `/api/revalidate` (POST, Node)

Verifies signature vs `SANITY_REVALIDATE_SECRET` (`parseBody` from `next-sanity/webhook`), rejects unsigned/invalid **before** revalidating, then `revalidateTag(body._type)`. Wired to a Sanity "on publish" webhook. **Env:** `SANITY_REVALIDATE_SECRET`.

### 6.7 `/api/draft-mode/enable` + `/disable` (GET, Node)

Presentation-tool live-preview toggle. `enable` validates the redirect + sets the `draftMode` cookie (`defineEnableDraftMode`); `disable` clears it. **Env:** `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN`.

---

## 7. Environment-variable manifest

| Name | Scope | Source | Provisioned by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | public | New Sanity project | Philip |
| `NEXT_PUBLIC_SANITY_DATASET` | public | `production` | Philip |
| `NEXT_PUBLIC_SANITY_API_VERSION` | public | Pinned date e.g. `2024-10-01` | Philip |
| `SANITY_API_READ_TOKEN` | server (secret) | Sanity manage → API tokens (Viewer) for draft/preview reads | Philip |
| `SANITY_REVALIDATE_SECRET` | server (secret) | Random secret, also set on the Sanity publish webhook | Philip |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | public | `fep1gx-a1.myshopify.com` (existing) | Philip (value known) |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | public | `13038a835c47c3e30b20f34cd745adfc` (existing public token) | Philip (value known); Band owns Shopify admin |
| `NEXT_PUBLIC_SHOPIFY_API_VERSION` | public | `2024-10` | Philip |
| `NEXT_PUBLIC_BANDSINTOWN_ARTIST_ID` | public | `id_14800723` (existing) | Philip |
| `NEXT_PUBLIC_BANDSINTOWN_APP_ID` | public | `e013532ece4ef52f851d48a4d3730c70` (existing public widget id) | Philip |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | New Cloudflare Turnstile widget | Philip |
| `TURNSTILE_SECRET_KEY` | server (secret) | Same Turnstile widget | Philip |
| `KV_REST_API_URL` | server (non-secret) | Vercel KV / Upstash Redis instance | Philip |
| `KV_REST_API_TOKEN` | server (secret) | Same KV / Upstash instance | Philip |
| `MAILCHIMP_API_KEY` | server (secret) | Mailchimp → Extras → API keys | Band (owner) provides; Philip installs |
| `MAILCHIMP_SERVER_PREFIX` | server (non-secret) | Datacenter suffix of API key e.g. `us21` | Philip (derives from key) |
| `MAILCHIMP_AUDIENCE_ID` | server (non-secret) | Mailchimp audience/list id | Band provides; Philip installs |
| `GOOGLE_SHEETS_ID` | server (non-secret) | Target spreadsheet id | Philip creates / Band owns Google account |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | server (secret-ish) | GCP service account `client_email` | Philip |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | server (secret) | GCP service account `private_key` (PEM, `\n`-escaped; **un-escaped in `lib/env.ts`**) | Philip |
| `EMAIL_PROVIDER_API_KEY` | server (secret) | Resend/Postmark/SendGrid account | Philip |
| `NOTIFY_EMAIL_TO` | server (non-secret) | `hello@wendlomusic.com` (band inbox) | Band confirms; Philip installs |
| `NOTIFY_EMAIL_FROM` | server (non-secret) | Verified sender on the domain | Philip (DNS/domain verify) |
| `PROXY_ALLOWED_HOSTS` | server (optional) | Comma list — **single source** for the smart-link allowlist | Philip |

---

## 8. Asset migration

| Asset(s) | Destination | Notes |
| --- | --- | --- |
| `assets/nav/{home,tour,contact,music,store}-white.gif` + `-mustard.gif` (10) | `/public/nav/` | **Fixed brand.** Active state swaps `-white → -mustard` (asset swap, NOT filter). Keep exact aspect-ratios. Not CMS-editable. |
| `assets/wendlo-logo.gif` | `/public/wendlo-logo.gif` (baked default) + `lib/defaults` | Default logo, CSS-inverted white. `design.logo` OVERRIDES it (custom shown as-is, drops invert). |
| `assets/click-here-white.gif`, `follow-along-white.gif` | `/public/` | Fixed decorative brand GIFs (home arrow; contact follow-along). Only their **enabled flags** are content; images not CMS-editable. |
| `assets/w-tile.png` | `/public/w-tile.png` | **Fixed brand.** Wired as favicon + OG/social tile in root metadata. Not content. |
| `assets/home.jpg`, `about.jpg`, `shows.jpg` | `/public/defaults/` (baked) via `lib/defaults` | Baked hero DEFAULTS when the Sanity `heroImage.image` is empty. The hero slots become Sanity images with dual focal points. |
| `assets/stripes.jpg` | `/public/defaults/stripes.jpg` (baked) + `design.stripes` override | Default music/store/contact/blog background; overridable. |
| `assets/contactv2.png` | `/public/defaults/contactv2.png` (baked) + `contact.polaroids` override | Default polaroid collage; overridable. |
| `assets/art-{untethered,mustbenice,wasting,shadow,downtown}.jpg` (5) | Sanity image assets (seeded) on the 5 `songEntry.art` fields | Become CMS content per song; seed uploads them so Studio opens populated. Future songs auto-fill art from smart-link `og:image`. |
| `assets/about.jpg` (doubles as blog p1 cover) | Sanity image asset on the seeded `blogPost.cover` | Same file referenced as the sample post cover. |
| `assets/nav/*-persimmon.gif` (5), `logo-white.gif`, `logo-white.png`, `get-in-touch-white.gif`, `contact.jpg`, `bg-general.jpg`, w-tile duplicates, `.DS_Store` | **DROP (do not ship)** | Orphaned/unused/superseded. `logo-white.png` was an OG candidate but `w-tile.png` is the chosen tile; keep the repo clean. |

---

## 9. What we need from the band / accounts to provision

**This section can start in parallel with development — several items gate cutover, so kick them off now.**

| # | Item | Owner | Why it's needed |
| --- | --- | --- | --- |
| 1 | Create Sanity project + production dataset; generate Viewer read token; set publish webhook with shared secret | **Philip** | Backs the whole CMS, Studio auth, preview, ISR. |
| 2 | Add band members as Sanity Studio users (real auth replaces `passHash`) | Philip invites; **Band** accepts | Self-editing access. |
| 3 | **Mailchimp** API key + audience id + confirm the audience is double-opt-in | **Band** (owner) provides; Philip installs | Email-list signups; server prefix derived from key. |
| 4 | **Google Cloud** service account (JSON: `client_email` + `private_key`), **enable the Sheets API**, create the submissions spreadsheet, **share it with the service-account email as Editor** | Philip creates; Band Google account may own the sheet | Durable submission record + Submissions tool. *(Un-escape the PEM `\n`; a 403 here means the sheet wasn't shared or the API isn't enabled.)* |
| 5 | **Cloudflare Turnstile** widget (site + secret keys) for `wendlomusic.com` | **Philip** | Spam protection on both forms; server `siteverify`. |
| 6 | **Vercel KV / Upstash Redis** instance (URL + token) | **Philip** | Durable per-IP/per-email rate-limit + idempotency for `/api/submit` (stack has no SQL). |
| 7 | Transactional email provider (Resend/Postmark/SendGrid) + **verify sending domain** (SPF/DKIM DNS) | **Philip** (DNS) | Band notification emails; `Reply-To` submitter. |
| 8 | Confirm band notification inbox (`hello@wendlomusic.com`) + licensing contact | **Band** confirms | `NOTIFY_EMAIL_TO` + contact-page content. |
| 9 | **Shopify:** confirm the existing public Storefront token/domain still valid; grant admin link | Band owns Shopify; Philip installs env | Merch grid + checkout. |
| 10 | **Adobe Fonts (Typekit)** kit for Proxima Nova license | Band/Philip (licensing) | True pixel fidelity vs the Montserrat stand-in. |
| 11 | Vercel project + set all env vars (prod + preview) + connect the Git repo | **Philip** | Hosting + build. |
| 12 | DNS cutover of `wendlomusic.com` to Vercel | **Philip** (registrar) | Go-live. |
| 13 | **Confirm the publish-UX change** — global "Publish all changed" button + brief training | Philip demos; **Band** signs off | Preserves the prototype's one-click publish mental model before cutover. |

---

## 10. Build phases (dependency-ordered)

### Phase 0 — Scaffold
*Goal: running Next.js + TS app on Vercel with the design-token foundation. Depends on: —*

- [ ] `create-next-app` (App Router, TS, no Tailwind — plain CSS / CSS-modules).
- [ ] Port `styles/tokens.css` (colors, `--ease`, radii, shadows) + globals **verbatim** from the prototype.
- [ ] Wire `next/font`: Fraunces (display) self-hosted; Montserrat as the Proxima Nova fallback until the Adobe kit is added.
- [ ] Set up `.env.example` + `lib/env.ts` validation (incl. the Google PEM `\n` un-escape); commit `.gitignore`.
- [ ] Deploy the empty shell to a Vercel preview to confirm the pipeline.

### Phase 1 — Schema + Studio
*Goal: embedded Studio at `/studio` with the full content model + custom inputs; dataset seeded to match the prototype exactly. Depends on: 0; Sanity project (§9).*

- [ ] Author all document + object schemas (`siteSettings`, page singletons, `blogPost`, and objects incl. `heroImage` dual-focal, `listenLink`, `songEntry`/`youtubeEntry`, `socialLink`, `contactForm`/`formField`, `navPage`, `designSettings`, `connectionSettings`). **Confirm `musicPage.services` ships** (matrix ordering depends on it).
- [ ] Add validation: `home` locked enabled, exactly-7 `pageId`s, `announcement.page` must be an **enabled** page, `isTextLabel` gates `label` editability.
- [ ] Mount `NextStudio` at `/studio`; configure `structure` (singletons + `blogPost` list) + Presentation tool.
- [ ] Build custom inputs: `DualFocalInput`, `ListenLinkMatrix`, `YouTubeUrlInput`, `AccentColorInput`, `NavManagerInput`.
- [ ] Build the **"Publish all changed"** document action/tool (one-click global publish).
- [ ] Write `scripts/seed.ts`: upload album art + default heroes as image assets, `htmlToBlocks` the sample blog post, create the 6 music entries + socials + form defs from `WENDLO_DEFAULTS`. Run it.
- [ ] Custom Dashboard tool (read-only stats / health).

### Phase 2 — Design system + layout shell
*Goal: pixel-faithful horizontal-rooms shell, moving nav, hero focal system, responsive via CSS. Depends on: 0 (tokens). Parallel to 1.*

- [ ] Root layout + `generateMetadata` from `siteSettings`; favicon `/w-tile.png`; announcement bar.
- [ ] Client `Shell`: translateX track + `go(page)`; moving nav dock (bottom↔side); GIF nav links with `-white/-mustard` swap; reduced-motion fallback; **Ken-Burns on home only**; **hash-as-source-of-truth** deep-linking (instant initial transform, history push per `go`, disabled/unknown-id guard, focus + `aria-live` on room change).
- [ ] Hero component consuming `heroImage` → inline `--focal`/`--focal-m` via `lib/sanity/image` + `lib/defaults` fallback.
- [ ] Translate `.device.mobile` overrides to **two** media queries — `@media (max-width:640px)` **and** `@media (max-width:899px) and (orientation:portrait)` — so the correct layout is SSR'd (replaces `autoFit`). Mobile FAB + nav sheet.
- [ ] Add `prefers-reduced-motion` rules that also kill Ken-Burns (`.hero`) and bob (`.scroll-hint`).

### Phase 3 — Rooms / pages
*Goal: all 7 rooms rendering real Sanity content. Depends on: 1 (schema+seed), 2 (shell).*

- [ ] Home / About / Contact server rooms from singletons (`ContactSheet` client for forms).
- [ ] `MusicRoom`: iterate `entries`, alternating song cards + YouTube embeds (`youtube-nocookie`); listen links from `services` order + `enabled && url`.
- [ ] `BlogRoom`: `published` + `date`-desc list, article view, Portable Text via `@portabletext/react` (no `innerHTML`).
- [ ] `TourRoom` + `ShowsPanel` (Bandsintown) and `StoreRoom` + `StoreGrid`/`Cart` (Shopify) — data wired in Phase 4.
- [ ] **Store accessibility (designed now, not deferred):** the whole card opens the lightbox on tap/Enter (lightbox already has full keyboard nav); segment dots are tappable on touch; hover-scrub is a pure desktop-pointer enhancement layered on the accessible base.
- [ ] Pin locale/timezone (or format server-side) for blog dates + product prices to avoid hydration mismatches.

### Phase 4 — Integrations
*Goal: live data + forms + spam protection wired server-side. Depends on: 3; all integration accounts (§9).*

- [ ] `lib/shopify` (server products, client `cartCreate` with `availableForSale` re-check) + demo fallback; `lib/bandsintown` server helper.
- [ ] `/api/submit` pipeline (**KV rate-limit/idempotency → Turnstile → validate → Sheets → Mailchimp → notify**); `ContactSheet` renders Turnstile + posts to it. Add the Google Sheets startup/health check.
- [ ] `/api/proxy` hardened + `SmartLinkImportAction` + Re-import in Studio. **Confirm real DistroKid/TuneCore redirect chains against the allowlist; log rejected hops; make `PROXY_ALLOWED_HOSTS` the source of truth.**
- [ ] `TestConnectionInput` actions (Shopify / Bandsintown / webhook).

### Phase 5 — Preview + publish
*Goal: Sanity Presentation live preview + tag-based ISR replacing the postMessage bridge. Depends on: 1, 3.*

- [ ] `sanityFetch` draftMode-aware; `<VisualEditing/>` gated on draftMode in the layout.
- [ ] `/api/draft-mode/enable` + `/disable`; Presentation `previewUrl` config.
- [ ] `/api/revalidate` + Sanity publish webhook; verify tag invalidation per `_type`.
- [ ] `/api/submissions` (Studio-session-gated Sheets read) + `SubmissionsTool` (tabs, mark-read, mailto reply, CSV export). **Creds never reach the client.**

### Phase 6 — Deploy / cutover
*Goal: production on Vercel at wendlomusic.com. Depends on: all.*

- [ ] Set all env vars in Vercel (prod + preview scopes).
- [ ] Adobe Fonts kit for real Proxima Nova (swap the Montserrat fallback).
- [ ] Final pixel-diff QA vs the prototype at desktop **and** mobile, **incl. iPad portrait** (tablet-portrait branch); reduced-motion + a11y (keyboard/touch store gallery, focus/`aria-live` on room change).
- [ ] DNS cutover to Vercel; `noindex` `/studio`; smoke-test forms end-to-end (real Turnstile + Sheets row + Mailchimp pending email + band notification).
- [ ] **Demo the "Publish all changed" button + brief the band on the per-doc-vs-global publish model.**

---

## 11. Open decisions (with recommendations)

| Decision | Recommendation | Rationale |
| --- | --- | --- |
| Embedded Studio (`/studio`) vs separate deployment | **Embedded at `/studio`** | One Vercel deploy, one repo, shared types; Presentation previews the same origin (simpler draft-mode + CSP). Separate hosting only helps if editors need Studio while the site build is broken — not worth the split. |
| Hero focal storage | **Explicit dual `focalDesktop`/`focalMobile` strings** via `DualFocalInput` (hotspot kept only to seed desktop) | Tour needs two independent positions (desktop `50%` vs mobile `24% 42%`); native hotspot stores one. Two CSS strings map 1:1 to `--focal`/`--focal-m` with zero render-time math. |
| Page ordering + enable/label | **Single ordered `navPage` array** on `siteSettings`, `NavManagerInput`, validation locking `home` + the fixed 7 ids | Array order IS nav order (matches the drag-reorder console), collapses order/enabled/labels into one place, avoids the wholesale-override footgun, and prevents adding pages with no GIF art. |
| Album art: Sanity field vs scrape-at-render | **Sanity image field, auto-populated on import** (og:image uploaded as a Sanity asset), still overridable | Durability + CDN + hotspot come free; render-time scraping would break if the smart link dies and reintroduces CORS/SSRF at read time. |
| Blog body: HTML string vs Portable Text | **Portable Text** (`normal/h3/blockquote`; `strong/em/link`) via `@portabletext/react` | Eliminates the `dangerouslySetInnerHTML`/regex-strip XSS risk, gives a real rich-text editor, matches the actual formatting surface. Migrate the one post via `htmlToBlocks` at seed. |
| Live preview: postMessage bridge vs Presentation | **Presentation + `draftMode()` + `<VisualEditing/>`** | The bridge uses `targetOrigin:'*'` with no origin checks (a real vuln) and can't survive SSR. Presentation gives origin-safe live preview with click-to-edit and reuses the RSC render path (preview == production). |
| Publish UX | **Add a custom "Publish all changed" action** alongside per-doc publish | Restores the prototype's single global PUBLISH mental model for a non-technical band while keeping Sanity's granular control. |
| Integration secrets/config: CMS vs env | **Env for all secrets + public-but-infra values;** CMS keeps only the two contact webhook URLs + optional self-edit Shopify/Bandsintown overrides | Keeps rotation/security in Vercel, avoids the band pasting tokens into content. The webhook URLs are the only genuinely band-owned connection values with no better home. |
| Store data: client fetch vs server RSC | **Server RSC for the product grid** (cached/tagged/SEO); cart stays client | Grid benefits from SSR + ISR and keeps the myshopify domain out of first markup; cart inherently needs the browser (localStorage). Token is public either way. |
| Submissions: mirror into Sanity vs Sheets-only | **Sheets as record-of-truth; Submissions tool reads via `/api/submissions`** | Band actions are only read/mark-read/reply/export — a Sheets-backed tool covers them without polluting the content dataset or duplicating PII. |
| Rooms: one `/` client scroller vs per-room routes | **Single `/` route with a client `Shell`;** rooms are RSCs inside it; hash is source of truth | The signature horizontal slider is one continuous `%`-measured track; real route transitions would destroy the slide + shared nav. SSR the room content for SEO/first-paint; keep only the transform client-side; hash enables shareable deep links. |
| Rate-limit / idempotency store | **Vercel KV / Upstash Redis** | The stack has no SQL; a durable per-IP/per-email sliding window + idempotency key is required because Turnstile (single-use tokens) is not a rate limiter. |

---

## 12. Risks & fidelity watch-list

- **Pixel fidelity** depends on reproducing exact `clamp()` expressions, `--ease: cubic-bezier(.72,0,.18,1)`, the `24s` Ken-Burns `kb` keyframes, `0.68s` slide and `0.6s` nav-dock transitions verbatim; rounding to a token scale breaks the bespoke feel. Do a side-by-side pixel-diff at desktop + mobile + **iPad portrait**.
- **Layout mode** was JS-selected (`autoFit`: `innerWidth<=640` OR `innerWidth<900 && portrait`). The two-query CSS port must include the `(max-width:899px) and (orientation:portrait)` branch or tablet-portrait regresses.
- **Dual focal point** isn't natively expressible by Sanity's single hotspot — `DualFocalInput` must reliably capture the second click, or the mobile crop (esp. tour `24% 42%`) regresses to hotspot-only.
- **Blog HTML→Portable Text** (`htmlToBlocks`) can lose/mangle marks; verify the sample post renders identically and set the editor expectation that body is now block content.
- **`/api/proxy`** is the main security surface: allowlist + SSRF IP guard + manual redirect re-validation + Studio-session gate must all be present; drop the public CORS-proxy fallbacks entirely; log rejected hops so the allowlist can be widened safely.
- **Google Sheets append** is the record-of-truth and must **fail loudly (5xx)**; Mailchimp/notify are best-effort; ordering in `/api/submit` matters (rate-limit + Turnstile first). Watch the PEM `\n` un-escape and the sheet-sharing/API-enable footguns.
- **Shopify `availableForSale`/stock and Bandsintown shows** are point-in-time — products `~600s` / shows `~900s` stale windows plus tag invalidation; keep the demo/empty fallbacks and re-check `availableForSale` at `cartCreate`.
- **Cart** is localStorage-only/client-only — guard all `window`/`localStorage` access; don't SSR the cart badge.
- **`toLocaleDateString`/Intl currency** can hydration-mismatch unless locale/timezone is pinned or formatted server-side.
- **Proxima Nova** needs an Adobe Fonts license; Montserrat is a near-identical stand-in until then — flag the visual delta.
- **Publish UX change** (per-doc + global "Publish all") is a behavior change for the band — confirm and train before cutover.
- **Store gallery a11y** — hover-scrub/segment-dots were pointer-only; the tap/Enter→lightbox base and touch-tappable dots must be built in Phase 3, not left to QA.
