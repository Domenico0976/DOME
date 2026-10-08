import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { useArchiveCursor } from '../hooks/useArchiveCursor'
import { useIsMobile } from '../hooks/useIsMobile'
import ArchiveHoverCanvas from './ArchiveHoverCanvas'
import MobileSectionCanvas from './MobileSectionCanvas'
import { registerWebGLContext } from '../gl/safety.js'


// Shared by open and close so the two always read as the same motion in reverse.
const OPEN_DURATION = 0.5
const OPEN_EASE = 'power3.out'

const MIN_W = 200
const MIN_H = 200
const PADDING = 16
const MAX_W = 800
const MAX_H = 600
const MAX_PIXEL_RATIO = 1.5

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi)
}

/**
 * Fit a box of the given aspect ratio (w/h) inside a maxW x maxH region.
 * The returned box always has exactly `aspect`, so an image rendered with
 * object-fit:cover fills it without stretching or leaving letterbox gaps.
 */
function fitAspectBox(maxW, maxH, aspect) {
  let w = maxW
  let h = w / aspect
  if (h > maxH) {
    h = maxH
    w = h * aspect
  }
  return { w, h }
}

function bottomRightPosition(width, height, viewportWidth, viewportHeight, safeAreaBottom = 0) {
  return {
    x: clamp(viewportWidth - width - PADDING, 0, viewportWidth - width),
    y: clamp(viewportHeight - height - PADDING - safeAreaBottom, 0, viewportHeight - height),
  }
}

/** Returns devicePixelRatio capped at MAX_PIXEL_RATIO. */
export function clampPixelRatio(devicePixelRatio) {
  const ratio = devicePixelRatio !== undefined && devicePixelRatio !== null ? devicePixelRatio : 1
  return Math.min(ratio, MAX_PIXEL_RATIO)
}

// Context loss goes through the shared registry in ../gl/safety.js, which every WebGL
// surface on the page now uses. The local `setupWebGLContextSafety` that used to live here
// was the only listener in the app, and only this component was covered by it.

