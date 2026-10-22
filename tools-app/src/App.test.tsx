// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import App from './App'
import { useProjectStore } from './state/projectStore'
import './tools'

afterEach(cleanup)

describe('App layout', () => {
  test('renders floating island components', () => {
    const { container } = render(<App />)
    // CanvasArea should exist
    expect(container.querySelector('[data-testid="stage-canvas"]')).toBeTruthy()
    // StackPanel should exist (absolute panel inside main)
    expect(container.querySelector('[data-testid="stack-panel"]')).toBeTruthy()
  })

  test('clicking a stack row keeps every row', () => {
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('particles')
    useProjectStore.getState().addTool('particles')
    const { container, getAllByLabelText } = render(<App />)
    expect(container.querySelectorAll('[data-testid^="node-row-"]')).toHaveLength(2)
    fireEvent.click(getAllByLabelText('Select Particles')[0])
    expect(useProjectStore.getState().stack).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid^="node-row-"]')).toHaveLength(2)
  })
})
