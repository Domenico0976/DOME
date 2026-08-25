// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { FloatingPanel } from './FloatingPanel'
import type { ToolDef } from '../core/types'

vi.mock('gsap', () => {
  return {
    gsap: {
      registerPlugin: vi.fn(),
      set: vi.fn(),
    },
  }
})

vi.mock('gsap/Draggable', () => {
  return {
    Draggable: {
      create: vi.fn(() => [{ kill: vi.fn(), disable: vi.fn(), enable: vi.fn() }]),
      get: vi.fn(() => null),
    },
  }
})

afterEach(cleanup)

const tool: ToolDef = {
  id: 'g',
  kind: 'generative',
  version: '1.0.0',
  label: 'Gen',
  icon: 'square',
  category: 'Generative',
  defaultParams: { speed: 1 },
  controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
  render() {},
}

describe('FloatingPanel', () => {
  beforeEach(() => {
    registerTool(tool)
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('g')
  })

  test('renders with item', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByText, getByTestId } = render(<FloatingPanel item={item} onClose={() => {}} />)
    expect(getByTestId('floating-panel')).toBeTruthy()
    expect(getByText('Gen')).toBeTruthy()
  })

  test('does not render when item is null', () => {
    const { container } = render(<FloatingPanel item={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  test('close button calls onClose', () => {
    const item = useProjectStore.getState().stack[0]
    const onClose = vi.fn()
    const { getByLabelText } = render(<FloatingPanel item={item} onClose={onClose} />)
    fireEvent.click(getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('panel has draggable header', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByTestId } = render(<FloatingPanel item={item} onClose={() => {}} />)
    const panel = getByTestId('floating-panel')
    const header = panel.querySelector('.cursor-move')
    expect(header).toBeTruthy()
  })
})
