/**
 * YouTubeUrlInput — youtubeEntry.url.
 *
 * A plain URL text input that parses the YouTube video id from any
 * watch/share/shorts/youtu.be/embed URL and shows live validity + the video
 * thumbnail. Controlled; writes the raw URL string via set()/unset().
 */
import { useCallback, useMemo } from 'react';
import { set, unset, type StringInputProps } from 'sanity';

/** Extract an 11-char YouTube id from the common URL shapes; else null. */
export function parseYouTubeId(raw: string | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  // Bare id.
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export default function YouTubeUrlInput(props: StringInputProps) {
  const { value, onChange, readOnly, elementProps } = props;
  const current = typeof value === 'string' ? value : '';
  const id = useMemo(() => parseYouTubeId(current), [current]);
  const status: 'empty' | 'valid' | 'invalid' = !current.trim()
    ? 'empty'
    : id
      ? 'valid'
      : 'invalid';

  const onText = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.currentTarget.value;
      onChange(next ? set(next) : unset());
    },
    [onChange],
  );

  const border =
    status === 'invalid'
      ? '#e4572e'
      : status === 'valid'
        ? '#17a2a2'
        : 'rgba(0,0,0,0.2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        {...elementProps}
        type="url"
        inputMode="url"
        value={current}
        onChange={onText}
        readOnly={readOnly}
        placeholder="https://www.youtube.com/watch?v=…"
        spellCheck={false}
        autoComplete="off"
        style={{
          font: 'inherit',
          padding: '8px 10px',
          borderRadius: 4,
          border: `1px solid ${border}`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {status === 'valid' && id ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
              alt="YouTube thumbnail"
              width={120}
              height={68}
              style={{
                borderRadius: 4,
                border: '1px solid rgba(0,0,0,0.15)',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <span style={{ fontSize: 12, color: '#17a2a2' }}>
              Valid — id <code>{id}</code>
            </span>
          </>
        ) : status === 'invalid' ? (
          <span style={{ fontSize: 12, color: '#e4572e' }}>
            Not a recognisable YouTube URL.
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#999' }}>
            Paste a watch / share / shorts / youtu.be URL.
          </span>
        )}
      </div>
    </div>
  );
}
