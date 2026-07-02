# Wendlo Music — Content Inventory & IA Map

_Audit of the mirrored Squarespace site (`www.wendlomusic.com/`), to seed the Next.js + Sanity + Shopify + Mailchimp rebuild. Generated 2026-06-29._

## TL;DR

The old site is a Squarespace **"Adirondack"** template that's ~90% unedited demo cruft (Lorem ipsum, `123 Street Avenue`, demo blog posts, a fictional store-locator, five home drafts). The **genuinely valuable content is narrow**:

- ~10 song blurbs in the band's voice + their streaming links
- A real **contact** page (booking + licensing emails)
- The custom **email-list** form (name / email / location / best-meal / message)
- One real **chord-chart PDF** (`Must Be Nice!`)
- A hand-built but **unconfigured Shopify** merch scaffold
- The **social/streaming** identity (handles + IDs)

Everything else is duplicate or template boilerplate → kill.

---

## Keep / Kill / Merge

| Page | Action | Why |
|---|---|---|
| `contact.html` | **KEEP** | Real copy + booking email `wendlomusic@gmail.com` + licensing (Low Profile NYC). Strip placeholder text. |
| `email-list.html` | **KEEP** | The unique band-voice signup form → becomes the Mailchimp signup. Drop the leftover 2nd "Contact" form. |
| `merch.html` | **KEEP (concept)** | Real Store intent + Shopify Buy-SDK scaffold, but **demo mode**, no products. Rebuild on Shopify; discard recycled Contact cruft. |
| `s/Must-Be-Nice-CHART.pdf` | **KEEP** | The only real downloadable asset. Attach to the "Must Be Nice!" release. |
| `links.html` | **MERGE** | Linktree-style; no unique content. Replace with a reusable footer links component (+ optional slim `/links` route). Carry the chord-chart link. |
| `index.html` | **KILL** (harvest first) | "Home (Copy)" draft at root. Holds the real song blurbs+links — **harvest those**, then drop. |
| `home-copy.html` | **KILL** | Byte-identical duplicate of `index.html`. |
| `home-1.html` | **KILL** | Abandoned draft. Has the most complete nav — use it to reconstruct IA, then drop. |
| `home.html` | **KILL** | Near-empty stub ("This folder does not contain any pages"). |
| `hero-image.html` | **KILL** | Orphaned template page, 100% placeholder. |
| `follow.html` | **KILL** | Not a page — a wget capture of the external YouTube channel. Keep the channel link only. |
| `dates.html` | **KILL** | Empty Events collection (zero shows). Rebuild Shows fresh in Sanity. |
| `locations.html` | **KILL** | Store-locator template w/ Lorem ipsum + fake branches. Irrelevant for a band. |
| `images.html` | **KILL** | Empty gallery (0 photos). Rebuild if real photos exist. |
| `our-products.html` | **KILL** | Squarespace store demo (Lorem ipsum). Redundant with `merch.html`. |
| `blog-1.html` | **KILL** | Empty blog index. |
| `blog-adirondack.html` + `blog-adirondack/2016/...` + `/tag/...` | **KILL** | 3–4 demo posts (Lorem ipsum, author "Jacob Hamilton", 2016). Never used. |
| `read-me-adirondack.html` | **KILL** | Squarespace template help page. |
| `search.html` | **KILL** | Stock Squarespace search widget. Reimplement natively only if wanted. |
| `@format=rss`, `@author=…`, `@offset=…` files | **KILL** | wget URL-param artifacts, not real pages. |

---

## The real content worth preserving

### Discography (band-voice blurbs — harvest from `index.html`)
| Song | Note |
|---|---|
| **Untethered** | "Another love song… we all need to be grounded sometimes… in the arms of a loved one." |
| **Must Be Nice!** | "An ode to the people at the top who pay no mind to everyone else…" — has a downloadable chord chart |
| **Wasting Time With You** | "A lil existential love-ish song… 'what's all this other stuff for?? I just wanna hang out!'" |
| **September** | Cover of the Earth, Wind & Fire classic |
| **You Make My Dreams (Come True)** | Cover of Daryl Hall & John Oates |
| **Never Gonna Give You Up** (stories, feat. Wendlo) | Rick Astley cover — "this tender Rick-roll" |
| **Shadow** | "Started as a voice memo… took shape during quarantine after we watched Peter Pan." |
| **Broken Glass** | "A song about living with someone as imperfect as yourself… 'it beats waking up alone.'" |
| **Downtown** | "Growing up in Alaska, I had pictures of what moving to a big city would be like…" —Chelsea |
| **Sweet Sleep** | "Sometimes dreams blur into waking life…" |
| **Engagement Party EP** | Release (Apple Music id `1251092803`) |

### Social / streaming identity (for global footer + siteSettings)
- **Spotify** — artist `7Gv2m6LRpBmAheRectfl2E`
- **Apple Music** — artist `1251092804` (Engagement Party EP `id1251092803`)
- **SoundCloud** — `soundcloud.com/wendlo`
- **YouTube** — `@wendlo` (channel `UCKnxPDdWnKaxiboZKsxX-hQ`, ~18.5K subs)
- **Instagram** — `instagram.com/wendlomusic`
- **TikTok** — `tiktok.com/@wendlomusic` ⚠️ _one page had a bare `tiktok.com` link — confirm handle_
- **Facebook** — `facebook.com/wendlomusic`
- **Featured video** — "September [Official Video]" `youtube.com/embed/Dpzbv2AZ-dw`

