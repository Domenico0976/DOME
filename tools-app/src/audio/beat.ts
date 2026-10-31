// src/audio/beat.ts
// Energy-based beat tracking + BPM estimate
// (moving average, 1.35x gate, min-interval, EMA).
// Pure logic, no DOM/Web Audio: feed it the normalized bass band (0-1) with a
// timestamp. The store timeline.bpm is NEVER written here — manual BPM always
// wins by structure; the estimate is exposed for display only (T3 columns view).
import type { AudioFrame } from '../core/types'

export type BeatState = {
  readonly detected: boolean
  readonly strength: number
}

export type BeatTrackerOptions = {
  /** Seconds of energy history. */
  beatWindowSec?: number
  /** Detection gate multiplier over the moving average. */
  threshold?: number
  /** Rejection ceiling: intervals faster than this BPM are ignored. */
  maxBpm?: number
  /** Starting estimate (DOME normalizes BPM around 120). */
  initialBpm?: number
}

const DEFAULT_WINDOW_SEC = 2
const DEFAULT_THRESHOLD = 1.35
const DEFAULT_MAX_BPM = 180
const DEFAULT_BPM = 120
const SAMPLES_PER_SEC = 43

export function createBeatTracker(opts: BeatTrackerOptions = {}): {
  push: (bass01: number, nowSec: number) => BeatState
  getEstimatedBpm: () => number
  reset: () => void
} {
  const windowSec = opts.beatWindowSec ?? DEFAULT_WINDOW_SEC
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD
  const maxBpm = opts.maxBpm ?? DEFAULT_MAX_BPM
  let estimatedBpm = opts.initialBpm ?? DEFAULT_BPM
  let history: number[] = []
  let lastBeatAt = -10

  return {
    push(bass01: number, nowSec: number): BeatState {
      const v = Math.max(0, Math.min(1, Number(bass01) || 0))
      history.push(v)
      const keep = Math.max(8, Math.floor(windowSec * SAMPLES_PER_SEC))
      if (history.length > keep) history = history.slice(-keep)
      const avg = history.reduce((a, b) => a + b, 0) / history.length
      const minInterval = 60 / maxBpm
      if (v > avg * threshold && nowSec - lastBeatAt > minInterval) {
        const interval = nowSec - lastBeatAt
        lastBeatAt = nowSec
        if (interval > 0.25 && interval < 2) {
          estimatedBpm = estimatedBpm * 0.7 + (60 / interval) * 0.3
        }
        return { detected: true, strength: Math.min(1, (v - avg) * 3) }
      }
      return { detected: false, strength: 0 }
    },
    getEstimatedBpm(): number {
      return Math.round(estimatedBpm)
    },
    reset(): void {
      history = []
      lastBeatAt = -10
      estimatedBpm = opts.initialBpm ?? DEFAULT_BPM
    },
  }
}

// Module singleton mirroring engine.ts style: one live tracker for the app.
let shared = createBeatTracker()

export function pushBeatSample(bass01: number, nowSec: number): BeatState {
  return shared.push(bass01, nowSec)
}

export function getEstimatedBpm(): number {
  return shared.getEstimatedBpm()
}

export function resetBeatTracker(): void {
  shared.reset()
}

/** Attach a beat reading to a frame without mutating the input. */
export function withBeat(
  frame: Omit<AudioFrame, 'beat'> & { beat?: AudioFrame['beat'] },
  bass01: number,
  nowSec: number,
): AudioFrame {
  const beat = shared.push(bass01, nowSec)
  return { ...frame, beat: { detected: beat.detected, strength: beat.strength } }
}
