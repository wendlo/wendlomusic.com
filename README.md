# wendlomusic.com

The Wendlo website: a horizontal "rooms" site (home · tour · contact · music · store · blog)
with an on-site cart backed by Shopify, tour dates from Bandsintown, and a band console
for editing everything with a live preview.

## Layout

| Path | What it is |
|---|---|
| `prototype/` | **The deployable site** — static HTML/JS + one serverless function. Vercel Root Directory points here. |
| `prototype/admin/` | The band console (edit content, images, music, blog; see submissions). Default password `wendlo` — change it in Settings. |
| `prototype/README-DEPLOY.md` | Deploying + how to publish content changes to the live site. |
| `serve.py` | Local dev server (static + `/proxy` for the music smart-link importer). |
| `CONTENT-INVENTORY.md` | Audit of the old Squarespace site this replaces. |

## Local development

```bash
python3 serve.py 8000
# site:    http://localhost:8000/prototype/
# console: http://localhost:8000/prototype/admin/
```

## Updating the live site

Short version: edit in the console → **Settings → Download live-site file** → replace
`prototype/config-published.json` → commit + push (Vercel auto-deploys).
Full details in [prototype/README-DEPLOY.md](prototype/README-DEPLOY.md).
