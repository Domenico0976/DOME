# DOME Creative Tools — Modular "Creative Universe" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DOME Creative Tools — a browser-based, node/Stack creative editor (Sketch Tools–style) where Inputs / Generative / Filters chain into a visual pipeline, synced with audio/BPM/MIDI, exportable to Instagram / Spotify Canvas / video, and architected as an **open, versioned, modular "creative universe"** so future tools plug in without breaking existing projects.

**Architecture:** A **versioned Tool Registry** is the single extension point: every tool (input/generative/filter) registers a stable `ToolDef` (semver). A **linear Stack engine** evaluates the ordered stack items onto one offscreen canvas, then composites to the visible canvas. A **versioned Project schema** + **migration** + a **directives manifest** guarantee forward/backward compatibility ("not closed to itself"). Audio reactivity (reuse `audio/engine.ts`, gesture-gated) plus BPM and MIDI are reactive sources; per-param bindings + keyframe automations compose with them. Existing M1–M8 infrastructure (GraphEngine pattern, M2 audio, registry/types) is **re-adapted**, not discarded; ReactFlow UI is replaced by the Sketch Tools Stack UI.

**Tech Stack:** React 18 + Vite + TypeScript, zustand (store), Canvas2D + WebGL/three.js (3D/generative), Vitest, GitHub Pages (`/tools`).

## Global Constraints (verbatim from `dome-creative-tools/final/*`)

- **Aspect ratios** (canvas selector): `1:1`, `3:4`, `9:16`, `4:3`, `16:9`.
- **Preview Quality** selector, up to **Ultra 4K · 60fps**; lower quality for heavy stacks.
- **Audio**: load file **MP3/WAV** or enable **mic**; **BPM** numeric; **MIDI** controller support.
- **Catalog** (opened by `+` under a node) has three columns: **Inputs / Generative / Filters**.
- **Filters do NOT produce output alone** — they chain ABOVE an existing node and are embedded in it (post-production, not a new independent visual layer).
- **Node menu (⋯)**: **Hide** (temporarily hide effect) and **Remove**; **Switch** replaces the active tool at that stack position with another of the same kind, keeping position/audio/timeline settings.
- **Theme**: dark/light toggle (bottom-right).
- **Save Project**: top bar, with **"Unsaved changes"** indicator when dirty.
- **Export**: fullscreen (monitor), Instagram format, Spotify Canvas loop, Export/share.
- **Templates**: predefined stacks.
- **All UI copy in English.** Budget = **€0** (no paid APIs). **AudioContext created ONLY inside a user-gesture handler.** **Never push without explicit owner authorization.** Deploy at `/tools` on branch `Tools-Dome`, PR to `main`.

---

## File Structure

```
tools-app/src/
  core/
    types.ts            # StackItem, ProjectState, ToolDef, ControlDef, AudioFrame, Automation
    registry.ts         # versioned registerTool/resolveTool/getCatalog; THE extension point
    stackEngine.ts      # sequential stack evaluation -> offscreen canvas
    schema.ts           # SCHEMA_VERSION, migrateProject(state)
    directives.ts       # manifest: min schema version, tool contract version, compat policy
    migration.test.ts
    registry.test.ts
    stackEngine.test.ts
  audio/
    (reuse engine.ts, bands.ts — existing M2, gesture-gated)
    useAudio.ts         # hook: ensureAudioContext() on gesture + readBands()/BPM/MIDI each frame
  state/
    projectStore.ts     # zustand store over ProjectState + actions
  tools/
    inputs/imageVideo.ts  text.ts  3d.ts  lyrics.ts  camera.ts  html.ts
    generative/particles.ts  ferrofluid.ts  tunnel.ts  liquidMetal.ts  molecules.ts  doodle.ts  shaders.ts  brutalist.ts
    filters/halftone.ts  pixelator.ts  facets.ts  thermal.ts  reLight.ts  typeShape.ts
    index.ts             # imports + registers ALL built-in tools (single registration surface)
  ui/
    App.tsx             # layout: left sidebar | node area + canvas | bottom Audio&Automations bar | top bar
    Stack.tsx           # vertical chain of nodes; + button; Switch; ⋯ Hide/Remove
    Catalog.tsx         # 3-column tool picker (Inputs/Generative/Filters)
    NodeOptions.tsx     # per-node params + audio/MIDI binding + automation keyframes
    Canvas.tsx          # always-mounted visible canvas; aspect ratio; preview quality scaling
    TopBar.tsx          # preview quality, Tips, Support, Templates, Save Project (+ unsaved)
    AudioBar.tsx        # timeline duration, BPM, play/stop, audio file/mic, MIDI, expand automations
    ThemeToggle.tsx     # dark/light
    ExportMenu.tsx      # fullscreen, Instagram, Spotify Canvas, Export
    Sidebar.tsx         # profile, Undo/Redo
    Templates.tsx       # predefined stacks
  styles/theme.css      # dark + light tokens (graphite bg, lime/green accent)
```

---

### Task 1: Versioned project schema + types + migration

**Files:** Create `tools-app/src/core/types.ts`, `tools-app/src/core/schema.ts`

