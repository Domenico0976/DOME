// The ambient bed, looped with a crossfade instead of a hard cut.
//
// Why not `audio.loop = true`: it restarts the file at full volume the frame it
// ends, which on this track is a jump from near-silence into a loud head — an
// audible click in the room.
//
// Two elements of the same source fix it: the outgoing one fades to silence while
// the incoming one fades up from silence, then the roles swap.
//
// Two details are what make it actually seamless:
//
//  1. `loopEnd` — the loop is anchored to where the MUSIC ends, not to where the
//     file ends. Measured on Ambient-music.mp3: 63.86s of file, but the track's
//     body ends at 60.0s and then rings out to ~63.5s. Looping on `duration` puts
//     the crossfade inside that dying tail, so the next loop starts at full level
//     out of near-silence — the "stacco" that survives any amount of fading.
//     Anchored at 60s, the fade-out lands on real music and finishes exactly as
//     the new loop starts, which is the intended behaviour: fade out ends at 1:00,
//     fade in begins at 0:59 of the outgoing track.
//
//  2. The ramp is driven by the MEDIA clock (`currentTime`), not by wall clock.
//     A timer-based ramp drifts: one late tick and the outgoing element is still
//     audible when it has to stop. Reading progress from `currentTime` means the
//     fade is anchored to the audio itself, so a dropped step only skips a
//     volume update, it never moves the end of the fade.
//
// Caller-facing rules:
//   - `start()` resolves true only when playback really began (a blocked autoplay
//     attempt must be reportable: the caller retries on the next gesture).
//   - `stop()` returns to a clean state (both paused at 0) so mute/unmute is not
//     a race with a fade in flight.
//   - a track too short for two crossfades falls back to a native loop.

const FADE_STEP_MS = 33 // ~30 updates/s; the ramp is anchored, so this is smoothness only
const MONITOR_MS = 50

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

export function createAmbient({
  url,
  volume = 0.048,
  crossfadeMs = 1000,
  loopEnd: loopEndOption = 0,
  monitorMs = MONITOR_MS,
  stepMs = FADE_STEP_MS,
  AudioCtor = typeof Audio !== 'undefined' ? Audio : null,
} = {}) {
  if (!AudioCtor) {
    return { start: () => Promise.resolve(false), stop: () => {}, dispose: () => {} }
  }

  const make = () => {
    const el = new AudioCtor(url)
    el.loop = false // binding is ours: the crossfade IS the loop
    el.preload = 'auto'
    el.volume = 0
    return el
  }

  const first = make()
  const second = make()

  let active = first
  let idle = second
  let playing = false
  let monitor = 0
  let fade = 0
  let level = volume

  const clearFade = () => {
    if (fade) {
      clearInterval(fade)
      fade = 0
    }
  }

  const clearMonitor = () => {
    if (monitor) {
      clearInterval(monitor)
      monitor = 0
    }
  }

  const fadeSeconds = crossfadeMs / 1000

  // Where the loop turns over: the musical end when we know it, the file end
  // otherwise.
  function loopEndFor(el) {
    const duration = el.duration
    if (!Number.isFinite(duration) || duration <= 0) return 0
    if (loopEndOption > 0 && loopEndOption < duration) return loopEndOption
    return duration
  }

  function crossfade() {
    if (fade || !playing) return
    const outgoing = active
    const incoming = idle
    const end = loopEndFor(outgoing)
    if (!end) return

    // Anchored to the ideal start of the fade, so the ramp reaches 0 exactly when
    // the loop turns over even if this tick arrived late.
    const startAt = end - fadeSeconds

    try {
      incoming.currentTime = 0
    } catch {
      // Not seekable yet: play() starts at the top anyway.
    }
    incoming.volume = 0
    const started = incoming.play()
    if (started && typeof started.catch === 'function') started.catch(() => {})

    const finalize = () => {
      clearFade()
      outgoing.volume = 0
      try {
        outgoing.pause()
        outgoing.currentTime = 0
      } catch {
        // Pausing an element that already ended throws in some browsers.
      }
      incoming.volume = level
      active = incoming
      idle = outgoing
    }

    fade = setInterval(() => {
      const p = clamp01((outgoing.currentTime - startAt) / fadeSeconds)
      outgoing.volume = clamp01(level * (1 - p))
      incoming.volume = clamp01(level * p)
      if (p >= 1) finalize()
    }, stepMs)
  }

  function tick() {
    if (!playing || fade) return
    const el = active
    const duration = el.duration
    if (!Number.isFinite(duration) || duration <= 0) return
    // Too short to fade both ends: let the browser loop it instead of never
    // hearing anything but the middle.
    if (duration <= fadeSeconds * 2) {
      el.loop = true
      return
    }
    const end = loopEndFor(el)
    if (end - el.currentTime <= fadeSeconds) crossfade()
  }

  return {
    async start() {
      if (playing) return true
      level = volume
      try {
        active.currentTime = 0
      } catch {
        // Not seekable yet; play() starts at 0 anyway.
      }
      active.volume = level
      try {
        await active.play()
      } catch {
        active.volume = 0
        return false
      }
      playing = true
      monitor = setInterval(tick, monitorMs)
      return true
    },

    stop() {
      playing = false
      clearFade()
      clearMonitor()
      for (const el of [first, second]) {
        try {
          el.pause()
          el.currentTime = 0
        } catch {
          // Ignore: the point is silence, not a tidy element.
        }
        el.volume = 0
      }
      active = first
      idle = second
    },

    dispose() {
      this.stop()
      for (const el of [first, second]) {
        try {
          el.src = ''
        } catch {
          // A detached element is already inert.
        }
      }
    },
  }
}
