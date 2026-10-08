// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createPreloaderScene } from '../../src/preloader/scene.js'

const mocks = vi.hoisted(() => ({
  renderCalls: [],
  clearDepthCalls: [],
  renderers: [],
  rafCallbacks: new Map(),
  nextRafId: 1,
  requestFrame: vi.fn(),
  cancelFrame: vi.fn(),
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
      this.render = vi.fn((scene, camera) => {
        mocks.renderCalls.push({ scene, camera })
        this.info.render.calls += 1
      })
      this.clearDepth = vi.fn(() => mocks.clearDepthCalls.push(Date.now()))
      this.dispose = vi.fn()
      mocks.renderers.push(this)
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    Clock: class Clock {
      getElapsedTime() { return 0 }
    },
  }
})

vi.mock('../../src/preloader/counter-texture.js', () => ({
  createCounterTexture: () => ({
    canvas: document.createElement('canvas'),
    resize: vi.fn(),
    update: vi.fn(() => false),
  }),
}))

beforeEach(() => {
  mocks.renderCalls.length = 0
  mocks.clearDepthCalls.length = 0
  mocks.renderers.length = 0
  mocks.rafCallbacks.clear()
  mocks.nextRafId = 1
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

describe('preloader scene single-pass', () => {
  it('renders exactly once per RAF frame with the returned scene and camera', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const preloader = createPreloaderScene(parent, { reducedMotion: false })
    const [frameId, frame] = [...mocks.rafCallbacks.entries()][0]
    mocks.rafCallbacks.delete(frameId)

    frame(0)

    expect(mocks.renderCalls).toHaveLength(1)
    expect(mocks.renderCalls[0]).toEqual({ scene: preloader.scene, camera: preloader.camera })
    expect(mocks.clearDepthCalls).toHaveLength(0)
    expect(mocks.renderers[0].render).toHaveBeenCalledOnce()

    preloader.dispose()
    parent.remove()
  })

  it('uses a plain Camera and no perspective projection state', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const preloader = createPreloaderScene(parent, { reducedMotion: false })

    expect(preloader.camera).toBeInstanceOf(THREE.Camera)
    expect(preloader.camera).not.toBeInstanceOf(THREE.PerspectiveCamera)
    expect(preloader.camera.aspect).toBeUndefined()
    expect(preloader.camera.updateProjectionMatrix).toBeUndefined()

    preloader.dispose()
    parent.remove()
  })

  it('dispose cancels the pending RAF and releases renderer resources', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const preloader = createPreloaderScene(parent, { reducedMotion: false })

    preloader.dispose()

    expect(mocks.cancelFrame).toHaveBeenCalled()
    expect(mocks.rafCallbacks.size).toBe(0)
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce()
    parent.remove()
  })
})
