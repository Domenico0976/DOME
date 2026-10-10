// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ValuePill } from './ValuePill'

describe('ValuePill', () => {
  test('renders value and unit in mono font', () => {
    const { container } = render(<ValuePill value={0.5} unit="%" />)
    const span = container.querySelector('span')
    expect(span).toBeTruthy()
    expect(span?.textContent).toBe('0.5%')
    expect(span?.className).toContain('font-mono')
    expect(span?.className).toContain('tabular-nums')
    expect(span?.className).toContain('text-muted-foreground')
    expect(span?.className).toContain('w-[46px]')
    expect(span?.className).toContain('text-right')
  })
  test('renders integer value without decimals when unit provided', () => {
    const { container } = render(<ValuePill value={42} unit="px" />)
    expect(container.querySelector('span')?.textContent).toBe('42px')
  })
  test('handles string value', () => {
    const { container } = render(<ValuePill value="test" />)
    expect(container.querySelector('span')?.textContent).toBe('test')
  })
})