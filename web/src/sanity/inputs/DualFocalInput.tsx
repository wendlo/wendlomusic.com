/**
 * DualFocalInput — heroImage.focalDesktop (a CSS object-position "X% Y%").
 *
 * Edits the two axes of the focal point (horizontal + vertical percentages) via
 * two range sliders + number inputs, plus a click-to-set preview pad. Emits a
 * normalised "X% Y%" string via set()/unset(). Wired to the focalDesktop field;
 * focalMobile keeps its own (plain) input.
 */
import { useCallback, useMemo } from 'react';
import { set, unset, type StringInputProps } from 'sanity';

const FOCAL = /^(\d{1,3})%\s+(\d{1,3})%$/;

function clamp(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parse(value: string | undefined): { x: number; y: number } {
  const m = typeof value === 'string' ? value.match(FOCAL) : null;
  if (!m) return { x: 50, y: 50 };
  return { x: clamp(Number(m[1])), y: clamp(Number(m[2])) };
}

export default function DualFocalInput(props: StringInputProps) {
  const { value, onChange, readOnly, elementProps } = props;
  const { x, y } = useMemo(() => parse(value), [value]);

  const emit = useCallback(
    (nx: number, ny: number) => {
      onChange(set(`${clamp(nx)}% ${clamp(ny)}%`));
    },
    [onChange],
  );

  const onX = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      emit(Number(e.currentTarget.value), y),
    [emit, y],
  );
  const onY = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      emit(x, Number(e.currentTarget.value)),
    [emit, x],
  );

  const onPad = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      emit(px, py);
    },
    [emit, readOnly],
  );

  const reset = useCallback(() => onChange(unset()), [onChange]);

  const axisRow = (
    label: string,
    axisValue: number,
    handler: (e: React.ChangeEvent<HTMLInputElement>) => void,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 62, fontSize: 12, color: '#555' }}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={axisValue}
        onChange={handler}
        disabled={readOnly}
        style={{ flex: 1 }}
      />
      <input
        type="number"
        min={0}
        max={100}
        value={axisValue}
        onChange={handler}
        readOnly={readOnly}
        style={{
          width: 60,
          font: 'inherit',
          padding: '4px 6px',
          borderRadius: 4,
          border: '1px solid rgba(0,0,0,0.2)',
        }}
      />
      <span style={{ width: 14, fontSize: 12, color: '#999' }}>%</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* hidden mirror so the field is wired to a real element for a11y/patches */}
      <input {...elementProps} type="hidden" value={value ?? ''} readOnly />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          onClick={onPad}
          role="presentation"
          style={{
            position: 'relative',
            width: 120,
            height: 84,
            flex: '0 0 auto',
            borderRadius: 6,
            border: '1px solid rgba(0,0,0,0.2)',
            background:
              'repeating-linear-gradient(45deg,#f6f6f6,#f6f6f6 6px,#efefef 6px,#efefef 12px)',
            cursor: readOnly ? 'default' : 'crosshair',
            overflow: 'hidden',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              borderRadius: '50%',
              border: '2px solid #E0A32B',
              background: 'rgba(224,163,43,0.35)',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {axisRow('Horizontal', x, onX)}
          {axisRow('Vertical', y, onY)}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <code
          style={{
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#555',
          }}
        >
          {x}% {y}%
        </code>
        <button
          type="button"
          onClick={reset}
          disabled={readOnly}
          style={{
            font: 'inherit',
            fontSize: 12,
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#fff',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        >
          Reset to center
        </button>
      </div>
    </div>
  );
}