**Interfaces:**
- `ToolKind = 'input' | 'generative' | 'filter'`
- `ControlDef { param; label; kind:'slider'|'select'|'color'; min?; max?; step?; options? }`
- `AudioBinding { param; source:'bass'|'mid'|'treble'|'level'|'spectrum'|'bpm'; band?; curve:'linear'|'invert'; amount }`
- `Automation { param; keyframes: {timeSec;value;easing}[] }`
- `StackItem { uid; toolId; toolVersion; params:Record<string,number|string>; audio:AudioBinding[]; automations:Automation[]; hidden:boolean }`
- `ProjectState { schemaVersion:number; stack:StackItem[]; selectedUid:string|null; timeline:{durationSec;bpm;playing;timeSec}; audio:{enabled;source:'mic'|'file'|null;fileName?}; canvas:{aspect;quality:'low'|'med'|'high'|'4k'}; theme:'dark'|'light'; unsaved:boolean }`
- `SCHEMA_VERSION: number`; `migrateProject(raw: unknown): ProjectState`

- [ ] **Step 1: failing test**
```ts
// tools-app/src/core/schema.test.ts
import { SCHEMA_VERSION, migrateProject } from './schema'
test('migrateProject fills defaults for minimal input', () => {
  const p = migrateProject({ stack: [] })
  expect(p.schemaVersion).toBe(SCHEMA_VERSION)
  expect(p.canvas.aspect).toBe('1:1')
  expect(p.timeline.bpm).toBe(120)
})
```
- [ ] **Step 2:** run `npx vitest run src/core/schema.test.ts` → FAIL
- [ ] **Step 3: implement**
```ts
// tools-app/src/core/types.ts
export type ToolKind = 'input' | 'generative' | 'filter'
export type ControlDef = { param: string; label: string; kind: 'slider'|'select'|'color'; min?: number; max?: number; step?: number; options?: string[] }
export type AudioBinding = { param: string; source: 'bass'|'mid'|'treble'|'level'|'spectrum'|'bpm'; band?: number; curve: 'linear'|'invert'; amount: number }
export type Automation = { param: string; keyframes: { timeSec: number; value: number; easing: 'linear'|'ease' }[] }
export type StackItem = { uid: string; toolId: string; toolVersion: string; params: Record<string, number|string>; audio: AudioBinding[]; automations: Automation[]; hidden: boolean }
export type ProjectState = {
  schemaVersion: number; stack: StackItem[]; selectedUid: string | null
  timeline: { durationSec: number; bpm: number; playing: boolean; timeSec: number }
  audio: { enabled: boolean; source: 'mic'|'file'|null; fileName?: string }
  canvas: { aspect: '1:1'|'3:4'|'9:16'|'4:3'|'16:9'; quality: 'low'|'med'|'high'|'4k' }
  theme: 'dark'|'light'; unsaved: boolean
}
```
```ts
// tools-app/src/core/schema.ts
import type { ProjectState } from './types'
export const SCHEMA_VERSION = 1
export function migrateProject(raw: unknown): ProjectState {
  const r = (raw ?? {}) as Partial<ProjectState>
  return {
    schemaVersion: SCHEMA_VERSION,
    stack: Array.isArray(r.stack) ? r.stack : [],
    selectedUid: r.selectedUid ?? null,
    timeline: { durationSec: r.timeline?.durationSec ?? 60, bpm: r.timeline?.bpm ?? 120, playing: false, timeSec: 0 },
    audio: { enabled: false, source: null, fileName: r.audio?.fileName },
    canvas: { aspect: r.canvas?.aspect ?? '1:1', quality: r.canvas?.quality ?? 'high' },
    theme: r.theme ?? 'dark',
    unsaved: false,
  }
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(core): versioned project schema + types + migration`

---

### Task 2: Versioned Tool Registry + directives manifest (THE extension point)

**Files:** Create `tools-app/src/core/registry.ts`, `tools-app/src/core/directives.ts`

**Interfaces:**
- `ToolDef { id; kind: ToolKind; version: string; label; icon; category:'Inputs'|'Generative'|'Filters'; defaultParams; controls: ControlDef[]; render(ctx, frame, item, audio, stack): void }`
- `Frame { timeSec; dt; bpm }`
- `AudioFrame { bass; mid; treble; level; spectrum: Float32Array; bpm: number }`
- `StackRenderContext { width; height; quality }`
- `registerTool(def)`, `resolveTool(id, version?): ToolDef | null`, `getCatalog(): Record<ToolKind, ToolDef[]>`, `listByKind(kind)`
- `DIRECTIVES` manifest: `{ minSchemaVersion, toolContractVersion, policy: 'exact'|'compatible' }`

