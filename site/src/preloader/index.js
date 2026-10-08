// Preloader orchestrator (vanilla, runs OUTSIDE React).
//
// Phased animation, all driven by the same shader (see shader.js):
//   boot   — the grey opening is up, counter at 000, no tile alive yet
//   open   — "Grigia in apertura": the counter eases 000 -> 100 (clamped) while
//            the front eats the first half of the canvas, slower than the count
//   seal   — counter at 100, the front completes the canvas
//   reveal — the same gesture again from the top-left corner, showing the
//            homepage through the tiles
//
// The phases are contiguous, so the two tile bands never overlap: seal ends
// with the front past the canvas, and reveal restarts from the corner.
// Timing/easing live in config.js, the wave maths in wavefront.js.
//
// App.jsx marks <html data-app-ready> once it has mounted; reveal waits for that
// so the real site is behind the mask before we uncover it. It is a DOM attribute
// rather than a callback into this object because the two entry points race to
// start — see the note in App.jsx.
// prefers-reduced-motion -> discrete counter + 200ms fade, no tiles.
// No WebGL -> DOM fallback (paper bg + big counter text), then fade out.
//
// The counter is not a timer. It reads real load progress (see load-progress.js):
// bytes delivered for the app's chunks, gated on the shader chunk actually having
// resolved. It used to ease 000 -> 100 over a fixed 2400ms and only then wait, so
// on a cold load it read 100 while several seconds of script were still arriving.

import { shouldRunPreloader, markVisited } from './session-gate.js'
import { createPreloaderScene } from './scene.js'
import { formatCounter } from './counter-texture.js'
import {
  TIMELINE,
  creepProgress,
  displayProgress,
  idleFront,
  phaseFront,
  shouldMountGL,
  followStep,
  revealProgress,
} from './config.js'
import { sweepFront } from './wavefront.js'
import { revealRadius, revealMaskImage } from './reveal.js'
import { onProgress, whenSettled, markDone } from '../load-progress.js'

