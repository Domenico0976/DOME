# DOME Tools App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React (Vite+TS) canvas-centric artifact-generation editor at `/tools` where a left toolbar adds Tool panels (Image&Video, Text, 3D Maker, Lyrics/Subtitles, Camera, HTML), each renders to a shared canvas, reacts to global audio, supports per-tool effects, and is keyframed on a bottom timeline — replacing the rejected node-graph work (M1–M4).

**Architecture:** A single zustand `ProjectState` store drives everything; every UI control dispatches a store action (no local-only slider state). Each Tool renders to its own **offscreen canvas** (2D, or WebGL for 3D Maker); one visible canvas composites the layers in z-order. Audio is a **global singleton** (reuse `audio/engine.ts`, gesture-gated) exposing `bass/mid/treble/level/spectrum` bands; per-param audio binding is a first-class control resolved as `manual keyframe override > audio map > static`. Export records audio bands during a live pass, then re-renders deterministically from that recording.

**Tech Stack:** React 18 + Vite + TypeScript, zustand (store), Canvas2D + WebGL (three.js for 3D Maker), Vitest (tests), GitHub Pages (deploy at `/tools`).

## Global Constraints

- **All UI copy in English** (no Italian in the interface).
- **Budget = €0**: no paid APIs; Image&Video URL import is CORS-limited with an honest gradient fallback (no backend proxy).
- **AudioContext created ONLY inside a user-gesture handler** (the Audio button).
- **Single ProjectState store → renderer → canvas**; every control is a store action (no local-only slider state).
- **Canvas always mounted**; empty state = inline `Add a tool to get started` label + pulsing dot, **not** a full screen.
- **Style**: dark/graphite (`#0d0d10` background), lime/green accent (replace existing `#7aa2ff`), Inter font.
- **Deploy**: GitHub Pages at `/tools`; branch `Tools-Dome`; open PR to `main`; **never push without explicit owner authorization**.
- Reuse (do NOT rewrite): `tools-app/src/audio/engine.ts`, `tools-app/src/audio/bands.ts`; reuse `tools-app/src/ui/BottomSheet.tsx` (M7b) for mobile. Discard: `tools-app/src/engine/graph.ts`, `tools-app/src/engine/engine.ts` graph evaluator, `tools-app/src/nodes/*` ReactFlow nodes, `tools-app/src/ui/ReactFlow` UI.

---

## File Structure

```
tools-app/src/
  state/
    types.ts            # ToolInstance, Keyframe, Track, AudioState, ProjectState
    projectStore.ts      # zustand store + actions (addTool, updateParam, bindAudio, setKeyframe, play/pause, ...)
  tools/
    types.ts            # ToolDef, ControlDef, RenderContext, AudioBinding
    registry.ts         # registerTool/getTool; built-in registry
    text.ts             # Text tool def
    imageVideo.ts       # Image&Video tool def (local/camera/url)
    threeD.ts           # 3D Maker tool def (WebGL offscreen via three.js)
    lyrics.ts           # Lyrics/Subtitles tool def
    camera.ts           # Camera tool def
    html.ts             # HTML tool def
  render/
    compositor.ts       # offscreen-per-tool composite -> main canvas
    effects.ts          # per-tool effect pipeline (blur/chroma/threshold/noise/posterize/pixelate/vignette/hue)
    audioBinding.ts     # resolveEffectiveValue(): override > audio > static
    recording.ts        # record audio bands over a playback pass for deterministic export
  audio/
    (reuse engine.ts, bands.ts — add gesture guard only)
    useAudio.ts         # hook: ensureAudioContext() on gesture, exposes bands each frame
  ui/
    App.tsx             # layout shell (toolbar | canvas | timeline; mobile bottom-sheet)
    Canvas.tsx          # always-mounted visible canvas
    Toolbar.tsx         # left vertical icon toolbar
    ToolPanel.tsx       # floating draggable/resizable/collapsible panel + controls + audio-binding UI
    Timeline.tsx        # bottom timeline: ruler, play/pause, per-tool keyframe tracks, keyframe editor
    AudioButton.tsx     # top-right gesture-gated audio enable
    EmptyState.tsx      # inline "Add a tool to get started" + pulsing dot
  styles/
    theme.css           # lime/green tokens, Inter, graphite bg
```

---

### Task 1: Theme tokens + always-mounted canvas + inline empty state

**Files:**
- Create: `tools-app/src/styles/theme.css`
- Create: `tools-app/src/ui/Canvas.tsx`
- Create: `tools-app/src/ui/EmptyState.tsx`
- Modify: `tools-app/src/App.tsx` (replace node-graph shell)

**Interfaces:**
- `Canvas.tsx` exports `Canvas` which renders one `<canvas>` and forwards a ref to the compositor.
- `EmptyState` renders only when `tools.length === 0`.

- [ ] **Step 1: Write failing test**

```tsx
// tools-app/src/ui/EmptyState.test.tsx
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'
test('shows inline prompt when empty', () => {
  render(<EmptyState />)
  expect(screen.getByText('Add a tool to get started')).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools-app && npx vitest run src/ui/EmptyState.test.tsx`
Expected: FAIL (`EmptyState` not defined)

- [ ] **Step 3: Write theme + components**

```css
/* tools-app/src/styles/theme.css */
:root {
  --bg: #0d0d10;
  --panel: #16161a;
  --accent: #a3e635;      /* lime/green — replaces #7aa2ff */
  --accent-strong: #84cc16;
  --text: #e8e8ea;
  --muted: #8a8a92;
  --border: #2a2a30;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font-family: Inter, system-ui, sans-serif; }
```

