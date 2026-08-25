// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import App from './App'

afterEach(cleanup)

describe('App layout', () => {
  test('right aside is scrollable and constrained', () => {
    const { container } = render(<App />)
    const aside = Array.from(container.querySelectorAll('aside')).find((el) =>
      el.className.includes('w-[340px]'),
    )
    expect(aside?.className ?? '').toMatch(/overflow-y-auto/)
    expect(aside?.className ?? '').toMatch(/max-h-/)
  })
})
