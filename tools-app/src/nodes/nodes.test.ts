import { describe, expect, it } from 'vitest'
import { GraphModel } from '../engine/graph'
import type { RegistryEntry } from '../engine/engine'
import { GraphEngine } from '../engine/engine'
import { BANDS_LENGTH } from '../engine/types'
import { NODE_METADATA, loadRegistryEntry } from './index'
import { LFO_MODES, lfoValue } from './math-helpers'
import { nextNoise } from './source.lfo-noise'
import { mapValue } from './math-helpers'
import { CODEC_ERROR_MESSAGE, createAudioFileTransport, type MediaElementLike } from './input.audio-file'

describe('lfoValue', () => {
  it('sine_known_points_phase_zero', () => {
    expect(lfoValue(LFO_MODES.SINE, 1, 0, 0)).toBeCloseTo(0.5, 6)
    expect(lfoValue(LFO_MODES.SINE, 1, 0, 0.25)).toBeCloseTo(1, 6)
    expect(lfoValue(LFO_MODES.SINE, 1, 0, 0.75)).toBeCloseTo(0, 6)
  })

  it('saw_fraction_of_scaled_time', () => {
    expect(lfoValue(LFO_MODES.SAW, 2, 0, 0)).toBeCloseTo(0, 6)
    expect(lfoValue(LFO_MODES.SAW, 2, 0, 0.125)).toBeCloseTo(0.25, 6)
    expect(lfoValue(LFO_MODES.SAW, 2, 0, 0.25)).toBeCloseTo(0.5, 6)
  })

  it('all_modes_stay_within_0_1_on_sample_grid', () => {
    const modes = [LFO_MODES.SINE, LFO_MODES.SAW, LFO_MODES.TRIANGLE]
    for (const mode of modes) {
      for (const rate of [1, 7]) {
        for (let t = 0; t <= 1; t += 0.05) {
          const value = lfoValue(mode, rate, 0.3, t)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('nextNoise', () => {
  it('bounded_random_walk_that_actually_moves', () => {
    let value = 0.5
    const seen = new Set<number>()
    for (let i = 0; i < 200; i += 1) {
      value = nextNoise(value, 0.08)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
      seen.add(Math.round(value * 100))
    }
    expect(seen.size).toBeGreaterThan(5)
  })
})

describe('mapValue', () => {
  it('passthrough_gain_1_offset_0', () => {
    expect(mapValue(0.4, 1, 0)).toBeCloseTo(0.4, 6)
  })

  it('clamps_upper_and_lower_to_0_1', () => {
    expect(mapValue(2, 1, 0)).toBe(1)
    expect(mapValue(-1, 1, 0)).toBe(0)
    expect(mapValue(1, 2, -0.9)).toBe(1)
  })
})

class FakeElement implements MediaElementLike {
  loop = false
  private readonly listeners: (() => void)[] = []

  constructor(private readonly playResult: 'ok' | 'reject' = 'ok') {}

  play(): Promise<void> {
    if (this.playResult === 'reject') return Promise.reject(new Error('NotSupportedError'))
    return Promise.resolve()
  }

  pause(): void {}

  addEventListener(_type: 'ended', listener: () => void): void {
    this.listeners.push(listener)
  }

  removeEventListener(_type: 'ended', listener: () => void): void {
    const index = this.listeners.indexOf(listener)
    if (index >= 0) this.listeners.splice(index, 1)
  }

  emitEnded(): void {
    for (const listener of this.listeners) listener()
  }
}

describe('createAudioFileTransport', () => {
  it('auto_loop_on_by_default_and_toggleable', () => {
    const element = new FakeElement()
    const { transport } = createAudioFileTransport(element)

    expect(transport.isAutoLoopOn()).toBe(true)
    transport.setAutoLoop(false)
    expect(transport.isAutoLoopOn()).toBe(false)
    expect(element.loop).toBe(false)
  })

  it('play_ok_no_errors_and_ended_updates_state', () => {
    const element = new FakeElement('ok')
    const errors: string[] = []
    const { transport } = createAudioFileTransport(element, (message) => errors.push(message))

    transport.play()
    element.emitEnded()

    expect(errors).toHaveLength(0)
    expect(transport.isEnded()).toBe(true)
  })

  it('rejected_play_maps_codec_error_with_named_message', async () => {
    const element = new FakeElement('reject')
    const errors: string[] = []
    const { transport } = createAudioFileTransport(element, (message) => errors.push(message))

    transport.play()
    await Promise.resolve()
    await Promise.resolve()

    expect(errors).toEqual([CODEC_ERROR_MESSAGE])
  })
})

describe('registry', () => {
  it('every_metadata_has_loader_matching_def_with_finite_defaults', async () => {
    expect(NODE_METADATA.length).toBeGreaterThanOrEqual(4)
    for (const meta of NODE_METADATA) {
      const entry: RegistryEntry = await loadRegistryEntry(meta.type)
      expect(entry.def.type).toBe(meta.type)
      for (const port of [...entry.def.inputs, ...entry.def.outputs]) {
        if (typeof port.defaultValue === 'number') {
          expect(Number.isFinite(port.defaultValue)).toBe(true)
        } else {
          expect(port.defaultValue.data.length).toBe(BANDS_LENGTH)
        }
      }
    }
  })
})

describe('integration_without_audio', () => {
  it('lfo_saw_drives_map_output_varies_over_time', async () => {
    const model: GraphModel = new GraphModel()
    model.addNode({ id: 'l', type: 'source.lfo-noise', params: { mode: LFO_MODES.SAW, rateHz: 2, phase: 0 } })
    model.addNode({ id: 'm', type: 'map.gain-offset', params: {} })
    model.connect('l.out', 'm.in')

    const registryReal = new Map<string, RegistryEntry>()
    registryReal.set('source.lfo-noise', await loadRegistryEntry('source.lfo-noise'))
    registryReal.set('map.gain-offset', await loadRegistryEntry('map.gain-offset'))

    const engine = new GraphEngine(model, registryReal, { sinks: ['m'] })
    const samples: number[] = []
    for (const timeSec of [0, 0.125, 0.25]) {
      engine.tick(timeSec)
      samples.push(engine.outputOf('m', 'out') as number)
    }
    expect(samples[0]).toBeCloseTo(0, 6)
    expect(samples[1]).toBeCloseTo(0.25, 6)
    expect(samples[2]).toBeCloseTo(0.5, 6)
    expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true)
  })
})
