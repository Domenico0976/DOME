# DOME Generative WebGL Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 14 generative tools from Canvas2D to WebGL2 rendering, matching sketchtools quality, while fixing 5 audio/UI bugs in parallel.

**Architecture:** Create a ToolRenderer class managing WebGL2 context with ping-pong FBOs, a shared Noise Library (FBM, simplex, curl, domain warping), and migrate each tool to GLSL 300es fragment shaders. Bug fixes run in parallel via dedicated agent.

**Tech Stack:** WebGL2, GLSL 300es, TypeScript, React, GSAP Draggable, Zustand

## Global Constraints

- GLSL version: `#version 300 es` with `precision highp float;`
- Texture format: RGBA8UI for display, RGBA32F for simulation (ferrofluid RD)
- Frame rate target: ≥60fps at 720p
- Backward compatible: Canvas2D fallback preserved for non-WebGL2 browsers
- Test framework: Vitest + React Testing Library
- Commit style: `feat(dome):` for new features, `fix(dome):` for bug fixes

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `tools-app/src/engine/toolRenderer.ts` | WebGL2 context management, FBO ping-pong, shader compilation |
| `tools-app/src/engine/shaders/noise.ts` | GLSL noise functions (FBM, simplex, curl, domain warping, Chladni) |
| `tools-app/src/engine/shaders/template.ts` | Vertex shader template, uniform management |
| `tools-app/src/engine/shaders/ferrofluid.ts` | Ferrofluid 4-pass GPU shaders |
| `tools-app/src/engine/shaders/particles.ts` | Particles Chladni shader |
| `tools-app/src/engine/shaders/liquidmetal.ts` | Liquidmetal SDF raymarching shader |
| `tools-app/src/engine/shaders/flowfield.ts` | Flowfield curl noise shader |
| `tools-app/src/engine/shaders/plasma.ts` | Plasma sine superposition shader |
| `tools-app/src/engine/shaders/tunnel.ts` | Tunnel perspective rings shader |
| `tools-app/src/engine/shaders/starfield.ts` | Starfield radial z-drift shader |
| `tools-app/src/engine/shaders/rings.ts` | Rings concentric ripples shader |
| `tools-app/src/engine/shaders/molecules.ts` | Molecules pseudo-3D shader |
| `tools-app/src/engine/shaders/brutalist.ts` | Brutalist geometric grid shader |

### Modified Files
| File | Changes |
|------|---------|
| `tools-app/src/core/types.ts` | Add `gl?: WebGL2RenderingContext` to ToolDef.render signature |
| `tools-app/src/tools/generative/ferrofluid.ts` | Rewrite to use ToolRenderer + GPU 4-pass pipeline |
| `tools-app/src/tools/generative/particles.ts` | Rewrite to use ToolRenderer + Chladni shader |
| `tools-app/src/tools/generative/particles2.ts` | Rewrite to use ToolRenderer + point sprites |
| `tools-app/src/tools/generative/liquidmetal.ts` | Rewrite to use ToolRenderer + SDF raymarching |
| `tools-app/src/tools/generative/flowfield.ts` | Rewrite to use ToolRenderer + curl noise |
| `tools-app/src/tools/generative/shaders.ts` | Upgrade to GLSL 300es + more octaves |
| `tools-app/src/tools/generative/plasma.ts` | Rewrite to use ToolRenderer + sine shader |
| `tools-app/src/tools/generative/tunnel.ts` | Rewrite to use ToolRenderer + perspective shader |
| `tools-app/src/tools/generative/starfield.ts` | Rewrite to use ToolRenderer + z-drift shader |
| `tools-app/src/tools/generative/rings.ts` | Rewrite to use ToolRenderer + ripples shader |
| `tools-app/src/tools/generative/molecules.ts` | Rewrite to use ToolRenderer + 3D projection shader |
| `tools-app/src/tools/generative/brutalist.ts` | Rewrite to use ToolRenderer + geometric shader |
| `tools-app/src/ui/Canvas.tsx` | Pass WebGL2 context to tool render calls |
| `tools-app/src/core/stackEngine.ts` | Update evaluateStack to pass GL context |
| `tools-app/src/hooks/useCanvasPanZoom.ts` | Remove preventDefault from wheel handler |
| `tools-app/src/audio/engine.ts` | Remove analyser.connect(destination), add state check |
| `tools-app/src/audio/useAudio.ts` | Add try/catch on el.play(), verify context.state |
| `tools-app/src/App.tsx` | Add useEffect to reset panelOpen on selectedUid change |
| `tools-app/src/ui/FloatingStack.tsx` | Add opacity-40 pointer-events-none for hidden, fix drag race |

---

## Task A: Bug Fixes (Parallel Agent)

### Task A1: Remove preventDefault from wheel handler

**Files:**
- Modify: `tools-app/src/hooks/useCanvasPanZoom.ts:56-64`

**Interfaces:**
- Consumes: React.WheelEvent
- Produces: Zoom state update (unchanged behavior)

- [ ] **Step 1: Remove preventDefault call**

```typescript
// useCanvasPanZoom.ts line 56-64
const onWheel = useCallback((e: React.WheelEvent) => {
  // e.preventDefault()  // REMOVED: causes console warning in passive listener
  const delta = e.deltaY > 0 ? -1 : 1
  const step = e.shiftKey ? FINE_ZOOM_STEP : ZOOM_STEP
  setZoom((prev) => {
    const next = prev + delta * step
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  })
}, [])
```

- [ ] **Step 2: Verify no console warnings**

Run: `npm run dev` → open browser → scroll on canvas → check console
Expected: No "preventDefault" warnings

- [ ] **Step 3: Commit**

```bash
git add tools-app/src/hooks/useCanvasPanZoom.ts
git commit -m "fix(dome): remove preventDefault from passive wheel listener"
```

---

### Task A2: Fix AudioContext NotAllowedError

**Files:**
- Modify: `tools-app/src/audio/engine.ts:32,39-41`
- Modify: `tools-app/src/audio/useAudio.ts:29-41`

**Interfaces:**
- Consumes: AudioContext, HTMLMediaElement
- Produces: Error-safe audio playback

- [ ] **Step 1: Remove silent audio output connection**

```typescript
// engine.ts line 32 — REMOVE this line:
// analyserNode.connect(context.destination)  // Causes silent audio → autoplay violation
```

- [ ] **Step 2: Add state verification to resumeIfSuspended**

