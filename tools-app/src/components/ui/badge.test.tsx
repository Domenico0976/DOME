// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge', () => {
  test('renders default variant unchanged', () => {
    const { container } = render(<Badge>Default</Badge>)
    const el = container.firstChild as HTMLElement
    expect(el?.className).toContain('bg-primary')
  })

  test('renders audio variant with token classes', () => {
    const { container } = render(<Badge variant="audio">Audio</Badge>)
    const el = container.firstChild as HTMLElement
    expect(el?.className).toContain('bg-[var(--badge-bg-audio)]')
    expect(el?.className).toContain('text-[var(--badge-text-audio)]')
  })

  test('renders selected variant with token classes', () => {
    const { container } = render(<Badge variant="selected">Selected</Badge>)
    const el = container.firstChild as HTMLElement
    expect(el?.className).toContain('bg-[var(--badge-bg-selected)]')
    expect(el?.className).toContain('text-[var(--badge-text-selected)]')
  })
})