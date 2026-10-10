// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, within } from '@testing-library/react'
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
const filt: ToolDef = {
  id: 'f', kind: 'filter', version: '1.0.0', label: 'Filt', icon: '□', category: 'Filters', defaultParams: {}, controls: [], render() {},
}
const plasma: ToolDef = {
  id: 'plasma', kind: 'generative', version: '1.0.0', label: 'Plasma', icon: '◇', category: 'Generative', defaultParams: {}, controls: [], render() {},
}

describe('Catalog', () => {
  beforeEach(() => {
    registerTool(gen)
    registerTool(inp)
    registerTool(filt)
    registerTool(plasma)
    useProjectStore.getState().reset()
  })

  test('renders three columns and adds a tool on click', () => {
    const { container, getByLabelText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    // Verify all three column headers are present
    expect(container.textContent).toContain('Inputs')
    expect(container.textContent).toContain('Generative')
    expect(container.textContent).toContain('Filters')
    // Type "plasma" to show only Plasma tool
    const input = getByLabelText('Search tools') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'plasma' } })
    // Verify Plasma tool appears
    expect(container.textContent).toContain('Plasma')
    // Verify Gen tool is hidden (search "plasma" does not match label "Gen")
    // Use a more specific query to avoid matching the "Generative" header
    const genButton = container.querySelector('button[aria-label="Add Gen"]')
    expect(genButton).toBeNull()
    // Click Plasma tool to add it
    const plasmaButton = getByLabelText('Add Plasma')
    fireEvent.click(plasmaButton)
    expect(useProjectStore.getState().stack.length).toBe(1)
  })

  test('catalog is constrained and scrollable within the viewport', () => {
    const { container } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    const el = container.querySelector('[role="dialog"]') as HTMLElement
    expect(el.className).toMatch(/max-w-/)
    expect(el.className).toMatch(/max-h-/)
    expect(el.className).toMatch(/overflow-/)
  })

  test('filter narrows to a single category column', () => {
    const { getByLabelText, getByRole, queryByLabelText, container } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    const headers = () => Array.from(container.querySelectorAll('h4')).map((h) => h.textContent)
    // Initially all columns visible (scoped to h4 headers: filter buttons share the same labels)
    expect(headers()).toEqual(['Inputs', 'Generative', 'Filters'])
    // Click Generative filter button
    const group = getByRole('group', { name: 'Filter tools by category' })
    fireEvent.click(within(group).getByText('Generative'))
    // Verify only Generative column header remains
    expect(headers()).toEqual(['Generative'])
    // Verify Gen and Plasma tools are visible (Filt hidden)
    expect(getByLabelText('Add Gen')).toBeTruthy()
    expect(getByLabelText('Add Plasma')).toBeTruthy()
    expect(queryByLabelText('Add Filt')).toBeNull()
  })

  test('search narrows the grid live (case-insensitive)', () => {
    const { getByLabelText, queryByLabelText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    // Type "plasma" to show only Plasma tool
    const input = getByLabelText('Search tools') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'plasma' } })
    expect(getByLabelText('Add Plasma')).toBeTruthy()
    // Verify other Generative tools are hidden
    expect(queryByLabelText('Add Gen')).toBeNull()
    // Test case-insensitivity
    fireEvent.change(input, { target: { value: 'PLASMA' } })
    expect(getByLabelText('Add Plasma')).toBeTruthy()
    fireEvent.change(input, { target: { value: '' } })
    // Verify all tools visible when search cleared
    expect(getByLabelText('Add Gen')).toBeTruthy()
    expect(getByLabelText('Add Plasma')).toBeTruthy()
    expect(getByLabelText('Add Filt')).toBeTruthy()
  })

  test('empty state shows when nothing matches', () => {
    const { getByLabelText, getByText, queryByLabelText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    const input = getByLabelText('Search tools') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzzzz' } })
    // Verify empty state message and Clear button
    expect(getByText(/No tools match/i)).toBeTruthy()
    expect(getByText('Clear')).toBeTruthy()
    // Verify no tool buttons are visible
    expect(queryByLabelText('Add Gen')).toBeNull()
    expect(queryByLabelText('Add Plasma')).toBeNull()
    expect(queryByLabelText('Add Filt')).toBeNull()
  })

  test('Clear button resets filter and search', () => {
    const { getByLabelText, getByText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    const input = getByLabelText('Search tools') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(getByText(/No tools match/i)).toBeTruthy()
    fireEvent.click(getByText('Clear'))
    // Verify all tools visible
    expect(getByLabelText('Add Gen')).toBeTruthy()
    expect(getByLabelText('Add Plasma')).toBeTruthy()
    expect(getByLabelText('Add Filt')).toBeTruthy()
    // Verify input is cleared
    expect((input as HTMLInputElement).value).toBe('')
  })

  test('filter + search combined: only matching items show', () => {
    const { getByLabelText, getByRole, queryByLabelText } = render(<Catalog anchorUid={null} onClose={() => {}} />)
    // Set filter to Generative
    const group = getByRole('group', { name: 'Filter tools by category' })
    const genBtn = within(group).getByText('Generative')
    fireEvent.click(genBtn)
    // Search for "gen" (should match Gen but not Plasma)
    const input = getByLabelText('Search tools') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'gen' } })
    // Verify Gen tool visible, Plasma hidden
    expect(getByLabelText('Add Gen')).toBeTruthy()
    expect(queryByLabelText('Add Plasma')).toBeNull()
    // Verify Filters column hidden
    expect(queryByLabelText('Add Filt')).toBeNull()
  })
})