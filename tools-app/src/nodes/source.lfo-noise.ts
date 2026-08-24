import type { NodeDef } from '../engine/types'
import type { RegistryEntry } from '../engine/engine'
import { LFO_MODES, lfoValue } from './math-helpers'

export const NOISE_STEP_DEFAULT = 0.08

export function nextNoise(previous: number, stepSize: number): number {
  const next = previous + (Math.random() - 0.5) * 2 * stepSize
  return Math.min(1, Math.max(0, next))
}

const DEF: NodeDef = {
  type: 'source.lfo-noise',
  label: 'Wobble',
  inputs: [],
  outputs: [{ name: 'out', type: 'number', defaultValue: 0.5 }],
}

export const entry: RegistryEntry = (() => {
  let previousNoise = 0.5

  return {
    def: DEF,
    create: () => ({
      compute: (_inputs, params, frame) => {
        const mode = typeof params['mode'] === 'number' ? params['mode'] : LFO_MODES.SINE
        const rateHz = typeof params['rateHz'] === 'number' ? params['rateHz'] : 1
        const phase = typeof params['phase'] === 'number' ? params['phase'] : 0

        let out: number
        if (mode === LFO_MODES.NOISE) {
          previousNoise = nextNoise(previousNoise, NOISE_STEP_DEFAULT)
          out = previousNoise
        } else {
          out = lfoValue(mode, rateHz, phase, frame.timeSec)
        }
        return { out }
      },
    }),
  }
})()
