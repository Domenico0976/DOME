import type { AudioBinding, EffectType } from '../core/types'

export type PresetCategory = 'pulse' | 'color' | 'motion' | 'texture'

export interface PresetBindingTemplate {
  effectType: EffectType
  param: string
  source: AudioBinding['source']
  amount: number
}

export interface AudioRecipe {
  id: string
  name: string
  description: string
  category: PresetCategory
  affects: string[]
  bindings: PresetBindingTemplate[]
}

export const PRESET_CATEGORIES: Array<{ id: PresetCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'color', label: 'Color' },
  { id: 'motion', label: 'Motion' },
  { id: 'texture', label: 'Texture' },
]

export const AUDIO_RECIPES: AudioRecipe[] = [
  {
    id: 'preset_bass_pulse',
    name: 'Bass Pulse',
    description: 'Makes glow breathe with low frequencies.',
    category: 'pulse',
    affects: ['Glow intensity'],
    bindings: [{ effectType: 'glow', param: 'intensity', source: 'bass', amount: 0.5 }],
  },
  {
    id: 'preset_energy_glow',
    name: 'Energy Glow',
    description: 'Image lights up with overall energy.',
    category: 'color',
    affects: ['Saturation', 'Exposure'],
    bindings: [
      { effectType: 'adjustments', param: 'saturation', source: 'level', amount: 0.4 },
      { effectType: 'adjustments', param: 'exposure', source: 'level', amount: 0.3 },
    ],
  },
  {
    id: 'preset_peak_flash',
    name: 'Peak Flash',
    description: 'Edge blur flashes on loud transients (level).',
    category: 'pulse',
    affects: ['Edge blur intensity'],
    bindings: [{ effectType: 'edgeblur', param: 'intensity', source: 'level', amount: 0.8 }],
  },
  {
    id: 'preset_color_drive',
    name: 'Color Drive',
    description: 'Color temperature follows mids, saturation follows highs.',
    category: 'color',
    affects: ['Temperature', 'Saturation'],
    bindings: [
      { effectType: 'adjustments', param: 'temperature', source: 'mid', amount: 0.5 },
      { effectType: 'adjustments', param: 'saturation', source: 'treble', amount: 0.35 },
    ],
  },
  {
    id: 'preset_motion_react',
    name: 'Motion React',
    description: 'Waves ride the bass, lens follows the mids.',
    category: 'motion',
    affects: ['Waves intensity', 'Lens intensity'],
    bindings: [
      { effectType: 'waves', param: 'intensity', source: 'bass', amount: 0.5 },
      { effectType: 'lens', param: 'intensity', source: 'mid', amount: 0.4 },
    ],
  },
  {
    id: 'preset_detail_react',
    name: 'Detail React',
    description: 'Film grain answers to high frequencies.',
    category: 'texture',
    affects: ['Grain intensity'],
    bindings: [{ effectType: 'grain', param: 'intensity', source: 'treble', amount: 0.5 }],
  },
]