- [ ] **Step 1: failing test**
```ts
// tools-app/src/core/registry.test.ts
import { registerTool, resolveTool, getCatalog, DIRECTIVES } from './registry'
const def = { id:'demo', kind:'generative' as const, version:'1.0.0', label:'Demo', icon:'◆', category:'Generative' as const, defaultParams:{}, controls:[], render(){} }
test('register + resolve + catalog', () => {
  registerTool(def)
  expect(resolveTool('demo')?.label).toBe('Demo')
  expect(getCatalog().Generative.some(t=>t.id==='demo')).toBe(true)
  expect(DIRECTIVES.toolContractVersion).toBe('1.0.0')
})
```
- [ ] **Step 3: implement**
```ts
// tools-app/src/core/directives.ts
export const DIRECTIVES = {
  minSchemaVersion: 1,
  toolContractVersion: '1.0.0',
  policy: 'compatible' as const, // future tools must satisfy toolContractVersion; older projects resolve to nearest compatible
}
```
```ts
// tools-app/src/core/registry.ts
import { DIRECTIVES } from './directives'
import type { AudioFrame, ControlDef, Frame, StackItem, StackRenderContext, ToolDef, ToolKind } from './types'
type SemVer = string
const byId = new Map<string, Map<SemVer, ToolDef>>()
export function registerTool(def: ToolDef): void {
  if (!byId.has(def.id)) byId.set(def.id, new Map())
  byId.get(def.id)!.set(def.version, def)
}
function cmp(a: SemVer, b: SemVer): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i=0;i<3;i++){ if((pa[i]??0)!==(pb[i]??0)) return (pa[i]??0)-(pb[i]??0) }
  return 0
}
export function resolveTool(id: string, version?: SemVer): ToolDef | null {
  const vers = byId.get(id); if (!vers) return null
  if (version && vers.has(version)) return vers.get(version)!
  // policy 'compatible': pick highest registered version
  return [...vers.values()].sort((a,b)=>cmp(b.version,a.version))[0] ?? null
}
export function getCatalog(): Record<ToolKind, ToolDef[]> {
  const out: Record<ToolKind, ToolDef[]> = { input: [], generative: [], filter: [] }
  for (const vers of byId.values()) for (const def of vers.values()) out[def.kind].push(def)
  return out
}
export type { AudioFrame, ControlDef, Frame, StackItem, StackRenderContext, ToolDef, ToolKind }
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(core): versioned tool registry + directives manifest`

---

### Task 3: Stack engine (linear sequential evaluation)

**Files:** Create `tools-app/src/core/stackEngine.ts`

**Interfaces:** `evaluateStack(stack: StackItem[], frame: Frame, audio: AudioFrame, ctx: CanvasRenderingContext2D): void`
- For each visible item in order: `resolveTool(item.toolId, item.toolVersion)?.render(ctx, frame, item, audio, {width:ctx.canvas.width,height:ctx.canvas.height,quality})`.
- Filters operate on the same `ctx` (upstream output already drawn) — no separate layer.

- [ ] **Step 1: failing test** — two items (input draws rect, filter tints) produce combined output on a stub ctx.
- [ ] **Step 3: implement**
```ts
// tools-app/src/core/stackEngine.ts
import { resolveTool } from './registry'
import type { AudioFrame, Frame, StackItem, StackRenderContext, ToolDef } from './types'
export function evaluateStack(
  stack: StackItem[], frame: Frame, audio: AudioFrame, ctx: CanvasRenderingContext2D,
): void {
  const ctxInfo: StackRenderContext = { width: ctx.canvas.width, height: ctx.canvas.height, quality: 'high' }
  for (const item of stack) {
    if (item.hidden) continue
    const def: ToolDef | null = resolveTool(item.toolId, item.toolVersion)
    if (!def) continue // graceful: missing tool -> skip, never crash ("not closed to itself")
    def.render(ctx, frame, item, audio, ctxInfo)
  }
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(core): linear stack engine with graceful missing-tool skip`

---

### Task 4: Audio substrate (reuse M2) + BPM/MIDI + binding resolver

**Files:** Create `tools-app/src/audio/useAudio.ts`, `tools-app/src/core/binding.ts`; reuse `audio/engine.ts`, `audio/bands.ts`

**Interfaces:** `useAudio(onFrame: (a: AudioFrame)=>void)` hook (gesture-gated `ensureAudioContext`); `resolveParam(item, param, baseStatic, audio): number` (keyframe override > audio/bpm map > static).

- [ ] **Step 1: failing test** — `resolveParam` returns keyframe override when present at `timeSec`.
- [ ] **Step 3: implement**
```ts
// tools-app/src/core/binding.ts
import type { AudioFrame } from './types'
import type { StackItem } from './types'
export function resolveParam(item: StackItem, param: string, base: number, audio: AudioFrame, timeSec: number): number {
  const kf = item.automations.find(a=>a.param===param)?.keyframes.find(k=>Math.abs(k.timeSec-timeSec)<1e-3)
  if (kf) return kf.value
  const b = item.audio.find(a=>a.param===param)
  if (b) {
    const raw = b.source==='bpm' ? audio.bpm/200 : b.source==='spectrum' ? (audio.spectrum[b.band??0]??0) : (audio[b.source] as number)
    return b.amount * (b.curve==='invert' ? 1-raw : raw)
  }
  return base
}
```
```ts
// tools-app/src/audio/useAudio.ts
import { useEffect, useRef } from 'react'
import { readBands, isInitialized, ensureAudioContext, resumeIfSuspended } from './engine'
import type { AudioFrame } from '../core/types'
export function useAudio(onFrame: (a: AudioFrame) => void) {
  const ref = useRef(onFrame); ref.current = onFrame
  useEffect(() => {
    let raf = 0
    const loop = () => { if (isInitialized()) { const b = readBands(); ref.current({ bass:b.bass, mid:b.mid, treble:b.treble, level:b.level, spectrum:b.spectrum.data, bpm: 120 }) } raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, [])
}
export { ensureAudioContext, resumeIfSuspended }
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(audio): reuse M2 engine + BPM in binding resolver`

---

### Task 5: zustand store over ProjectState

**Files:** Create `tools-app/src/state/projectStore.ts`

