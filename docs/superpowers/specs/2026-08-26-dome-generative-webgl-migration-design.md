# DOME Generative Tools — WebGL Migration Design Spec

**Date:** 2026-08-26  
**Status:** APPROVED  
**Scope:** Migrazione completa dei 14 tool generativi da Canvas2D a WebGL2 + bug fixes

---

## 1. Architecture Overview

### Objective
Creare un sistema di rendering WebGL2 per i tool generativi che eguagli la qualità di sketchtools, mantenendo la compatibilità con l'architettura esistente.

### Components

#### 1.1 ToolRenderer (nuovo)
- Classe che gestisce il contesto WebGL2 per i tool
- Gestione FBO ping-pong (6+ paia per tool complessi)
- Supporto texture float (RGBA32F) per simulazioni a precisione elevata
- Compile shader con error reporting

#### 1.2 Noise Library (nuovo)
- FBM (Fractal Brownian Motion) — per nebula, terreno
- Simplex Noise — per fluidi, particelle
- Curl Noise — per campi vettoriali
- Domain Warping — per distorsioni organiche
- Chladni Figures — per pattern di vibrazione

#### 1.3 Shader Template System (nuovo)
- Fragment shader condiviso con:
  - `u_time` (uniform float)
  - `u_resolution` (uniform vec2)
  - `u_mouse` (uniform vec2)
  - `u_audio` (uniform vec4: bass, mid, treble, level)
  - Parametri specifici del tool
- Vertex shader standard (full-screen quad)

#### 1.4 ToolDef.render() — Signature Update
```typescript
// PRIMA:
render(ctx: CanvasRenderingContext2D, frame: Frame, item: StackItem, audio: AudioFrame, stack: StackRenderContext): void

// DOPO:
render(ctx: CanvasRenderingContext2D, frame: Frame, item: StackItem, audio: AudioFrame, stack: StackRenderContext, gl?: WebGL2RenderingContext): void
```

### Rendering Flow
```
Tool Renderer (WebGL2)
  │
  ├─► Shader compilation + caching
  ├─► FBO allocation (ping-pong)
  ├─► Texture upload (input source)
  ├─► Render pass 1 (es: flow advection)
  ├─► Render pass 2 (es: thickness)
  ├─► Render pass 3 (es: RD step)
  ├─► Render pass 4 (es: color mapping)
  └─► Output texture → Compositor
```

---

## 2. Bug Fixes (in parallelo con agente dedicato)

### 2.1 Audio Bugs

#### Bug A1: `preventDefault` in passive listener
**File:** `useCanvasPanZoom.ts:56-57`  
**Fix:** Rimuovere `e.preventDefault()` — non necessario su container `overflow-hidden`
```typescript
// PRIMA:
const onWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault()  // ← WARNING
  // ...
}, [])

// DOPO:
const onWheel = useCallback((e: React.WheelEvent) => {
  const delta = e.deltaY > 0 ? -1 : 1
  // ...
}, [])
```

#### Bug A2: `NotAllowedError` AudioContext
**File:** `engine.ts:32` + `useAudio.ts:29-41`  
**Fix 3 parti:**
1. Rimuovere `analyser.connect(context.destination)` — audio silenzioso viola autoplay
2. Aggiungere try/catch su `el.play()` con errore chiaro
3. Assicurare che `context.state === 'running'` prima di `el.play()`

### 2.2 UI/UX Bugs

#### Bug U1: Panel non riappare dopo chiusura
**File:** `App.tsx:13,50-52`  
**Fix:** Reset `panelOpen` quando cambia `selectedUid`
```tsx
useEffect(() => {
  setPanelOpen(true)
}, [selectedUid])
```

#### Bug U2: Stack mostra hidden settings
**File:** `FloatingStack.tsx:132`  
**Fix:** Opacità ridotta + disabilitazione bottoni azione per nodi hidden
```tsx
it.hidden && 'opacity-40 pointer-events-none'
```

