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

  test('has grip handle for drag', () => {
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const gripHandles = container.querySelectorAll('[aria-label="Drag to reorder"]')
    expect(gripHandles.length).toBe(1)
  })

  test('keyboard arrow buttons available for reorder', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const arrowButtons = container.querySelectorAll('[aria-label="Move up"], [aria-label="Move down"]')
    expect(arrowButtons.length).toBe(4)  // 2 items * 2 buttons each
  })

  test('ArrowDown moves node down in store', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const stackBefore = useProjectStore.getState().stack
    const firstUid = stackBefore[0].uid
    const secondUid = stackBefore[1].uid

    const downButtons = container.querySelectorAll('[aria-label="Move down"]')
    expect(downButtons.length).toBe(2)
    // first node has a working down button
    fireEvent.click(downButtons[0])

    const stackAfter = useProjectStore.getState().stack
    expect(stackAfter[0].uid).toBe(secondUid)
    expect(stackAfter[1].uid).toBe(firstUid)
  })

  test('ArrowUp moves node up in store', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const stackBefore = useProjectStore.getState().stack
    const firstUid = stackBefore[0].uid
    const secondUid = stackBefore[1].uid

    const upButtons = container.querySelectorAll('[aria-label="Move up"]')
    expect(upButtons.length).toBe(2)
    // second node has a working up button
    fireEvent.click(upButtons[1])

    const stackAfter = useProjectStore.getState().stack
    expect(stackAfter[0].uid).toBe(secondUid)
    expect(stackAfter[1].uid).toBe(firstUid)
  })

  test('ArrowUp on first node is a no-op', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const stackBefore = useProjectStore.getState().stack
    const upButtons = container.querySelectorAll('[aria-label="Move up"]')
    fireEvent.click(upButtons[0])
    const stackAfter = useProjectStore.getState().stack
    expect(stackAfter).toEqual(stackBefore)
  })

  test('ArrowDown on last node is a no-op', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const stackBefore = useProjectStore.getState().stack
    const downButtons = container.querySelectorAll('[aria-label="Move down"]')
    fireEvent.click(downButtons[1])
    const stackAfter = useProjectStore.getState().stack
    expect(stackAfter).toEqual(stackBefore)
  })

  test('focus stays on the moved node after reorder', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const stackBefore = useProjectStore.getState().stack
    const movedUid = stackBefore[0].uid

    const downButtons = container.querySelectorAll('[aria-label="Move down"]')
    fireEvent.click(downButtons[0])

    const stackAfter = useProjectStore.getState().stack
    // node moved from index 0 to index 1; selection follows the uid
    expect(stackAfter[1].uid).toBe(movedUid)
    expect(useProjectStore.getState().selectedUid).toBe(movedUid)
  })

  test('badges render with correct counts', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const store = useProjectStore.getState()
    const item = store.stack[0]
    store.addEffect(item.uid, 'glow')
    store.addAudioBinding(item.uid, { param: 'transform.scaleX', source: 'bass', curve: 'linear', amount: 0.5 })

    const { container, getByTestId } = render(<FloatingStack />)
    const badges = container.querySelectorAll('[class*="rounded-full"]')
    expect(badges.length).toBeGreaterThanOrEqual(3)

    const indexBadge = Array.from(badges).find((b) => b.textContent?.includes('#0'))
    expect(indexBadge).toBeTruthy()

    const audioBadge = getByTestId('audio-badge')
    expect(audioBadge).toBeTruthy()
    expect(audioBadge.textContent).toContain('1')

    const effectsBadge = getByTestId('effects-badge')
    expect(effectsBadge).toBeTruthy()
    expect(effectsBadge.textContent).toContain('1')
  })

  test('hidden badge variant replaces inline (hidden) text', () => {
    useProjectStore.getState().addTool('g')
    const { uid } = useProjectStore.getState().stack[0]
    useProjectStore.getState().toggleSwitch(uid)
    const { container } = render(<FloatingStack />)
    const hiddenSpans = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent?.includes('(hidden)'),
    )
    expect(hiddenSpans.length).toBe(0)
    const warningBadge = container.querySelector('[class*="bg-warning"]')
    expect(warningBadge).toBeTruthy()
    expect(warningBadge!.textContent).toContain('Hidden')
  })

  test('cluster is visible without hover', () => {
    useProjectStore.getState().addTool('g')
    const { container } = render(<FloatingStack />)
    const cluster = container.querySelector('.opacity-70')
    expect(cluster).toBeTruthy()
    expect(cluster!.className).toMatch(/opacity-70/)
  })
})
