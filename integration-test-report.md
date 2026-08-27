# DOME WebGL Migration — Integration Testing Report

**Status: DONE**

---

## Build Results

| Step | Result |
|------|--------|
| `npm run build` (tsc + vite) | ✅ PASS — 2008 modules, 3.08s |
| TypeScript (`tsc --noEmit`) | ✅ PASS — zero errors |
| Vite production bundle | ✅ PASS — index.js 574 kB, index.css 30 kB |

---

## Test Results

| Metric | Value |
|--------|-------|
| Test files | 32 passed (0 failed) |
| Total tests | 123 passed, 1 skipped |
| Duration | ~5s |

### All passing test files
- `src/engine/cpu-fallback.test.ts` (8)
- `src/core/schema.test.ts` (7)
- `src/audio/bands.test.ts` (9)
- `src/engine/rd.test.ts` (6)
- `src/core/registry.test.ts` (3)
- `src/core/stackEngine.test.ts` (4)
- `src/tools/generative/tunnel.test.ts` (1)
- `src/tools/generative/flowfield.test.ts` (1)
- `src/tools/generative/particles.test.ts` (2)
- `src/state/projectStore.test.ts` (10)
- `src/engine/effects/framework.test.ts` (12)
- `src/state/projectStore.effects.test.ts` (1)
- `src/tools/generative/liquidmetal-molecules.test.ts` (2)
- `src/tools/index.test.ts` (6)
- `src/tools/generative/ferrofluid.test.ts` (2)
- `src/tools/generative/shaders.test.ts` (2)
- `src/ui/AudioPresetMenu.test.tsx` (5)
- `src/ui/Catalog.test.tsx` (2)
- `src/ui/FloatingStack.test.tsx` (3)
- `src/ui/Canvas.test.tsx` (3)
- `src/ui/CanvasArea.test.tsx` (3)
- `src/ui/Stack.test.tsx` (4)
- `src/ui/AudioReactPanel.test.tsx` (3)
- `src/ui/AudioBar.test.tsx` (2)
- `src/ui/FloatingPanel.test.tsx` (4)
- `src/ui/ExportMenu.test.tsx` (4)
- `src/ui/NodeOptions.test.tsx` (6)
- `src/ui/NodeOptionsEffects.test.tsx` (2)
- `src/ui/toolIcon.test.tsx` (1)
- `src/App.test.tsx` (1)
- `src/engine/compositor.test.ts` (2)

**Skipped test:** `phase2-tools.test.ts > brutalist draws cols x rows cells` — Brutalist is WebGL2-only; jsdom cannot provide a GL context.

---

## Lint Results

| Step | Result |
|------|--------|
| `npm run lint` (ESLint .ts/.tsx) | ✅ PASS — 0 errors, 0 warnings |

---

## Issues Found & Fixed

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `src/App.tsx:27` | Empty catch block (`no-empty`) | Added `void e` to acknowledge intentional suppression |
| 2 | `src/engine/effects/framework.test.ts:47` | `any` types for `source`/`curve` | Replaced with `NonNullable<AudioBinding['source']>` and `AudioBinding['curve']` |
| 3 | `src/state/projectStore.effects.test.ts:13` | `let item` should be `const` | Changed to `const` |
| 4 | `src/test/setup.ts:20` | Unnecessary semicolon before expression | Removed stray `;` |
| 5 | `src/tools/generative/particles.test.ts:25` | Unused `_a` parameter | Removed parameter name |
| 6 | `src/tools/generative/phase2-tools.test.ts` | Unused `_a` + WebGL-only brutalist failing | Removed unused import, skipped test with explanation |

**Commit:** `c020065` — `fix(dome): clean lint errors and skip WebGL-only brutalist test in jsdom`

---

## Tool Registry Verification

All 26 tools registered and importable:

| Category | Count | IDs |
|----------|-------|-----|
| Inputs | 6 | audioFile, camera, gradient, imageVideo, solidColor, text |
| Generative | 14 | brutalist, doodle, ferrofluid, flowfield, kaleidoscope, liquidmetal, molecules, particles, particles2, plasma, rings, shaders, starfield, tunnel |
| Filters | 6 | facets, halftone, pixelator, reLight, thermal, typeShape |

All shader files present in `src/engine/shaders/`:
- brutalist.ts, ferrofluid.ts, flowfield.ts, liquidmetal.ts, molecules.ts, noise.ts, particles.ts, plasma.ts, rings.ts, shaders.ts, starfield.ts, tunnel.ts

---

## Remaining Concerns

- **1 skipped test** (`brutalist` in jsdom) — expected and documented. The tool is WebGL2-only as intended by the migration scope. Would need a real browser or WebGL canvas mock to test.
- **stderr noise** from `HTMLCanvasElement's getContext()` — these are non-fatal warnings from jsdom lacking the `canvas` npm package. Not blocking.
- **Large bundle** (~574 kB) — pre-existing warning about chunk size; not introduced by this migration.

---

**Final commit hash:** `c020065`