### Contact / booking
- Primary: **wendlomusic@gmail.com** ("Booking, event inquiries, or love letters")
- Licensing: **Low Profile NYC** — yo@lowprofilenyc.com
- Form fields: Name / Email / Subject / Message

### Email-list form (preserve the playful copy)
- "What's your name?"
- "Do you have an email address?" (_"Also, do you exist?"_ · placeholder `under_score@hotmail.com`)
- "Where do you live?" (_"Be as specific as you would like"_ · "Full address, or just a postal code :)")
- "What's the best meal you've ever eaten?" (_Pro tip about Night + Market Song, Silverlake_)
- "Anything else to say?"

### Merch scaffold (`merch.html` + `assets/merch.js` + `assets/merch.css`)
- Shopify **Buy SDK**, **demo mode** — empty `domain` + `storefrontAccessToken`, no real products.
- Placeholder SKUs (confirm if these are the real lineup): Logo Tee $30, Tour Tee $32, Embroidered Hoodie $65, Vinyl LP $35, Cassette $12, Canvas Tote $25, Enamel Pin $10, Tour Poster $20.
- ⚠️ The Buy SDK is EOL — rebuild on the **Storefront API** or hosted Buy Buttons.

---

## Current nav (de-facto)
`Home · Music (Spotify/Apple/Soundcloud/Must Be Nice! Chords) · Dates · Store · Contact · Email List · Follow Along! · Info · Search`

## Proposed IA (rebuild)
1. **Home** — hero + featured release/video + streaming links + email-list CTA
2. **Music** — discography grid (blurb, cover art, players, streaming links; Must Be Nice! carries the chord-chart PDF)
3. **Shows** _(was "Dates")_ — Sanity-driven; ship hidden until real dates exist
4. **Merch** _(renamed from "Store")_ — Shopify storefront (Storefront API / Buy Buttons)
5. **Contact** — intro + Name/Email/Subject/Message form → `wendlomusic@gmail.com`; licensing note
6. **Email List** — Mailchimp signup w/ the custom band-voice fields
7. **Global footer** — social + streaming links component
8. _Optional:_ `/links` — slim "link in bio" route reusing the footer component
9. **Dropped:** Blog/News, Images gallery, Locations, Search, read-me, all home/store duplicates _(reintroduce blog/gallery fresh in Sanity only if the band commits)_

---

## Content types → Sanity schema hints
- **`release`** (song/album): title, slug, releaseType (single/EP/cover/video), coverArt, blurb, spotifyUrl, appleMusicUrl, soundcloudUrl, youtubeUrl, releaseDate, credits, downloads[] (chord chart), featured
- **`show`** (tour date): date, venue, city, country, ticketUrl, status (upcoming/past), notes — _empty at launch_
- **Merch**: source of truth is **Shopify** (don't model commerce in Sanity). Optional `merchHighlight` for curation: shopifyProductHandle, displayTitle, featured
- **`contactSettings`** (singleton): intro, bookingEmail, licensingLabel, licensingEmail
- **`emailListSettings`** (singleton): heading + field labels/microcopy (form wired to Mailchimp, not Sanity)
- **`siteSettings`** (singleton): siteTitle, logo, socials[] {platform, url}, navMenu[]
- **`galleryImage`** (future): image+alt, caption, order — _empty at launch_
- **`post`** (optional blog): title, slug, publishedAt, body (portable text), coverImage, tags — _build empty_

---

## Embeds / integrations to support
YouTube (featured video + channel link) · Spotify (artist + per-track) · Apple Music · SoundCloud · **Shopify** (Storefront API, replacing EOL Buy SDK) · **Mailchimp** (replacing Squarespace form blocks) · Instagram/TikTok/Facebook icon links. _Drop the Squarespace native search widget._

---

## Open questions for the band (feed these into the spec)
1. **Shows** — any real upcoming/past dates to seed, or ship the section hidden?
2. **Merch** — does a Shopify store exist yet? Need `.myshopify.com` domain + Storefront API token + real products/variants/prices/images. Are the scaffold SKUs the intended lineup?
3. **Email list** — which Mailchimp audience/list ID? How should non-standard fields (location, best-meal, message) map — merge fields, tags, or notes? Preserve the playful copy verbatim?
4. **Contact** — confirm form routes to `wendlomusic@gmail.com`; is Low Profile NYC (yo@lowprofilenyc.com) still the licensing contact?
5. **TikTok** — confirm the correct handle (`@wendlomusic`?).
6. **Blog/News** — want one at all? Who maintains it?
7. **Photo gallery** — real photos to populate, or omit for now?
8. **Discography completeness** — is the ~10-song list + Engagement Party EP the full catalog, or are there newer releases since this mirror?
9. **Link-in-bio** — keep a dedicated `/links` route (preserving the old URL), or footer-only?
10. **About/Bio** — there is **no** real bio/about content anywhere in the mirror. Want an About section? Need bio copy + a press photo.
11. **Redirects** — need a 301 map from old Squarespace URLs to the new IA (esp. `/store` → `/merch`).
