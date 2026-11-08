/**
 * One-off migration: give the home page today's two doodles (the "click here"
 * GIF + the "join our email list!" link) as editable `doodles` items, so the
 * band starts from exactly what the site shows now (LEGACY_DOODLES).
 *
 * Run manually, never in the build / CI:
 *   cd web && npx tsx scripts/migrate-doodles.ts           # dry run (no writes)
 *   cd web && npx tsx scripts/migrate-doodles.ts --apply   # upload GIF + patch
 *
 * Env comes from the shell, else web/.env.local:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
 *   NEXT_PUBLIC_SANITY_API_VERSION, and a token — SANITY_API_WRITE_TOKEN
 *   (required for --apply; a dry run also accepts SANITY_API_READ_TOKEN, which
 *   it needs to see the draft).
 *
 * What it does, for `homePage` and `drafts.homePage` (the draft only if one
 * exists — otherwise publishing it later would drop the doodles):
 *   - doc has no `doodles` field → set doodles to the legacy pair;
 *   - doc already has a `doodles` array → left alone (never overwritten). An
 *     EMPTY array is the band's choice ("no doodles"), as in map.ts.
 * The patches are one transaction, each guarded by the revision it was read
 * at, so an edit made in the Studio meanwhile makes the run fail instead of
 * being clobbered (just re-run). Legacy fields (emailCtaEnabled, emailCtaText,
 * clickHereEnabled) are left untouched. Re-running after success is a no-op.
 *
 * The dry run never uploads: it looks the GIF up by its content hash and
 * prints the asset it would create or reuse.
 */

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@sanity/client';
import {
  CLICK_HERE_SIZE,
  CLICK_HERE_SRC,
  LEGACY_DOODLES,
  type Doodle,
  type DoodleLink,
  type DoodlePlacement,
} from '../src/lib/doodles';

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

