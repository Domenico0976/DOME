// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { StackVertical } from './StackVertical'
import { DropPlaceholder } from './DropPlaceholder'
import { PresetMegaMenu } from './PresetMegaMenu'
import '../tools'

afterEach(cleanup)

const demo: ToolDef = {
  id: 'vertical-demo',
  kind: 'generative',
  version: '1.0.0',
  label: 'Vertical Demo',
  icon: '',
  category: 'Generative',
  defaultParams: {},
  controls: [{ param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 10, step: 1 }],
  render: () => {},
}

function setupStack(count = 2) {
  registerTool(demo)
  useProjectStore.getState().reset()
  for (let i = 0; i < count; i++) useProjectStore.getState().addTool('vertical-demo')
  return useProjectStore.getState().stack
}

function dragData() {
  const data: Record<string, string> = {}
  return {
    dataTransfer: {
      setData: (k: string, v: string) => (data[k] = v),
      effectAllowed: '',
      dropEffect: '',
    },
    data,
  }
}

describe('StackVertical drag and drop', () => {
  test('renders one row per stack item, top is front', () => {
    setupStack(2)
    const { container } = render(<StackVertical />)
    const rows = container.querySelectorAll('[data-testid^="node-row-"]')
    expect(rows.length).toBe(2)
    expect(container.querySelector('[role="list"]')?.getAttribute('aria-label')).toContain('top is front')
  })

  test('dragging removes the row from flow and shows a placeholder', () => {
    const stack = setupStack(2)
    const { container, getAllByLabelText } = render(<StackVertical />)
    const grip = getAllByLabelText('Drag Vertical Demo to reorder')[0]
    fireEvent.dragStart(grip, dragData())
    // dragged row is out of flow: only one row left
    expect(container.querySelectorAll('[data-testid^="node-row-"]').length).toBe(1)
    // hovering the remaining row opens the drop position
    fireEvent.dragOver(container.querySelectorAll('[data-testid^="node-row-"]')[0], dragData())
    expect(container.querySelector('[data-testid="drop-placeholder"]')).toBeTruthy()
    // dropping on the list background appends at the end
    const list = container.querySelector('[data-testid="stack-vertical-list"]') as HTMLElement
    fireEvent.dragOver(list, dragData())
    fireEvent.drop(list, dragData())
    const after = useProjectStore.getState().stack
    expect(after).toHaveLength(2)
    expect(after[1].uid).toBe(stack[0].uid)
  })

  test('dropping a lower node above the first row moves it to front', () => {
    const stack = setupStack(2)
    const { container, getAllByLabelText } = render(<StackVertical />)
    // stack order is [newest, oldest]; drag the second grip (oldest) above the first row
    fireEvent.dragStart(getAllByLabelText('Drag Vertical Demo to reorder')[1], dragData())
    fireEvent.dragOver(container.querySelectorAll('[data-testid^="node-row-"]')[0], dragData())
    fireEvent.drop(container.querySelectorAll('[data-testid^="node-row-"]')[0], dragData())
    const after = useProjectStore.getState().stack
    expect(after[0].uid).toBe(stack[1].uid)
  })
})

describe('DropPlaceholder', () => {
  test('collapses when inactive', () => {
    const { getByTestId, rerender } = render(<DropPlaceholder active={false} />)
    expect(getByTestId('drop-placeholder').getAttribute('data-active')).toBe('false')
    rerender(<DropPlaceholder active />)
    expect(getByTestId('drop-placeholder').getAttribute('data-active')).toBe('true')
  })
})

describe('PresetMegaMenu', () => {
  test('lists scene elements and shows settings on hover', () => {
    setupStack(1)
    const onPick = vi.fn()
    const onClose = vi.fn()
    const { getByText } = render(<PresetMegaMenu onPick={onPick} onClose={onClose} />)
    expect(getByText('New preset')).toBeTruthy()
    expect(getByText('Vertical Demo')).toBeTruthy()
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    expect(getByText('Tool params (no effect)')).toBeTruthy()
    fireEvent.mouseEnter(getByText('Tool params (no effect)'))
    expect(getByText('Speed')).toBeTruthy()
  })

  test('picking a setting calls onPick with uid and param and closes', () => {
    const stack = setupStack(1)
    const onPick = vi.fn()
    const onClose = vi.fn()
    const { getByText } = render(<PresetMegaMenu onPick={onPick} onClose={onClose} />)
    fireEvent.mouseEnter(getByText('Vertical Demo'))
    fireEvent.mouseEnter(getByText('Tool params (no effect)'))
    fireEvent.click(getByText('Speed'))
    expect(onPick).toHaveBeenCalledWith(stack[0].uid, 'speed')
    expect(onClose).toHaveBeenCalled()
  })

  test('Escape closes the menu', () => {
    setupStack(1)
    const onClose = vi.fn()
    render(<PresetMegaMenu onPick={vi.fn()} onClose={onClose} />)
    expect(queryDoc('Close scene presets')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

function queryDoc(label: string) {
  const el = document.querySelector(`[aria-label="${label}"]`)
  if (!el) throw new Error(`missing ${label}`)
  return el as HTMLElement
}
