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
    const el = container.firstChild as HTMLElement
    expect(el.className).toMatch(/overflow-y-auto/)
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
})