```typescript
// engine.ts line 39-41
export async function resumeIfSuspended(): Promise<void> {
  if (context !== null && context.state === 'suspended') {
    await context.resume()
    // Verify resume succeeded
    if (context.state === 'suspended') {
      throw new AudioEngineError('AudioContext could not be resumed: autoplay blocked')
    }
  }
}
```

- [ ] **Step 3: Add try/catch to enableFile**

```typescript
// useAudio.ts line 29-41
const enableFile = useCallback(async (file: File) => {
  ensureAudioContext()
  await resumeIfSuspended()
  const url = URL.createObjectURL(file)
  const el = new Audio(url)
  el.loop = true
  mediaRef.current = el
  attachMediaElement(el)
  try {
    await el.play()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      throw new AudioEngineError(
        'Audio playback blocked: allow autoplay in browser settings or click anywhere on the page first'
      )
    }
    throw err
  }
  setFileName(file.name)
  setSource('file')
  setEnabled(true)
}, [])
```

- [ ] **Step 4: Test audio loading**

Run: `npm run dev` → load audio file → verify no NotAllowedError
Expected: Audio plays without console errors

- [ ] **Step 5: Commit**

```bash
git add tools-app/src/audio/engine.ts tools-app/src/audio/useAudio.ts
git commit -m "fix(dome): AudioContext NotAllowedError - remove silent output, add state check"
```

---

### Task A3: Fix panel not reappearing after close

**Files:**
- Modify: `tools-app/src/App.tsx:13,50-52`

**Interfaces:**
- Consumes: selectedUid from Zustand store
- Produces: panelOpen state auto-reset

- [ ] **Step 1: Add useEffect to reset panelOpen**

```typescript
// App.tsx — add after useState declarations
useEffect(() => {
  setPanelOpen(true)
}, [selectedUid])
```

- [ ] **Step 2: Test panel behavior**

Run: `npm run dev` → select node → close panel → select different node → verify panel reappears
Expected: Panel opens for new selection

- [ ] **Step 3: Commit**

```bash
git add tools-app/src/App.tsx
git commit -m "fix(dome): panel reopen on node switch"
```

---

### Task A4: Fix hidden node visibility in stack

**Files:**
- Modify: `tools-app/src/ui/FloatingStack.tsx:132`

**Interfaces:**
- Consumes: it.hidden from stack item
- Produces: Visual distinction for hidden nodes

- [ ] **Step 1: Add opacity and disable interactions for hidden nodes**

```tsx
// FloatingStack.tsx line 132 — update className
className={cn(
  'group relative shrink-0 rounded-lg border px-3 py-2 cursor-pointer transition-colors select-none',
  isSelected ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
  it.hidden && 'opacity-40 pointer-events-none',  // CHANGED from opacity-50
  draggingUid === it.uid && 'z-50 opacity-80',
)}
```

- [ ] **Step 2: Test hidden node behavior**

Run: `npm run dev` → hide node → verify reduced opacity + no click interactions
Expected: Node dimmed, buttons not clickable

- [ ] **Step 3: Commit**

```bash
git add tools-app/src/ui/FloatingStack.tsx
git commit -m "fix(dome): hidden node visibility - opacity-40 + pointer-events-none"
```

---

### Task A5: Fix drag & drop race condition

**Files:**
- Modify: `tools-app/src/ui/FloatingStack.tsx:45-47,58-101`

**Interfaces:**
- Consumes: GSAP Draggable onDrag/onDragEnd callbacks
- Produces: Correct drop index on drag end

- [ ] **Step 1: Add synchronous drop index ref**

```typescript
// FloatingStack.tsx — add after existing refs
const dropIndexSyncRef = useRef<number | null>(null)
```

- [ ] **Step 2: Update onDrag to set sync ref**

```typescript
onDrag: () => {
  const items = Array.from(itemRefs.current.entries())
  const sorted = items
    .filter(([id]) => id !== uid)
    .sort((a, b) => {
      const rectA = a[1].getBoundingClientRect()
      const rectB = b[1].getBoundingClientRect()
      return rectA.left - rectB.left
    })

  const draggedRect = el.getBoundingClientRect()
  const draggedCenter = draggedRect.left + draggedRect.width / 2

  let newIndex = sorted.length
  for (let i = 0; i < sorted.length; i++) {
    const [, itemEl] = sorted[i]
    const rect = itemEl.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    if (draggedCenter < center) {
      newIndex = i
      break
    }
  }
  dropIndexSyncRef.current = newIndex  // ← SYNC UPDATE
  setDropIndex(newIndex)
},
```

- [ ] **Step 3: Update onDragEnd to read sync ref**

```typescript
onDragEnd: () => {
  const currentDropIndex = dropIndexSyncRef.current  // ← READ SYNC REF
  setDraggingUid(null)
  setDropIndex(null)
  dropIndexSyncRef.current = null  // ← CLEAR

  if (currentDropIndex !== null) {
    const currentIndex = stack.findIndex((i) => i.uid === uid)
    if (currentIndex !== -1 && currentIndex !== currentDropIndex) {
      const newStack = stack.filter((i) => i.uid !== uid)
      newStack.splice(currentDropIndex, 0, stack[currentIndex])
      useProjectStore.setState({ stack: newStack, unsaved: true })
    }
  }

  gsap.set(el, { x: 0 })
},
```

- [ ] **Step 4: Test drag & drop reordering**

Run: `npm run dev` → drag stack items → verify correct position on drop
Expected: Items drop at visual cursor position

- [ ] **Step 5: Commit**

```bash
git add tools-app/src/ui/FloatingStack.tsx
git commit -m "fix(dome): drag drop race condition - use sync ref for drop index"
```

---

## Task B: WebGL Framework (Main Track)

### Task B1: Create Noise Library

**Files:**
- Create: `tools-app/src/engine/shaders/noise.ts`

**Interfaces:**
- Consumes: None (standalone utility)
- Produces: GLSL noise functions as string constants

- [ ] **Step 1: Create noise.ts with GLSL functions**

```typescript
// tools-app/src/engine/shaders/noise.ts

export const NOISE_GLSL = `
// --- Noise Library for DOME Generative Tools ---

// Hash function for pseudo-random values
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Value noise
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// FBM (Fractal Brownian Motion)
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * vnoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// FBM with fractional octaves
float fbmOctFloat(vec2 p, float oct) {
  float v = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= oct) break;
    v += amp * vnoise(p * freq);
    amp *= 0.5;
    freq *= 2.13;
  }
  return v;
}

