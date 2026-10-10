// @vitest-environment jsdom
import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Progress } from './progress'

function getFill(bar: HTMLElement): HTMLElement | null {
  const track = bar.querySelector(':scope > div')
  return track ? (track.querySelector(':scope > div') as HTMLElement) : null
}

describe('Progress', () => {
  test('renders determinate bar with width', () => {
    const { container } = render(<Progress value={50} />)
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
    const fill = getFill(bar)!
    expect(fill.style.width).toBe('50%')
  })

  test('renders indeterminate when value undefined', () => {
    const { container } = render(<Progress />)
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    const fill = getFill(bar)!
    expect(fill.className).toContain('animate-progress-indeterminate')
  })

  test('renders label and value when showValue', () => {
    const { container } = render(<Progress value={25} label="Upload" showValue />)
    expect(container.textContent).toContain('Upload')
    expect(container.textContent).toContain('25%')
  })

  test('clamps percent to 0-100', () => {
    const { container } = render(<Progress value={200} max={100} />)
    const bar = container.querySelector('[role="progressbar"]') as HTMLElement
    const fill = getFill(bar)!
    expect(fill.style.width).toBe('100%')
  })
})