import { BANDS_LENGTH } from '../engine/types'
import type { NodeDef } from '../engine/types'
import type { NodeRuntimeLike, RegistryEntry } from '../engine/engine'
import type { BandsSnapshot } from '../audio/bands'
import { readBands } from '../audio/engine'

export type SnapshotProvider = () => BandsSnapshot & {
  spectrum: { data: Float32Array }
}

export function createAnalyserRuntime(
  getSnapshot: SnapshotProvider,
): NodeRuntimeLike & { ready(): boolean } {
  return {
    ready: (): boolean => {
      try {
        getSnapshot()
        return true
      } catch {
        return false
      }
    },
    compute: () => {
      const snapshot = getSnapshot()
      return {
        bass: snapshot.bass,
        mid: snapshot.mid,
        treble: snapshot.treble,
        level: snapshot.level,
        spectrum: snapshot.spectrum,
      }
    },
  }
}

const DEF: NodeDef = {
  type: 'analyser.audio',
  label: 'Sound Reader',
  inputs: [],
  outputs: [
    { name: 'bass', type: 'number', defaultValue: 0 },
    { name: 'mid', type: 'number', defaultValue: 0 },
    { name: 'treble', type: 'number', defaultValue: 0 },
    { name: 'level', type: 'number', defaultValue: 0 },
    { name: 'spectrum', type: 'bands', defaultValue: { data: new Float32Array(BANDS_LENGTH) } },
  ],
}

export const entry: RegistryEntry = {
  def: DEF,
  create: () => createAnalyserRuntime(readBands),
}
