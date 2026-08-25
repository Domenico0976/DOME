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

  test('addTool inserts after the selected node and selects it', () => {
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
    expect(state.stack[1].uid).toBe(state.selectedUid)
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
})
