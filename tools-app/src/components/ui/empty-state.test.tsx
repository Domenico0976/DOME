// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  test('renders icon, title, description and action', () => {
    const { container } = render(
      <EmptyState
        icon={<span data-testid="icon" />}
        title="No layers"
        description="Add a layer to start"
        action={<button>Add layer</button>}
      />,
    )
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy()
    expect(container.textContent).toContain('No layers')
    expect(container.textContent).toContain('Add a layer to start')
    expect(container.querySelector('button')?.textContent).toBe('Add layer')
  })

  test('renders children when provided', () => {
    const { container } = render(
      <EmptyState title="X">
        <span data-testid="child">child content</span>
      </EmptyState>,
    )
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy()
  })
})