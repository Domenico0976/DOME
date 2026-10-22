// Preloader orchestrator (vanilla, runs OUTSIDE React). V3: the ONE GL scene
// mounts immediately at boot, and everything else is a phase change of the
// same shader — no second canvas, no star handle, no DOM reveal mask:
//
//   standby — ring scrolling, counter hidden, front parked at sweepFront(0);
//             nothing is consumed yet
//   count   — click starts the clock and fades the counter up; the displayed
//             value chases the real load (creep-floored) toward 100 without
//             ever parking while the front stays parked. Crossing SEAL_TRIGGER
//             starts the seal (if load, app and fonts are ready)
//   seal    — the wave-1 front is driven by the displayed count, so crumble
//             and number move as one: ring first, digits last, all dead at 100.
//             The root fades to transparent across the same gesture, so the
//             home composes through the dying tiles — no cover, no handoff
//   cover   — no-gl only: a CSS fade, since there is no canvas to crumble
//
// App.jsx marks <html data-app-ready> once mounted; seal waits for that so the
// real site sits behind the mask before uncovering. It is a DOM attribute
// rather than a callback because the two entry points race to start (see App).
// prefers-reduced-motion or no WebGL -> preloader--no-gl: no canvas, the DOM
// counter text carries the same machine and the cover phase is a CSS fade.

import { shouldRunPreloader, markVisited } from './session-gate.js'
import { createPreloaderScene } from './scene.js'
import { formatCounter } from './counter-texture.js'
import {
  TIMELINE,
  FINAL_COUNT,
  SEAL_TRIGGER,
  SEAL_FRONT_END,
  creepProgress,
  displayProgress,
  easeOutCubic,
  shouldMountGL,
} from './config.js'
import { sweepFront } from './wavefront.js'
import { onProgress, whenSettled, markDone } from '../load-progress.js'

// Catastrophe cover: if the load never settles or the app never mounts, seal
// and the count force anyway after this many ms since the click, trading one
// imperfect reveal for the one thing the preloader exists to prevent — being
// trapped on a gate. App mount is a separate signal from load end (the two
// race — see App.jsx), so both must be observed here.
const SETTLED_WAIT_CAP = 4000
const LENIS_POLL_MS = 200
const LENIS_POLL_MAX_TRIES = 100

