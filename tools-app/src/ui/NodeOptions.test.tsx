// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { NodeOptions, BLEND_MODES } from './NodeOptions'
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
    const input = getByLabelText(/^Speed/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    expect(useProjectStore.getState().stack[0].params.speed).toBe(5)
  })

  test('blend mode select updates the item blendMode', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const select = getByLabelText(/^Blend mode/) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'multiply' } })
    expect(useProjectStore.getState().stack[0].blendMode).toBe('multiply')
  })

  test('opacity slider updates the item opacity', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const input = getByLabelText(/^Opacity/) as HTMLInputElement
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

  test('renders default single color fallback', () => {
    const item = useProjectStore.getState().stack[0]
    expect(item.params.colors).toBeUndefined()
  })

  test('BLEND_MODES Plus darker no longer duplicates Normal', () => {
    const plusDarker = BLEND_MODES.find((m) => m.label === 'Plus darker')
    expect(plusDarker?.value).toBe('multiply')
    expect(BLEND_MODES.filter((m) => m.value === 'source-over')).toHaveLength(1)
  })

  test('renders a dedicated Component section above the tabs', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByText, container } = render(<NodeOptions item={item} />)
    expect(getByText('Component')).toBeTruthy()
    const componentHeader = getByText('Component').closest('div')
    const controlsTab = container.querySelector('[role="tab"]')
    expect(componentHeader).toBeTruthy()
    expect(controlsTab).toBeTruthy()
  })

  test('scope segmented control writes component.scope via setComponent', () => {
    const item = useProjectStore.getState().stack[0]
    const { getAllByRole } = render(<NodeOptions item={item} />)
    const radios = getAllByRole('radio') as HTMLButtonElement[]
    expect(radios.length).toBe(3)
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    expect(radios[1].getAttribute('aria-checked')).toBe('false')
    expect(radios[2].getAttribute('aria-checked')).toBe('false')
    fireEvent.click(radios[1])
    expect(useProjectStore.getState().stack[0].component!.scope).toBe('above')
    fireEvent.click(radios[2])
    expect(useProjectStore.getState().stack[0].component!.scope).toBe('below')
    fireEvent.click(radios[0])
    expect(useProjectStore.getState().stack[0].component!.scope).toBe('self')
  })

  test('opacity slider still updates the item opacity (component section)', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const input = getByLabelText(/^Opacity/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '0.42' } })
    expect(useProjectStore.getState().stack[0].opacity).toBe(0.42)
  })

  test('blend mode select still updates the item blendMode (component section)', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByLabelText } = render(<NodeOptions item={item} />)
    const select = getByLabelText(/^Blend mode/) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'screen' } })
    expect(useProjectStore.getState().stack[0].blendMode).toBe('screen')
  })

  test('header shows tool icon + label + Elemento · #N di M subtitle', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByText } = render(<NodeOptions item={item} />)
    expect(getByText('Gen')).toBeTruthy()
    expect(getByText('Elemento · #0 di 1')).toBeTruthy()
  })

  test('subtitle shows correct index/total after adding a second tool', () => {
    const item = useProjectStore.getState().stack[0]
    useProjectStore.getState().addTool('g')
    const { getByText } = render(<NodeOptions item={item} />)
    expect(getByText('Elemento · #1 di 2')).toBeTruthy()
  })

  test('subtitle updates per selected element when stack is reordered', () => {
    const s = useProjectStore.getState()
    s.addTool('g')
    const first = s.stack[0]
    // move first to the back (down) so it becomes index 1 of 2
    s.moveTool(first.uid, 'down')
    const { getByText } = render(<NodeOptions item={first} />)
    expect(getByText('Elemento · #1 di 2')).toBeTruthy()
  })
})
