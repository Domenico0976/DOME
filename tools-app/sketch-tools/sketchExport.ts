// Sketch export plan — reversed from bundle signals:
// MediaRecorder ×17, recordCanvas ×21, frameByFrameExport ×5, seekExport ×13,
// seekAudio/holdMediaForFrameExport, formats mp4 ×82 / png ×141 / jpeg ×40 / gif ×176.
// Two modes: realtime capture (MediaRecorder on canvas.captureStream) and
// deterministic frame-by-frame (seek audio+timeline per frame, grab pixels).
// Pure planning types + mime picking; the actual recorder lives in the app layer
// so this file stays dependency-free and testable.

export type ExportMode = 'realtime' | 'frame-by-frame'

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'png-sequence' | 'jpeg-sequence'

export type ExportPlan = {
  readonly mode: ExportMode
  readonly format: ExportFormat
  readonly mimeType: string
  /** fps for realtime capture or frame stepping. */
  readonly fps: number
  readonly durationSec: number
  readonly width: number
  readonly height: number
  /** frame-by-frame only: total frames to render. */
  readonly totalFrames: number
}

const MIME_PREFERENCE: Record<ExportFormat, readonly string[]> = {
  mp4: ['video/mp4;codecs=avc1', 'video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  gif: ['image/gif'],
  'png-sequence': ['image/png'],
  'jpeg-sequence': ['image/jpeg'],
}

export function pickMimeType(
  format: ExportFormat,
  isSupported: (mime: string) => boolean,
): string {
  for (const mime of MIME_PREFERENCE[format]) {
    if (isSupported(mime)) return mime
  }
  return MIME_PREFERENCE[format][MIME_PREFERENCE[format].length - 1]
}

export function buildExportPlan(args: {
  mode: ExportMode
  format: ExportFormat
  mimeType: string
  fps?: number
  durationSec?: number
  width?: number
  height?: number
}): ExportPlan {
  const fps = args.fps ?? 60
  const durationSec = args.durationSec ?? 60
  return {
    mode: args.mode,
    format: args.format,
    mimeType: args.mimeType,
    fps,
    durationSec,
    width: args.width ?? 1280,
    height: args.height ?? 720,
    totalFrames: Math.floor(fps * durationSec),
  }
}

/** Timestamp (seconds) of frame i for frame-by-frame seeking (+ audio sync). */
export function frameTimeSec(plan: ExportPlan, frameIndex: number): number {
  return (frameIndex / plan.fps) % plan.durationSec
}
