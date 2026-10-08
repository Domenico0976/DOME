// tools-app/src/tools/generative/shaders.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { SHADERS_FRAG } from '../../engine/shaders/shaders'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('shaders', SHADERS_FRAG)
  }
  return renderer
}

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const shadersTool: ToolDef = {
  id: 'shaders',
  kind: 'generative',
  version: '3.0.0',
  label: 'Shaders',
  icon: 'aperture',
  category: 'Generative',
  defaultParams: { noiseScale: 4, warp: 1, complexity: 4, speed: 1, preset: 0, color: '#8b5cf6' },
  controls: [
    { param: 'preset', label: 'Motion', kind: 'select', options: ['turbulence', 'wind', 'pulse', 'spiral', 'breathe'] },
    { param: 'noiseScale', label: 'Scale', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'warp', label: 'Warp', kind: 'slider', min: 0, max: 5, step: 0.1 },
    { param: 'complexity', label: 'Complexity', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('shaders')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('shaders', w, h)
    }

    const prog = r.compileProgram('shaders', SHADERS_FRAG)
    if (!prog) return

    const time = frame.timeSec
    const presetNames = ['turbulence', 'wind', 'pulse', 'spiral', 'breathe']
    const presetIndex = presetNames.indexOf(String(params.preset ?? 'turbulence'))
    const preset = presetIndex >= 0 ? presetIndex : 0

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_noiseScale: Number(params.noiseScale ?? 4),
      u_warp: Number(params.warp ?? 1),
      u_complexity: Number(params.complexity ?? 4),
      u_speed: Number(params.speed ?? 1),
      u_preset: preset,
      u_color: hexToRgb(String(params.color ?? '#8b5cf6')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
