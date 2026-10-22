// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { StackPanel } from './StackPanel'
import '../tools'

const dragCreateSpy = vi.fn().mockReturnValue([{ kill: vi.fn() }])

vi.mock('gsap/Draggable', () => ({
  Draggable: { create: (...args: unknown[]) => dragCreateSpy(...args) },
}))
vi.mock('gsap', () => ({
  gsap: { registerPlugin: vi.fn() },
}))

afterEach(() => {
  cleanup()
  dragCreateSpy.mockClear()
})

function renderInMain() {
  const main = document.createElement('main')
  main.id = 'main-content'
  main.style.position = 'relative'
  document.body.appendChild(main)
  return render(<StackPanel />, { container: main })
}

describe('StackPanel', () => {
  test('renders as absolute child of main, not fixed', () => {
    useProjectStore.getState().reset()
    const { getByTestId } = renderInMain()
    const el = getByTestId('stack-panel')
    expect(el.parentElement?.id).toBe('main-content')
    expect(el.style.position).toBe('absolute')
  })

  test('header drag creates Draggable with bounds = main', () => {
    useProjectStore.getState().reset()
    renderInMain()
    expect(dragCreateSpy).toHaveBeenCalledTimes(1)
    const cfg = dragCreateSpy.mock.calls[0][1]
    expect(cfg.bounds?.id).toBe('main-content')
    expect(cfg.inertia).toBe(false)
    expect(cfg.edgeResistance).toBe(0.85)
    expect(cfg.type).toBe('x,y')
  })

  test('shows empty state once when stack is empty', () => {
    useProjectStore.getState().reset()
    const { getByText } = renderInMain()
    expect(getByText('Empty — add a tool to begin')).toBeTruthy()
  })

  test('header shows stack count', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('particles')
    useProjectStore.getState().addTool('particles')
    const { getByText } = renderInMain()
    expect(getByText('Stack · 2')).toBeTruthy()
  })

  test('list grows with more items', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('particles')
    const { rerender, getByTestId } = renderInMain()
    expect(getByTestId('stack-vertical-list').querySelectorAll('[data-testid^="node-row-"]').length).toBe(1)
    useProjectStore.getState().addTool('particles')
    useProjectStore.getState().addTool('particles')
    rerender(<StackPanel />)
    expect(getByTestId('stack-vertical-list').querySelectorAll('[data-testid^="node-row-"]').length).toBe(3)
  })

  test('collapse toggles body visibility', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('particles')
    const { getByLabelText, queryByTestId } = renderInMain()
    expect(queryByTestId('stack-vertical-list')).toBeTruthy()
    fireEvent.click(getByLabelText('Collapse stack panel'))
    expect(queryByTestId('stack-vertical-list')).toBeNull()
    fireEvent.click(getByLabelText('Expand stack panel'))
    expect(queryByTestId('stack-vertical-list')).toBeTruthy()
  })
})