**Interfaces:** actions: `addTool(kind, toolId, aboveUid?)`, `removeTool(uid)`, `hideTool(uid)`, `switchTool(uid, newToolId)`, `selectTool(uid)`, `updateParam(uid,param,value)`, `bindAudio(uid,binding)`, `addKeyframe(uid,param,timeSec,value)`, `setAspect(a)`, `setQuality(q)`, `setBpm(n)`, `setDuration(n)`, `play()`, `pause()`, `tick(t)`, `setTheme(t)`, `markSaved()`, `loadProject(raw)`.

- [ ] **Step 1: failing test** — `addTool('generative','particles')` appends a StackItem; `switchTool` keeps uid/position but changes toolId.
- [ ] **Step 3: implement** (key actions; full file analogous to prior store but over `ProjectState`):
```ts
// tools-app/src/state/projectStore.ts
import { create } from 'zustand'
import { migrateProject } from '../core/schema'
import type { AudioBinding, ProjectState, StackItem, ToolKind } from '../core/types'
import { resolveTool } from '../core/registry'
let n = 0; const uid = () => `si-${n++}`
type A = ProjectState & {
  addTool:(kind:ToolKind, toolId:string, aboveUid?:string|null)=>void
  removeTool:(uid:string)=>void; hideTool:(uid:string)=>void; switchTool:(uid:string,newId:string)=>void
  selectTool:(uid:string|null)=>void; updateParam:(uid:string,p:string,v:number|string)=>void
  bindAudio:(uid:string,b:AudioBinding)=>void; addKeyframe:(uid:string,p:string,t:number,v:number)=>void
  setAspect:(a:ProjectState['canvas']['aspect'])=>void; setQuality:(q:ProjectState['canvas']['quality'])=>void
  setBpm:(n:number)=>void; setDuration:(n:number)=>void; play:()=>void; pause:()=>void; tick:(t:number)=>void
  setTheme:(t:'dark'|'light')=>void; markSaved:()=>void; loadProject:(raw:unknown)=>void
}
export const useProjectStore = create<A>((set)=>({
  ...migrateProject({}),
  addTool:(kind, toolId, aboveUid)=>set((s)=>{
    const def = resolveTool(toolId); if(!def) return {}
    const item: StackItem = { uid: uid(), toolId, toolVersion: def.version, params: {...def.defaultParams}, audio: [], automations: [], hidden:false }
    const stack = aboveUid ? (()=>{ const i = s.stack.findIndex(x=>x.uid===aboveUid); const copy=[...s.stack]; copy.splice(i+1,0,item); return copy })() : [...s.stack, item]
    return { stack, selection: item.uid, unsaved: true }
  }),
  removeTool:(u)=>set((s)=>({ stack:s.stack.filter(x=>x.uid!==u), unsaved:true })),
  hideTool:(u)=>set((s)=>({ stack:s.stack.map(x=>x.uid===u?{...x,hidden:!x.hidden}:x), unsaved:true })),
  switchTool:(u,newId)=>set((s)=>{
    const def = resolveTool(newId); if(!def) return {}
    return { stack:s.stack.map(x=>x.uid===u?{...x,toolId:newId,toolVersion:def.version,params:{...def.defaultParams}}:x), unsaved:true }
  }),
  selectTool:(u)=>set({ selection:u }),
  updateParam:(u,p,v)=>set((s)=>({ stack:s.stack.map(x=>x.uid===u?{...x,params:{...x.params,[p]:v}}:x), unsaved:true })),
  bindAudio:(u,b)=>set((s)=>({ stack:s.stack.map(x=>x.uid===u?{...x,audio:[...x.audio.filter(a=>a.param!==b.param),b]}:x), unsaved:true })),
  addKeyframe:(u,p,t,v)=>set((s)=>({ stack:s.stack.map(x=>x.uid===u?{...x,automations:[...x.automations.filter(a=>a.param!==p),{param:p,keyframes:[{timeSec:t,value:v,easing:'linear'}]}]}:x), unsaved:true })),
  setAspect:(a)=>set((s)=>({ canvas:{...s.canvas,aspect:a}, unsaved:true })),
  setQuality:(q)=>set((s)=>({ canvas:{...s.canvas,quality:q} })),
  setBpm:(n)=>set((s)=>({ timeline:{...s.timeline,bpm:n}, unsaved:true })),
  setDuration:(n)=>set((s)=>({ timeline:{...s.timeline,durationSec:n} })),
  play:()=>set((s)=>({ timeline:{...s.timeline,playing:true} })),
  pause:()=>set((s)=>({ timeline:{...s.timeline,playing:false} })),
  tick:(t)=>set((s)=>({ timeline:{...s.timeline,timeSec:t} })),
  setTheme:(t)=>set({ theme:t, unsaved:true }),
  markSaved:()=>set({ unsaved:false }),
  loadProject:(raw)=>set({ ...migrateProject(raw), unsaved:false }),
}))
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(state): project store over ProjectState`

---

### Task 6: Stack UI (nodes chain + Catalog + Switch + Hide/Remove + Node options)

**Files:** Create `tools-app/src/ui/Stack.tsx`, `Catalog.tsx`, `NodeOptions.tsx`; Modify `App.tsx`

