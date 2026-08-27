// tools-app/src/tools/generative/particles.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import {
  PARTICLES_CHLADNI_FRAG,
  PARTICLES_SPHERE_FRAG,
  PARTICLES_CUBE_FRAG,
  PARTICLES_FLOW_FRAG,
} from '../../engine/shaders/particles'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('particlesChladni', PARTICLES_CHLADNI_FRAG)
    renderer.compileProgram('particlesSphere', PARTICLES_SPHERE_FRAG)
    renderer.compileProgram('particlesCube', PARTICLES_CUBE_FRAG)
    renderer.compileProgram('particlesFlow', PARTICLES_FLOW_FRAG)
  }
  return renderer
}

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '3.0.0',
  label: 'Particles',
  icon: 'sparkles',
  category: 'Generative',
  defaultParams: {
    mode: 'chladni',
    a: 3, b: 2, m: 3, n: 2, freq: 1.5, density: 10, size: 3, count: 3,
    radius: 1.0, particleCount: 200, rotationSpeed: 1.0,
    gridScale: 8.0, depth: 0.5,
    speed: 1.0,
    hueShift: 0,
    opacity: 1.0,
    color: '#ffffff',
    bgColor: '#000000',
  },
  controls: [
    { param: 'mode', label: 'Mode', kind: 'select', options: ['chladni', 'sphere', 'cube', 'flow'] },
    // Chladni controls
    { param: 'a', label: 'Amp A', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'b', label: 'Amp B', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'm', label: 'Freq X', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'n', label: 'Freq Y', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'freq', label: 'Frequency', kind: 'slider', min: 0.5, max: 4, step: 0.1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 1, max: 20, step: 1 },
    { param: 'count', label: 'Modes', kind: 'slider', min: 1, max: 4, step: 1 },
    { param: 'size', label: 'Node Size', kind: 'slider', min: 1, max: 10, step: 0.5 },
    // Sphere controls
    { param: 'radius', label: 'Radius', kind: 'slider', min: 0.2, max: 2.0, step: 0.1 },
    { param: 'particleCount', label: 'Count', kind: 'slider', min: 50, max: 800, step: 10 },
    { param: 'rotationSpeed', label: 'Rot Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    // Cube controls
    { param: 'gridScale', label: 'Grid Scale', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'depth', label: 'Depth', kind: 'slider', min: 0, max: 2, step: 0.1 },
    // Flow controls
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    // Shared controls
    { param: 'hueShift', label: 'Hue Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'opacity', label: 'Opacity (%)', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'color', label: 'Particle Color', kind: 'color' },
    { param: 'bgColor', label: 'Background Color', kind: 'color' },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const mode = String(params.mode ?? 'chladni')

    let fbos = r.getFBO('particles')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('particles', w, h)
    }

    let progName: string
    let fragSrc: string
    switch (mode) {
      case 'sphere':
        progName = 'particlesSphere'
        fragSrc = PARTICLES_SPHERE_FRAG
        break
      case 'cube':
        progName = 'particlesCube'
        fragSrc = PARTICLES_CUBE_FRAG
        break
      case 'flow':
        progName = 'particlesFlow'
        fragSrc = PARTICLES_FLOW_FRAG
        break
      default:
        progName = 'particlesChladni'
        fragSrc = PARTICLES_CHLADNI_FRAG
    }

    const prog = r.compileProgram(progName, fragSrc)
    if (!prog) return

    const time = frame.timeSec

    const uniforms: Record<string, number | number[]> = {
      u_time: time,
      u_audioLevel: audio.level,
      u_res: [w, h],
      u_opacity: Number(params.opacity ?? 1.0),
      u_color: hexToRgb(String(params.color ?? '#ffffff')),
      u_hueShift: Number(params.hueShift ?? 0),
    }

    switch (mode) {
      case 'chladni':
        Object.assign(uniforms, {
          u_a: Number(params.a ?? 3),
          u_b: Number(params.b ?? 2),
          u_m: Number(params.m ?? 3),
          u_n: Number(params.n ?? 2),
          u_freq: Number(params.freq ?? 1.5),
          u_density: Number(params.density ?? 10),
          u_count: Number(params.count ?? 3),
          u_size: Number(params.size ?? 3),
        })
        break
      case 'sphere':
        Object.assign(uniforms, {
          u_radius: Number(params.radius ?? 1.0),
          u_particleCount: Number(params.particleCount ?? 200),
          u_rotationSpeed: Number(params.rotationSpeed ?? 1.0),
        })
        break
      case 'cube':
        Object.assign(uniforms, {
          u_gridScale: Number(params.gridScale ?? 8.0),
          u_particleSize: Number(params.size ?? 3),
          u_depth: Number(params.depth ?? 0.5),
        })
        break
      case 'flow':
        Object.assign(uniforms, {
          u_speed: Number(params.speed ?? 1.0),
          u_density: Number(params.density ?? 5.0),
          u_size: Number(params.size ?? 3),
        })
        break
    }

    r.renderToCanvas(prog, fbos.texA, w, h, uniforms)
  }
}
