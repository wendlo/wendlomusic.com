'use client';

/**
 * Styles for the doodle editor + inline summary. One <style> hoisted and
 * de-duplicated by React 19 (href + precedence). Colours come from the
 * Studio's card variables (copied onto the portal root by DoodleCanvasInput),
 * with light fallbacks for the sandbox. Sizes inside the canvas are multiplied
 * by --de-inv (= 1 / canvas scale) so handles and labels stay screen-sized.
 */

const CSS = `
.de-root, .de-summary {
  --de-bg: var(--card-bg-color, #ffffff);
  --de-fg: var(--card-fg-color, #1f2328);
  --de-muted: var(--card-muted-fg-color, #646b76);
  --de-border: var(--card-border-color, #dcdfe5);
  --de-focus: var(--card-focus-ring-color, #2276fc);
  --de-panel: var(--card-muted-bg-color, #f3f4f6);
  --de-primary: var(--card-focus-ring-color, #2276fc);
  --de-danger: #d0393e;
  --de-warn-bg: rgba(242, 193, 78, .22);
  --de-measure: #ff3d9a;
}
.de-root *, .de-summary * { box-sizing: border-box; }
.de-root :focus-visible, .de-summary :focus-visible { outline: 2px solid var(--de-focus); outline-offset: 2px; }

.de-root {
  position: fixed; inset: 0; z-index: 100000;
  display: flex; flex-direction: column;
  background: var(--de-bg); color: var(--de-fg);
  font-family: var(--de-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  font-size: 14px; line-height: 1.4;
}
.de-root[data-mount=inline] { position: relative; inset: auto; z-index: auto; height: 100%; }
.de-root:focus { outline: none; }

.de-topbar { display: flex; align-items: center; gap: 8px 10px; padding: 10px 16px; border-bottom: 1px solid var(--de-border); flex-wrap: wrap; }
.de-title { font-weight: 650; font-size: 15px; margin-right: 4px; }
.de-hint { color: var(--de-muted); font-size: 12.5px; flex: 1 1 200px; min-width: 0; }
.de-sep { width: 1px; align-self: stretch; background: var(--de-border); margin: 2px 2px; }

.de-btn {
  font: inherit; font-size: 13.5px; line-height: 1.2;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 12px; border-radius: 6px;
  border: 1px solid var(--de-border); background: var(--de-bg); color: var(--de-fg);
  cursor: pointer; white-space: nowrap;
}
.de-btn:hover:not(:disabled) { background: var(--de-panel); }
.de-btn:disabled { opacity: .45; cursor: default; }
.de-btn--primary { background: var(--de-primary); border-color: var(--de-primary); color: #fff; font-weight: 600; }
.de-btn--primary:hover:not(:disabled) { background: var(--de-primary); filter: brightness(1.1); }
.de-btn--danger { color: var(--de-danger); }
.de-btn--small { padding: 5px 9px; font-size: 12.5px; }
.de-btn--ghost { border-color: transparent; background: transparent; }

.de-seg { display: inline-flex; border: 1px solid var(--de-border); border-radius: 8px; padding: 2px; gap: 2px; background: var(--de-panel); }
.de-seg button { font: inherit; font-size: 13px; border: 0; background: transparent; color: var(--de-fg); padding: 5px 12px; border-radius: 6px; cursor: pointer; }
.de-seg button[aria-pressed=true] { background: var(--de-bg); box-shadow: 0 1px 3px rgba(0,0,0,.18); font-weight: 600; }

.de-banner { display: flex; align-items: center; gap: 10px; padding: 8px 16px; font-size: 13px; border-bottom: 1px solid var(--de-border); }
.de-banner[data-tone=error] { background: rgba(208, 57, 62, .13); }
.de-banner[data-tone=warn] { background: var(--de-warn-bg); }
.de-banner[data-tone=info] { background: var(--de-panel); }
.de-banner > span { flex: 1; }

.de-main { flex: 1; min-height: 0; display: flex; }
.de-canvas-area { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #2a2a2f; }
.de-canvas-area > .de-canvas-fit { flex: 1; min-height: 0; padding: 30px 28px 18px; }
.de-canvas-help { color: rgba(255,255,255,.72); font-size: 12px; text-align: center; padding: 0 12px 12px; }
.de-inspector { width: 340px; flex: none; border-left: 1px solid var(--de-border); overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 18px; }
@media (max-width: 860px) {
  .de-main { flex-direction: column; }
  .de-canvas-area { flex: none; height: 55vh; }
  .de-inspector { width: auto; flex: 1; border-left: 0; border-top: 1px solid var(--de-border); }
}

/* canvas */
.de-canvas-fit { display: flex; align-items: center; justify-content: center; overflow: hidden; }
.de-canvas-fit[data-fit=width] { display: block; }
.de-stage-frame { position: relative; flex: none; }
.de-stage, .de-overlay { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.de-stage { overflow: hidden; background: #1A1714; border-radius: calc(4px * var(--de-inv)); box-shadow: 0 calc(8px * var(--de-inv)) calc(28px * var(--de-inv)) rgba(0,0,0,.35); }
.de-hero { position: absolute; inset: 0; background-size: cover; background-repeat: no-repeat; }
.de-ghost { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
/* the nav paints over doodles on the site (same z-index, later in the DOM); .doodles is z 30 */
.de-ghost--navlayer { z-index: 31; }
.de-ghost-logo { position: absolute; left: 4.6%; top: 3.6%; width: auto; max-width: none; filter: invert(1) drop-shadow(0 3px 12px rgba(0,0,0,.4)); opacity: .55; }
.de-ghost-nav { position: absolute; right: 6%; display: flex; align-items: flex-end; opacity: .55; }
.de-ghost-nav[data-device=desktop] { top: 84%; flex-direction: row; }
.de-ghost-nav[data-device=phone] { bottom: 6%; flex-direction: column; }
.de-ghost-navlink { display: block; background-repeat: no-repeat; background-position: center; background-size: contain; opacity: .9; filter: drop-shadow(0 2px 6px rgba(0,0,0,.62)); }
.de-ghost-navtext { font-family: var(--nav-font); font-weight: 700; color: #fff; text-transform: lowercase; line-height: 1; text-shadow: 0 2px 6px rgba(0,0,0,.62); }
.de-ghost-caption {
  position: absolute; white-space: nowrap;
  font: 600 calc(11px * var(--de-inv)) / 1.2 system-ui, -apple-system, sans-serif;
  color: #fff; background: rgba(0,0,0,.55);
  padding: calc(3px * var(--de-inv)) calc(8px * var(--de-inv)); border-radius: calc(20px * var(--de-inv));
}
.de-ghost-caption--nav { bottom: calc(100% + 12px); right: 0; }
.de-summary .de-ghost-caption { display: none; }

.de-stage.de-editable .doodle { cursor: grab; touch-action: none; }
.de-stage.de-editable.de-dragging .doodle { cursor: grabbing; }
.de-stage .doodle:focus { outline: none; }
.de-stage .doodle:focus-visible:not([data-de-selected]) { outline: calc(2px * var(--de-inv)) solid var(--de-focus); outline-offset: calc(4px * var(--de-inv)); }
.de-stage .doodle[data-de-hidden] {
  opacity: .5; filter: grayscale(1);
  outline: calc(2px * var(--de-inv)) dashed #fff; outline-offset: calc(3px * var(--de-inv));
  box-shadow: 0 0 0 calc(3px * var(--de-inv)) rgba(0,0,0,.35);
}

.de-overlay { pointer-events: none; z-index: 50; }
.de-sel { position: absolute; }
.de-sel-outline {
  position: absolute; inset: calc(-5px * var(--de-inv));
  border: calc(2px * var(--de-inv)) solid var(--de-focus); border-radius: calc(3px * var(--de-inv));
  box-shadow: 0 0 0 calc(1px * var(--de-inv)) rgba(255,255,255,.7);
}
.de-handle {
  position: absolute; width: calc(13px * var(--de-inv)); height: calc(13px * var(--de-inv));
  transform: translate(-50%, -50%);
  background: #fff; border: calc(2px * var(--de-inv)) solid var(--de-focus); border-radius: calc(3px * var(--de-inv));
  pointer-events: auto; touch-action: none; padding: 0;
}
.de-handle::before { content: ""; position: absolute; inset: calc(-8px * var(--de-inv)); }
.de-handle[data-corner=nw] { left: 0; top: 0; cursor: nwse-resize; }
.de-handle[data-corner=ne] { left: 100%; top: 0; cursor: nesw-resize; }
.de-handle[data-corner=sw] { left: 0; top: 100%; cursor: nesw-resize; }
.de-handle[data-corner=se] { left: 100%; top: 100%; cursor: nwse-resize; }
.de-rot-stem { position: absolute; left: 50%; bottom: 100%; width: calc(2px * var(--de-inv)); height: calc(22px * var(--de-inv)); background: var(--de-focus); transform: translateX(-50%); }
.de-rot {
  position: absolute; left: 50%; top: calc(-24px * var(--de-inv));
  width: calc(16px * var(--de-inv)); height: calc(16px * var(--de-inv)); border-radius: 50%;
  transform: translate(-50%, -50%);
  background: #fff; border: calc(2px * var(--de-inv)) solid var(--de-focus);
  pointer-events: auto; touch-action: none; cursor: grab; padding: 0;
}
.de-rot::before { content: ""; position: absolute; inset: calc(-8px * var(--de-inv)); }
.de-gapline { position: absolute; background: var(--de-measure); }
.de-gapbox { position: absolute; outline: calc(1.5px * var(--de-inv)) dashed var(--de-measure); }
.de-badge {
  position: absolute; transform: translateX(-50%);
  background: rgba(22, 22, 26, .94); color: #fff;
  font: 500 calc(12px * var(--de-inv)) / 1.4 system-ui, -apple-system, sans-serif;
  padding: calc(6px * var(--de-inv)) calc(10px * var(--de-inv)); border-radius: calc(7px * var(--de-inv));
  white-space: nowrap; box-shadow: 0 calc(3px * var(--de-inv)) calc(12px * var(--de-inv)) rgba(0,0,0,.35);
}
.de-badge b { color: #ffa6d2; font-weight: 650; }
.de-badge-to { opacity: .75; }

/* inspector */
.de-section { display: flex; flex-direction: column; gap: 8px; }
.de-section-title { font-size: 11.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--de-muted); font-weight: 650; }
.de-label { font-size: 13px; font-weight: 600; display: block; margin-bottom: 4px; }
.de-input, .de-select {
  font: inherit; font-size: 14px; width: 100%; padding: 7px 9px; border-radius: 6px;
  border: 1px solid var(--de-border); background: var(--de-bg); color: var(--de-fg);
}
.de-input[aria-invalid=true] { border-color: var(--de-danger); }
.de-help { font-size: 12px; color: var(--de-muted); }
.de-warn { font-size: 12.5px; background: var(--de-warn-bg); border-radius: 6px; padding: 7px 9px; }
.de-error { font-size: 12.5px; color: var(--de-danger); }
.de-radio { display: flex; gap: 8px; align-items: center; font-size: 13.5px; cursor: pointer; padding: 2px 0; }
.de-radio input, .de-check input { margin: 0; accent-color: var(--de-primary); width: 16px; height: 16px; flex: none; }
.de-check { display: flex; gap: 8px; align-items: center; font-size: 13.5px; cursor: pointer; }
.de-chips { display: flex; gap: 10px; flex-wrap: wrap; }
.de-chip { width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(0,0,0,.25); cursor: pointer; padding: 0; }
.de-chip[aria-pressed=true] { box-shadow: 0 0 0 2px var(--de-bg), 0 0 0 4px var(--de-focus); }
.de-num-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.de-num-grid .de-input { font-variant-numeric: tabular-nums; }
.de-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.de-list { display: flex; flex-direction: column; gap: 6px; list-style: none; }
.de-list button {
  text-align: left; display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 6px 8px; border-radius: 6px; border: 1px solid var(--de-border);
  background: var(--de-bg); color: var(--de-fg); font: inherit; font-size: 13.5px; cursor: pointer;
}
.de-list button:hover { background: var(--de-panel); }
.de-list-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.de-thumb {
  width: 42px; height: 30px; border-radius: 4px; flex: none; overflow: hidden;
  background: #2a2a2f center / contain no-repeat;
  display: grid; place-items: center; color: #fff; font-size: 10px; font-weight: 700;
}
.de-tag { font-size: 11px; color: var(--de-muted); border: 1px solid var(--de-border); border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
.de-kbd { font: 11.5px ui-monospace, SFMono-Regular, Menlo, monospace; border: 1px solid var(--de-border); border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; }
.de-tips { font-size: 13px; display: flex; flex-direction: column; gap: 6px; padding-left: 18px; }
.de-measure { font-size: 12.5px; background: var(--de-panel); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }

/* inline summary in the form */
.de-summary { display: flex; flex-direction: column; gap: 10px; }
.de-summary-previews { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.de-summary-previews[data-disabled=true] { cursor: default; }
.de-summary-desktop { flex: 1; min-width: 0; }
.de-summary-phone { width: 86px; flex: none; }
.de-summary .de-stage { pointer-events: none; }
.de-summary-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.de-summary-count { font-size: 13px; color: var(--de-muted); }
.de-summary-caption { font-size: 11px; color: var(--de-muted); margin-top: 4px; text-align: center; }
`;

export function EditorStyles() {
  return (
    <style href="wendlo-doodle-editor" precedence="default">
      {CSS}
    </style>
  );
}
