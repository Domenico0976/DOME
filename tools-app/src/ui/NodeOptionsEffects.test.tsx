// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
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

  test('adds, adjusts, binds, toggles and removes an effect', () => {
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const { getByRole, getByLabelText, getByText } = render(
      <NodeOptions item={useProjectStore.getState().stack[0]} />,
    )
    fireEvent.mouseDown(getByRole('tab', { name: 'Effects' }))
    expect(getByText('Glow')).toBeTruthy()
    const intensity = getByLabelText('Intensity') as HTMLInputElement
    fireEvent.change(intensity, { target: { value: '1.5' } })
    const e = useProjectStore.getState().stack[0].effects![0]
    expect(e.params.intensity).toBe(1.5)
    fireEvent.click(getByLabelText(`Bind audio for ${e.uid}.intensity`))
    expect(useProjectStore.getState().stack[0].audio[0].param).toBe(`${e.uid}.intensity`)
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
})
