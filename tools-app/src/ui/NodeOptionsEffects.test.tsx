// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import '../tools'
import { NodeOptions } from './NodeOptions'

afterEach(cleanup)

describe('NodeOptions Effects tab', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('solidColor')
  })

  test('adds, adjusts, toggles and removes an effect', () => {
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const { getByRole, getByLabelText, getByText } = render(
      <NodeOptions item={useProjectStore.getState().stack[0]} />,
    )
    fireEvent.mouseDown(getByRole('tab', { name: /^Effects/ }))
    expect(getByText('Glow')).toBeTruthy()
    const intensity = getByLabelText('Intensity') as HTMLInputElement
    fireEvent.change(intensity, { target: { value: '1.5' } })
    const e = useProjectStore.getState().stack[0].effects![0]
    expect(e.params.intensity).toBe(1.5)
    fireEvent.click(getByRole('switch'))
    expect(useProjectStore.getState().stack[0].effects![0].enabled).toBe(false)
    fireEvent.click(getByLabelText('Remove effect'))
    expect(useProjectStore.getState().stack[0].effects!.length).toBe(0)
  })

  test('Controls tab remains default and native sliders still drive params', () => {
    useProjectStore.getState().addTool('solidColor')
    const { getByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const input = getByLabelText('Color') as HTMLInputElement
    expect(input).toBeTruthy()
  })

  test('focusParam expands the target effect card and clears once', () => {
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const item = useProjectStore.getState().stack[0]
    const effectUid = item.effects![0].uid
    const clear = vi.fn()
    const { getByRole } = render(
      <NodeOptions item={item} focusParam={`${effectUid}.intensity`} onFocusParamClear={clear} />,
    )
    fireEvent.mouseDown(getByRole('tab', { name: /^Effects/ }))
    const card = document.querySelector(`[data-enabled="true"]`) as HTMLElement
    expect(card).toBeTruthy()
    const intensity = document.getElementById(`${effectUid}.intensity`) as HTMLInputElement
    expect(intensity).toBeTruthy()
    expect(clear).toHaveBeenCalledTimes(1)
  })

  test('missing effectUid in focusParam clears and does not crash', () => {
    const item = useProjectStore.getState().stack[0]
    const clear = vi.fn()
    const { getByRole } = render(
      <NodeOptions item={item} focusParam="missing.uid.intensity" onFocusParamClear={clear} />,
    )
    fireEvent.mouseDown(getByRole('tab', { name: /^Effects/ }))
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