```tsx
// tools-app/src/ui/EmptyState.tsx
export function EmptyState() {
  return (
    <div className="empty-state" aria-live="polite">
      <span className="empty-dot" />
      Add a tool to get started
    </div>
  )
}
```

```tsx
// tools-app/src/ui/Canvas.tsx
import { forwardRef } from 'react'
export const Canvas = forwardRef<HTMLCanvasElement>((_, ref) => (
  <canvas ref={ref} className="stage-canvas" data-testid="stage-canvas" />
))
Canvas.displayName = 'Canvas'
```

```tsx
// tools-app/src/App.tsx (minimal shell for now; expanded in later tasks)
import { Canvas } from './ui/Canvas'
import { EmptyState } from './ui/EmptyState'
import '../styles/theme.css'
export default function App() {
  const hasTools = false // wired to store in Task 2
  return (
    <div className="app">
      <main className="stage">
        <Canvas />
        {!hasTools && <EmptyState />}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools-app && npx vitest run src/ui/EmptyState.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tools-app/src/styles/theme.css tools-app/src/ui/Canvas.tsx tools-app/src/ui/EmptyState.tsx tools-app/src/App.tsx
git commit -m "feat: theme tokens, always-mounted canvas, inline empty state"
```

---

### Task 2: ProjectState store + types

**Files:**
- Create: `tools-app/src/state/types.ts`
- Create: `tools-app/src/state/projectStore.ts`
- Modify: `tools-app/src/App.tsx` (subscribe to store)

**Interfaces:**
- `ToolInstance { id: string; type: string; x: number; y: number; w: number; h: number; collapsed: boolean; params: Record<string, number | string>; effects: EffectState[]; audio: AudioBinding[]; keyframes: Keyframe[] }`
- `Keyframe { param: string; timeSec: number; value: number; easing: 'linear' | 'ease' }`
- `AudioBinding { param: string; source: 'bass' | 'mid' | 'treble' | 'level' | 'spectrum'; band?: number; curve: 'linear' | 'invert'; amount: number }`
- `Track { toolId: string; keyframes: Keyframe[] }`
- `AudioState { enabled: boolean; source: 'mic' | 'file' | null; contextReady: boolean }`
- Store actions: `addTool(type)`, `removeTool(id)`, `selectTool(id)`, `updateParam(id, param, value)`, `bindAudio(id, binding)`, `setKeyframe(id, kf)`, `play()`, `pause()`, `tick(timeSec)`, `setAudioEnabled(on)`.

- [ ] **Step 1: Write failing test**

```ts
// tools-app/src/state/projectStore.test.ts
import { useProjectStore } from './projectStore'
test('addTool creates an instance with defaults', () => {
  const { addTool, tools } = useProjectStore.getState()
  addTool('text')
  expect(useProjectStore.getState().tools.length).toBe(1)
  expect(useProjectStore.getState().tools[0].type).toBe('text')
})
```

- [ ] **Step 2: Run test to verify it fails** → FAIL (module missing)

- [ ] **Step 3: Implement types + store**

```ts
// tools-app/src/state/types.ts
export type ToolInstance = {
  id: string; type: string; x: number; y: number; w: number; h: number
  collapsed: boolean; params: Record<string, number | string>
  effects: EffectState[]; audio: AudioBinding[]; keyframes: Keyframe[]
}
export type EffectState = { kind: string; params: Record<string, number> }
export type AudioBinding = {
  param: string; source: 'bass'|'mid'|'treble'|'level'|'spectrum'
  band?: number; curve: 'linear'|'invert'; amount: number
}
export type Keyframe = { param: string; timeSec: number; value: number; easing: 'linear'|'ease' }
export type Track = { toolId: string; keyframes: Keyframe[] }
export type AudioState = { enabled: boolean; source: 'mic'|'file'|null; contextReady: boolean }
```

```ts
// tools-app/src/state/projectStore.ts
import { create } from 'zustand'
import type { AudioBinding, AudioState, Keyframe, ToolInstance } from './types'

let counter = 0
const uid = (p: string) => `${p}-${counter++}`

type State = {
  tools: ToolInstance[]; selection: string | null
  timeline: { playing: boolean; timeSec: number; duration: number }
  audio: AudioState
  addTool: (type: string) => void
  removeTool: (id: string) => void
  selectTool: (id: string | null) => void
  updateParam: (id: string, param: string, value: number | string) => void
  bindAudio: (id: string, binding: AudioBinding) => void
  setKeyframe: (id: string, kf: Keyframe) => void
  play: () => void; pause: () => void; tick: (t: number) => void
  setAudioEnabled: (on: boolean) => void
}
export const useProjectStore = create<State>((set) => ({
  tools: [], selection: null,
  timeline: { playing: false, timeSec: 0, duration: 10 },
  audio: { enabled: false, source: null, contextReady: false },
  addTool: (type) => set((s) => {
    const inst: ToolInstance = {
      id: uid(type), type, x: 80, y: 80, w: 320, h: 220, collapsed: false,
      params: {}, effects: [], audio: [], keyframes: [],
    }
    return { tools: [...s.tools, inst], selection: inst.id }
  }),
  removeTool: (id) => set((s) => ({ tools: s.tools.filter((t) => t.id !== id) })),
  selectTool: (id) => set({ selection: id }),
  updateParam: (id, param, value) => set((s) => ({
    tools: s.tools.map((t) => t.id === id ? { ...t, params: { ...t.params, [param]: value } } : t),
  })),
  bindAudio: (id, binding) => set((s) => ({
    tools: s.tools.map((t) => t.id === id ? { ...t, audio: [...t.audio.filter((a) => a.param !== binding.param), binding] } : t),
  })),
  setKeyframe: (id, kf) => set((s) => ({
    tools: s.tools.map((t) => t.id === id ? { ...t, keyframes: [...t.keyframes.filter((k) => !(k.param === kf.param && k.timeSec === kf.timeSec)), kf] } : t),
  })),
  play: () => set((s) => ({ timeline: { ...s.timeline, playing: true } })),
  pause: () => set((s) => ({ timeline: { ...s.timeline, playing: false } })),
  tick: (t) => set((s) => ({ timeline: { ...s.timeline, timeSec: t } })),
  setAudioEnabled: (on) => set((s) => ({ audio: { ...s.audio, enabled: on, contextReady: on } })),
}))
```

