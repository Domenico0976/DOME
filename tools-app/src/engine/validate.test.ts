import { describe, expect, it } from 'vitest'
import type { ProjectFile } from './schema'
import { defMap } from './fixtures'
import { validateAndBuild } from './validate'

const base: ProjectFile = {
  formatVersion: 1,
  appVersion: 'test',
  nodes: [
    { id: 'a', type: 'source.test', params: {} },
    { id: 'm', type: 'map.test', params: {} },
    { id: 'k', type: 'sink.test', params: {} },
  ],
  connections: [
    { id: 'c1', from: 'a.out', to: 'm.in' },
    { id: 'c2', from: 'm.out', to: 'k.in' },
  ],
}

describe('validateAndBuild', () => {
  it('valid_graph_builds_model', () => {
    const result = validateAndBuild(structuredClone(base), defMap())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.model.nodes()).toHaveLength(3)
      expect(result.model.connections()).toHaveLength(2)
    }
  })

  it('unknown_node_type_emits_issue', () => {
    const bad = structuredClone(base)
    bad.nodes.push({ id: 'g', type: 'ghost.test', params: {} })
    const result = validateAndBuild(bad, defMap())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'unknown-node-type')).toBe(true)
    }
  })

  it('endpoint_on_missing_node_emits_unknown_node', () => {
    const bad = structuredClone(base)
    bad.connections.push({ id: 'cx', from: 'nope.out', to: 'k.in' })
    const result = validateAndBuild(bad, defMap())
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'unknown-node')).toBe(true)
    }
  })

  it('missing_port_emits_unknown_port', () => {
    const bad = structuredClone(base)
    bad.connections.push({ id: 'cx', from: 'a.wrong', to: 'k.in' })
    const result = validateAndBuild(bad, defMap())
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'unknown-port')).toBe(true)
    }
  })

  it('bands_cable_to_number_input_emits_type_mismatch', () => {
    const bad = structuredClone(base)
    bad.connections.push({ id: 'cx', from: 'a.bands', to: 'k.in' })
    const result = validateAndBuild(bad, defMap())
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'type-mismatch')).toBe(true)
    }
  })

  it('double_cable_on_same_input_emits_duplicate_input', () => {
    const bad = structuredClone(base)
    bad.connections.push({ id: 'cx', from: 'a.out', to: 'k.in' })
    const result = validateAndBuild(bad, defMap())
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'duplicate-input')).toBe(true)
    }
  })

  it('collects_multiple_issues_without_stopping_at_first', () => {
    const bad: ProjectFile = {
      formatVersion: 1,
      appVersion: 'test',
      nodes: [{ id: 'a', type: 'source.test', params: {} }, { id: 'g', type: 'ghost.test', params: {} }],
      connections: [{ id: 'c1', from: 'a.bands', to: 'k.in' }],
    }
    const result = validateAndBuild(bad, defMap())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(2)
  })
})
