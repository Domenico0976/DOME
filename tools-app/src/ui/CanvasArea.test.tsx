// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { CanvasArea } from './CanvasArea'
import { useCanvasPanZoom } from '../hooks/useCanvasPanZoom'

describe('CanvasArea', () => {
  afterEach(() => {
    cleanup()
  })

  test('renders with children', () => {
    render(
      <CanvasArea>
        <div data-testid="child-content">Child</div>
      </CanvasArea>,
    )
    expect(screen.getByTestId('child-content')).toBeTruthy()
  })

  test('no longer renders the old zoom control (relocated to ZoomPanel)', () => {
    render(
      <CanvasArea>
        <div>Child</div>
      </CanvasArea>,
    )
    expect(screen.queryByRole('button', { name: /zoom in/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /zoom out/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reset zoom/i })).toBeNull()
  })
})

describe('useCanvasPanZoom', () => {
  test('initializes with default pan and zoom', () => {
    const { result } = renderHook(() => useCanvasPanZoom())
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
    expect(result.current.zoom).toBe(1)
  })
})
