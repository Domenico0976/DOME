import { describe, expect, it } from 'vitest'
import { GraphModel } from './graph'
import { parseProject, serializeProject } from './schema'

const validFile = {
  formatVersion: 1,
  appVersion: '0.1.0',
  nodes: [
    { id: 'a', type: 'source.test', x: 10, y: 20, params: { value: 0.7 } },
    { id: 'm', type: 'map.test', params: { gain: { $patch: { from: 'a.out' } } } },
  ],
  connections: [{ id: 'c1', from: 'a.out', to: 'm.in' }],
}

describe('parseProject', () => {
  it('accepts_a_valid_v1_file', () => {
    const result = parseProject(structuredClone(validFile))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.nodes).toHaveLength(2)
      expect(result.value.connections).toHaveLength(1)
    }
  })

  it('rejects_future_formatVersion_reject_if_newer', () => {
    const future = { ...structuredClone(validFile), formatVersion: 2 }
    const result = parseProject(future)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/formatVersion/i)
  })

  it('rejects_malformed_structure', () => {
    const broken = structuredClone(validFile) as Record<string, unknown>
    delete broken['nodes']
    expect(parseProject(broken).ok).toBe(false)
  })
})

describe('serializeProject', () => {
  it('roundtrip_preserves_nodes_connections_params_and_position', () => {
    const model = new GraphModel()
    model.addNode({ id: 'a', type: 'source.test', x: 5, y: 6, params: { value: 0.7 } })
    model.addNode({
      id: 'm',
      type: 'map.test',
      params: { gain: { $patch: { from: 'a.out' } } },
    })
    model.connect('a.out', 'm.in')

    const roundtripped = parseProject(serializeProject(model, 'test'))

    expect(roundtripped.ok).toBe(true)
    if (roundtripped.ok) {
      expect(roundtripped.value.nodes[0]).toMatchObject({
        id: 'a',
        x: 5,
        y: 6,
        params: { value: 0.7 },
      })
      expect(roundtripped.value.nodes[1]?.params).toEqual({
        gain: { $patch: { from: 'a.out' } },
      })
      expect(roundtripped.value.connections[0]?.from).toBe('a.out')
      expect(roundtripped.value.connections[0]?.to).toBe('m.in')
    }
  })
})
