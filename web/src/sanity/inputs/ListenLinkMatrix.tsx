/**
 * ListenLinkMatrix — songEntry.links (array of listenLink).
 *
 * Renders the 8 fixed services in fixed order as a compact matrix, one row per
 * service with a URL field + enabled toggle. Missing service rows are
 * materialised lazily on first edit (the whole array is rewritten via set() so
 * every service always has a stable _key); existing rows are patched
 * path-scoped by _key.
 */
import { useCallback, useMemo } from 'react';
import { set, unset, type ArrayOfObjectsInputProps } from 'sanity';
import { SERVICE_IDS } from '@/sanity/schemas/objects/listenLink';

interface ListenLinkItem {
  _key: string;
  _type?: string;
  service?: string;
  url?: string;
  enabled?: boolean;
}

/** Stable-ish key generator (no crypto dependency needed in the Studio). */
function makeKey(service: string): string {
  return `${service}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ListenLinkMatrix(
  props: ArrayOfObjectsInputProps<ListenLinkItem>,
) {
  const { value, onChange, readOnly } = props;
  const items: ListenLinkItem[] = useMemo(
    () => (Array.isArray(value) ? value : []),
    [value],
  );

  const byService = useMemo(() => {
    const map = new Map<string, ListenLinkItem>();
    for (const it of items) {
      if (it?.service && !map.has(it.service)) map.set(it.service, it);
    }
    return map;
  }, [items]);

  /** Ensure a row exists for `service`; returns its _key, patching if needed. */
  const ensureRow = useCallback(
    (service: string): { key: string; created: boolean } => {
      const existing = byService.get(service);
      if (existing) return { key: existing._key, created: false };
      const key = makeKey(service);
      const row: ListenLinkItem = {
        _key: key,
        _type: 'listenLink',
        service,
        enabled: false,
      };
      // Rebuild the array in canonical service order so it stays tidy.
      const next: ListenLinkItem[] = [];
      for (const s of SERVICE_IDS) {
        if (s === service) next.push(row);
        else {
          const cur = byService.get(s);
          if (cur) next.push(cur);
        }
      }
      onChange(set(next));
      return { key, created: true };
    },
    [byService, onChange],
  );

  const setUrl = useCallback(
    (service: string, url: string) => {
      if (readOnly) return;
      const { key } = ensureRow(service);
      onChange(
        url
          ? set(url, [{ _key: key }, 'url'])
          : unset([{ _key: key }, 'url']),
      );
    },
    [ensureRow, onChange, readOnly],
  );

  const setEnabled = useCallback(
    (service: string, enabled: boolean) => {
      if (readOnly) return;
      const { key } = ensureRow(service);
      onChange(set(enabled, [{ _key: key }, 'enabled']));
    },
    [ensureRow, onChange, readOnly],
  );

  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {SERVICE_IDS.map((service, i) => {
        const row = byService.get(service);
        const url = row?.url ?? '';
        const enabled = row?.enabled === true;
        const live = enabled && !!url;
        return (
          <div
            key={service}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.08)',
              background: live ? '#fff' : '#fafafa',
            }}
          >
            <span
              style={{
                width: 74,
                flex: '0 0 auto',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'capitalize',
                color: live ? '#17a2a2' : '#666',
              }}
            >
              {service}
            </span>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(service, e.currentTarget.value)}
              readOnly={readOnly}
              placeholder="https://…"
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: 1,
                minWidth: 0,
                font: 'inherit',
                fontSize: 12,
                padding: '5px 8px',
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.2)',
              }}
            />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: '#555',
                cursor: readOnly ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={readOnly}
                onChange={(e) => setEnabled(service, e.currentTarget.checked)}
              />
              On
            </label>
          </div>
        );
      })}
    </div>
  );
}
