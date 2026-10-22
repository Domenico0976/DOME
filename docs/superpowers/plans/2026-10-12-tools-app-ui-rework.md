# Plan: tools-app UI rework — presets cascade, modulator surface, StackPanel

Date: 2026-10-12
Spec: `docs/superpowers/specs/2026-10-12-tools-app-ui-rework-design.md`
Repo: `C:\Users\Utente\Desktop\robbe\DOME\tools-app`
Baseline: 47 test files, 259 passed, 1 skipped; `npm run build` green.

## Goal

1. **§2 focusParam** — picking a param from the cascade opens Node Options on the Effects tab with the target row expanded, scrolled, and focused (one-shot clear).
2. **§1 cascade** — single "Add Preset" entry opens a 3-column hover-filled cascade (layer → effect → param); remove "Browse scene presets".
3. **§3 StackPanel** — replace viewport-fixed `StackCanvasOverlay` with an absolute panel inside `<main>`, GSAP header-drag bounded to main; delete dead `FloatingStack*`.

## Constraints

- No audio-engine / core-DSP / projectStore-schema changes.
- No `as any`, `@ts-ignore`, `@ts-expect-error`.
- No new npm deps.
- Keep CSS custom-property **names** (`--button-bg-audio`, `--badge-*`, `--danger`, `--primary-300/600` asserted by tests).
- No decorative comments.
- `Write` tool refuses existing files — use `edit` for edits.
- Never commit unless asked.
- Rollout order: §2 → §1 → §3 (avoids App.tsx merge conflicts; §1 depends on §2).

## Rollout

| Phase | Tasks | Depends on |
|---|---|---|
| A — focusParam (§2) | A1–A6 | — |
| B — cascade (§1) | B1–B5 | Phase A |
| C — StackPanel (§3) | C1–C4 | Phase A (App.tsx) |

---

## Phase A — focusParam (Section 2)

### A1. App.tsx — own `focusParam` state and wire hosts

**Files:** `src/App.tsx`

1. Add state next to `panelOpen`:
   ```tsx
   const [focusParam, setFocusParam] = useState<string | null>(null)
   ```
2. Pass to `FloatingPanel`:
   ```tsx
   <FloatingPanel
     item={selected}
     onClose={() => setPanelOpen(false)}
     focusParam={focusParam}
     onFocusParamClear={() => setFocusParam(null)}
   />
   ```
3. Pass setter into `AudioReactPanel` so the pick handler can set it:
   ```tsx
   <AudioReactPanel onFocusParam={setFocusParam} />
   ```
4. Clear `focusParam` when `selectedUid` changes (stale target):
   ```tsx
   useEffect(() => {
     setPanelOpen(true)
     setFocusParam(null)
   }, [selectedUid])
   ```

**Accept:** App compiles; no behavior change yet (props optional downstream).

### A2. AudioReactPanel — accept `onFocusParam`, emit on pick

**Files:** `src/ui/AudioReactPanel.tsx`

1. Extend props:
   ```tsx
   interface AudioReactPanelProps {
     onFocusParam?: (focus: string | null) => void
   }
   ```
2. Update `handlePickMegaMenu` (currently lines ~284–292) to also emit focus:
   ```tsx
   const handlePickMegaMenu = useCallback(
     (itemUid: string, param: string) => {
       selectTool(itemUid)
       setTargetParam(param)
       setCreatorOpen(true)
       setMegaOpen(false)
       onFocusParam?.(param)
     },
     [selectTool, onFocusParam],
   )
   ```
   Note: current `onPick` contract is `(itemUid, param)` where `param` is already the full `"${effectUid}.${paramUid}"` string (NodeOptionsEffects binding key format, line 142: `const key = \`${e.uid}.${c.param}\``). Keep that contract; B3 will ensure the cascade emits the same key shape.

**Accept:** Pick from mega menu sets App `focusParam`; FloatingPanel receives it.

### A3. FloatingPanel — pass-through props to NodeOptions

**Files:** `src/ui/FloatingPanel.tsx`

1. Extend props:
   ```tsx
   interface FloatingPanelProps {
     item: StackItem | null
     onClose: () => void
     focusParam?: string | null
     onFocusParamClear?: () => void
   }
   ```
2. Forward at the mount site (line ~202):
   ```tsx
   <NodeOptions
     item={item}
     focusParam={focusParam}
     onFocusParamClear={onFocusParamClear}
   />
   ```

