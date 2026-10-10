/**
 * Shared audio runtime — the single place that owns the live `<audio>` element
 * and the microphone stream. The zustand store never touches these directly;
 * it only stores the *identity* (source kind, file name, duration, volume).
 *
 * This keeps the store serializable and lets the AudioBar (the single owner
 * of the hook instance) drive the element while every other component reads
 * the store.
 */

export type AudioRuntime = {
  readonly media: HTMLAudioElement | null
  readonly stream: MediaStream | null
  setMedia(el: HTMLAudioElement | null): void
  setStream(s: MediaStream | null): void
  setVolume(v: number): void
  dispose(): void
  onCanPlay(cb: () => void): () => void
}

let mediaEl: HTMLAudioElement | null = null
let micStream: MediaStream | null = null
const canPlayCallbacks = new Set<() => void>()

function attachCanPlay(el: HTMLAudioElement) {
  const handler = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      for (const cb of canPlayCallbacks) {
        try { cb() } catch { /* swallow */ }
      }
    }
  }
  el.addEventListener('canplay', handler, { once: true })
  el.addEventListener('loadedmetadata', handler)
  ;(el as any).__canplayHandler = handler
}

function detachCanPlay(el: HTMLAudioElement) {
  const handler = (el as any).__canplayHandler
  if (handler) {
    el.removeEventListener('canplay', handler)
    el.removeEventListener('loadedmetadata', handler)
    delete (el as any).__canplayHandler
  }
}

export function getAudioRuntime(): AudioRuntime {
  return {
    get media() { return mediaEl },
    get stream() { return micStream },
    setMedia(el) {
      if (mediaEl === el) return
      if (mediaEl) {
        detachCanPlay(mediaEl)
        try { mediaEl.pause() } catch { /* swallow */ }
      }
      mediaEl = el
      if (el) attachCanPlay(el)
    },
    setStream(s) {
      if (micStream === s) return
      micStream = s
    },
    setVolume(v) {
      const clamped = Math.max(0, Math.min(1, Number(v) || 0))
      if (mediaEl) mediaEl.volume = clamped
    },
    dispose() {
      if (mediaEl) {
        detachCanPlay(mediaEl)
        try { mediaEl.pause() } catch { /* swallow */ }
        mediaEl = null
      }
      if (micStream) {
        for (const track of micStream.getTracks()) track.stop()
        micStream = null
      }
      canPlayCallbacks.clear()
    },
    onCanPlay(cb) {
      canPlayCallbacks.add(cb)
      // Fire immediately if already loaded
      if (mediaEl && Number.isFinite(mediaEl.duration) && mediaEl.duration > 0) {
        try { cb() } catch { /* swallow */ }
      }
      return () => { canPlayCallbacks.delete(cb) }
    },
  }
}