#### Bug U3: Drag & drop posizione errata (race condition)
**File:** `FloatingStack.tsx:58-101`  
**Fix:** Aggiornare ref sincrono dentro `onDrag`, leggere da lì in `onDragEnd`
```tsx
const dropIndexSyncRef = useRef<number | null>(null)

onDrag: () => {
  // ... calcola newIndex ...
  dropIndexSyncRef.current = newIndex  // ← sync update
  setDropIndex(newIndex)
}

onDragEnd: () => {
  const currentDropIndex = dropIndexSyncRef.current  // ← legge sync
  // ...
}
```

---

## 3. WebGL Migration Roadmap

### Fase 1: Framework + Proof of Concept (giorno 1-3)

| Tool | Tecnica | Effort | Note |
|------|---------|--------|------|
| **ferrofluid** | 4-pass GPU (flow→thickness→RD→render) | Alto | Caso d'uso più complesso, valida l'architettura |
| **shaders** | Upgrade GLSL 100→300es + più octaves | Basso | Già ha path WebGL, solo upgrade |

**Output:** ToolRenderer funzionante, Noise Library, 2 tool migrati

### Fase 2: Tool Complessi (giorno 4-7)

| Tool | Tecnica | Effort | Shader Feature |
|------|---------|--------|----------------|
| **particles** | Chladni figures in fragment shader | Medio | `cos(f * length(norm - sources[i]))` |
| **particles2** | Point sprites + GPU physics | Alto | `gl.drawArraysInstanced()` + transform feedback |
| **liquidmetal** | SDF raymarching | Alto | `sdBezier()` + 220 step loop |
| **flowfield** | Curl noise streamlines | Medio | `sin(x*0.008*curl + t*0.4)` |

**Output:** 6 tool totali migrati, framework validato

### Fase 3: Tool Semplici (giorno 8-10)

| Tool | Tecnica | Effort | Shader Feature |
|------|---------|--------|----------------|
| **plasma** | Sine superposition | Basso | 3 onde ortogonali + HSL cycling |
| **tunnel** | Perspective rings | Basso | `z = (i/rings + t*speed) % 1` |
| **starfield** | Radial z-drift | Basso | Angular spacing + depth sizing |
| **rings** | Concentric ripples | Basso | `phase = (t*0.6 + i/count) % 1` |
| **molecules** | Pseudo-3D projection | Medio | Depth z = `0.5 + 0.5*sin(t*drift + φ)` |
| **brutalist** | Geometric grid | Basso | Per-cell RNG + rotation |
| **kaleidoscope** | Canvas copy + wedge clip | Basso | Potrebbe restare Canvas2D (uso clip regions) |
| **doodle** | Quadratic Bézier jitter | Basso | Potrebbe restare Canvas2D (curve complesse) |

**Output:** 14 tool totali migrati

### Dependencies
```
Noise Library ──┬──► ferrofluid (FBM + curl)
                ├──► particles (Chladni)
                ├──► flowfield (curl noise)
                ├──► liquidmetal (domain warping)
                └──► shaders (FBM upgrade)

ToolRenderer ───┬──► tutti i tool (gestione FBO + shader compilation)
                └──► compositor (integrazione output texture)
```

---

## 4. Testing Strategy

### 4.1 Visual Regression
Confronto screenshot prima/dopo per ogni tool:
- Ferrofluid: stessi feed/kill producono pattern simili
- Particles: stessi parametri → stessa densità
- Liquidmetal: specular highlights posizionati correttamente
- Shaders: le 3 palettes rendono correttamente
- Tutti: ≥ 60fps a risoluzione standard

### 4.2 Skill Integration

| Skill | Quando | Cosa verifica |
|-------|--------|---------------|
| **`/ponytail`** | Dopo ogni tool migrato | Code quality: no over-engineering, YAGNI, stdlib prima |
| **`/ui-ux-pro-max`** | Dopo fix UI/UX | Accessibilità, contrast ratio, touch targets, responsive |
| **`/systematic-debugging`** | Se bug persistono | Hypothesis-driven debugging, root cause analysis |
| **`/verification-before-completion`** | Prima di ogni commit | Evidenza prima di assertions |

