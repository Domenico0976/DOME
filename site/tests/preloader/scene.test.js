// @vitest-environment jsdom
// Unit tests for the v3 preloader scene: TWO passes, ONE WebGL context.
//   Pass A: the shared hero text ring renders into a render target (only while
//           the tile shader consumes it, i.e. phase 0).
//   Pass B: one fullscreen tile quad composites ring pixels + counter digits
//           and disintegrates them per tile (shader.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createPreloaderScene } from '../../src/preloader/scene.js'

const mocks = vi.hoisted(() => ({
  renderCalls: [],
  setRenderTargetCalls: [],
  renderers: [],
  rafCallbacks: new Map(),
  nextRafId: 1,
  requestFrame: vi.fn(),
  cancelFrame: vi.fn(),
  ringUpdate: vi.fn(),
  ringDispose: vi.fn(),
}))

vi.mock('three', async () => {
  const actual = await vi.importActual('three')

  class MockWebGLRenderer {
    constructor(options) {
      this.options = options
      this.info = {
        render: { calls: 0, triangles: 0 },
        memory: { textures: 0, geometries: 0 },
      }
      this.setClearColor = vi.fn()
      this.setPixelRatio = vi.fn()
      this.setSize = vi.fn()
      this.setRenderTarget = vi.fn((target) => mocks.setRenderTargetCalls.push(target))
      this.render = vi.fn((scene, camera) => {
        mocks.renderCalls.push({ scene, camera })
        this.info.render.calls += 1
      })
      this.getDrawingBufferSize = vi.fn((buf) => {
        buf.x = 8
        buf.y = 8
        return buf
      })
      this.compile = vi.fn(() => Promise.resolve())
      this.compileAsync = vi.fn(() => Promise.resolve())
      this.dispose = vi.fn()
      mocks.renderers.push(this)
    }
  }

  return { ...actual, WebGLRenderer: MockWebGLRenderer }
})

vi.mock('../../src/preloader/ring.js', () => ({
  createRingRig: () => ({
    group: new THREE.Group(),
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10),
    resize: vi.fn(),
    setDock: vi.fn(),
    update: (...args) => mocks.ringUpdate(...args),
    dispose: (...args) => mocks.ringDispose(...args),
    ready: Promise.resolve(),
  }),
}))

vi.mock('../../src/preloader/counter-texture.js', () => ({
  createCounterTexture: () => ({
    canvas: document.createElement('canvas'),
    resize: vi.fn(),
    update: vi.fn(() => false),
    dispose: vi.fn(),
  }),
}))

beforeEach(() => {
  mocks.renderCalls.length = 0
  mocks.setRenderTargetCalls.length = 0
  mocks.renderers.length = 0
  mocks.rafCallbacks.clear()
  mocks.nextRafId = 1
  mocks.ringUpdate.mockClear()
  mocks.ringDispose.mockClear()
  mocks.requestFrame.mockImplementation((callback) => {
    const id = mocks.nextRafId++
    mocks.rafCallbacks.set(id, callback)
    return id
  })
  mocks.cancelFrame.mockImplementation((id) => mocks.rafCallbacks.delete(id))
  vi.stubGlobal('requestAnimationFrame', mocks.requestFrame)
  vi.stubGlobal('cancelAnimationFrame', mocks.cancelFrame)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountScene() {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const preloader = createPreloaderScene(parent)
  return { parent, preloader }
}

describe('preloader scene v3 (two passes, one GL canvas)', () => {
  it('mounts its own canvas into the parent node (the orchestrator just boots it)', () => {
    const { parent, preloader } = mountScene()

    const canvas = parent.querySelector('canvas.preloader__gl')
    expect(canvas).not.toBeNull()
    expect(preloader.canvas).toBe(canvas)

    preloader.dispose()
    parent.remove()
  })

  it('renders TWO passes per frame: ring into the RT, then the composite', () => {
    const { parent, preloader } = mountScene()
    const [frameId, frame] = [...mocks.rafCallbacks.entries()][0]
    mocks.rafCallbacks.delete(frameId)

    frame(0)

    // Pass A feeds the render target; pass B composites it with the counter.
    expect(mocks.renderCalls).toHaveLength(2)
    expect(mocks.setRenderTargetCalls).toHaveLength(2)
    expect(mocks.setRenderTargetCalls[1]).toBeNull()
    expect(mocks.renderCalls[1]).toEqual({ scene: preloader.scene, camera: preloader.camera })
    // Pass A uses its own ring scene/camera, never the composite pair.
    expect(mocks.renderCalls[0].scene).not.toBe(preloader.scene)
    expect(mocks.ringUpdate).toHaveBeenCalled()

    // The loop re-arms itself so the rig keeps animating.
    expect(mocks.rafCallbacks.size).toBe(1)

    preloader.dispose()
    parent.remove()
  })

  it('composites through a plain Camera (fullscreen quad, no projection state)', () => {
    const { parent, preloader } = mountScene()

    expect(preloader.camera).toBeInstanceOf(THREE.Camera)
    expect(preloader.camera).not.toBeInstanceOf(THREE.PerspectiveCamera)
    expect(preloader.camera.aspect).toBeUndefined()
    expect(preloader.camera.updateProjectionMatrix).toBeUndefined()

    preloader.dispose()
    parent.remove()
  })

  it('skips pass A once the cover phase starts (the content is dead anyway)', () => {
    const { parent, preloader } = mountScene()
    const [frameId, frame] = [...mocks.rafCallbacks.entries()][0]
    mocks.rafCallbacks.delete(frameId)

    preloader.setPhase(1)
    frame(0)

    expect(mocks.renderCalls).toHaveLength(1)
    expect(mocks.renderCalls[0]).toEqual({ scene: preloader.scene, camera: preloader.camera })
    expect(mocks.setRenderTargetCalls).toHaveLength(0)

    preloader.dispose()
    parent.remove()
  })

  it('releases the ring rig on dispose', () => {
    const { parent, preloader } = mountScene()
    preloader.dispose()
    expect(mocks.ringDispose).toHaveBeenCalledOnce()
    parent.remove()
  })

  it('exposes the wave drivers the orchestrator calls', () => {
    const { parent, preloader } = mountScene()
    expect(typeof preloader.setPhase).toBe('function')
    expect(typeof preloader.setFront).toBe('function')
    expect(typeof preloader.setCoverR).toBe('function')
    expect(typeof preloader.setDigitGate).toBe('function')

    expect(() => {
      preloader.setPhase(0)
      preloader.setFront(0.5)
      preloader.setCoverR(0.3)
      preloader.setDigitGate(0.7)
      preloader.redrawCounter(42)
    }).not.toThrow()

    preloader.dispose()
    parent.remove()
  })

  it('boot compiles both passes without ever rejecting (warm-up failures are absorbed)', async () => {
    const { parent, preloader } = mountScene()
    await expect(preloader.ready).resolves.toHaveLength(2)
    preloader.dispose()
    parent.remove()
  })

  it('dispose cancels the pending RAF, releases renderer resources, removes the canvas', () => {
    const { parent, preloader } = mountScene()

    preloader.dispose()

    expect(mocks.cancelFrame).toHaveBeenCalled()
    expect(mocks.rafCallbacks.size).toBe(0)
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce()
    expect(parent.getElementsByTagName('canvas').length).toBe(0)
    parent.remove()
  })
})
