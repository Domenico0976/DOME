import React, { useRef, useEffect, useState } from 'react'
import { mountTorusKnot } from '../hero-glass/engine.js'
import { normalizeRows, TEXT_ROWS, TEXT_ROWS_MOBILE } from '../hero-glass/textRows.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { useCursorGate } from '../hooks/useCursorGate.js'
import { useVisualViewport } from '../hooks/useVisualViewport.js'
import { registerResize } from '../gl/resize.js'
import { registerWebGLContext } from '../gl/safety.js'
import { subscribeInView } from '../gl/viewport.js'

/**
 * Preloader gate — HARD gate. Resolves only once `#preloader` is removed
 * from the DOM, which is the exact signal `src/preloader/index.js` →
 * `finish()` emits via `root.remove()`. A MutationObserver on document.body
 * watches for the removal; a 20 s setTimeout is the safety net for a broken
 * flow (baseline removal is 8.4–14.2 s, so this never beats a healthy run),
 * and `requestIdleCallback` defers the resolve to an idle slot so the engine
 * warm-up does not contend with the preloader's own frame loop.
 *
 * This promise is the single choke point: nothing below sets up a renderer
 * until it settles. Returning visits (`no-preload` → `#preloader` already
 * absent) resolve immediately, preserving old behavior when no preload
 * exists.
 */
const preloaderReady = new Promise((resolve) => {
  if (typeof document === 'undefined') { resolve(); return }
  const el = document.getElementById('preloader')
  if (!el) { resolve(); return }
  if (!document.body.contains(el)) { resolve(); return }

  const go = () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(resolve, { timeout: 2000 })
    } else {
      setTimeout(resolve, 2000)
    }
  }
  const mo = new MutationObserver((records, obs) => {
    if (!document.body.contains(el)) {
      obs.disconnect()
      go()
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
  setTimeout(go, 20000)
})

/**
 * Deferred mount promise. `preloaderReady` is the hard gate: the
 * IntersectionObserver is NOT set up until it settles, so the section's
 * generous 200 % margin cannot fire during the preload window (its top is
 * ~100vh, well inside the expanded root). Post-gate, the IO fires right after
 * reveal and the engine warms before the user scrolls. If IO is unavailable
 * (jsdom), resolve via the preloader gate alone. The `settled` flag prevents
 * double-resolution if the safety timer, the removal observer and the IO
 * race.
 */
export function deferredMount(sectionEl) {
  return new Promise((resolve) => {
    let settled = false
    let io = null
    const mark = (val) => {
      if (settled) return
      settled = true
      if (io) io.disconnect()
      resolve(val)
    }

    const setupObserver = () => {
      if (!sectionEl) { mark(null); return }
      if (typeof IntersectionObserver === 'undefined') {
        // jsdom has no IntersectionObserver — the preloader gate alone is
        // sufficient (no `#preloader` element either, so it resolves now).
        mark(null)
        return
      }
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) mark(entry)
        },
        { rootMargin: '200% 0px', threshold: 0 },
      )
      io.observe(sectionEl)
    }

    preloaderReady.then(() => setupObserver())
  })
}

