// Sketch audio engine — reversed from main-DNPwjhJt.js.
// Bundle facts: AudioContext ×15, createAnalyser ×8, fftSize settable,
// getByteFrequencyData ×7, bass ×101, beat ×117, bpm ×288, "reactivity" ×23.
// DOME already has AudioFrame {bass, mid, treble, level, spectrum, bpm} as the
// contract; this engine PRODUCES that frame from a media element or mic stream,
// adding the two pieces DOME lacks: energy-based beat/BPM tracking and the
// per-source "reactivity" (sensitivity) scaling behind Sketch's gear icon.

import type { ReactToSource } from './sketchTypes'

export type SketchBands = {
  /** 20–160 Hz, normalized 0–1. */
  readonly bass: number
  /** 160–2000 Hz merged lowMid+mid, normalized 0–1. */
  readonly mid: number
  /** 2–16 kHz merged highMid+treble, normalized 0–1. */
  readonly treble: number
  /** Overall RMS 0–1. */
  readonly level: number
  /** Raw normalized spectrum (fftSize/2 bins). */
  readonly spectrum: Float32Array
  readonly beat: { readonly detected: boolean; readonly strength: number }
  readonly bpm: number
}

export type SketchAudioOptions = {
  /** Must be power of two; bundle sets analyser.fftSize dynamically. */
  fftSize?: number
  smoothingTimeConstant?: number
  /** Manual override; when null the tracker estimates from beats. */
  bpm?: number | null
  /** Seconds of energy history for beat detection. */
  beatWindowSec?: number
}

const DEFAULT_FFT = 2048

/** Frequency (Hz) → FFT bin index for a given sampleRate/fftSize. */
export function freqToBin(freqHz: number, sampleRate: number, fftSize: number): number {
  const binHz = sampleRate / fftSize
  return Math.max(0, Math.min(fftSize / 2 - 1, Math.floor(freqHz / binHz)))
}

function mean(data: Uint8Array, from: number, to: number): number {
  if (to <= from) return 0
  let s = 0
  for (let i = from; i < to; i++) s += data[i]
  return s / ((to - from) * 255)
}

export class SketchAudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private data: Uint8Array = new Uint8Array(0)
  private energyHist: number[] = []
  private lastBeatAt = -10
  private estimatedBpm: number
  private readonly manualBpm: number | null

  fftSize: number
  smoothing: number
  readonly beatWindowSec: number

  constructor(opts: SketchAudioOptions = {}) {
    this.fftSize = opts.fftSize ?? DEFAULT_FFT
    this.smoothing = opts.smoothingTimeConstant ?? 0.8
    this.manualBpm = opts.bpm ?? null
    this.estimatedBpm = opts.bpm ?? 82 // 82 = captured editor default
    this.beatWindowSec = opts.beatWindowSec ?? 2
  }

  /** Attach a loaded <audio> element (file upload .mp3/.wav in the editor). */
  attachMediaElement(el: HTMLMediaElement): void {
    this.ensureGraph()
    const ctx = this.ctx
    const analyser = this.analyser
    if (ctx === null || analyser === null) return
    const src = ctx.createMediaElementSource(el)
    src.connect(analyser)
    analyser.connect(ctx.destination)
  }

  /** Attach a mic MediaStream (editor "Record mic" button). */
  attachStream(stream: MediaStream): void {
    this.ensureGraph()
    const ctx = this.ctx
    const analyser = this.analyser
    if (ctx === null || analyser === null) return
    const src = ctx.createMediaStreamSource(stream)
    src.connect(analyser)
  }

  resume(): Promise<void> {
    if (this.ctx === null) this.ensureGraph()
    return this.ctx?.state === 'suspended' ? this.ctx.resume() : Promise.resolve()
  }

  /** Read the current frame. Returns zeros when no source is attached. */
  readFrame(nowSec: number, sampleRateHint = 48000): SketchBands {
    const analyser = this.analyser
    if (analyser === null) {
      return {
        bass: 0,
        mid: 0,
        treble: 0,
        level: 0,
        spectrum: new Float32Array(this.fftSize / 2),
        beat: { detected: false, strength: 0 },
        bpm: this.manualBpm ?? this.estimatedBpm,
      }
    }
    analyser.getByteFrequencyData(this.data)
    const sr = this.ctx?.sampleRate ?? sampleRateHint
    const n = this.data
    const bass = mean(n, 0, freqToBin(160, sr, this.fftSize))
    const mid = mean(
      n,
      freqToBin(160, sr, this.fftSize),
      freqToBin(2000, sr, this.fftSize),
    )
    const treble = mean(
      n,
      freqToBin(2000, sr, this.fftSize),
      freqToBin(16000, sr, this.fftSize),
    )
    const level = mean(n, 0, n.length)
    const spectrum = Float32Array.from(n, (v) => v / 255)

    // Energy-based beat tracking (mirrors bundle beat logic: current energy
    // vs moving average, min-interval gate, BPM from interval).
    this.energyHist.push(bass)
    const keep = Math.max(8, Math.floor(this.beatWindowSec * 43))
    if (this.energyHist.length > keep) this.energyHist.shift()
    const avg = this.energyHist.reduce((a, b) => a + b, 0) / this.energyHist.length
    const minInterval = 60 / 180 // 180 BPM ceiling
    const detected = bass > avg * 1.35 && nowSec - this.lastBeatAt > minInterval
    let strength = 0
    if (detected) {
      const interval = nowSec - this.lastBeatAt
      this.lastBeatAt = nowSec
      strength = Math.min(1, (bass - avg) * 3)
      if (this.manualBpm === null && interval > 0.25 && interval < 2) {
        const inst = 60 / interval
        this.estimatedBpm = this.estimatedBpm * 0.7 + inst * 0.3
      }
    }
    return {
      bass,
      mid,
      treble,
      level,
      spectrum,
      beat: { detected, strength },
      bpm: this.manualBpm ?? Math.round(this.estimatedBpm),
    }
  }

  /** Resolve a ReactToSource to its 0–1 value for one row (gear = amount). */
  static resolveSource(bands: SketchBands, source: ReactToSource, band = 0): number {
    switch (source) {
      case 'bass':
        return bands.bass
      case 'mid':
        return bands.mid
      case 'treble':
        return bands.treble
      case 'level':
      case 'window':
        return bands.level
      case 'bpm':
        return Math.min(1, bands.bpm / 180)
      case 'spectrum':
        return bands.spectrum[Math.max(0, Math.min(bands.spectrum.length - 1, band))] ?? 0
    }
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
    this.analyser = null
  }

  private ensureGraph(): void {
    if (this.ctx !== null && this.analyser !== null) return
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC === undefined) return
    this.ctx = new AC()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.analyser.smoothingTimeConstant = this.smoothing
    this.data = new Uint8Array(this.analyser.frequencyBinCount)
  }
}
