// tools-app/src/tools/generative/flowfield.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { FLOWFIELD_ADVECT_FRAG, FLOWFIELD_ACCUM_FRAG } from '../../engine/shaders/flowfield'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('flowfieldAdvect', FLOWFIELD_ADVECT_FRAG)
    renderer.compileProgram('flowfieldAccum', FLOWFIELD_ACCUM_FRAG)
  }
  return renderer
}

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '4.0.0',
  label: 'Flowfield',
  icon: 'waves',
  category: 'Generative',
  controls: [
    { param: 'scale', label: 'Scale', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'viscosity', label: 'Viscosity', kind: 'slider', min: 0.1, max: 2, step: 0.1 },
    { param: 'particles', label: 'Particles', kind: 'slider', min: 32, max: 256, step: 16 },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  defaultParams: { scale: 8, speed: 1, viscosity: 0.5, particles: 128, color: '#0a0a0a' },
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let accumFbos = r.getFBO('flowfieldAccum')
    let posFbos = r.getFBO('flowfieldPos')

    if (!accumFbos || !posFbos) {
      // accumulation: RGBA8, ping-pong for fade+blend
      accumFbos = r.createFBO('flowfieldAccum', w, h)
      // positions: float textures for sub-pixel precision
      const gl2 = gl
      const createFloatTex = (): WebGLTexture => {
        const tex = gl2.createTexture()!
        gl2.bindTexture(gl2.TEXTURE_2D, tex)
        gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.RGBA, w, h, 0, gl2.RGBA, gl2.FLOAT, null)
        gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST)
        gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST)
        gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE)
        gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE)
        return tex
      }
      const createFloatFBO = (tex: WebGLTexture): WebGLFramebuffer => {
        const fbo = gl2.createFramebuffer()!
        gl2.bindFramebuffer(gl2.FRAMEBUFFER, fbo)
        gl2.framebufferTexture2D(gl2.FRAMEBUFFER, gl2.COLOR_ATTACHMENT0, gl2.TEXTURE_2D, tex, 0)
        return fbo
      }
      const pTexA = createFloatTex()
      const pTexB = createFloatTex()
      const pFboA = createFloatFBO(pTexA)
      const pFboB = createFloatFBO(pTexB)
      posFbos = { texA: pTexA, texB: pTexB, fboA: pFboA, fboB: pFboB }
      r['fbos'].set('flowfieldPos', posFbos)
    }

    const numParticles = Math.round(Number(params.particles ?? 128))
    const viscosity = Number(params.viscosity ?? 0.5)
    const baseColor = hexToRgb(String(params.color ?? '#0a0a0a'))
    const speed = Number(params.speed ?? 1)
    const scale = Number(params.scale ?? 8)
    const time = frame.timeSec

    // Step 1: Advect particle positions using curl noise
    const advectProg = r.compileProgram('flowfieldAdvect', FLOWFIELD_ADVECT_FRAG)
    if (!advectProg) return

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    r.renderToTexture(advectProg, posFbos.texA, posFbos.fboB, w, h, {
      u_time: time,
      u_res: [w, h],
      u_scale: scale,
      u_speed: speed * (1 + audio.level * 0.6),
      u_particles: numParticles,
    })

    // Step 2: Accumulate — fade previous trails and draw new particles
    const accumProg = r.compileProgram('flowfieldAccum', FLOWFIELD_ACCUM_FRAG)
    if (!accumProg) return

    r.renderToTexture(accumProg, accumFbos.texA, accumFbos.fboB, w, h, {
      u_prev: accumFbos.texA,
      u_particles: posFbos.texB,
      u_color: baseColor,
      u_viscosity: viscosity,
      u_res: [w, h],
    })

    // Step 3: Blit to canvas
    r.renderToCanvas(accumProg, accumFbos.texB, w, h, {
      u_color: baseColor,
      u_viscosity: viscosity,
      u_res: [w, h],
    })
  }
}
