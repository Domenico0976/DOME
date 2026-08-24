export interface MediaElementLike {
  play(): Promise<void>
  pause(): void
  loop: boolean
  addEventListener(type: 'ended', listener: () => void): void
  removeEventListener(type: 'ended', listener: () => void): void
}

export const CODEC_ERROR_MESSAGE = 'Your browser does not support this audio format'

export class MissingMediaError extends Error {
  constructor() {
    super('No media element attached')
    this.name = 'MissingMediaError'
  }
}

export interface AudioFileTransport {
  play(): void
  pause(): void
  setAutoLoop(enabled: boolean): void
  isAutoLoopOn(): boolean
  isEnded(): boolean
}

export function createAudioFileTransport(
  element: MediaElementLike,
  onPlaybackError?: (message: string) => void,
): { runtime: { compute(): Record<string, never>; ready(): boolean }; transport: AudioFileTransport } {
  element.loop = true
  let ended = false
  const onEnded = (): void => {
    ended = true
  }
  element.addEventListener('ended', onEnded)

  const runtime = {
    ready: (): boolean => true,
    compute: (): Record<string, never> => ({}),
  }

  const transport: AudioFileTransport = {
    play(): void {
      void element.play().catch(() => onPlaybackError?.(CODEC_ERROR_MESSAGE))
    },
    pause(): void {
      element.pause()
    },
    setAutoLoop(enabled: boolean): void {
      element.loop = enabled
    },
    isAutoLoopOn(): boolean {
      return element.loop
    },
    isEnded(): boolean {
      return ended
    },
  }

  return { runtime, transport }
}

let boundElement: MediaElementLike | null = null

export function bindMediaElement(element: MediaElementLike): void {
  boundElement = element
}

export function getBoundMediaElement(): MediaElementLike | null {
  return boundElement
}
