import type { NodeDef } from '../engine/types'
import type { RegistryEntry } from '../engine/engine'
import type { Signal } from '../engine/types'
import { mapValue } from './math-helpers'

const num = (value: Signal | undefined): number => (typeof value === 'number' ? value : 0)

const DEF: NodeDef = {
  type: 'map.gain-offset',
  label: 'Gain Offset',
  inputs: [{ name: 'in', type: 'number', defaultValue: 0 }],
  outputs: [{ name: 'out', type: 'number', defaultValue: 0 }],
}

export const entry: RegistryEntry = {
  def: DEF,
  create: () => ({
    compute: (inputs, params) => {
      const gain = typeof params['gain'] === 'number' ? params['gain'] : 1
      const offset = typeof params['offset'] === 'number' ? params['offset'] : 0
      return { out: mapValue(num(inputs['in']), gain, offset) }
    },
  }),
}
