// Sketch element catalogue — every element kind found in main-DNPwjhJt.js
// (case-insensitive grep counts), with the DOME ToolDef that already covers it
// and the two gaps to build. Coverage: 15 of 17 element kinds exist in DOME.

/** Where the element renders in the Sketch editor. */
export type ElementSurface = 'dom-node' | 'canvas-2d' | 'canvas-webgl'

export type ElementEntry = {
  /** Sketch element name as it appears in the bundle. */
  readonly sketch: string
  /** Occurrences in the bundle (popularity proxy). */
  readonly bundleHits: number
  readonly surface: ElementSurface
  /** DOME tool id that covers it, or null when missing. */
  readonly domeToolId: string | null
  readonly note: string
}

export const ELEMENT_CATALOGUE: readonly ElementEntry[] = [
  { sketch: 'Text', bundleHits: 5849, surface: 'dom-node', domeToolId: 'text', note: 'inputs/text' },
  { sketch: 'Image', bundleHits: 1019, surface: 'dom-node', domeToolId: 'imageVideo', note: 'inputs/imageVideo' },
  { sketch: 'Video', bundleHits: 883, surface: 'dom-node', domeToolId: 'imageVideo', note: 'inputs/imageVideo' },
  { sketch: 'Audio', bundleHits: 854, surface: 'dom-node', domeToolId: 'audioFile', note: 'inputs/audioFile = audioTool source' },
  { sketch: 'Filter', bundleHits: 765, surface: 'canvas-webgl', domeToolId: 'halftone', note: 'filters/* family (halftone, pixelator, thermal, reLight, facets, typeShape)' },
  { sketch: 'Shape', bundleHits: 607, surface: 'dom-node', domeToolId: 'solidColor', note: 'inputs/solidColor + gradient' },
  { sketch: 'Shader', bundleHits: 564, surface: 'canvas-webgl', domeToolId: 'shaders', note: 'generative/shaders' },
  { sketch: 'Background', bundleHits: 440, surface: 'dom-node', domeToolId: 'solidColor', note: 'inputs/solidColor + gradient' },
  { sketch: 'Tunnel', bundleHits: 305, surface: 'canvas-webgl', domeToolId: 'tunnel', note: 'generative/tunnel' },
  { sketch: 'Particles', bundleHits: 252, surface: 'canvas-webgl', domeToolId: 'particles', note: 'generative/particles (chladni/sphere/cube/flow)' },
  { sketch: 'Ferrofluid', bundleHits: 91, surface: 'canvas-webgl', domeToolId: 'ferrofluid', note: 'generative/ferrofluid' },
  { sketch: 'Kaleidoscope', bundleHits: 69, surface: 'canvas-webgl', domeToolId: 'kaleidoscope', note: 'generative/kaleidoscope' },
  { sketch: 'Oscilloscope', bundleHits: 29, surface: 'canvas-webgl', domeToolId: 'spectrum', note: 'coperto da spectrum in scope mode (T1)' },
  { sketch: 'Waveform', bundleHits: 19, surface: 'canvas-webgl', domeToolId: 'waveform', note: 'src/tools/sketch/waveform.ts (T1)' },
  { sketch: 'Flowfield', bundleHits: 15, surface: 'canvas-webgl', domeToolId: 'flowfield', note: 'generative/flowfield' },
  { sketch: 'Spectrum', bundleHits: 11, surface: 'canvas-webgl', domeToolId: 'spectrum', note: 'src/tools/sketch/spectrum.ts (T1)' },
  { sketch: 'Camera', bundleHits: 0, surface: 'dom-node', domeToolId: 'camera', note: 'inputs/camera (not in bundle grep, editor sidebar has it)' },
] as const

/** Element kinds with no DOME equivalent — the build list. */
export const ELEMENT_GAPS: readonly ElementEntry[] = ELEMENT_CATALOGUE.filter(
  (e) => e.domeToolId === null,
)

/** Sketch tool-slot kinds (activeTool 42, slotTool 22, htmlTool 21, audioTool 7). */
export const TOOL_SLOTS = ['activeTool', 'slotTool', 'htmlTool', 'audioTool', 'savedTool'] as const

export type ToolSlot = (typeof TOOL_SLOTS)[number]
