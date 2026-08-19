/**
 * SmartLinkImport — custom OBJECT input for songEntry (§6.2 importer).
 *
 * Wraps the default songEntry form (renderDefault) with an "Import from a
 * link" panel on top — the most robust Sanity v6 pattern for an object that
 * lives inside an array (document actions don't reach array items, and field
 * actions can't patch sibling fields; an object-level input can patch every
 * field of THIS song with relative paths).
 *
 * Flow (mirrors prototype/admin/sections/music.js openImportModal):
 * paste a HyperFollow/TuneCore URL → GET /api/proxy?url= (same-origin, with
 * the x-wendlo-import header) → parseSmartLink() in the browser → patch
 * title (only if empty) / links matrix (url + enabled per found service) /
 * source → pull og:image bytes THROUGH THE PROXY (never directly — the server
 * stays the only thing that talks to third parties) and upload them to Sanity
 * assets via useClient().assets.upload → set art. Found/not-found per service
 * and any errors render inline.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  set,
  useClient,
  type FormPatch,
  type ObjectInputProps,
} from 'sanity';

import {
  parseSmartLink,
  SMARTLINK_SERVICES,
  type SmartLinkService,
} from '@/lib/smartlink';
import { apiVersion } from '@/sanity/env';
import { SERVICE_IDS } from '@/sanity/schemas/objects/listenLink';

interface ListenLinkRow {
  _key: string;
  _type?: string;
  service?: string;
  url?: string;
  enabled?: boolean;
}

interface SongEntryValue {
  title?: string;
  links?: ListenLinkRow[];
  source?: string;
}

type ServiceStatus = Record<SmartLinkService, boolean>;

interface ImportOutcome {
  statuses: ServiceStatus;
  title?: string;
  artNote?: string;
}

function makeKey(service: string): string {
  return `${service}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Fetch a URL through our hardened same-origin proxy. */
async function fetchViaProxy(url: string): Promise<Response> {
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'x-wendlo-import': '1' },
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(detail || `Proxy responded ${res.status}`);
  }
  return res;
}

export default function SmartLinkImport(props: ObjectInputProps) {
  const { value, onChange, readOnly, renderDefault } = props;
  const song = (value ?? {}) as SongEntryValue;

  const client = useClient({ apiVersion });

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  const existingByService = useMemo(() => {
    const map = new Map<string, ListenLinkRow>();
    for (const row of Array.isArray(song.links) ? song.links : []) {
      if (row?.service && !map.has(row.service)) map.set(row.service, row);
    }
    return map;
  }, [song.links]);

  const runImport = useCallback(async () => {
    const trimmed = url.trim();
    setError(null);
    setOutcome(null);

    let source: URL;
    try {
      source = new URL(trimmed);
    } catch {
      setError('Paste a full link first (https://…).');
      return;
    }
    if (source.protocol !== 'https:') {
      setError('Only https:// links can be imported.');
      return;
    }

    setBusy(true);
    try {
      // 1. Fetch + parse the smart-link page (parsing stays in the browser).
      const html = await (await fetchViaProxy(source.href)).text();
      const parsed = parseSmartLink(html);

      const found = new Map(parsed.links.map((l) => [l.service, l.url]));
      const statuses = Object.fromEntries(
        SMARTLINK_SERVICES.map((s) => [s, found.has(s)]),
      ) as ServiceStatus;

      if (!found.size && !parsed.title && !parsed.artUrl) {
        throw new Error(
          'Nothing recognisable on that page — check the link, or fill the song in manually.',
        );
      }

      // 2. Patch this song's fields (paths are relative to this object).
      const patches: FormPatch[] = [];
      if (parsed.title && !song.title?.trim()) {
        patches.push(set(parsed.title, ['title']));
      }
      const rows: ListenLinkRow[] = SERVICE_IDS.map((service) => {
        const existing = existingByService.get(service);
        const foundUrl = found.get(service);
        return {
          _key: existing?._key ?? makeKey(service),
          _type: 'listenLink',
          service,
          url: foundUrl ?? existing?.url,
          enabled: foundUrl ? true : existing?.enabled === true,
        };
      });
      patches.push(set(rows, ['links']));
      patches.push(set(source.href, ['source']));
      onChange(patches);

      // 3. Artwork: pull the og:image bytes through the proxy (same-origin,
      //    never a direct third-party fetch) and upload to Sanity assets.
      let artNote: string | undefined;
      if (parsed.artUrl && /^https:\/\//i.test(parsed.artUrl)) {
        try {
          const artRes = await fetchViaProxy(parsed.artUrl);
          const contentType =
            artRes.headers.get('x-upstream-content-type') || 'image/jpeg';
          const blob = new Blob([await artRes.arrayBuffer()], {
            type: contentType.split(';')[0],
          });
          const basename =
            new URL(parsed.artUrl).pathname.split('/').filter(Boolean).pop() ||
            'smartlink-art';
          const asset = await client.assets.upload('image', blob, {
            filename: basename,
            source: { id: source.href, name: 'smartlink-import' },
          });
          onChange(
            set(
              {
                _type: 'image',
                asset: { _type: 'reference', _ref: asset._id },
              },
              ['art'],
            ),
          );
        } catch (artErr) {
          // Most likely the art CDN host isn't on the proxy allowlist yet.
          artNote =
            'Artwork could not be imported (' +
            (artErr instanceof Error ? artErr.message : 'upload failed') +
            ') — widen PROXY_ALLOWED_HOSTS or upload the cover manually.';
        }
      } else if (parsed.artUrl) {
        artNote = 'Artwork URL was not https — upload the cover manually.';
      } else {
        artNote = 'No artwork found on the page.';
      }

      setOutcome({ statuses, title: parsed.title, artNote });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }, [client, existingByService, onChange, song.title, url]);

  return (
    <div>
      {!readOnly && (
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: 10,
            marginBottom: 12,
            background: '#fafafa',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
              color: '#333',
            }}
          >
            Import from a link
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              inputMode="url"
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!busy) void runImport();
                }
              }}
              placeholder="https://distrokid.com/hyperfollow/…"
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: 1,
                minWidth: 0,
                font: 'inherit',
                fontSize: 12,
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.2)',
              }}
            />
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={busy || !url.trim()}
              style={{
                font: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.2)',
                background: busy ? '#eee' : '#fff',
                cursor: busy ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {busy ? 'Fetching…' : 'Import'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
            Paste a DistroKid HyperFollow or TuneCore link — the title, artwork
            and listening links fill themselves in.
          </div>
          {error && (
            <div style={{ fontSize: 12, color: '#b3261e', marginTop: 8 }}>
              {error}
            </div>
          )}
          {outcome && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {SMARTLINK_SERVICES.map((service) => {
                  const hit = outcome.statuses[service];
                  return (
                    <span
                      key={service}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        textTransform: 'capitalize',
                        border: '1px solid',
                        borderColor: hit ? '#17a2a2' : 'rgba(0,0,0,0.15)',
                        color: hit ? '#0e6e6e' : '#999',
                        background: hit ? 'rgba(23,162,162,0.08)' : '#fff',
                      }}
                    >
                      {service} {hit ? '✓' : '—'}
                    </span>
                  );
                })}
              </div>
              {outcome.artNote && (
                <div style={{ fontSize: 11, color: '#8a6d1a', marginTop: 6 }}>
                  {outcome.artNote}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {renderDefault(props)}
    </div>
  );
}
