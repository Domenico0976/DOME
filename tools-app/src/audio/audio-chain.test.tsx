// @vitest-environment jsdom
import { describe, test, expect, afterEach, vi } from 'vitest'
import { useEffect } from 'react'
import { render, cleanup, act } from '@testing-library/react'
import { useProjectStore } from '../state/projectStore'
import { useAudio } from './useAudio'
import { isInitialized } from './engine'
import { registerTool } from '../core/registry'
import { evaluateStack } from '../core/stackEngine'
import type { ToolDef, StackItem } from '../core/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (URL as unknown as Record<string, unknown>).createObjectURL
})

class MockAnalyser {
  fftSize = 2048
  frequencyBinCount = 1024
  minDecibels = 0
  maxDecibels = 0
  smoothingTimeConstant = 0
  connect() {}
  disconnect() {}
  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(220)
  }
}

class MockGain {
  gain = { value: 1, setTargetAtTime() {} }
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  state = 'running'
  sampleRate = 48000
  destination = {}
  currentTime = 0
  createAnalyser() {
    return new MockAnalyser()
  }
  createGain() {
    return new MockGain()
  }
  createMediaElementSource() {
    return { connect() {}, disconnect() {} }
  }
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }
  async resume() {
    this.state = 'running'
  }
}

class MockAudio {
  static last: MockAudio | null = null
  src: string
  loop = false
  volume = 1
  currentTime = 0
  duration = NaN
  paused = true
  listeners: Record<string, Array<() => void>> = {}
  play = vi.fn(async () => {
    this.paused = false
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  load() {}
  constructor(src?: string) {
    this.src = src ?? ''
    MockAudio.last = this
  }
  addEventListener(type: string, cb: () => void) {
    const list = this.listeners[type] ?? []
    list.push(cb)
    this.listeners[type] = list
  }
  removeEventListener(type: string, cb: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb)
  }
  fire(type: string) {
    for (const f of [...(this.listeners[type] ?? [])]) f()
  }
}

type AudioApi = ReturnType<typeof useAudio>

function Harness({ apiRef }: { apiRef: { current: AudioApi | null } }) {
  const audio = useAudio()
  useEffect(() => {
    apiRef.current = audio
  }, [audio])
  return null
}

describe('audio chain simulation', () => {
  test('file load, play, live bands, binding modulates render, store stays pristine', async () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    vi.stubGlobal('Audio', MockAudio)
    ;(URL as unknown as Record<string, unknown>).createObjectURL = () => 'blob:mock-audio'
    useProjectStore.getState().reset()

    const apiRef: { current: AudioApi | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    expect(apiRef.current).toBeTruthy()

    await act(async () => {
      await apiRef.current!.enableFile(new File(['fake-mp3-bytes'], 'test.mp3', { type: 'audio/mpeg' }))
    })
    expect(isInitialized()).toBe(true)
    const afterLoad = useProjectStore.getState()
    expect(afterLoad.audio.source).toBe('file')
    expect(afterLoad.audio.fileName).toBe('test.mp3')
    expect(afterLoad.audio.enabled).toBe(true)
    expect(MockAudio.last).toBeTruthy()

    MockAudio.last!.duration = 180
    await act(async () => {
      MockAudio.last!.fire('loadedmetadata')
    })
    expect(useProjectStore.getState().timeline.durationSec).toBe(180)

    await act(async () => {
      apiRef.current!.play()
    })
    expect(MockAudio.last!.play).toHaveBeenCalledTimes(1)
    expect(useProjectStore.getState().timeline.playing).toBe(true)

    const frame = apiRef.current!.readFrame(120)
    expect(frame.bass).toBeGreaterThan(0)
    expect(frame.mid).toBeGreaterThan(0)
    expect(frame.treble).toBeGreaterThan(0)
    expect(frame.level).toBeGreaterThan(0)
    expect(frame.spectrum.length).toBeGreaterThan(0)
    expect(Math.max(...Array.from(frame.spectrum))).toBeGreaterThan(0)

    const seen: number[] = []
    const tool: ToolDef = {
      id: 'simchain',
      kind: 'generative',
      version: '1.0.0',
      label: 'SimChain',
      icon: '',
      category: 'Generative',
      defaultParams: {},
      controls: [],
      render: (_ctx, _frame, item) => {
        seen.push(Number(item.params.speed))
      },
    }
    registerTool(tool)
    const ctx = {
      save() {},
      restore() {},
      canvas: { width: 100, height: 100 },
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
    const item: StackItem = {
      uid: 'simchain',
      toolId: 'simchain',
      toolVersion: '1.0.0',
      params: { speed: 1 },
      audio: [{ param: 'speed', source: 'bass', curve: 'linear', amount: 0.5 }],
      automations: [],
      hidden: false,
    }
    evaluateStack(ctx, { timeSec: 0, dt: 1 / 60, bpm: 120 }, frame, [item])
    evaluateStack(ctx, { timeSec: 0, dt: 1 / 60, bpm: 120 }, frame, [item])
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBeGreaterThan(1)
    expect(seen[0]).toBe(seen[1])
    expect(item.params.speed).toBe(1)
  })
})
