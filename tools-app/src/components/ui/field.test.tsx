// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Field } from './field'

describe('Field', () => {
  test('renders label, control and helper', () => {
    const { container } = render(
      <Field label="BPM" helper="Beats per minute" control={<input />} />,
    )
    const label = container.querySelector('label')
    expect(label?.textContent).toBe('BPM')
    const helper = container.querySelector('p')
    expect(helper?.textContent).toBe('Beats per minute')
  })

  test('shows error text and danger color when invalid', () => {
    const { container } = render(
      <Field label="BPM" error="Invalid value" invalid helper="Beats per minute" control={<input />} />,
    )
    const p = container.querySelector('p')
    expect(p?.textContent).toContain('Invalid value')
    expect(p?.textContent).toContain('⚠')
    expect(p?.className).toContain('text-[var(--danger)]')
    expect(p?.getAttribute('role')).toBe('alert')
  })

  test('sets data-invalid attribute', () => {
    const { container } = render(<Field label="X" invalid control={<input />} />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('data-invalid')).toBe('true')
  })

  test('renders value slot when provided', () => {
    const { container } = render(<Field label="Vol" value="42%" control={<input />} />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('42%')
    expect(span?.className).toContain('font-mono')
  })
})