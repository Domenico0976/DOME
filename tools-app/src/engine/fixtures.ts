import type { NodeDef, PortAddress } from './types'
import { BANDS_LENGTH } from './types'

export interface Counting {
  calls: number
}

export const DEF_SOURCE: NodeDef = {
  type: 'source.test',
  label: 'Sorgente',
  inputs: [],
  outputs: [
    { name: 'out', type: 'number', defaultValue: 0 },
    { name: 'bands', type: 'bands', defaultValue: { data: new Float32Array(BANDS_LENGTH) } },
  ],
}

export const DEF_MAP: NodeDef = {
  type: 'map.test',
  label: 'Map',
  inputs: [{ name: 'in', type: 'number', defaultValue: 0 }],
  outputs: [{ name: 'out', type: 'number', defaultValue: 0 }],
}

export const DEF_SINK: NodeDef = {
  type: 'sink.test',
  label: 'Sink',
  inputs: [{ name: 'in', type: 'number', defaultValue: 0 }],
  outputs: [],
}

export const DEF_NOTREADY: NodeDef = {
  type: 'notready.test',
  label: 'NotReady',
  inputs: [],
  outputs: [{ name: 'out', type: 'number', defaultValue: 0.42 }],
}

export const ALL_DEFS: readonly NodeDef[] = [DEF_SOURCE, DEF_MAP, DEF_SINK, DEF_NOTREADY]

export const defMap = (): Map<string, NodeDef> =>
  new Map(ALL_DEFS.map((d) => [d.type, d]))

const num = (v: unknown): number => (typeof v === 'number' ? v : 0)

export function countingRegistry(options?: { ready?: boolean }): {
  registry: Map<string, import('./engine').RegistryEntry>
  counts: Record<string, Counting>
} {
  const counts: Record<string, Counting> = {}
  const count = (key: string): Counting => (counts[key] ??= { calls: 0 })

  const registry = new Map<string, import('./engine').RegistryEntry>()

  registry.set('source.test', {
    def: DEF_SOURCE,
    create: () => ({
      compute: (_inputs, params) => {
        count('source.test').calls += 1
        const bands = new Float32Array(BANDS_LENGTH)
        return { out: num(params['value']) || 0.5, bands: { data: bands } }
      },
    }),
  })

  registry.set('map.test', {
    def: DEF_MAP,
    create: () => ({
      compute: (inputs, params) => {
        count('map.test').calls += 1
        const gain = num(params['gain']) || 1
        return { out: gain * num(inputs['in']) }
      },
    }),
  })

  registry.set('sink.test', {
    def: DEF_SINK,
    create: () => ({
      compute: (inputs) => {
        count('sink.test').calls += 1
        void num(inputs['in'])
        return {}
      },
    }),
  })

  registry.set('notready.test', {
    def: DEF_NOTREADY,
    create: () => ({
      compute: () => {
        throw new Error('compute non deve girare se non ready')
      },
      ready: () => options?.ready ?? false,
    }),
  })

  return { registry, counts }
}

export const addr = (nodeId: string, port: string): PortAddress => `${nodeId}.${port}`