**Accept:** Props reach NodeOptions; no UI change yet.

### A4. NodeOptions — force Effects tab on focusParam, forward down

**Files:** `src/ui/NodeOptions.tsx`

1. Extend props with `focusParam?: string | null` and `onFocusParamClear?: () => void`.
2. When `focusParam` becomes non-null, switch tab:
   ```tsx
   useEffect(() => {
     if (focusParam) setTab('effects')
   }, [focusParam])
   ```
3. Forward to `NodeOptionsEffects`:
   ```tsx
   <NodeOptionsEffects
     item={item}
     focusParam={focusParam}
     onFocusParamClear={onFocusParamClear}
   />
   ```
   Find the existing `<NodeOptionsEffects item={item} />` mount and extend it.

**Accept:** Setting `focusParam` switches Node Options to the Effects tab.

### A5. NodeOptionsEffects — expand, scroll, focus, one-shot clear

**Files:** `src/ui/NodeOptionsEffects.tsx`

1. Extend props:
   ```tsx
   interface NodeOptionsEffectsProps {
     item: StackItem
     focusParam?: string | null
     onFocusParamClear?: () => void
   }
   ```
2. Parse `focusParam` as `"${effectUid}.${param}"` (split on first `.`; effect UIDs must not contain `.` — verify against `addEffect` uid generation; if they can, use `lastIndexOf`/`indexOf` carefully — current keys at line 142 use `${e.uid}.${c.param}`, so split on **first** `.` from the left is wrong if uid has dots; use the same construction: find the effect whose `uid` is a prefix of `focusParam` followed by `.`).
3. On `focusParam` change (and non-null):
   - Add `effectUid` to `openCards` (force-expand).
   - `requestAnimationFrame` → locate row control `#${CSS.escape(key)}` (the `label htmlFor={key}` / input `id={key}` already exist, lines 148–149) or a wrapper `data-focus-key={key}`; call `scrollIntoView({ block: 'nearest' })` on the row wrapper and `.focus()` on the primary control (sensitivity slider / first interactive input).
   - Call `onFocusParamClear?.()` after handling (one-shot).
4. If `effectUid` not found in `item.effects`: `console.warn` in dev only, still call clear (no-op path from spec error handling).
5. Ensure the sensitivity control for a bound param is visible without extra disclosure — current structure already renders control rows when `isOpen`; expansion in step 3 covers it. No chevron nesting beyond the existing card.

**Accept (manual or RTL):** Pick a param → Effects tab active, card expanded, row focused; second focusParam re-targets; no sticky hijack after clear.

### A6. Inline form → read-only chip (spec §2 demotion)

**Files:** `src/ui/AudioReactPanel.tsx`, `src/ui/PresetRail.tsx`

Spec: the soundbar inline form must not be a second editable surface. Demote to a chip once a binding exists for the current `targetParam` on `selected`.

1. In `PresetRail` (where `creatorOpen &&` renders the form, ~line 223): if `selected` already has `audio.find(b => b.param === key)`, render a compact chip instead of the full form:
   ```
   React to: {binding.source} · Sens {Math.round(binding.amount*100)}%
   ```
   Chip is a button: click → `onFocusParam?.(key)` (thread `onFocusParam` through `PresetRail` props from `AudioReactPanel`) and ensure `panelOpen`/FloatingPanel is visible (already auto-opens on `selectedUid`; if same uid, chip click only re-emits focusParam).
2. Keep the full form for the **create** path (no existing binding for `targetParam`).
3. Chip uses existing tokens only; no new colors.

**Accept:** After commit, reopening Add/edit for a bound param shows chip; click re-focuses the same NodeOptions row; no duplicate editor.

### A7. Phase A tests

**Files:**
- `src/ui/FloatingPanel.test.tsx` — extend: renders with `focusParam`, forwards to NodeOptions (mock or integration).
- `src/ui/NodeOptionsEffects.test.tsx` — new cases:
  - expands target effect card on `focusParam`
  - calls `onFocusParamClear` once
  - missing effectUid → clear + no crash
- Keep full suite green: `npx vitest run`.

**Run:** `npx vitest run` then `npm run build`.

---

## Phase B — presets cascade (Section 1)

### B1. Rewrite PresetMegaMenu interaction model

**Files:** `src/ui/PresetMegaMenu.tsx` (rewrite in place; keep export name and file)

