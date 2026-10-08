// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { FloatingStack } from './FloatingStack'
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
      create: vi.fn(() => [{ kill: vi.fn() }]),
      get: vi.fn(() => null),
    },
  }
})

afterEach(cleanup)

const gen: ToolDef = {
  id: 'g',
  kind: 'generative',
  version: '1.0.0',
  label: 'Gen',
  icon: 'square',
  category: 'Generative',
  defaultParams: {},
  controls: [],
  render() {},
}

describe('FloatingStack', () => {
  beforeEach(() => {
    registerTool(gen)
    useProjectStore.getState().reset()
  })

  test('renders with stack items', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { getAllByText } = render(<FloatingStack />)
    expect(getAllByText('Gen').length).toBe(2)
  })

  test('selected item is highlighted', () => {
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const selected = container.querySelector('.border-primary')
    expect(selected).toBeTruthy()
  })

  test('clicking item selects it', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const items = container.querySelectorAll('.group')
    expect(items.length).toBe(2)
    fireEvent.click(items[1])
    const stack = useProjectStore.getState().stack
    expect(useProjectStore.getState().selectedUid).toBe(stack[1].uid)
  })
})