// How long the open phase may wait for the shader chunk before revealing anyway.
// Short on purpose. The page does not need that chunk to be usable: the hero
// section paints its own background image and the callout renders its DOM text,
// so an unfinished chunk costs a hero that upgrades a moment later, not a blank
// page. Holding the visitor for seconds to save that trade is the wrong way
// round — it is the "preload frozen at 100" complaint. On a connection fast enough
// the chunk lands well inside this and the shader is live at reveal.
const SETTLED_WAIT_CAP = 2200

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
  const prevOverflow = html.style.overflow
  html.style.overflow = 'hidden'

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const sr = root.querySelector('.preloader__sr')
  const fallback = root.querySelector('.preloader__fallback')

  const appRoot = document.getElementById('root')

  function setRevealMask(front) {
    if (!appRoot) return
    const css = revealMaskImage(revealRadius(front, window.innerWidth, window.innerHeight))
    appRoot.style.webkitMaskImage = css
    appRoot.style.maskImage = css
  }

  let scene = null
  const usingGL = shouldMountGL(reducedMotion)
  if (usingGL) {
    try {
      const mount = root.querySelector('.preloader__canvas')
      scene = createPreloaderScene(mount, { reducedMotion })
      scene.redrawCounter(0)
    } catch (err) {
      console.error('[preloader] WebGL scene failed to start:', err)
      root.classList.add('preloader--no-gl')
    }
  } else {
    root.classList.add('preloader--no-gl')
  }

  function announce(v) {
    const txt = formatCounter(v)
    if (sr) sr.textContent = txt
    if (fallback) fallback.textContent = txt
  }
  announce(0)

  let rafId = 0
  let disposed = false
  let revealStart = 0
  let sealStart = 0
  let sealDone = false
  let currentFront = sweepFront(0)
  let lastFrame = 0
  let cutPending = false
  const startTime = performance.now()

  // Real load state, sampled by the loop rather than pushed into it: the counter
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

  function driveFront(target, now, snap = false) {
    if (!scene) return
    const dt = lastFrame ? now - lastFrame : 16
    lastFrame = now
    currentFront = followStep(currentFront, target, dt, undefined, snap)
    scene.setFront(currentFront)
  }

  function finish() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    if (scene) scene.dispose()
    if (appRoot) {
      appRoot.style.webkitMaskImage = ''
      appRoot.style.maskImage = ''
      appRoot.style.overflow = 'visible'
    }
    html.style.overflow = prevOverflow
    root.remove()
    markVisited()
  }

  function onResize() {
    if (scene) scene.resize()
  }
  window.addEventListener('resize', onResize)

  function setProgress(p) {
    const v = p * 100
    if (scene) scene.redrawCounter(v)
    announce(v)
  }

  if (reducedMotion) {
    runReducedMotion()
    return
  }

  // A throw inside the loop used to end it silently: the preloader stayed on screen
  // forever with no error anywhere, because an exception in a rAF callback never
  // reaches the console on its own. Whatever goes wrong, the visitor still gets
  // the site — so the failure is logged once and the reveal is forced.
  let tickFailed = false
  function safeTick(now) {
    if (disposed) return
    if (tickFailed) {
      finish()
      return
    }
    try {
      tick(now)
    } catch (err) {
      tickFailed = true
      console.error('[preloader] animation failed, revealing anyway:', err)
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  // The counter has its own displayed value, damped toward the target rather than
  // printed raw. The real number steps — a chunk either lands or it does not — and
  // printing that step made the readout sit still and then jump to 100 in a single
  // frame, which reads as a glitch rather than as progress.
  let shownProgress = 0
  let lastProgressAt = 0

  function driveProgress(target, now) {
    const dt = lastProgressAt ? now - lastProgressAt : 16
    lastProgressAt = now
    shownProgress = displayProgress(shownProgress, target, dt)
    setProgress(shownProgress)
  }

  function tick(now) {
    if (disposed) return
    const t = now - startTime

    if (t < TIMELINE.BOOT) {
      if (scene) {
        scene.setFrontMode(0)
        scene.setShowTiles(false)
      }
      driveFront(sweepFront(0), now)
      rafId = requestAnimationFrame(safeTick)
      return
    }

    // open — the counter is the real load, floored by a creep so it never sits
    // still. The front advances on the OPEN clock but stops short of the midpoint,
    // keeping room for seal, and drifts gently while we wait: a frozen screen
    // behind a moving number still reads as stuck.
    const appMounted = document.documentElement.dataset.appReady === '1'
    const waited = t - TIMELINE.BOOT
    const readyToSeal = (loadSettled && appMounted) || waited > SETTLED_WAIT_CAP
    if (!readyToSeal) {
      const p = Math.min(1, waited / TIMELINE.OPEN)
      if (scene) {
        scene.setFrontMode(0)
        scene.setShowTiles(true)
      }
      const base = phaseFront('open', p) * 0.9
      driveFront(sweepFront(idleFront(waited, base, 0.05, 2600)), now)
      driveProgress(Math.max(loadProgress, creepProgress(waited)), now)
      rafId = requestAnimationFrame(safeTick)
      return
    }

    // seal — needs its own completion flag, not a comparison against the current
    // timestamp: `sealStart !== now` is true on every frame forever, because `now`
    // always advances. Testing it that way traps the loop in seal and the site is
    // never uncovered.
    if (!sealDone) {
      if (sealStart === 0) sealStart = now
      const p = Math.min(1, (now - sealStart) / TIMELINE.SEAL)
      if (scene) {
        scene.setFrontMode(0)
        scene.setShowTiles(true)
      }
      driveFront(sweepFront(phaseFront('seal', p)), now)
      // Eased, not assigned: the counter closing out from wherever the open phase
      // left it to a whole 100 was the jump the visitor saw. displayProgress
      // still lands on exactly 100, and seal's own duration is what gets it there.
      driveProgress(1, now)
      if (p >= 1) sealDone = true
      rafId = requestAnimationFrame(safeTick)
      return
    }

    if (revealStart === 0) {
      // Both signals are in by now — readyToSeal above waits for the chunk AND the
      // mount — so there is nothing left to wait for and the hand-over can go.
      revealStart = now
      root.classList.add('preloader--reveal')
      cutPending = true
    }

    const p = revealProgress(now, revealStart)
    const front = sweepFront(phaseFront('reveal', p))
    setRevealMask(front)
    if (scene) scene.setFrontMode(1)

    if (cutPending) {
      cutPending = false
      if (scene) {
        scene.setShowTiles(false)
        driveFront(front, now, true)
      }
      lastFrame = now
      rafId = requestAnimationFrame(safeTick)
      return
    }

    if (scene) scene.setShowTiles(true)
    driveFront(front, now)

    if (p >= 1) {
      finish()
      return
    }

    rafId = requestAnimationFrame(safeTick)
  }
  rafId = requestAnimationFrame(safeTick)

  function runReducedMotion() {
    // Reduced motion still has to wait for the same two signals, or the site is
    // uncovered while the shader chunk is still arriving. The discrete counter has
    // nothing to interpolate, so it just shows the real progress in steps.
    const waitForReady = () =>
      new Promise((resolve) => {
        const deadline = performance.now() + SETTLED_WAIT_CAP
        const check = () => {
          if (disposed) return
          const appMounted = document.documentElement.dataset.appReady === '1'
          // Same cap as the animated path. Without it a chunk that never resolves
          // strands a reduced-motion visitor on the preloader for good, and the one
          // population least able to dismiss it is the one that cannot.
          if (loadSettled && appMounted) resolve()
          else if (performance.now() > deadline) resolve()
          else setTimeout(check, 60)
        }
        check()
      })

    waitForReady().then(() => {
      const steps = 20
      let i = 0
      const iv = setInterval(() => {
        if (disposed) {
          clearInterval(iv)
          return
        }
        i++
        const v = Math.min(100, Math.round(loadProgress * i * 5))
        if (scene) scene.redrawCounter(v)
        announce(v)
        if (i >= steps) {
          clearInterval(iv)
          const fadeStart = performance.now()
          const fade = (now) => {
            if (disposed) return
            const p = Math.min(1, (now - fadeStart) / 200)
            if (scene) scene.setReveal(p)
            if (p < 1) requestAnimationFrame(fade)
            else finish()
          }
          requestAnimationFrame(fade)
        }
      }, TIMELINE.OPEN / steps)
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
