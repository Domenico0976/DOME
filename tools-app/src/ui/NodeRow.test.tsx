// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { registerTool } from '../core/registry'
import type { ToolDef } from '../core/types'
import { NodeRow } from './NodeRow'
import '../tools'

afterEach(cleanup)

const demo: ToolDef = {
  id: 'noderow-demo',
  kind: 'generative',
  version: '1.0.0',
  label: 'Row Demo',
  icon: '',
  category: 'Generative',
  defaultParams: {},
  controls: [],
  render: () => {},
}

function setup() {
  registerTool(demo)
  useProjectStore.getState().reset()
  useProjectStore.getState().addTool('noderow-demo')
  useProjectStore.getState().addTool('noderow-demo')
  const stack = useProjectStore.getState().stack
  return stack
}

const noop = () => {}

describe('NodeRow', () => {
  test('renders label, badges and selects on click', () => {
    const stack = setup()
    const { getByText } = render(
      <NodeRow
        item={stack[0]}
        index={0}
        total={2}
        onDragStartRow={noop}
        onDragOverRow={noop}
        onDropRow={noop}
        onDragEndRow={noop}
      />,
    )
    expect(getByText('Row Demo')).toBeTruthy()
    expect(getByText('#0')).toBeTruthy()
    fireEvent.click(getByText('Row Demo'))
    expect(useProjectStore.getState().selectedUid).toBe(stack[0].uid)
  })

  test('ArrowUp / ArrowDown on the grip reorders via moveTool', () => {
    const stack = setup()
    const { getByLabelText } = render(
      <NodeRow
        item={stack[1]}
        index={1}
        total={2}
        onDragStartRow={noop}
        onDragOverRow={noop}
        onDropRow={noop}
        onDragEndRow={noop}
      />,
    )
    const grip = getByLabelText('Drag Row Demo to reorder')
    fireEvent.keyDown(grip, { key: 'ArrowUp' })
    const after = useProjectStore.getState().stack
    expect(after[0].uid).toBe(stack[1].uid)
  })

  const openMenu = async (getByLabelText: (label: string) => HTMLElement, getByText: (label: string) => HTMLElement) => {
    const trigger = getByLabelText('Node actions for Row Demo')
    await act(async () => {
      fireEvent.pointerDown(trigger)
      fireEvent.click(trigger)
    })
    return getByText
  }

  test('kebab menu hides the node', async () => {
    const stack = setup()
    const rendered = render(
      <NodeRow
        item={stack[0]}
        index={0}
        total={2}
        onDragStartRow={noop}
        onDragOverRow={noop}
        onDropRow={noop}
        onDragEndRow={noop}
      />,
    )
    const getByText = await openMenu(rendered.getByLabelText, rendered.getByText)
    await act(async () => {
      fireEvent.click(getByText('Hide'))
    })
    expect(useProjectStore.getState().stack[0].hidden).toBe(true)
  })

  test('kebab menu deletes the node', async () => {
    const stack = setup()
    expect(stack).toHaveLength(2)
    const rendered = render(
      <NodeRow
        item={stack[0]}
        index={0}
        total={2}
        onDragStartRow={noop}
        onDragOverRow={noop}
        onDropRow={noop}
        onDragEndRow={noop}
      />,
    )
    const getByText = await openMenu(rendered.getByLabelText, rendered.getByText)
    await act(async () => {
      fireEvent.click(getByText('Delete'))
    })
    expect(useProjectStore.getState().stack).toHaveLength(1)
  })

  test('drag handle starts native drag with the node uid', () => {
    const stack = setup()
    const onStart = vi.fn()
    const { getByLabelText } = render(
      <NodeRow
        item={stack[0]}
        index={0}
        total={2}
        onDragStartRow={onStart}
        onDragOverRow={noop}
        onDropRow={noop}
        onDragEndRow={noop}
      />,
    )
    fireEvent.dragStart(getByLabelText('Drag Row Demo to reorder'))
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart.mock.calls[0][0]).toBe(stack[0].uid)
  })
})