export default function TextEntryGlass() {
  const [reducedMotion, setReducedMotion] = useState(
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const sectionRef = useRef(null)
  const isMobile = useIsMobile()
  // Testo dedicato al mobile: righe corte + size maggiori, solo su mobile.
  const sourceRows = isMobile ? TEXT_ROWS_MOBILE : TEXT_ROWS
  const { parked } = useCursorGate()
  const { viewportRef } = useVisualViewport()
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const scrollHandlerRef = useRef(null)
  const scrollFrameRef = useRef(null)
  const scrollQueuedRef = useRef(false)
  const inViewRef = useRef(false)
  const fitRef = useRef(null)
  // Holds the deferred-mount promise so the cleanup effect can cancel it.
  const mountPromiseRef = useRef(null)

  // The rows live in the WebGL scene, not the DOM: the torus can only refract
  // what three.js has already rasterised, and a <span> is never in that buffer.
  // Styles are read from CSS rather than duplicated here so the texture cannot
  // drift away from the cascade. Rows may contain inline HTML (see textRows.js):
  // the canvas atlas parses it into styled segments, while the SR copy below
  // reads back only the plain text (`row.text`).
  const readTextMetrics = () => {
    const fit = fitRef.current
    const section = sectionRef.current
    if (!fit || !section) return null

    const style = getComputedStyle(fit)
    const fitRect = fit.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()

    return {
      box: {
        x: fitRect.left - sectionRect.left + (parseFloat(style.paddingLeft) || 0),
        y: fitRect.top - sectionRect.top + (parseFloat(style.paddingTop) || 0),
        width: fit.clientWidth,
        height: fit.clientHeight,
      },
      styles: {
        fontFamily: getComputedStyle(document.documentElement)
          .getPropertyValue('--f-title')
          .trim(),
        fontWeight: style.fontWeight || 'normal',
        color: style.color,
        accentColor:
          getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim() ||
          '#083D2A',
        lineHeight: parseFloat(style.getPropertyValue('--text-entry-lh')) || 1,
      },
    }
  }

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const section = sectionRef.current
    const canvas = canvasRef.current
    if (!section || !canvas) return
    const releases = []

    // Defer: do not create a WebGL renderer or bake the PMREM until the
    // preloader is gone and the section is about to enter view.
    const mountPromise = deferredMount(section)
    mountPromiseRef.current = mountPromise

    mountPromise.then((intersectionEntry) => {
      if (cancelled) { return }
      // Mark in-view from the observer's perspective if we woke via the
      // preloader gate rather than intersection.
      if (intersectionEntry) {
        inViewRef.current = intersectionEntry.isIntersecting
      }

      const metrics = readTextMetrics()

      mountTorusKnot(canvas, {
        animated: !reducedMotion,
        rows: sourceRows,
        textStyles: metrics ? metrics.styles : {},
      }).then((engine) => {
        if (cancelled) {
          if (engine) engine.dispose()
          return
        }
        engineRef.current = engine
        engine.setPaused(!inViewRef.current)

        // Context safety goes through the shared registry so every WebGL surface on the
        // page is covered by one implementation instead of the one that happened to remember.
        // onLost shows the SR copy as real text: on mobile the browser reclaims
        // contexts under pressure (this section mounts early, so it is reclaimed
        // first) and without this the section goes blank until restore.
        releases.push(registerWebGLContext(canvas, {
          onLost: () => section.classList.add('text-entry--no-gl'),
          onRestored: () => {
            // The backing store is gone after a loss, so the surface has to be rebuilt from
            // scratch; resuming the loop alone would render into a dead context forever.
            section.classList.remove('text-entry--no-gl')
            engineRef.current?.rebuildText(readTextMetrics()?.box ?? null)
          },
        }))

        // The registry, not a per-section ResizeObserver. `.text-entry` is `100dvh`, so the
        // browser collapsing its URL bar changed the element mid-scroll and reallocated the
        // drawing buffer on every step — the scattering. registerResize filters that.
        releases.push(registerResize(section, ({ width, height }) => {
          if (!engineRef.current) return
          const current = readTextMetrics()
          engineRef.current.resize(width, height, current ? current.box : null)
        }))

        releases.push(subscribeInView(section, (isInView) => {
          inViewRef.current = isInView
          engineRef.current?.setPaused(!isInView)
        }))

        const current = readTextMetrics()
        engine.resize(
          section.clientWidth,
          section.clientHeight,
          current ? current.box : null,
        )

        // The atlas is rasterised text, so a fit measured on the fallback face
        // would bake the wrong glyph metrics into the texture permanently.
        if (document.fonts?.ready) {
          document.fonts.ready.then(() => {
            if (cancelled || !engineRef.current) return
            const fresh = readTextMetrics()
            engineRef.current.rebuildText(fresh ? fresh.box : null)
          })
        }

        const updateScroll = () => {
          if (!engineRef.current) return
          const rect = section.getBoundingClientRect()
          const viewport = window.innerHeight || 1
          const total = viewport + rect.height
          engineRef.current.setScrollProgress(total > 0 ? (viewport - rect.top) / total : 0)
        }
        const onScroll = () => {
          if (scrollQueuedRef.current) return
          scrollQueuedRef.current = true
          scrollFrameRef.current = requestAnimationFrame(() => {
            scrollQueuedRef.current = false
            scrollFrameRef.current = null
            updateScroll()
          })
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        scrollHandlerRef.current = onScroll
        updateScroll()
      }).catch((error) => {
        console.error('[TextEntryGlass] mount failed', error)
      })
    })

    return () => {
      cancelled = true
      // Abort the deferred gate so a late resolution does not spawn a renderer.
      mountPromiseRef.current = null
      if (scrollHandlerRef.current) {
        window.removeEventListener('scroll', scrollHandlerRef.current)
        scrollHandlerRef.current = null
      }
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
      scrollQueuedRef.current = false
      for (const release of releases) release()
      if (engineRef.current) {
        engineRef.current.dispose()
        engineRef.current = null
      }
    }
  }, [reducedMotion, isMobile])

  // Always oriented, per the user: this surface follows the cursor whether or not
  // the cursor is awake, which is why it sits on the structural test's exemption
  // list. SMOOTHED, which the old `pointermove` path was not — setPointer assigns
  // straight into the rotation, so a raw event coordinate produced visible stepping.
  useEffect(() => {
    let raf = 0
    const smooth = { x: 0, y: 0 }
    const read = () => {
      const p = parked.current
      const v = viewportRef.current
      const w = v.width || window.innerWidth || 1
      const h = v.height || window.innerHeight || 1
      const tx = (p.x / w) * 2 - 1
      const ty = -((p.y / h) * 2 - 1)
      smooth.x += (tx - smooth.x) * 0.08
      smooth.y += (ty - smooth.y) * 0.08
      engineRef.current?.setPointer(smooth.x, smooth.y)
      raf = requestAnimationFrame(read)
    }
    raf = requestAnimationFrame(read)
    return () => cancelAnimationFrame(raf)
  }, [parked, viewportRef])

  const rows = normalizeRows(sourceRows)

  return (
    <>
      <section className="text-entry" ref={sectionRef}>
        <canvas
          ref={canvasRef}
          className="text-entry__canvas"
          aria-hidden="true"
        />
        <div className="text-entry__content">
          <div className="container text-entry__fit" ref={fitRef}>
            <p className="text-entry__sr">
              {rows.map((row, i) => (
                <span key={i}>{row.text}</span>
              ))}
            </p>
          </div>
        </div>
      </section>
    </>
  )
}