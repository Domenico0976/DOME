# Design: tools-app UI rework — presets cascade, modulator surface, StackPanel

Date: 2026-10-12
Status: draft — awaiting user review of this spec (Q1=A confirmed; approaches 1A+2A+3A proposed)
Repo: `C:\Users\Utente\Desktop\robbe\DOME\tools-app`

## Context and goals

Live audit (11 screenshots, heuristics scorecard 2.5/5) confirmed three P0/P1 defects against the accepted `.pen` design system and the user's latest requirements:

1. **Presets entry is broken and duplicated.** "Browse scene presets" opens a large centered modal; "Add Preset" sets `aria-expanded=true` but renders no mega-menu in the DOM. Two adjacent buttons, one broken.
2. **PresetModulator regression.** After picking an audio modulation, Node Options Effects tab stays empty ("Add effect" only). Sensitivity / value range / React To (legacy `apwZy` two-column surface) never appear.
3. **Stack is a viewport-pinned overlay.** `StackCanvasOverlay` is `position:fixed` and collides with the TopBar (z-index vs `--z-global-chrome:40`). User requirement: Stack must live inside the application section, grouped with the canvas, draggable as a panel.

Authoritative visual references: Pencil frame **"Archive · SoundBar-Design (legacy)"** (soundbar settings density: compact select ~236px, value pills, React to / sensitivity / range rows) and legacy frames `an02x` (SoundBar 1200×908) / `apwZy` (ReactTo panel 520×442).

## Constraints (non-negotiable)

- No changes to audio engine, core DSP, or `projectStore` schema (preset *data fields* `whatItDoes` / `consequence` / `risk` in `presets.ts` are allowed and already present).
- No `as any`, no `@ts-ignore` / `@ts-expect-error`.
- No new npm dependencies.
- Keep CSS custom-property **names**; retarget values only (`--button-bg-audio`, `--badge-*`, `--danger`, `--primary-300/600` are asserted by tests).
- No decorative comments (comment hook); category-3 spec-provenance comments only where justified.
- `Write` tool refuses existing files — use `edit` for edits.
- Design system: tokens in `src/globals.css` + `tailwind.config.js` (bg `75 20% 3%`, panel `75 7% 10%`, control `78 6% 12%`, border `78 4% 19%`, lime `74 60% 57%`, danger `11 100% 55%`; z: global-chrome 40, floating-panel 50, floating-picker 55, modal-overlay 60, modal-content 65, toast 100; radius 2/8/12/999; Geist).

## Non-goals

- Redesigning soundbar transport, Templates modal, Settings dropdown (audit: OK).
- Audio engine / FFT / binding runtime changes.
- Migrating off GSAP Draggable or @dnd-kit.
- Fixing `AudioPresetMenu.tsx` (orphan, out of scope).

---

## Section 1 — Presets cascade (approach 1A)

### Problem

- `PresetMegaMenu.tsx` is a 3-step **click** cascade; columns render only after prior selection; user requires always-visible columns filled by **hover**.
- `AudioReactPanel.tsx` renders two entries: "Browse scene presets" (grid icon → large modal) and "Add Preset" (+ → broken expand).
- Default state must show the **first list item already hovered**; on scroll+exit, keep last visible item (scroll restore via ref).

### Design

**Single entry point.** Delete the "Browse scene presets" button from the presets header. Keep only one control: **Add Preset** (Plus icon, `aria-expanded` / `aria-controls` pointing at the cascade popover).

**Cascade behavior (rewrite in place: `PresetMegaMenu.tsx`):**

| State | Behavior |
|---|---|
| Open | All three columns render immediately. Column 1 = scene layers (from `projectStore`). Column 2 = EFFECTS (from `presets.ts` catalog). Column 3 = PARAMETERS for hovered effect. |
| Hover layer (col 1) | Sets hovered layer; column 2 fills; column 3 shows params of the **first** effect by default (pre-hovered). |
| Hover effect (col 2) | Sets hovered effect; column 3 fills with that effect's parameters; every row shows `whatItDoes` / `consequence` / `risk` (already in data). |
| Hover parameter (col 3) | Visual highlight only; **click commits**. |
| Commit | Same contract as today's `handlePickMegaMenu`: `selectTool` + `setTargetParam` + `setCreatorOpen(true)` **plus** new `focusParam` (Section 2). Close cascade. |
| Exit without commit | Do **not** reset. Remember `hoveredLayerId` / `hoveredEffectUid` in component state; on re-open restore hover to last values; if none, default to first layer / first effect / first param. |
| Scroll | Each column body is `overflow-y-auto`. On close, store `scrollTop` per column in a ref map; on open, restore via `useLayoutEffect`. "Keep last visible" = restore scrollTop + hovered ids. |

