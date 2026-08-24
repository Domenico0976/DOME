import type { RegistryEntry } from '../engine/engine'

export interface NodeMetadata {
  readonly type: string
  readonly label: string
  readonly description: string
  readonly category: 'input' | 'analysis' | 'mapping' | 'output'
}

export const NODE_METADATA: readonly NodeMetadata[] = [
  {
    type: 'input.audio-file',
    label: 'Sound Block',
    description: 'Load a track and make the visuals react',
    category: 'input',
  },
  {
    type: 'source.lfo-noise',
    label: 'Wobble',
    description: 'Automatic motion even without music',
    category: 'input',
  },
  {
    type: 'analyser.audio',
    label: 'Sound Reader',
    description: 'Reads bass, mid and high from the connected sound',
    category: 'analysis',
  },
  {
    type: 'map.gain-offset',
    label: 'Reaction',
    description: 'Controls how strongly the visuals react',
    category: 'mapping',
  },
  {
    type: 'render.canvas',
    label: 'Canvas',
    description: 'Draws bars or a mirrored spectrum onto the preview',
    category: 'output',
  },
]

const loaders: Record<string, () => Promise<{ entry: RegistryEntry }>> = {
  'input.audio-file': () => import('./input.audio-file'),
  'source.lfo-noise': () => import('./source.lfo-noise'),
  'analyser.audio': () => import('./analyser.audio'),
  'map.gain-offset': () => import('./map.gain-offset'),
  'render.canvas': () => import('./render.canvas'),
}

export async function loadRegistryEntry(type: string): Promise<RegistryEntry> {
  const loader = loaders[type]
  if (loader === undefined) throw new Error(`Unregistered node type: ${type}`)
  const loaded = await loader()
  return loaded.entry
}
