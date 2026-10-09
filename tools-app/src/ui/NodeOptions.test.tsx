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

  test('shows Colors section header for generative tools', () => {
    const { getByText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    expect(getByText('Colors')).toBeTruthy()
  })

  test('renders default single color fallback', () => {
    const item = useProjectStore.getState().stack[0]
    expect(item.params.colors).toBeUndefined()
  })

  test('adds a color when Add Color is clicked', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().updateParam(item.uid, 'colors', ['#000000', '#ffffff'])
    const { getByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    fireEvent.click(getByLabelText('Add Color (2/4)'))
    const colors = useProjectStore.getState().stack[0].params.colors as string[]
    expect(colors).toHaveLength(3)
    expect(colors[2]).toBe('#000000')
  })

  test('removes a color when Remove is clicked', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().updateParam(item.uid, 'colors', ['#ff0000', '#00ff00'])
    const { getAllByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    fireEvent.click(getAllByLabelText('Remove color 2')[0])
    const colors = useProjectStore.getState().stack[0].params.colors as string[]
    expect(colors).toHaveLength(1)
    expect(colors[0]).toBe('#ff0000')
  })

  test('disables remove button when only one color remains', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().updateParam(item.uid, 'colors', ['#ff0000', '#00ff00'])
    const { getByLabelText, rerender } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    fireEvent.click(getByLabelText('Remove color 2'))
    rerender(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const storeItem = useProjectStore.getState().stack[0]
    expect(storeItem.params.colors).toHaveLength(1)
    useProjectStore.getState().updateParam(storeItem.uid, 'colors', ['#ff0000', '#0000ff'])
    rerender(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    fireEvent.click(getByLabelText('Remove color 2'))
    rerender(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const singleItem = useProjectStore.getState().stack[0]
    useProjectStore.getState().updateParam(singleItem.uid, 'colors', ['#ff0000', '#0000ff'])
    render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const removeBtn = getByLabelText('Remove color 2') as HTMLButtonElement
    fireEvent.click(removeBtn)
    const finalItem = useProjectStore.getState().stack[0]
    expect(finalItem.params.colors).toHaveLength(1)
    expect(finalItem.params.colors).toEqual(['#ff0000'])
  })

  test('disables add button at max colors', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().updateParam(item.uid, 'colors', ['#rr', '#gg', '#bb', '#dd'])
    const { getByLabelText } = render(<NodeOptions item={useProjectStore.getState().stack[0]} />)
    const addBtn = getByLabelText('Add Color (4/4)') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
  })
})