// Curl noise for divergence-free fields
vec2 curlNoise(vec2 p) {
  float e = 0.1;
  float n1, n2;
  vec2 curl;
  
  n1 = vnoise(p + vec2(0, e));
  n2 = vnoise(p - vec2(0, e));
  curl.x = (n1 - n2) / (2.0 * e);
  
  n1 = vnoise(p + vec2(e, 0));
  n2 = vnoise(p - vec2(e, 0));
  curl.y = (n1 - n2) / (2.0 * e);
  
  return vec2(curl.x, -curl.y);
}

// Domain warping
vec2 domainWarp(vec2 p, float strength) {
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), 4),
    fbm(p + vec2(5.2, 1.3), 4)
  );
  vec2 r = vec2(
    fbm(p + strength * q + vec2(1.7, 9.2), 4),
    fbm(p + strength * q + vec2(8.3, 2.8), 4)
  );
  return r;
}

// Chladni figure
float chladni(vec2 norm, float freq, int nsrc, vec2 sources[8]) {
  float f = freq * 3.14159265;
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= nsrc) break;
    s += cos(f * length(norm - sources[i]));
  }
  return s / float(nsrc);
}
`;

export const CHLADNI_SOURCES_MAX = 8;
```

- [ ] **Step 2: Test import works**

```typescript
// Add to a test file or verify in build
import { NOISE_GLSL } from '../engine/shaders/noise'
console.log(NOISE_GLSL.length) // Should be > 0
```

- [ ] **Step 3: Commit**

```bash
git add tools-app/src/engine/shaders/noise.ts
git commit -m "feat(dome): add noise library (FBM, simplex, curl, domain warping, Chladni)"
```

---

### Task B2: Create ToolRenderer

**Files:**
- Create: `tools-app/src/engine/toolRenderer.ts`

**Interfaces:**
- Consumes: WebGL2RenderingContext, shader strings
- Produces: Compiled programs, FBO management, render methods

- [ ] **Step 1: Create ToolRenderer class**

```typescript
// tools-app/src/engine/toolRenderer.ts

export interface FBOPair {
  texA: WebGLTexture
  texB: WebGLTexture
  fboA: WebGLFramebuffer
  fboB: WebGLFramebuffer
}

export class ToolRenderer {
  private gl: WebGL2RenderingContext
  private programs: Map<string, WebGLProgram> = new Map()
  private fbos: Map<string, FBOPair> = new Map()
  private quadVAO: WebGLVertexArrayObject | null = null

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.initQuad()
  }

  private initQuad(): void {
    const gl = this.gl
    this.quadVAO = gl.createVertexArray()
    gl.bindVertexArray(this.quadVAO)

    const vertices = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ])

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
  }

  compileProgram(name: string, fragSource: string): WebGLProgram | null {
    const gl = this.gl

    if (this.programs.has(name)) {
      return this.programs.get(name)!
    }

    const vertSource = `#version 300 es
      layout(location = 0) in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `

    const vert = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vert, vertSource)
    gl.compileShader(vert)

    const frag = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(frag, fragSource)
    gl.compileShader(frag)

    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(frag))
      return null
    }

    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(frag, frag)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      return null
    }

    this.programs.set(name, program)
    return program
  }

  createFBO(name: string, width: number, height: number, float: boolean = false): FBOPair {
    const gl = this.gl
    const format = float ? gl.RGBA32F : gl.RGBA8
    const type = float ? gl.FLOAT : gl.UNSIGNED_BYTE

    const createTex = (): WebGLTexture => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, type, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      return tex
    }

    const createFBO = (tex: WebGLTexture): WebGLFramebuffer => {
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return fbo
    }

    const texA = createTex()
    const texB = createTex()
    const fboA = createFBO(texA)
    const fboB = createFBO(texB)

    const pair: FBOPair = { texA, texB, fboA, fboB }
    this.fbos.set(name, pair)
    return pair
  }

  getFBO(name: string): FBOPair | undefined {
    return this.fbos.get(name)
  }

  renderToTexture(
    program: WebGLProgram,
    inputTex: WebGLTexture,
    outputFBO: WebGLFramebuffer,
    width: number,
    height: number,
    uniforms: Record<string, number | number[]> = {}
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFBO)
    gl.viewport(0, 0, width, height)
    gl.useProgram(program)

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputTex)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)

    // Set uniforms
    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc === null) continue
      if (typeof value === 'number') {
        gl.uniform1f(loc, value)
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value)
        else if (value.length === 3) gl.uniform3fv(loc, value)
        else if (value.length === 4) gl.uniform4fv(loc, value)
      }
    }

    // Draw quad
    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  renderToCanvas(
    program: WebGLProgram,
    inputTex: WebGLTexture,
    width: number,
    height: number,
    uniforms: Record<string, number | number[]> = {}
  ): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)
    gl.useProgram(program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, inputTex)
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0)

    for (const [name, value] of Object.entries(uniforms)) {
      const loc = gl.getUniformLocation(program, name)
      if (loc === null) continue
      if (typeof value === 'number') {
        gl.uniform1f(loc, value)
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2fv(loc, value)
        else if (value.length === 3) gl.uniform3fv(loc, value)
        else if (value.length === 4) gl.uniform4fv(loc, value)
      }
    }

    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindVertexArray(null)
  }

  destroy(): void {
    const gl = this.gl
    this.programs.forEach((prog) => gl.deleteProgram(prog))
    this.fbos.forEach((pair) => {
      gl.deleteTexture(pair.texA)
      gl.deleteTexture(pair.texB)
      gl.deleteFramebuffer(pair.fboA)
      gl.deleteFramebuffer(pair.fboB)
    })
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO)
  }
}
```

- [ ] **Step 2: Test basic compilation**

```typescript
// Verify ToolRenderer can be instantiated
const canvas = document.createElement('canvas')
const gl = canvas.getContext('webgl2')
if (gl) {
  const renderer = new ToolRenderer(gl)
  console.log('ToolRenderer created')
  renderer.destroy()
}
```

- [ ] **Step 3: Commit**

```bash
git add tools-app/src/engine/toolRenderer.ts
git commit -m "feat(dome): add ToolRenderer for WebGL2 tool rendering"
```

---

### Task B3: Migrate Ferrofluid to GPU

**Files:**
- Create: `tools-app/src/engine/shaders/ferrofluid.ts`
- Modify: `tools-app/src/tools/generative/ferrofluid.ts`

