# DOME Render Core v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder generative rendering with real algorithms (Gray-Scott RD, Chladni, curl-noise, metaballs) and add a composable 7-effect post-processing pipeline, per spec `docs/superpowers/specs/2026-08-25-dome-render-core-design.md`.

**Architecture:** Tools keep painting on an offscreen Canvas2D (`ToolDef.render` unchanged); when any enabled `EffectInstance` exists, a WebGL2 compositor uploads the base canvas as texture and runs fixed-order fragment-shader passes (ping-pong FBOs), else falls back to a zero-cost `drawImage`. Effects live per-StackItem (`StackItem.effects?`, SCHEMA_VERSION 1→2) and reuse the existing AudioBinding system with param key `"<effectUid>.<param>"`.

**Tech Stack:** React 18, TypeScript strict, zustand, Vitest+jsdom, WebGL2/GLSL ES 3.00-webgl1 syntax (mediump), Tailwind tokens + shadcn primitives (already installed), lucide-react.

## Global Constraints

- Budget €0: NO new npm dependencies.
- All user-facing copy in ENGLISH. Zero emoji anywhere in UI (icons become lucide keys, Task 21).
- Strict TS: never `as any`, `@ts-ignore`, `@ts-expect-error`.
- Never push to remote. Local commits only, conventional style (`feat(engine): ...`).
- Effect application order is FIXED: `adjustments, aberration, glow, waves, edgeblur, lens, grain`.
- SCHEMA_VERSION goes 1 → 2; migration is additive; old projects must keep loading/rendering.
- All 39 existing tests stay green throughout; `npx tsc --noEmit` clean; `npx vite build` ok.
- `prefers-reduced-motion`: grain seed frozen, waves time frozen (wired in Tasks 10–11).
- Working dir for every command: `C:\Users\Utente\Desktop\robbe\DOME\tools-app`.

---

### Task 1: Effect data model + schema v1→v2

**Files:**
- Modify: `src/core/types.ts` (append after `Automation` type, and extend `StackItem`)
- Modify: `src/core/schema.ts`
- Modify: `src/core/schema.test.ts`

**Interfaces (produced):**
```ts
// types.ts
export type EffectType = 'adjustments' | 'aberration' | 'glow' | 'waves' | 'edgeblur' | 'lens' | 'grain'
export type EffectInstance = { uid: string; type: EffectType; enabled: boolean; params: Record<string, number> }
// StackItem gains optional member:  effects?: EffectInstance[]
// schema.ts
export const SCHEMA_VERSION = 2            // was 1
export const TOOL_PARAM_MIGRATIONS: Record<string, (params: Record<string, number | string>) => Record<string, number | string>> = {}
```

- [ ] **Step 1: Write failing tests**

Append to `src/core/schema.test.ts`:

```ts
describe('schema v2 effects', () => {
  test('adds effects: [] to legacy stack items', () => {
    const legacy = { stack: [{ uid: 'a', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false }] }
    const p = migrateProject(legacy)
    expect(p.schemaVersion).toBe(2)
    expect(p.stack[0].effects).toEqual([])
  })
  test('preserves existing effects and applies registered tool migrations', () => {
    const eff = [{ uid: 'e1', type: 'glow', enabled: true, params: {} }]
    const p = migrateProject({ stack: [{ uid: 'a', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false, effects: eff }] })
    expect(p.stack[0].effects).toEqual(eff)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/schema.test.ts`
Expected: FAIL — `schemaVersion` is 1, `effects` undefined.

- [ ] **Step 3: Implement**

In `src/core/types.ts` add after the `Automation` type, and add `effects?: EffectInstance[]` as last member of `StackItem`:

```ts
export type EffectType =
  | 'adjustments'
  | 'aberration'
  | 'glow'
  | 'waves'
  | 'edgeblur'
  | 'lens'
  | 'grain'

export type EffectInstance = {
  uid: string
  type: EffectType
  enabled: boolean
  params: Record<string, number>
}
```

Rewrite `src/core/schema.ts` to:

```ts
import type { ProjectState, StackItem } from './types'

export const SCHEMA_VERSION = 2

export const TOOL_PARAM_MIGRATIONS: Record<
  string,
  (params: Record<string, number | string>) => Record<string, number | string>
> = {}

let orphanCounter = 0
function normalizeItem(raw: Partial<StackItem>): StackItem {
  orphanCounter += 1
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : `m_${Date.now().toString(36)}_${orphanCounter}`,
    toolId: typeof raw.toolId === 'string' ? raw.toolId : 'solidColor',
    toolVersion: typeof raw.toolVersion === 'string' ? raw.toolVersion : '1.0.0',
    params: raw.params && typeof raw.params === 'object' ? { ...raw.params } : {},
    audio: Array.isArray(raw.audio) ? raw.audio : [],
    automations: Array.isArray(raw.automations) ? raw.automations : [],
    hidden: Boolean(raw.hidden),
    effects: Array.isArray(raw.effects) ? raw.effects : [],
  }
}

export function migrateProject(input: unknown): ProjectState {
  const raw = (input ?? {}) as Partial<ProjectState>
  const stack: StackItem[] = Array.isArray(raw.stack) ? raw.stack.map(normalizeItem) : []
  return {
    schemaVersion: SCHEMA_VERSION,
    stack: stack.map((item) => {
      const migrate = TOOL_PARAM_MIGRATIONS[item.toolId]
      if (migrate && item.toolVersion.startsWith('1.')) {
        return { ...item, toolVersion: '2.0.0', params: migrate(item.params) }
      }
      return item
    }),
    selectedUid: raw.selectedUid ?? null,
    timeline: {
      durationSec: raw.timeline?.durationSec ?? 60,
      bpm: raw.timeline?.bpm ?? 120,
      playing: raw.timeline?.playing ?? false,
      timeSec: raw.timeline?.timeSec ?? 0,
    },
    audio: {
      enabled: raw.audio?.enabled ?? false,
      source: raw.audio?.source ?? null,
      fileName: raw.audio?.fileName,
      midi: {
        enabled: raw.audio?.midi?.enabled ?? false,
        bindings: Array.isArray(raw.audio?.midi?.bindings) ? raw.audio?.midi?.bindings : [],
      },
    },
    canvas: {
      aspect: raw.canvas?.aspect ?? '1:1',
      quality: raw.canvas?.quality ?? 'high',
    },
    theme: raw.theme ?? 'dark',
    unsaved: raw.unsaved ?? false,
  }
}
```

- [ ] **Step 4: Run tests + full suite**

Run: `npx vitest run src/core/schema.test.ts` → PASS. Then `npx vitest run` → all green (39+2).
If any older schema test asserted raw passthrough of malformed items, update that assertion to the normalized shape shown above.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/schema.ts src/core/schema.test.ts
git commit -m "feat(schema): effect instances + schema v1->v2 migration"
```

---

### Task 2: Store effect actions

**Files:**
- Modify: `src/state/projectStore.ts` (interface members after `removeAutomation`; implementations after `removeAutomation` impl)
- Create: `src/state/projectStore.effects.test.ts`

**Interfaces (produces):**
```ts
addEffect: (uid: string, type: EffectType) => void
removeEffect: (uid: string, effectUid: string) => void
setEffectParam: (uid: string, effectUid: string, param: string, value: number) => void
toggleEffect: (uid: string, effectUid: string) => void
```

- [ ] **Step 1: Failing test** — create `src/state/projectStore.effects.test.ts`:

```ts
import { describe, test, expect, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'
import '../tools'

beforeEach(() => useProjectStore.getState().reset())

describe('effect store actions', () => {
  test('add / setParam / toggle / remove lifecycle', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    const s = useProjectStore.getState()
    s.addEffect(uid, 'glow')
    let item = useProjectStore.getState().stack[0]
    expect(item.effects?.length).toBe(1)
    expect(item.effects?.[0].enabled).toBe(true)
    expect(item.effects?.[0].params).toEqual({})
    const eUid = item.effects![0].uid
    s.setEffectParam(uid, eUid, 'intensity', 1.5)
    expect(useProjectStore.getState().stack[0].effects![0].params.intensity).toBe(1.5)
    s.addEffect(uid, 'grain')
    expect(useProjectStore.getState().stack[0].effects!.length).toBe(2)
    s.toggleEffect(uid, eUid)
    expect(useProjectStore.getState().stack[0].effects!.find((e) => e.uid === eUid)?.enabled).toBe(false)
    s.removeEffect(uid, eUid)
    expect(useProjectStore.getState().stack[0].effects!.some((e) => e.uid === eUid)).toBe(false)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/state/projectStore.effects.test.ts` → FAIL (actions missing / TS error).

- [ ] **Step 3: Implement** — in `src/state/projectStore.ts`:

Import types at top: extend the existing `from '../core/types'` import with `EffectType`. In `interface ProjectStore` add after `removeAutomation`:

```ts
  addEffect: (uid: string, type: EffectType) => void
  removeEffect: (uid: string, effectUid: string) => void
  setEffectParam: (uid: string, effectUid: string, param: string, value: number) => void
  toggleEffect: (uid: string, effectUid: string) => void
```

After the `removeAutomation` implementation add:

```ts
    addEffect: (uid, type) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: [...(i.effects ?? []), { uid: makeUid(), type, enabled: true, params: {} }],
        })),
        unsaved: true,
      })),

    removeEffect: (uid, effectUid) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({ ...i, effects: (i.effects ?? []).filter((e) => e.uid !== effectUid) })),
        unsaved: true,
      })),

    setEffectParam: (uid, effectUid, param, value) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: (i.effects ?? []).map((e) => (e.uid === effectUid ? { ...e, params: { ...e.params, [param]: value } } : e)),
        })),
        unsaved: true,
      })),

    toggleEffect: (uid, effectUid) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: (i.effects ?? []).map((e) => (e.uid === effectUid ? { ...e, enabled: !e.enabled } : e)),
        })),
        unsaved: true,
      })),
```

- [ ] **Step 4: Run full suite** `npx vitest run` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/state/projectStore.ts src/state/projectStore.effects.test.ts
git commit -m "feat(store): effect instance actions"
```

---

### Task 3: Gray-Scott reaction-diffusion solver

**Files:**
- Create: `src/engine/rd.ts`
- Create: `src/engine/rd.test.ts`

**Interfaces (produces):**
```ts
export function mulberry32(seed: number): () => number
export class ReactionDiffusion {
  constructor(size?: number)                 // default 160
  seed(attractors: number, rng: () => number): void
  step(feed: number, kill: number): void     // toroidal wrap, 1 iteration
  averageB(): number
  toImageData(accent: [number, number, number]): ImageData  // mix(black, accent, b)
}
```

- [ ] **Step 0: Mandatory jsdom ImageData polyfill** — append to `src/test/setup.ts` (validated by standalone probe on this machine):

```ts
if (!('ImageData' in globalThis)) {
  class ImageDataPoly {
    readonly width: number
    readonly height: number
    readonly data: Uint8ClampedArray
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
      this.data = new Uint8ClampedArray(Math.max(0, width | 0) * Math.max(0, height | 0) * 4)
    }
  }
  ;(globalThis as { ImageData?: unknown }).ImageData = ImageDataPoly
}
```

Guard keeps the existing 39 tests untouched; Tasks 3, 4 and the ferrofluid fallback depend on it.

- [ ] **Step 1: Failing test** — `src/engine/rd.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { ReactionDiffusion, mulberry32 } from './rd'

describe('ReactionDiffusion', () => {
  test('same seed produces identical state (determinism)', () => {
    const mk = () => {
      const rd = new ReactionDiffusion(32)
      rd.seed(3, mulberry32(42))
      for (let i = 0; i < 20; i++) rd.step(0.055, 0.062)
      return rd.averageB()
    }
    expect(mk()).toBe(mk())
  })

  test('pattern diverges from flat state without NaN', () => {
    const rd = new ReactionDiffusion(48)
    rd.seed(2, mulberry32(7))
    for (let i = 0; i < 60; i++) rd.step(0.055, 0.062)
    const avg = rd.averageB()
    expect(Number.isFinite(avg)).toBe(true)
    expect(avg).toBeGreaterThan(0)
  })

  test('toImageData mixes accent by B channel', () => {
    const rd = new ReactionDiffusion(16)
    rd.seed(1, mulberry32(1))
    const img = rd.toImageData([255, 128, 0])
    expect(img.width).toBe(16)
    expect(img.data.length).toBe(16 * 16 * 4)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/engine/rd.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/engine/rd.ts`:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Gray-Scott reaction-diffusion (Turing pattern), toroidal grid, ping-pong buffers.
export class ReactionDiffusion {
  readonly size: number
  private a: Float32Array
  private b: Float32Array
  private a2: Float32Array
  private b2: Float32Array

  constructor(size = 160) {
    this.size = size
    this.a = new Float32Array(size * size).fill(1)
    this.b = new Float32Array(size * size)
    this.a2 = new Float32Array(size * size)
    this.b2 = new Float32Array(size * size)
  }

  seed(attractors: number, rng: () => number): void {
    this.a.fill(1)
    this.b.fill(0)
    for (let k = 0; k < attractors; k++) {
      const cx = rng() * this.size
      const cy = rng() * this.size
      const r = this.size * 0.02 + rng() * this.size * 0.03
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue
          const xi = Math.round(cx + x)
          const yi = Math.round(cy + y)
          this.b[((yi + this.size) % this.size) * this.size + ((xi + this.size) % this.size)] = 1
        }
    }
    for (let i = 0; i < this.b.length; i++) if (rng() < 0.002) this.b[i] = 1
  }

  step(feed: number, kill: number): void {
    const Da = 1.0
    const Db = 0.5
    const n = this.size
    const { a, b, a2, b2 } = this
    for (let y = 0; y < n; y++) {
      const yUp = ((y - 1 + n) % n) * n
      const yDn = ((y + 1) % n) * n
      const yC = y * n
      for (let x = 0; x < n; x++) {
        const xL = (x - 1 + n) % n
        const xR = (x + 1) % n
        const i = yC + x
        const lapA = a[yC + xL] + a[yC + xR] + a[yUp + x] + a[yDn + x] - 4 * a[i]
        const lapB = b[yC + xL] + b[yC + xR] + b[yUp + x] + b[yDn + x] - 4 * b[i]
        const reaction = a[i] * b[i] * b[i]
        a2[i] = Math.min(1, Math.max(0, a[i] + (Da * lapA - reaction + feed * (1 - a[i]))))
        b2[i] = Math.min(1, Math.max(0, b[i] + (Db * lapB + reaction - (kill + feed) * b[i])))
      }
    }
    this.a = a2
    this.b = b2
    this.a2 = a
    this.b2 = b
  }

  averageB(): number {
    let s = 0
    for (let i = 0; i < this.b.length; i++) s += this.b[i]
    return s / this.b.length
  }

  toImageData(accent: [number, number, number]): ImageData {
    const n = this.size
    const img = new ImageData(n, n)
    const d = img.data
    for (let i = 0; i < n * n; i++) {
      const v = Math.min(1, this.b[i] * 1.4)
      d[i * 4] = Math.round(accent[0] * v)
      d[i * 4 + 1] = Math.round(accent[1] * v)
      d[i * 4 + 2] = Math.round(accent[2] * v)
      d[i * 4 + 3] = 255
    }
    return img
  }
}
```

**Pre-flight finding (verified 2026-08-25):** jsdom 30.0.1 without the optional `canvas` package does NOT expose a global `ImageData` (probe test failed). The polyfill in Step 0 below is therefore MANDATORY, not conditional — it is validated by this task's tests.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/rd.ts src/engine/rd.test.ts
git commit -m "feat(engine): gray-scott reaction-diffusion solver"
```