Current: 3-step click cascade (`step: 1|2|3`), columns hidden until prior selection, sticky "Apply modulation" footer.

Target (spec §1 table):

1. **Always-visible columns.** On open, render all three columns immediately. Remove `step` gating (`step < N && 'hidden'`).
2. **Data sources (clarified vs spec — verified 2026-10-12):**
   - `presets.ts` holds **AudioRecipe** entries (`AUDIO_RECIPES`) with `whatItDoes` / `consequence` / `risk` at **recipe** level, not a per-effect param catalog. Col 2 must NOT be "presets.ts catalog".
   - Col 1: scene layers from `useProjectStore` stack (already).
   - Col 2: **effect instances on the hovered layer** (`item.effects`, labels via `EFFECTS[e.type]` from `engine/effects`) + trailing **"Tool params (no effect)"** row (same as current mega menu; covers plain tool sliders). This matches `targetOptions` keys exactly.
   - Col 3: slider controls (`c.kind === 'slider'`) of the hovered effect instance, or of the tool when the "Tool params" pseudo-row is hovered. Key format: effect → `` `${e.uid}.${c.param}` ``; tool → `c.param`.
   - Secondary text on col-3 rows: use `EFFECTS` control label + range. If a control matches an `AUDIO_RECIPES[].bindings[]` entry (`effectType` + `param`), optionally surface that recipe's `risk` one-liner as a hint — nice-to-have, not blocking.
3. **Hover fills:**
   - Hover layer (col 1) → set `hoveredLayerUid`; col 2 fills; col 3 defaults to **first** effect of catalog (pre-hovered).
   - Hover effect (col 2) → set `hoveredEffectUid`; col 3 fills with that effect's params.
   - Hover param (col 3) → highlight only; **click commits**.
4. **Default pre-hover on open:** first layer, first effect, (param highlight optional until hover). On close/reopen, restore last `hoveredLayerUid` / `hoveredEffectUid` / scroll positions (component state persists across unmount? No — parent unmounts via `megaOpen &&`. Lift hover state to `AudioReactPanel` **or** keep in a module-level ref map; prefer lifting minimal state: `lastHoverRef` inside `PresetMegaMenu` is lost on unmount, so store `hoveredLayerUid`/`hoveredEffectUid`/scrollTops in `AudioReactPanel` and pass as optional `initialState`/`onHoverChange` — **simplest:** keep a `useRef` map in `AudioReactPanel` and pass `restore` prop).
5. **Scroll restore:** each column body `overflow-y-auto`; on close store `scrollTop` per column in ref map; on open restore in `useLayoutEffect`.
6. **Commit:** call `onPick(layerUid, `${effectUid}.${paramUid}`)` then `onClose()`. Remove sticky footer "Apply modulation" (click on param row is the commit). Keep Escape → close + return focus to opener.
7. **A11y:** roving `tabIndex` across all rows (single tab stop on popover, `aria-activedescendant`); arrow keys move hover; Enter commits when a param row is active. Escape closes.
8. **Empty layers:** if `stack.length === 0`, popover shows "Empty scene — add a tool first." and Add Preset is disabled with tooltip (spec error handling) — disable at the button in `PresetRail`/`AudioReactPanel`.

**Layout tokens:** width `min(720px, 100vw-32px)`, three columns, `rounded-[12px] border border-border bg-surface-panel`, header row with step labels, rows min-h 32px, hover ring `--primary-300`, selected ring lime (`--primary-600` / existing primary). Popover anchored above presets rail (bottom sheet of Audio Reactivity Panel) — position absolute within the panel footer, not `position:fixed`.

**Keep:** export name `PresetMegaMenu`, prop `onPick`/`onClose` signature (param string is the composite key).

### B2. AudioReactPanel / PresetRail — single entry point

**Files:** `src/ui/PresetRail.tsx`, `src/ui/AudioReactPanel.tsx`

1. **Delete** the "Browse scene presets" button (`aria-label="Browse scene presets"`, LayoutGrid icon, ~PresetRail lines 201–210). Remove unused `LayoutGrid` import if unused elsewhere in file.
2. **Keep** "Add Preset" (`aria-label="Add Preset"`, Plus icon). Wire it to open the cascade:
   - `aria-expanded={megaOpen}`
   - `aria-controls` → cascade popover id (add stable id on `PresetMegaMenu` root, e.g. `id="preset-cascade"`).
   - `onClick={() => setMegaOpen(v => !v)}` — today it toggles `creatorOpen`; switch to `megaOpen`. The inline **create** form remains reachable via edit path / chip path; new-modulation creation goes through cascade → commit → creator form for React To + sensitivity (spec commit contract still calls `setCreatorOpen(true)`).
