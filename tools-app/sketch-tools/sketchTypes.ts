// Sketch stack model — reversed from tools.sketchdesign.club editor (#tools).
// The editor renders nodes as DOM/SVG (data-stack-node + ports + SVG connectors),
// NOT <canvas>. This file is the data model only: pure types, zero dependencies.
// Maps onto DOME: StackItem[] remains the source of truth; these types describe
// the Sketch *view* (nodes/ports/columns) over it. See STUDIO.md §3, §5.

/** Where the audio value for a column comes from (bundle: reactTo ×59). */
export type ReactToSource =
  | 'window' // whole mix (Sketch default, "React to window")
  | 'bass'
  | 'mid'
  | 'treble'
  | 'level'
  | 'spectrum'
  | 'bpm'

/** The 7 columns of the Sketch grid (grid-template from captured DOM). */
export type SketchColumnKind =
  | 'duration'
  | 'presets'
  | 'reactTo'
  | 'sensitivity'
  | 'valueRange'
  | 'frequency'
  | 'timeline'

export type SketchColumnDef = {
  readonly kind: SketchColumnKind
  /** px width from the captured grid template; timeline is flexible. */
  readonly widthPx: number | null
  readonly label: string
}

/** Column layout exactly as captured (258/158/132/144/132/44 + 1fr timeline). */
export const SKETCH_COLUMNS: readonly SketchColumnDef[] = [
  { kind: 'duration', widthPx: 258, label: 'Duration' },
  { kind: 'presets', widthPx: 158, label: 'Presets' },
  { kind: 'reactTo', widthPx: 132, label: 'React to' },
  { kind: 'sensitivity', widthPx: 144, label: 'Sensitivity' },
  { kind: 'valueRange', widthPx: 132, label: 'Value range' },
  { kind: 'frequency', widthPx: 44, label: 'Frequency' },
  { kind: 'timeline', widthPx: null, label: 'Timeline' },
] as const

/** A row of the columns grid = one audio-reactive mapping (Sketch "Preset row"). */
export type SketchRow = {
  readonly id: string
  /** DOME stack item uid this row drives. */
  readonly itemUid: string
  /** Param key on the item (e.g. "scaleX", "intensity"). */
  readonly param: string
  readonly reactTo: ReactToSource
  /** 0–2 typical (matches DOME AudioBinding.amount). */
  readonly sensitivity: number
  readonly valueRange: { readonly min: number; readonly max: number }
  /** FFT bin for reactTo === 'spectrum'. */
  readonly band?: number
  readonly muted: boolean
}

/** A node in the Sketch stack graph (data-stack-node). */
export type SketchNode = {
  readonly id: string
  /** Tool/element kind, see sketchElements.ts catalogue. */
  readonly element: string
  readonly label: string
  readonly rows: readonly SketchRow[]
  /** Node ids this node receives connectors from. */
  readonly inputs: readonly string[]
}

/** Connector between two node ports (SVG path in the editor). */
export type SketchConnector = {
  readonly id: string
  readonly from: { readonly nodeId: string; readonly port: string }
  readonly to: { readonly nodeId: string; readonly port: string }
}

export type SketchProject = {
  readonly id: string
  readonly name: string
  readonly bpm: number
  /** Seconds, default 60 in captured editor. */
  readonly durationSec: number
  readonly nodes: readonly SketchNode[]
  readonly connectors: readonly SketchConnector[]
}

/** Canvas viewport state (pan/zoom container, transform-based). */
export type SketchViewport = {
  readonly pan: { readonly x: number; readonly y: number }
  readonly zoom: number
}

export const DEFAULT_SKETCH_VIEWPORT: SketchViewport = {
  pan: { x: 0, y: 0 },
  zoom: 1,
}
