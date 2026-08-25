import type { AudioBinding, AudioFrame, ControlDef, EffectType, Frame, StackItem } from '../../core/types'
import { adjustmentsDef } from './adjustments'

// Shared vertex shader for every effect pass: fullscreen quad with pass-through UVs.
export const VERT_SRC =
  'attribute vec2 a_pos; varying vec2 v_uv; void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }'

export type EffectPassDef = {
  type: EffectType
  label: string
  defaultParams: Record<string, number>
  controls: ControlDef[]
  fragment: string
  uniforms(p: Record<string, number>, frame: Frame): Record<string, number | number[]>
}

// Canonical fixed pipeline order (spec §4/§5).
export const EFFECT_ORDER: EffectType[] = ['adjustments', 'aberration', 'glow', 'waves', 'edgeblur', 'lens', 'grain']

// Populated incrementally by each effect module; exhaustive from Task "lens + grain" onward.
export const EFFECTS: Partial<Record<EffectType, EffectPassDef>> = {}
Object.assign(EFFECTS, { adjustments: adjustmentsDef })

export type ActivePass = {
  uid: string
  type: EffectType
  params: Record<string, number>
  bindings: AudioBinding[]
  def: EffectPassDef
}

// Collect enabled effect instances across the stack, grouped by canonical order,
// merging defaults with instance params and scoping bindings by "<effectUid>.<param>".
export function collectActiveEffects(stack: StackItem[]): ActivePass[] {
  const out: ActivePass[] = []
  for (const type of EFFECT_ORDER) {
    for (const item of stack) {
      if (item.hidden) continue
      for (const e of item.effects ?? []) {
        if (!e.enabled || e.type !== type) continue
        const def = EFFECTS[e.type]
        if (!def) continue
        out.push({
          uid: e.uid,
          type,
          params: { ...def.defaultParams, ...e.params },
          bindings: item.audio.filter((b) => b.param.startsWith(`${e.uid}.`)),
          def,
        })
      }
    }
  }
  return out
}

// base + source * amount, inverted when curve === 'invert'.
// Sources: bass/mid/treble/level read the band, spectrum averages bins, bpm normalizes around 120 BPM.
export function resolveEffectValue(base: number, bindings: AudioBinding[], key: string, frame: Frame, audio: AudioFrame): number {
  const b = bindings.find((x) => x.param === key)
  if (!b) return base
  let src: number
  if (b.source === 'bpm') src = frame.bpm / 120 - 1
  else if (b.source === 'spectrum') {
    src = audio.spectrum.length ? Array.from(audio.spectrum).reduce((a, v) => a + v, 0) / audio.spectrum.length : 0
  } else src = audio[b.source]
  return base + src * b.amount * (b.curve === 'invert' ? -1 : 1)
}

// Resolve every slider control through its scoped binding (if any), then map to shader uniforms.
export function buildUniforms(pass: ActivePass, frame: Frame, audio: AudioFrame): Record<string, number | number[]> {
  const resolved: Record<string, number> = {}
  for (const c of pass.def.controls) {
    if (c.kind !== 'slider') continue
    resolved[c.param] = resolveEffectValue(
      pass.params[c.param] ?? pass.def.defaultParams[c.param],
      pass.bindings,
      `${pass.uid}.${c.param}`,
      frame,
      audio,
    )
  }
  return pass.def.uniforms(resolved, frame)
}