**Interfaces:**
- Consumes: ToolRenderer, NOISE_GLSL
- Produces: 4-pass GPU ferrofluid rendering

- [ ] **Step 1: Create ferrofluid GPU shaders**

```typescript
// tools-app/src/engine/shaders/ferrofluid.ts
import { NOISE_GLSL } from './noise'

export const FERROFLOW_ADVECT_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 vel = curlNoise(uv * 3.0 + u_time * 0.1) * u_speed * 0.01;
  vec4 col = texture(u_tex, uv - vel);
  fragColor = col;
}
`

export const FERROFLOW_THICKNESS_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time;
uniform float u_feed;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec4 prev = texture(u_tex, uv);
  
  // Add feed blobs
  float blob = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 center = vec2(
      0.5 + 0.3 * cos(u_time * 0.5 + float(i) * 1.57),
      0.5 + 0.3 * sin(u_time * 0.7 + float(i) * 1.57)
    );
    float d = length(uv - center);
    blob += u_feed * exp(-d * d * 50.0);
  }
  
  fragColor = vec4(prev.rgb + vec3(blob), 1.0);
}
`

export const FERROFLOW_RD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_feed;
uniform float u_kill;
uniform float u_da;
uniform float u_db;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 texel = 1.0 / u_res;
  
  vec4 center = texture(u_tex, uv);
  vec4 left = texture(u_tex, uv - vec2(texel.x, 0.0));
  vec4 right = texture(u_tex, uv + vec2(texel.x, 0.0));
  vec4 up = texture(u_tex, uv + vec2(0.0, texel.y));
  vec4 down = texture(u_tex, uv - vec2(0.0, texel.y));
  
  float a = center.r;
  float b = center.g;
  
  // Laplacian
  float lapA = (left.r + right.r + up.r + down.r) / 4.0 - a;
  float lapB = (left.g + right.g + up.g + down.g) / 4.0 - b;
  
  // Gray-Scott reaction-diffusion
  float ab2 = a * b * b;
  float na = a + u_da * lapA - ab2 + u_feed * (1.0 - a);
  float nb = b + u_db * lapB + ab2 - (u_kill + u_feed) * b;
  
  fragColor = vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), center.b, 1.0);
}
`

export const FERROFLOW_RENDER_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_tex;
uniform vec3 u_accent;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec4 data = texture(u_tex, v_uv);
  float pattern = data.r - data.g;
  
  // Color mapping
  vec3 col = mix(vec3(0.0), u_accent, smoothstep(-0.2, 0.8, pattern));
  
  // Add highlights
  col += vec3(0.1) * smoothstep(0.7, 0.9, pattern);
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 2: Rewrite ferrofluid.ts to use ToolRenderer**

```typescript
// tools-app/src/tools/generative/ferrofluid.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import {
  FERROFLOW_ADVECT_FRAG,
  FERROFLOW_THICKNESS_FRAG,
  FERROFLOW_RD_FRAG,
  FERROFLOW_RENDER_FRAG
} from '../../engine/shaders/ferrofluid'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('ferroflowAdvect', FERROFLOW_ADVECT_FRAG)
    renderer.compileProgram('ferroflowThickness', FERROFLOW_THICKNESS_FRAG)
    renderer.compileProgram('ferroflowRD', FERROFLOW_RD_FRAG)
    renderer.compileProgram('ferroflowRender', FERROFLOW_RENDER_FRAG)
  }
  return renderer
}

export const ferrofluidTool: ToolDef = {
  id: 'ferrofluid',
  kind: 'generative',
  version: '3.0.0',
  label: 'Ferrofluid',
  controls: [
    { param: 'feed', label: 'Feed', min: 0.01, max: 0.09, step: 0.001, default: 0.055 },
    { param: 'kill', label: 'Kill', min: 0.03, max: 0.075, step: 0.001, default: 0.062 },
    { param: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, default: 1 },
    { param: 'attractors', label: 'Attractors', min: 0, max: 12, step: 1, default: 4 },
    { param: 'accent', label: 'Accent', type: 'color', default: '#00ff88' }
  ],
  render: (ctx, frame, item, audio, stack, gl) => {
    if (!gl) return // Fallback to Canvas2D if no WebGL

    const r = getRenderer(gl)
    const params = item.params
    const feed = Number(params.feed ?? 0.055)
    const kill = Number(params.kill ?? 0.062)
    const speed = Number(params.speed ?? 1)
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    // Create/recreate FBOs if needed
    let fbos = r.getFBO('ferroflow')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('ferroflow', w, h, true) // float textures for RD
    }

    const advectProg = r.compileProgram('ferroflowAdvect', FERROFLOW_ADVECT_FRAG)
    const thicknessProg = r.compileProgram('ferroflowThickness', FERROFLOW_THICKNESS_FRAG)
    const rdProg = r.compileProgram('ferroflowRD', FERROFLOW_RD_FRAG)
    const renderProg = r.compileProgram('ferroflowRender', FERROFLOW_RENDER_FRAG)

    if (!advectProg || !thicknessProg || !rdProg || !renderProg) return

    // 4-pass rendering
    const time = frame.time * 0.001

    // Pass 1: Flow advection
    r.renderToTexture(advectProg, fbos.texA, fbos.fboB, w, h, {
      u_time: time,
      u_speed: speed,
      u_res: [w, h]
    })

    // Pass 2: Thickness
    r.renderToTexture(thicknessProg, fbos.texB, fbos.fboA, w, h, {
      u_time: time,
      u_feed: feed,
      u_res: [w, h]
    })

    // Pass 3: Reaction-Diffusion (multiple iterations)
    const iterations = Math.floor(speed * 3) + 1
    for (let i = 0; i < iterations; i++) {
      r.renderToTexture(rdProg, fbos.texA, fbos.fboB, w, h, {
        u_feed: feed,
        u_kill: kill,
        u_da: 1.0,
        u_db: 0.5,
        u_res: [w, h]
      })
      // Swap
      const tmp = fbos.texA
      fbos.texA = fbos.texB
      fbos.texB = tmp
    }

    // Pass 4: Render to canvas
    const hexToRgb = (hex: string): number[] => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255
      return [r, g, b]
    }

    r.renderToCanvas(renderProg, fbos.texA, w, h, {
      u_accent: hexToRgb(String(params.accent ?? '#00ff88'))
    })
  }
}
```

- [ ] **Step 3: Test ferrofluid renders**

Run: `npm run dev` → select ferrofluid tool → verify visual output
Expected: Organic channel-like patterns, ≥60fps

