// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ZoomPanel } from './ZoomPanel'

describe('ZoomPanel', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders with current zoom percentage', () => {
    render(<ZoomPanel zoom={1.5} onZoomChange={() => {}} />)
    expect(screen.getByTestId('zoom-percent').textContent).toBe('150%')
  })

  test('zoom-in button calls onZoomChange with incremented value', () => {
    const onChange = vi.fn()
    render(<ZoomPanel zoom={1} onZoomChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(onChange).toHaveBeenCalledWith(1.1)
  })

  test('zoom-out button calls onZoomChange with decremented value', () => {
    const onChange = vi.fn()
    render(<ZoomPanel zoom={1} onZoomChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(onChange).toHaveBeenCalledWith(0.9)
  })

  test('reset button calls onZoomChange with 1', () => {
    const onChange = vi.fn()
    render(<ZoomPanel zoom={2.5} onZoomChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  test('clamps zoom-in at 400%', () => {
    const onChange = vi.fn()
    render(<ZoomPanel zoom={4} onZoomChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  test('clamps zoom-out at 50%', () => {
    const onChange = vi.fn()
    render(<ZoomPanel zoom={0.5} onZoomChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }))
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  test('renders as a group with data-testid', () => {
    render(<ZoomPanel zoom={1} onZoomChange={() => {}} />)
    expect(screen.getByTestId('zoom-panel')).toBeTruthy()
    expect(screen.getByRole('group', { name: /canvas zoom/i })).toBeTruthy()
  })
})
