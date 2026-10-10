// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { QuarantinePanel } from '../ui/QuarantinePanel'
import '../tools'

beforeEach(() => useProjectStore.getState().reset())
afterEach(cleanup)

describe('quarantine flow', () => {
  test('removeEffect moves matching bindings into quarantined', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const eUid = useProjectStore.getState().stack[0].effects![0].uid
    useProjectStore.getState().addAudioBinding(uid, {
      param: `${eUid}.intensity`,
      source: 'bass',
      curve: 'linear',
      amount: 1,
    })
    useProjectStore.getState().addAudioBinding(uid, {
      param: `other.param`,
      source: 'mid',
      curve: 'linear',
      amount: 1,
    })

    useProjectStore.getState().removeEffect(uid, eUid)

    const s = useProjectStore.getState()
    expect(s.quarantined).toHaveLength(1)
    expect(s.quarantined[0].effectUid).toBe(eUid)
    expect(s.quarantined[0].reason).toBe('Effect removed')
    expect(s.quarantined[0].binding.param).toBe(`${eUid}.intensity`)
    // Non-matching binding stays on the item.
    expect(s.stack[0].audio).toHaveLength(1)
    expect(s.stack[0].audio[0].param).toBe('other.param')
    // Effect removed.
    expect(s.stack[0].effects?.some((e) => e.uid === eUid)).toBe(false)
  })

  test('restoreBinding re-adds the binding when target item and effect still exist', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const eUid = useProjectStore.getState().stack[0].effects![0].uid
    // Inject a quarantine entry directly (simulating a prior orphaning that left the
    // effect in place, e.g. an undo/redo cycle), then restore it.
    useProjectStore.getState().addAudioBinding(uid, {
      param: `${eUid}.intensity`,
      source: 'bass',
      curve: 'linear',
      amount: 1,
    })
    const binding = useProjectStore.getState().stack[0].audio[0]
    useProjectStore.setState({
      quarantined: [
        {
          id: 'q_test_1',
          binding,
          fromUid: uid,
          effectUid: eUid,
          reason: 'Effect removed',
          createdAt: new Date().toISOString(),
        },
      ],
    })
    useProjectStore.getState().removeAudioBinding(uid, `${eUid}.intensity`)

    useProjectStore.getState().restoreBinding('q_test_1')

    const s = useProjectStore.getState()
    expect(s.quarantined).toHaveLength(0)
    expect(s.stack[0].audio.some((b) => b.param === `${eUid}.intensity`)).toBe(true)
  })

  test('deleteBinding drops the entry', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const eUid = useProjectStore.getState().stack[0].effects![0].uid
    useProjectStore.getState().addAudioBinding(uid, {
      param: `${eUid}.intensity`,
      source: 'bass',
      curve: 'linear',
      amount: 1,
    })
    useProjectStore.getState().removeEffect(uid, eUid)
    const qId = useProjectStore.getState().quarantined[0].id

    useProjectStore.getState().deleteBinding(qId)
    expect(useProjectStore.getState().quarantined).toHaveLength(0)
  })

  test('restore with missing target keeps entry quarantined', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const eUid = useProjectStore.getState().stack[0].effects![0].uid
    useProjectStore.getState().addAudioBinding(uid, {
      param: `${eUid}.intensity`,
      source: 'bass',
      curve: 'linear',
      amount: 1,
    })
    useProjectStore.getState().removeEffect(uid, eUid)
    const qId = useProjectStore.getState().quarantined[0].id

    // Simulate the target item being gone.
    useProjectStore.getState().removeTool(uid)
    useProjectStore.getState().restoreBinding(qId)

    // Entry must stay — never silently deleted.
    expect(useProjectStore.getState().quarantined).toHaveLength(1)
  })

  test('QuarantinePanel renders entries with Restore/Delete and empty state', () => {
    useProjectStore.getState().addTool('solidColor')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const eUid = useProjectStore.getState().stack[0].effects![0].uid
    useProjectStore.getState().addAudioBinding(uid, {
      param: `${eUid}.intensity`,
      source: 'bass',
      curve: 'linear',
      amount: 1,
    })
    useProjectStore.getState().removeEffect(uid, eUid)

    const { getByText, unmount } = render(<QuarantinePanel open={true} onClose={() => {}} />)
    expect(getByText('Quarantined items')).toBeTruthy()
    expect(getByText('Restore')).toBeTruthy()
    expect(getByText('Delete')).toBeTruthy()
    unmount()

    // Empty state when none.
    useProjectStore.getState().deleteBinding(useProjectStore.getState().quarantined[0].id)
    const { queryByText } = render(<QuarantinePanel open={true} onClose={() => {}} />)
    expect(queryByText('No quarantined items')).toBeTruthy()
  })
})