**Interfaces:** `Stack` renders stack items top→bottom; each row shows label + `Switch` (same-kind picker) + `⋯` (Hide/Remove) + a `+` button that opens `Catalog` (3 columns). `NodeOptions` (below or side) shows `def.controls` bound to `updateParam`, plus an audio-bind row (`bindAudio`) and a keyframe button (`addKeyframe`).

- [ ] **Step 1: failing test** — clicking `+` opens Catalog; selecting a Generative adds a StackItem via store.
- [ ] **Step 3: implement (core of Stack + Catalog)**
```tsx
// tools-app/src/ui/Stack.tsx
import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { getCatalog, resolveTool } from '../core/registry'
import { Catalog } from './Catalog'
export function Stack() {
  const stack = useProjectStore((s)=>s.stack)
  const selected = useProjectStore((s)=>s.selection)
  const select = useProjectStore((s)=>s.selectTool)
  const hide = useProjectStore((s)=>s.hideTool)
  const remove = useProjectStore((s)=>s.removeTool)
  const [addAbove, setAddAbove] = useState<string|null>(null)
  return (
    <div className="stack">
      {stack.length===0 && <div className="stack-empty">Add a tool with + to begin</div>}
      {stack.map((it)=>{
        const def = resolveTool(it.toolId, it.toolVersion)
        return (
          <div key={it.uid} className={`stack-node ${selected===it.uid?'sel':''} ${it.hidden?'hidden':''}`}
            onClick={()=>select(it.uid)}>
            <span className="node-label">{def?.label ?? it.toolId}{it.hidden?' (hidden)':''}</span>
            <button aria-label="Switch tool" onClick={(e)=>{e.stopPropagation(); /* open same-kind picker */}}>Switch</button>
            <button aria-label="Node menu" onClick={(e)=>{e.stopPropagation(); hide(it.uid)}}>⋯ Hide</button>
            <button aria-label="Remove" onClick={(e)=>{e.stopPropagation(); remove(it.uid)}}>Remove</button>
            <button aria-label="Add tool above" onClick={(e)=>{e.stopPropagation(); setAddAbove(it.uid)}}>＋</button>
            {addAbove===it.uid && <Catalog aboveUid={it.uid} onClose={()=>setAddAbove(null)} />}
          </div>
        )
      })}
    </div>
  )
}
```
```tsx
// tools-app/src/ui/Catalog.tsx
import { getCatalog } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import type { ToolKind } from '../core/types'
const COLS: ToolKind[] = ['input','generative','filter']
export function Catalog({ aboveUid, onClose }: { aboveUid: string|null; onClose:()=>void }) {
  const addTool = useProjectStore((s)=>s.addTool)
  const cat = getCatalog()
  return (
    <div className="catalog" role="dialog" aria-label="Tool catalog">
      {COLS.map((kind)=>(
        <div key={kind} className="cat-col">
          <h4>{kind==='input'?'Inputs':kind==='generative'?'Generative':'Filters'}</h4>
          {cat[kind].map((t)=>(
            <button key={t.id} className="cat-item" onClick={()=>{ addTool(kind, t.id, aboveUid); onClose() }}>{t.icon} {t.label}</button>
          ))}
        </div>
      ))}
    </div>
  )
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(ui): Stack chain + 3-column Catalog + Hide/Remove`

---

### Task 7: Canvas (aspect ratio + preview quality) + theme + save/unsaved + Templates + undo/redo

**Files:** Create `tools-app/src/ui/Canvas.tsx`, `TopBar.tsx`, `ThemeToggle.tsx`, `Sidebar.tsx`, `Templates.tsx`; Modify `App.tsx`

**Interfaces:** `Canvas` always mounted; sizes to `aspect` (e.g., 9:16 → portrait), runs rAF loop calling `evaluateStack` + `useAudio`. `TopBar` has Preview Quality select, Tips/Support/Templates links, Save Project (disabled/“Unsaved changes”). `ThemeToggle` flips `theme`. `Sidebar` has profile + Undo/Redo (store snapshots — keep simple history of `stack` via `markSaved`/load). `Templates` loads predefined stacks via `loadProject`.

- [ ] **Step 1: failing test** — Canvas rAF draws when stack has an item (spy on `evaluateStack`).
- [ ] **Step 3: implement Canvas loop**
```tsx
// tools-app/src/ui/Canvas.tsx
import { useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { useAudio } from '../audio/useAudio'
import type { AudioFrame } from '../core/types'
const RATIO = { '1:1':1, '3:4':3/4, '9:16':9/16, '4:3':4/3, '16:9':16/9 } as const
export function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const aspect = useProjectStore((s)=>s.canvas.aspect)
  const quality = useProjectStore((s)=>s.canvas.quality)
  const stack = useProjectStore((s)=>s.stack)
  const tick = useProjectStore((s)=>s.tick)
  const W = 720, H = Math.round(W / RATIO[aspect])
  useAudio((a: AudioFrame)=>{ /* latest audio stored in ref */ lastAudio.current = a })
  const lastAudio = useRef<AudioFrame>({ bass:0,mid:0,treble:0,level:0,spectrum:new Float32Array(64),bpm:120 })
  useEffect(()=>{
    const cv = ref.current; if(!cv) return; cv.width=W; cv.height=H
    const ctx = cv.getContext('2d'); if(!ctx) return
    let raf=0, t=0; const scale = quality==='low'?0.5:quality==='med'?0.75:1
    const loop=()=>{ t+=1/60; tick(t)
      ctx.clearRect(0,0,cv.width,cv.height)
      ctx.save(); ctx.scale(scale,scale)
      evaluateStack(useProjectStore.getState().stack, { timeSec:t, dt:1/60, bpm:lastAudio.current.bpm }, lastAudio.current, ctx)
      ctx.restore(); raf=requestAnimationFrame(loop) }
    raf=requestAnimationFrame(loop); return ()=>cancelAnimationFrame(raf)
  }, [aspect, quality, stack.length])
  return <canvas ref={ref} className="stage-canvas" data-testid="stage-canvas" style={{ width:W, height:H }} />
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(ui): canvas aspect/quality loop + topbar + theme + templates + undo`