//  MobileCanvas 
function MobileCanvas() {
  const { canvasState, closeCanvas, cursorRef, latchedClosed } = useArchiveCursor()
  const isMobile = useIsMobile()
  const elRef = useRef(null)
  const innerRef = useRef(null)
  const imgRef = useRef(null)
  const tlOpenRef = useRef(null)
  const tlCloseRef = useRef(null)
  const tlSwapRef = useRef(null)
  const resizingRef = useRef(false)
  const startSizeRef = useRef({ w: MIN_W, h: MIN_H })
  const startPosRef = useRef({ x: 0, y: 0 })
  const animDoneRef = useRef(false)
  const onPointerMoveRef = useRef(null)
  const onPointerUpRef = useRef(null)
  const glLockRef = useRef(false)
  const closingRef = useRef(false)
  const [resolvedOpen, setResolvedOpen] = useState(canvasState.open)

  // RAF-throttled resize: pending values are flushed to state once per frame
  const pendingSizeRef = useRef(null)
  const pendingPosRef = useRef(null)
  const flushRef = useRef(null)

  const flush = () => {
    if (pendingSizeRef.current) {
      setSize(pendingSizeRef.current)
      pendingSizeRef.current = null
    }
    if (pendingPosRef.current) {
      setPos(pendingPosRef.current)
      pendingPosRef.current = null
    }
    flushRef.current = null
  }

  const reduceMotion = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  , [])

  // Latch-triggered smooth close: when the section leaves the viewport while the
  // canvas is open, wait for any in-flight swap to settle, then fade out with the
  // same duration/easing as the open (reversed). Never unmount mid-swap.
  useEffect(() => {
    if (!latchedClosed.current || !canvasState.open || closingRef.current) return
    closingRef.current = true

    const settle = () => {
      setResolvedOpen(false)
      // Ramo imageless: nessun pannello GL montato, chiudi diretto senza tween.
      if (!elRef.current) { closeCanvas(); closingRef.current = false; return }
      gsap.to(elRef.current, {
        clipPath: 'inset(100% 0% 0% 0%)',
        duration: OPEN_DURATION,
        ease: OPEN_EASE,
        onComplete: () => {
          closeCanvas()
          closingRef.current = false
        },
      })
    }

    // If a swap is running, let it finish rather than freezing a half-swapped frame.
    if (tlSwapRef.current && tlSwapRef.current.isActive()) {
      tlSwapRef.current.eventCallback('onComplete', settle)
    } else {
      settle()
    }
  }, [latchedClosed, canvasState.open, closeCanvas])

  // resolvedOpen is seeded from canvasState.open on mount and the latch close above is
  // the only thing that ever set it to false — nothing set it back. Since the canvas
  // mounts closed and a tap is what opens it, resolvedOpen stayed false forever and the
  // `if (!resolvedOpen) return null` guard unmounted the component permanently: the
  // archive canvas was invisible on mobile. Mirror the open state back. Safe against
  // the close above, which flips canvasState.open to false before this can re-fire.
  // Mirror anche in chiusura: la chiusura diretta (X/backdrop) non passa dal latch
  // e senza questo resterebbe montato il box vuoto nero.
  useEffect(() => {
    if (canvasState.open) setResolvedOpen(true)
    else setResolvedOpen(false)
  }, [canvasState.open])

  // Set safe-area synchronously before first render (avoids race with initial pos state)
  if (typeof window !== 'undefined') {
    const safeAreaBottom = window.env?.safeAreaInsets?.bottom || 0
    document.documentElement.style.setProperty('--sat', `${safeAreaBottom}px`)
  }

  // -- WebGL context safety --
  useEffect(() => {
    const el = elRef.current
    if (!el) return
    return registerWebGLContext(el, {
      onLost: () => console.warn('WebGL context lost, falling back to static image'),
    })
  }, [])

  const initialSize = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const effMaxW = isMobile ? Math.min(MAX_W, Math.floor(vw * 0.92)) : MAX_W
    const effMaxH = isMobile ? Math.min(MAX_H, Math.floor(vh * 0.72)) : MAX_H
    let w = Math.min(effMaxW, vw - PADDING * 2)
    let h = Math.min(effMaxH, vh - PADDING * 2)
    // Lock the canvas to the image's aspect ratio so object-fit:cover fills it
    // without stretching or letterboxing, and resize stays distortion-free.
    if (canvasState.image && imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current
      if (naturalWidth > 0 && naturalHeight > 0) {
        const fitted = fitAspectBox(w, h, naturalWidth / naturalHeight)
        w = fitted.w
        h = fitted.h
      }
    }
    w = clamp(w, MIN_W, vw - PADDING * 2)
    h = clamp(h, MIN_H, vh - PADDING * 2)
    return { w, h }
  }, [canvasState.image])

  const [size, setSize] = useState(() => initialSize())
  const [pos, setPos] = useState(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0')

    return {
      ...bottomRightPosition(size.w, size.h, vw, vh, safeAreaBottom),
    }
  })

  useEffect(() => {
    const s = initialSize()
    setSize((prev) => ({ w: s.w, h: s.h }))
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0')
    setPos(bottomRightPosition(s.w, s.h, window.innerWidth, window.innerHeight, safeAreaBottom))
  }, [canvasState.image, initialSize])

  useEffect(() => {
    let rafId = null
    const onResize = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const s = initialSize()
        setSize(s)
        const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0')
        setPos(bottomRightPosition(s.w, s.h, window.innerWidth, window.innerHeight, safeAreaBottom))
      })
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [initialSize])

useEffect(() => {
    const el = elRef.current
    if (!el) return

    // kill previous tweens
    if (tlOpenRef.current) { tlOpenRef.current.kill(); tlOpenRef.current = null }
    if (tlCloseRef.current) { tlCloseRef.current.kill(); tlCloseRef.current = null }
    gsap.killTweensOf(el)
    animDoneRef.current = false

    if (!canvasState.open) {
      //  CLOSE (from top): content shrinks upward off-screen 
      // Start fully open; animate inset-bottomâ†'0, inset-topâ†'100% (top eats in).
      // Use shared OPEN_DURATION/OPEN_EASE so close reads as open reversed.
      gsap.set(el, { clipPath: 'inset(0% 0% 0% 0%)' })
      if (reduceMotion) {
        el.style.clipPath = 'inset(100% 0% 0% 0%)'
        animDoneRef.current = true
        setResolvedOpen(false)
        return
      }
      const tl = gsap.timeline({
        onComplete: () => {
          el.style.clipPath = 'inset(100% 0% 0% 0%)'
          animDoneRef.current = true
          setResolvedOpen(false)
        },
      })
      tl.to(el, { clipPath: 'inset(100% 0% 0% 0%)', duration: OPEN_DURATION, ease: OPEN_EASE })
      tlCloseRef.current = tl
      return
    }

    //  OPEN (from bottom): content rises up from below 
    // Start fully hidden; animate inset-bottomâ†'0, inset-topâ†'100% (bottom lifts).
    gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' })
    if (reduceMotion) {
      el.style.clipPath = 'inset(0% 0% 0% 0%)'
      animDoneRef.current = true
      return
    }
    const tl = gsap.timeline({
      onComplete: () => { animDoneRef.current = true },
    })
    tl.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: OPEN_DURATION, ease: OPEN_EASE })
    tlOpenRef.current = tl
  }, [canvasState.open, reduceMotion])

  // ─── swap animation (image changes while canvas is open) ───
  const prevImageForSwapRef = useRef(canvasState.image)
  useEffect(() => {
    const el = elRef.current
    if (!el || !canvasState.open) {
      prevImageForSwapRef.current = canvasState.image
      return
    }

    const prevImage = prevImageForSwapRef.current
    const newImage = canvasState.image
    prevImageForSwapRef.current = newImage

    // Skip if image didn't actually change or this is the initial open (prev was null)
    if (prevImage === newImage || prevImage === null) return

    // Kill any existing swap tween
    if (tlSwapRef.current) { tlSwapRef.current.kill(); tlSwapRef.current = null }

    if (reduceMotion) return

    // Swap animation: top-down disappear → bottom-up appear, with opacity cross-fade
    const imgEl = imgRef.current
    const tl = gsap.timeline()
    tl.to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.2, ease: 'power2.in' })
    if (imgEl) tl.to(imgEl, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
    tl.to(el, { clipPath: 'inset(0 0 0 0)', duration: 0.3, ease: 'power3.out' })
    if (imgEl) tl.to(imgEl, { opacity: 1, duration: 0.3, ease: 'power3.out' }, '<')
    tlSwapRef.current = tl

    return () => {
      if (tlSwapRef.current) { tlSwapRef.current.kill(); tlSwapRef.current = null }
    }
  }, [canvasState.image, canvasState.open, reduceMotion])