3. Disable Add Preset when `stack.length === 0` with `title="Add a tool first"`.
4. Pass restore-state props into `PresetMegaMenu` (from B1).

**Accept:** Only one Add button; it opens the cascade; Browse button gone.

### B3. Commit payload parity (verified)

**Files:** `src/ui/PresetMegaMenu.tsx`, `src/ui/AudioReactPanel.tsx`

`targetOptions` (AudioReactPanel ~184–201) already builds:
- tool sliders → `key: c.param`
- effect sliders → `key: `${e.uid}.${c.param}``

matching NodeOptionsEffects binding keys. Cascade col 2 lists **the same layer's** effect instances, so every col-3 key is already an option in `targetOptions`.

**Action:** col-3 click emits `onPick(layerUid, key)` with that exact key. `handlePickMegaMenu` does `setTargetParam(key)` — the `<select>` matches without falling back to `[0]`. No `targetOptions` change needed.

### B4. Cascade tests

**Files:** `src/ui/AudioReactPanel.test.tsx` (update), new `src/ui/PresetMegaMenu.test.tsx`

Update existing mega-menu tests in `AudioReactPanel.test.tsx` (grep hits for `Browse scene presets` / `Add Preset`):
- One entry point: no "Browse scene presets" button.
- Add Preset opens cascade (`id="preset-cascade"` visible).
- Open → first layer pre-hovered, first effect pre-hovered, params visible.
- Hover effect row updates col 3 without click.
- Commit calls `onPick` with composite key and closes.
- Close/reopen restores hover + scroll (mock `scrollTop`).
- Empty stack → Add disabled.

**Run:** `npx vitest run`.

### B5. Phase B verification

- `npx vitest run` — full suite green.
- `npm run build` — tsc + vite green.
- Manual (optional, patchright): open cascade, hover fill, commit → focusParam path from Phase A.

---

## Phase C — StackPanel (Section 3)

### C1. New StackPanel component

**Files:** `src/ui/StackPanel.tsx` (new)

Anatomy (spec §3), verified against `StackCanvasOverlay.tsx` (42 lines, pointer-drag on `[data-panel-drag-handle]`, wraps `StackVertical`) and `StackVertical.tsx` (already renders grip + "Stack · N" header + empty state "Empty — add a tool to begin"):

```
<aside id="stack-panel" data-testid="stack-panel"
       style={{ position:'absolute', top:'calc(var(--topbar-h) + 12px)', left:12 }}
       className="z-10 flex max-h-[calc(100vh-var(--topbar-h)-var(--soundbar-height)-32px)] w-[248px] flex-col rounded-[12px] border border-border bg-surface-panel shadow-2xl">
  header: Grip drag handle + "Stack · {n}" + Plus add + collapse Chevron
  body:   <StackVertical hideHeader />  (list + HTML5 DnD only)
</aside>
```

1. **Initial top offset:** TopBar lives inside the canvas `<section>` which fills `<main>`; absolute `top:12` from main would paint under TopBar. Use `top: calc(var(--topbar-h) + 12px)` so the panel starts below TopBar. Soundbar is a sibling *after* main — `bounds: main` already prevents overlap.
2. **GSAP Draggable** on header only:
   ```tsx
   gsap.registerPlugin(Draggable)
   useEffect(() => {
     const main = document.getElementById('main-content')
     const el = panelRef.current
     if (!el || !main) return
     const d = Draggable.create(el, {
       type: 'x,y',
       trigger: headerRef.current,
       bounds: main,
       inertia: false,
       edgeResistance: 0.85,
     })[0]
     return () => d.kill()
   }, [])
   ```
3. **Height:** content-sized list with internal scroll; max-height per spec CSS calc. `StackVertical` already has `max-h-full min-h-0` — ensure parent clips.
4. **Add-component button:** Plus → open `Catalog` anchored to the panel (reuse `Catalog` from `Stack.tsx`; lift the addAbove pattern or open a simple popover). Overlay had no add — this is new chrome per spec.
5. **Collapse:** chevron toggles body visibility (`useState` only).
6. **Kebab / rows:** reuse `NodeRow` via `StackVertical` — do not reimplement.
7. **Empty state:** already in `StackVertical` ("Empty — add a tool to begin") — single message; no canvas duplicate to remove (overlay had none).
8. **Pointer events:** header/body `stopPropagation` on pointerdown so canvas pan does not steal. Row HTML5 DnD unchanged.