**Layout (design-system only):** popover anchored above the presets rail (bottom sheet of the Audio Reactivity Panel), width ~min(720px, 100vw−32px), three equal columns, `rounded-12`, `border-border`, `bg-panel`, header row with step labels. Rows: min-height 32px (Fitts), hover ring `--primary-300`, selected ring lime. No nested cards (audit lesson from NodeOptions).

**A11y:** roving tabindex across rows; `aria-activedescendant` on the popover; Escape closes and returns focus to Add Preset; hover is enhancement, keyboard arrow keys mirror hover.

### Files

- `src/ui/PresetMegaMenu.tsx` — rewrite interaction model (keep export name).
- `src/ui/AudioReactPanel.tsx` — remove "Browse scene presets" button; keep single Add Preset; pass `focusParam` through on pick.
- `src/ui/AudioReactPanel.test.tsx` — update: one entry point; hover-default assertions; scroll-restore test.

### Acceptance

- One Add button only.
- Open → first layer pre-hovered, first effect of that layer pre-hovered, params visible.
- Hovering col2 row updates col3 without click.
- Commit creates binding + opens modulator surface (Section 2).
- Close/reopen restores last hover + scroll.

---

## Section 2 — Modulator surface via focusParam (approach 2A)

### Problem

`handlePickMegaMenu` only flips creator-open and leaves Node Options on the **Controls** tab. The sensitivity / value range / React To rows live under **Effects** (`NodeOptionsEffects`), so the user never sees them — silent failure (audit `audit-08`, `audit-09/10`).

### Design

**New prop `focusParam: string | null`** (format `"${effectUid}.${paramUid}"`), owned by `App.tsx` (or the nearest panel orchestrator already holding `selectedUid`).

Flow on commit:

1. `PresetMegaMenu` calls existing pick handler with `{ layerId, effectUid, param, sensitivity?, range? }`.
2. Orchestrator: `selectTool(layerId)` → `setTargetParam(...)` → `setCreatorOpen(true)` → `setFocusParam(\`${effectUid}.${param}\`)`.
3. `FloatingPanel` (Node Options) receives `focusParam` and forwards to inner `NodeOptions` / `NodeOptionsEffects`.
4. `NodeOptionsEffects` on `focusParam` change:
   - Switch active tab to **Effects** (same mechanism as existing tab state).
   - Ensure the effect instance for `effectUid` is expanded (auto-open collapsible).
   - Scroll the row `param` into view (`scrollIntoView({ block: 'nearest' })`).
   - Apply focus ring on the row's primary control (sensitivity slider).
   - **Clear** `focusParam` after handling (one-shot) so later tab switches are not hijacked.

**Inline bottom form** (TARGET PARAMETER / REACT TO in the soundbar): demote to a **read-only chip** — "React to: bass · Sens 0.42" — that on click focuses the FloatingPanel (bring to front + call the same scroll/focus). It must not be a second editable surface (Hick: one place to edit).

**Legacy fidelity:** the rows that appear must match `apwZy` semantics — React To (band select), Sensitivity (0–1 slider), Value range (min/max pair), visible without opening any further disclosure. If `NodeOptionsEffects` currently nests them behind an extra chevron, flatten to one level.

### Files

- `src/App.tsx` (or panel host) — `focusParam` state + wiring.
- `src/ui/FloatingPanel.tsx` — pass-through prop.
- `src/ui/NodeOptions.tsx` / `src/ui/NodeOptionsEffects.tsx` — tab switch, auto-expand, scroll/focus, one-shot clear.
- `src/ui/AudioReactPanel.tsx` — chip summary instead of editable inline form.
- Tests: extend `FloatingPanel.test.tsx` / NodeOptions tests for focusParam one-shot; keep existing 259 green.

### Acceptance

- Pick "Particles → Amplitude A → bass" from cascade.
- Node Options opens on **Effects** tab, Amplitude card expanded, Sensitivity focused and visible without scrolling the page.
- Chip in soundbar shows summary; clicking chip re-focuses the same row.
- Second pick updates chip and re-targets focus; no sticky tab hijack after clear.

---

## Section 3 — StackPanel in application section (approach 3A)

### Problem

`StackCanvasOverlay` is `position:fixed`, overlaps TopBar (audit `audit-01/06/07`), and is the wrong container model. User requirement: Stack grouped **with** the canvas inside the application (`<main>`) section, draggable panel, variable height by item count, add-component control, kebab quick-settings, item reorder.

### Design

**Replace viewport-fixed overlay with an absolute panel anchored to the application section.**

```
<main style="position:relative">   <!-- application section -->
  <section id="canvas">            <!-- CanvasArea: full size, owns pan/zoom -->
  <aside id="stack-panel">         <!-- StackPanel: position:absolute within main -->
</main>
```

The panel is a **sibling of the canvas inside `<main>`**, not a flex row that reserves space (that would reflow the canvas on every drag frame). `position:absolute` + `main{position:relative}` keeps it grouped with the canvas and clamped to the application section.

