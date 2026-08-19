/**
 * NavManagerInput — siteSettings.pages (array of navPage).
 *
 * A compact list of the 7 fixed pages: up/down reorder (array order = nav
 * order), an enable toggle (Home locked on), and an editable label for the
 * text-nav pages (About + Blog) only. Patches are path-scoped set()/unset()
 * writes; reordering rewrites the whole array via set().
 */
import { useCallback } from 'react';
import { set, unset, type ArrayOfObjectsInputProps } from 'sanity';

interface NavPageItem {
  _key: string;
  _type?: string;
  pageId?: string;
  enabled?: boolean;
  label?: string;
  isTextLabel?: boolean;
}

export default function NavManagerInput(
  props: ArrayOfObjectsInputProps<NavPageItem>,
) {
  const { value, onChange, readOnly } = props;
  const items: NavPageItem[] = Array.isArray(value) ? value : [];

  const move = useCallback(
    (from: number, to: number) => {
      if (readOnly) return;
      if (to < 0 || to >= items.length) return;
      const next = items.slice();
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      onChange(set(next));
    },
    [items, onChange, readOnly],
  );

  const setEnabled = useCallback(
    (item: NavPageItem, enabled: boolean) => {
      if (readOnly) return;
      if (item.pageId === 'home' && !enabled) return; // Home is locked on.
      onChange(set(enabled, [{ _key: item._key }, 'enabled']));
    },
    [onChange, readOnly],
  );

  const setLabel = useCallback(
    (item: NavPageItem, label: string) => {
      if (readOnly) return;
      onChange(
        label
          ? set(label, [{ _key: item._key }, 'label'])
          : unset([{ _key: item._key }, 'label']),
      );
    },
    [onChange, readOnly],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {items.map((item, i) => {
        const isHome = item.pageId === 'home';
        const enabled = item.enabled !== false;
        const editableLabel = item.isTextLabel === true;
        return (
          <div
            key={item._key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.08)',
              background: enabled ? '#fff' : '#fafafa',
              opacity: enabled ? 1 : 0.7,
            }}
          >
            {/* Reorder */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button
                type="button"
                aria-label="Move up"
                disabled={readOnly || i === 0}
                onClick={() => move(i, i - 1)}
                style={arrowStyle(readOnly || i === 0)}
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={readOnly || i === items.length - 1}
                onClick={() => move(i, i + 1)}
                style={arrowStyle(readOnly || i === items.length - 1)}
              >
                ▼
              </button>
            </div>

            {/* Order index */}
            <span
              style={{
                width: 18,
                textAlign: 'right',
                fontSize: 12,
                color: '#999',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {i + 1}
            </span>

            {/* Page id + label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {item.pageId ?? '—'}
                {isHome && (
                  <span style={{ color: '#999', fontWeight: 400 }}> · locked on</span>
                )}
              </div>
              {editableLabel ? (
                <input
                  type="text"
                  value={item.label ?? ''}
                  onChange={(e) => setLabel(item, e.currentTarget.value)}
                  readOnly={readOnly}
                  placeholder="Nav label"
                  style={{
                    marginTop: 4,
                    width: '100%',
                    maxWidth: 220,
                    font: 'inherit',
                    fontSize: 12,
                    padding: '4px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                />
              ) : (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                  {item.label ? `“${item.label}” · ` : ''}GIF-art label (baked)
                </div>
              )}
            </div>

            {/* Enabled toggle */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: '#555',
                cursor: readOnly || isHome ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={readOnly || isHome}
                onChange={(e) => setEnabled(item, e.currentTarget.checked)}
              />
              {enabled ? 'Shown' : 'Hidden'}
            </label>
          </div>
        );
      })}
      {items.length === 0 && (
        <div style={{ padding: 12, fontSize: 12, color: '#999' }}>
          No pages yet — seed siteSettings to populate the 7 fixed pages.
        </div>
      )}
    </div>
  );
}

function arrowStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 16,
    lineHeight: '12px',
    fontSize: 9,
    padding: 0,
    borderRadius: 3,
    border: '1px solid rgba(0,0,0,0.2)',
    background: '#fff',
    color: disabled ? '#ccc' : '#333',
    cursor: disabled ? 'default' : 'pointer',
  };
}