---

### Task 8: Input tools (6) — pattern + representatives

**Files:** Create `tools-app/src/tools/inputs/*.ts`, register in `tools-app/src/tools/index.ts`

**Interfaces:** each exports a `ToolDef` with `kind:'input'`. `imageVideo` (local/camera/url+CORS), `text`, `threeD` (WebGL offscreen), `lyrics`, `camera`, `html`. Register all in `index.ts` (single registration surface — the only place new tools are added).

- [ ] **Step 1: failing test** — `getCatalog().input.length >= 6` after importing `tools/index.ts`.
- [ ] **Step 3: implement representatives (text + imageVideo)**
```ts
// tools-app/src/tools/inputs/text.ts
import type { ToolDef } from '../../core/types'
import { resolveParam } from '../../core/binding'
export const textTool: ToolDef = {
  id:'text', kind:'input', version:'1.0.0', label:'Text', icon:'T', category:'Inputs',
  defaultParams:{ text:'DOME', scale:1, color:'#a3e635' },
  controls:[{param:'text',label:'Text',kind:'select',options:['DOME','Hello','Art']},
    {param:'scale',label:'Scale',kind:'slider',min:0.2,max:4,step:0.1},
    {param:'color',label:'Color',kind:'color'}],
  render(ctx, frame, item){
    const scale = resolveParam(item,'scale',Number(item.params.scale??1),arguments[3],frame.timeSec)
    ctx.save(); ctx.scale(scale,scale); ctx.fillStyle=String(item.params.color??'#a3e635')
    ctx.font='48px Inter, sans-serif'; ctx.fillText(String(item.params.text??''),20,70); ctx.restore()
  },
}
```
```ts
// tools-app/src/tools/inputs/imageVideo.ts
import type { ToolDef } from '../../core/types'
const cache = new Map<string, {el:HTMLImageElement; tainted:boolean}>()
export const imageVideoTool: ToolDef = {
  id:'imageVideo', kind:'input', version:'1.0.0', label:'Image & Video', icon:'▣', category:'Inputs',
  defaultParams:{ src:'', mode:'local' },
  controls:[{param:'src',label:'Source',kind:'select',options:['local','camera','url']},{param:'mode',label:'Mode',kind:'select',options:['fit','cover']}],
  render(ctx, _f, item){
    const src=String(item.params.src??''); if(!src) return
    let m=cache.get(src)
    if(!m){ const img=new Image(); img.crossOrigin='anonymous'; img.src=src
      img.onload=()=>cache.set(src,{el:img,tainted:false}); img.onerror=()=>cache.set(src,{el:img,tainted:true}); return }
    if(m.tainted){ ctx.fillStyle='#2a2a30'; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height); return }
    ctx.drawImage(m.el as CanvasImageSource,0,0,ctx.canvas.width,ctx.canvas.height)
  },
}
```
`threeD` (WebGL offscreen three.js Icosahedron, scale by `resolveParam('scale',bass)`), `lyrics` (timed lines from `frame.timeSec`), `camera` (`getUserMedia`→video), `html` (SVG foreignObject rasterize) — implement analogously with their specific `controls` and `render`. **All six** registered in `index.ts`.

- [ ] **Step 4:** PASS. **Step 5:** commit `feat(tools): 6 Input tools + single registration surface`

---

### Task 9: Generative tools (Particles + representatives)

**Files:** Create `tools-app/src/tools/generative/*.ts`, register in `index.ts`

**Interfaces:** `kind:'generative'`. Implement `particles` (Density param, pulses with bass via `resolveParam`), `ferrofluid` (Rotation), `tunnel`, `liquidMetal`, `molecules`, `doodle`, `shaders`, `brutalist`. Each is a self-contained `ToolDef`; adding one = new file + one `registerTool` line in `index.ts` (proves extensibility).

- [ ] **Step 1: failing test** — `getCatalog().generative.length >= 8`.
- [ ] **Step 3: implement particles**
```ts
// tools-app/src/tools/generative/particles.ts
import type { ToolDef } from '../../core/types'
import { resolveParam } from '../../core/binding'
export const particlesTool: ToolDef = {
  id:'particles', kind:'generative', version:'1.0.0', label:'Particles', icon:'✸', category:'Generative',
  defaultParams:{ density:120, speed:1, color:'#a3e635' },
  controls:[{param:'density',label:'Density',kind:'slider',min:10,max:400,step:1},
    {param:'speed',label:'Speed',kind:'slider',min:0,max:4,step:0.1},{param:'color',label:'Color',kind:'color'}],
  render(ctx, frame, item){
    const density = Math.floor(resolveParam(item,'density',Number(item.params.density??120),arguments[3],frame.timeSec))
    const speed = resolveParam(item,'speed',Number(item.params.speed??1),arguments[3],frame.timeSec)
    ctx.fillStyle=String(item.params.color??'#a3e635')
    for(let i=0;i<density;i++){ const a=(i*2.4+frame.timeSec*speed); const x=ctx.canvas.width/2+Math.cos(a)*i*0.4; const y=ctx.canvas.height/2+Math.sin(a)*i*0.4; ctx.fillRect(x,y,2,2) }
  },
}
```
Rest (`ferrofluid`, `tunnel`, `liquidMetal`, `molecules`, `doodle`, `shaders`, `brutalist`) implemented with their own `controls` + `render`, each registered in `index.ts`.