//  pointer-resize handler (top-left corner drag)
  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = true
    glLockRef.current = true
    const el = elRef.current
    if (!el) return

    startSizeRef.current = { w: size.w, h: size.h }
    startPosRef.current = { x: e.clientX, y: e.clientY }

    // Clean up any prior listeners before attaching new ones
    if (onPointerMoveRef.current) {
      document.removeEventListener('pointermove', onPointerMoveRef.current)
    }
    if (onPointerUpRef.current) {
      document.removeEventListener('pointerup', onPointerUpRef.current)
    }

    onPointerMoveRef.current = (ev) => {
      if (!resizingRef.current) return
      const dx = ev.clientX - startPosRef.current.x
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Drag locks the natural ratio: X drives width, height follows from it.
      // Scaling both axes independently is what stretched the image on resize.
      const el = imgRef.current
      const ratio = el && el.naturalWidth > 0 && el.naturalHeight > 0
        ? el.naturalWidth / el.naturalHeight
        : startSizeRef.current.w / startSizeRef.current.h
      const maxW = vw - PADDING * 2
      const maxH = vh - PADDING * 2
      let newW = clamp(startSizeRef.current.w - dx, MIN_W, maxW)
      let newH = newW / ratio
      if (newH > maxH) { newH = maxH; newW = newH * ratio }
      if (newH < MIN_H) { newH = MIN_H; newW = newH * ratio }
      newW = clamp(newW, MIN_W, maxW)
      const newPos = bottomRightPosition(newW, newH, vw, vh, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'))
      pendingSizeRef.current = { w: newW, h: newH }
      pendingPosRef.current = newPos
      if (!flushRef.current) flushRef.current = requestAnimationFrame(flush)
    }

    onPointerUpRef.current = () => {
      resizingRef.current = false
      glLockRef.current = false
      if (onPointerMoveRef.current) {
        document.removeEventListener('pointermove', onPointerMoveRef.current)
        onPointerMoveRef.current = null
      }
      if (onPointerUpRef.current) {
        document.removeEventListener('pointerup', onPointerUpRef.current)
        onPointerUpRef.current = null
      }
    }

    document.addEventListener('pointermove', onPointerMoveRef.current, { passive: true })
    document.addEventListener('pointerup', onPointerUpRef.current)
  }, [size])

  //  close button 
  const barWrapRef = useRef(null)
  const handleClose = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    // Ramo imageless: scivola in basso e svanisce (mai il box nero vuoto).
    const bar = barWrapRef.current
    if (bar) {
      gsap.to(bar, {
        y: 90, opacity: 0, duration: 0.35, ease: 'power3.in', overwrite: 'auto',
        onComplete: () => { gsap.set(bar, { y: 0, opacity: 1 }); closeCanvas() },
      })
      return
    }
    closeCanvas()
  }, [closeCanvas])

  //  cleanup on unmount 
  useEffect(() => {
    return () => {
      if (tlOpenRef.current) { tlOpenRef.current.kill(); tlOpenRef.current = null }
      if (tlCloseRef.current) { tlCloseRef.current.kill(); tlCloseRef.current = null }
      if (tlSwapRef.current) { tlSwapRef.current.kill(); tlSwapRef.current = null }
      gsap.killTweensOf(elRef.current)
      if (onPointerMoveRef.current) {
        document.removeEventListener('pointermove', onPointerMoveRef.current)
        onPointerMoveRef.current = null
      }
      if (onPointerUpRef.current) {
        document.removeEventListener('pointerup', onPointerUpRef.current)
        onPointerUpRef.current = null
      }
    }
  }, [])

  //  render 
  if (!resolvedOpen) return null

  // Righe senza immagine (solo link): barra in basso, niente canvas/GL.
  // Tap fuori o uscita sezione la chiude come il canvas (stesso latch/handleClose).
  const imagelessLink = canvasState.effectOpts?.link ?? null
  const imagelessName = canvasState.effectOpts?.name ?? ''
  if (canvasState.open && !canvasState.image) {
    return createPortal(
      <>
        <div
          aria-hidden="true"
          onPointerDown={handleClose}
          style={{ position: 'fixed', inset: 0, zIndex: 499 }}
        />
        <div
          ref={barWrapRef}
          className="mobile-canvas mobile-canvas--linkonly"
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 500,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0,
            background: 'var(--c-paper, #f5f1ea)',
            color: 'var(--c-ink, #111)',
            borderRadius: 12,
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          <span style={{ fontFamily: 'var(--f-title)', fontSize: 'clamp(20px, 5.5vw, 26px)', fontWeight: 600, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {imagelessName || imagelessLink || 'Link'}
          </span>
          {imagelessLink ? (
            <button
              type="button"
              onClick={() => window.open(imagelessLink, '_blank', 'noopener,noreferrer')}
              style={{
                marginTop: 10,
                fontFamily: 'var(--f-data)',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: 'var(--c-ink, #111)',
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 6,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              click to open
            </button>
          ) : null}
        </div>
      </>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={elRef}
      className="mobile-canvas"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 500,
        overflow: 'hidden',
        touchAction: 'none',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        borderRadius: 4,
        willChange: 'clip-path, left, top, width, height',
      }}
      aria-hidden={!resolvedOpen}
    >
      {/* Image content */}
      <div
        ref={innerRef}
        className="mobile-canvas__inner"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: '#111',
        }}
      >
        {canvasState.image && (
          <img
            ref={imgRef}
            src={canvasState.image}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              pointerEvents: 'none',
            }}
            onLoad={() => {
              // recompute size to match natural aspect once image is loaded
              const naturalWidth = imgRef.current?.naturalWidth || 0
              const naturalHeight = imgRef.current?.naturalHeight || 0
              const vw = window.innerWidth
              const vh = window.innerHeight
              const effMaxW = isMobile ? Math.min(MAX_W, Math.floor(vw * 0.92)) : MAX_W
              const effMaxH = isMobile ? Math.min(MAX_H, Math.floor(vh * 0.72)) : MAX_H
              let w = Math.min(effMaxW, vw - PADDING * 2)
              let h = Math.min(effMaxH, vh - PADDING * 2)
              if (naturalWidth > 0 && naturalHeight > 0) {
                const fitted = fitAspectBox(w, h, naturalWidth / naturalHeight)
                w = fitted.w
                h = fitted.h
              }
              w = clamp(w, MIN_W, vw - PADDING * 2)
              h = clamp(h, MIN_H, vh - PADDING * 2)
              const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0')
              setSize({ w, h })
              setPos(bottomRightPosition(w, h, vw, vh, safeAreaBottom))
            }}
          />
        )}
        {canvasState.image && (canvasState.effectType || 'archive-wind') === 'archive-wind' && (
          <ArchiveHoverCanvas
            cursorRef={cursorRef}
            image={canvasState.image}
            videoPath={canvasState.effectOpts?.videoPath}
            gifPath={canvasState.effectOpts?.gifPath || canvasState.image}
            visible
            glLockRef={glLockRef}
            style={{ zIndex: 1 }}
          />
        )}
        {canvasState.image && (canvasState.effectType || 'archive-wind') !== 'archive-wind' && (
          <MobileSectionCanvas
            effectType={canvasState.effectType}
            image={canvasState.image}
            effectOpts={canvasState.effectOpts}
            cursorRef={cursorRef}
            glLockRef={glLockRef}
            style={{ zIndex: 1 }}
          />
        )}
      </div>

      {/* Resize handle â€” top-left corner */}
      <div
        className="mobile-canvas__resize"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 44,
          height: 44,
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
        onPointerDown={handlePointerDown}
        aria-label="Resize canvas"
        role="slider"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M10.5 1.5L1.5 10.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M7.5 1.5L1.5 7.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Close button â€” top-right corner */}
      <button
        className="mobile-canvas__close"
        onClick={handleClose}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          zIndex: 2,
          padding: 0,
          lineHeight: 1,
        }}
        aria-label="Close canvas"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>
    </div>,
    document.body
  )
}

export default MobileCanvas
