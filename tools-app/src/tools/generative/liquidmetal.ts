// Liquid Metal: SDF raymarching with metallic chrome material.
// Renders animated blob fields as molten metallic reflections with fresnel highlights.
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

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const liquidMetalTool: ToolDef = {
  id: 'liquidmetal',
  kind: 'generative',
  version: '3.0.0',
  label: 'Liquid Metal',
  icon: 'gem',
  category: 'Generative',
  defaultParams: {
    blobs: 5,
    morph: 0.5,
    speed: 1,
    roughness: 0.3,
    zoom: 1,
    rotation: 0,
    color: '#c0c8d4',
  },
  controls: [
    { param: 'blobs', label: 'Blobs', kind: 'slider', min: 2, max: 8, step: 1 },
    { param: 'morph', label: 'Morph', kind: 'slider', min: 0.1, max: 1, step: 0.05 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'roughness', label: 'Roughness', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'zoom', label: 'Zoom', kind: 'slider', min: 0.5, max: 3, step: 0.1 },
    { param: 'rotation', label: 'Rotation', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'color', label: 'Metallic Tint', kind: 'color' },
  ],
  render: (_ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = _ctx.canvas.width
    const h = _ctx.canvas.height

    let fbos = r.getFBO('liquidmetal')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('liquidmetal', w, h)
    }

    const prog = r.compileProgram('liquidmetalSDF', LIQUIDMETAL_SDF_FRAG)
    if (!prog) return

    const time = frame.timeSec

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_morph: Number(params.morph ?? 0.5),
      u_blobs: Number(params.blobs ?? 5),
      u_speed: Number(params.speed ?? 1),
      u_roughness: Number(params.roughness ?? 0.3),
      u_zoom: Number(params.zoom ?? 1),
      u_rotation: (Number(params.rotation ?? 0) * Math.PI) / 180,
      u_color: hexToRgb(String(params.color ?? '#c0c8d4')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
