// sketch-tools — barrel + integration snippet.
// REA evidence: ev_d2e99502 (landing), ev_61df5b41 (button roles),
// tool_1922f6e1 (editor DOM #tools), main-DNPwjhJt.js static grep.
// Full reverse: STUDIO.md. Zero dependencies: every module below is standalone.

export * from './sketchTypes'
export * from './sketchAudio'
export * from './sketchElements'
export * from './sketchColumns'
export * from './sketchExport'
export * from './sketchUi'

export const SKETCH_STUDIO_EVIDENCE = {
  target: 'https://tools.sketchdesign.club/',
  editorRoute: 'https://tools.sketchdesign.club/#tools',
  bundle: '/assets/main-DNPwjhJt.js (4 474 130 byte)',
  backend: 'Supabase signed storage (qxvchqmvmt…supabase.co)',
  rendering: 'DOM/SVG stack nodes + canvas/WebGL render (no <canvas> in editor DOM)',
  audio: 'AudioContext → AnalyserNode → getByteFrequencyData → bass/mid/treble/beat/bpm',
  exportModes: ['MediaRecorder realtime', 'frame-by-frame + seekAudio'],
} as const

// --- DOME integration (paste into src/tools/index.ts) ----------------------
// import { registerTool } from '../core/registry'
// import { sketchWaveformTool } from './sketch/waveform'
// import { sketchSpectrumTool } from './sketch/spectrum'
// registerTool(sketchWaveformTool)
// registerTool(sketchSpectrumTool)
// Columns UI: map SketchRow <-> AudioBinding with sketchColumns.ts over the
// existing PresetTable; audio stays in AudioReactPanel (no duplicate panels).
