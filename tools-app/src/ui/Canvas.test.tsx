// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { evaluateStack } from '../core/stackEngine'
import { Canvas } from './Canvas'
import { useProjectStore } from '../state/projectStore'
import { registerTool } from '../core/registry'

vi.mock('../core/stackEngine', () => ({
  evaluateStack: vi.fn(),
}))

const stubCtx = {
  clearRect: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
  putImageData: vi.fn(),
}

let rafCb: FrameRequestCallback | null = null

describe('Canvas', () => {
  beforeEach(() => {
    rafCb = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    ;(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = vi.fn(() => stubCtx)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('rAF loop draws when a stack item exists', () => {
    render(<Canvas />)
    expect(rafCb).not.toBeNull()
    rafCb?.(0)
    expect(evaluateStack).toHaveBeenCalled()
  })

  test('renders wrapper carrying stage-canvas testid alongside dual canvases', () => {
    const { getByTestId } = render(<Canvas />)
    expect(getByTestId('stage-canvas')).toBeTruthy()
  })

  test('applies CPU effects when GPU effects are also active and WebGL is unavailable', () => {
    registerTool({
      id: 'g',
      kind: 'generative',
      version: '1.0.0',
      label: 'Gen',
      icon: '',
      category: 'Generative',
      defaultParams: {},
      controls: [],
      render: () => {},
    })
    useProjectStore.getState().reset()
    useProjectStore.getState().addTool('g')
    const uid = useProjectStore.getState().stack[0].uid
    useProjectStore.getState().addEffect(uid, 'adjustments')
    useProjectStore.getState().addEffect(uid, 'lens')

    render(<Canvas />)
    expect(rafCb).not.toBeNull()
    rafCb?.(0)
    expect(stubCtx.getImageData).toHaveBeenCalled()
  })
})
