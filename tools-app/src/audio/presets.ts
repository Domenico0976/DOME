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
  whatItDoes: string
  consequence: string
  risk: string
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
    whatItDoes: 'Binds the Glow intensity slider to the bass band so the bloom swells on every low hit.',
    consequence: 'The scene gains a heartbeat — bright halos pulse in time with the kick drum.',
    risk: 'At high sensitivity the bloom can wash out dark areas; keep amount under 0.6 if your image is already bright.',
    category: 'pulse',
    affects: ['Glow intensity'],
    bindings: [{ effectType: 'glow', param: 'intensity', source: 'bass', amount: 0.5 }],
  },
  {
    id: 'preset_energy_glow',
    name: 'Energy Glow',
    description: 'Image lights up with overall energy.',
    whatItDoes: 'Drives Saturation and Exposure from the overall level (rms) so the image brightens as the track gets louder.',
    consequence: 'The frame feels alive — colours saturate and the image lifts during choruses and drops.',
    risk: 'Exposure can clip to white on dense passages; reduce the exposure amount to 0.2 if highlights blow out.',
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
    whatItDoes: 'Ties Edge Blur intensity to the level band so the outer edges smear outward on every loud transient.',
    consequence: 'Sharp hits get a radial smear that reads like a camera flash bloom at the frame edges.',
    risk: 'With a static image the blur stays frozen at zero — this needs real audio to move; on silence nothing happens.',
    category: 'pulse',
    affects: ['Edge blur intensity'],
    bindings: [{ effectType: 'edgeblur', param: 'intensity', source: 'level', amount: 0.8 }],
  },
  {
    id: 'preset_color_drive',
    name: 'Color Drive',
    description: 'Color temperature follows mids, saturation follows highs.',
    whatItDoes: 'Temperature rides the mid band while saturation rides treble, so the colour grade shifts with the mix.',
    consequence: 'Warm passages warm up further on guitar chords; bright cymbals push saturation.',
    risk: 'Temperature swings can make skin tones drift; use the tint control to pull them back if faces shift colour.',
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
    whatItDoes: 'Waves intensity follows bass and Distort Lens intensity follows mid, so glitch and fisheye answer different parts of the spectrum.',
    consequence: 'The image ripples on the kick and bulges on the snare — two distinct motions from one track.',
    risk: 'Both effects distort geometry; on text layers letters may become unreadable at full intensity.',
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
    whatItDoes: 'Grain intensity rides the treble band so fine noise increases on bright, high-frequency content.',
    consequence: 'Cymbals and hi-hats add a shimmering grain layer over the image.',
    risk: 'Grain at high amounts on already noisy sources compounds noise; dial back if the image gets muddy.',
    category: 'texture',
    affects: ['Grain intensity'],
    bindings: [{ effectType: 'grain', param: 'intensity', source: 'treble', amount: 0.5 }],
  },
]
