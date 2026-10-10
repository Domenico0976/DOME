import { describe, test, expect, beforeEach } from 'vitest'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { useProjectStore } from './projectStore'
import { migrateProject, SCHEMA_VERSION } from '../core/schema'

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

beforeEach(() => {
  registerTool(demo)
  useProjectStore.getState().reset()
})

describe('setComponent', () => {
  test('updates a single item component fields immutably', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.setComponent(uid, { opacity: 0.5, blendMode: 'screen' })
    const item = useProjectStore.getState().stack[0]
    expect(item.component!.opacity).toBe(0.5)
    expect(item.component!.blendMode).toBe('screen')
    expect(item.component!.hidden).toBe(false)
    expect(item.component!.scope).toBe('self')
  })

  test('defaults scope to self on new items', () => {
    useProjectStore.getState().addTool('demo')
    const item = useProjectStore.getState().stack[0]
    expect(item.component!.scope).toBe('self')
    expect(item.component!.opacity).toBe(1)
    expect(item.component!.blendMode).toBe('source-over')
    expect(item.component!.hidden).toBe(false)
  })
})

describe('applyComponentToRange', () => {
  function setup4() {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    s.addTool('demo')
    s.addTool('demo')
    return useProjectStore.getState().stack.map((i) => i.uid)
  }

  test('scope=self updates only the target item', () => {
    const uids = setup4()
    useProjectStore.getState().applyComponentToRange(uids[2], { opacity: 0.3 }, 'self')
    const stack = useProjectStore.getState().stack
    expect(stack[0].component!.opacity).toBe(1)
    expect(stack[1].component!.opacity).toBe(1)
    expect(stack[2].component!.opacity).toBe(0.3)
    expect(stack[3].component!.opacity).toBe(1)
  })

  test('scope=above updates indices 0..idx inclusive', () => {
    const uids = setup4()
    useProjectStore.getState().applyComponentToRange(uids[2], { hidden: true }, 'above')
    const stack = useProjectStore.getState().stack
    expect(stack[0].component!.hidden).toBe(true)
    expect(stack[1].component!.hidden).toBe(true)
    expect(stack[2].component!.hidden).toBe(true)
    expect(stack[3].component!.hidden).toBe(false)
  })

  test('scope=below updates indices idx..end inclusive', () => {
    const uids = setup4()
    useProjectStore.getState().applyComponentToRange(uids[1], { blendMode: 'multiply' }, 'below')
    const stack = useProjectStore.getState().stack
    expect(stack[0].component!.blendMode).toBe('source-over')
    expect(stack[1].component!.blendMode).toBe('multiply')
    expect(stack[2].component!.blendMode).toBe('multiply')
    expect(stack[3].component!.blendMode).toBe('multiply')
  })

  test('returns no-op for unknown uid', () => {
    setup4()
    const before = useProjectStore.getState().stack
    useProjectStore.getState().applyComponentToRange('nonexistent', { opacity: 0 }, 'self')
    const after = useProjectStore.getState().stack
    expect(after).toBe(before)
  })
})

describe('undo compatibility', () => {
  test('undo restores prior component values', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    s.setComponent(uid, { opacity: 0.2 })
    expect(useProjectStore.getState().stack[0].component!.opacity).toBe(0.2)
    s.undo()
    expect(useProjectStore.getState().stack[0].component!.opacity).toBe(1)
  })

  test('undo after applyComponentToRange restores all affected items', () => {
    const s = useProjectStore.getState()
    s.addTool('demo')
    s.addTool('demo')
    s.addTool('demo')
    const uids = useProjectStore.getState().stack.map((i) => i.uid)
    s.applyComponentToRange(uids[1], { opacity: 0.4 }, 'above')
    expect(useProjectStore.getState().stack[0].component!.opacity).toBe(0.4)
    expect(useProjectStore.getState().stack[1].component!.opacity).toBe(0.4)
    expect(useProjectStore.getState().stack[2].component!.opacity).toBe(1)
    s.undo()
    expect(useProjectStore.getState().stack[0].component!.opacity).toBe(1)
    expect(useProjectStore.getState().stack[1].component!.opacity).toBe(1)
    expect(useProjectStore.getState().stack[2].component!.opacity).toBe(1)
  })
})