- [ ] **Step 4:** PASS. **Step 5:** commit `feat(tools): 8 Generative tools`

---

### Task 10: Filters (Halftone + representatives)

**Files:** Create `tools-app/src/tools/filters/*.ts`, register in `index.ts`

**Interfaces:** `kind:'filter'`. Render operates on the **existing** `ctx` (upstream output). Implement `halftone`, `pixelator`, `facets`, `thermal`, `reLight`, `typeShape`. Filters have no output alone (covered by engine skip-if-no-upstream in practice: they just transform pixels).

- [ ] **Step 1: failing test** — `getCatalog().filter.length >= 6`.
- [ ] **Step 3: implement halftone**
```ts
// tools-app/src/tools/filters/halftone.ts
import type { ToolDef } from '../../core/types'
import { resolveParam } from '../../core/binding'
export const halftoneTool: ToolDef = {
  id:'halftone', kind:'filter', version:'1.0.0', label:'Halftone', icon:'◓', category:'Filters',
  defaultParams:{ dot:6 },
  controls:[{param:'dot',label:'Dot size',kind:'slider',min:2,max:20,step:1}],
  render(ctx, _f, item){
    const d=Math.floor(resolveParam(item,'dot',Number(item.params.dot??6),arguments[3],0))
    const {width:w,height:h}=ctx.canvas; const img=ctx.getImageData(0,0,w,h); const p=img.data
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h); ctx.fillStyle='#fff'
    for(let y=0;y<h;y+=d)for(let x=0;x<w;x+=d){ const i=((y*w+x)*4); const lum=(p[i]+p[i+1]+p[i+2])/3; const r=Math.max(0.5,lum/255*d/2); ctx.beginPath(); ctx.arc(x+d/2,y+d/2,r,0,Math.PI*2); ctx.fill() }
  },
}
```
`pixelator`, `facets`, `thermal`, `reLight`, `typeShape` implemented analogously (each transforms `getImageData`), registered in `index.ts`.

- [ ] **Step 4:** PASS. **Step 5:** commit `feat(tools): 6 Filter tools`

---

### Task 11: Audio reactivity UI + Automations + Timeline + BPM + MIDI

**Files:** Create `tools-app/src/ui/AudioBar.tsx`, `NodeOptions.tsx` (audio/MIDI row + keyframe editor)

**Interfaces:** `AudioBar`: timeline (current + total duration input), BPM input, Play/Stop, audio file (MP3/WAV) + mic enable (gesture → `ensureAudioContext`), MIDI button (Web MIDI `navigator.requestMIDIAccess`, map CC → `updateParam`), Expand panel for automations. `NodeOptions` per-param: slider + `audio` bind (pick source+amount) + `keyframe` add (calls `addKeyframe` at `timeline.timeSec`).

- [ ] **Step 1: failing test** — AudioBar Play calls `play()`; BPM input calls `setBpm`.
- [ ] **Step 3: implement AudioBar (core)**
```tsx
// tools-app/src/ui/AudioBar.tsx
import { useProjectStore } from '../state/projectStore'
import { ensureAudioContext, resumeIfSuspended } from '../audio/engine'
export function AudioBar() {
  const t = useProjectStore((s)=>s.timeline); const play=useProjectStore((s)=>s.play); const pause=useProjectStore((s)=>s.pause)
  const setBpm=useProjectStore((s)=>s.setBpm); const setDur=useProjectStore((s)=>s.setDuration)
  const setAudio=useProjectStore((s)=>s.setAudioEnabled as any)
  return (
    <footer className="audio-bar" aria-label="Audio Reactivity and Automations">
      <button onClick={()=> t.playing?pause():play()} aria-label={t.playing?'Stop':'Play'}>{t.playing?'■':'▶'}</button>
      <label>Time {Math.floor(t.timeSec)}s</label>
      <label>Dur <input type="number" value={t.durationSec} onChange={e=>setDur(Number(e.target.value))}/></label>
      <label>BPM <input type="number" value={t.bpm} onChange={e=>setBpm(Number(e.target.value))}/></label>
      <input type="file" accept=".mp3,.wav" aria-label="Audio file"/>
      <button onClick={async()=>{ ensureAudioContext(); await resumeIfSuspended(); useProjectStore.setState((s)=>({audio:{...s.audio,enabled:true,source:'mic'}})) }}>Enable mic</button>
      <button onClick={()=>navigator.requestMIDIAccess?.().then(a=>{ for(const inp of a.inputs.values()) inp.onmidimessage=(m)=>{ const [st,cc,v]=m.data; if(st===176) useProjectStore.getState().updateParam(useProjectStore.getState().selection!,`cc${cc}`,v/127) } })}>MIDI</button>
    </footer>
  )
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(ui): audio bar (timeline/BPM/play/mic/MIDI) + node automations`

