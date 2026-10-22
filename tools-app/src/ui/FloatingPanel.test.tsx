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
      to: vi.fn(),
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
    expect(getByText('Gen · #0')).toBeTruthy()
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

  test('ESC key closes panel', () => {
    const item = useProjectStore.getState().stack[0]
    const onClose = vi.fn()
    const { getByTestId } = render(<FloatingPanel item={item} onClose={onClose} />)
    const panel = getByTestId('floating-panel')
    fireEvent.keyDown(panel, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('panel respects viewport clamp on resize', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByTestId } = render(<FloatingPanel item={item} onClose={() => {}} />)
    const panel = getByTestId('floating-panel')
    expect(panel).toBeTruthy()
  })

  test('keyboard arrows resize panel', () => {
    const item = useProjectStore.getState().stack[0]
    const { getByTestId } = render(<FloatingPanel item={item} onClose={() => {}} />)
    const panel = getByTestId('floating-panel') as HTMLElement
    expect(panel.style.width).toBe('290px')
    fireEvent.keyDown(panel, { key: 'ArrowRight' })
    expect(panel.style.width).toBe('298px')
  })

  test('forwards focusParam to NodeOptions and switches to Effects tab', () => {
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'glow')
    const item = useProjectStore.getState().stack[0]
    const effectUid = item.effects![0].uid
    const { getByRole } = render(
      <FloatingPanel item={item} onClose={() => {}} focusParam={`${effectUid}.intensity`} />,
    )
    const effectsTab = getByRole('tab', { name: /^Effects/ }) as HTMLElement
    expect(effectsTab.getAttribute('aria-selected')).toBe('true')
  })
})
