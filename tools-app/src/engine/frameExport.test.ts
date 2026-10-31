// @vitest-environment jsdom
// src/engine/frameExport.test.ts — T4 guarantees: order, wrap, isolation, mime.
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  buildFramePlan,
  exportRealtime,
  exportSequence,
  frameTimeSec,
  pickVideoMimeType,
} from './frameExport'

function fakeCanvas(id: number): HTMLCanvasElement {
  return { id } as unknown as HTMLCanvasElement
}

describe('frame plan', () => {
  test('computes total frames and wraps frame time', () => {
    const plan = buildFramePlan(60, 60, 1280, 720)
    expect(plan.totalFrames).toBe(3600)
    expect(frameTimeSec(plan, 30)).toBeCloseTo(0.5)
    expect(frameTimeSec(plan, 3600)).toBeCloseTo(0)
    expect(frameTimeSec({ ...plan, durationSec: 0 }, 5)).toBe(0)
  })

  test('picks a supported mime with fallback', () => {
    expect(pickVideoMimeType('webm', (m) => m.includes('vp8'))).toContain('vp8')
    expect(pickVideoMimeType('mp4', () => false)).toBe('video/mp4')
  })
})

describe('exportSequence', () => {
  test('seeks, renders and emits in order with plan times', async () => {
    const plan = buildFramePlan(10, 1, 64, 64)
    const seeks: number[] = []
    const emitted: { index: number; t: number }[] = []
    const result = await exportSequence({
      plan,
      seekAudio: (t) => void seeks.push(t),
      render: (t) => fakeCanvas(Math.round(t * 1000)),
      onFrame: (index, t) => void emitted.push({ index, t }),
    })
    expect(result).toEqual({ frames: 10, errors: [] })
    expect(seeks).toHaveLength(10)
    expect(emitted.map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(emitted[1].t).toBeCloseTo(0.1)
  })

  test('isolates per-frame errors and continues', async () => {
    const plan = buildFramePlan(10, 1, 64, 64)
    const seen: number[] = []
    const result = await exportSequence({
      plan,
      render: (t) => {
        if (Math.abs(t - 0.2) < 1e-9) throw new Error('boom-frame')
        return fakeCanvas(1)
      },
      onFrame: (index) => void seen.push(index),
    })
    expect(result.frames).toBe(9)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ index: 2 })
    expect(seen).not.toContain(2)
  })

  test('stops early when requested', async () => {
    const plan = buildFramePlan(60, 60, 64, 64)
    let calls = 0
    const result = await exportSequence({
      plan,
      render: () => fakeCanvas(1),
      onFrame: () => undefined,
      shouldStop: () => ++calls > 3,
    })
    expect(result.frames).toBe(3)
  })
})

describe('exportRealtime', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  function mockRecorder() {
    let instance: {
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      ondataavailable: ((e: { data: Blob }) => void) | null
      onstop: (() => void) | null
      onerror: (() => void) | null
    } | null = null
    class MockMediaRecorder {
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      start = vi.fn(() => {
        this.ondataavailable?.({ data: new Blob(['x']) })
        window.setTimeout(() => this.onstop?.(), 0)
      })
      stop = vi.fn()
      constructor() {
        instance = this as unknown as typeof instance
      }
    }
    return { MockMediaRecorder: MockMediaRecorder as unknown as typeof MediaRecorder, getInstance: () => instance }
  }

  test('records a stream into a blob of the requested type', async () => {
    const { MockMediaRecorder } = mockRecorder()
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    const canvas = { captureStream: vi.fn(() => ({ id: 'stream' })) } as unknown as HTMLCanvasElement
    const blob = await exportRealtime({ canvas, mimeType: 'video/webm;codecs=vp8', durationSec: 0.01 })
    expect(canvas.captureStream).toHaveBeenCalled()
    expect(blob.type).toBe('video/webm')
    expect(blob.size).toBeGreaterThan(0)
  })

  test('fails fast with a clear error when unsupported', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    await expect(
      exportRealtime({ canvas: fakeCanvas(1), mimeType: 'video/webm', durationSec: 1 }),
    ).rejects.toThrow('MediaRecorder unavailable')
  })
})
