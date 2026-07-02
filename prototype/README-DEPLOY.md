# Deploying wendlomusic.com (prototype) to Vercel

This folder (`prototype/`) is a self-contained deployable site: static HTML/JS/assets
plus one serverless function (`api/proxy.js`, used by the admin console's
DistroKid/TuneCore importer). No build step.

## Deploy

**Option A — Vercel CLI**
```bash
cd prototype
npx vercel          # preview deploy
npx vercel --prod   # production
```

**Option B — git integration (recommended)**
Push this repo to GitHub → import in Vercel → set **Root Directory = `prototype`**.
Every push then auto-deploys, including content updates (see below).

## How the band updates the LIVE site

The console (`/admin/`, default password `wendlo` — change it in Settings) edits and
previews everything, but its **Publish button only affects the browser it runs in**.
The deployed site's content for everyone comes from **`config-published.json`**.

To push content live:
1. Edit + Publish in the console until the preview looks right.
2. **Settings → Backup & restore → “Download live-site file”** (downloads `config-published.json`).
3. Replace `prototype/config-published.json` with it and redeploy
   (with git integration: commit + push = live).

Content precedence on the site: baked defaults → `config-published.json` → the
current browser's local publishes (so the band still sees their local work-in-progress).

## Things to know before going public

- **Console password:** client-side only, and meant as a speed bump, not real auth.
  Change it from `wendlo` in Settings. Anyone can open `/admin/`, but they can only
  affect their own browser — never the live site.
- **`config-published.json` is world-readable.** The live-site export strips the
  password hash automatically. Webhook URLs (Apps Script/Mailchimp bridges) in it are
  visible to anyone who looks — they're unguessable but treat them as semi-public.
- **Form submissions** land in the visitor's browser + the configured webhooks
  (Connections section). Without webhooks set, deployed submissions go nowhere the
  band can see — set the webhooks before launch.
- **Shopify Storefront token + Bandsintown app_id** in the config are public-by-design
  tokens; fine to ship.
- This whole setup is the **prototype architecture**. The production build
  (Next.js + Sanity) replaces the file-based publish with a real CMS backend;
  the console UX carries over as its spec.

## Local development

```bash
cd wendlomusic.com-refresh
python3 serve.py 8000
```
Site: http://localhost:8000/prototype/ · Console: http://localhost:8000/prototype/admin/
(`serve.py` provides the same `/proxy` endpoint the Vercel function provides in production.)