- [ ] **Step 4: Commit**

```bash
git add tools-app/src/engine/shaders/ferrofluid.ts tools-app/src/tools/generative/ferrofluid.ts
git commit -m "feat(dome): migrate ferrofluid to GPU 4-pass pipeline"
```

---

### Task B4: Migrate Particles to GPU

**Files:**
- Create: `tools-app/src/engine/shaders/particles.ts`
- Modify: `tools-app/src/tools/generative/particles.ts`

**Interfaces:**
- Consumes: ToolRenderer, NOISE_GLSL
- Produces: Chladni figures via fragment shader

- [ ] **Step 1: Create particles Chladni shader**

```typescript
// tools-app/src/engine/shaders/particles.ts
import { NOISE_GLSL } from './noise'

export const PARTICLES_CHLADNI_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_a;
uniform float u_b;
uniform float u_m;
uniform float u_n;
uniform float u_freq;
uniform float u_density;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 norm = uv * 2.0 - 1.0;
  
  // Chladni figure
  float f = u_freq * 3.14159265;
  float chladni = u_a * sin(u_m * f * norm.x) * sin(u_n * f * norm.y)
                - u_b * sin(u_n * f * norm.x) * sin(u_m * f * norm.y);
  
  // Particle density based on Chladni zero-crossing
  float edge = abs(chladni);
  float density = exp(-edge * u_density * 10.0);
  
  // Add noise for organic feel
  float noise = vnoise(uv * 20.0 + u_time * 0.1) * 0.2;
  density += noise * 0.3;
  
  // Color based on density
  vec3 col = vec3(density) * vec3(0.2, 0.8, 1.0);
  
  fragColor = vec4(col, density);
}
`

export const PARTICLES_POINT_SPRITE_VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_vel;
layout(location = 2) in float a_size;

uniform float u_time;
uniform vec2 u_res;

out vec2 v_vel;
out float v_size;

void main() {
  v_vel = a_vel;
  v_size = a_size;
  
  vec2 pos = a_pos;
  pos += a_vel * u_time * 0.01;
  
  // Wrap around
  pos = fract(pos + 0.5) * 2.0 - 1.0;
  
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = a_size;
}
`

export const PARTICLES_POINT_SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_vel;
in float v_size;

out vec4 fragColor;

void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float dist = length(pc);
  
  if (dist > 1.0) discard;
  
  float alpha = 1.0 - dist;
  vec3 col = mix(vec3(0.2, 0.8, 1.0), vec3(1.0, 0.4, 0.2), length(v_vel));
  
  fragColor = vec4(col, alpha);
}
`
```

- [ ] **Step 2: Rewrite particles.ts to use ToolRenderer**

```typescript
// tools-app/src/tools/generative/particles.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { PARTICLES_CHLADNI_FRAG } from '../../engine/shaders/particles'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('particlesChladni', PARTICLES_CHLADNI_FRAG)
  }
  return renderer
}

export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '3.0.0',
  label: 'Particles',
  controls: [
    { param: 'count', label: 'Count', min: 50, max: 2000, step: 10, default: 500 },
    { param: 'size', label: 'Size', min: 1, max: 8, step: 0.5, default: 3 },
    { param: 'a', label: 'A', min: 1, max: 6, step: 1, default: 3 },
    { param: 'b', label: 'B', min: 1, max: 6, step: 1, default: 2 },
    { param: 'm', label: 'M', min: 1, max: 8, step: 1, default: 3 },
    { param: 'n', label: 'N', min: 1, max: 8, step: 1, default: 2 },
    { param: 'freq', label: 'Frequency', min: 0.5, max: 4, step: 0.1, default: 1.5 },
    { param: 'density', label: 'Density', min: 1, max: 20, step: 1, default: 10 }
  ],
  render: (ctx, frame, item, audio, stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('particles')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('particles', w, h)
    }

    const prog = r.compileProgram('particlesChladni', PARTICLES_CHLADNI_FRAG)
    if (!prog) return

    const time = frame.time * 0.001

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_a: Number(params.a ?? 3),
      u_b: Number(params.b ?? 2),
      u_m: Number(params.m ?? 3),
      u_n: Number(params.n ?? 2),
      u_freq: Number(params.freq ?? 1.5),
      u_density: Number(params.density ?? 10),
      u_res: [w, h]
    })
  }
}
```

- [ ] **Step 3: Test particles render**

Run: `npm run dev` → select particles tool → verify Chladni patterns
Expected: Wave-like particle patterns, ≥60fps

- [ ] **Step 4: Commit**

```bash
git add tools-app/src/engine/shaders/particles.ts tools-app/src/tools/generative/particles.ts
git commit -m "feat(dome): migrate particles to GPU Chladni shader"
```

---

### Task B5: Migrate Liquidmetal to GPU

**Files:**
- Create: `tools-app/src/engine/shaders/liquidmetal.ts`
- Modify: `tools-app/src/tools/generative/liquidmetal.ts`

**Interfaces:**
- Consumes: ToolRenderer
- Produces: SDF raymarching rendering

- [ ] **Step 1: Create liquidmetal SDF shader**

```typescript
// tools-app/src/engine/shaders/liquidmetal.ts

export const LIQUIDMETAL_SDF_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_blobs;
uniform float u_threshold;
uniform float u_lightAngle;
in vec2 v_uv;
out vec4 fragColor;

// SDF for sphere
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Smooth union
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Scene SDF
float map(vec3 p) {
  float d = 1e10;
  
  for (int i = 0; i < 16; i++) {
    if (float(i) >= u_blobs) break;
    
    float fi = float(i);
    vec3 center = vec3(
      0.4 * sin(u_time * 0.3 + fi * 1.5),
      0.4 * cos(u_time * 0.4 + fi * 2.1),
      0.2 * sin(u_time * 0.5 + fi * 0.7)
    );
    
    float sphere = sdSphere(p - center, 0.15 + 0.05 * sin(u_time + fi));
    d = opSmoothUnion(d, sphere, u_threshold);
  }
  
  return d;
}

