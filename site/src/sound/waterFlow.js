// Water-flow sound for the hero: the cursor "disturbs" the water, and the speed
// of the movement decides how the sound answers.
//
// Why Web Audio and not `new Audio()` like the click sound: the requirement is
// per-voice gain that changes while the voice plays (newest loud, older ducked),
// plus a pitch shift. An <audio> element only has one global volume and its
// playbackRate cannot be ramped; a BufferSource + GainNode pair per voice gives
// both, sample-accurately, for a handful of extra lines.
//
// The shape of a "hit":
//   1. movement faster than `emitIntervalMs` cadence emits one voice
//      (so a fast sweep is a stream of overlapping voices, not a single blip),
//   2. every voice restarts at a random offset inside the loop, so a repeated
//      stroke never sounds identical,
//   3. gains are recomputed by age: newest = `volume`, then x`duck` per step,
//   4. each voice releases itself after `voiceMs`, so the water falls silent on
//      its own when the cursor stops — no timer to leak.
//
// Everything is pure maths except `createWaterFlow`, which is the only part that
// touches an AudioContext, and takes `contextFactory` + `load` so the tests can
// drive it without a browser.

export const WATER_FLOW = Object.freeze({
  volume: 0.06,
  // Pitch window. Below `speedSlow` px/s the water is low and heavy; above
  // `speedFast` it is the brightest it gets. Playback rate, not a filter: at this
  // pitch range it reads as a different flow, not as a chipmunk.
  rateSlow: 0.35,
  rateFast: 2.68,
  speedSlow: 150,
  speedFast: 2200,
  emitIntervalMs: 110,
  maxVoices: 5,
  duck: 0.45,
  fadeInMs: 25,
  fadeOutMs: 220,
  voiceMs: 1200,
})

export function waterFlowUrl() {
  return import.meta.env.BASE_URL + 'assets/audio/water/water-flow.mp3'
}

/** Playback rate for a cursor speed in px/s. Linear between the two anchors. */
export function rateForSpeed(speed, cfg = WATER_FLOW) {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0
  if (s <= cfg.speedSlow) return cfg.rateSlow
  if (s >= cfg.speedFast) return cfg.rateFast
  const t = (s - cfg.speedSlow) / (cfg.speedFast - cfg.speedSlow)
  return cfg.rateSlow + (cfg.rateFast - cfg.rateSlow) * t
}

/** Target gain for a voice, 0 = newest. 0.45, 0.2475, 0.136, 0.075, 0.041 … */
export function gainForAge(age, cfg = WATER_FLOW) {
  const steps = Math.max(0, Math.floor(age))
  return cfg.volume * Math.pow(cfg.duck, steps)
}

function defaultContextFactory() {
  const Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null
  return Ctor ? new Ctor() : null
}

function defaultLoad(ctx, url) {
  return fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
}

