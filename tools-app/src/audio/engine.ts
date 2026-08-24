import type { BandsSnapshot } from './bands'
import { computeBandRanges, downsampleToBands, readBandsFrom } from './bands'
import { BANDS_LENGTH } from '../engine/types'

export class AudioEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AudioEngineError'
  }
}

const ANALYSER_FFT_SIZE = 2048
const MIN_DECIBELS = -85
const MAX_DECIBELS = -10
const SMOOTHING_TIME_CONSTANT = 0.7

let context: AudioContext | null = null
let analyserNode: AnalyserNode | null = null
let frequencyData: Uint8Array | null = null
let bandRanges: ReturnType<typeof computeBandRanges> | null = null
const spectrumBuffer = new Float32Array(BANDS_LENGTH)
const mediaSources = new Map<HTMLMediaElement, MediaElementAudioSourceNode>()

export function ensureAudioContext(): AudioContext {
  if (context === null) {
    context = new AudioContext()
    analyserNode = context.createAnalyser()
    analyserNode.fftSize = ANALYSER_FFT_SIZE
    analyserNode.minDecibels = MIN_DECIBELS
    analyserNode.maxDecibels = MAX_DECIBELS
    analyserNode.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT
    analyserNode.connect(context.destination)
    frequencyData = new Uint8Array(analyserNode.frequencyBinCount)
    bandRanges = computeBandRanges(context.sampleRate, analyserNode.frequencyBinCount)
  }
  return context
}

export async function resumeIfSuspended(): Promise<void> {
  if (context !== null && context.state === 'suspended') await context.resume()
}

export function attachMediaElement(element: HTMLMediaElement): void {
  if (context === null || analyserNode === null) {
    throw new AudioEngineError(
      'Call ensureAudioContext() inside a user gesture before attaching elements',
    )
  }
  const existing = mediaSources.get(element)
  if (existing !== undefined) return
  const source = context.createMediaElementSource(element)
  mediaSources.set(element, source)
  source.connect(analyserNode)
}

export function isInitialized(): boolean {
  return context !== null && analyserNode !== null && frequencyData !== null && bandRanges !== null
}

export function readBands(): BandsSnapshot & { spectrum: { data: Float32Array } } {
  if (analyserNode === null || frequencyData === null || bandRanges === null) {
    throw new AudioEngineError('Audio not initialized: a user gesture is required (ensureAudioContext)')
  }
  analyserNode.getByteFrequencyData(frequencyData)
  downsampleToBands(frequencyData, spectrumBuffer)
  return { ...readBandsFrom(frequencyData, bandRanges), spectrum: { data: spectrumBuffer } }
}