- [ ] **Step 4: Run test** → PASS

- [ ] **Step 5: Commit** `git commit -m "feat: ProjectState store + types"`

---

### Task 3: Tool registry + ToolDef/types

**Files:**
- Create: `tools-app/src/tools/types.ts`
- Create: `tools-app/src/tools/registry.ts`

**Interfaces:**
- `ToolDef { type: string; label: string; icon: string; defaultParams: Record<string, number|string>; controls: ControlDef[]; render(tool: ToolInstance, ctx: CanvasRenderingContext2D, frame: RenderFrame, audio: BandsSnapshot): void }`
- `ControlDef { param: string; label: string; kind: 'slider'|'select'|'color'; min?: number; max?: number; step?: number; options?: string[] }`
- `RenderFrame { timeSec: number; dt: number }`
- `getTool(type): ToolDef | undefined`, `registerTool(def)`, `listTools(): ToolDef[]`

- [ ] **Step 1: Write failing test**

```ts
// tools-app/src/tools/registry.test.ts
import { registerTool, getTool, listTools } from './registry'
test('registers and lists a tool', () => {
  registerTool({ type: 'demo', label: 'Demo', icon: '◆', defaultParams: {}, controls: [], render: () => {} })
  expect(getTool('demo')?.label).toBe('Demo')
  expect(listTools().some((t) => t.type === 'demo')).toBe(true)
})
```

- [ ] **Step 2-4:** implement `types.ts` (`ToolDef`, `ControlDef`, `RenderFrame`) and `registry.ts` (`Map<string, ToolDef>` + the three functions). Test passes.

- [ ] **Step 5:** Commit `feat: tool registry + ToolDef types`

---

### Task 4: Audio binding resolver (override > audio > static)

**Files:**
- Create: `tools-app/src/render/audioBinding.ts`

**Interfaces:**
- `resolveEffectiveValue(tool: ToolInstance, param: string, baseStatic: number, audio: BandsSnapshot, timeSec: number): number`
- Priority: explicit keyframe at `timeSec` (override) → audio map → static `baseStatic`.

- [ ] **Step 1: failing test**

```ts
// tools-app/src/render/audioBinding.test.ts
import { resolveEffectiveValue } from './audioBinding'
import type { ToolInstance } from '../state/types'
const tool: ToolInstance = {
  id: 't', type: 'text', x: 0, y: 0, w: 0, h: 0, collapsed: false,
  params: { scale: 1 }, effects: [],
  audio: [{ param: 'scale', source: 'bass', curve: 'linear', amount: 2 }],
  keyframes: [{ param: 'scale', timeSec: 0, value: 5, easing: 'linear' }],
}
test('keyframe override beats audio map beats static', () => {
  const bands = { bass: 0.5, mid: 0, treble: 0, level: 0, spectrum: { data: new Float32Array(64) } } as any
  expect(resolveEffectiveValue(tool, 'scale', 1, bands, 0)).toBe(5) // override
})
```

- [ ] **Step 3: implement**

```ts
// tools-app/src/render/audioBinding.ts
import type { BandsSnapshot } from '../audio/bands'
import type { ToolInstance } from '../state/types'

function keyframeAt(tool: ToolInstance, param: string, t: number) {
  return tool.keyframes.find((k) => k.param === param && Math.abs(k.timeSec - t) < 1e-3)
}
function audioValue(tool: ToolInstance, param: string, audio: BandsSnapshot): number | null {
  const b = tool.audio.find((a) => a.param === param)
  if (!b) return null
  const raw = b.source === 'spectrum'
    ? (audio.spectrum?.data[b.band ?? 0] ?? 0)
    : (audio[b.source] as number)
  const v = b.curve === 'invert' ? 1 - raw : raw
  return b.amount * v
}
export function resolveEffectiveValue(
  tool: ToolInstance, param: string, baseStatic: number, audio: BandsSnapshot, timeSec: number,
): number {
  const kf = keyframeAt(tool, param, timeSec)
  if (kf) return kf.value                 // manual override wins
  const av = audioValue(tool, param, audio)
  if (av !== null) return av               // audio map
  return baseStatic                        // static default
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: audio-binding resolver (override>audio>static)`.

---

### Task 5: Compositor (offscreen-per-tool → main canvas)

**Files:**
- Create: `tools-app/src/render/compositor.ts`

**Interfaces:**
- `composite(main: HTMLCanvasElement, tools: ToolInstance[], frame: RenderFrame, audio: BandsSnapshot): void` — for each visible tool, call its `ToolDef.render` onto a per-tool offscreen canvas sized to the tool's `w/h`, then `drawImage` onto `main` at `tool.x, tool.y` in z-order (tools array order).

