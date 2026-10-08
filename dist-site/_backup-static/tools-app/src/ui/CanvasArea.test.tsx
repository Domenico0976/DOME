// @vitest-environment jsdom
import { describe, test, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

  test('zoom buttons change zoom level', () => {
    render(
      <CanvasArea>
        <div>Child</div>
      </CanvasArea>,
    )

    expect(screen.getByText('100%')).toBeTruthy()

    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i })
    fireEvent.click(zoomInBtn)

    expect(screen.getByText('110%')).toBeTruthy()

    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i })
    fireEvent.click(zoomOutBtn)

    expect(screen.getByText('100%')).toBeTruthy()
  })
})

describe('useCanvasPanZoom', () => {
  test('initializes with default pan and zoom', () => {
    const { result } = renderHook(() => useCanvasPanZoom())
    expect(result.current.pan).toEqual({ x: 0, y: 0 })
    expect(result.current.zoom).toBe(1)
  })
})
