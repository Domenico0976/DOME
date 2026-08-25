import { describe, test, expect, beforeEach } from 'vitest'
import { useProjectStore } from './projectStore'
import '../tools'

beforeEach(() => useProjectStore.getState().reset())

describe('effect store actions', () => {
  test('add / setParam / toggle / remove lifecycle', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    const s = useProjectStore.getState()
    s.addEffect(uid, 'glow')
    let item = useProjectStore.getState().stack[0]
    expect(item.effects?.length).toBe(1)
    expect(item.effects?.[0].enabled).toBe(true)
    expect(item.effects?.[0].params).toEqual({})
    const eUid = item.effects![0].uid
    s.setEffectParam(uid, eUid, 'intensity', 1.5)
    expect(useProjectStore.getState().stack[0].effects![0].params.intensity).toBe(1.5)
    s.addEffect(uid, 'grain')
    expect(useProjectStore.getState().stack[0].effects!.length).toBe(2)
    s.toggleEffect(uid, eUid)
    expect(useProjectStore.getState().stack[0].effects!.find((e) => e.uid === eUid)?.enabled).toBe(false)
    s.removeEffect(uid, eUid)
    expect(useProjectStore.getState().stack[0].effects!.some((e) => e.uid === eUid)).toBe(false)
  })
})
