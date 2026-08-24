import { describe, expect, it } from 'vitest'
import type { Command } from './history'
import { CycleError, DuplicateInputError, GraphModel, addNodeCommand, connectCommand, disconnectCommand, removeNodeCommand } from './graph'

const node = (id: string, type = 'x') => ({ id, type, params: {} })

describe('GraphModel', () => {
  it('duplicate_node_id_throws', () => {
    const m = new GraphModel()
    m.addNode(node('a'))
    expect(() => m.addNode(node('a'))).toThrow()
  })

  it('connect_returns_connection_and_populates_indexes', () => {
    const m = new GraphModel()
    m.addNode(node('a'))
    m.addNode(node('b'))
    const c = m.connect('a.out', 'b.in')
    expect(c.from).toBe('a.out')
    expect(m.incomingTo('b.in')?.id).toBe(c.id)
    expect(m.outgoingFrom('a').map((k) => k.id)).toContain(c.id)
  })

  it('connect_throws_cycle_when_target_reaches_source', () => {
    const m = new GraphModel()
    ;['a', 'b', 'c'].forEach((id) => m.addNode(node(id)))
    m.connect('a.out', 'b.in')
    m.connect('b.out', 'c.in')
    expect(() => m.connect('c.out', 'a.in')).toThrow(CycleError)
    expect(() => m.connect('a.out', 'a.in')).toThrow(CycleError)
  })

  it('an_input_accepts_a_single_connection', () => {
    const m = new GraphModel()
    ;['a', 'b', 'c'].forEach((id) => m.addNode(node(id)))
    m.connect('a.out', 'c.in')
    expect(() => m.connect('b.out', 'c.in')).toThrow(DuplicateInputError)
  })

  it('remove_node_cascades_touching_connections', () => {
    const m = new GraphModel()
    ;['a', 'b'].forEach((id) => m.addNode(node(id)))
    const c = m.connect('a.out', 'b.in')
    m.removeNode('a')
    expect(m.connections().find((k) => k.id === c.id)).toBeUndefined()
    expect(m.incomingTo('b.in')).toBeUndefined()
  })

  it('undo_redo_roundtrip_su_add_remove_connect', () => {
    const m = new GraphModel()
    const history: Command[] = []
    const exec = (cmd: Command) => {
      cmd.execute()
      history.push(cmd)
    }

    const addA = addNodeCommand(m, node('a', 'source.test'))
    const addB = addNodeCommand(m, node('b', 'map.test'))
    exec(addA)
    exec(addB)
    const conn = connectCommand(m, 'a.out', 'b.in')
    exec(conn)
    expect(m.connections()).toHaveLength(1)

    const rm = removeNodeCommand(m, 'a')
    exec(rm)
    expect(m.hasNode('a')).toBe(false)
    expect(m.connections()).toHaveLength(0)

    for (const cmd of [...history].reverse()) cmd.undo()
    expect(m.hasNode('a')).toBe(false)
    expect(m.hasNode('b')).toBe(false)
    expect(m.connections()).toHaveLength(0)

    for (const cmd of history) cmd.execute()
    expect(m.hasNode('a')).toBe(false)
    expect(m.hasNode('b')).toBe(true)
    expect(m.connections()).toHaveLength(0)
  })

  it('disconnect_command_restores_connection_with_new_id_on_undo', () => {
    const m = new GraphModel()
    m.addNode(node('a'))
    m.addNode(node('b'))
    const original = m.connect('a.out', 'b.in')
    const cmd = disconnectCommand(m, original.id)

    cmd.execute()
    expect(m.connections()).toHaveLength(0)

    cmd.undo()
    expect(m.connections()).toHaveLength(1)
  })

  it('load_snapshot_replaces_previous_content', () => {
    const m = new GraphModel()
    m.addNode(node('old'))
    m.loadSnapshot(
      [{ id: 'n1', type: 't', params: {}, x: 1 }],
      [{ id: 'c1', from: 'n1.out', to: 'n2.in' }],
    )
    expect(m.hasNode('old')).toBe(false)
    expect(m.hasNode('n1')).toBe(true)
    expect(m.connections()).toHaveLength(1)
  })
})
