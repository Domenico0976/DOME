// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { Stack } from './Stack'
import type { ToolDef } from '../core/types'

afterEach(cleanup)

const gen: ToolDef = {
  id: 'g', kind: 'generative', version: '1.0.0', label: 'Gen', icon: '◆', category: 'Generative', defaultParams: {}, controls: [], render() {},
}

describe('Stack', () => {
  beforeEach(() => {
    registerTool(gen)
    useProjectStore.getState().reset()
  })

  test('shows empty hint when no nodes', () => {
    const { getByText } = render(<Stack />)
    expect(getByText(/Add a tool/i)).toBeTruthy()
  })

  test('plus button opens catalog and selecting adds a node', () => {
    useProjectStore.getState().addTool('g')
    const { getByLabelText } = render(<Stack />)
    fireEvent.click(getByLabelText('Add tool above'))
    fireEvent.click(getByLabelText('Add Gen'))
    expect(useProjectStore.getState().stack.length).toBe(2)
  })

  test('stack list is scrollable and constrained', () => {
    const { container } = render(<Stack />)
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).toBeTruthy()
    const el = container.firstChild as HTMLElement
    expect(el.className).toMatch(/max-h-/)
  })

  test('move up and move down buttons reorder the stack', () => {
    useProjectStore.getState().addTool('g')
    useProjectStore.getState().addTool('g')
    const { getAllByLabelText } = render(<Stack />)
    const [firstUid, secondUid] = useProjectStore.getState().stack.map((i) => i.uid)
    const moveDownButtons = getAllByLabelText('Move down')
    const moveUpButtons = getAllByLabelText('Move up')
    expect(moveDownButtons.length).toBe(2)
    expect(moveUpButtons.length).toBe(2)
    fireEvent.click(moveDownButtons[0])
    expect(useProjectStore.getState().stack[0].uid).toBe(secondUid)
    expect(useProjectStore.getState().stack[1].uid).toBe(firstUid)
    const moveUpButtonsAfter = getAllByLabelText('Move up')
    fireEvent.click(moveUpButtonsAfter[1])
    expect(useProjectStore.getState().stack[0].uid).toBe(firstUid)
    expect(useProjectStore.getState().stack[1].uid).toBe(secondUid)
  })

  test('has grip affordance on items', () => {
    useProjectStore.getState().addTool('g')
    const { container } = render(<Stack />)
    const gripHandles = container.querySelectorAll('[aria-label="Drag to reorder"]')
    expect(gripHandles.length).toBe(1)
  })

  test('stack container is scrollable', () => {
    const { container } = render(<Stack />)
    expect(container.querySelector('[data-radix-scroll-area-viewport]')).toBeTruthy()
  })

  test('badges render with correct counts', () => {
    useProjectStore.getState().addTool('g')
    const store = useProjectStore.getState()
    const item = store.stack[0]
    store.addEffect(item.uid, 'glow')
    store.addEffect(item.uid, 'glow')
    const secondEffectUid = useProjectStore.getState().stack[0].effects![1].uid
    store.toggleEffect(item.uid, secondEffectUid)
    store.addAudioBinding(item.uid, { param: 'transform.scaleX', source: 'bass', curve: 'linear', amount: 0.5 })
    store.addAudioBinding(item.uid, { param: 'opacity', source: 'mid', curve: 'invert', amount: 0.3 })

    const { container, getByTestId } = render(<Stack />)
    const badges = container.querySelectorAll('[class*="rounded-full"]')
    expect(badges.length).toBeGreaterThanOrEqual(3)

    const indexBadge = Array.from(badges).find((b) => b.textContent?.includes('#0'))
    expect(indexBadge).toBeTruthy()

    const audioBadge = getByTestId('audio-badge')
    expect(audioBadge).toBeTruthy()
    expect(audioBadge.textContent).toContain('2')

    const effectsBadge = getByTestId('effects-badge')
    expect(effectsBadge).toBeTruthy()
    expect(effectsBadge.textContent).toContain('1')
  })

  test('hidden badge variant replaces inline (hidden) text', () => {
    useProjectStore.getState().addTool('g')
    const { uid } = useProjectStore.getState().stack[0]
    useProjectStore.getState().toggleSwitch(uid)
    const { container } = render(<Stack />)
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
    const { container } = render(<Stack />)
    const cluster = container.querySelector('.opacity-70')
    expect(cluster).toBeTruthy()
    expect(cluster!.className).toMatch(/opacity-70/)
  })
})
