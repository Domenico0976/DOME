// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { NodeOptions } from './NodeOptions'
import type { ToolDef } from '../core/types'

afterEach(cleanup)

const tool: ToolDef = {
  id: 'g',
  kind: 'generative',
  version: '1.0.0',
  label: 'Gen',
  icon: '◆',
  category: 'Generative',
  defaultParams: { speed: 1, mode: 'a', color: '#000000' },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 },
    { param: 'mode', label: 'Mode', kind: 'select', options: ['a', 'b'] },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  render() {},
}

describe('NodeOptions', () => {
  beforeEach(() => {
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('g')
  })

  test('updates param from slider', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const input = getByLabelText('Speed') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    expect(useProjectStore.getState().stack[0].params.speed).toBe(5)
  })

  test('binds an audio source for a param', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    fireEvent.click(getByLabelText('Bind audio for speed'))
    const audio = useProjectStore.getState().stack[0].audio
    expect(audio.length).toBe(1)
    expect(audio[0].param).toBe('speed')
  })

  test('removes an audio binding', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().addAudioBinding(item.uid, { param: 'speed', source: 'bass', curve: 'linear', amount: 1 })
    const { getByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    fireEvent.click(getByLabelText('Remove audio binding speed'))
    expect(useProjectStore.getState().stack[0].audio.length).toBe(0)
  })

  test('blend mode select updates the item blendMode', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const select = getByLabelText('Blend mode') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'multiply' } })
    expect(useProjectStore.getState().stack[0].blendMode).toBe('multiply')
  })

  test('opacity slider updates the item opacity', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const input = getByLabelText('Opacity') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.5' } })
    expect(useProjectStore.getState().stack[0].opacity).toBe(0.5)
  })

  test('renders automation entries with keyframe count', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().addAutomation(item.uid, {
      param: 'speed',
      keyframes: [{ timeSec: 0, value: 1, easing: 'linear' }],
    })
    const { getByText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    expect(getByText('1 keys')).toBeTruthy()
  })
})
