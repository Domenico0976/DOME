// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  test('renders default variant unchanged', () => {
    const { container } = render(<Button>Save</Button>)
    const btn = container.querySelector('button')
    expect(btn).toBeTruthy()
    expect(btn?.textContent).toBe('Save')
    expect(btn?.className).toContain('bg-primary')
  })

  test('renders audio variant with token classes', () => {
    const { container } = render(<Button variant="audio">Audio</Button>)
    const btn = container.querySelector('button')
    expect(btn?.className).toContain('bg-[var(--button-bg-audio)]')
    expect(btn?.className).toContain('border-[var(--button-border-audio)]')
    expect(btn?.className).toContain('text-[var(--button-text-audio)]')
  })

  test('applies disabled state', () => {
    const { container } = render(<Button disabled>Disabled</Button>)
    const btn = container.querySelector('button')
    expect(btn?.hasAttribute('disabled')).toBe(true)
  })
})