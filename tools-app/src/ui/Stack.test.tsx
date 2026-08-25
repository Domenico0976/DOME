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
})