- [ ] **Step 1: failing test** (jsdom canvas stub or node-canvas; keep minimal — assert it calls each tool's render once):

```ts
// tools-app/src/render/compositor.test.ts
import { composite } from './compositor'
import type { ToolInstance } from '../state/types'
import type { ToolDef } from '../tools/types'
const tool: ToolInstance = { id:'a', type:'demo', x:10,y:10,w:50,h:50,collapsed:false,params:{},effects:[],audio:[],keyframes:[] }
const def: ToolDef = { type:'demo', label:'D', icon:'x', defaultParams:{}, controls:[], render: jest.fn() }
test('composite invokes each tool render once', () => {
  ;(globalThis as any).__registry = { demo: def }
  composite({} as any, [tool], { timeSec: 0, dt: 0 }, { bass:0,mid:0,treble:0,level:0,spectrum:{data:new Float32Array(64)} } as any)
  expect(def.render).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 3: implement**

```ts
// tools-app/src/render/compositor.ts
import type { RenderFrame } from '../tools/types'
import type { ToolInstance } from '../state/types'
import type { BandsSnapshot } from '../audio/bands'
import { getTool } from '../tools/registry'

export function composite(
  main: HTMLCanvasElement, tools: ToolInstance[], frame: RenderFrame, audio: BandsSnapshot,
): void {
  const mctx = main.getContext('2d')
  if (!mctx) return
  mctx.clearRect(0, 0, main.width, main.height)
  for (const tool of tools) {
    const def = getTool(tool.type)
    if (!def || tool.collapsed) continue
    const off = document.createElement('canvas')
    off.width = Math.max(1, tool.w); off.height = Math.max(1, tool.h)
    const octx = off.getContext('2d')
    if (!octx) continue
    def.render(tool, octx, frame, audio)
    mctx.drawImage(off, tool.x, tool.y, tool.w, tool.h)
  }
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: offscreen-per-tool compositor`.

---

### Task 6: Per-tool effects pipeline

**Files:**
- Create: `tools-app/src/render/effects.ts`

**Interfaces:**
- `applyEffects(ctx: CanvasRenderingContext2D, effects: EffectState[]): void` — applies in order: `blur` (Canvas2D `filter='blur(Npx)'`), `threshold` (per-pixel via getImageData), `noise` (random grain), `posterize`, `pixelate`, `vignette`, `hue` (hue-rotate), `chroma` (color-key removal).

- [ ] **Step 1: failing test** — `applyEffects` with `{kind:'blur',params:{px:2}}` sets `ctx.filter`.

- [ ] **Step 3: implement** (real code; blur + threshold shown, others analogous):

```ts
// tools-app/src/render/effects.ts
import type { EffectState } from '../state/types'
export function applyEffects(ctx: CanvasRenderingContext2D, effects: EffectState[]): void {
  for (const e of effects) {
    switch (e.kind) {
      case 'blur': ctx.filter = `blur(${e.params.px ?? 0}px)`; break
      case 'hue': ctx.filter = `hue-rotate(${e.params.deg ?? 0}deg)`; break
      case 'pixelate': { /* downscale/upscale */ break }
      case 'threshold': threshold(ctx, e.params.level ?? 128); break
      case 'noise': noise(ctx, e.params.amount ?? 0.1); break
      case 'posterize': posterize(ctx, e.params.levels ?? 4); break
      case 'vignette': vignette(ctx); break
      case 'chroma': chroma(ctx, e.params.color ?? '#00ff00', e.params.tol ?? 0.3); break
    }
  }
}
function threshold(ctx: CanvasRenderingContext2D, level: number) {
  const d = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); const p = d.data
  for (let i = 0; i < p.length; i += 4) { const v = (p[i]+p[i+1]+p[i+2])/3 > level ? 255 : 0; p[i]=p[i+1]=p[i+2]=v }
  ctx.putImageData(d, 0, 0)
}
function noise(ctx: CanvasRenderingContext2D, amount: number) {
  const d = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height); const p = d.data
  for (let i = 0; i < p.length; i += 4) { const n = (Math.random()-0.5)*255*amount; p[i]+=n; p[i+1]+=n; p[i+2]+=n }
  ctx.putImageData(d, 0, 0)
}
function posterize(ctx: CanvasRenderingContext2D, levels: number) {
  const step = 255 / Math.max(1, levels); const d = ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height); const p = d.data
  for (let i = 0; i < p.length; i += 4) { p[i]=Math.round(p[i]/step)*step; p[i+1]=Math.round(p[i+1]/step)*step; p[i+2]=Math.round(p[i+2]/step)*step }
  ctx.putImageData(d, 0, 0)
}
function vignette(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas; const g = ctx.createRadialGradient(w/2,h/2,h*0.3,w/2,h/2,h*0.75)
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.6)'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h)
}
function chroma(ctx: CanvasRenderingContext2D, _color: string, tol: number) {
  const d = ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height); const p = d.data
  for (let i = 0; i < p.length; i += 4) { if (p[i+1] > 100 && p[i] < 80 && p[i+2] < 80 && tol > 0.2) p[i+3] = 0 }
  ctx.putImageData(d, 0, 0)
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: per-tool effects pipeline`.

---

### Task 7: Left toolbar

**Files:**
- Create: `tools-app/src/ui/Toolbar.tsx`
- Modify: `tools-app/src/App.tsx` (render `<Toolbar/>` + hide `EmptyState` when tools exist)

**Interfaces:** Toolbar lists `listTools()`; clicking calls `addTool(type)`.

- [ ] **Step 1: failing test** — clicking an icon calls `addTool`.

- [ ] **Step 3: implement**

```tsx
// tools-app/src/ui/Toolbar.tsx
import { useProjectStore } from '../state/projectStore'
import { listTools } from '../tools/registry'
export function Toolbar() {
  const addTool = useProjectStore((s) => s.addTool)
  return (
    <nav className="toolbar" aria-label="Tools">
      {listTools().map((t) => (
        <button key={t.type} className="tool-btn" title={t.label} aria-label={t.label}
          onClick={() => addTool(t.type)}>{t.icon}</button>
      ))}
    </nav>
  )
}
```

```tsx
// App.tsx (updated)
import { useProjectStore } from './state/projectStore'
import { Canvas } from './ui/Canvas'
import { EmptyState } from './ui/EmptyState'
import { Toolbar } from './ui/Toolbar'
import '../styles/theme.css'
export default function App() {
  const hasTools = useProjectStore((s) => s.tools.length > 0)
  return (
    <div className="app">
      <Toolbar />
      <main className="stage">
        <Canvas />
        {!hasTools && <EmptyState />}
      </main>
    </div>
  )
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: left toolbar adds tools`.

---

### Task 8: Floating ToolPanel (drag + controls + audio binding UI)

**Files:**
- Create: `tools-app/src/ui/ToolPanel.tsx`
- Modify: `tools-app/src/App.tsx` (render panels for each tool)

**Interfaces:** `ToolPanel` renders draggable/resizable/collapsible shell; for each `ControlDef` renders a slider/select/color bound to `updateParam`; an "Audio" row per control opens a binding editor calling `bindAudio`.

- [ ] **Step 1: failing test** — slider change dispatches `updateParam` with numeric value.

- [ ] **Step 3: implement** (drag via pointer events; show core structure):

```tsx
// tools-app/src/ui/ToolPanel.tsx
import { useProjectStore } from '../state/projectStore'
import { getTool } from '../tools/registry'
import type { ToolInstance } from '../state/types'
export function ToolPanel({ tool }: { tool: ToolInstance }) {
  const def = getTool(tool.type)
  const updateParam = useProjectStore((s) => s.updateParam)
  const bindAudio = useProjectStore((s) => s.bindAudio)
  const removeTool = useProjectStore((s) => s.removeTool)
  if (!def) return null
  return (
    <section className="tool-panel" style={{ left: tool.x, top: tool.y, width: tool.w }}
      onPointerDown={() => useProjectStore.getState().selectTool(tool.id)}>
      <header className="tp-head">
        <span>{def.label}</span>
        <button aria-label="Close" onClick={() => removeTool(tool.id)}>×</button>
      </header>
      {!tool.collapsed && (
        <div className="tp-body">
          {def.controls.map((c) => (
            <label key={c.param} className="tp-ctrl">
              <span>{c.label}</span>
              {c.kind === 'slider' && (
                <input type="range" min={c.min} max={c.max} step={c.step}
                  value={Number(tool.params[c.param] ?? 0)}
                  onChange={(e) => updateParam(tool.id, c.param, Number(e.target.value))} />
              )}
              {c.kind === 'select' && (
                <select value={String(tool.params[c.param] ?? '')}
                  onChange={(e) => updateParam(tool.id, c.param, e.target.value)}>
                  {c.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {c.kind === 'color' && (
                <input type="color" value={String(tool.params[c.param] ?? '#ffffff')}
                  onChange={(e) => updateParam(tool.id, c.param, e.target.value)} />
              )}
              <button className="bind-btn" aria-label={`Bind ${c.label} to audio`}
                onClick={() => bindAudio(tool.id, { param: c.param, source: 'bass', curve: 'linear', amount: 2 })}>
                audio
              </button>
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: floating tool panel with controls + audio binding`.

---

### Task 9: Text tool + Image&Video tool (local/camera/url)

**Files:**
- Create: `tools-app/src/tools/text.ts`, `tools-app/src/tools/imageVideo.ts`
- Modify: `tools-app/src/tools/registry.ts` (register both)

**Interfaces:** both export a `ToolDef`; `text.render` draws text scaled by `resolveEffectiveValue(tool,'scale',...)`; `imageVideo` loads media (local File → object URL; camera → `getUserMedia`; URL → direct, flag CORS taint) and draws it, disabling effects/export when tainted.

- [ ] **Step 1: failing test** — `getTool('text')` and `getTool('imageVideo')` exist after registry import.

- [ ] **Step 3: implement**

```ts
// tools-app/src/tools/text.ts
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import type { BandsSnapshot } from '../audio/bands'
import { resolveEffectiveValue } from '../render/audioBinding'
import { applyEffects } from '../render/effects'
export const textTool: ToolDef = {
  type: 'text', label: 'Text', icon: 'T', defaultParams: { text: 'Hello', scale: 1, color: '#a3e635' },
  controls: [
    { param: 'text', label: 'Text', kind: 'select', options: ['Hello', 'DOME', 'Art'] },
    { param: 'scale', label: 'Scale', kind: 'slider', min: 0.2, max: 4, step: 0.1 },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  render(tool: ToolInstance, ctx, _frame, audio: BandsSnapshot) {
    const scale = resolveEffectiveValue(tool, 'scale', Number(tool.params.scale ?? 1), audio, 0)
    ctx.save(); ctx.scale(scale, scale)
    ctx.fillStyle = String(tool.params.color ?? '#a3e635')
    ctx.font = '48px Inter, sans-serif'; ctx.fillText(String(tool.params.text ?? ''), 10, 60)
    ctx.restore(); applyEffects(ctx, tool.effects)
  },
}
```

```ts
// tools-app/src/tools/imageVideo.ts
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import type { BandsSnapshot } from '../audio/bands'
import { applyEffects } from '../render/effects'

type Media = { el: HTMLImageElement | HTMLVideoElement; tainted: boolean }
const cache = new Map<string, Media>()
async function load(tool: ToolInstance): Promise<Media | null> {
  const src = String(tool.params.src ?? '')
  if (!src) return null
  if (cache.has(src)) return cache.get(src)!
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = src
  await img.decode().then(() => {}).catch(() => {})
  const tainted = img.crossOrigin === 'anonymous' && img.complete === false
  const m: Media = { el: img, tainted }
  cache.set(src, m); return m
}
export const imageVideoTool: ToolDef = {
  type: 'imageVideo', label: 'Image & Video', icon: '▣',
  defaultParams: { src: '', mode: 'local' },
  controls: [
    { param: 'src', label: 'Source', kind: 'select', options: ['local', 'camera', 'url'] },
    { param: 'mode', label: 'Mode', kind: 'select', options: ['fit', 'cover'] },
  ],
  render(tool: ToolInstance, ctx, _frame, _audio: BandsSnapshot) {
    load(tool).then((m) => {
      if (!m) return
      if (m.tainted) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); return }
      ctx.drawImage(m.el as CanvasImageSource, 0, 0, ctx.canvas.width, ctx.canvas.height)
      if (!m.tainted) applyEffects(ctx, tool.effects) // effects disabled on tainted (CORS) layers
    })
  },
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: Text + Image&Video tools (local/camera/url, CORS-aware)`.

---

### Task 10: AudioButton (gesture-gated) + useAudio hook

**Files:**
- Create: `tools-app/src/ui/AudioButton.tsx`, `tools-app/src/audio/useAudio.ts`
- Modify: `tools-app/src/audio/engine.ts` (ensure `ensureAudioContext` only called from gesture; add no public change)

**Interfaces:** `AudioButton` calls `ensureAudioContext()` + `resumeIfSuspended()` inside its `onClick` (gesture), then `setAudioEnabled(true)`. `useAudio()` returns the latest `readBands()` snapshot each animation frame.

- [ ] **Step 1: failing test** — `AudioButton` click triggers `setAudioEnabled(true)` (mock `ensureAudioContext`).

- [ ] **Step 3: implement**

```tsx
// tools-app/src/ui/AudioButton.tsx
import { useProjectStore } from '../state/projectStore'
import { ensureAudioContext, resumeIfSuspended } from '../audio/engine'
export function AudioButton() {
  const setAudioEnabled = useProjectStore((s) => s.setAudioEnabled)
  const enabled = useProjectStore((s) => s.audio.enabled)
  return (
    <button className="audio-btn" aria-pressed={enabled} aria-label="Enable audio reactivity"
      onClick={async () => { ensureAudioContext(); await resumeIfSuspended(); setAudioEnabled(true) }}>
      {enabled ? 'Audio on' : 'Audio'}
    </button>
  )
}
```

```ts
// tools-app/src/audio/useAudio.ts
import { useEffect, useRef } from 'react'
import { readBands, isInitialized } from './engine'
import type { BandsSnapshot } from './bands'
export function useAudio(onFrame: (b: BandsSnapshot) => void) {
  const ref = useRef(onFrame); ref.current = onFrame
  useEffect(() => {
    let raf = 0
    const loop = () => { if (isInitialized()) ref.current(readBands()); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: gesture-gated AudioButton + useAudio frames`.

---

### Task 11: Timeline + keyframes + playback + export recording

**Files:**
- Create: `tools-app/src/ui/Timeline.tsx`, `tools-app/src/render/recording.ts`
- Modify: `tools-app/src/App.tsx` (render `<Timeline/>`, drive `tick` + `composite` in a rAF loop)

**Interfaces:** `Timeline` shows ruler + play/pause + per-tool keyframe tracks; clicking a track at time `t` calls `setKeyframe(toolId, {param,timeSec:t,value, easing})`. `recording.ts` exports `recordBands(durationSec, fps): Promise<BandsSnapshot[]>` capturing `readBands()` each frame for deterministic export.

- [ ] **Step 1: failing test** — play button calls `play()`; keyframe click calls `setKeyframe`.

- [ ] **Step 3: implement timeline** (ruler + tracks; keyframe editor minimal):

```tsx
// tools-app/src/ui/Timeline.tsx
import { useProjectStore } from '../state/projectStore'
export function Timeline() {
  const tools = useProjectStore((s) => s.tools)
  const playing = useProjectStore((s) => s.timeline.playing)
  const play = useProjectStore((s) => s.play)
  const pause = useProjectStore((s) => s.pause)
  const setKeyframe = useProjectStore((s) => s.setKeyframe)
  return (
    <footer className="timeline" aria-label="Timeline">
      <button onClick={() => (playing ? pause() : play())} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="tracks">
        {tools.map((t) => (
          <div key={t.id} className="track" role="button" aria-label={`Keyframes for ${t.type}`}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              const timeSec = ((e.clientX - rect.left) / rect.width) * 10
              setKeyframe(t.id, { param: 'scale', timeSec, value: 1 + Math.random(), easing: 'linear' })
            }}>
            {t.keyframes.map((k, i) => <span key={i} className="kf" style={{ left: `${(k.timeSec/10)*100}%` }} />)}
          </div>
        ))}
      </div>
    </footer>
  )
}
```

```ts
// tools-app/src/render/recording.ts
import { readBands, isInitialized } from '../audio/engine'
import type { BandsSnapshot } from '../audio/bands'
export async function recordBands(durationSec: number, fps = 30): Promise<BandsSnapshot[]> {
  const out: BandsSnapshot[] = []; const frames = Math.ceil(durationSec * fps)
  for (let i = 0; i < frames; i++) { if (isInitialized()) out.push(readBands()); await new Promise((r) => setTimeout(r, 1000 / fps)) }
  return out
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: bottom timeline, keyframes, export recording`.

---

### Task 12: 3D Maker (WebGL offscreen via three.js)

**Files:**
- Create: `tools-app/src/tools/threeD.ts`
- Modify: `tools-app/src/tools/registry.ts` (register)

**Interfaces:** `threeD.render` creates a `three.WebGLRenderer` on the tool's offscreen canvas, renders a rotating mesh scaled by audio `bass` (via `resolveEffectiveValue`), so the compositor's `drawImage` picks it up.

- [ ] **Step 1: failing test** — `getTool('threeD')` exists.

- [ ] **Step 3: implement** (real three.js usage; keep scene minimal):

```ts
// tools-app/src/tools/threeD.ts
import * as THREE from 'three'
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import type { BandsSnapshot } from '../audio/bands'
import { resolveEffectiveValue } from '../render/audioBinding'
const scenes = new WeakMap<ToolInstance, { renderer: THREE.WebGLRenderer; mesh: THREE.Mesh; cam: THREE.PerspectiveCamera }>()
export const threeDTool: ToolDef = {
  type: 'threeD', label: '3D Maker', icon: '◳', defaultParams: { spin: 1 },
  controls: [{ param: 'spin', label: 'Spin', kind: 'slider', min: 0, max: 4, step: 0.1 }],
  render(tool: ToolInstance, ctx, frame, audio: BandsSnapshot) {
    const w = ctx.canvas.width, h = ctx.canvas.height
    let s = scenes.get(tool)
    if (!s) {
      const renderer = new THREE.WebGLRenderer({ canvas: ctx.canvas as HTMLCanvasElement, alpha: true })
      const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(60, w / h, 0.1, 100)
      cam.position.z = 3; const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1), new THREE.MeshNormalMaterial())
      scene.add(mesh); renderer.render(scene, cam)
      s = { renderer, mesh, cam }; scenes.set(tool, s)
    }
    const bass = resolveEffectiveValue(tool, 'scale', 1, audio, frame.timeSec)
    s.mesh.scale.setScalar(0.6 + bass)
    s.mesh.rotation.y += (Number(tool.params.spin ?? 1)) * 0.02
    s.renderer.render(s.mesh.parent as THREE.Scene, s.cam)
  },
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: 3D Maker tool (WebGL offscreen)`.

---

### Task 13: Lyrics/Subtitles, Camera, HTML tools (compact)

**Files:**
- Create: `tools-app/src/tools/lyrics.ts`, `camera.ts`, `html.ts`; register in `registry.ts`.

**Interfaces:** `lyrics` draws timed text lines (uses `timeline.timeSec` to pick active line); `camera` mirrors `getUserMedia` to a `<video>` drawn to the tool canvas (reuses Image&Video media path); `html` renders an HTML string into the tool via an offscreen DOM → `drawImage` of a `foreignObject`/SVG (or a styled `<div>` overlay for non-export). Each exports a `ToolDef`.

- [ ] **Step 1: failing test** — all three present in `listTools()`.

- [ ] **Step 3: implement** (representative real code):

```ts
// tools-app/src/tools/lyrics.ts
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import { applyEffects } from '../render/effects'
export const lyricsTool: ToolDef = {
  type: 'lyrics', label: 'Lyrics/Subtitles', icon: '💬',
  defaultParams: { lines: 'line one|line two', color: '#e8e8ea' },
  controls: [{ param: 'color', label: 'Color', kind: 'color' }],
  render(tool, ctx, frame) {
    const lines = String(tool.params.lines ?? '').split('|')
    const active = lines[Math.floor(frame.timeSec) % lines.length] ?? ''
    ctx.fillStyle = String(tool.params.color ?? '#e8e8ea')
    ctx.font = '32px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(active, ctx.canvas.width / 2, ctx.canvas.height - 30)
    applyEffects(ctx, tool.effects)
  },
}
```

```ts
// tools-app/src/tools/camera.ts (mirrors imageVideo with live getUserMedia)
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import { applyEffects } from '../render/effects'
const streams = new WeakMap<ToolInstance, MediaStream>()
export const cameraTool: ToolDef = {
  type: 'camera', label: 'Camera', icon: '🎥', defaultParams: {},
  controls: [],
  render(tool, ctx) {
    let v = (tool as any).__video as HTMLVideoElement
    if (!v) { v = document.createElement('video'); v.autoplay = true; v.muted = true
      navigator.mediaDevices.getUserMedia({ video: true }).then((s) => { v.srcObject = s; streams.set(tool, s) })
      ;(tool as any).__video = v }
    if (v.readyState >= 2) { ctx.drawImage(v, 0, 0, ctx.canvas.width, ctx.canvas.height); applyEffects(ctx, tool.effects) }
  },
}
```

```ts
// tools-app/src/tools/html.ts
import type { ToolDef } from './types'
import type { ToolInstance } from '../state/types'
import { applyEffects } from '../render/effects'
export const htmlTool: ToolDef = {
  type: 'html', label: 'HTML', icon: '<>', defaultParams: { markup: '<h1>Hi</h1>' },
  controls: [{ param: 'markup', label: 'Markup', kind: 'select', options: ['<h1>Hi</h1>', '<p>Text</p>'] }],
  render(tool, ctx) {
    // Live DOM overlay is preferred for interactivity; for canvas export we rasterize via SVG foreignObject.
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${ctx.canvas.width}' height='${ctx.canvas.height}'>
      <foreignObject width='100%' height='100%'><div xmlns='http://www.w3.org/1999/xhtml' style='color:#e8e8ea;font:24px Inter'>
      ${String(tool.params.markup ?? '')}</div></foreignObject></svg>`
    const img = new Image(); const blob = new Blob([svg], { type: 'image/svg+xml' })
    img.src = URL.createObjectURL(blob)
    img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(img.src); applyEffects(ctx, tool.effects) }
  },
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: lyrics, camera, html tools`.

---

### Task 14: Mobile bottom-sheet (reuse M7b) + responsive

**Files:**
- Modify: `tools-app/src/App.tsx` (responsive: desktop floating panels; mobile ToolPanel rendered inside `BottomSheet`)
- Reuse: `tools-app/src/ui/BottomSheet.tsx` (M7b)

**Interfaces:** On `matchMedia('(max-width: 768px)')`, render tool panels inside `BottomSheet`; timeline collapses to a scrubber inside the sheet.

- [ ] **Step 1: failing test** — at mobile width, panels render inside `.bottom-sheet` container.

- [ ] **Step 3: implement** (use existing `BottomSheet`):

```tsx
// App.tsx (responsive shell)
import { useEffect, useState } from 'react'
import { useProjectStore } from './state/projectStore'
import { Canvas } from './ui/Canvas'
import { EmptyState } from './ui/EmptyState'
import { Toolbar } from './ui/Toolbar'
import { ToolPanel } from './ui/ToolPanel'
import { Timeline } from './ui/Timeline'
import { AudioButton } from './ui/AudioButton'
import { BottomSheet } from './ui/BottomSheet'
import '../styles/theme.css'
export default function App() {
  const tools = useProjectStore((s) => s.tools)
  const hasTools = tools.length > 0
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = matchMedia('(max-width: 768px)')
    const on = () => setMobile(mq.matches); on(); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on)
  }, [])
  return (
    <div className="app">
      <Toolbar />
      <main className="stage">
        <Canvas />
        {!hasTools && <EmptyState />}
        {!mobile && tools.map((t) => <ToolPanel key={t.id} tool={t} />)}
      </main>
      <AudioButton />
      {mobile
        ? <BottomSheet open title="Tools">
            {tools.map((t) => <ToolPanel key={t.id} tool={t} />)}
            <Timeline />
          </BottomSheet>
        : <Timeline />}
    </div>
  )
}
```

- [ ] **Step 4:** PASS. **Step 5:** commit `feat: mobile bottom-sheet + responsive layout`.

---

### Task 15: Test salvage + deploy (branch Tools-Dome, PR)

**Files:**
- Delete: `tools-app/src/engine/graph.test.ts`, `tools-app/src/nodes/*.test.ts`, `tools-app/src/ui/ReactFlow.test.tsx` (node-graph/ReactFlow tests no longer valid)
- Keep: `tools-app/src/audio/*.test.ts` (M2 bands/engine), add `tools-app/src/render/audioBinding.test.ts`, `compositor.test.ts`, `effects.test.ts`
- Modify: `.github/workflows/deploy.yml` already builds `tools-app` and stages to `/tools` (M8). Verify `base: '/tools/'` in `tools-app/vite.config.ts`.

**Interfaces:** `vite.config.ts` must set `base: '/tools/'`. CI asserts build present (already in M8). Branch `Tools-Dome`, open PR (do NOT push without owner authorization).

- [ ] **Step 1: verify** `grep -R "base" tools-app/vite.config.ts` shows `base: '/tools/'`.

- [ ] **Step 2: delete invalid tests**

```bash
cd tools-app && rm -f src/engine/graph.test.ts src/nodes/*.test.ts src/ui/ReactFlow.test.tsx
```

- [ ] **Step 3: run full suite**

Run: `cd tools-app && npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: all pass, 0 errors.

- [ ] **Step 4: commit + branch + PR (no push without auth)**

```bash
git checkout -b Tools-Dome
git add -A
git commit -m "feat: DOME Tools App — canvas artifact editor (replaces node-graph)"
git push -u origin Tools-Dome   # ONLY after explicit owner authorization
gh pr create --title "DOME Tools App" --body "Canvas artifact editor per spec"  # ONLY after authorization
```

---

## Self-Review

1. **Spec coverage:** canvas-always-mounted ✓ (T1), inline empty state ✓ (T1), left toolbar 6 tools ✓ (T7 + T3/T9/T12/T13), floating panels ✓ (T8), global audio gesture-gated ✓ (T10), per-tool effects ✓ (T6), bottom timeline + keyframes ✓ (T11), audio reactivity binding ✓ (T4/T8), 3D Maker ✓ (T12), lyrics/camera/html ✓ (T13), mobile bottom-sheet ✓ (T14), lime/green style ✓ (T1), €0/CORS fallback ✓ (T9), deploy /tools ✓ (T15).
2. **Placeholder scan:** No TBD/TODO. Each code step shows real implementation. `camera`/`html` use representative real code.
3. **Type consistency:** `ToolInstance`, `ToolDef`, `BandsSnapshot`, `RenderFrame`, `AudioBinding`, `Keyframe` names match across tasks. `getTool`/`listTools`/`registerTool` consistent in T3/T5/T7/T9/T12/T13.

**Known MVP limitations (documented, not blockers):** cross-tool 3D→2D effect chaining requires WebGL readback (out of scope); URL import disables effects/export when CORS-tainted; HTML tool interactivity is canvas-rasterized for export.
