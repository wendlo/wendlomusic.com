/**
 * AccentColorInput — designSettings.accent.
 *
 * A hex text input + a live swatch + a native colour picker + a row of Wendlo
 * presets. Controlled input; writes via set()/unset() string patches.
 */
import { useCallback } from 'react';
import { set, unset, type StringInputProps } from 'sanity';

const PRESETS: Array<{ name: string; hex: string }> = [
  { name: 'Mustard', hex: '#E0A32B' },
  { name: 'Persimmon', hex: '#E4572E' },
  { name: 'Teal', hex: '#17A2A2' },
  { name: 'Butter', hex: '#F2C14E' },
];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export default function AccentColorInput(props: StringInputProps) {
  const { value, onChange, elementProps, readOnly } = props;
  const current = typeof value === 'string' ? value : '';
  const isValid = HEX6.test(current);

  const write = useCallback(
    (next: string) => {
      onChange(next ? set(next) : unset());
    },
    [onChange],
  );

  const onText = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      write(e.currentTarget.value);
    },
    [write],
  );

  const onPicker = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Native picker emits lowercase #rrggbb.
      write(e.currentTarget.value);
    },
    [write],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            flex: '0 0 auto',
            border: '1px solid rgba(0,0,0,0.15)',
            background: isValid ? current : 'transparent',
            backgroundImage: isValid
              ? undefined
              : 'linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
          }}
        />
        <input
          {...elementProps}
          type="text"
          value={current}
          onChange={onText}
          readOnly={readOnly}
          placeholder="#E0A32B"
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: 1,
            font: 'inherit',
            padding: '8px 10px',
            borderRadius: 4,
            border: `1px solid ${isValid || current === '' ? 'rgba(0,0,0,0.2)' : '#e4572e'}`,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
        <input
          type="color"
          aria-label="Colour picker"
          value={isValid ? current : '#E0A32B'}
          onChange={onPicker}
          disabled={readOnly}
          style={{
            width: 34,
            height: 34,
            padding: 0,
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 6,
            background: 'none',
            cursor: readOnly ? 'default' : 'pointer',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PRESETS.map((p) => {
          const active = current.toLowerCase() === p.hex.toLowerCase();
          return (
            <button
              key={p.hex}
              type="button"
              disabled={readOnly}
              onClick={() => write(p.hex)}
              title={p.hex}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 999,
                cursor: readOnly ? 'default' : 'pointer',
                font: 'inherit',
                fontSize: 12,
                border: `1px solid ${active ? '#000' : 'rgba(0,0,0,0.2)'}`,
                background: active ? 'rgba(0,0,0,0.04)' : '#fff',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: p.hex,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