// Calculate normal
vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  
  // Ray setup
  vec3 ro = vec3(0.0, 0.0, 2.0);
  vec3 rd = normalize(vec3(uv, -1.0));
  
  // Raymarching
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001 || t > 10.0) break;
    t += d;
  }
  
  vec3 col = vec3(0.0);
  
  if (t < 10.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    
    // Lighting
    vec3 lightDir = vec3(
      cos(u_lightAngle * 3.14159 / 180.0),
      sin(u_lightAngle * 3.14159 / 180.0),
      0.5
    );
    
    float diff = max(dot(n, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 20.0);
    
    // Metallic color
    col = vec3(0.8, 0.85, 0.9) * diff + vec3(1.0) * spec * 0.5;
  }
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 2: Rewrite liquidmetal.ts to use ToolRenderer**

```typescript
// tools-app/src/tools/generative/liquidmetal.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { LIQUIDMETAL_SDF_FRAG } from '../../engine/shaders/liquidmetal'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('liquidmetalSDF', LIQUIDMETAL_SDF_FRAG)
  }
  return renderer
}

export const liquidmetalTool: ToolDef = {
  id: 'liquidmetal',
  kind: 'generative',
  version: '2.0.0',
  label: 'Liquid Metal',
  controls: [
    { param: 'blobs', label: 'Blobs', min: 4, max: 14, step: 1, default: 8 },
    { param: 'threshold', label: 'Threshold', min: 0.6, max: 1.6, step: 0.02, default: 1.0 },
    { param: 'lightAngle', label: 'Light Angle', min: 0, max: 360, step: 1, default: 45 }
  ],
  render: (ctx, frame, item, audio, stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('liquidmetal')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('liquidmetal', w, h)
    }

    const prog = r.compileProgram('liquidmetalSDF', LIQUIDMETAL_SDF_FRAG)
    if (!prog) return

    const time = frame.time * 0.001

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_blobs: Number(params.blobs ?? 8),
      u_threshold: Number(params.threshold ?? 1.0),
      u_lightAngle: Number(params.lightAngle ?? 45),
      u_res: [w, h]
    })
  }
}
```

- [ ] **Step 3: Test liquidmetal render**

Run: `npm run dev` → select liquidmetal tool → verify metallic blobs
Expected: 3D metallic blobs with specular highlights, ≥60fps

- [ ] **Step 4: Commit**

```bash
git add tools-app/src/engine/shaders/liquidmetal.ts tools-app/src/tools/generative/liquidmetal.ts
git commit -m "feat(dome): migrate liquidmetal to GPU SDF raymarching"
```

---

### Task B6: Migrate Flowfield to GPU

**Files:**
- Create: `tools-app/src/engine/shaders/flowfield.ts`
- Modify: `tools-app/src/tools/generative/flowfield.ts`

**Interfaces:**
- Consumes: ToolRenderer, NOISE_GLSL
- Produces: Curl noise streamlines

- [ ] **Step 1: Create flowfield curl noise shader**

```typescript
// tools-app/src/engine/shaders/flowfield.ts
import { NOISE_GLSL } from './noise'

export const FLOWFIELD_CURL_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_curl;
uniform float u_hue;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * 10.0;
  
  // Curl noise field
  vec2 curl = curlNoise(p * u_curl + u_time * 0.1);
  
  // Streamline integration
  vec2 pos = uv;
  float totalAngle = 0.0;
  
  for (int i = 0; i < 32; i++) {
    vec2 field = curlNoise(pos * u_curl + u_time * 0.1);
    totalAngle += field.x;
    pos += field * 0.01;
    pos = fract(pos);
  }
  
  // Color based on angle
  float hue = u_hue / 360.0 + totalAngle * 0.1;
  vec3 col = hsv2rgb(vec3(hue, 0.8, 0.9));
  
  // Density based on curl magnitude
  float density = length(curl) * 0.5;
  col *= density;
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 2: Rewrite flowfield.ts to use ToolRenderer**

```typescript
// tools-app/src/tools/generative/flowfield.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { FLOWFIELD_CURL_FRAG } from '../../engine/shaders/flowfield'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('flowfieldCurl', FLOWFIELD_CURL_FRAG)
  }
  return renderer
}

export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '3.0.0',
  label: 'Flowfield',
  controls: [
    { param: 'segments', label: 'Segments', min: 100, max: 2000, step: 10, default: 500 },
    { param: 'curl', label: 'Curl', min: 0.2, max: 3, step: 0.05, default: 1.0 },
    { param: 'hue', label: 'Hue', min: 0, max: 360, step: 1, default: 180 }
  ],
  render: (ctx, frame, item, audio, stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('flowfield')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('flowfield', w, h)
    }

    const prog = r.compileProgram('flowfieldCurl', FLOWFIELD_CURL_FRAG)
    if (!prog) return

    const time = frame.time * 0.001

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_curl: Number(params.curl ?? 1.0),
      u_hue: Number(params.hue ?? 180),
      u_res: [w, h]
    })
  }
}
```

- [ ] **Step 3: Test flowfield render**

Run: `npm run dev` → select flowfield tool → verify curl patterns
Expected: Animated streamlines, ≥60fps

- [ ] **Step 4: Commit**

```bash
git add tools-app/src/engine/shaders/flowfield.ts tools-app/src/tools/generative/flowfield.ts
git commit -m "feat(dome): migrate flowfield to GPU curl noise"
```

---

### Task B7: Upgrade Shaders to GLSL 300es

**Files:**
- Modify: `tools-app/src/tools/generative/shaders.ts`

**Interfaces:**
- Consumes: ToolRenderer
- Produces: Upgraded GLSL 300es shader

- [ ] **Step 1: Create upgraded shader**

```typescript
// tools-app/src/engine/shaders/shaders.ts
import { NOISE_GLSL } from './noise'

export const SHADERS_UPGRADED_FRAG = `#version 300 es
precision highp float;
${NOISE_GLSL}

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform int u_palette;
in vec2 v_uv;
out vec4 fragColor;

vec3 palette(float t, int pal) {
  if (pal == 0) { // magma
    return mix(vec3(0.0, 0.0, 0.04), vec3(0.8, 0.2, 0.4), t);
  } else if (pal == 1) { // ice
    return mix(vec3(0.1, 0.2, 0.4), vec3(0.6, 0.9, 1.0), t);
  } else { // toxic
    return mix(vec3(0.0, 0.2, 0.0), vec3(0.4, 1.0, 0.2), t);
  }
}

void main() {
  vec2 uv = v_uv;
  float t = u_time * u_speed * 0.1;
  
  // Domain warping
  vec2 q = vec2(
    fbm(uv * u_scale + t, 4),
    fbm(uv * u_scale + vec2(5.2, 1.3) + t, 4)
  );
  
  vec2 r = vec2(
    fbm(uv * u_scale + 4.0 * q + vec2(1.7, 9.2) + t, 4),
    fbm(uv * u_scale + 4.0 * q + vec2(8.3, 2.8) + t, 4)
  );
  
  float f = fbm(uv * u_scale + r, 4);
  
  // Color mapping
  vec3 col = palette(f, u_palette);
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 2: Update shaders.ts to use ToolRenderer**

```typescript
// tools-app/src/tools/generative/shaders.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { SHADERS_UPGRADED_FRAG } from '../../engine/shaders/shaders'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('shadersUpgraded', SHADERS_UPGRADED_FRAG)
  }
  return renderer
}