export function createWaterFlow({
  cfg = WATER_FLOW,
  url,
  contextFactory = defaultContextFactory,
  load,
  random = Math.random,
} = {}) {
  let ctx = null
  let master = null
  let buffer = null
  let loading = null
  let enabled = true
  let disposed = false
  let warned = false
  let warmed = false
  let lastEmitAt = -Infinity
  // Oldest first: `move` pushes, the cap trims from the front, age is derived
  // from the index, so the array order IS the ducking order.
  const voices = []

  const loader = load || ((context) => defaultLoad(context, url || waterFlowUrl()))

  function ensureContext() {
    if (ctx || disposed) return ctx
    ctx = contextFactory()
    if (!ctx) return null
    master = ctx.createGain()
    master.gain.value = enabled ? 1 : 0
    master.connect(ctx.destination)
    return ctx
  }

  // Warm the HTTP cache without creating an AudioContext.
  //
  // Creating a context before a gesture is what makes Chrome print "The
  // AudioContext was not allowed to start" and leaves it suspended. The file is
  // 23 KB: pre-fetching the bytes (no audio objects involved) means the decode
  // inside the gesture is instant, so the first stroke still has sound.
  function warm() {
    if (warmed || disposed) return
    warmed = true
    try {
      fetch(url || waterFlowUrl(), { cache: 'force-cache' }).catch(() => {})
    } catch {
      // No fetch (old browser / test env): the decode path will fetch later.
    }
  }

  function preload() {
    if (buffer) return Promise.resolve(buffer)
    if (loading) return loading
    // Never create a context outside a gesture: `unlock()` is the only door.
    if (!ctx) return Promise.resolve(null)
    loading = Promise.resolve(loader(ctx))
      .then((decoded) => {
        buffer = decoded || null
        if (!buffer && !warned) {
          warned = true
          console.warn('[waterFlow] the water buffer did not decode — check assets/audio/water/water-flow.mp3')
        }
        return buffer
      })
      .catch((err) => {
        // Swallowing this is how the sound could stay silent with nothing in the
        // console to explain it. One warning, then quiet.
        if (!warned) {
          warned = true
          console.warn('[waterFlow] could not load the water sound', err)
        }
        return null
      })
      .then((value) => {
        loading = null
        return value
      })
    return loading
  }

  function unlock() {
    if (disposed) return Promise.resolve(false)
    // The context is created HERE, inside the caller's gesture: creating it on
    // load is what Chrome blocks (and warns about) for the whole session.
    const context = ensureContext()
    if (!context) return Promise.resolve(false)
    // Deliberately not awaiting the decode: a slow or stuck buffer load must not
    // be able to hold the resume hostage. The two finish independently, and
    // `move()` retries the load if the buffer is still missing.
    preload()
    if (context.state !== 'suspended') return Promise.resolve(true)
    try {
      context.resume().catch(() => {})
    } catch {
      return Promise.resolve(false)
    }
    // "Asked, inside a gesture" is the honest answer: Chrome flips the state
    // asynchronously and, without activation, may leave the promise pending
    // forever. Callers that need the truth read `isRunning()`.
    return Promise.resolve(true)
  }

  function detach(voice) {
    const index = voices.indexOf(voice)
    if (index >= 0) voices.splice(index, 1)
  }

  function release(voice, fadeSec) {
    if (!ctx) return
    const t = ctx.currentTime
    try {
      voice.gain.gain.cancelScheduledValues(t)
      voice.gain.gain.setTargetAtTime(0, t, Math.max(0.01, fadeSec) / 3)
      voice.src.stop(t + Math.max(0.01, fadeSec) * 3)
    } catch {
      // A voice that already ended throws on stop(); nothing to do about it.
    }
  }

  // Recompute every voice's target gain from its age. Smooth (`setTargetAtTime`,
  // ~60ms) so a new voice makes the others lean down instead of stepping.
  // Voices already released (cap trim, mute) are out of the array, so they keep
  // the fade they were given instead of being revived here.
  function retarget() {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i]
      // Past its scheduled release: it is fading out on purpose, lending it a new
      // (louder) target here would audibly un-fade it for a frame.
      if (voice.stopAt !== undefined && voice.stopAt <= t) continue
      const age = voices.length - 1 - i
      try {
        voice.gain.gain.setTargetAtTime(gainForAge(age, cfg), t, 0.06)
      } catch {
        // Voice already disconnected — the retarget is moot, not an error.
      }
    }
  }

  function emit(rate) {
    if (!ctx || !buffer) return false
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.playbackRate.value = rate

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(gainForAge(0, cfg), t + cfg.fadeInMs / 1000)

    src.connect(gain)
    gain.connect(master)

    // Random start point: the file is short, so always starting at 0 turns a
    // stroke into an obvious loop. Seamless because the source loops.
    const span = Math.max(0, (buffer.duration || 0) - 0.05)
    const offset = span > 0 ? random() * span : 0
    src.start(t, offset)

    const voice = { src, gain }
    src.onended = () => detach(voice)

    // Self-release, scheduled on the audio clock (no setTimeout to leak): the
    // gain falls to 0 after `voiceMs` and the source stops a fade later. A voice
    // retargeted by newer movement is still stopped on this schedule, which is
    // what makes the water go quiet on its own when the cursor stops.
    const stopAt = t + cfg.voiceMs / 1000
    voice.stopAt = stopAt
    gain.gain.setTargetAtTime(0, stopAt, cfg.fadeOutMs / 3000)
    try {
      src.stop(stopAt + (cfg.fadeOutMs / 1000) * 1.5)
    } catch {
      // stopAt is always in the future here; the guard is for exotic contexts.
    }

    voices.push(voice)
    while (voices.length > cfg.maxVoices) {
      release(voices.shift(), 0.08)
    }
    retarget()
    return true
  }

  return {
    /** Fetch the file into the HTTP cache. No AudioContext is created. */
    warm,

    /** Load and decode the buffer. Requires a context, i.e. an unlock. */
    preload,

    /** Create the context inside the caller's gesture, then resume and load. */
    unlock,

    /**
     * One movement sample. `speed` is px/s. Returns true when a voice started,
     * so the caller can tell "throttled" from "silenced".
     */
    move(speed) {
      if (disposed || !enabled || !ctx) return false
      if (!buffer) {
        // A decode that failed or is still in flight must not silence the feature
        // for the rest of the session: ask again on the next stroke. No context is
        // ever created here — that only happens in `unlock()`.
        if (!loading) preload()
        return false
      }
      if (ctx.state === 'suspended') return false
      const t = ctx.currentTime
      if (t - lastEmitAt < cfg.emitIntervalMs / 1000) return false
      lastEmitAt = t
      return emit(rateForSpeed(speed, cfg))
    },

    setEnabled(next) {
      enabled = next !== false
      if (!ctx) return enabled
      const t = ctx.currentTime
      try {
        master.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.02)
      } catch {
        master.gain.value = enabled ? 1 : 0
      }
      if (!enabled) {
        for (const voice of voices.slice()) release(voice, 0.12)
        voices.length = 0
      }
      return enabled
    },

    isReady: () => !!buffer,
    isRunning: () => !!ctx && ctx.state === 'running',
    voiceCount: () => voices.length,
    config: cfg,

    dispose() {
      if (disposed) return
      disposed = true
      for (const voice of voices.slice()) release(voice, 0.05)
      voices.length = 0
      try {
        ctx?.close?.()
      } catch {
        // Closing an already-closed context is fine.
      }
      ctx = null
      master = null
      buffer = null
      loading = null
    },
  }
}
