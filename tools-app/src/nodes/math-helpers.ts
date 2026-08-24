// Pure math helpers shared between node implementations and UI previews.
// Kept OUTSIDE the lazy node chunks so the preview can import them eagerly
// without pulling the node implementations into the main bundle.

export const LFO_MODES = { SINE: 0, SAW: 1, TRIANGLE: 2, NOISE: 3 } as const

export function lfoValue(mode: number, rateHz: number, phase: number, timeSec: number): number {
  const t = timeSec * rateHz + phase
  switch (mode) {
    case LFO_MODES.SAW:
      return ((t % 1) + 1) % 1
    case LFO_MODES.TRIANGLE: {
      const tri = ((t % 1) + 1) % 1
      return tri < 0.5 ? tri * 2 : 2 - tri * 2
    }
    case LFO_MODES.NOISE: {
      const sample = Math.floor(timeSec * (rateHz * 8))
      const hash = Math.sin(sample * 127.1 + 311.7) * 43758.5453
      return hash - Math.floor(hash)
    }
    case LFO_MODES.SINE:
    default:
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * t)
  }
}

export function mapValue(inputSignal: number, gain: number, offset: number): number {
  return Math.max(0, Math.min(1, inputSignal * gain + offset))
}