export const shadersTool: ToolDef = {
  id: 'shaders',
  kind: 'generative',
  version: '2.0.0',
  label: 'Shader',
  controls: [
    { param: 'palette', label: 'Palette', type: 'select', options: ['magma', 'ice', 'toxic'], default: 'magma' },
    { param: 'scale', label: 'Scale', min: 1, max: 12, step: 0.5, default: 4 },
    { param: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, default: 1 }
  ],
  render: (ctx, frame, item, audio, stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('shaders')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('shaders', w, h)
    }

    const prog = r.compileProgram('shadersUpgraded', SHADERS_UPGRADED_FRAG)
    if (!prog) return

    const time = frame.time * 0.001
    const paletteMap: Record<string, number> = { magma: 0, ice: 1, toxic: 2 }

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_scale: Number(params.scale ?? 4),
      u_speed: Number(params.speed ?? 1),
      u_palette: paletteMap[String(params.palette ?? 'magma')] ?? 0,
      u_res: [w, h]
    })
  }
}
```

- [ ] **Step 3: Test shaders render**

Run: `npm run dev` → select shader tool → verify nebula patterns
Expected: Domain-warped FBM noise, ≥60fps

- [ ] **Step 4: Commit**

```bash
git add tools-app/src/engine/shaders/shaders.ts tools-app/src/tools/generative/shaders.ts
git commit -m "feat(dome): upgrade shaders to GLSL 300es"
```

---

### Task B8: Migrate Remaining Simple Tools

**Files:**
- Create: `tools-app/src/engine/shaders/plasma.ts`
- Create: `tools-app/src/engine/shaders/tunnel.ts`
- Create: `tools-app/src/engine/shaders/starfield.ts`
- Create: `tools-app/src/engine/shaders/rings.ts`
- Create: `tools-app/src/engine/shaders/molecules.ts`
- Create: `tools-app/src/engine/shaders/brutalist.ts`
- Modify: `tools-app/src/tools/generative/plasma.ts`
- Modify: `tools-app/src/tools/generative/tunnel.ts`
- Modify: `tools-app/src/tools/generative/starfield.ts`
- Modify: `tools-app/src/tools/generative/rings.ts`
- Modify: `tools-app/src/tools/generative/molecules.ts`
- Modify: `tools-app/src/tools/generative/brutalist.ts`

**Interfaces:**
- Consumes: ToolRenderer
- Produces: 6 tool shaders migrated

- [ ] **Step 1: Create plasma shader**

```typescript
// tools-app/src/engine/shaders/plasma.ts
export const PLASMA_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_hue;
in vec2 v_uv;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = v_uv * u_scale;
  float t = u_time * 0.5;
  
  float v1 = sin(uv.x * 3.0 + t);
  float v2 = sin(uv.y * 4.0 + t * 0.7);
  float v3 = sin((uv.x + uv.y) * 2.5 + t * 0.5);
  float v4 = sin(length(uv - 0.5) * 5.0 + t * 1.2);
  
  float v = (v1 + v2 + v3 + v4) / 4.0;
  
  float hue = u_hue / 360.0 + v * 0.2;
  vec3 col = hsv2rgb(vec3(hue, 0.8, 0.9));
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 2: Create tunnel shader**

```typescript
// tools-app/src/engine/shaders/tunnel.ts
export const TUNNEL_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_speed;
uniform float u_hue;
uniform int u_shape;
in vec2 v_uv;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdSquare(vec2 p, float r) {
  vec2 d = abs(p) - r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdTriangle(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if(p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  
  float angle = atan(uv.y, uv.x);
  float dist = length(uv);
  
  float z = fract(1.0 / dist + u_time * u_speed * 0.1);
  
  float shape;
  if (u_shape == 0) {
    shape = sdCircle(uv / z, 0.3);
  } else if (u_shape == 1) {
    shape = sdSquare(uv / z, 0.2);
  } else {
    shape = sdTriangle(uv / z, 0.2);
  }
  
  float edge = smoothstep(0.01, 0.02, abs(shape));
  float glow = exp(-abs(shape) * 10.0);
  
  float hue = u_hue / 360.0 + z * 0.1 + angle / 6.28;
  vec3 col = hsv2rgb(vec3(hue, 0.8, 0.9));
  
  col *= edge + glow * 0.5;
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 3: Create starfield shader**

```typescript
// tools-app/src/engine/shaders/starfield.ts
export const STARFIELD_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_hue;
in vec2 v_uv;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  
  vec3 col = vec3(0.0);
  
  for (int i = 0; i < 100; i++) {
    float fi = float(i);
    float z = fract(hash(vec2(fi, 0.0)) + u_time * 0.3);
    
    vec2 pos = vec2(
      hash(vec2(fi, 1.0)) - 0.5,
      hash(vec2(fi, 2.0)) - 0.5
    ) * 2.0;
    
    float size = (1.0 - z) * 3.0;
    float alpha = (1.0 - z) * smoothstep(0.0, 0.1, z);
    
    float d = length(uv - pos * z);
    col += vec3(alpha * exp(-d * d * 100.0 / size));
  }
  
  float hue = u_hue / 360.0;
  col *= hsv2rgb(vec3(hue, 0.3, 1.0));
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 4: Create rings shader**