const ROOT = resolve(__dirname, '..');
const ENV_FILE = join(ROOT, '.env.local');
// Shell values win over the file (loadEnvFile never overrides).
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== '--apply');
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(' ')}\nUsage: npx tsx scripts/migrate-doodles.ts [--apply]`);
  process.exit(1);
}
const APPLY = args.includes('--apply');

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || '2024-10-01';
const writeToken = process.env.SANITY_API_WRITE_TOKEN?.trim();
const token = APPLY ? writeToken : writeToken || process.env.SANITY_API_READ_TOKEN?.trim();

if (!projectId) {
  console.error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID');
  process.exit(1);
}
if (!token) {
  console.error(
    APPLY
      ? 'Missing SANITY_API_WRITE_TOKEN (needs write access)'
      : 'Missing SANITY_API_WRITE_TOKEN or SANITY_API_READ_TOKEN (needed to read the draft)',
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });

const GIF_PATH = join(ROOT, 'public', CLICK_HERE_SRC.replace(/^\//, ''));
const TARGET_IDS = ['homePage', 'drafts.homePage'] as const;

/* ------------------------------------------------------------------ *
 * Model → Sanity shapes (schema types doodleImage / doodleText /
 * doodleLink / doodlePlacement)
 * ------------------------------------------------------------------ */

interface SanityPlacement extends DoodlePlacement {
  _type: 'doodlePlacement';
  hidden: boolean;
}
interface SanityLink {
  _type: 'doodleLink';
  kind: DoodleLink['kind'];
  page?: string;
  url?: string;
}
interface SanityDoodleBase {
  _key: string;
  shadow: boolean;
  link: SanityLink;
  desktop: SanityPlacement;
  phone: SanityPlacement;
}
interface SanityDoodleImage extends SanityDoodleBase {
  _type: 'doodleImage';
  image: { _type: 'image'; asset: { _type: 'reference'; _ref: string } };
  alt: string;
}
interface SanityDoodleText extends SanityDoodleBase {
  _type: 'doodleText';
  text: string;
  color: string;
}
type SanityDoodle = SanityDoodleImage | SanityDoodleText;

const placement = (p: DoodlePlacement): SanityPlacement => ({
  _type: 'doodlePlacement',
  x: p.x,
  y: p.y,
  w: p.w,
  rot: p.rot,
  hidden: p.hidden ?? false,
});

const link = (l: DoodleLink): SanityLink => ({
  _type: 'doodleLink',
  kind: l.kind,
  ...(l.page ? { page: l.page } : {}),
  ...(l.url ? { url: l.url } : {}),
});

/** LEGACY_DOODLES as stored in Sanity; image items point at `gifAssetId`. */
function legacyDoodles(gifAssetId: string): SanityDoodle[] {
  return LEGACY_DOODLES.map((d: Doodle): SanityDoodle => {
    const common = {
      shadow: d.shadow,
      link: link(d.link),
      desktop: placement(d.desktop),
      phone: placement(d.phone),
    };
    if (d.kind === 'image') {
      if (d.src !== CLICK_HERE_SRC) {
        throw new Error(`Legacy image ${d._key} is not ${CLICK_HERE_SRC}; only that GIF is migrated.`);
      }
      return {
        _type: 'doodleImage',
        _key: d._key,
        image: { _type: 'image', asset: { _type: 'reference', _ref: gifAssetId } },
        alt: d.alt,
        ...common,
      };
    }
    return { _type: 'doodleText', _key: d._key, text: d.text, color: d.color, ...common };
  });
}

/* ------------------------------------------------------------------ *
 * GIF asset
 * ------------------------------------------------------------------ */

interface GifInfo {
  sha1: string;
  width: number;
  height: number;
  /** id Sanity gives an image asset: image-<sha1>-<W>x<H>-<ext> */
  expectedId: string;
}

function readGif(): GifInfo {
  if (!existsSync(GIF_PATH)) throw new Error(`Missing ${GIF_PATH}`);
  const buf = readFileSync(GIF_PATH);
  if (buf.toString('ascii', 0, 3) !== 'GIF') throw new Error(`${GIF_PATH} is not a GIF`);
  // GIF logical screen size: little-endian uint16s at bytes 6 and 8.
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  if (width !== CLICK_HERE_SIZE.width || height !== CLICK_HERE_SIZE.height) {
    console.warn(
      `  ! GIF is ${width}x${height}, LEGACY_DOODLES assumes ${CLICK_HERE_SIZE.width}x${CLICK_HERE_SIZE.height}`,
    );
  }
  const sha1 = createHash('sha1').update(buf).digest('hex');
  return { sha1, width, height, expectedId: `image-${sha1}-${width}x${height}-gif` };
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

interface TargetDoc {
  _id: string;
  _rev: string;
  /** null = field missing */
  doodleCount: number | null;
  emailCtaEnabled?: boolean;
  emailCtaText?: string;
  clickHereEnabled?: boolean;
}

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — project ${projectId} / dataset ${dataset}\n`);

  const gif = readGif();
  const existing = await client.fetch<{ _id: string } | null>(
    `*[_type == "sanity.imageAsset" && sha1hash == $sha1][0]{_id}`,
    { sha1: gif.sha1 },
  );

  // The raw perspective is what makes drafts.* ids visible to the query.
  const docs = await client.fetch<TargetDoc[]>(
    `*[_id in $ids]{_id, _rev, "doodleCount": count(doodles), emailCtaEnabled, emailCtaText, clickHereEnabled}`,
    { ids: [...TARGET_IDS] },
    { perspective: 'raw' },
  );
  const byId = new Map(docs.map((d) => [d._id, d]));

  const toPatch: TargetDoc[] = [];
  for (const id of TARGET_IDS) {
    const doc = byId.get(id);
    if (!doc) {
      console.log(`- ${id}: does not exist → skipped${id === 'homePage' ? ' (nothing is created)' : ''}`);
      continue;
    }
    const legacy = `legacy fields: emailCtaEnabled=${String(doc.emailCtaEnabled)}, emailCtaText=${JSON.stringify(doc.emailCtaText ?? null)}, clickHereEnabled=${String(doc.clickHereEnabled)} (left as-is)`;
    if (doc.doodleCount !== null) {
      console.log(`- ${id}: already has its own doodles (${doc.doodleCount}) → left alone\n    ${legacy}`);
      continue;
    }
    console.log(
      `- ${id}: doodles missing → ${APPLY ? 'will set' : 'would set'} ${LEGACY_DOODLES.length} doodles (rev ${doc._rev})\n    ${legacy}`,
    );
    toPatch.push(doc);
  }

  if (!toPatch.length) {
    console.log('\nNothing to do.');
    return;
  }

  if (!APPLY) {
    console.log(
      existing
        ? `\nAsset: ${CLICK_HERE_SRC} is already in the dataset as ${existing._id} → would reuse it.`
        : `\nAsset: would upload ${CLICK_HERE_SRC} (${gif.width}x${gif.height}, sha1 ${gif.sha1}) → expected id ${gif.expectedId}.`,
    );
    const planned = legacyDoodles(existing?._id ?? gif.expectedId);
    console.log(`\nWould set \`doodles\` on ${toPatch.map((d) => d._id).join(' + ')} to:\n`);
    console.log(JSON.stringify(planned, null, 2));
    console.log('\nDry run only — nothing was written. Re-run with --apply to perform it.');
    return;
  }

  let assetId = existing?._id;
  if (assetId) {
    console.log(`\nAsset: reusing ${assetId}`);
  } else {
    // Content-addressed: re-uploading the same file returns the same asset.
    const asset = await client.assets.upload('image', createReadStream(GIF_PATH), {
      filename: CLICK_HERE_SRC.split('/').pop(),
    });
    assetId = asset._id;
    console.log(`\nAsset: uploaded ${CLICK_HERE_SRC} → ${assetId}`);
  }

  const doodles = legacyDoodles(assetId);
  const tx = client.transaction();
  for (const doc of toPatch) {
    tx.patch(doc._id, (p) => p.ifRevisionId(doc._rev).set({ doodles }));
  }
  await tx.commit({ autoGenerateArrayKeys: false });

  console.log(`\n✓ Set doodles on ${toPatch.map((d) => d._id).join(' + ')}.`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nMigration failed: ${msg}`);
  if (/revision/i.test(msg)) {
    console.error('The home page was edited while this ran — nothing was changed. Run it again.');
  }
  process.exit(1);
});
