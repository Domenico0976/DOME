import { describe, test, expect } from 'vitest'
import { collectActiveEffects, EFFECT_ORDER, EFFECTS } from './index'
import type { EffectPassDef } from './index'
import type { StackItem, EffectInstance } from '../../core/types'

const stubDef = (type: EffectInstance['type']): EffectPassDef => ({
  type,
  label: type,
  defaultParams: {},
  controls: [],
  fragment: '',
  uniforms: () => ({}),
})
for (const t of EFFECT_ORDER) if (!EFFECTS[t]) EFFECTS[t] = stubDef(t)

function item(over: Partial<StackItem>): StackItem {
  return { uid: 'i1', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false, ...over }
}
const eff = (type: EffectInstance['type'], enabled = true): EffectInstance => ({ uid: `e_${type}`, type, enabled, params: {} })

describe('effects framework', () => {
  test('orders passes by canonical EFFECT_ORDER, not insertion', () => {
    const stack = [item({ effects: [eff('waves'), eff('aberration')] }), item({ uid: 'i2', effects: [eff('adjustments')] })]
    expect(collectActiveEffects(stack).map((p) => p.type)).toEqual(['adjustments', 'aberration', 'waves'])
  })

  test('skips disabled instances and hidden items', () => {
    const stack = [item({ hidden: true, effects: [eff('glow')] }), item({ effects: [eff('lens', false), eff('grain')] })]
    expect(collectActiveEffects(stack).map((p) => p.type)).toEqual(['grain'])
  })

  test('collects audio bindings scoped by "<effectUid>.<param>"', () => {
    const stack = [
      item({
        audio: [{ param: 'e_glow.intensity', source: 'bass', curve: 'linear', amount: 2 }],
        effects: [eff('glow')],
      }),
    ]
    const pass = collectActiveEffects(stack)[0]
    expect(pass.bindings.length).toBe(1)
  })

  test('resolveEffectValue: linear, invert, bpm', async () => {
    const m = await import('./index')
    const frame = { timeSec: 0, dt: 0, bpm: 240 }
    const audio = { bass: 0.5, mid: 0, treble: 0, level: 1, spectrum: new Float32Array(0), bpm: 240 }
    const bind = (source: any, amount: number, curve: any = 'linear') => [{ param: 'k', source, curve, amount }]
    expect(m.resolveEffectValue(1, bind('bass', 2), 'k', frame, audio)).toBe(2)
    expect(m.resolveEffectValue(1, bind('bass', 2, 'invert'), 'k', frame, audio)).toBe(0)
    expect(m.resolveEffectValue(1, bind('bpm', 1), 'k', frame, audio)).toBe(2)
  })

  test('EFFECT_ORDER canonical sequence', () => {
    expect(EFFECT_ORDER).toEqual(['adjustments', 'aberration', 'glow', 'waves', 'edgeblur', 'lens', 'grain'])
  })
})

test('adjustments uniforms map resolved params', async () => {
  const { adjustmentsDef } = await import('./adjustments')
  const out = adjustmentsDef.uniforms({ brightness: 10, contrast: 20, saturation: 0.5 }, { timeSec: 0, dt: 0, bpm: 120 })
  expect(out).toEqual({ u_brightness: 10, u_contrast: 20, u_saturation: 0.5 })
})

test('aberration/waves uniforms map', async () => {
  const { aberrationDef } = await import('./aberration')
  const { wavesDef } = await import('./waves')
  const f = { timeSec: 2, dt: 0, bpm: 120 }
  expect(aberrationDef.uniforms({ displace: 12, frequency: 0.05 }, f)).toEqual({ u_displace: 12, u_frequency: 0.05 })
  expect(wavesDef.uniforms({ intensity: 15, quantity: 0.08, speed: 1 }, f)).toEqual({ u_intensity: 15, u_quantity: 0.08, u_speed: 1 })
})

test('EFFECT_ORDER heads registered so far stay ordered', async () => {
  const { EFFECTS, EFFECT_ORDER } = await import('./index')
  for (const t of ['adjustments', 'aberration', 'waves'] as const) expect(EFFECTS[t]).toBeDefined()
  expect(EFFECT_ORDER[0]).toBe('adjustments')
})

test('glow/edgeblur uniforms map', async () => {
  const { glowDef } = await import('./glow')
  const { edgeBlurDef } = await import('./edgeblur')
  const f = { timeSec: 0, dt: 0, bpm: 120 }
  expect(glowDef.uniforms({ intensity: 0.7, threshold: 0.5, radius: 8 }, f)).toEqual({ u_intensity: 0.7, u_threshold: 0.5, u_radius: 8 })
  expect(edgeBlurDef.uniforms({ area: 0.4, falloff: 0.3 }, f)).toEqual({ u_area: 0.4, u_falloff: 0.3 })
})
