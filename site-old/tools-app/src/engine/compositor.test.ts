// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { hasWebGL2, createCompositor } from './compositor'

const proto = HTMLCanvasElement.prototype as unknown as {
  getContext: (contextId: string, options?: unknown) => unknown
}
const originalGetContext = proto.getContext

beforeEach(() => {
  proto.getContext = (contextId: string) => (contextId === 'webgl2' ? null : originalGetContext.call(proto, contextId))
})

afterEach(() => {
  proto.getContext = originalGetContext
})

describe('compositor capability detection', () => {
  test('jsdom canvas without WebGL2 -> hasWebGL2 false and factory null', () => {
    const c = document.createElement('canvas')
    expect(hasWebGL2(c)).toBe(false)
    expect(createCompositor(c)).toBeNull()
  })

  test('factory stays null even when asked twice (no half-initialized state)', () => {
    const c = document.createElement('canvas')
    expect(createCompositor(c)).toBeNull()
    expect(createCompositor(c)).toBeNull()
  })
})