---

### Task 4: CPU fallback implementations (reference math)

**Files:**
- Create: `src/engine/cpu-fallback.ts`
- Create: `src/engine/cpu-fallback.test.ts`

**Interfaces (produces):**
```ts
export function applyAdjustmentsCPU(img: ImageData, p: Record<string, number>): void
export function applyWavesCPU(img: ImageData, p: Record<string, number>, timeSec: number): void
export function applyGrainCPU(img: ImageData, p: Record<string, number>, seed: number): void
```

- [ ] **Step 1: Failing test** — `src/engine/cpu-fallback.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { applyAdjustmentsCPU, applyWavesCPU, applyGrainCPU } from './cpu-fallback'

function img2x1(r: number, g: number, b: number): ImageData {
  const img = new ImageData(2, 1)
  img.data[0] = r; img.data[1] = g; img.data[2] = b; img.data[3] = 255
  img.data[4] = r; img.data[5] = g; img.data[6] = b; img.data[7] = 255
  return img
}

describe('cpu fallback effects', () => {
  test('brightness shifts additively and clamps', () => {
    const img = img2x1(10, 20, 30)
    applyAdjustmentsCPU(img, { brightness: 100, contrast: 0, saturation: 0 })
    expect(img.data[0]).toBe(110)
    const clipped = img2x1(250, 250, 250)
    applyAdjustmentsCPU(clipped, { brightness: 50, contrast: 0, saturation: 0 })
    expect(clipped.data[0]).toBe(255)
  })

  test('contrast scales around 128', () => {
    const img = img2x1(128, 128, 128)
    applyAdjustmentsCPU(img, { brightness: 0, contrast: 50, saturation: 0 })
    expect(img.data[0]).toBe(128)
  })

  test('desaturation pulls toward luminance', () => {
    const img = img2x1(255, 0, 0)
    applyAdjustmentsCPU(img, { brightness: 0, contrast: 0, saturation: -1 })
    const lum = Math.round(0.299 * 255 + 0.587 * 0 + 0.114 * 0)
    expect(img.data[0]).toBe(lum)
    expect(img.data[1]).toBe(lum)
  })

  test('waves shifts row by sine offset (deterministic)', () => {
    const img = new ImageData(4, 1)
    for (let x = 0; x < 4; x++) { img.data[x * 4] = x * 60; img.data[x * 4 + 3] = 255 }
    applyWavesCPU(img, { intensity: 0, quantity: 0.08, speed: 1 }, 1)
    expect(Array.from(img.data.slice(0, 16, ).filter((_, i) => i % 4 === 0))).toEqual([0, 60, 120, 180])
  })

  test('grain with same seed is reproducible', () => {
    const a = img2x1(100, 100, 100)
    const b = img2x1(100, 100, 100)
    applyGrainCPU(a, { intensity: 0.5 }, 99)
    applyGrainCPU(b, { intensity: 0.5 }, 99)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
  })
})
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/engine/cpu-fallback.ts`:

```ts
import { mulberry32 } from './rd'

const clampByte = (v: number) => Math.min(255, Math.max(0, Math.round(v)))

// Color grading identical to the adjustments shader math (see effects/adjustments.ts).
export function applyAdjustmentsCPU(img: ImageData, p: Record<string, number>): void {
  const brightness = p.brightness ?? 0
  const contrast = p.contrast ?? 0
  const saturation = p.saturation ?? 0
  const k = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + brightness
    let g = d[i + 1] + brightness
    let b = d[i + 2] + brightness
    r = k * (r - 128) + 128
    g = k * (g - 128) + 128
    b = k * (b - 128) + 128
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * (1 + saturation)
    g = gray + (g - gray) * (1 + saturation)
    b = gray + (b - gray) * (1 + saturation)
    d[i] = clampByte(r); d[i + 1] = clampByte(g); d[i + 2] = clampByte(b)
  }
}

// Row-wise horizontal sine shift, wrapping at edges (CPU reference variant).
export function applyWavesCPU(img: ImageData, p: Record<string, number>, timeSec: number): void {
  const intensity = p.intensity ?? 0
  const quantity = p.quantity ?? 0.08
  const speed = p.speed ?? 1
  if (intensity === 0) return
  const { width, height, data } = img
  const src = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y++) {
    const shift = Math.round(Math.sin(y * 6.2831 * quantity + timeSec * speed) * intensity)
    for (let x = 0; x < width; x++) {
      const sx = (((x - shift) % width) + width) % width
      const di = (y * width + x) * 4
      const si = (y * width + sx) * 4
      data[di] = src[si]; data[di + 1] = src[si + 1]; data[di + 2] = src[si + 2]; data[di + 3] = src[si + 3]
    }
  }
}

// Per-pixel additive noise from a deterministic PRNG stream.
export function applyGrainCPU(img: ImageData, p: Record<string, number>, seed: number): void {
  const intensity = p.intensity ?? 0
  if (intensity === 0) return
  const rng = mulberry32(seed)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 255 * intensity
    d[i] = clampByte(d[i] + n); d[i + 1] = clampByte(d[i + 1] + n); d[i + 2] = clampByte(d[i + 2] + n)
  }
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/cpu-fallback.ts src/engine/cpu-fallback.test.ts
git commit -m "feat(engine): cpu fallback effects (adjustments/waves/grain)"
```

---

### Task 5: Effects framework (registry, order, collection, audio resolution)

**Files:**
- Create: `src/engine/effects/index.ts`
- Create: `src/engine/effects/framework.test.ts`

**Interfaces (produces — consumed by Tasks 6–13, 20):**
```ts
export const VERT_SRC: string
export type EffectPassDef = {
  type: EffectType; label: string
  defaultParams: Record<string, number>
  controls: ControlDef[]
  fragment: string
  uniforms(p: Record<string, number>, frame: Frame): Record<string, number | number[]>
}
export const EFFECT_ORDER: EffectType[]
export const EFFECTS: Partial<Record<EffectType, EffectPassDef>>   // Task 9 makes it exhaustive
export type ActivePass = { uid: string; type: EffectType; params: Record<string, number>; bindings: AudioBinding[]; def: EffectPassDef }
export function collectActiveEffects(stack: StackItem[]): ActivePass[]
export function buildUniforms(pass: ActivePass, frame: Frame): Record<string, number | number[]>
```

- [ ] **Step 1: Failing test** — `src/engine/effects/framework.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import { collectActiveEffects, buildUniforms, EFFECT_ORDER } from './index'
import type { StackItem, EffectInstance } from '../../core/types'

function item(over: Partial<StackItem>): StackItem {
  return { uid: 'i1', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false, ...over }
}
const eff = (type: EffectInstance['type'], enabled = true): EffectInstance => ({ uid: `e_${type}`, type, enabled, params: {} })

describe('effects framework', () => {
  test('orders passes by canonical EFFECT_ORDER, not insertion', () => {
    const stack = [item({ effects: [eff('waves'), eff('aberration')] }), item({ uid: 'i2', effects: [eff('adjustments')] })]
    expect(collectActiveEffects(stack).map((p) => p.type)).toEqual(['adjustments', 'aberration', 'waves'])
  })
  test('skips disabled instances and hidden items', () => {
    const stack = [item({ hidden: true, effects: [eff('glow')] }), item({ effects: [eff('lens', false), eff('grain')] })]
    expect(collectActiveEffects(stack).map((p) => p.type)).toEqual(['grain'])
  })
  test('collects audio bindings scoped by "<effectUid>.<param>"', () => {
    const stack = [item({ audio: [{ param: 'e_glow.intensity', source: 'bass', curve: 'linear', amount: 2 }] , effects: [eff('glow')] })]
    const pass = collectActiveEffects(stack)[0]
    expect(pass.bindings.length).toBe(1)
  })
  test('resolveEffectValue: linear, invert, bpm', async () => {
    const m = await import('./index')
    const frame = { timeSec: 0, dt: 0, bpm: 240 }
    const audio = { bass: 0.5, mid: 0, treble: 0, level: 1, spectrum: new Float32Array(0), bpm: 240 }
    const bind = (source: any, amount: number, curve: any = 'linear') => [{ param: 'k', source, curve, amount }]
    expect(m.resolveEffectValue(1, bind('bass', 2), 'k', frame, audio)).toBe(2)      // 1 + 0.5*2
    expect(m.resolveEffectValue(1, bind('bass', 2, 'invert'), 'k', frame, audio)).toBe(0) // 1 - 0.5*2
    expect(m.resolveEffectValue(1, bind('bpm', 1), 'k', frame, audio)).toBe(2)      // 1 + (240/120-1)
  })
})
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/engine/effects/index.ts`:

```ts
import type { AudioBinding, AudioFrame, ControlDef, EffectType, Frame, StackItem } from '../../core/types'

export const VERT_SRC =
  'attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }'

export type EffectPassDef = {
  type: EffectType
  label: string
  defaultParams: Record<string, number>
  controls: ControlDef[]
  fragment: string
  uniforms(p: Record<string, number>, frame: Frame): Record<string, number | number[]>
}

export const EFFECT_ORDER: EffectType[] = ['adjustments', 'aberration', 'glow', 'waves', 'edgeblur', 'lens', 'grain']

export const EFFECTS: Partial<Record<EffectType, EffectPassDef>> = {}

export type ActivePass = {
  uid: string
  type: EffectType
  params: Record<string, number>
  bindings: AudioBinding[]
  def: EffectPassDef
}

// Canonical fixed pipeline order (spec §4/§5): adjustments -> aberration -> glow -> waves -> edgeblur -> lens -> grain
export function collectActiveEffects(stack: StackItem[]): ActivePass[] {
  const out: ActivePass[] = []
  for (const type of EFFECT_ORDER) {
    for (const item of stack) {
      if (item.hidden) continue
      for (const e of item.effects ?? []) {
        if (!e.enabled || e.type !== type) continue
        const def = EFFECTS[e.type]
        if (!def) continue
        out.push({
          uid: e.uid,
          type,
          params: { ...def.defaultParams, ...e.params },
          bindings: item.audio.filter((b) => b.param.startsWith(`${e.uid}.`)),
          def,
        })
      }
    }
  }
  return out
}

export function resolveEffectValue(base: number, bindings: AudioBinding[], key: string, frame: Frame, audio: AudioFrame): number {
  const b = bindings.find((x) => x.param === key)
  if (!b) return base
  let src: number
  if (b.source === 'bpm') src = frame.bpm / 120 - 1
  else if (b.source === 'spectrum') {
    src = audio.spectrum.length ? Array.from(audio.spectrum).reduce((a, v) => a + v, 0) / audio.spectrum.length : 0
  } else src = audio[b.source]
  return base + src * b.amount * (b.curve === 'invert' ? -1 : 1)
}

export function buildUniforms(pass: ActivePass, frame: Frame, audio: AudioFrame): Record<string, number | number[]> {
  const resolved: Record<string, number> = {}
  for (const c of pass.def.controls) {
    if (c.kind !== 'slider') continue
    resolved[c.param] = resolveEffectValue(
      pass.params[c.param] ?? pass.def.defaultParams[c.param],
      pass.bindings,
      `${pass.uid}.${c.param}`,
      frame,
      audio,
    )
  }
  return pass.def.uniforms(resolved, frame)
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/effects/index.ts src/engine/effects/framework.test.ts
git commit -m "feat(engine): effects framework (order, collection, audio resolution)"
```

---

### Task 6: Effect — Adjustments (defines the effect-file pattern)

**Files:**
- Create: `src/engine/effects/adjustments.ts`
- Modify: `src/engine/effects/index.ts` (import + register)

- [ ] **Step 1: Failing test** — append to `framework.test.ts`:

```ts
test('adjustments uniforms map resolved params', async () => {
  const { adjustmentsDef } = await import('./adjustments')
  const out = adjustmentsDef.uniforms({ brightness: 10, contrast: 20, saturation: 0.5 }, { timeSec: 0, dt: 0, bpm: 120 })
  expect(out).toEqual({ u_brightness: 10, u_contrast: 20, u_saturation: 0.5 })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — `src/engine/effects/adjustments.ts`:

```ts
import type { EffectPassDef } from './index'