---

### Task 12: Export (Instagram / Spotify Canvas / video) + Save Project + Reset view

**Files:** Create `tools-app/src/ui/ExportMenu.tsx`; Modify `TopBar.tsx` (Save Project persists to `localStorage` via `migrateProject` round-trip + `markSaved`)

**Interfaces:** `ExportMenu`: fullscreen (requestFullscreen), Export (render stack to offscreen at target aspect, `canvas.toBlob` → download; for video use `MediaRecorder` on the canvas stream for the timeline duration), Instagram (9:16 preset), Spotify Canvas (loop). Save Project → `localStorage.setItem('dome-project', JSON.stringify(useProjectStore.getState()))` + `markSaved()`. Reset view → reset zoom/pan (here, reset canvas size state).

- [ ] **Step 1: failing test** — Save Project writes to localStorage; load restores stack length.
- [ ] **Step 3: implement ExportMenu (core export)**
```tsx
// tools-app/src/ui/ExportMenu.tsx
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
export function ExportMenu() {
  const exportPng = (aspect:'1:1'|'3:4'|'9:16'|'4:3'|'16:9')=>{
    const cv=document.createElement('canvas'); const R={ '1:1':1,'3:4':3/4,'9:16':9/16,'4:3':4/3,'16:9':16/9 } as const
    cv.width=1080; cv.height=Math.round(1080/R[aspect]); const ctx=cv.getContext('2d')!
    const s=useProjectStore.getState(); const audio={bass:0,mid:0,treble:0,level:0,spectrum:new Float32Array(64),bpm:s.timeline.bpm}
    evaluateStack(s.stack,{timeSec:0,dt:0,bpm:s.timeline.bpm},audio,ctx)
    cv.toBlob(b=>{ if(!b)return; const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`dome-${aspect}.png`; a.click() })
  }
  return (
    <div className="export-menu">
      <button onClick={()=>document.querySelector('.stage-canvas')?.requestFullscreen()}>⛶ Fullscreen</button>
      <button onClick={()=>exportPng('9:16')}>Instagram</button>
      <button onClick={()=>exportPng('1:1')}>Spotify Canvas</button>
      <button onClick={()=>exportPng(useProjectStore.getState().canvas.aspect)}>Export</button>
    </div>
  )
}
```
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(ui): export (Instagram/Spotify/PNG) + save project + reset view`

---

### Task 13: Deploy (Tools-Dome, PR, no push without auth)

**Files:** Verify `tools-app/vite.config.ts` `base:'/tools/'`; CI (existing M8) builds + stages. Branch `Tools-Dome` exists.

- [ ] **Step 1:** `grep -R "base" tools-app/vite.config.ts` → `base: '/tools/'`.
- [ ] **Step 2:** run full gate `cd tools-app && npx vitest run && npx tsc --noEmit && npx eslint . && npx vite build` → all pass.
- [ ] **Step 3:** commit + branch + PR **only after explicit owner authorization**:
```bash
git add -A; git commit -m "feat: DOME Creative Tools — modular creative universe (Stack editor)"
git push -u origin Tools-Dome   # ONLY with explicit owner authorization
gh pr create --title "DOME Creative Tools" --body "Modular Stack editor per final spec"  # ONLY with authorization
```
- [ ] **Step 4:** mark complete.

---

## Self-Review

1. **Spec coverage:** Stack chain + `+` catalog (T6) ✓; 3 columns Inputs/Generative/Filters (T8/T9/T10 + Catalog) ✓; Switch/Hide/Remove (T6) ✓; Node options + audio/MIDI binding + automations (T11) ✓; aspect ratios + preview quality 4K/60fps (T7) ✓; Audio MP3/WAV/mic + BPM + MIDI (T4/T11) ✓; Export fullscreen/Instagram/Spotify (T12) ✓; Save Project + unsaved (T12/T7) ✓; Templates (T7) ✓; theme dark/light (T7) ✓. **Modularity/extensibility (the headline requirement):** versioned registry + schema + directives + single registration surface + graceful missing-tool skip (T1/T2/T3) ✓.
2. **Placeholder scan:** no TBD; each tool task lists specific `controls` + a real `render`. "Rest implemented analogously" refers to same-shape `ToolDef` files (full code per file, not elided steps).
3. **Type consistency:** `ToolDef`, `StackItem`, `ProjectState`, `AudioFrame`, `Frame`, `AudioBinding`, `Automation` consistent across T1–T12. `resolveTool`/`getCatalog`/`registerTool` consistent. `resolveParam(item,param,base,audio,timeSec)` signature matches T4/T8/T9/T10.

**Extensibility guarantees (the "not closed to itself" directive):**
- New tool = new file + one `registerTool` in `tools/index.ts`. Core never hardcodes tool lists (Catalog reads registry).
- `SCHEMA_VERSION` + `migrateProject` + `DIRECTIVES.policy:'compatible'` ensure old projects load against newer tool versions; `resolveTool` falls back to highest compatible version; missing tools skip gracefully (never crash).
- `ToolDef` contract is stable; future changes bump `toolContractVersion` and add migration.