describe('migration from legacy loose fields', () => {
  test('legacy item without component gets derived group from loose fields', () => {
    const legacy = {
      schemaVersion: 2,
      stack: [
        {
          uid: 'leg1',
          toolId: 'demo',
          toolVersion: '1.0.0',
          params: {},
          audio: [],
          automations: [],
          hidden: true,
          blendMode: 'screen',
          opacity: 0.6,
        },
      ],
    }
    const p = migrateProject(legacy)
    expect(p.schemaVersion).toBe(SCHEMA_VERSION)
    expect(p.stack[0].component!.opacity).toBe(0.6)
    expect(p.stack[0].component!.blendMode).toBe('screen')
    expect(p.stack[0].component!.hidden).toBe(true)
    expect(p.stack[0].component!.scope).toBe('self')
    // Loose fields preserved for UI backward compat
    expect(p.stack[0].opacity).toBe(0.6)
    expect(p.stack[0].blendMode).toBe('screen')
    expect(p.stack[0].hidden).toBe(true)
  })

  test('legacy item with no loose fields gets safe defaults', () => {
    const legacy = {
      schemaVersion: 1,
      stack: [
        {
          uid: 'leg2',
          toolId: 'demo',
          toolVersion: '1.0.0',
          params: {},
          audio: [],
          automations: [],
          hidden: false,
        },
      ],
    }
    const p = migrateProject(legacy)
    expect(p.stack[0].component!.opacity).toBe(1)
    expect(p.stack[0].component!.blendMode).toBe('source-over')
    expect(p.stack[0].component!.hidden).toBe(false)
    expect(p.stack[0].component!.scope).toBe('self')
  })

  test('item with existing component group preserves it through migration', () => {
    const withComponent = {
      schemaVersion: 3,
      stack: [
        {
          uid: 'c1',
          toolId: 'demo',
          toolVersion: '1.0.0',
          params: {},
          audio: [],
          automations: [],
          hidden: false,
          component: { opacity: 0.8, blendMode: 'multiply', hidden: true, scope: 'above' },
        },
      ],
    }
    const p = migrateProject(withComponent)
    expect(p.stack[0].component!.opacity).toBe(0.8)
    expect(p.stack[0].component!.blendMode).toBe('multiply')
    expect(p.stack[0].component!.hidden).toBe(true)
    expect(p.stack[0].component!.scope).toBe('above')
  })

  test('setComponent mirrors group into loose renderer fields', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().setComponent(uid, { opacity: 0.4, blendMode: 'multiply' })
    const item = useProjectStore.getState().stack[0]
    expect(item.component!.opacity).toBe(0.4)
    expect(item.opacity).toBe(0.4)
    expect(item.component!.blendMode).toBe('multiply')
    expect(item.blendMode).toBe('multiply')
  })

  test('updateParam and toggleSwitch mirror loose fields into the group', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('demo')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().updateParam(uid, '_opacity', 0.25)
    expect(useProjectStore.getState().stack[0].component!.opacity).toBe(0.25)
    useProjectStore.getState().updateParam(uid, '_blendMode', 'screen')
    expect(useProjectStore.getState().stack[0].component!.blendMode).toBe('screen')
    useProjectStore.getState().toggleSwitch(uid)
    const item = useProjectStore.getState().stack[0]
    expect(item.hidden).toBe(true)
    expect(item.component!.hidden).toBe(true)
  })

  test('applyComponentToRange mirrors group into loose fields on every target', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('demo')
    useProjectStore.getState().addTool('demo')
    useProjectStore.getState().addTool('demo')
    const uids = useProjectStore.getState().stack.map((i) => i.uid)
    useProjectStore.getState().applyComponentToRange(uids[1], { opacity: 0.5 }, 'below')
    const st = useProjectStore.getState().stack
    expect(st[0].opacity ?? 1).toBe(1)
    expect(st[1].opacity).toBe(0.5)
    expect(st[1].component!.opacity).toBe(0.5)
    expect(st[2].opacity).toBe(0.5)
    expect(st[2].component!.opacity).toBe(0.5)
  })
})
