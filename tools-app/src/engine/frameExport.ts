// src/engine/frameExport.ts — deterministic export runner (src-contained).
// Two modes: frame-by-frame (seek audio + render each frame, deterministic)
// and realtime (MediaRecorder on a canvas stream). Per-frame errors are
// isolated and reported, never aborting the run (AGENTS §16.3).

export type FramePlan = {
  readonly fps: number
  readonly durationSec: number
  readonly width: number
  readonly height: number
  readonly totalFrames: number
}

export function buildFramePlan(
  fps = 60,
  durationSec = 60,
  width = 1280,
  height = 720,
): FramePlan {
  return { fps, durationSec, width, height, totalFrames: Math.floor(fps * durationSec) }
}

/** Timestamp of frame i, wrapped into [0, durationSec). */
export function frameTimeSec(plan: FramePlan, frameIndex: number): number {
  if (plan.durationSec <= 0) return 0
  return (frameIndex / plan.fps) % plan.durationSec
}

export type RealtimeFormat = 'mp4' | 'webm'

const MIME_PREFERENCE: Record<RealtimeFormat, readonly string[]> = {
  mp4: ['video/mp4;codecs=avc1', 'video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
}

export function pickVideoMimeType(format: RealtimeFormat, isSupported: (mime: string) => boolean): string {
  for (const mime of MIME_PREFERENCE[format]) {
    if (isSupported(mime)) return mime
  }
  return MIME_PREFERENCE[format][MIME_PREFERENCE[format].length - 1]
}

export type SequenceDeps = {
  plan: FramePlan
  /** Optional: sync the audio element before rendering (file sources). Mic/live: omit. */
  seekAudio?: (timeSec: number) => void | Promise<void>
  render: (timeSec: number) => HTMLCanvasElement | Promise<HTMLCanvasElement>
  onFrame: (index: number, timeSec: number, canvas: HTMLCanvasElement) => void | Promise<void>
  shouldStop?: () => boolean
}

export type SequenceResult = {
  frames: number
  errors: { index: number; message: string }[]
}

export async function exportSequence(deps: SequenceDeps): Promise<SequenceResult> {
  const errors: SequenceResult['errors'] = []
  let frames = 0
  for (let i = 0; i < deps.plan.totalFrames; i++) {
    if (deps.shouldStop?.()) break
    const t = frameTimeSec(deps.plan, i)
    try {
      await deps.seekAudio?.(t)
      const canvas = await deps.render(t)
      await deps.onFrame(i, t, canvas)
      frames++
    } catch (err) {
      errors.push({ index: i, message: err instanceof Error ? err.message : String(err) })
    }
  }
  return { frames, errors }
}

export type RealtimeDeps = {
  canvas: HTMLCanvasElement
  mimeType: string
  durationSec: number
  videoBitsPerSecond?: number
  timesliceMs?: number
}

export async function exportRealtime(deps: RealtimeDeps): Promise<Blob> {
  const MR = typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder
  if (!MR) throw new Error('MediaRecorder unavailable in this browser')
  const capture = (deps.canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream })
    .captureStream
  if (typeof capture !== 'function') throw new Error('canvas.captureStream unavailable in this browser')
  const stream = capture.call(deps.canvas, 60)
  const chunks: BlobPart[] = []
  return new Promise<Blob>((resolve, reject) => {
    let recorder: MediaRecorder
    try {
      recorder = new MR(stream, { mimeType: deps.mimeType, videoBitsPerSecond: deps.videoBitsPerSecond ?? 8_000_000 })
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunks.push(e.data)
    }
    recorder.onerror = () => reject(new Error('MediaRecorder error during export'))
    recorder.onstop = () => resolve(new Blob(chunks, { type: deps.mimeType.split(';')[0] }))
    try {
      recorder.start(deps.timesliceMs ?? 200)
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }
    window.setTimeout(() => {
      try {
        recorder.stop()
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }, Math.max(0, deps.durationSec * 1000))
  })
}
