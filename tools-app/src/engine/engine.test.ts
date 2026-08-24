import { describe, expect, it } from 'vitest'
import { GraphEngine } from './engine'
import { GraphModel } from './graph'
import { countingRegistry } from './fixtures'

function build(wire: (m: GraphModel) => void, sinks?: readonly string[]): {
  model: GraphModel
  counts: ReturnType<typeof countingRegistry>['counts']
  engine: GraphEngine
} {
  const model = new GraphModel()
  wire(model)
  const { registry, counts } = countingRegistry()
  const engine = new GraphEngine(model, registry, sinks ? { sinks } : undefined)
  return { model, counts, engine }
}

describe('GraphEngine', () => {
  it('memoizes_one_evaluation_per_tick_even_with_multiple_sinks', () => {
    const { counts, engine } = build((m) => {
      ['a', 'b', 'c', 'c2'].forEach((id) =>
        m.addNode({
          id,
          type: id.startsWith('c') ? 'sink.test' : id === 'b' ? 'map.test' : 'source.test',
          params: {},
        }),
      )
      m.connect('a.out', 'b.in')
      m.connect('b.out', 'c.in')
      m.connect('b.out', 'c2.in')
    })

    engine.tick(0)
    engine.tick(0.016)
    engine.tick(0.032)

    expect(counts['source.test']?.calls).toBe(3)
    expect(counts['map.test']?.calls).toBe(3)
    expect(counts['sink.test']?.calls).toBe(6)
  })

  it('prunes_disconnected_subtree_never_evaluated', () => {
    const { counts, engine } = build((m) => {
      ['a', 'b', 'c', 'd'].forEach((id) =>
        m.addNode({
          id,
          type: id === 'b' ? 'map.test' : id === 'c' ? 'sink.test' : 'source.test',
          params: {},
        }),
      )
      m.connect('a.out', 'b.in')
      m.connect('b.out', 'c.in')
    })

    engine.tick(0)
    engine.tick(0.016)

    expect(counts['source.test']?.calls).toBe(2)
  })

  it('not_ready_node_emits_defaultValue_and_skips_compute', () => {
    const { engine } = build((m) => {
      ['n', 'm', 'k'].forEach((id) =>
        m.addNode({
          id,
          type: id === 'n' ? 'notready.test' : id === 'm' ? 'map.test' : 'sink.test',
          params: {},
        }),
      )
      m.connect('n.out', 'm.in')
      m.connect('m.out', 'k.in')
    })

    engine.tick(0)

    expect(engine.outputOf('n', 'out')).toBe(0.42)
    expect(engine.outputOf('m', 'out')).toBe(0.42)
  })

  it('patched_param_receives_source_port_value', () => {
    const { engine } = build((m) => {
      m.addNode({ id: 'a', type: 'source.test', params: { value: 0.8 } })
      m.addNode({ id: 'm', type: 'map.test', params: { gain: { $patch: { from: 'a.out' } } } })
      m.addNode({ id: 'k', type: 'sink.test', params: {} })
      m.connect('a.out', 'm.in')
      m.connect('m.out', 'k.in')
    })

    engine.tick(0)

    expect(engine.outputOf('m', 'out')).toBeCloseTo(0.64, 6)
  })

  it('unconnected_input_uses_port_defaultValue', () => {
    const { engine } = build((m) => {
      m.addNode({ id: 'm', type: 'map.test', params: {} })
    }, ['m'])

    engine.tick(0)

    expect(engine.outputOf('m', 'out')).toBe(0)
  })
})