**StackPanel anatomy:**

| Part | Spec |
|---|---|
| Header | Title "Stack · N", drag handle (GSAP Draggable **handle: header only**), Add-component button (Plus → same template/tool picker as canvas add), collapse toggle. |
| Body | Vertical list of layer rows. Height: `auto` content-sized up to `max-height: calc(100vh - var(--topbar-h) - var(--soundbar-height) - 32px)` with internal scroll. Empty state: "Empty — add a tool to begin" (single message; remove canvas duplicate). |
| Row | Icon, name, visibility toggle, **kebab** (menu: rename, duplicate, quarantine, delete), drag-to-reorder via existing @dnd-kit vertical sortable (reuse `StackVertical` / `StackDnD` logic). |
| Z-index | `position:absolute` inside `<main>` only — **never** `position:fixed`. Stacking is local to the application section: panel sits above canvas, below TopBar/soundbar chrome. Do **not** use viewport tokens (`--z-floating-panel` etc.) for placement; a plain local z-index (e.g. `z-10` within main) is enough. |

**Drag semantics:** dragging the header moves the panel **within the application section bounds only** (clamp to `<main>` rect). Implementation: GSAP Draggable with `bounds: mainRef`, `type: 'x,y'`, `inertia: false` (match FloatingPanel's no-inertia choice). The panel is `position:absolute` inside `main{position:relative}` — it overlays the canvas but never leaves the section and never fights flex reflow, because the canvas stays full-size underneath.

Clarified stacking model:

- `<main>` gets `position: relative`.
- StackPanel: `position: absolute` within main (not fixed), initial top-left inset 12px, GSAP bounds = main.
- Canvas remains full-size under it; pan/zoom target is canvas only; panel has `pointer-events: auto` and stops propagation on header/body so canvas does not receive drag.

**Deletes:**

- `src/ui/StackCanvasOverlay.tsx` (+ its mount in App).
- `src/ui/FloatingStack.tsx` (dead code, unused).
- `src/ui/FloatingStack.test.tsx` (14 orphan tests).

**Keep:** `Stack.tsx` row rendering, `StackDnD` reorder, kebab menu items, projectStore `stack` selectors — no schema changes.

### Files

- `src/ui/StackPanel.tsx` — **new**, hosts header + sortable list + add + kebab.
- `src/App.tsx` — replace overlay mount; main gets relative; remove fixed overlay import.
- `src/ui/Stack.tsx` / `StackDnD` — adapt to render inside StackPanel body.
- Delete: `StackCanvasOverlay.tsx`, `FloatingStack.tsx`, `FloatingStack.test.tsx`.
- Tests: rewrite overlay position tests → StackPanel in-main bounds; keep DnD tests; ensure pan-canvas tests still pass.

### Acceptance

- Stack panel is a child of `<main>`, never overlaps TopBar or soundbar.
- Header drag moves panel, clamped to main; canvas pan unaffected.
- Height grows with N items, scrolls past max.
- Add-component and kebab work; reorder via drag still works.
- `npm run build` + `npx vitest run` green (259 baseline, minus deleted orphans, plus new StackPanel tests).

---

## Cross-cutting

### Visual parity

All new/rewritten chrome uses existing tokens and shadcn-style primitives already in repo. No new colors, no new radii. Lime accent only for primary affordances (Add, active row, focus ring) per `.pen`.

### Error handling

- Cascade open with zero layers: disabled Add + tooltip "Add a tool first" (replaces silent empty modal).
- `focusParam` pointing at missing effectUid: no-op clear, console.warn in dev only.
- Drag out of bounds: GSAP bounds clamp (no error state).

### Testing strategy

| Area | Approach |
|---|---|
| PresetMegaMenu | RTL + user-event: hover defaults, column fill, commit payload, scroll restore (mock scrollTop). |
| focusParam | Unit: one-shot clear; integration: pick → Effects tab active + row focused. |
| StackPanel | jsdom: renders in main, header drag fires GSAP with bounds; DnD existing tests ported. |
| Regression | Full vitest suite; build `tsc --noEmit && vite build`. |
| Manual | Patchright screenshots at 1440×900: cascade open/hover, modulator focus, stack drag vs TopBar. |

### Rollout order (for plan)

1. Section 2 focusParam (smallest blast radius, unblocks modulator UX).
2. Section 1 cascade rewrite (depends on focusParam existing).
3. Section 3 StackPanel + deletes (independent of 1–2 except App.tsx mount points — sequence after 1 to avoid merge conflicts in App).

---

## Open questions

None blocking. Post-implementation backlog (not in this design): soundbar status-bar clutter (`ctx:missing` etc.) copy pass; optional 2C compact chip already covered as read-only chip in Section 2.