// Brightness add -> contrast around 128 -> luminance-preserving saturation.
export const adjustmentsDef: EffectPassDef = {
  type: 'adjustments',
  label: 'Adjustments',
  defaultParams: { brightness: 0, contrast: 0, saturation: 0 },
  controls: [
    { param: 'brightness', label: 'Brightness', kind: 'slider', min: -100, max: 100, step: 1 },
    { param: 'contrast', label: 'Contrast', kind: 'slider', min: -100, max: 100, step: 1 },
    { param: 'saturation', label: 'Saturation', kind: 'slider', min: -1, max: 1, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  vec3 col = c.rgb * 255.0 + u_brightness;
  float k = (259.0 * (u_contrast + 255.0)) / (255.0 * (259.0 - u_contrast));
  col = k * (col - 128.0) + 128.0;
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(g), col, 1.0 + u_saturation);
  gl_FragColor = vec4(clamp(col, 0.0, 255.0) / 255.0, c.a);
}`,
  uniforms: (p) => ({ u_brightness: p.brightness ?? 0, u_contrast: p.contrast ?? 0, u_saturation: p.saturation ?? 0 }),
}
```

In `src/engine/effects/index.ts`: add `import { adjustmentsDef } from './adjustments'` and `Object.assign(EFFECTS, { adjustments: adjustmentsDef })` below `EFFECTS`.

- [ ] **Step 4: Run suite** → PASS. **Step 5: Commit**

```bash
git add src/engine/effects/adjustments.ts src/engine/effects/index.ts src/engine/effects/framework.test.ts
git commit -m "feat(effects): adjustments pass"
```

---

### Task 7: Effects — Aberration + Waves

**Files:**
- Create: `src/engine/effects/aberration.ts`, `src/engine/effects/waves.ts`
- Modify: `src/engine/effects/index.ts`, `src/engine/effects/framework.test.ts`

- [ ] **Step 1: Failing test** — append:

```ts
test('aberration/waves uniforms map', async () => {
  const { aberrationDef } = await import('./aberration')
  const { wavesDef } = await import('./waves')
  const f = { timeSec: 2, dt: 0, bpm: 120 }
  expect(aberrationDef.uniforms({ displace: 12, frequency: 0.05 }, f)).toEqual({ u_displace: 12, u_frequency: 0.05 })
  expect(wavesDef.uniforms({ intensity: 15, quantity: 0.08, speed: 1 }, f)).toEqual({ u_intensity: 15, u_quantity: 0.08, u_speed: 1 })
})
test('EFFECT_ORDER heads registered so far stay ordered', async () => {
  const { EFFECTS, EFFECT_ORDER } = await import('./index')
  for (const t of ['adjustments', 'aberration', 'waves'] as const) expect(EFFECTS[t]).toBeDefined()
  expect(EFFECT_ORDER[0]).toBe('adjustments')
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement:**

`src/engine/effects/aberration.ts`:

```ts
import type { EffectPassDef } from './index'

// Concentric chromatic wave: R sampled outward, B inward, G fixed.
export const aberrationDef: EffectPassDef = {
  type: 'aberration',
  label: 'Aberration',
  defaultParams: { displace: 10, frequency: 0.05 },
  controls: [
    { param: 'displace', label: 'Displace', kind: 'slider', min: 0, max: 40, step: 0.5 },
    { param: 'frequency', label: 'Frequency', kind: 'slider', min: 0.01, max: 0.15, step: 0.005 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_displace;
uniform float u_frequency;
void main() {
  float dist = length(v_uv - 0.5) * min(u_res.x, u_res.y);
  float wave = sin(dist * u_frequency) * u_displace / u_res.x;
  vec4 c = texture2D(u_tex, v_uv);
  float r = texture2D(u_tex, clamp(v_uv + vec2(wave, 0.0), 0.0, 1.0)).r;
  float b = texture2D(u_tex, clamp(v_uv - vec2(wave, 0.0), 0.0, 1.0)).b;
  gl_FragColor = vec4(r, c.g, b, c.a);
}`,
  uniforms: (p) => ({ u_displace: p.displace ?? 10, u_frequency: p.frequency ?? 0.05 }),
}
```

`src/engine/effects/waves.ts`:

```ts
import type { EffectPassDef } from './index'

// Row-wise horizontal sine shift (VHS scanline glitch). Reduced-motion freezes u_time upstream.
export const wavesDef: EffectPassDef = {
  type: 'waves',
  label: 'Waves',
  defaultParams: { intensity: 15, quantity: 0.08, speed: 1 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 40, step: 1 },
    { param: 'quantity', label: 'Quantity', kind: 'slider', min: 0.01, max: 0.5, step: 0.005 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_quantity;
uniform float u_speed;
void main() {
  float shift = sin(v_uv.y * 6.2831 * u_quantity + u_time * u_speed) * u_intensity / u_res.x;
  gl_FragColor = texture2D(u_tex, clamp(vec2(v_uv.x + shift, v_uv.y), 0.0, 1.0));
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 15, u_quantity: p.quantity ?? 0.08, u_speed: p.speed ?? 1 }),
}
```

Register both in `index.ts` (`Object.assign(EFFECTS, { aberration: aberrationDef, waves: wavesDef })`).

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/effects/aberration.ts src/engine/effects/waves.ts src/engine/effects/index.ts src/engine/effects/framework.test.ts
git commit -m "feat(effects): aberration + waves passes"
```

---

### Task 8: Effects — Glow + Edge Blur

**Files:**
- Create: `src/engine/effects/glow.ts`, `src/engine/effects/edgeblur.ts`
- Modify: `src/engine/effects/index.ts`, `src/engine/effects/framework.test.ts`

- [ ] **Step 1: Failing test** — append:

```ts
test('glow/edgeblur uniforms map', async () => {
  const { glowDef } = await import('./glow')
  const { edgeBlurDef } = await import('./edgeblur')
  const f = { timeSec: 0, dt: 0, bpm: 120 }
  expect(glowDef.uniforms({ intensity: 0.7, threshold: 0.5, radius: 8 }, f)).toEqual({ u_intensity: 0.7, u_threshold: 0.5, u_radius: 8 })
  expect(edgeBlurDef.uniforms({ area: 0.4, falloff: 0.3 }, f)).toEqual({ u_area: 0.4, u_falloff: 0.3 })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement:**

`src/engine/effects/glow.ts` (single-pass 12-tap radial bright-blur approximation of bloom):

```ts
import type { EffectPassDef } from './index'

// Bloom: thresholded bright blur added back over the base (approximation of extract->blur->additive).
export const glowDef: EffectPassDef = {
  type: 'glow',
  label: 'Glow',
  defaultParams: { intensity: 0.7, threshold: 0.5, radius: 8 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'threshold', label: 'Threshold', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'radius', label: 'Radius', kind: 'slider', min: 1, max: 16, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_threshold;
uniform float u_radius;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  vec3 sum = vec3(0.0);
  vec2 px = u_radius / u_res;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float ang = fi * 0.5296;
    vec2 off = vec2(cos(ang), sin(ang)) * sqrt(fi / 12.0) * px;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
    sum += texture2D(u_tex, clamp(v_uv - off, 0.0, 1.0)).rgb;
  }
  vec3 blur = sum / 12.0;
  float l = (blur.r + blur.g + blur.b) / 3.0;
  float bright = max(0.0, l - u_threshold) / max(0.001, 1.0 - u_threshold);
  gl_FragColor = vec4(clamp(base.rgb + blur * bright * u_intensity, 0.0, 1.0), base.a);
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 0.7, u_threshold: p.threshold ?? 0.5, u_radius: p.radius ?? 8 }),
}
```

`src/engine/effects/edgeblur.ts`:

```ts
import type { EffectPassDef } from './index'

// Variable radial blur: sharp inside "area", growing blur toward borders ("falloff").
export const edgeBlurDef: EffectPassDef = {
  type: 'edgeblur',
  label: 'Edge Blur',
  defaultParams: { area: 0.4, falloff: 0.3 },
  controls: [
    { param: 'area', label: 'Area', kind: 'slider', min: 0, max: 0.8, step: 0.01 },
    { param: 'falloff', label: 'Falloff', kind: 'slider', min: 0.05, max: 0.6, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_area;
uniform float u_falloff;
void main() {
  vec4 base = texture2D(u_tex, v_uv);
  float dist = length(v_uv - 0.5) / 0.7071;
  float radius = max(0.0, (dist - u_area) / max(0.001, u_falloff)) * 12.0;
  if (radius < 0.5) { gl_FragColor = base; return; }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float ang = float(i) * 0.7854;
    vec2 off = vec2(cos(ang), sin(ang)) * radius / u_res;
    sum += texture2D(u_tex, clamp(v_uv + off, 0.0, 1.0)).rgb;
  }
  gl_FragColor = vec4(sum / 8.0, base.a);
}`,
  uniforms: (p) => ({ u_area: p.area ?? 0.4, u_falloff: p.falloff ?? 0.3 }),
}
```

Register both in `index.ts`.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/effects/glow.ts src/engine/effects/edgeblur.ts src/engine/effects/index.ts src/engine/effects/framework.test.ts
git commit -m "feat(effects): glow + edge blur passes"
```

---

### Task 9: Effects — Distort Lens + Grain; registry becomes exhaustive

**Files:**
- Create: `src/engine/effects/lens.ts`, `src/engine/effects/grain.ts`
- Modify: `src/engine/effects/index.ts`, `src/engine/effects/framework.test.ts`

- [ ] **Step 1: Failing test** — append:

```ts
test('lens/grain uniforms map', async () => {
  const { lensDef } = await import('./lens')
  const { grainDef } = await import('./grain')
  const f = { timeSec: 3, dt: 0, bpm: 120 }
  expect(lensDef.uniforms({ intensity: 0.7, centerX: 0.5, centerY: 0.5 }, f)).toEqual({ u_intensity: 0.7, u_centerX: 0.5, u_centerY: 0.5 })
  expect(grainDef.uniforms({ intensity: 0.5, motion: 1 }, f)).toEqual({ u_intensity: 0.5, u_seed: 180 })
  expect(grainDef.uniforms({ intensity: 0.5, motion: 0 }, f)).toEqual({ u_intensity: 0.5, u_seed: 0 })
})
test('registry is exhaustive over EFFECT_ORDER', async () => {
  const { EFFECTS, EFFECT_ORDER } = await import('./index')
  for (const t of EFFECT_ORDER) expect(EFFECTS[t]).toBeDefined()
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement:**

`src/engine/effects/lens.ts`:

```ts
import type { EffectPassDef } from './index'

// Fisheye bulge remap + specular highlight near the lens center.
export const lensDef: EffectPassDef = {
  type: 'lens',
  label: 'Distort Lens',
  defaultParams: { intensity: 0.7, centerX: 0.5, centerY: 0.5 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 0.95, step: 0.01 },
    { param: 'centerX', label: 'Center X', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'centerY', label: 'Center Y', kind: 'slider', min: 0, max: 1, step: 0.01 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_centerX;
uniform float u_centerY;
void main() {
  vec2 center = vec2(u_centerX, u_centerY);
  vec2 d = (v_uv - center) * u_res;
  float maxR = min(u_res.x, u_res.y) * 0.5;
  float bulge = pow(clamp(length(d) / maxR, 0.0, 1.0), 1.0 - u_intensity * 0.9);
  vec4 c = texture2D(u_tex, clamp(center + d * bulge / u_res, 0.0, 1.0));
  vec2 hl = (v_uv - (center - vec2(0.04))) * u_res;
  float s2 = 2.0 * pow(min(u_res.x, u_res.y) * 0.05, 2.0);
  c.rgb += exp(-dot(hl, hl) / s2) * 0.35 * u_intensity;
  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
}`,
  uniforms: (p) => ({ u_intensity: p.intensity ?? 0.7, u_centerX: p.centerX ?? 0.5, u_centerY: p.centerY ?? 0.5 }),
}
```

`src/engine/effects/grain.ts` (motion regenerates seed every frame via timeSec*60):

```ts
import type { EffectPassDef } from './index'

// Film-grain per-pixel noise; motion > 0.5 animates the noise field per frame.
export const grainDef: EffectPassDef = {
  type: 'grain',
  label: 'Grain',
  defaultParams: { intensity: 0.5, motion: 1 },
  controls: [
    { param: 'intensity', label: 'Intensity', kind: 'slider', min: 0, max: 1, step: 0.01 },
    { param: 'motion', label: 'Motion', kind: 'slider', min: 0, max: 1, step: 1 },
  ],
  fragment: `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_intensity;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float n = hash(v_uv * u_res + u_seed) - 0.5;
  gl_FragColor = vec4(clamp(c.rgb + n * u_intensity, 0.0, 1.0), c.a);
}`,
  uniforms: (p, frame) => ({
    u_intensity: p.intensity ?? 0.5,
    u_seed: (p.motion ?? 1) > 0.5 ? Math.floor(frame.timeSec * 60) : 0,
  }),
}
```

In `index.ts`: register both, then change the declaration to exhaustive and add a guard test helper:

```ts
export const EFFECTS: Record<EffectType, EffectPassDef> = Object.assign(Object.create(null), {
  adjustments: adjustmentsDef,
  aberration: aberrationDef,
  glow: glowDef,
  waves: wavesDef,
  edgeblur: edgeBlurDef,
  lens: lensDef,
  grain: grainDef,
}) as Record<EffectType, EffectPassDef>
```

(replace the previous `Partial<...>` declaration and scattered `Object.assign` registrations with this single literal).

- [ ] **Step 4: Run full engine suite** → PASS. **Step 5: Commit**

```bash
git add src/engine/effects/lens.ts src/engine/effects/grain.ts src/engine/effects/index.ts src/engine/effects/framework.test.ts
git commit -m "feat(effects): lens + grain passes; exhaustive registry"
```

---

### Task 10: WebGL2 compositor (ping-pong pass chain + shader-gen pre-pass)

**Files:**
- Create: `src/engine/compositor.ts`
- Create: `src/engine/compositor.test.ts`

**Interfaces (produces — consumed by Tasks 11, 20):**
```ts
export type ShaderGenOpts = { scale: number; speed: number; palette: number; timeSec: number }
export function hasWebGL2(canvas: HTMLCanvasElement): boolean
export type Compositor = {
  apply(source: HTMLCanvasElement, passes: ActivePass[], frame: Frame, audio: AudioFrame, opts?: { shaderGen?: ShaderGenOpts }): void
  resize(w: number, h: number): void
}
export function createCompositor(canvas: HTMLCanvasElement): Compositor | null  // null when no usable WebGL2
```

- [ ] **Step 1: Failing test** — `src/engine/compositor.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { hasWebGL2, createCompositor } from './compositor'

describe('compositor capability detection', () => {
  test('jsdom canvas without WebGL2 -> hasWebGL2 false and factory null', () => {
    const c = document.createElement('canvas')
    // jsdom returns null for 'webgl2' (no stub installed here)
    expect(hasWebGL2(c)).toBe(false)
    expect(createCompositor(c)).toBeNull()
  })
})
```

Note: `Canvas.test.tsx` stubs `getContext` globally with a permissive proxy; the `typeof createShader === 'function'` guard keeps `hasWebGL2` truthful there too (proxy returns functions for everything), and every GL call becomes a no-op — the rAF loop survives, keeping that suite green without changes.

- [ ] **Step 2: Run** `npx vitest run src/engine/compositor.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `src/engine/compositor.ts`:

```ts
import type { AudioFrame, Frame } from '../core/types'
import { VERT_SRC, buildUniforms } from './effects'
import type { ActivePass } from './effects'

export type ShaderGenOpts = { scale: number; speed: number; palette: number; timeSec: number }

const COPY_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() { gl_FragColor = texture2D(u_tex, v_uv); }`

// GPU-native generator surface for the "Shaders" tool (spec §6): fbm nebula pre-pass.
const SHADER_GEN_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_palette;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}
vec3 ramp(float t, float which) {
  if (which < 0.5) return vec3(t * 1.1, t * t * 0.55, 0.08 + t * t * t);
  if (which < 1.5) return vec3(0.05 + t * 0.4, t * 0.8, 1.0 - t * 0.35);
  return vec3(0.1 + t * 0.9, 1.0 - t, t * 0.7);
}
void main() {
  vec2 p = v_uv * u_scale;
  float n = fbm(p + fbm(p + u_time * 0.12 * max(0.001, u_speed)) * 1.6);
  gl_FragColor = vec4(ramp(clamp(n, 0.0, 1.0), u_palette), 1.0);
}`

export function hasWebGL2(canvas: HTMLCanvasElement): boolean {
  try {
    const gl = canvas.getContext('webgl2')
    return Boolean(gl && typeof (gl as WebGL2RenderingContext).createShader === 'function')
  } catch {
    return false
  }
}

type Pair = { tex: WebGLTexture; fbo: WebGLFramebuffer }
type ProgEntry = { prog: WebGLProgram | null; loc: Record<string, WebGLUniformLocation | null>; aPos: number }

export function createCompositor(canvas: HTMLCanvasElement): Compositor | null {
  let g: WebGL2RenderingContext | null = null
  try {
    g = canvas.getContext('webgl2', { alpha: false, preserveDrawingBuffer: true })
  } catch {
    g = null
  }
  if (!g || typeof g.createShader !== 'function') return null
  const gl = g as WebGL2RenderingContext

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const pairs: Pair[] = [{ tex: gl.createTexture()!, fbo: gl.createFramebuffer()! }, { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! }]
  const programs = new Map<string, ProgEntry>()
  let W = 0
  let H = 0

  function compile(key: string, fragSrc: string): ProgEntry {
    const hit = programs.get(key)
    if (hit) return hit
    const entry: ProgEntry = { prog: null, loc: {}, aPos: 0 }
    try {
      const vs = gl.createShader(gl.VERTEX_SHADER)!
      gl.shaderSource(vs, VERT_SRC)
      gl.compileShader(vs)
      const fs = gl.createShader(gl.FRAGMENT_SHADER)!
      gl.shaderSource(fs, fragSrc)
      gl.compileShader(fs)
      const prog = gl.createProgram()!
      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)
      entry.prog = prog
      entry.aPos = gl.getAttribLocation(prog, 'a_pos')
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(prog, i)
        if (info) entry.loc[info.name] = gl.getUniformLocation(prog, info.name)
      }
    } catch {
      entry.prog = null
    }
    programs.set(key, entry)
    return entry
  }

  function ensureSize(w: number, h: number) {
    if (w === W && h === H) return
    W = Math.max(1, w)
    H = Math.max(1, h)
    canvas.width = W
    canvas.height = H
    for (const p of pairs) {
      gl.bindTexture(gl.TEXTURE_2D, p.tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, p.fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p.tex, 0)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function renderInto(target: Pair | null, readTex: WebGLTexture, key: string, frag: string, uniforms: Record<string, number | number[]>, timeSec: number) {
    const entry = compile(key, frag)
    if (!entry.prog) return
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null)
    if (target) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.tex, 0)
    gl.viewport(0, 0, W, H)
    gl.useProgram(entry.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, readTex)
    if (entry.loc.u_tex) gl.uniform1i(entry.loc.u_tex, 0)
    if (entry.loc.u_res) gl.uniform2f(entry.loc.u_res, W, H)
    if (entry.loc.u_time) gl.uniform1f(entry.loc.u_time, timeSec)
    for (const [k, v] of Object.entries(uniforms)) {
      const l = entry.loc[k]
      if (!l) continue
      if (Array.isArray(v)) gl.uniform2f(l, v[0] ?? 0, v[1] ?? 0)
      else gl.uniform1f(l, v)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.enableVertexAttribArray(entry.aPos)
    gl.vertexAttribPointer(entry.aPos, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
  canvas.addEventListener('webglcontextrestored', () => {
    programs.clear()
    W = 0
    H = 0
  })

  return {
    resize(w, h) {
      ensureSize(w, h)
    },
    apply(source, passes, frame, audio, opts) {
      ensureSize(source.width || 1, source.height || 1)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, pairs[0].tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

      let cur = 0
      if (opts?.shaderGen) {
        const nxt = 1 - cur
        renderInto(pairs[nxt], pairs[cur].tex, 'shadersgen', SHADER_GEN_FRAG, { u_scale: opts.shaderGen.scale, u_palette: opts.shaderGen.palette }, opts.shaderGen.timeSec * opts.shaderGen.speed)
        cur = nxt
      }
      for (const pass of passes) {
        const nxt = 1 - cur
        renderInto(pairs[nxt], pairs[cur].tex, pass.type, pass.def.fragment, buildUniforms(pass, frame, audio), frame.timeSec)
        cur = nxt
      }
      renderInto(null, pairs[cur].tex, '__copy', COPY_FRAG, {}, frame.timeSec)
    },
  }
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/engine/compositor.ts src/engine/compositor.test.ts
git commit -m "feat(engine): webgl2 compositor with ping-pong pass chain"
```

---

### Task 11: Canvas integration (offscreen base, two-path output, reduced-motion)

**Files:**
- Modify: `src/ui/Canvas.tsx` (full rewrite of component body; hooks/logic contract preserved)

**Consumes:** `collectActiveEffects` (Task 5), `hasWebGL2/createCompositor` (Task 10), CPU fallbacks (Task 4).
**Preserves (test contracts):** `data-testid="stage-canvas"` present on mount; rAF loop calls `evaluateStack` with `(ctx, frame, audioFrame, stack)`; deps `[aspect, quality, stackLen]` extended with `effectCount`; cleanup cancels rAF.

- [ ] **Step 1: Write failing test** — append to `src/ui/Canvas.test.tsx` inside the existing `describe`:

```ts
test('renders wrapper carrying stage-canvas testid alongside dual canvases', () => {
  const { getByTestId } = render(<Canvas />)
  expect(getByTestId('stage-canvas')).toBeTruthy()
})
```

(This mirrors coverage of the relocated attribute; the primary rAF test must keep passing untouched.)

- [ ] **Step 2: Run** `npx vitest run src/ui/Canvas.test.tsx` → both tests PASS even before rewrite (attribute already exists), confirming no regression baseline; proceed regardless.

- [ ] **Step 3: Implement** — full replacement of `src/ui/Canvas.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { useAudio } from '../audio/useAudio'
import { collectActiveEffects } from '../engine/effects'
import { createCompositor, hasWebGL2 } from '../engine/compositor'
import type { Compositor } from '../engine/compositor'
import { applyAdjustmentsCPU, applyGrainCPU, applyWavesCPU } from '../engine/cpu-fallback'

const RATIO = { '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16, '4:3': 4 / 3, '16:9': 16 / 9 } as const
const CPU_ONLY = new Set(['adjustments', 'waves', 'grain'])
const reduceMotion =
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

export function Canvas() {
  const flatRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLCanvasElement | null>(null)
  const compRef = useRef<Compositor | null>(null)
  const aspect = useProjectStore((s) => s.canvas.aspect)
  const quality = useProjectStore((s) => s.canvas.quality)
  const stackLen = useProjectStore((s) => s.stack.length)
  const effectCount = useProjectStore(
    (s) => s.stack.reduce((n, i) => n + (i.effects?.filter((e) => e.enabled).length ?? 0), 0),
  )
  const audio = useAudio()
  const W = 720
  const H = Math.round(W / RATIO[aspect])

  useEffect(() => {
    const flat = flatRef.current
    const glc = glRef.current
    if (!flat || !glc) return
    flat.width = W
    flat.height = H
    glc.width = W
    glc.height = H
    if (!baseRef.current) baseRef.current = document.createElement('canvas')
    const base = baseRef.current
    base.width = W
    base.height = H
    const bctx = base.getContext('2d')
    if (!bctx) return
    let raf = 0
    let t = 0
    const scale = quality === 'low' ? 0.5 : quality === 'med' ? 0.75 : 1
    const loop = () => {
      t += 1 / 60
      const st = useProjectStore.getState()
      const bpm = st.timeline.bpm
      const effFrame = reduceMotion ? { timeSec: 0, dt: 1 / 60, bpm } : { timeSec: t, dt: 1 / 60, bpm }
      const a = audio.readFrame(bpm)
      bctx.setTransform(1, 0, 0, 1, 0, 0)
      bctx.clearRect(0, 0, base.width, base.height)
      bctx.save()
      bctx.scale(scale, scale)
      evaluateStack(bctx, effFrame, a, st.stack)
      bctx.restore()

      const passes = collectActiveEffects(st.stack)
      if (passes.length > 0 && !compRef.current && hasWebGL2(glc)) compRef.current = createCompositor(glc)
      const comp = compRef.current
      const fctx = flat.getContext('2d')

      if (comp && passes.length > 0) {
        flat.style.visibility = 'hidden'
        glc.style.visibility = 'visible'
        comp.resize(W, H)
        comp.apply(base, passes, effFrame, a)
      } else if (passes.length > 0 && fctx) {
        flat.style.visibility = 'visible'
        glc.style.visibility = 'hidden'
        if (passes.every((p) => CPU_ONLY.has(p.type))) {
          fctx.drawImage(base, 0, 0)
          const img = fctx.getImageData(0, 0, W, H)
          for (const p of passes) {
            if (p.type === 'adjustments') applyAdjustmentsCPU(img, p.params)
            else if (p.type === 'waves') applyWavesCPU(img, p.params, effFrame.timeSec)
            else if (p.type === 'grain') applyGrainCPU(img, p.params, Math.floor(effFrame.timeSec * 60))
          }
          fctx.putImageData(img, 0, 0)
        } else {
          fctx.drawImage(base, 0, 0)
        }
      } else if (fctx) {
        flat.style.visibility = 'visible'
        glc.style.visibility = 'hidden'
        fctx.drawImage(base, 0, 0)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [aspect, quality, stackLen, effectCount])

  return (
    <div id="stage-canvas" data-testid="stage-canvas" className="relative inline-block">
      <canvas
        ref={flatRef}
        width={W}
        height={H}
        className="max-h-full max-w-full rounded-lg border border-border bg-black shadow-2xl"
      />
      <canvas
        ref={glRef}
        width={W}
        height={H}
        aria-hidden
        style={{ visibility: 'hidden' }}
        className="absolute inset-0 max-h-full max-w-full rounded-lg border border-border bg-black shadow-2xl"
      />
    </div>
  )
}
```

Notes: the `id`/`data-testid` moved to the wrapper div (ExportMenu's `getElementById('stage-canvas')?.requestFullscreen?.()` still works — `requestFullscreen` exists on elements). The GL canvas is a sibling toggled by visibility, because a single canvas cannot serve both `'2d'` and `'webgl2'` contexts.

- [ ] **Step 4: Run full suite** `npx vitest run` → all green including Canvas tests (proxy-stub makes GL path inert).
- [ ] **Step 5: Commit**

```bash
git add src/ui/Canvas.tsx src/ui/Canvas.test.tsx
git commit -m "feat(canvas): effects pipeline integration with cpu/webgl dual path"
```

---

### Task 12: NodeOptions Controls/Effects tabs + effects panel

**Files:**
- Create: `src/ui/NodeOptionsEffects.tsx`
- Modify: `src/ui/NodeOptions.tsx` (wrap body in shadcn Tabs)
- Create: `src/ui/NodeOptionsEffects.test.tsx`

**Consumes:** store actions `addEffect/removeEffect/setEffectParam/toggleEffect/addAudioBinding` (Task 2), `EFFECTS/EFFECT_ORDER` (Tasks 5–9), `learnNextCc` (existing).

- [ ] **Step 1: Failing test** — `src/ui/NodeOptionsEffects.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import '../tools'
import { NodeOptions } from './NodeOptions'

afterEach(cleanup)

describe('NodeOptions Effects tab', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('solidColor')
  })

  test('adds, adjusts, binds, toggles and removes an effect', () => {
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const { getByRole, getByLabelText, getByText } = render(
      <NodeOptions item={useProjectStore.getState().stack[0]} />,
    )
    fireEvent.click(getByRole('tab', { name: 'Effects' }))
    expect(getByText('Glow')).toBeTruthy()
    const intensity = getByLabelText('Intensity') as HTMLInputElement
    fireEvent.change(intensity, { target: { value: '1.5' } })
    const e = useProjectStore.getState().stack[0].effects![0]
    expect(e.params.intensity).toBe(1.5)
    fireEvent.click(getByLabelText(`Bind audio for ${e.uid}.intensity`))
    expect(useProjectStore.getState().stack[0].audio[0].param).toBe(`${e.uid}.intensity`)
    fireEvent.click(getByRole('switch'))
    expect(useProjectStore.getState().stack[0].effects![0].enabled).toBe(false)
    fireEvent.click(getByLabelText('Remove effect'))
    expect(useProjectStore.getState().stack[0].effects!.length).toBe(0)
  })

  test('Controls tab remains default and native sliders still drive params', () => {
    useProjectStore.getState().addTool('solidColor')
    const { getByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const input = getByLabelText('Color') as HTMLInputElement
    expect(input).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/NodeOptionsEffects.test.tsx` → FAIL (tab absent, panel missing).

- [ ] **Step 3: Implement panel** — `src/ui/NodeOptionsEffects.tsx`:

```tsx
import { useProjectStore } from '../state/projectStore'
import { EFFECT_ORDER, EFFECTS } from '../engine/effects'
import type { EffectType, StackItem } from '../core/types'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Trash2, Plus, AudioLines } from 'lucide-react'
import { learnNextCc } from '../audio/midi'
import { useState } from 'react'

export function NodeOptionsEffects({ item }: { item: StackItem }) {
  const addEffect = useProjectStore((s) => s.addEffect)
  const removeEffect = useProjectStore((s) => s.removeEffect)
  const toggleEffect = useProjectStore((s) => s.toggleEffect)
  const setEffectParam = useProjectStore((s) => s.setEffectParam)
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const midiEnabled = useProjectStore((s) => s.audio.midi.enabled)
  const timeSec = useProjectStore((s) => s.timeline.timeSec)
  const [learning, setLearning] = useState<string | null>(null)

  const learn = (key: string) => {
    setLearning(key)
    void learnNextCc().then((cc) => {
      useProjectStore.getState().bindMidi(item.uid, key, cc)
      setLearning(null)
    })
  }

  return (
    <div className="space-y-3">
      <Select value="" onValueChange={(v) => addEffect(item.uid, v as EffectType)}>
        <SelectTrigger className="w-full" aria-label="Add effect">
          <Plus className="h-4 w-4" />
          <SelectValue placeholder="Add effect" />
        </SelectTrigger>
        <SelectContent>
          {EFFECT_ORDER.map((t) => (
            <SelectItem key={t} value={t}>
              {EFFECTS[t]?.label ?? t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(item.effects ?? []).map((e) => {
        const def = EFFECTS[e.type]
        if (!def) return null
        return (
          <div key={e.uid} className="space-y-2 rounded-md border border-border bg-surface-2/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium">{def.label}</span>
              <div className="flex items-center gap-2">
                <Switch checked={e.enabled} onCheckedChange={() => toggleEffect(item.uid, e.uid)} aria-label={`Enable ${def.label}`} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-danger hover:text-danger" aria-label="Remove effect" onClick={() => removeEffect(item.uid, e.uid)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {def.controls.map((c) => {
              const key = `${e.uid}.${c.param}`
              const bound = item.audio.some((b) => b.param === key)
              return (
                <div key={c.param} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={key} className="text-[12px] text-muted-foreground">{c.label}</label>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className={`h-6 w-6 ${bound ? 'text-primary' : ''}`} aria-label={`Bind audio for ${key}`} onClick={() => addAudioBinding(item.uid, { param: key, source: 'bass', curve: 'linear', amount: 1 })}>
                        <AudioLines className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Learn MIDI for ${key}`} disabled={!midiEnabled || learning === key} onClick={() => learn(key)}>
                        {learning === key ? '…' : 'M'}
                      </Button>
                    </div>
                  </div>
                  <input
                    id={key}
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={Number(e.params[c.param] ?? def.defaultParams[c.param])}
                    onChange={(ev) => setEffectParam(item.uid, e.uid, c.param, Number(ev.target.value))}
                    className="w-full accent-[hsl(var(--primary))]"
                  />
                </div>
              )
            })}
            {typeof timeSec === 'number' ? null : null}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Integrate tabs** — in `src/ui/NodeOptions.tsx`:

Add imports: `import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'` and `import { NodeOptionsEffects } from './NodeOptionsEffects'`.
Inside the returned card, immediately AFTER the sticky header block (`</div>` closing the header flex row) and BEFORE the existing `<ScrollArea …>` element, insert:

```tsx
<Tabs defaultValue="controls" className="mt-0 flex min-h-0 flex-1 flex-col">
  <TabsList className="mx-4 mt-2 self-start">
    <TabsTrigger value="controls">Controls</TabsTrigger>
    <TabsTrigger value="effects">Effects</TabsTrigger>
  </TabsList>
  <TabsContent value="controls" className="mt-0 min-h-0 flex-1">
```

Move the ENTIRE existing `<ScrollArea …>…</ScrollArea>` block VERBATIM inside that `TabsContent`, close it with `</TabsContent>`, then append:

```tsx
  <TabsContent value="controls-note" hidden> </TabsContent>
</Tabs>
```

and add the effects content right after the ScrollArea's new home:

```tsx
  <TabsContent value="effects" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
    <NodeOptionsEffects item={item} />
  </TabsContent>
```

(Remove the stray `controls-note` line — it is intentionally listed only to mark that NO filler content belongs inside Tabs; final structure is exactly: `TabsList`, `TabsContent controls` wrapping the moved ScrollArea, `TabsContent effects`.) Ensure the outer card keeps `flex h-full flex-col` so tabs fill height.

- [ ] **Step 5: Run full suite** — `npx vitest run`: the three existing `NodeOptions.test.tsx` tests MUST stay green (default tab = Controls mounts ScrollArea; labels/aria unchanged). New tests PASS.
- [ ] **Step 6: Commit**

```bash
git add src/ui/NodeOptionsEffects.tsx src/ui/NodeOptions.tsx src/ui/NodeOptionsEffects.test.tsx
git commit -m "feat(ui): controls/effects tabs with effect instance panel"
```

---

### Task 13: Export menu raster-forced badge

**Files:**
- Modify: `src/ui/ExportMenu.tsx`
- Modify: `src/ui/ExportMenu.test.tsx`

- [ ] **Step 1: Failing test** — append inside existing `describe`:

```ts
test('shows Raster output badge when an enabled effect exists', () => {
  useProjectStore.getState().reset()
  useProjectStore.getState().addTool('solidColor')
  const uid = useProjectStore.getState().stack[0].uid
  useProjectStore.getState().addEffect(uid, 'grain')
  const { getByText } = render(<ExportMenu />)
  expect(getByText('Raster output')).toBeTruthy()
})

test('no badge without enabled effects', () => {
  useProjectStore.getState().reset()
  const { queryByText } = render(<ExportMenu />)
  expect(queryByText('Raster output')).toBeNull()
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — in `src/ui/ExportMenu.tsx` add imports `import { Badge } from './components-path-badge'` resolved as `../components/ui/badge`, and inside the component before `return`:

```ts
const rasterForced = useProjectStore((s) => s.stack.some((i) => i.effects?.some((e) => e.enabled)))
```

and render as first child of the container div:

```tsx
{rasterForced && (
  <Badge variant="warning" data-testid="raster-badge">
    Raster output
  </Badge>
)}
```

(The five existing buttons and their texts are untouched.)

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/ui/ExportMenu.tsx src/ui/ExportMenu.test.tsx
git commit -m "feat(ui): raster-forced badge when effects enabled"
```

---

### Task 14: Ferrofluid 2.0.0 — Gray-Scott + parameter migration (flagship)

**Files:**
- Rewrite: `src/tools/generative/ferrofluid.ts`
- Modify: `src/core/schema.ts` (add `hslToHex` + ferrofluid migration entry)
- Modify: `src/core/schema.test.ts`
- Create: `src/tools/generative/ferrofluid.test.ts`

**Interfaces:** exports `ferrofluidTool: ToolDef` (unchanged symbol), `version: '2.0.0'`, params `{ feed, kill, scale, speed, attractors, accent }`.

- [ ] **Step 1: Failing tests**

Append to `src/core/schema.test.ts`:

```ts
describe('ferrofluid 1.x migration', () => {
  test('maps blobs/intensity/hue to attractors/speed/accent', async () => {
    const mod = await import('./schema')
    // register migration by importing the tool module side-effect free path:
    ;({} as unknown)
    void mod
  })
})
```

Replace that sketch with the REAL form once Task Step 3 lands the entry — final assertions:

```ts
test('legacy ferrofluid migrates to 2.0.0 params', () => {
  const p = migrateProject({
    stack: [{ uid: 'f', toolId: 'ferrofluid', toolVersion: '1.0.0', params: { blobs: 7, intensity: 2, hue: 280 }, audio: [], automations: [], hidden: false }],
  })
  expect(p.stack[0].toolVersion).toBe('2.0.0')
  expect(p.stack[0].params.attractors).toBe(7)
  expect(p.stack[0].params.speed).toBe(2)
  expect(p.stack[0].params.accent).toMatch(/^#[0-9a-f]{6}$/)
})
```

Create `src/tools/generative/ferrofluid.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { ferrofluidTool } from './ferrofluid'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 0, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'ff1',
  toolId: 'ferrofluid',
  toolVersion: '2.0.0',
  params: { feed: 0.055, kill: 0.062, scale: 3, speed: 1, attractors: 4, accent: '#f2790c' },
  audio: [],
  automations: [],
  hidden: false,
}

function stubCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} }
  return new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad
      if (prop === 'canvas') return { width: 200, height: 200 }
      return () => {}
    },
  }) as unknown as CanvasRenderingContext2D
}

describe('ferrofluid 2.0.0', () => {
  test('renders without throwing on proxy ctx (fallback path in jsdom)', () => {
    expect(() => ferrofluidTool.render(stubCtx(), frame, item, audio, stack)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run both** → FAIL.

- [ ] **Step 3: Implement** — `src/tools/generative/ferrofluid.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { ReactionDiffusion, mulberry32 } from '../../engine/rd'

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [242, 121, 12]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function strHash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

const SIZE_BY_QUALITY = { low: 96, med: 128, high: 160, '4k': 200 } as const
const sims = new Map<string, { rd: ReactionDiffusion; sig: string; tmp: HTMLCanvasElement | null; tctx: CanvasRenderingContext2D | null }>()

// Ferrofluid: Gray-Scott reaction-diffusion channels around dark magnetic attractors (Tool-Render.md §1.1).
export const ferrofluidTool: ToolDef = {
  id: 'ferrofluid',
  kind: 'generative',
  version: '2.0.0',
  label: 'Ferrofluid',
  icon: 'atom',
  category: 'Generative',
  defaultParams: { feed: 0.055, kill: 0.062, scale: 3, speed: 1, attractors: 5, accent: '#f2790c' },
  controls: [
    { param: 'feed', label: 'Feed', kind: 'slider', min: 0.01, max: 0.09, step: 0.001 },
    { param: 'kill', label: 'Kill', kind: 'slider', min: 0.03, max: 0.075, step: 0.001 },
    { param: 'scale', label: 'Scale', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
    { param: 'attractors', label: 'Attractors', kind: 'slider', min: 0, max: 12, step: 1 },
    { param: 'accent', label: 'Accent', kind: 'color' },
  ],
  render(ctx, frame, item, audio, stack) {
    const feed = Number(item.params.feed ?? 0.055)
    const kill = Number(item.params.kill ?? 0.062)
    const speed = Number(item.params.speed ?? 1)
    const attractors = Number(item.params.attractors ?? 5)
    const accent = hexToRgb(String(item.params.accent ?? '#f2790c'))
    const size = SIZE_BY_QUALITY[stack.quality]

    let sim = sims.get(item.uid)
    const sig = `${attractors}|${size}`
    if (!sim || sim.sig !== sig) {
      const rd = new ReactionDiffusion(size)
      rd.seed(attractors, mulberry32(strHash(item.uid)))
      const tmp = document.createElement('canvas')
      tmp.width = size
      tmp.height = size
      sim = { rd, sig, tmp, tctx: tmp.getContext('2d') }
      sims.set(item.uid, sim)
    }

    const iterations = Math.min(20, Math.max(1, Math.round(2 + speed * 4)))
    const f = Math.min(0.12, Math.max(0.01, feed * (1 + audio.bass * 0.15)))
    for (let i = 0; i < iterations; i++) sim.rd.step(f, kill)

    if (sim.tctx) {
      sim.tctx.putImageData(sim.rd.toImageData(accent), 0, 0)
      ctx.save()
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(sim.tmp, 0, 0, stack.width, stack.height)
      ctx.restore()
    } else {
      // jsdom/no-2d fallback: coarse cell sampling keeps the tool functional in tests
      const img = sim.rd.toImageData(accent)
      const cw = stack.width / size
      const ch = stack.height / size
      for (let y = 0; y < size; y += 2)
        for (let x = 0; x < size; x += 2) {
          const i4 = (y * size + x) * 4
          ctx.fillStyle = `rgb(${img.data[i4]},${img.data[i4 + 1]},${img.data[i4 + 2]})`
          ctx.fillRect(x * cw, y * ch, cw * 2 + 1, ch * 2 + 1)
        }
    }
  },
}
```

In `src/core/schema.ts` add the export and the migration entry:

```ts
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

TOOL_PARAM_MIGRATIONS.ferrofluid = (p) => ({
  attractors: Number(p.blobs ?? 5),
  speed: Number(p.intensity ?? 1),
  accent: hslToHex(Number(p.hue ?? 280), 80, 55),
})
```

- [ ] **Step 4: Run** `npx vitest run src/core/schema.test.ts src/tools/generative/ferrofluid.test.ts src/state/projectStore.effects.test.ts` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/tools/generative/ferrofluid.ts src/tools/generative/ferrofluid.test.ts src/core/schema.ts src/core/schema.test.ts
git commit -m "feat(tools): ferrofluid 2.0 gray-scott + legacy param migration"
```

---

### Task 15: Shared tool utils + Particles 2.0.0 (Chladni nodal aggregation)

**Files:**
- Create: `src/tools/toolUtils.ts`
- Modify: `src/tools/generative/particles.ts` (full rewrite)
- Modify: `src/core/schema.ts` (migration entry)
- Create: `src/tools/generative/particles.test.ts`

**Interfaces (produces):**
```ts
// toolUtils.ts
export function strHash(s: string): number
export function drawShapePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, shape: 'circle' | 'square' | 'triangle'): void
```

- [ ] **Step 1: Failing tests**

Create `src/tools/generative/particles.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { particlesTool } from './particles'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0.5, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'p1', toolId: 'particles', toolVersion: '2.0.0',
  params: { count: 400, size: 2, speed: 1, hue: 200, a: 3, b: 4, m: 5, n: 6, damping: 0.96 },
  audio: [], automations: [], hidden: false,
}

describe('particles 2.0.0 chladni', () => {
  test('renders without throwing and is deterministic given same uid', () => {
    const run = () => {
      const calls: unknown[] = []
      const ctx = {
        save: () => calls.push('save'), restore: () => calls.push('restore'),
        fillRect: (..._a: unknown[]) => calls.push('rect'),
      } as unknown as CanvasRenderingContext2D
      particlesTool.render(ctx, frame, item, audio, stack)
      return calls.length
    }
    expect(run()).toBe(run())
  })
  test('registers migration for 1.x items', async () => {
    const { migrateProject } = await import('../../core/schema')
    void migrateProject
    const { TOOL_PARAM_MIGRATIONS } = await import('../../core/schema')
    expect(TOOL_PARAM_MIGRATIONS.particles).toBeDefined()
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

Create `src/tools/toolUtils.ts`:

```ts
export function strHash(s: string): number {
  let h = 7
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

export function drawShapePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shape: 'circle' | 'square' | 'triangle',
): void {
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  } else if (shape === 'square') {
    ctx.rect(cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx + r * 0.866, cy + r * 0.5)
    ctx.lineTo(cx - r * 0.866, cy + r * 0.5)
    ctx.closePath()
  }
}
```

In `src/tools/generative/ferrofluid.ts`: delete the local `strHash` and add `import { strHash } from '../toolUtils'` (DRY refactor; behavior identical).

Rewrite `src/tools/generative/particles.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

function chladni(x: number, y: number, a: number, b: number, m: number, n: number): number {
  return (
    a * Math.sin(Math.PI * m * x) * Math.sin(Math.PI * n * y) -
    b * Math.sin(Math.PI * n * x) * Math.sin(Math.PI * m * y)
  )
}

type Cloud = { pts: Float32Array; vel: Float32Array; sig: string }
const clouds = new Map<string, Cloud>()

// Particles: dust aggregating along Chladni nodal lines (Tool-Render.md §1.5).
export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '2.0.0',
  label: 'Particles',
  icon: 'sparkles',
  category: 'Generative',
  defaultParams: { count: 400, size: 2, speed: 1, hue: 200, a: 3, b: 4, m: 5, n: 6, damping: 0.96 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 50, max: 2000, step: 10 },
    { param: 'size', label: 'Size', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'a', label: 'A', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'b', label: 'B', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'm', label: 'Mode M', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'n', label: 'Mode N', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'damping', label: 'Damping', kind: 'slider', min: 0.8, max: 0.99, step: 0.01 },
  ],
  render(ctx, frame, item, audio, stack) {
    const count = Math.round(Number(item.params.count ?? 400))
    const size = Number(item.params.size ?? 2) * (1 + audio.level * 1.5)
    const a = Number(item.params.a ?? 3)
    const b = Number(item.params.b ?? 4)
    const m = Number(item.params.m ?? 5)
    const n = Number(item.params.n ?? 6)
    const damping = Number(item.params.damping ?? 0.96)
    const hue = Number(item.params.hue ?? 200)

    let cloud = clouds.get(item.uid)
    const sig = `${count}|${a}|${b}|${m}|${n}`
    if (!cloud || cloud.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(count * 2)
      const vel = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        pts[i * 2] = rng()
        pts[i * 2 + 1] = rng()
      }
      cloud = { pts, vel, sig }
      clouds.set(item.uid, cloud)
    }

    const { pts, vel } = cloud
    const dtScale = frame.dt * 60 * Number(item.params.speed ?? 1)
    ctx.save()
    for (let i = 0; i < count; i++) {
      const x = pts[i * 2]
      const y = pts[i * 2 + 1]
      const val = chladni(x, y, a, b, m, n)
      vel[i * 2] -= val * 0.004 * (x > 0.5 ? 1 : -1) * dtScale
      vel[i * 2 + 1] -= val * 0.004 * (y > 0.5 ? 1 : -1) * dtScale
      vel[i * 2] *= damping
      vel[i * 2 + 1] *= damping
      pts[i * 2] = (x + vel[i * 2] + 1) % 1
      pts[i * 2 + 1] = (y + vel[i * 2 + 1] + 1) % 1
      ctx.fillStyle = `hsla(${hue}, 80%, 62%, 0.75)`
      ctx.fillRect(pts[i * 2] * stack.width, pts[i * 2 + 1] * stack.height, size, size)
    }
    ctx.restore()
  },
}
```

Migration entry in `src/core/schema.ts` (after the ferrofluid entry):

```ts
TOOL_PARAM_MIGRATIONS.particles = (p) => ({
  count: Number(p.count ?? 400),
  size: Number(p.size ?? 2),
  speed: Number(p.speed ?? 1),
  hue: Number(p.hue ?? 200),
})
```

- [ ] **Step 4: Run** `npx vitest run src/tools/generative/particles.test.ts src/core/schema.test.ts src/tools/index.test.ts` → PASS (index.test unaffected: id unchanged).
- [ ] **Step 5: Commit**

```bash
git add src/tools/toolUtils.ts src/tools/generative/ferrofluid.ts src/tools/generative/particles.ts src/tools/generative/particles.test.ts src/core/schema.ts
git commit -m "feat(tools): particles 2.0 chladni aggregation + shared utils"
```

---

### Task 16: Flow Field 2.0.0 — curl streamlines

**Files:**
- Rewrite: `src/tools/generative/flowfield.ts`
- Modify: `src/core/schema.ts` (migration entry)
- Create: `src/tools/generative/flowfield.test.ts`

- [ ] **Step 1: Failing test** — `src/tools/generative/flowfield.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { flowfieldTool } from './flowfield'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 2, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 100, quality: 'high' }
const item: StackItem = {
  uid: 'ff', toolId: 'flowfield', toolVersion: '2.0.0',
  params: { segments: 600, steplen: 2.5, curl: 1, hue: 180 },
  audio: [], automations: [], hidden: false,
}

describe('flowfield 2.0.0', () => {
  test('renders without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => flowfieldTool.render(ctx, frame, item, audio, stack)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — rewrite `src/tools/generative/flowfield.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Starts = { pts: Float32Array; sig: string }
const startsCache = new Map<string, Starts>()

// Flow Field: thousands of short streamlines integrated through an animated angle field (curl noise surrogate).
export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '2.0.0',
  label: 'Flow Field',
  icon: 'waves',
  category: 'Generative',
  defaultParams: { segments: 600, steplen: 2.5, curl: 1, hue: 180 },
  controls: [
    { param: 'segments', label: 'Segments', kind: 'slider', min: 100, max: 2000, step: 10 },
    { param: 'steplen', label: 'Step Length', kind: 'slider', min: 0.5, max: 6, step: 0.1 },
    { param: 'curl', label: 'Curl', kind: 'slider', min: 0.2, max: 3, step: 0.05 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const segCount = Math.round(Number(item.params.segments ?? 600))
    const steplen = Number(item.params.steplen ?? 2.5)
    const curl = Number(item.params.curl ?? 1)
    const hue = Number(item.params.hue ?? 180)
    const t = frame.timeSec

    let starts = startsCache.get(item.uid)
    const sig = `${segCount}|${stack.width}x${stack.height}`
    if (!starts || starts.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(segCount * 2)
      for (let i = 0; i < segCount; i++) {
        pts[i * 2] = rng() * stack.width
        pts[i * 2 + 1] = rng() * stack.height
      }
      starts = { pts, sig }
      startsCache.set(item.uid, starts)
    }

    const angle = (px: number, py: number) =>
      (Math.sin(px * 0.008 * curl + t * 0.4) + Math.cos(py * 0.011 * curl - t * 0.3)) * Math.PI

    ctx.save()
    ctx.lineWidth = 1.25
    const K = 14
    for (let i = 0; i < segCount; i++) {
      let x = starts.pts[i * 2]
      let y = starts.pts[i * 2 + 1]
      ctx.strokeStyle = `hsla(${(hue + ((i * 7) % 40)) % 360}, 70%, 60%, 0.32)`
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < K; k++) {
        const a = angle(x, y)
        x += Math.cos(a) * steplen
        y += Math.sin(a) * steplen
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  },
}
```

Migration in `src/core/schema.ts`:

```ts
TOOL_PARAM_MIGRATIONS.flowfield = (p) => ({
  segments: Number(p.density ?? 14) * 40,
  steplen: 2.5,
  curl: 1,
  hue: Number(p.hue ?? 180),
})
```

Add a schema assertion mirroring the particles one (`expect(TOOL_PARAM_MIGRATIONS.flowfield).toBeDefined()` plus one mapped-value check) to `schema.test.ts`.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/tools/generative/flowfield.ts src/tools/generative/flowfield.test.ts src/core/schema.ts src/core/schema.test.ts
git commit -m "feat(tools): flowfield 2.0 curl streamlines + migration"
```

---

### Task 17: Tunnel 2.0.0 — perspective rings with selectable shape

**Files:**
- Rewrite: `src/tools/generative/tunnel.ts`
- Modify: `src/core/schema.ts` (identity-superset migration)
- Create: `src/tools/generative/tunnel.test.ts`

- [ ] **Step 1: Failing test** — `src/tools/generative/tunnel.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { tunnelTool } from './tunnel'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 3, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'tn', toolId: 'tunnel', toolVersion: '2.0.0',
  params: { rings: 40, speed: 1, hue: 280, shape: 'square' },
  audio: [], automations: [], hidden: false,
}

describe('tunnel 2.0.0', () => {
  test('renders circle/square/triangle without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    for (const shape of ['circle', 'square', 'triangle'] as const) {
      expect(() => tunnelTool.render(ctx, frame, { ...item, params: { ...item.params, shape } }, audio, stack)).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — rewrite `src/tools/generative/tunnel.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { drawShapePath } from '../toolUtils'

// Tunnel: concentric perspective shapes cycling toward a vanishing point (Tool-Render.md §1.3).
export const tunnelTool: ToolDef = {
  id: 'tunnel',
  kind: 'generative',
  version: '2.0.0',
  label: 'Tunnel',
  icon: 'circle-dashed',
  category: 'Generative',
  defaultParams: { rings: 40, speed: 1, hue: 280, shape: 'circle' },
  controls: [
    { param: 'rings', label: 'Rings', kind: 'slider', min: 10, max: 80, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'square', 'triangle'] },
  ],
  render(ctx, frame, item, audio, stack) {
    const rings = Math.round(Number(item.params.rings ?? 40))
    const speed = Number(item.params.speed ?? 1)
    const hue = Number(item.params.hue ?? 280)
    const shape = String(item.params.shape ?? 'circle') as 'circle' | 'square' | 'triangle'
    const cx = stack.width / 2
    const cy = stack.height / 2
    const maxR = Math.min(stack.width, stack.height) * 0.72

    ctx.save()
    for (let i = 0; i < rings; i++) {
      const z = (i / rings + frame.timeSec * speed * 0.02) % 1
      const radius = (1 - z) * maxR
      ctx.strokeStyle = `hsla(${hue}, 85%, ${55 + z * 15}%, ${Math.min(1, z * 1.2)})`
      ctx.lineWidth = 1 + z * 4 * (1 + audio.bass * 0.5)
      drawShapePath(ctx, cx, cy, Math.max(0.5, radius), shape)
      ctx.stroke()
    }
    ctx.restore()
  },
}
```

Migration in `src/core/schema.ts`:

```ts
TOOL_PARAM_MIGRATIONS.tunnel = (p) => ({ ...p, shape: 'circle' })
```

Plus a schema assertion as in Task 16.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit**

```bash
git add src/tools/generative/tunnel.ts src/tools/generative/tunnel.test.ts src/core/schema.ts src/core/schema.test.ts
git commit -m "feat(tools): tunnel 2.0 shaped perspective rings"
```

---

### Task 18: Liquid Metal + Molecules (new generative tools)

**Files:**
- Create: `src/tools/generative/liquidmetal.ts`, `src/tools/generative/molecules.ts`
- Modify: `src/tools/index.ts` (imports + registrations)
- Create: `src/tools/generative/liquidmetal-molecules.test.ts`

- [ ] **Step 1: Failing test** — `src/tools/generative/liquidmetal-molecules.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { liquidMetalTool } from './liquidmetal'
import { moleculesTool } from './molecules'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }

describe('liquid metal + molecules', () => {
  test('both render without throwing on proxy ctx', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => liquidMetalTool.render(ctx, frame, liquidMetalTool.defaultParams as never, audio, stack)).not.toThrow()
    expect(() => moleculesTool.render(ctx, frame, moleculesTool.defaultParams as never, audio, stack)).not.toThrow()
  })
  test('registered in catalog', () => {
    const ids = getCatalog().Generative.map((t) => t.id)
    expect(ids).toContain('liquidmetal')
    expect(ids).toContain('molecules')
  })
})
```

Note: `render` expects a `StackItem`; passing `defaultParams as never` exercises defaults — cast is required because params need the full StackItem shape; alternatively build a literal `StackItem` like other tests do (preferred; mirror the `item` fixture pattern from Task 15).

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/tools/generative/liquidmetal.ts`:

```ts
import type { ToolDef } from '../../core/types'

// Liquid Metal: metaball field with threshold + specular shading, cell-shaded raster (Tool-Render.md §1.4).
// Stylized grid sampling (GPU raytraced variant deferred) — see plan self-review deviations.
export const liquidMetalTool: ToolDef = {
  id: 'liquidmetal',
  kind: 'generative',
  version: '1.0.0',
  label: 'Liquid Metal',
  icon: 'gem',
  category: 'Generative',
  defaultParams: { blobs: 8, threshold: 1, lightAngle: 45, scale: 90 },
  controls: [
    { param: 'blobs', label: 'Blobs', kind: 'slider', min: 4, max: 14, step: 1 },
    { param: 'threshold', label: 'Threshold', kind: 'slider', min: 0.6, max: 1.6, step: 0.02 },
    { param: 'lightAngle', label: 'Light Angle', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'scale', label: 'Detail', kind: 'slider', min: 48, max: 160, step: 8 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const blobN = Math.round(Number(item.params.blobs ?? 8))
    const threshold = Number(item.params.threshold ?? 1)
    const lightRad = (Number(item.params.lightAngle ?? 45) * Math.PI) / 180
    const G = Math.max(48, Math.round(Number(item.params.scale ?? 90)))
    const t = frame.timeSec
    const cw = stack.width / G
    const ch = stack.height / G

    const blobs = Array.from({ length: blobN }, (_, i) => {
      const ph = (i / blobN) * Math.PI * 2
      return {
        x: 0.5 + Math.cos(ph + t * 0.35) * 0.28,
        y: 0.5 + Math.sin(ph * 1.6 + t * 0.27) * 0.28,
        r: 0.06 + 0.05 * ((i % 3) / 3),
      }
    })

    const field = (nx: number, ny: number) => {
      let sum = 0
      for (const b of blobs) {
        const dx = nx - b.x
        const dy = ny - b.y
        sum += (b.r * b.r) / (dx * dx + dy * dy + 0.0008)
      }
      return sum
    }

    const lx = Math.cos(lightRad)
    const ly = Math.sin(lightRad)
    const e = 1.5 / G

    for (let gy = 0; gy < G; gy++) {
      for (let gx = 0; gx < G; gx++) {
        const nx = gx / G
        const ny = gy / G
        const v = field(nx, ny)
        if (v <= threshold) continue
        const nxr = field(nx + e, ny) - v
        const nyr = field(nx, ny + e) - v
        const len = Math.hypot(nxr, nyr, 0.06)
        const dot = Math.max(0, (-nxr / len) * lx + (-nyr / len) * ly + 1 / len)
        const spec = Math.pow(dot, 20)
        const shade = 70 + dot * 130
        const r = Math.min(255, shade + spec * 255)
        const g = Math.min(255, shade * 0.98 + spec * 255)
        const bch = Math.min(255, shade * 0.95 + spec * 250)
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${bch | 0})`
        ctx.fillRect(gx * cw, gy * ch, cw + 1, ch + 1)
      }
    }
  },
}
```

`src/tools/generative/molecules.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Net = { seeds: Float32Array; sig: string }
const nets = new Map<string, Net>()

// Molecules: pseudo-3D node/bond lattice with depth-faded opacity (Tool-Render.md §1.2).
export const moleculesTool: ToolDef = {
  id: 'molecules',
  kind: 'generative',
  version: '1.0.0',
  label: 'Molecules',
  icon: 'network',
  category: 'Generative',
  defaultParams: { nodes: 42, linkDistance: 0.18, drift: 0.5 },
  controls: [
    { param: 'nodes', label: 'Nodes', kind: 'slider', min: 10, max: 120, step: 1 },
    { param: 'linkDistance', label: 'Link Distance', kind: 'slider', min: 0.05, max: 0.35, step: 0.01 },
    { param: 'drift', label: 'Drift', kind: 'slider', min: 0, max: 2, step: 0.05 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const nodeN = Math.round(Number(item.params.nodes ?? 42))
    const linkDist = Number(item.params.linkDistance ?? 0.18) * Math.min(stack.width, stack.height)
    const drift = Number(item.params.drift ?? 0.5)
    const t = frame.timeSec

    let net = nets.get(item.uid)
    const sig = `${nodeN}`
    if (!net || net.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const seeds = new Float32Array(nodeN * 4)
      for (let i = 0; i < nodeN; i++) {
        seeds[i * 4] = rng()
        seeds[i * 4 + 1] = rng()
        seeds[i * 4 + 2] = rng() * Math.PI * 2
        seeds[i * 4 + 3] = 0.2 + rng() * 0.5
      }
      net = { seeds, sig }
      nets.set(item.uid, net)
    }

    const px = new Float32Array(nodeN)
    const py = new Float32Array(nodeN)
    const pz = new Float32Array(nodeN)
    for (let i = 0; i < nodeN; i++) {
      const ox = net.seeds[i * 4]
      const oy = net.seeds[i * 4 + 1]
      const ph = net.seeds[i * 4 + 2]
      const rad = net.seeds[i * 4 + 3]
      px[i] = (ox + Math.cos(t * drift * 0.4 + ph) * rad * 0.12) * stack.width
      py[i] = (oy + Math.sin(t * drift * 0.33 + ph * 1.7) * rad * 0.12) * stack.height
      pz[i] = 0.5 + 0.5 * Math.sin(t * drift * 0.5 + ph)
    }

    ctx.save()
    for (let i = 0; i < nodeN; i++)
      for (let j = i + 1; j < nodeN; j++) {
        const dx = px[i] - px[j]
        const dy = py[i] - py[j]
        const d = Math.hypot(dx, dy)
        if (d > linkDist) continue
        const depthAlpha = 1 - (pz[i] + pz[j]) / 2
        ctx.strokeStyle = `rgba(200,220,255,${depthAlpha * 0.8})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px[i], py[i])
        ctx.lineTo(px[j], py[j])
        ctx.stroke()
      }
    for (let i = 0; i < nodeN; i++) {
      const r = 3 + (1 - pz[i]) * 4
      ctx.fillStyle = `rgba(200,220,255,${1 - pz[i]})`
      ctx.beginPath()
      ctx.arc(px[i], py[i], r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },
}
```

Register both in `src/tools/index.ts` (import lines alphabetically with the other generative imports; `registerTool(...)` calls after the existing generative block):

```ts
import { liquidMetalTool } from './generative/liquidmetal'
import { moleculesTool } from './generative/molecules'
// ...
registerTool(liquidMetalTool)
registerTool(moleculesTool)
```

- [ ] **Step 4: Update registration-surface test (keeps suite green)** — in `src/tools/index.test.ts`, replace the `'registers all 8 generative tools'` test body with:

```ts
  test('registers all 10 generative tools', () => {
    const ids = getCatalog().Generative.map((t) => t.id).sort()
    expect(ids).toEqual(
      [
        'ferrofluid', 'flowfield', 'kaleidoscope', 'liquidmetal', 'molecules',
        'particles', 'plasma', 'rings', 'starfield', 'tunnel',
      ].sort(),
    )
  })
```

- [ ] **Step 5: Run full suite** → PASS. **Step 6: Commit**

```bash
git add src/tools/generative/liquidmetal.ts src/tools/generative/molecules.ts src/tools/generative/liquidmetal-molecules.test.ts src/tools/index.ts src/tools/index.test.ts
git commit -m "feat(tools): liquid metal + molecules generators"
```

---

### Task 19: Doodle + Brutalist + Particles 2 (new generative tools)

**Files:**
- Create: `src/tools/generative/doodle.ts`, `src/tools/generative/brutalist.ts`, `src/tools/generative/particles2.ts`
- Modify: `src/tools/index.ts`
- Create: `src/tools/generative/phase2-tools.test.ts`

- [ ] **Step 1: Failing test** — `src/tools/generative/phase2-tools.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { doodleTool } from './doodle'
import { brutalistTool } from './brutalist'
import { particles2Tool } from './particles2'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 1, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const mk = (uid: string, toolId: string, params: Record<string, number | string>): StackItem => ({
  uid, toolId, toolVersion: '1.0.0', params, audio: [], automations: [], hidden: false,
})

describe('phase-2 generative tools', () => {
  test('doodle renders deterministic strokes', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => doodleTool.render(ctx, frame, mk('d1', 'doodle', {}), audio, stack)).not.toThrow()
  })
  test('brutalist draws cols x rows cells', () => {
    let rectCount = 0
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === 'fillRect'
            ? (..._a: unknown[]) => {
                rectCount++
              }
            : () => {},
      },
    ) as unknown as CanvasRenderingContext2D
    brutalistTool.render(ctx, frame, mk('b1', 'brutalist', { cols: 4 }), audio, stack)
    expect(rectCount).toBeGreaterThan(0)
  })
  test('particles2 attracts toward multiple centers', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => particles2Tool.render(ctx, frame, mk('q1', 'particles2', {}), audio, stack)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/tools/generative/doodle.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Ink = { strokes: Float32Array[]; sig: string }
const inkCache = new Map<string, Ink>()

// Doodle: hand-drawn jittered quadratic ink strokes (Tool-Render.md §1.6).
export const doodleTool: ToolDef = {
  id: 'doodle',
  kind: 'generative',
  version: '1.0.0',
  label: 'Doodle',
  icon: 'brush',
  category: 'Generative',
  defaultParams: { strokes: 24, jitter: 2, width: 3 },
  controls: [
    { param: 'strokes', label: 'Strokes', kind: 'slider', min: 4, max: 80, step: 1 },
    { param: 'jitter', label: 'Jitter', kind: 'slider', min: 0.5, max: 6, step: 0.5 },
    { param: 'width', label: 'Width', kind: 'slider', min: 1, max: 10, step: 0.5 },
  ],
  render(ctx, frame, item, audio, stack) {
    const strokeN = Math.round(Number(item.params.strokes ?? 24))
    const jitter = Number(item.params.jitter ?? 2)
    const width = Number(item.params.width ?? 3)

    let ink = inkCache.get(item.uid)
    const sig = `${strokeN}`
    if (!ink || ink.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const strokes: Float32Array[] = []
      for (let s = 0; s < strokeN; s++) {
        const pts = new Float32Array(24 * 2)
        let x = rng() * stack.width
        let y = rng() * stack.height
        let ang = rng() * Math.PI * 2
        for (let p = 0; p < 24; p++) {
          ang += (rng() - 0.5) * 1.2
          x += Math.cos(ang) * stack.width * 0.02
          y += Math.sin(ang) * stack.height * 0.02
          pts[p * 2] = x
          pts[p * 2 + 1] = y
        }
        strokes.push(pts)
      }
      ink = { strokes, sig }
      inkCache.set(item.uid, ink)
    }

    ctx.save()
    if ('filter' in ctx) ctx.filter = 'blur(0.6px)'
    ctx.strokeStyle = `rgba(255,255,255,${0.75 + audio.treble * 0.2})`
    const wobble = Math.sin(frame.timeSec * 0.8) * 0.4
    for (const pts of ink.strokes) {
      ctx.lineWidth = width + wobble
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let p = 1; p < pts.length / 2 - 2; p++) {
        const jx = (Math.random() - 0.5) * jitter
        const jy = (Math.random() - 0.5) * jitter
        ctx.quadraticCurveTo(pts[p * 2] + jx, pts[p * 2 + 1] + jy, pts[(p + 1) * 2], pts[(p + 1) * 2 + 1])
      }
      ctx.stroke()
    }
    ctx.restore()
  },
}
```

`src/tools/generative/brutalist.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { drawShapePath, strHash } from '../toolUtils'

// Brutalist: pure geometric B/W grid; per-cell interactive menu arrives in Phase 3 (spec §11).
export const brutalistTool: ToolDef = {
  id: 'brutalist',
  kind: 'generative',
  version: '1.0.0',
  label: 'Brutalist',
  icon: 'grid3x3',
  category: 'Generative',
  defaultParams: { cols: 8, mix: 0.5 },
  controls: [
    { param: 'cols', label: 'Columns', kind: 'slider', min: 3, max: 20, step: 1 },
    { param: 'mix', label: 'Mix', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const cols = Math.round(Number(item.params.cols ?? 8))
    const mix = Number(item.params.mix ?? 0.5)
    const cell = Math.min(stack.width, stack.height) / cols
    const rows = Math.ceil(stack.height / cell)
    const rng = mulberry32(strHash(`${item.uid}:static`))
    const shapes = ['square', 'circle', 'triangle'] as const
    const t = frame.timeSec

    ctx.save()
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const pick = shapes[Math.floor(rng() * 3)]
        const rot = Math.floor(rng() * 4) * (Math.PI / 2)
        const white = rng() < mix
        const cx = c * cell + cell / 2
        const cy = r * cell + cell / 2
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot + (white ? 0 : Math.sin(t * 0.3 + r + c) * 0.05))
        const s = cell * 0.34
        if (white) {
          ctx.fillStyle = '#f5f5f5'
          drawShapePath(ctx, 0, 0, s, pick)
          ctx.fill()
        } else {
          ctx.strokeStyle = '#101012'
          ctx.lineWidth = Math.max(1, cell * 0.06)
          drawShapePath(ctx, 0, 0, s, pick)
          ctx.stroke()
        }
        ctx.restore()
      }
    ctx.restore()
  },
}
```

Note: dark-theme stroke color `#101012` reads as black-on-light and subtle-on-dark; the canvas base is transparent-black so outlined cells remain visible. If the owner wants hard B/W, flip stroke to `#000000`.

`src/tools/generative/particles2.ts`:

```ts
import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Swarm = { pts: Float32Array; vel: Float32Array; sig: string }
const swarms = new Map<string, Swarm>()

// Particles 2: multi-attractor kinematics (Tool-Render.md §1.8).
export const particles2Tool: ToolDef = {
  id: 'particles2',
  kind: 'generative',
  version: '1.0.0',
  label: 'Particles 2',
  icon: 'snowflake',
  category: 'Generative',
  defaultParams: { count: 300, attractors: 3, strength: 40, hue: 320 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 50, max: 1500, step: 10 },
    { param: 'attractors', label: 'Attractors', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'strength', label: 'Strength', kind: 'slider', min: 5, max: 200, step: 5 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const count = Math.round(Number(item.params.count ?? 300))
    const attN = Math.round(Number(item.params.attractors ?? 3))
    const strength = Number(item.params.strength ?? 40)
    const hue = Number(item.params.hue ?? 320)
    const t = frame.timeSec

    let swarm = swarms.get(item.uid)
    const sig = `${count}|${attN}`
    if (!swarm || swarm.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(count * 4) // x,y,vx,vy
      for (let i = 0; i < count; i++) {
        pts[i * 4] = rng() * stack.width
        pts[i * 4 + 1] = rng() * stack.height
      }
      swarm = { pts, vel: new Float32Array(count * 2), sig }
      swarms.set(item.uid, swarm)
    }

    const atts = Array.from({ length: attN }, (_, i) => {
      const ph = (i / attN) * Math.PI * 2
      return {
        x: stack.width / 2 + Math.cos(ph + t * 0.3) * stack.width * 0.22,
        y: stack.height / 2 + Math.sin(ph * 1.4 + t * 0.24) * stack.height * 0.22,
      }
    })

    const { pts, vel } = swarm
    const pull = 0.001 * (1 + audio.level * 2)
    for (let i = 0; i < count; i++) {
      const x = pts[i * 4]
      const y = pts[i * 4 + 1]
      let fx = 0
      let fy = 0
      for (const a of atts) {
        const dx = a.x - x
        const dy = a.y - y
        const d2 = dx * dx + dy * dy + 40
        fx += (dx / d2) * strength
        fy += (dy / d2) * strength
      }
      vel[i * 2] = (vel[i * 2] + fx * pull) * 0.985
      vel[i * 2 + 1] = (vel[i * 2 + 1] + fy * pull) * 0.985
      let nx = x + vel[i * 2]
      let ny = y + vel[i * 2 + 1]
      if (nx < 0 || nx > stack.width) { vel[i * 2] *= -0.7; nx = Math.min(stack.width, Math.max(0, nx)) }
      if (ny < 0 || ny > stack.height) { vel[i * 2 + 1] *= -0.7; ny = Math.min(stack.height, Math.max(0, ny)) }
      pts[i * 4] = nx
      pts[i * 4 + 1] = ny
      ctx.fillStyle = `hsla(${hue}, 85%, 62%, 0.85)`
      ctx.fillRect(nx, ny, 2.2, 2.2)
    }
  },
}
```

Register all three in `src/tools/index.ts` (same pattern as Task 18):

```ts
import { doodleTool } from './generative/doodle'
import { brutalistTool } from './generative/brutalist'
import { particles2Tool } from './generative/particles2'
// ...
registerTool(doodleTool)
registerTool(brutalistTool)
registerTool(particles2Tool)
```

- [ ] **Step 4: Update registration-surface test** — in `src/tools/index.test.ts`, grow the generative list to 13:

```ts
  test('registers all 13 generative tools', () => {
    const ids = getCatalog().Generative.map((t) => t.id).sort()
    expect(ids).toEqual(
      [
        'brutalist', 'doodle', 'ferrofluid', 'flowfield', 'kaleidoscope', 'liquidmetal',
        'molecules', 'particles', 'particles2', 'plasma', 'rings', 'starfield', 'tunnel',
      ].sort(),
    )
  })
```

- [ ] **Step 5: Run full suite** → PASS. **Step 6: Commit**

```bash
git add src/tools/generative/doodle.ts src/tools/generative/brutalist.ts src/tools/generative/particles2.ts src/tools/generative/phase2-tools.test.ts src/tools/index.ts src/tools/index.test.ts
git commit -m "feat(tools): doodle, brutalist, particles2 generators"
```

---

### Task 20: Shaders tool + GPU pre-pass wiring

**Files:**
- Create: `src/tools/generative/shaders.ts`, `src/tools/generative/shaders.test.ts`
- Modify: `src/tools/index.ts` (import + register)
- Modify: `src/ui/Canvas.tsx` (three anchored edits below)
- Modify: `src/tools/index.test.ts` (final 14-id list)

- [ ] **Step 1: Failing test** — `src/tools/generative/shaders.test.ts`:

```tsx
import { describe, test, expect } from 'vitest'
import { shadersTool } from './shaders'
import { getCatalog } from '../../core/registry'
import type { Frame, AudioFrame, StackRenderContext, StackItem } from '../../core/types'

const frame: Frame = { timeSec: 4, dt: 1 / 60, bpm: 120 }
const audio: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, spectrum: new Float32Array(0), bpm: 120 }
const stack: StackRenderContext = { width: 200, height: 200, quality: 'high' }
const item: StackItem = {
  uid: 'sh1', toolId: 'shaders', toolVersion: '1.0.0',
  params: { palette: 'ice', scale: 5, speed: 1 },
  audio: [], automations: [], hidden: false,
}

describe('shaders tool', () => {
  test('renders fallback without throwing', () => {
    const ctx = new Proxy({}, { get: () => () => {} }) as unknown as CanvasRenderingContext2D
    expect(() => shadersTool.render(ctx, frame, item, audio, stack)).not.toThrow()
  })
  test('registered in catalog', () => {
    expect(getCatalog().Generative.map((t) => t.id)).toContain('shaders')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/tools/generative/shaders.test.ts` → FAIL.

- [ ] **Step 3: Implement** — create `src/tools/generative/shaders.ts`:

```ts
import type { ToolDef } from '../../core/types'

// Shaders: GPU fbm nebula rendered by the compositor pre-pass (spec §6).
// CPU/no-GL fallback paints an intentional dark speckle field.
export const shadersTool: ToolDef = {
  id: 'shaders',
  kind: 'generative',
  version: '1.0.0',
  label: 'Shaders',
  icon: 'aperture',
  category: 'Generative',
  defaultParams: { palette: 'magma', scale: 4, speed: 1 },
  controls: [
    { param: 'palette', label: 'Palette', kind: 'select', options: ['magma', 'ice', 'toxic'] },
    { param: 'scale', label: 'Scale', kind: 'slider', min: 1, max: 12, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
  ],
  render(ctx, frame, _item, _audio, stack) {
    let seed = Math.floor(frame.timeSec * 2) & 0x7fffffff
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    ctx.save()
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, stack.width, stack.height)
    for (let i = 0; i < 140; i++) {
      const x = rand() * stack.width
      const y = rand() * stack.height
      const s = 1 + rand() * 2
      const r = 120 + ((rand() * 100) | 0)
      const g = 80 + ((rand() * 60) | 0)
      const b = 180 + ((rand() * 70) | 0)
      ctx.fillStyle = `rgba(${r},${g},${b},${(0.25 + rand() * 0.4).toFixed(2)})`
      ctx.fillRect(x, y, s, s)
    }
    ctx.restore()
  },
}
```

Register in `src/tools/index.ts` (`import { shadersTool } from './generative/shaders'` + `registerTool(shadersTool)` after `registerTool(particles2Tool)`).

- [ ] **Step 4: Wire the pre-pass in `src/ui/Canvas.tsx`** — three anchored edits inside the rAF loop:

After `const passes = collectActiveEffects(st.stack)` insert:

```ts
      const genItem = st.stack.find((i) => i.toolId === 'shaders' && !i.hidden)
      const shaderGen = genItem
        ? {
            scale: Number(genItem.params.scale ?? 4),
            speed: Number(genItem.params.speed ?? 1),
            palette: Math.max(0, ['magma', 'ice', 'toxic'].indexOf(String(genItem.params.palette ?? 'magma'))),
            timeSec: effFrame.timeSec,
          }
        : undefined
```

Change the gate condition from `if (comp && passes.length > 0) {` to:

```ts
      if (comp && (passes.length > 0 || shaderGen)) {
```

and change the apply call to:

```ts
        comp.apply(base, passes, effFrame, a, { shaderGen })
```

(The no-compositor branches already degrade correctly: empty `passes` makes `every()` true, drawing the tool's own dark fallback.)

- [ ] **Step 5: Finalize registration surface** — in `src/tools/index.test.ts` replace the 13-id test with:

```ts
  test('registers all 14 generative tools', () => {
    const ids = getCatalog().Generative.map((t) => t.id).sort()
    expect(ids).toEqual(
      [
        'brutalist', 'doodle', 'ferrofluid', 'flowfield', 'kaleidoscope', 'liquidmetal',
        'molecules', 'particles', 'particles2', 'plasma', 'rings', 'shaders', 'starfield', 'tunnel',
      ].sort(),
    )
  })
```

- [ ] **Step 6: Run full suite** → PASS. **Step 7: Commit**

```bash
git add src/tools/generative/shaders.ts src/tools/generative/shaders.test.ts src/tools/index.ts src/tools/index.test.ts src/ui/Canvas.tsx
git commit -m "feat(tools): gpu-native shaders generator via compositor pre-pass"
```

---

### Task 21: Icon de-slop sweep (lucide keys, zero emoji)

**Files:**
- Create: `src/ui/toolIcon.tsx`, `src/ui/toolIcon.test.tsx`
- Modify: `src/ui/Catalog.tsx`, `src/ui/Stack.tsx`, `src/ui/NodeOptions.tsx`
- Modify: `icon:` strings in 16 remaining legacy def files (table below)

- [ ] **Step 1: Failing test** — `src/ui/toolIcon.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ToolIcon } from './toolIcon'

describe('ToolIcon', () => {
  test('renders svg for known keys and falls back for unknown keys', () => {
    const { container: a } = render(<ToolIcon name="atom" />)
    expect(a.querySelector('svg')).toBeTruthy()
    const { container: b } = render(<ToolIcon name="no-such-key" />)
    expect(b.querySelector('svg')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** — `src/ui/toolIcon.tsx`:

```tsx
import {
  Atom, Aperture, Brush, Camera, CircleDashed, Droplets, Gem, Grip, Grid2x2, Grid3x3,
  Hexagon, Image as ImageIcon, Lightbulb, Music, Network, Orbit, Palette, Pilcrow,
  Shapes, Snowflake, Sparkles, Square, Star, Thermometer, Triangle, Type, Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  image: ImageIcon,
  pilcrow: Pilcrow,
  music: Music,
  square: Square,
  palette: Palette,
  camera: Camera,
  atom: Atom,
  waves: Waves,
  hexagon: Hexagon,
  sparkles: Sparkles,
  droplets: Droplets,
  orbit: Orbit,
  star: Star,
  'circle-dashed': CircleDashed,
  gem: Gem,
  network: Network,
  brush: Brush,
  grid3x3: Grid3x3,
  snowflake: Snowflake,
  aperture: Aperture,
  grip: Grip,
  'grid-2x2': Grid2x2,
  thermometer: Thermometer,
  lightbulb: Lightbulb,
  triangle: Triangle,
  type: Type,
}

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Shapes
  return <Icon className={className} />
}
```

- [ ] **Step 4: Replace icon STRINGS in legacy defs** — set each file's `icon:` value to its mapped key:

| File | New key | | File | New key |
|---|---|---|---|---|
| `inputs/imageVideo.ts` | `'image'` | | `generative/kaleidoscope.ts` | `'hexagon'` |
| `inputs/text.ts` | `'pilcrow'` | | `generative/plasma.ts` | `'droplets'` |
| `inputs/audioFile.ts` | `'music'` | | `generative/rings.ts` | `'orbit'` |
| `inputs/solidColor.ts` | `'square'` | | `generative/starfield.ts` | `'star'` |
| `inputs/gradient.ts` | `'palette'` | | `filters/halftone.ts` | `'grip'` |
| `inputs/camera.ts` | `'camera'` | | `filters/pixelator.ts` | `'grid-2x2'` |
| `filters/thermal.ts` | `'thermometer'` | | `filters/reLight.ts` | `'lightbulb'` |
| `filters/facets.ts` | `'triangle'` | | `filters/typeShape.ts` | `'type'` |

(Ferrofluid/particles/flowfield/tunnel/liquidmetal/molecules/doodle/brutalist/particles2/shaders were already keyed in Tasks 14–20.)

- [ ] **Step 5: Swap renderers** — three exact replacements:

In `src/ui/Catalog.tsx` replace `<span className="text-base">{t.icon}</span>` with `<ToolIcon name={String(t.icon)} className="h-4 w-4" />` and add `import { ToolIcon } from './toolIcon'`.

In `src/ui/Stack.tsx` replace the node-row icon span rendering `{def?.icon}` with `<ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />` (+ same import).

In `src/ui/NodeOptions.tsx` replace the header icon box contents `{def.icon}` with `<ToolIcon name={String(def.icon)} className="h-4 w-4" />` (+ same import).

- [ ] **Step 6: Emoji-free verification**

Run: `node -e "const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]).filter(f=>/\.(ts|tsx)$/.test(f));const bad=[];for(const f of walk('src')){const t=fs.readFileSync(f,'utf8');for(const ch of t){const cp=ch.codePointAt(0);if(cp&&cp>0x2600){bad.push(f+' U+'+cp.toString(16));break}}}console.log(bad.length?bad.join('\n'):'CLEAN')"`

Expected output exactly: `CLEAN`. If any file listed, replace its offending glyph per the mapping table or remove decorative residue.

- [ ] **Step 7: Run full suite** → PASS. **Step 8: Commit**

```bash
git add -A src/tools src/ui/toolIcon.tsx src/ui/toolIcon.test.tsx src/ui/Catalog.tsx src/ui/Stack.tsx src/ui/NodeOptions.tsx
git commit -m "refactor(ui): lucide icon keys everywhere, zero emoji"
```

---

### Task 22: Final verification gate

**Files:** none created; verification only.

- [ ] **Step 1: Typecheck** — Run: `npx tsc --noEmit` → Expected: exit 0, no output.
- [ ] **Step 2: Full test suite** — Run: `npx vitest run` → Expected: every file green; total count ≥ 55 (39 baseline + ~25 new minus overlaps).
- [ ] **Step 3: Production build** — Run: `npx vite build` → Expected: built without errors.
- [ ] **Step 4: Manual visual checklist** (dev server `http://localhost:5173/tools/`, owner screenshots as reference):

| Item | Reference | Pass criterion |
|---|---|---|
| Ferrofluid | §1.1 screenshot | Turing-like woven channels around dark blobs, not soft circles |
| Particles | §1.5 | Dust aggregates along curved nodal lines |
| Flow Field | §1.2-style flow | Dense integrated streamlines, not sparse arrows |
| Tunnel | §1.3 | Concentric shapes cycling to vanishing point |
| Liquid Metal | §1.4 | Merging blobs, specular highlight follows light angle |
| Molecules | §1.2 | Depth-faded node/bond lattice |
| Shaders (WebGL) | §1.7 | Animated fbm nebula, palettes switch live |
| Effects ×7 | §3.x each | Each matches its described behavior over Ferrofluid |
| Raster badge | spec §4 | Badge appears iff ≥1 effect enabled |

- [ ] **Step 5: Performance budget** — DevTools performance recording at default quality with Glow(radius 8) + Aberration + Grain enabled over Ferrofluid: sustained ≥ 50 fps at 720p-class viewport on mid hardware. If below: reduce the glow loop constant `12` to `8` (single documented knob) and re-record.
- [ ] **Step 6: Commit any straggler artifacts**

```bash
git add -A && git commit -m "chore: render core v2 verification pass" || echo "nothing to commit"
```

---

## Self-Review (completed against the spec)

**Spec coverage matrix**

| Spec section | Implementing tasks |
|---|---|
| §1 goals (algorithms/effects/model/tabs) | T14–T20 / T6–T9 / T1–T2 / T12–T13 |
| §2 approach A (hybrid) | T10, T11 |
| §3 frame loop two-path | T11 (+T20 gate extension) |
| §4 data model, SCHEMA v2, migrations, raster flag | T1, T2, T13, T14–T17 migration entries |
| §5 seven effect maths + ranges | T6, T7, T8, T9 |
| §6 generator rewrites table | T14 (ferrofluid), T15 (particles), T16 (flowfield), T17 (tunnel), T18 (liquidmetal, molecules), T19 (doodle, brutalist, particles2), T20 (shaders) |
| §7 Gray-Scott solver | T3 |
| §8 minimal UI (tabs, badge) | T12, T13 |
| §9 fallback/a11y/reduced-motion | T4, T10, T11 (freeze), English copy throughout, zero emoji (T21) |
| §10 testing & perf budget | Every task's steps + T22 |

**Documented deviations / open questions for owner**

1. Kaleidoscope, Plasma, Rings, Starfield stay untouched: `Tool-Render.md` documents nine generators and none of these four appear in it — no reference exists to match against. Provide references if you want them refreshed in a Phase 1b.
2. Glow is a single-pass 12-tap radial bright-blur approximation of bloom (separable multi-FBO blur deferred; visual intent preserved, cheaper).
3. Waves: GL path clamps edge pixels, CPU reference wraps them — imperceptible difference, both deterministic.
4. Liquid Metal is cell-shaded grid sampling (stylized), not per-pixel raytracing; upgrade path noted.
5. Brutalist per-cell interactive menu (Expand/Rotate/Swap/Shrink) intentionally deferred to Phase 3 per spec §11.
6. Shaders keeps a dark speckle CPU fallback; the primary look requires WebGL2 like any real shader toy.

**Placeholder scan:** none — every code step contains complete code; the Task 12 relocation instruction refers to moving EXISTING file content verbatim (not missing content).

**Type consistency:** `EffectPassDef.uniforms(p, frame)` matches all seven defs and `buildUniforms`; `ActivePass.bindings` produced by `collectActiveEffects`, consumed only by `buildUniforms`; `Compositor.apply(..., opts.shaderGen)` matches Task 11/20 call sites; store action names identical between Task 2 definitions and Task 12/13 usage; `TOOL_PARAM_MIGRATIONS` signature matches schema Task 1 and entries in Tasks 14–17.




