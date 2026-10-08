import type { AudioFrame, Frame } from '../core/types'
import { VERT_SRC, buildUniforms } from './effects'
import type { ActivePass } from './effects'

export type ShaderGenOpts = { scale: number; speed: number; palette: number; timeSec: number }

const COPY_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
void main() { gl_FragColor = texture2D(u_tex, v_uv); }`

// GPU-native generator surface for the "Shaders" tool (spec §6): animated fbm nebula pre-pass.
const SHADER_GEN_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform float u_speed;
uniform float u_palette;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
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

export type Compositor = {
  apply(
    source: HTMLCanvasElement,
    passes: ActivePass[],
    frame: Frame,
    audio: AudioFrame,
    opts?: { shaderGen?: ShaderGenOpts },
  ): void
  resize(w: number, h: number): void
}

// Builds a pass-chain renderer over the given canvas' webgl2 context.
// Returns null when WebGL2 is unavailable or unusable (caller falls back to CPU/direct draw).
export function createCompositor(canvas: HTMLCanvasElement): Compositor | null {
  let ctx: WebGL2RenderingContext | null = null
  try {
    ctx = canvas.getContext('webgl2', { alpha: false, preserveDrawingBuffer: true })
  } catch {
    ctx = null
  }
  if (!ctx || typeof ctx.createShader !== 'function') return null
  const gl = ctx

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const pairs: Pair[] = [
    { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
    { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
  ]
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

  function renderInto(
    target: Pair | null,
    readTex: WebGLTexture,
    key: string,
    frag: string,
    uniforms: Record<string, number | number[]>,
    timeSec: number,
  ) {
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
        renderInto(
          pairs[nxt],
          pairs[cur].tex,
          'shadersgen',
          SHADER_GEN_FRAG,
          { u_scale: opts.shaderGen.scale, u_palette: opts.shaderGen.palette },
          opts.shaderGen.timeSec * opts.shaderGen.speed,
        )
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
