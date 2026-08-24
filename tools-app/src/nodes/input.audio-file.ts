import type { NodeDef } from '../engine/types'
import type { NodeRuntimeLike, RegistryEntry } from '../engine/engine'
import {
  MediaElementLike,
  CODEC_ERROR_MESSAGE,
  MissingMediaError,
  AudioFileTransport,
  createAudioFileTransport,
  bindMediaElement,
  getBoundMediaElement,
} from '../audio/media-binding'

// Re-export for backward compatibility with existing imports (tests, TransportBar)
export {
  type MediaElementLike,
  CODEC_ERROR_MESSAGE,
  MissingMediaError,
  type AudioFileTransport,
  createAudioFileTransport,
  bindMediaElement,
}

const DEF: NodeDef = {
  type: 'input.audio-file',
  label: 'Audio File',
  inputs: [],
  outputs: [],
}

export const entry: RegistryEntry = (() => {
  let cachedRuntime: NodeRuntimeLike | null = null

  return {
    def: DEF,
    create: () => {
      if (cachedRuntime !== null) return cachedRuntime
      const element = getBoundMediaElement()
      if (element === null) throw new MissingMediaError()
      const bound = createAudioFileTransport(element)
      cachedRuntime = bound.runtime
      return bound.runtime
    },
  }
})()