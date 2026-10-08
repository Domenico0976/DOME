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
    a: 3, b: 2, m: 3, n: 2, freq: 1.5, density: 10, size: 3,
    radius: 1.0,
    sphereDensity: 400, sphereSize: 5, rotationSpeed: 1.0, organic: 0.0,
    cubeDensity: 10.0, cubeSize: 3, cubeRotationSpeed: 1.0, cubeOrganic: 0.0, cubeDepth: 0.5,
    speed: 1.0,
    flowWaves: 0.0, flowRandomize: 0.0, flowWaveSpeed: 1.0,
    flowRotation: 0.0, flowZoom: 1.0, flowDepth: 0.0,
    hueShift: 0,
    opacity: 1.0,
    color: '#ffffff',
    bgColor: '#000000',
  },
  controls: [
    { param: 'mode', label: 'Mode', kind: 'select', options: ['chladni', 'sphere', 'cube', 'flow'] },
    // Chladni controls
    { param: 'a', label: 'Amplitude A', kind: 'slider', min: 0, max: 10, step: 0.1, modes: ['chladni'] },
    { param: 'b', label: 'Amplitude B', kind: 'slider', min: 0, max: 10, step: 0.1, modes: ['chladni'] },
    { param: 'm', label: 'Freq X', kind: 'slider', min: 0, max: 20, step: 0.1, modes: ['chladni'] },
    { param: 'n', label: 'Freq Y', kind: 'slider', min: 0, max: 20, step: 0.1, modes: ['chladni'] },
    { param: 'freq', label: 'Frequency', kind: 'slider', min: 0, max: 20, step: 0.1, modes: ['chladni'] },
    { param: 'density', label: 'Density', kind: 'slider', min: 1, max: 50, step: 0.1, modes: ['chladni', 'flow'] },
    { param: 'size', label: 'Size', kind: 'slider', min: 1, max: 10, step: 0.1, modes: ['chladni', 'flow'] },
    // Sphere controls
    { param: 'radius', label: 'Radius', kind: 'slider', min: 0.2, max: 2.0, step: 0.1, modes: ['sphere'] },
    { param: 'sphereDensity', label: 'Density', kind: 'slider', min: 50, max: 800, step: 10, modes: ['sphere'] },
    { param: 'sphereSize', label: 'Size', kind: 'slider', min: 1, max: 10, step: 0.1, modes: ['sphere'] },
    { param: 'rotationSpeed', label: 'Rotation Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1, modes: ['sphere'] },
    { param: 'organic', label: 'Organic', kind: 'slider', min: 0, max: 1, step: 0.05, modes: ['sphere'] },
    // Cube controls
    { param: 'cubeDensity', label: 'Density', kind: 'slider', min: 2, max: 40, step: 0.1, modes: ['cube'] },
    { param: 'cubeSize', label: 'Size', kind: 'slider', min: 1, max: 10, step: 0.1, modes: ['cube'] },
    { param: 'cubeRotationSpeed', label: 'Rotation Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1, modes: ['cube'] },
    { param: 'cubeOrganic', label: 'Organic', kind: 'slider', min: 0, max: 1, step: 0.05, modes: ['cube'] },
    { param: 'cubeDepth', label: 'Depth', kind: 'slider', min: 0, max: 2, step: 0.1, modes: ['cube'] },
    // Flow controls
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1, modes: ['flow'] },
    { param: 'flowWaves', label: 'Waves', kind: 'slider', min: 0, max: 2, step: 0.05, modes: ['flow'] },
    { param: 'flowRandomize', label: 'Randomize', kind: 'slider', min: 0, max: 3, step: 0.1, modes: ['flow'] },
    { param: 'flowWaveSpeed', label: 'Wave Speed', kind: 'slider', min: 0, max: 3, step: 0.1, modes: ['flow'] },
    { param: 'flowRotation', label: 'Rotation', kind: 'slider', min: -3.14, max: 3.14, step: 0.05, modes: ['flow'] },
    { param: 'flowZoom', label: 'Zoom', kind: 'slider', min: 0.5, max: 5, step: 0.1, modes: ['flow'] },
    { param: 'flowDepth', label: 'Depth', kind: 'slider', min: 0, max: 2, step: 0.1, modes: ['flow'] },
    // Shared controls
    { param: 'hueShift', label: 'Hue Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'opacity', label: 'Opacity', kind: 'slider', min: 0, max: 1, step: 0.05 },
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
      u_bgColor: hexToRgb(String(params.bgColor ?? '#000000')),
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
          u_size: Number(params.size ?? 3),
        })
        break
      case 'sphere':
        Object.assign(uniforms, {
          u_radius: Number(params.radius ?? 1.0),
          u_density: Number(params.sphereDensity ?? 200),
          u_size: Number(params.sphereSize ?? 3),
          u_rotationSpeed: Number(params.rotationSpeed ?? 1.0),
          u_organic: Number(params.organic ?? 0.0),
        })
        break
      case 'cube':
        Object.assign(uniforms, {
          u_density: Number(params.cubeDensity ?? 10.0),
          u_size: Number(params.cubeSize ?? 3),
          u_rotationSpeed: Number(params.cubeRotationSpeed ?? 1.0),
          u_organic: Number(params.cubeOrganic ?? 0.0),
          u_depth: Number(params.cubeDepth ?? 0.5),
        })
        break
      case 'flow':
        Object.assign(uniforms, {
          u_speed: Number(params.speed ?? 1.0),
          u_density: Number(params.density ?? 5.0),
          u_size: Number(params.size ?? 3),
          u_waves: Number(params.flowWaves ?? 0.0),
          u_randomize: Number(params.flowRandomize ?? 0.0),
          u_waveSpeed: Number(params.flowWaveSpeed ?? 1.0),
          u_rotation: Number(params.flowRotation ?? 0.0),
          u_zoom: Number(params.flowZoom ?? 1.0),
          u_depth: Number(params.flowDepth ?? 0.0),
        })
        break
    }

    r.renderToCanvas(prog, fbos.texA, w, h, uniforms)
  }
}
