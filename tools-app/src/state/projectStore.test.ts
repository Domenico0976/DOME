import { describe, test, expect, beforeEach } from 'vitest'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { useProjectStore } from './projectStore'

const demo: ToolDef = {
  id: 'demo',
  kind: 'generative',
  version: '1.0.0',
  label: 'Demo',
  icon: '',
  category: 'Generative',
  defaultParams: { speed: 1 },
  controls: [],
  render: () => {},
}

const demo2: ToolDef = {
  id: 'demo2',
  kind: 'generative',
  version: '1.0.0',
  label: 'Demo Two',
  icon: '',
  category: 'Generative',
  defaultParams: { speed: 5 },
  controls: [],
  render: () => {},
}

describe('projectStore', () => {
  beforeEach(() => {
    registerTool(demo)
    registerTool(demo2)
    useProjectStore.getState().reset()
  })

  test('addTool inserts before the selected node and selects it', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    let state = useProjectStore.getState()
    expect(state.stack).toHaveLength(2)
    const firstUid = state.stack[0].uid
    state.selectTool(firstUid)
    state.addTool('demo')
    state = useProjectStore.getState()
    expect(state.stack).toHaveLength(3)
    expect(state.stack[0].uid).toBe(state.selectedUid)
  })

  test('removeTool deletes and clears selection', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.selectTool(uid)
    s.removeTool(uid)
    const state = useProjectStore.getState()
    expect(state.stack).toHaveLength(0)
    expect(state.selectedUid).toBeNull()
  })

  test('toggleSwitch flips hidden', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.toggleSwitch(uid)
    expect(useProjectStore.getState().stack[0].hidden).toBe(true)
  })

  test('switchTool replaces tool keeping uid and position', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.switchTool(uid, 'demo2')
    const item = useProjectStore.getState().stack[0]
    expect(item.uid).toBe(uid)
    expect(item.toolId).toBe('demo2')
    expect(item.params.speed).toBe(5)
  })

  test('addAudioBinding keeps different params and replaces same param', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.addAudioBinding(uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    s.addAudioBinding(uid, { param: 'density', source: 'mid', curve: 'linear', amount: 0.5 })
    expect(useProjectStore.getState().stack[0].audio).toHaveLength(2)
    s.addAudioBinding(uid, { param: 'speed', source: 'mid', curve: 'linear', amount: 0.5 })
    const audio = useProjectStore.getState().stack[0].audio
    expect(audio).toHaveLength(2)
    expect(audio.find((b) => b.param === 'speed')).toMatchObject({ source: 'mid', amount: 0.5 })
  })

  test('setBindingMuted toggles mute ids idempotently', () => {
    const s = useProjectStore.getState()
    s.setBindingMuted('u1-speed', true)
    s.setBindingMuted('u1-speed', true)
    expect(useProjectStore.getState().audio.disabledAudioBindings).toEqual(['u1-speed'])
    s.setBindingMuted('u1-speed', false)
    expect(useProjectStore.getState().audio.disabledAudioBindings).toEqual([])
  })

  test('moveTool reorders within the stack', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    const state = useProjectStore.getState()
    const first = state.stack[0].uid
    const second = state.stack[1].uid
    s.moveTool(first, 'down')
    const after = useProjectStore.getState().stack
    expect(after[0].uid).toBe(second)
    expect(after[1].uid).toBe(first)
  })

  test('moveToolTo moves a node to an arbitrary index', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    s.addTool('demo')
    const ids = useProjectStore.getState().stack.map((i) => i.uid)
    s.moveToolTo(ids[0], 2)
    const after = useProjectStore.getState().stack.map((i) => i.uid)
    expect(after[2]).toBe(ids[0])
    expect(useProjectStore.getState().unsaved).toBe(true)
  })

  test('moveToolTo clamps out-of-range indexes and ignores no-ops', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    const ids = useProjectStore.getState().stack.map((i) => i.uid)
    s.moveToolTo(ids[0], 99)
    expect(useProjectStore.getState().stack[1].uid).toBe(ids[0])
    s.moveToolTo('missing', 0)
    expect(useProjectStore.getState().stack).toHaveLength(2)
    const before = useProjectStore.getState().stack.map((i) => i.uid)
    s.moveToolTo(before[0], 0)
    expect(useProjectStore.getState().stack.map((i) => i.uid)).toEqual(before)
  })

  test('updateParam writes into the node params', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.updateParam(uid, 'speed', 3)
    expect(useProjectStore.getState().stack[0].params.speed).toBe(3)
  })

  test('loadProject migrates and clears unsaved flag', () => {
    useProjectStore.getState().loadProject({ stack: [], canvas: { aspect: '9:16', quality: 'low' } })
    const state = useProjectStore.getState()
    expect(state.canvas.aspect).toBe('9:16')
    expect(state.unsaved).toBe(false)
  })

  test('reset clears undo/redo history', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.reset()
    const state = useProjectStore.getState()
    expect(state.stack).toHaveLength(0)
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
  })

  test('loadProject clears undo/redo history', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.loadProject({ stack: [] })
    const state = useProjectStore.getState()
    expect(state.past).toHaveLength(0)
    expect(state.future).toHaveLength(0)
  })

  test('undo after add clears selectedUid when the node is removed', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.undo()
    const state = useProjectStore.getState()
    expect(state.stack).toHaveLength(0)
    expect(state.selectedUid).toBeNull()
  })

  test('setBpm clamps high values to 300', () => {
    const s = useProjectStore.getState()
    s.setBpm(999)
    expect(useProjectStore.getState().timeline.bpm).toBe(300)
  })

  test('setBpm clamps low values to 20', () => {
    const s = useProjectStore.getState()
    s.setBpm(5)
    expect(useProjectStore.getState().timeline.bpm).toBe(20)
  })

  test('setBpm falls back to 120 for NaN', () => {
    const s = useProjectStore.getState()
    s.setBpm(NaN)
    expect(useProjectStore.getState().timeline.bpm).toBe(120)
  })

  test('setBpm passes through in-range values', () => {
    const s = useProjectStore.getState()
    s.setBpm(115)
    expect(useProjectStore.getState().timeline.bpm).toBe(115)
  })
})
