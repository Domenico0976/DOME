import React, { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react'
import {
  createMaskState,
  releaseMaskUrl,
  compositeLinesUrl,
  readReveal,
  cacheLine,
  MASK_DPR,
  MASK_MIN_INTERVAL_MS,
} from '../gl/text/engine.js'

import { useCursorGate, useAwakeState } from '../hooks/useCursorGate'
import { measureVisualLines } from '../gl/text/lines.js'
import {
  Shader,
  Swirl,
  ChromaFlow,
  FlutedGlass,
  FilmGrain,
  ImageTexture,
} from 'shaders/react'

export default function FocusCalloutShader({ lines = [], ref }) {
  const maskRef = useRef(null)
  const probeRef = useRef(null)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [maskDataUrl, setMaskDataUrl] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [hovered, setHovered] = useState(false)
  const hoverTimerRef = useRef(null)
  // ponytail: 80ms debounce — slow drift across the probe edge flaps
  // enter/leave and snaps intensity/aberration; only commits settled state.
  const setHoverDebounced = (v) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setHovered(v), 80)
  }
  const { isTouch } = useCursorGate()
  // Awake, not dragging: `isDragging` is cleared on pointerup, so a parked cursor
  // would drop the effect the moment the finger lifted — the thing the parked cursor
  // exists to prevent. This feeds JSX, hence the state form rather than the ref.
  const awake = useAwakeState()

  // On touch a tap fires mouseenter, which would pop the effect with no drag, so
  // a touch device gates on the touch cursor being held instead. Tablets included:
  // they have the desktop layout but the same "no hover" problem as a phone.
  const effectOn = isTouch ? awake : hovered
  const drawMaskRef = useRef(null)
  const lastRebuildAt = useRef(0)
  const stateRef = useRef(null)
  if (stateRef.current === null) stateRef.current = createMaskState()

  useImperativeHandle(ref, () => ({
    // `force` exists for the entrance's last tick: the throttle must not swallow
    // the frame that settles the callout, or a line can be left part-revealed.
    rebuild: (force = false) => {
      const t = performance.now()
      if (!force && t - lastRebuildAt.current < MASK_MIN_INTERVAL_MS) return
      lastRebuildAt.current = t
      drawMaskRef.current?.()
    },
  }), [])

  const handleUnavailable = useCallback(() => setUnavailable(true), [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mediaQuery.matches)
    const handler = (e) => setReduceMotion(e.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
    mediaQuery.addListener(handler)
    return () => mediaQuery.removeListener(handler)
  }, [])

  useEffect(() => {
    const host = (probeRef.current || maskRef.current)?.parentElement
    if (host) {
      host.classList.toggle('focus-callout--reduced', reduceMotion)
    }
  }, [reduceMotion])

  useEffect(() => {
    const host = maskRef.current?.parentElement
    if (host) {
      host.classList.toggle('focus-callout--no-gl', unavailable)
    }
  }, [unavailable])

  // Build the hidden 2D mask and mirror it to an alpha dataURL for the
  // shaders/react ImageTexture. Runs on mount, on font load and on resize, plus on
  // every tick of the entrance via the rebuild handle above. Nothing else.
  useEffect(() => {
    const canvas = maskRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    const state = stateRef.current
    const draw = () => {
      // Both rects are read here, in the same frame, and that is the only reason the
      // positions below are consistent: a span offset is only meaningful relative to
      // a container rect, and the two drift apart as soon as one is cached.
      const containerRect = container.getBoundingClientRect()
      const w = Math.max(1, Math.round(containerRect.width))
      const h = Math.max(1, Math.round(containerRect.height))
      const dpr = MASK_DPR
      const domLines = Array.from(container.querySelectorAll('.focus-callout__text-line'))

      // The cache key covers only what the cached rasterises: glyph geometry and
      // the per-run faces. Position is deliberately excluded, so scrolling the page
      // never invalidates it.
      const key = domLines
        .map((line) => {
          const span = line.querySelector('.focus-callout__text')
          if (!span) return ''
          const r = span.getBoundingClientRect()
          const cs = getComputedStyle(span)
          return `${Math.round(r.width)}x${Math.round(r.height)}:${cs.font}:${span.textContent || ''}`
        })
        .join('|')

      if (key !== state.cacheKey) {
        state.cacheKey = key
if (domLines.length) {
          // One cache entry per VISUAL LINE BOX, not per DOM element. A span that wraps to
          // three line boxes is three entries, each with its own text slice and its own
          // raster. Keying on the element instead is what produced the blank gaps: one
          // oversized raster for the whole element, clipped by the canvas, with the line
          // boxes it did not cover left empty. The break points are the browser's — see
          // measureVisualLines, which reads them rather than predicting them.
          state.lineCache = domLines.flatMap((line) => {
            const span = line.querySelector('.focus-callout__text')
            if (!span) return []
            const cs = getComputedStyle(span)
            // Measure with the reveal transform neutralised. getBoundingClientRect on a
            // transformed element returns the displaced rect, and the clip window has to be
            // where the line ENDS UP. Only runs on a cache rebuild, so the forced
            // synchronous layout is not in the per-frame path. The previous value is
            // restored verbatim: writing '' instead would drop whatever GSAP had put there
            // and fight the entrance mid-rebuild.
            const previousTransform = span.style.transform
            if (previousTransform !== '') span.style.transform = 'none'
            const hostRect = span.getBoundingClientRect()
            const rects = measureVisualLines(span)
            if (previousTransform !== '') span.style.transform = previousTransform

            // Fallback when no per-character rect is available. jsdom never produces one,
            // and a browser will not either for a detached or display:none element. Without
            // this the cache build yields zero entries and the mask goes blank — which is
            // silent, because the DOM ink is transparent by design and the --no-gl fallback
            // never fires when WebGL is working fine.
            const measured = rects.length
              ? rects
              : [{ text: span.textContent, x: hostRect.left, y: hostRect.top, w: hostRect.width, h: hostRect.height }]

            const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
            const letterSpacing = cs.letterSpacing

            return measured
              .filter((r) => r.w > 0.5 && r.h > 0.5)
              .map((r) => {
                // Raster bounds come from the LINE BOX rect, relative to the container.
                // .focus-callout is text-align:left, so a line's left edge IS its text's
                // left edge — that is what makes the shader's text left-aligned too.
                const entry = {
                  canvas: null,
                  scratch: null,
                  pad: 0,
                  inkTop: 0,
                  inkBottom: 0,
                  winTop: 0,
                  winBottom: 0,
                  restX: 0,
                  restY: 0,
                  w: r.w,
                  h: r.h,
                  x: r.x - containerRect.left,
                  y: r.y - containerRect.top,
                  text: r.text.trim(),
                  font,
                  letterSpacing,
                  // The reveal still lives on the DOM element, so every visual line of one
                  // element shares that element's --reveal for now. Carrying the owner here
                  // is what lets the stagger be lifted to per-line later without redoing
                  // the cache build.
                  hostLine: line,
                  // The span's own box, CONTAINER-RELATIVE, captured in this draw. It has to
                  // be container-relative and not a raw viewport rect: the live comparison
                  // below happens in a later frame, and a raw pair measured at two different
                  // scroll offsets differs by the scroll delta — which put every line
                  // thousands of pixels off and emptied the mask entirely.
                  hostRestLeft: hostRect.left - containerRect.left,
                  hostRestTop: hostRect.top - containerRect.top,
                }
                cacheLine(entry, dpr)
                entry.restX = entry.x
                entry.restY = entry.y
                entry.winTop = entry.y - entry.pad + entry.inkTop
                entry.winBottom = entry.y - entry.pad + entry.inkBottom
                return entry
              })
          })
        } else if (lines.length) {
          // No DOM lines to measure. Without this the mask would be empty, and
          // since the DOM ink is transparent by default that fails SILENTLY â€”
          // the --no-gl fallback never fires because WebGL is working fine.
          const fontSize = Math.min(w * 0.08, 72)
          const lineHeight = fontSize * 1.15
          const startY = (h - lines.length * lineHeight) / 2
          const font = `500 ${fontSize}px "Bricolage Grotesque", Georgia, serif`
          state.lineCache = lines.map((text, i) => {
            const probe = document.createElement('canvas').getContext('2d')
            probe.font = font
            const width = probe.measureText(text).width
            const entry = {
              canvas: null,
              scratch: null,
              pad: 0,
              inkTop: 0,
              inkBottom: 0,
              winTop: 0,
              winBottom: 0,
              restX: 0,
              restY: 0,
              w: width,
              h: lineHeight,
              x: (w - width) / 2,
              y: startY + i * lineHeight,
              text,
              font,
              letterSpacing: 'normal',
            }
            cacheLine(entry, dpr)
            entry.restX = entry.x
            entry.restY = entry.y
            entry.winTop = entry.y - entry.pad + entry.inkTop
            entry.winBottom = entry.y - entry.pad + entry.inkBottom
            return entry
          })
        } else {
          state.lineCache = []
        }
      }

      // The live position of each line comes from its span, which the reveal is
      // moving; the window and the resting position come from the cache. Reading
      // the rect (rather than recomputing the offset) keeps the mask locked to the
      // DOM even if a tween is interrupted or retargeted. `reveal` is the line's
      // --reveal, which is 0 in CSS until the entrance brings it to 1, so a line
      // that has not been positioned yet contributes nothing to the mask at all.
      //
      // Both rects come from this frame's `containerRect`, so the offsets below are
      // container-relative by construction â€” and stay that way under scroll, which
      // moves the container and the spans together.
      const states = []
      for (let i = 0; i < state.lineCache.length; i++) {
        const entry = state.lineCache[i]
        if (!entry || !entry.canvas) continue
        const line = entry.hostLine
        const span = line?.querySelector('.focus-callout__text')
        const live = span ? span.getBoundingClientRect() : null
        // The reveal translates the SPAN, and every visual line inside one span moves with
        // it by the same delta. Deriving each line's live position from the span's own
        // displacement is what lets a wrapped span move as one piece: reading the span's
        // rect directly would put every visual line at the same spot.
        const dx = live ? (live.left - containerRect.left) - entry.hostRestLeft : 0
        const dy = live ? (live.top - containerRect.top) - entry.hostRestTop : 0
        states.push({
          canvas: entry.canvas,
          scratch: entry.scratch,
          pad: entry.pad,
          winTop: entry.winTop,
          winBottom: entry.winBottom,
          restX: entry.restX,
          restY: entry.restY,
          reveal: line ? readReveal(line) : 1,
          x: entry.restX + dx,
          y: entry.restY + dy,
        })
      }

      compositeLinesUrl(state, canvas, Math.round(w * dpr), Math.round(h * dpr), states, setMaskDataUrl)
    }
    drawMaskRef.current = draw
    // Deferred one frame on purpose: a child's effects run before the parent's, so
    // an eager draw would measure the DOM before the callout lines have settled.
    const firstFrame = requestAnimationFrame(() => drawMaskRef.current?.())
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => drawMaskRef.current?.()).catch(() => {})
    }
    const onResize = () => drawMaskRef.current?.()
    window.addEventListener('resize', onResize)

    // A layout change that is not a window resize â€” the callout re-wrapping, a font
    // swap, a container that resizes because a sibling grew â€” invalidates the glyph
    // rasters. The cache key catches that whenever draw() runs, so all this has to
    // do is make sure draw() runs. ResizeObserver is what the removed frame loop was
    // standing in for, and unlike the loop it costs nothing when nothing moves.
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => drawMaskRef.current?.())
      ro.observe(container)
    }

    // No frame loop. The entrance drives rebuilds through the handle above, so once
    // it finishes nothing here reads layout, and a scroll â€” which moves the
    // container and every span by the same amount â€” cannot change the mask at all.
    //
    // There used to be a rAF loop here doing exactly that, gated on nothing. Its
    // change-detection signature subtracted a live span rect from a container rect
    // captured in an earlier draw, so scrolling always looked like movement and
    // rebuilt a pixel-identical mask: measured at two encodes per scroll
    // discontinuity, and twenty per thirty frames of smooth scrolling. The comment
    // on that line claimed the offsets were scroll-invariant; they were not.
    //
    // The intersection gate that used to be here is deliberately still absent. The
    // entrance only plays once the callout is on screen, so an entrance-driven
    // rebuild cannot fire while it is off screen, and a gate added nothing except a
    // way for the mask to stop tracking the DOM â€” which is indistinguishable from a
    // broken entrance: the shader shows the text at rest while the invisible DOM
    // slides.
    return () => {
      cancelAnimationFrame(firstFrame)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      drawMaskRef.current = null
      releaseMaskUrl(state)
    }
  }, [lines])

  if (reduceMotion) {
    return <span ref={probeRef} className="focus-callout__probe" style={{ display: 'none' }} aria-hidden="true" />
  }

  return (
    <>
      <div
        ref={probeRef}
        className="focus-callout__canvas"
        aria-hidden="true"
        onMouseEnter={() => setHoverDebounced(true)}
        onMouseLeave={() => setHoverDebounced(false)}
        style={{ pointerEvents: 'auto' }}
      >
        {!unavailable && maskDataUrl && (
          <Shader
            className="focus-callout__gl"
            disableTelemetry
            onUnavailable={handleUnavailable}
          >
            <ImageTexture id="glyphMask" url={maskDataUrl} objectFit="fill" />
            <Swirl
              colorA="#ffffff"
              colorB="#363636"
              detail={1.25}
              blend={38}
            />
            <ChromaFlow
              id="calloutFlow"
              baseColor="#fc4040"
              upColor="#4a2afd"
              downColor="#c56e6e"
              leftColor="#f314b4"
              rightColor="#f195d6"
              radius={isTouch ? 3.25 : 2.5}
              momentum={18}
              intensity={effectOn ? 0.2 : 2.5}
            />
            <FlutedGlass
              shape="waves"
              angle={31}
              frequency={10}
              refraction={6}
              aberration={effectOn ? 1.9 : 0.61}
              waveAmplitude={0.2}
              waveFrequency={0.2}
              speed={0.25}
              highlight={1.9}
            />
            <FilmGrain strength={0.05} maskSource="glyphMask" maskType="alpha" />
          </Shader>
        )}
      </div>
      <canvas ref={maskRef} className="focus-callout__mask" aria-hidden="true" style={{ display: 'none' }} />
    </>
  )
}
