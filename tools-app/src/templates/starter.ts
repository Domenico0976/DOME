import type { ProjectFile } from '../engine/schema'

export const STARTER_PROJECT: ProjectFile = {
  formatVersion: 1,
  appVersion: '0.1.0',
  nodes: [
    { id: 'sound', type: 'input.audio-file', x: 40, y: 60, params: {} },
    { id: 'reader', type: 'analyser.audio', x: 340, y: 60, params: {} },
    { id: 'wobble', type: 'source.lfo-noise', x: 40, y: 280, params: { mode: 1, rateHz: 2, phase: 0 } },
    { id: 'reaction', type: 'map.gain-offset', x: 340, y: 320, params: { gain: 2, offset: 0 } },
    { id: 'canvas', type: 'render.canvas', x: 660, y: 160, params: { mode: 0 } },
  ],
  connections: [
    { id: 'sc1', from: 'wobble.out', to: 'reaction.in' },
    { id: 'sc2', from: 'reaction.out', to: 'canvas.level' },
    { id: 'sc3', from: 'reader.spectrum', to: 'canvas.spectrum' },
    { id: 'sc4', from: 'reader.level', to: 'canvas.treble' },
  ],
}
