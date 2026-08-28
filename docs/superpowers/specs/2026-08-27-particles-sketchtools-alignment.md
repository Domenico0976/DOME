# Particles Tool Alignment to Sketch Tools

## Problem
The Particles tool in DOME does not match the behavior, parameter ranges, or visual output of Sketch Tools (tools.sketchdesign.club). Users perceive it as "broken" because:
1. Legacy `flowfield` nodes open as "Unknown tool".
2. All parameters for all 4 modes are shown at once, making many controls feel inactive.
3. The Chladni mode produces rigid grid-like stars instead of organic nodal lines.
4. Parameter labels and ranges do not match the reference.

## Root causes
1. `schema.ts` migrates `flowfield` v1 to v2.0.0, but only `flowfield` v4.0.0 is registered, so `resolveTool` returns `undefined`.
2. `NodeOptions.tsx` renders every `ControlDef` without filtering by the active `mode`.
3. The Chladni shader adds deformation/overtones and uses a threshold that emphasizes isolated bright points rather than continuous zero-crossing lines.
4. Sliders use integer steps and narrow ranges (e.g. `Amp A` 1-6 step 1).

## Design

### 1. Legacy node migration
In `schema.ts`, add a `toolId` remapping step **before** version resolution:
- `toolId: 'flowfield'` → `toolId: 'particles'`, `toolVersion: '3.0.0'`, `params.mode = 'flow'`.
- Map legacy `density` → `density` and legacy `hue` → `color` via `hslToHex`.
- Keep the standalone `flowfield` tool registered for backward compatibility; only legacy v1 nodes are remapped.

### 2. Conditional control rendering
- Add optional `modes?: string[]` to `ControlDef` in `core/types.ts`.
- In `ui/NodeOptions.tsx`, skip controls whose `modes` array does not include the current `mode`.
- Tag every mode-specific control in `tools/generative/particles.ts` with the correct `modes` array.

### 3. Chladni shader rewrite
Replace the current overtone-based formula with the classic continuous Chladni figure:
```
chladni = a * sin(m * freq * x) * sin(n * freq * y)
        - b * sin(n * freq * x) * sin(m * freq * y)
```
where `x,y` are centered coordinates. Density is derived from the distance of `chladni` from zero, producing smooth nodal lines.

### 4. Parameter labels and ranges
Align Particles controls with Sketch Tools conventions:
- `Amp A/B` → `Amplitude A/B`, range 0-10 step 0.1.
- `Freq X/Y` → range 0-20 step 0.1.
- `Frequency` → range 0-20 step 0.1.
- `Rot Speed` → `Rotation Speed`.
- `Grid Density` → `Density`.
- `Opacity (%)` → `Opacity`.
- Remove the confusing `count` parameter (labelled `Modes`); it is not part of the reference behavior.

### 5. Validation
- Update `schema.test.ts` to assert the new `flowfield` → `particles(mode:flow)` migration.
- Run `npm test` and `npm run build`.
- Use camofox/Playwright to compare each Particles mode side-by-side with Sketch Tools at matching parameter values.
- Verify audio reactivity on `Frequency`, `Density`, `Rotation Speed`, and `Wave Speed`.

## Files to modify
- `tools-app/src/core/types.ts`
- `tools-app/src/core/schema.ts`
- `tools-app/src/core/schema.test.ts`
- `tools-app/src/ui/NodeOptions.tsx`
- `tools-app/src/tools/generative/particles.ts`
- `tools-app/src/engine/shaders/particles.ts`
- `tools-app/src/tools/generative/particles.test.ts` (update legacy params to v3.0.0)
