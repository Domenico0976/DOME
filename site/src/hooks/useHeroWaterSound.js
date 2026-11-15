import { useEffect } from 'react'
import { useCursorGate } from './useCursorGate.js'
import { soundCore } from '../sound/core.js'
import { getWaterEngine } from '../sound/waterBoot.js'
import { isPreloaderVisible } from '../utils/preloaderGate.js'

// Movement thresholds for the hero water sound.
const RECT_TTL_MS = 200 // cached hero rect: layout reads on every move are wasteful
const MIN_DT_MS = 8 // sub-8ms deltas explode the px/s figure
const MIN_MOVE_PX = 1 // ignore jitter that is not a deliberate stroke
const TELEPORT_PX = 400 // a jump this big is a re-placement, not a movement
const ARM_COOLDOWN_MS = 200 // do not hammer resume() on every pixel
const ARM_RETRY_MS = 500 // backstop while the context is still suspended

// Drives the water sound from movement inside the hero.
//
// Two input sources, one rule: the sound follows the cursor the user is actually
// moving over the hero.
//   - desktop: `pointermove`, if the pointer is inside the hero's rect;
//   - touch: the parked mobile cursor, sampled per frame and only while it is
//     AWAKE (i.e. the user is dragging it). A bare finger scroll therefore never
//     makes a sound — that was the requirement, and `isAwake` is exactly the flag
//     the whole effect layer already keys on (`useCursorGate`).
//
// The engine itself is page-scoped (`sound/waterBoot.js`) because the AudioContext
// must be unlocked inside the FIRST gesture, which happens before this component
// mounts. Here we only own the movement maths and the readiness bookkeeping, and
// readiness is read from the context (`isRunning()`) — never latched from a
// promise, which the platform may leave pending forever without a gesture.
export function useHeroWaterSound(sectionRef) {
  const { isTouch, isAwake, parked } = useCursorGate()

  useEffect(() => {
    const engine = getWaterEngine()
    let disposed = false
    let lastTry = -Infinity
    let inFlightUntil = 0
    // The visit's first real interaction. Before it, no AudioContext is created.
    let gestureSeen = false

    // ─── Hero rect (cached) ────────────────────────────────────────────────
    const rect = { value: null, at: -Infinity }
    const heroRect = () => {
      const now = performance.now()
      if (rect.value && now - rect.at < RECT_TTL_MS) return rect.value
      const el = sectionRef?.current
      rect.value = el ? el.getBoundingClientRect() : null
      rect.at = now
      return rect.value
    }
    const insideHero = (x, y) => {
      const r = heroRect()
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    }

    // The invite chip disappears as soon as the context is really running.
    const syncLock = () => {
      if (engine.isRunning()) soundCore.setLocked(false)
    }

    // ─── Asking the context to start ───────────────────────────────────────
    // Browsers only allow this inside a real gesture; everywhere else it is a
    // no-op we do not care about. The `inFlightUntil` window (not a boolean)
    // means a `resume()` promise that never settles cannot wedge the retry loop —
    // that exact hang is what kept the water silent for a whole session.
    const arm = () => {
      if (disposed || !soundCore.isEnabled()) return
      // Never create the context before the visit's first interaction: the
      // platform refuses it and Chrome logs a warning for the whole session.
      if (!gestureSeen) return
      // Never start the water while the gate is up: the hero is not visible, so
      // the sound has nothing to describe. The context is created by the entry
      // chip or by the first gesture on the home instead.
      if (isPreloaderVisible()) return
      if (engine.isRunning()) {
        syncLock()
        return
      }
      const now = performance.now()
      if (now < inFlightUntil || now - lastTry < ARM_COOLDOWN_MS) return
      lastTry = now
      inFlightUntil = now + 1000
      const settle = () => {
        inFlightUntil = 0
        syncLock()
      }
      engine.unlock().then(settle, settle)
    }

    engine.setEnabled(soundCore.isEnabled())
    syncLock()

    // The invite chip runs this inside a real click, which is the one place the
    // platform lets the context start.
    const stopUnlockRequest = soundCore.onUnlockRequest(() =>
      engine.unlock().then(() => {
        syncLock()
        return engine.isRunning()
      }),
    )

    // ─── Desktop: the mouse ───────────────────────────────────────────────
    let last = null
    const onPointerMove = (e) => {
      if (disposed || e.pointerType === 'touch') return
      const now = performance.now()
      const prev = last
      last = { x: e.clientX, y: e.clientY, t: now }
      if (!prev) return
      const dt = Math.max(MIN_DT_MS, now - prev.t)
      const dist = Math.hypot(last.x - prev.x, last.y - prev.y)
      if (dist < MIN_MOVE_PX || dist > TELEPORT_PX) return
      if (!insideHero(last.x, last.y)) return
      // Gate up = the hero is behind the preloader: silent, whatever the pointer.
      if (isPreloaderVisible()) return
      if (!engine.isRunning()) {
        arm()
        return
      }
      engine.move((dist / dt) * 1000)
    }
    // ─── Touch: the dragged mobile cursor only ────────────────────────────
    let raf = 0
    let prevParked = null
    let prevT = 0
    const sample = (now) => {
      raf = requestAnimationFrame(sample)
      if (disposed) return
      if (!isAwake.current) {
        prevParked = null
        return
      }
      const p = parked.current
      if (!p) return
      const prev = prevParked
      prevParked = { x: p.x, y: p.y }
      const dt = Math.max(MIN_DT_MS, now - prevT)
      prevT = now
      if (!prev) return
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y)
      if (dist < MIN_MOVE_PX || dist > TELEPORT_PX) return
      if (!insideHero(p.x, p.y)) return
      if (isPreloaderVisible()) return
      if (!engine.isRunning()) {
        arm()
        return
      }
      engine.move((dist / dt) * 1000)
    }

    if (isTouch) {
      raf = requestAnimationFrame(sample)
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
    }

    // Every event that can legally unlock audio, retried until one works.
    // Capture phase on window: a handler deeper in the page that stops propagation
    // must not be able to hide the visit's first interaction from us.
    const GESTURES = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchstart', 'touchend']
    const CAPTURE = { capture: true, passive: true }
    const onGesture = () => {
      gestureSeen = true
      arm()
    }
    for (const type of GESTURES) window.addEventListener(type, onGesture, CAPTURE)

    // Backstop: a gesture may have landed before any listener existed (module
    // boot covers that) or the resume may have been refused in that instant.
    // Gated on `gestureSeen`: creating an AudioContext before the visit's first
    // interaction is exactly what the platform blocks, and doing it here only
    // produced a suspended context plus a console warning.
    const retry = setInterval(() => {
      if (disposed || !gestureSeen) return
      if (!isPreloaderVisible() && !engine.isRunning()) arm()
    }, ARM_RETRY_MS)

    const unsubscribe = soundCore.subscribe((on) => {
      engine.setEnabled(on)
      if (on && gestureSeen) arm()
    })

    return () => {
      disposed = true
      clearInterval(retry)
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      for (const type of GESTURES) window.removeEventListener(type, onGesture, CAPTURE)
      stopUnlockRequest()
      unsubscribe()
      // The engine is page-scoped and shared with the boot: it must NOT be
      // disposed here, or StrictMode's double mount would close the context the
      // second mount is about to use.
    }
  }, [isTouch, sectionRef, isAwake, parked])
}
