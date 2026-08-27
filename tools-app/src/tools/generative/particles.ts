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
    handleX: 0.0, handleY: 0.0,
    vibration: 0.0, vibrationArea: 1.0,
    radius: 1.0,
    sphereDensity: 200, sphereSize: 3, rotationSpeed: 1.0, organic: 0.0,
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
    { param: 'a', label: 'Amp A', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'b', label: 'Amp B', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'm', label: 'Freq X', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'n', label: 'Freq Y', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'freq', label: 'Frequency', kind: 'slider', min: 0.5, max: 4, step: 0.1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 1, max: 20, step: 1 },
    { param: 'count', label: 'Modes', kind: 'slider', min: 1, max: 4, step: 1 },
    { param: 'size', label: 'Node Size', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'handleX', label: 'Handle X', kind: 'slider', min: -1, max: 1, step: 0.01 },
    { param: 'handleY', label: 'Handle Y', kind: 'slider', min: -1, max: 1, step: 0.01 },
    { param: 'vibration', label: 'Vibration', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'vibrationArea', label: 'Vibration Area', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    // Sphere controls
    { param: 'radius', label: 'Radius', kind: 'slider', min: 0.2, max: 2.0, step: 0.1 },
    { param: 'sphereDensity', label: 'Density', kind: 'slider', min: 50, max: 800, step: 10 },
    { param: 'sphereSize', label: 'Size', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'rotationSpeed', label: 'Rot Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'organic', label: 'Organic', kind: 'slider', min: 0, max: 1, step: 0.05 },
    // Cube controls
    { param: 'cubeDensity', label: 'Grid Density', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'cubeSize', label: 'Size', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'cubeRotationSpeed', label: 'Rot Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'cubeOrganic', label: 'Organic', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'cubeDepth', label: 'Depth', kind: 'slider', min: 0, max: 2, step: 0.1 },
    // Flow controls
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'flowWaves', label: 'Waves', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'flowRandomize', label: 'Randomize', kind: 'slider', min: 0, max: 3, step: 0.1 },
    { param: 'flowWaveSpeed', label: 'Wave Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
    { param: 'flowRotation', label: 'Rotation', kind: 'slider', min: -3.14, max: 3.14, step: 0.05 },
    { param: 'flowZoom', label: 'Zoom', kind: 'slider', min: 0.5, max: 5, step: 0.1 },
    { param: 'flowDepth', label: 'Depth', kind: 'slider', min: 0, max: 2, step: 0.1 },
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
          u_count: Number(params.count ?? 3),
          u_size: Number(params.size ?? 3),
          u_handleX: Number(params.handleX ?? 0.0),
          u_handleY: Number(params.handleY ?? 0.0),
          u_vibration: Number(params.vibration ?? 0.0),
          u_vibrationArea: Number(params.vibrationArea ?? 1.0),
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