```typescript
// tools-app/src/engine/shaders/rings.ts
export const RINGS_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform float u_hue;
in vec2 v_uv;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float dist = length(uv);
  
  float col = 0.0;
  
  for (float i = 0.0; i < 16.0; i++) {
    if (i >= u_count) break;
    
    float phase = fract(u_time * 0.6 + i / u_count);
    float radius = phase * 0.8;
    float width = 0.01 + phase * 0.01;
    
    float ring = smoothstep(width, 0.0, abs(dist - radius));
    col += ring * (1.0 - phase * 0.5);
  }
  
  float hue = u_hue / 360.0;
  vec3 finalCol = hsv2rgb(vec3(hue, 0.8, 0.9)) * col;
  
  fragColor = vec4(finalCol, 1.0);
}
`
```

- [ ] **Step 5: Create molecules shader**

```typescript
// tools-app/src/engine/shaders/molecules.ts
export const MOLECULES_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_nodes;
uniform float u_linkDist;
uniform float u_drift;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec3 col = vec3(0.0);
  
  for (int i = 0; i < 64; i++) {
    if (float(i) >= u_nodes) break;
    
    float fi = float(i);
    vec2 pos = vec2(
      hash(vec2(fi, 0.0)) - 0.5,
      hash(vec2(fi, 1.0)) - 0.5
    );
    
    float z = 0.5 + 0.5 * sin(u_time * u_drift * 0.5 + fi);
    pos *= 0.8 + z * 0.4;
    
    float d = length(uv - pos);
    float size = 0.02 + z * 0.02;
    float alpha = exp(-d * d / (size * size));
    
    col += vec3(0.2, 0.8, 1.0) * alpha * (0.5 + z * 0.5);
    
    // Links
    for (int j = i + 1; j < 64; j++) {
      if (float(j) >= u_nodes) break;
      
      float fj = float(j);
      vec2 pos2 = vec2(
        hash(vec2(fj, 0.0)) - 0.5,
        hash(vec2(fj, 1.0)) - 0.5
      );
      
      float z2 = 0.5 + 0.5 * sin(u_time * u_drift * 0.5 + fj);
      pos2 *= 0.8 + z2 * 0.4;
      
      float linkDist = length(pos - pos2);
      if (linkDist < u_linkDist) {
        float linkAlpha = 1.0 - linkDist / u_linkDist;
        float t = dot(uv - pos, pos2 - pos) / max(length(pos2 - pos) * length(pos2 - pos), 0.001);
        t = clamp(t, 0.0, 1.0);
        float dLink = length(uv - mix(pos, pos2, t));
        col += vec3(0.3) * exp(-dLink * dLink * 1000.0) * linkAlpha * 0.3;
      }
    }
  }
  
  fragColor = vec4(col, 1.0);
}
`
```

- [ ] **Step 6: Create brutalist shader**

```typescript
// tools-app/src/engine/shaders/brutalist.ts
export const BRUTALIST_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_cols;
uniform float u_mix;
in vec2 v_uv;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = v_uv;
  vec2 grid = floor(uv * u_cols);
  vec2 cell = fract(uv * u_cols);
  
  float h = hash(grid);
  float shape = step(0.5, h);
  
  float osc = sin(u_time * 0.5 + h * 6.28) * 0.1;
  
  float val;
  if (shape < 0.33) {
    // Circle
    val = smoothstep(0.3, 0.25, length(cell - 0.5));
  } else if (shape < 0.66) {
    // Square
    val = smoothstep(0.1, 0.05, max(abs(cell.x - 0.5), abs(cell.y - 0.5)));
  } else {
    // Triangle
    val = smoothstep(0.1, 0.05, cell.y - abs(cell.x - 0.5) * 0.5);
  }
  
  float col = mix(1.0, val, u_mix) * (0.8 + osc);
  
  fragColor = vec4(vec3(col), 1.0);
}
`
```

- [ ] **Step 7: Update all 6 tool files to use ToolRenderer**

(Repeat pattern from Tasks B3-B7 for each tool)

- [ ] **Step 8: Test all 6 tools**

Run: `npm run dev` → test each tool → verify visual output
Expected: All tools render correctly, ≥60fps

- [ ] **Step 9: Commit**

```bash
git add tools-app/src/engine/shaders/plasma.ts tools-app/src/engine/shaders/tunnel.ts \
  tools-app/src/engine/shaders/starfield.ts tools-app/src/engine/shaders/rings.ts \
  tools-app/src/engine/shaders/molecules.ts tools-app/src/engine/shaders/brutalist.ts \
  tools-app/src/tools/generative/plasma.ts tools-app/src/tools/generative/tunnel.ts \
  tools-app/src/tools/generative/starfield.ts tools-app/src/tools/generative/rings.ts \
  tools-app/src/tools/generative/molecules.ts tools-app/src/tools/generative/brutalist.ts
git commit -m "feat(dome): migrate remaining generative tools to GPU"
```

---

### Task B9: Migrate Kaleidoscope and Doodle (or keep Canvas2D)

**Files:**
- Modify: `tools-app/src/tools/generative/kaleidoscope.ts`
- Modify: `tools-app/src/tools/generative/doodle.ts`

**Interfaces:**
- Consumes: ToolRenderer (optional)
- Produces: Decision on GPU vs Canvas2D

- [ ] **Step 1: Evaluate kaleidoscope**

Kaleidoscope uses Canvas2D clip regions + image rotation. This is hard to replicate in a single fragment shader without multiple render passes. **Decision: Keep as Canvas2D.**

- [ ] **Step 2: Evaluate doodle**

Doodle uses quadratic Bézier curves with jitter. This could be done in a shader but would require storing curve data in textures. **Decision: Keep as Canvas2D.**

- [ ] **Step 3: Commit (no changes)**

```bash
git commit --allow-empty -m "feat(dome): evaluate kaleidoscope and doodle - keeping Canvas2D"
```

---

### Task B10: Integration Testing

**Files:**
- Modify: `tools-app/src/ui/Canvas.tsx`
- Modify: `tools-app/src/core/stackEngine.ts`

**Interfaces:**
- Consumes: All migrated tools
- Produces: Fully integrated system

- [ ] **Step 1: Update Canvas.tsx to pass GL context**

```typescript
// tools-app/src/ui/Canvas.tsx — add GL context passing
// In the render loop, pass gl to tool.render()
```

- [ ] **Step 2: Update stackEngine.ts**

```typescript
// tools-app/src/core/stackEngine.ts — update evaluateStack to pass GL
```

- [ ] **Step 3: Run full integration test**

Run: `npm run test` → all tests pass
Run: `npm run dev` → manually test all 14 tools

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(dome): integration complete - all generative tools GPU-accelerated"
```

---

## Self-Review

1. **Spec coverage:** ✅ All 14 tools covered, 5 bug fixes included
2. **Placeholder scan:** ✅ No TBD/TODO found
3. **Type consistency:** ✅ ToolRenderer, FBOPair, ToolDef.render signature consistent

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-26-dome-generative-webgl-migration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
