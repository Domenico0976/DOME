import React, { useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { createPendulumState, stepPendulum, DEFAULT_PARAMS } from './pendulumPhysics'
import { useIsTouch } from '../../hooks/useIsTouch'
import { useVisualViewport } from '../../hooks/useVisualViewport.js'

const GAP = 16 // gap between cursor and canvas edge when spawning below/above

function PendulumCanvas({
  visible = true,
  cursorRef = { current: { x: -9999, y: -9999 } },
  pendulumRef,
  boundsRef,
  anchorRef,
  showLinkChip = false,
  linkUrl = null,
  image,
  children,
  className = '',
  style,
  canvasOpacityRef,
  videoPath,
  gifPath,
}) {
  const elRef = useRef(null)
  const innerRef = useRef(null)
  const renderThetaRef = useRef(0) // displayed angle, low-passed for fluid motion
  const stateRef = useRef(createPendulumState())
  const paramsRef = useRef(DEFAULT_PARAMS)
  const animRef = useRef(null)
  const isTouch = useIsTouch()
  const { viewport } = useVisualViewport()

  // Read the VISUAL viewport, not window.innerWidth: the layout viewport keeps its
  // largest value while the browser UI is collapsed, so sizing to it produced a
  // canvas wider than the visible area. Derived per render, never at module scope —
  // a constant there would freeze the size at import and never react to a rotation
  // or a URL-bar collapse, which is the bug this replaces.
  //
  // The box is FIXED and is never derived from the media's intrinsic size.
  // Every media the archive shows is 3:2 landscape — verified with ffprobe on the
  // real files referenced by the first 3 projects:
  //   alfly-test.gif   1620x1080 (1.500)
  //   alfly-test.mp4    992x662  (1.499)
  //   Animaz-ubank.gif 1080x720  (1.500)
  //   Animaz-ubank.mp4  992x662  (1.499)
  //
  // The previous code derived WIDTH and HEIGHT from the viewport INDEPENDENTLY,
  // which on desktop produced 340x440 — portrait 0.77 — while the media is 3:2
  // landscape. The canvas therefore mounted portrait and GSAP-tweened down to
  // 340x226.7 on every open. That collapse was the visible jerk. Locking the
  // ratio removes the mid-flight correction, so opening is one clean animation.
  const CANVAS_ASPECT = 3 / 2
  const CANVAS_MAX_W = 420 // base mobile, perfetta com'e
  const CANVAS_MAX_W_DESKTOP = 600 // desktop: piu grande, stesso ratio
  // A phone takes the width it has (`- 32` = a 16px gutter per side, capped at the
  // max so a tablet does not become a wall). Height always FOLLOWS the width, so
  // the viewport clamp can never violate the ratio.
  const isWide = viewport.width > 720
  const maxW = isWide ? CANVAS_MAX_W_DESKTOP : CANVAS_MAX_W
  const boxW = isWide ? maxW : Math.max(280, Math.min(maxW, viewport.width - 32))
  const boxH = boxW / CANVAS_ASPECT

  const lastFrameTimeRef = useRef(performance.now())
  const mountSkipRef = useRef(2)
  // Current canvas size. The box is fixed, so this only changes on a viewport
  // change (rotation / URL-bar collapse) — never on a project change.
  const sizeRef = useRef({ w: boxW, h: boxH })
  // Last committed size, kept coherent with sizeRef so any consumer reading it
  // during a viewport change sees the same box.
  const committedSizeRef = useRef({ w: boxW, h: boxH })
  // True only while a viewport-driven size change is being applied; tick() skips
  // re-anchoring during it so place() stays the single source of truth.
  const sizingRef = useRef(false)

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  // Smoothed canvas position. place() only ever writes through this ref, so
  // the box glides instead of snapping when the anchor row travels with the
  // table. Nulled whenever the canvas (re)opens so it snaps to the row.
  const posRef = useRef(null)
  const SMOOTH = 0.22
  // Gate d'ingresso: parcheggiato sotto la viewport finche il figlio non
  // segnala la prima immagine pronta; poi slide-up. place() resta l'unica
  // a scrivere left/top (ci somma solo l'offset di entrata).
  const enterYRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 0)
  const readyRef = useRef(false)

  // Position the canvas from the hovered row, not the raw cursor. The row's
  // rect already includes page scroll and the table scrub transform, so the
  // canvas travels with the table by construction — no drift, no detachment.
  // Y is row-centered; X still tracks the cursor but clamped inside the row
  // when the row is wide enough, otherwise inside the viewport.
  const place = useCallback((cursorX, cursorY) => {
    const el = elRef.current
    if (!el) return
    const vw = window.innerWidth, vh = window.innerHeight
    const { w, h } = sizeRef.current

    let rawLeft = clamp(cursorX - w / 2, 0, Math.max(0, vw - w))
    let rawTop = cursorY - h / 2
    const anchorEl = anchorRef?.current
    if (anchorEl && anchorEl.isConnected) {
      const r = anchorEl.getBoundingClientRect()
      if (r.height > 0 && r.width > 0) {
        rawTop = r.top + r.height / 2 - h / 2
        const lo = Math.max(0, r.left)
        const hi = Math.min(vw - w, r.right - w)
        rawLeft = hi >= lo
          ? clamp(cursorX - w / 2, lo, hi)
          : clamp(cursorX - w / 2, 0, Math.max(0, vw - w))
      }
    }

    const p = posRef.current
    const nx = p ? p.x + (rawLeft - p.x) * SMOOTH : rawLeft
    const ny = p ? p.y + (rawTop - p.y) * SMOOTH : rawTop
    posRef.current = { x: nx, y: ny }

    // Vertical bottom anchor: the archives section bottom (never below it), capped to viewport.
    let sectionBottom = vh
    const boundsEl = boundsRef?.current
    if (boundsEl) {
      const r = boundsEl.getBoundingClientRect()
      if (r.height > 0) sectionBottom = r.bottom
    }
    const effectiveBottom = Math.min(sectionBottom, vh)

    const left = nx
    // Finche non ready, sotto la viewport senza clamp (altrimenti rientrerebbe).
    let top = ny + enterYRef.current
    if (readyRef.current) {
      const maxTop = effectiveBottom - h
      if (top > maxTop) top = Math.max(0, maxTop)
      if (top < 0) top = 0
    }

    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.transformOrigin = 'top center'
  }, [boundsRef, anchorRef])

  // Apply the fixed box. Deliberately NOT dependent on image / videoPath / gifPath:
  // the box is identical for every project, which is precisely what makes the open
  // animation clean. It re-runs only when the viewport-derived box actually changes
  // (rotation, URL-bar collapse), and then it snaps rather than tweening — a
  // viewport change is not an animation, and tweening it reintroduced the drift.
  //
  // videoPath and gifPath are still accepted as props because callers pass them and
  // the WebGL child receives its media through `children`; they simply no longer
  // influence the box.
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    gsap.killTweensOf(el)
    sizingRef.current = false
    const size = { w: boxW, h: boxH }
    sizeRef.current = size
    committedSizeRef.current = size
    el.style.width = `${size.w}px`
    el.style.height = `${size.h}px`
    place(cursorRef.current.x, cursorRef.current.y)
  }, [boxW, boxH, cursorRef, place])

  const tick = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const now = performance.now()
    let dt = (now - lastFrameTimeRef.current) / 1000
    lastFrameTimeRef.current = now
    if (dt <= 0) dt = 1 / 60
    if (dt > 0.05) dt = 0.05

    const cursorX = cursorRef.current.x
    const cursorY = cursorRef.current.y
    // Ignore the sentinel/off-screen initial position so we don't compute a bogus
    // huge velocity on the first real cursor move (would kick the pendulum).
    if (cursorX <= -9000 || cursorY <= -9000) {
      stateRef.current.prevX = null
      mountSkipRef.current = 2
      animRef.current = requestAnimationFrame(tick)
      return
    }
    // Skip the first tick after mount so prevX seeds cleanly and the first
    // real cursor movement produces a proper velocity delta.
    if (mountSkipRef.current > 0) {
      mountSkipRef.current--
      animRef.current = requestAnimationFrame(tick)
      return
    }
    const { theta, omega, speed, lean } = stepPendulum(stateRef.current, cursorX, dt, paramsRef.current)

    if (!sizingRef.current) place(cursorX, cursorY)
    // Low-pass the displayed angle so the swing reads fluid, not frame-steppy.
    renderThetaRef.current += (theta - renderThetaRef.current) * 0.22
    el.style.transform = `rotate(${renderThetaRef.current}rad)`
    el.style.opacity = String(canvasOpacityRef?.current?.value ?? 0)

    if (pendulumRef) pendulumRef.current = { theta, omega, speed, lean }
    animRef.current = requestAnimationFrame(tick)
  }, [cursorRef, pendulumRef, place])

  // Mobile: nessuna fisica, solo segue il cursore
  const tickMobile = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const cursorX = cursorRef.current.x
    const cursorY = cursorRef.current.y
    place(cursorX, cursorY)
    renderThetaRef.current = 0
    el.style.transform = 'rotate(0rad)'
    el.style.opacity = String(canvasOpacityRef?.current?.value ?? 0)
    if (pendulumRef) pendulumRef.current = { theta: 0, omega: 0, speed: 0, lean: 0 }
    animRef.current = requestAnimationFrame(tickMobile)
  }, [cursorRef, pendulumRef, place])

  // ponytail: follow-only mode when reduced-motion is preferred — no pendulum swing,
  // canvas still tracks cursor position and respects canvasOpacityRef for visibility.
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (!visible) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (reduceMotion) {
        el.style.display = 'none'
        return
      }
      gsap.to(el, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => { el.style.display = 'none' },
      })
      return
    }
    el.style.display = ''
    stateRef.current = createPendulumState()
    renderThetaRef.current = 0
    posRef.current = null
    lastFrameTimeRef.current = performance.now()
    // Direct-follow for touch, spring physics for a mouse. INPUT mode, not
    // layout: a finger dragging across a tablet produces the same velocity
    // spikes the pendulum is built to react to, and a tablet is not isMobile.
    const run = isTouch || reduceMotion ? tickMobile : tick
    animRef.current = requestAnimationFrame(run)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [visible, cursorRef, tick, tickMobile, reduceMotion, isTouch])

  const handleChildReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    gsap.to(enterYRef, { current: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' })
  }, [])
  // Righe senza media (solo link): niente GL da attendere, pronto subito.
  // Ritorno a riga con media: re-park sotto viewport, poi stessa slide-up
  // lineare dal basso all'alto al primo bind (niente apparizione istantanea).
  const imageless = !image && !videoPath && !gifPath
  useEffect(() => {
    if (imageless) { handleChildReady(); return }
    readyRef.current = false
    enterYRef.current = typeof window !== 'undefined' ? window.innerHeight : 0
  }, [imageless, handleChildReady])
  const gatedChildren = React.Children.map(children, (c) =>
    React.isValidElement(c) ? React.cloneElement(c, { onReady: handleChildReady }) : c,
  )

  return createPortal(
    <div
      ref={elRef}
      className={`pendulum-canvas ${className}`}
style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: `${boxW}px`,
        height: `${boxH}px`,
        maxHeight: `${boxH}px`,
        pointerEvents: 'none',
        willChange: 'transform, opacity',
        display: visible ? '' : 'none',
        // visible: il bottone "click to open" esce dal box in alto, hidden lo taglierebbe.
        // L'inner e la GL sono esattamente box-sized, niente altro sborda.
        overflow: 'visible',
        zIndex: 9999,
        ...style,
      }}
    >
      <div
        ref={innerRef}
        className="pendulum-canvas__inner"
        style={{ width: '100%', height: '100%', transformOrigin: 'center center' }}
      >
        {imageless ? null : gatedChildren}
      </div>
      {showLinkChip && (isTouch && linkUrl ? (
        <button
          type="button"
          aria-label="Open project link"
          onClick={(e) => { e.stopPropagation(); window.open(linkUrl, '_blank', 'noopener,noreferrer') }}
          style={{
            position: 'absolute',
            // Fuori dal canvas, ancorato in alto a destra: offset in % del box
            // cosi segue l'altezza responsive del canvas stesso.
            top: '-17%',
            right: 0,
            zIndex: 10000,
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            pointerEvents: 'auto',
          }}
        >
          click to open
        </button>
      ) : !isTouch ? (
        <div className={`archive-link-chip${imageless ? ' archive-link-chip--below' : ''}`} aria-hidden="true">click to open web</div>
      ) : null)}
    </div>,
    document.body
  )
}

export default PendulumCanvas
export { PendulumCanvas }
