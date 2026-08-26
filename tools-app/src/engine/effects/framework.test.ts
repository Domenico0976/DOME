import { describe, test, expect } from 'vitest'
import { collectActiveEffects, EFFECT_ORDER, EFFECTS } from './index'
import type { EffectPassDef } from './index'
import type { StackItem, EffectInstance, AudioBinding } from '../../core/types'

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
    const bind = (source: NonNullable<AudioBinding['source']>, amount: number, curve: AudioBinding['curve'] = 'linear') => [{ param: 'k', source, curve, amount }]
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
  const out = adjustmentsDef.uniforms(
    { contrast: 60, exposure: 70, saturation: 50, temperature: 80, tint: 20 },
    { timeSec: 0, dt: 0, bpm: 120 },
  )
  expect(out).toEqual({ u_contrast: 60, u_exposure: 70, u_saturation: 50, u_temperature: 80, u_tint: 20 })
})

test('aberration/waves uniforms map', async () => {
  const { aberrationDef } = await import('./aberration')
  const { wavesDef } = await import('./waves')
  const f = { timeSec: 2, dt: 0, bpm: 120 }
  expect(aberrationDef.uniforms({ displace: 12, area: 60, falloff: 40 }, f)).toEqual({ u_displace: 12, u_area: 60, u_falloff: 40 })
  expect(wavesDef.uniforms({ intensity: 15, quantity: 30, organic: 20 }, f)).toEqual({ u_intensity: 15, u_quantity: 30, u_organic: 20 })
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
  expect(glowDef.uniforms({ intensity: 70 }, f)).toEqual({ u_intensity: 70 })
  expect(edgeBlurDef.uniforms({ intensity: 75, falloff: 50, x: 10, y: 20 }, f)).toEqual({
    u_intensity: 75,
    u_falloff: 50,
    u_x: 10,
    u_y: 20,
  })
})

test('lens/grain uniforms pass raw intensity for shader-side normalization', async () => {
  const { lensDef } = await import('./lens')
  const { grainDef } = await import('./grain')
  const f = { timeSec: 3, dt: 0, bpm: 120 }
  const lensOut = lensDef.uniforms({ intensity: 70, x: 50, y: 50 }, f)
  expect(lensOut.u_intensity).toBe(70)
  expect(lensOut.u_center_x).toBe(0.5)
  expect(lensOut.u_center_y).toBe(0.5)
  const on = grainDef.uniforms({ intensity: 50, motion: 1, size: 50 }, f)
  expect(on.u_intensity).toBe(50)
  expect(on.u_grainsize).toBe(50)
  expect(on.u_seed).toBe(180)
  const off = grainDef.uniforms({ intensity: 50, motion: 0, size: 50 }, f)
  expect(off.u_seed).toBe(0)
})

test('aberration shader normalizes area and falloff from percentages', async () => {
  const { aberrationDef } = await import('./aberration')
  expect(aberrationDef.fragment).toContain('u_area / 100.0')
  expect(aberrationDef.fragment).toContain('u_falloff / 100.0')
})

test('registry is exhaustive over EFFECT_ORDER', async () => {
  const { EFFECTS, EFFECT_ORDER } = await import('./index')
  for (const t of EFFECT_ORDER) expect(EFFECTS[t]).toBeDefined()
})