### 4.3 Automated Tests
```typescript
describe('ferrofluid GPU', () => {
  it('renders without errors', () => {
    const gl = createMockWebGL2Context()
    const tool = resolveTool('ferrofluid', '2.0.0')
    expect(() => tool.render(gl, mockFrame, mockItem, mockAudio, mockStack)).not.toThrow()
  })
})
```

### 4.4 Manual Checklist
Per ogni tool migrato:
- [ ] Tool si apre senza errori console
- [ ] Parametri slider producono effetto visivo atteso
- [ ] Audio reactivity funziona (bass/mid/treble)
- [ ] Frame rate ≥ 60fps
- [ ] Nessun memory leak (FBO rilasciati correttamente)
- [ ] Export (PNG/MP4) funziona

---

## 5. Execution Plan

### Timeline: ~10 giorni
```
Giorno 1-2   ──► Bug Fixes (agente dedicato) + Framework Setup (main)
Giorno 3-4   ──► Ferrofluid GPU (proof of concept)
Giorno 5-6   ──► Particles + Liquidmetal + Flowfield
Giorno 7-8   ──► Shaders upgrade + Tool semplici
Giorno 9-10  ──► Resto tool + Integration testing + Polish
```

### Task Breakdown

#### Parallelo A: Bug Fixes (agente dedicato)
| Task | File | Effort |
|------|------|--------|
| A1: Rimuovere preventDefault | `useCanvasPanZoom.ts` | 5 min |
| A2: Fix NotAllowedError audio | `engine.ts` + `useAudio.ts` | 30 min |
| A3: Fix panel non riappare | `App.tsx` | 10 min |
| A4: Fix hidden settings stack | `FloatingStack.tsx` | 15 min |
| A5: Fix drag race condition | `FloatingStack.tsx` | 20 min |

#### Parallelo B: WebGL Migration (main)
| Task | Giorno | Output |
|------|--------|--------|
| B1: Noise Library | 1 | `engine/shaders/noise.ts` |
| B2: ToolRenderer | 1 | `engine/toolRenderer.ts` |
| B3: Ferrofluid GPU | 3-4 | `tools/generative/ferrofluid.ts` v3.0 |
| B4: Particles GPU | 5 | `tools/generative/particles.ts` v3.0 |
| B5: Liquidmetal GPU | 5-6 | `tools/generative/liquidmetal.ts` v2.0 |
| B6: Flowfield GPU | 6 | `tools/generative/flowfield.ts` v3.0 |
| B7: Shaders upgrade | 7 | `tools/generative/shaders.ts` v2.0 |
| B8: Tool semplici | 7-8 | plasma, tunnel, starfield, rings, molecules, brutalist |
| B9: Kaleidoscope + Doodle | 9 | Valuta se restare Canvas2D |
| B10: Integration test | 10 | Tutti i tool testati |

### Milestones

| Milestone | Giorno | Criteria |
|-----------|--------|----------|
| M1: Bug fixes completati | 2 | 0 errori console, audio funziona |
| M2: Ferrofluid GPU funzionante | 4 | 4-pass rendering, ≥60fps |
| M3: 6 tool migrati | 6 | particles, liquidmetal, flowfield, shaders funzionanti |
| M4: Tutti i 14 tool migrati | 8 | Nessun Canvas2D per generative tools |
| M5: Integration completa | 10 | Export, audio reactivity, UI/UX verificato |

### Commit Strategy
```
feat(dome): add noise library (FBM, simplex, curl, domain warping)
feat(dome): add ToolRenderer for WebGL2 tool rendering
feat(dome): migrate ferrofluid to GPU 4-pass pipeline
feat(dome): migrate particles to GPU Chladni shader
feat(dome): migrate liquidmetal to GPU SDF raymarching
feat(dome): migrate flowfield to GPU curl noise
feat(dome): upgrade shaders to GLSL 300es
feat(dome): migrate remaining generative tools to GPU
fix(dome): audio preventDefault passive listener
fix(dome): AudioContext NotAllowedError
fix(dome): panel reopen on node switch
fix(dome): hidden node visibility in stack
fix(dome): drag drop race condition
```
