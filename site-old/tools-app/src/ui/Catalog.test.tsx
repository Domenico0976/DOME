// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { registerTool } from '../core/registry'
import { useProjectStore } from '../state/projectStore'
import { Catalog } from './Catalog'
import type { ToolDef } from '../core/types'

afterEach(cleanup)

const gen: ToolDef = {
  id: 'g', kind: 'generative', version: '1.0.0', label: 'Gen', icon: '◆', category: 'Generative', defaultParams: {}, controls: [], render() {},
}
const inp: ToolDef = {
  id: 'i', kind: 'input', version: '1.0.0', label: 'Inp', icon: '▣', category: 'Inputs', defaultParams: {}, controls: [], render() {},
}

describe('Catalog', () => {
  beforeEach(() => {
    registerTool(gen)
    registerTool(inp)
    useProjectStore.getState().reset()
  })

  test('renders three columns and adds a tool on click', () => {
    const { getByText, getByLabelText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    expect(getByText('Inputs')).toBeTruthy()
    expect(getByText('Generative')).toBeTruthy()
    expect(getByText('Filters')).toBeTruthy()
    fireEvent.click(getByLabelText('Add Gen'))
    expect(useProjectStore.getState().stack.length).toBe(1)
  })

  test('catalog is constrained and scrollable within the viewport', () => {
    const { container } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    const el = container.querySelector('[role="dialog"]') as HTMLElement
    expect(el.className).toMatch(/max-w-/)
    expect(el.className).toMatch(/max-h-/)
    expect(el.className).toMatch(/overflow-/)
  })
})