**Stacking note:** `section` has `relative` but no z-index (no stacking context). TopBar uses viewport chrome z (~40); panel uses local `z-10` → TopBar stays above even if rects overlap; initial top offset keeps the header clickable.

### C2. StackVertical — optional header hide

**Files:** `src/ui/StackVertical.tsx`

1. Add prop `hideHeader?: boolean`.
2. When true, skip the internal grip/drag-handle header (lines ~70–80+) and render only the list + drop placeholder. StackPanel owns the chrome drag; row HTML5 DnD reorder unchanged (`moveToolTo`).
3. Keep `data-panel-drag-handle` behavior for any legacy callers only when header visible.

**Accept:** No double headers; reorder still works inside StackPanel.

### C3. App.tsx — mount StackPanel, remove overlay

**Files:** `src/App.tsx`

1. Delete `import { StackCanvasOverlay } from './ui/StackCanvasOverlay'` and the `<StackCanvasOverlay />` mount (line 52).
2. `<main>` already has `id="main-content"`; ensure `position: relative` (add `relative` to className: currently `flex min-h-0 flex-1` → `relative flex min-h-0 flex-1`).
3. Mount `<StackPanel />` as **sibling of the canvas section inside main** (not inside the section):
   ```tsx
   <main id="main-content" className="relative flex min-h-0 flex-1" tabIndex={-1}>
     <section className="flex flex-col flex-1 min-w-0 relative overflow-hidden bg-[hsl(var(--bg-canvas))]" data-testid="canvas-container">
       <TopBar ... />
       <CanvasArea ...>
         <Canvas />
       </CanvasArea>
       {selected === null && (...)}
     </section>
     <StackPanel />
   </main>
   ```
4. Do **not** use viewport z-tokens; panel uses local `z-10` inside main (spec).

**Accept:** Panel is a child of `<main>`, `position:absolute` (never fixed); initial top clears TopBar (`calc(var(--topbar-h) + 12px)`); drag clamped to main bounds; soundbar never overlapped (main ends above it).

### C4. Deletes + tests

**Files:**
- Delete `src/ui/StackCanvasOverlay.tsx`
- Delete `src/ui/FloatingStack.tsx`
- Delete `src/ui/FloatingStack.test.tsx` (14 orphan tests)
- Grep for any remaining imports of these three; fix.

**Tests:**
- New `src/ui/StackPanel.test.tsx`:
  - Renders inside a `main#main-content` fixture; `position` absolute; not fixed.
  - Header drag creates Draggable with bounds = main (assert via mock or instance).
  - Empty state message once.
  - Height grows with N items (style/class assertion).
- Port/keep `StackDnD.test.tsx` reorder tests (should pass against StackVertical/NodeRow unchanged).
- Pan-canvas tests still pass (no overlay in the way).

**Run:** `npx vitest run` && `npm run build`.

---

## Final verification (all phases)

1. `npx vitest run` — full suite; baseline 259 − 14 (deleted FloatingStack tests) + new tests; no regressions.
2. `npm run build` — clean.
3. Manual patchright @ 1440×900 (optional but recommended):
   - Cascade open → hover fill → commit → Effects tab + row focused.
   - Chip re-focus.
   - Stack drag clamped to main; no TopBar overlap; canvas pan unaffected.
4. Grep hygiene: no `as any`, no `@ts-ignore`, no new deps in `package.json`.

## Risk notes

| Risk | Mitigation |
|---|---|
| `focusParam` effect-uid contains `.` | Match by prefix `effectUid + '.'` against known effects, not blind split. |
| StackPanel overlays TopBar | Initial top below `--topbar-h`; bounds = main. |
| GSAP Draggable in jsdom | Existing FloatingPanel tests already handle this pattern — reuse their mock/setup. |
| Creator form vs chip dual surface | A6 keeps form only for create path; chip for bound param. |

## Out of scope (backlog)

- Soundbar status-bar copy pass (`ctx:missing` etc.).
- `AudioPresetMenu.tsx` orphan cleanup.
- Full a11y audit beyond cascade roving tabindex.
