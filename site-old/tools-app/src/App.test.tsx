// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import App from './App'

afterEach(cleanup)

describe('App layout', () => {
  test('renders floating island components', () => {
    const { container } = render(<App />)
    // CanvasArea should exist
    expect(container.querySelector('[data-testid="stage-canvas"]')).toBeTruthy()
    // FloatingStack should exist (fixed positioned)
    expect(container.querySelector('.fixed')).toBeTruthy()
  })
})