function start() {
  const root = document.getElementById('preloader')
  if (!root) return

  if (!shouldRunPreloader()) {
    root.remove()
    return
  }

  window.__preloader = {
    getStats() {
      return scene ? scene.getStats() : null
    },
  }

  const html = document.documentElement
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const sr = root.querySelector('.preloader__sr')
  const fallback = root.querySelector('.preloader__fallback')

  const previousOverflow = html.style.overflow
  html.style.overflow = 'hidden'

  // Lenis smooth scroll is started elsewhere and may attach after this module:
  // poll for the handle, stop it as soon as it exists, restart it at finish.
  let lenisHandle = null
  let lenisTries = 0
  const lenisPollId = setInterval(() => {
    if (lenisHandle) {
      clearInterval(lenisPollId)
      return
    }
    const l = window.__lenis
    if (l) {
      lenisHandle = l
      clearInterval(lenisPollId)
      try {
        lenisHandle.stop()
      } catch (err) {
        console.error('[preloader] lenis.stop() failed:', err)
      }
      return
    }
    lenisTries += 1
    if (lenisTries > LENIS_POLL_MAX_TRIES) clearInterval(lenisPollId)
  }, LENIS_POLL_MS)

  let scene = null
  if (shouldMountGL(reducedMotion)) {
    try {
      const mount = root.querySelector('.preloader__canvas')
      scene = createPreloaderScene(mount)
      scene.redrawCounter(0)
    } catch (err) {
      console.error('[preloader] WebGL scene failed to start:', err)
      scene = null
    }
  }
  if (!scene) root.classList.add('preloader--no-gl')

  // Real load state, sampled by the loop rather than pushed into it: the count
  // and the front are drawn from one place per frame, so they cannot disagree.
  let loadProgress = 0
  let loadSettled = false
  onProgress((p) => {
    loadProgress = p
  })
  whenSettled().then(() => {
    loadSettled = true
    markDone()
  })

  function announce(value) {
    const text = formatCounter(value)
    if (sr) sr.textContent = text
    if (fallback) fallback.textContent = text
  }

  // The display chases its target with displayProgress, so the count rolls as
  // one smooth gesture instead of stepping in jumps; the canvas texture redraw
  // is value-guarded inside the scene.
  let shownProgress = 0
  let previousProgressAt = 0
  function driveProgress(target, now) {
    const dt = previousProgressAt ? now - previousProgressAt : 16
    previousProgressAt = now
    shownProgress = displayProgress(shownProgress, target, dt)
    const value = Math.round(shownProgress * FINAL_COUNT)
    if (scene) scene.redrawCounter(value)
    announce(value)
  }

  let rafId = 0
  let disposed = false
  let tickFailed = false
  let phase = 'standby'
  let gateAt = 0
  const SEAL_AT = SEAL_TRIGGER / FINAL_COUNT
  let sealDone = false
  let coverStart = 0
  let fontsReady = false
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(
      () => { fontsReady = true },
      () => { fontsReady = true },
    )
  } else {
    fontsReady = true
  }

  function openGate() {
    if (phase !== 'standby') return
    phase = 'count'
    gateAt = performance.now()
    root.classList.add('preloader--dissolve', 'preloader--counting')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') openGate()
  }

  function onResize() {
    if (scene) scene.resize()
  }

  function finish() {
    if (disposed) return
    disposed = true
    if (rafId) cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    root.removeEventListener('click', openGate)
    clearInterval(lenisPollId)
    if (scene) scene.dispose()
    if (lenisHandle) {
      try {
        lenisHandle.scrollTo(0, { immediate: true })
      } catch (err) {
        console.error('[preloader] lenis.scrollTo() failed:', err)
      }
      try {
        lenisHandle.start()
      } catch (err) {
        console.error('[preloader] lenis.start() failed:', err)
      }
    } else {
      try {
        window.scrollTo(0, 0)
      } catch (_) {
      }
    }
    html.style.overflow = previousOverflow
    root.remove()
    markVisited()
  }

  function safeTick(now) {
    if (disposed) return
    if (tickFailed) {
      // A hard failure mid-erase used to leave the site sealed; reveal anyway.
      finish()
      return
    }
    try {
      tick(now)
    } catch (err) {
      console.error('[preloader] animation failed:', err)
      tickFailed = true
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  function tick(now) {
    if (disposed) return

    if (phase === 'standby') {
      if (scene) {
        scene.setDigitGate(0)
        scene.setRingDock(0)
        scene.setFront(sweepFront(0))
      }
      rafId = requestAnimationFrame(safeTick)
      return
    }

    const waited = now - gateAt
    const appMounted = html.dataset.appReady === '1'
    const docked = easeOutCubic(Math.min(1, waited / TIMELINE.DIGIT_RISE))
    if (scene) {
      scene.setDigitGate(docked)
      scene.setRingDock(docked)
    }

    const countHeld = shownProgress >= SEAL_AT - 0.001
    const readyToSeal =
      (loadSettled && appMounted && fontsReady && countHeld) || waited > SETTLED_WAIT_CAP

    // count — the front stays parked the whole way: the crumble has not started
    // yet, the rolling number is the only motion. No cap, no parking at the
    // trigger: the count rolls straight through 080 whenever it is ready.
    if (!readyToSeal) {
      if (scene) scene.setFront(sweepFront(0))
      const target = loadSettled
        ? Math.max(loadProgress, 1)
        : Math.max(loadProgress, creepProgress(waited))
      driveProgress(target, now)
      rafId = requestAnimationFrame(safeTick)
      return
    }

    // seal — the front is driven by the displayed count, not by the clock, so
    // the crumble tracks the rolling number with zero gap: ring first, digits
    // last, all dead exactly at 100. The root fades to transparent across the
    // same gesture, so the home composes through the dying tiles — the reveal
    // begins while the last digits burn, fully connected, no cover flash.
    if (!sealDone) {
      const sealX = Math.max(0, Math.min(1, (shownProgress - SEAL_AT) / (1 - SEAL_AT)))
      if (scene) {
        scene.setFront(sealX * SEAL_FRONT_END)
        root.style.backgroundColor = `rgba(245, 241, 234, ${(1 - sealX).toFixed(3)})`
      }
      driveProgress(1, now)
      if (shownProgress >= 0.999) sealDone = true
      rafId = requestAnimationFrame(safeTick)
      return
    }

    // GL path needs no cover: canvas and root are already transparent, the home
    // is fully composed behind — removing the root changes nothing visible.
    if (scene) {
      finish()
      return
    }

    if (coverStart === 0) {
      coverStart = now
      root.classList.add('preloader--reveal')
    }

    const p = Math.min(1, (now - coverStart) / TIMELINE.REVEAL)

    if (p >= 1) {
      finish()
      return
    }
    rafId = requestAnimationFrame(safeTick)
  }

  root.addEventListener('click', openGate)
  window.addEventListener('keydown', onKeyDown, { passive: true })
  window.addEventListener('resize', onResize)

  announce(0)
  rafId = requestAnimationFrame(safeTick)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
