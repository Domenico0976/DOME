export type ToolKind = 'input' | 'generative' | 'filter'

export type ControlDef = {
  param: string
  label: string
  kind: 'slider' | 'select' | 'color' | 'text'
  min?: number
  max?: number
  step?: number
  options?: string[]
}

export type AudioBinding = {
  param: string
  source: 'bass' | 'mid' | 'treble' | 'level' | 'spectrum' | 'bpm'
  band?: number
  curve: 'linear' | 'invert'
  amount: number
}

export type Automation = {
  param: string
  keyframes: { timeSec: number; value: number; easing: 'linear' | 'ease' }[]
}

export type MidiBinding = { uid: string; param: string; cc: number }

export type EffectType =
  | 'adjustments'
  | 'aberration'
  | 'glow'
  | 'waves'
  | 'edgeblur'
  | 'lens'
  | 'grain'

export type EffectInstance = {
  uid: string
  type: EffectType
  enabled: boolean
  params: Record<string, number>
}

export type StackItem = {
  uid: string
  toolId: string
  toolVersion: string
  params: Record<string, number | string>
  audio: AudioBinding[]
  automations: Automation[]
  hidden: boolean
  effects?: EffectInstance[]
}

export type ProjectState = {
  schemaVersion: number
  stack: StackItem[]
  selectedUid: string | null
  timeline: { durationSec: number; bpm: number; playing: boolean; timeSec: number }
  audio: { enabled: boolean; source: 'mic' | 'file' | null; fileName?: string; midi: { enabled: boolean; bindings: MidiBinding[] } }
  canvas: { aspect: '1:1' | '3:4' | '9:16' | '4:3' | '16:9'; quality: 'low' | 'med' | 'high' | '4k' }
  theme: 'dark' | 'light'
  unsaved: boolean
}

export type Frame = { timeSec: number; dt: number; bpm: number }

export type AudioFrame = {
  bass: number
  mid: number
  treble: number
  level: number
  spectrum: Float32Array
  bpm: number
}

export type StackRenderContext = { width: number; height: number; quality: 'low' | 'med' | 'high' | '4k' }

export type ToolDef = {
  id: string
  kind: ToolKind
  version: string
  label: string
  icon: string
  category: 'Inputs' | 'Generative' | 'Filters'
  defaultParams: Record<string, number | string>
  controls: ControlDef[]
  render(ctx: CanvasRenderingContext2D, frame: Frame, item: StackItem, audio: AudioFrame, stack: StackRenderContext): void
}
