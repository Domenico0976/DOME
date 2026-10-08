import React, { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from 'gsap'
import { useArchiveCursor } from '../hooks/useArchiveCursor'

export default function ArchiveCursor({ rowBoxRef, cursorInRowRef, cursorEntryRef, canvasOpacityRef, pendulumRef }) {
  const desktopElRef = useRef(null)
  const desktopDotRef = useRef(null)
  const mobileElRef = useRef(null)
  const hitAreaRef = useRef(null)
  const pressedRef = useRef(false)
  const pressStartRef = useRef({ x: 0, y: 0 })
  const currentXRef = useRef(0)
  const currentYRef = useRef(0)
  const dotLerpRef = useRef({ x: 0, y: 0 })
  const DOT_LERP = 0.45
  const borderXRef = useRef(0)
  const borderYRef = useRef(0)
  const rafEnabledRef = useRef(true)
  const inRowRef = useRef(false)
  const timelineRef = useRef(null)
  const exitStrikesRef = useRef(0)
  const canvasElRef = useRef(null)
  const canvasSizeRef = useRef({ w: 340, h: 440 })
  const morphingRef = useRef(false)
  const shrinkingRef = useRef(false)
  const [inRow, setInRow] = useState(false)
  const LERP = 0.15

  const { isTouch, openCanvas, isDraggingRef, clearDragTimer, resetDragState, updateCursor, activateCursor, parkCursor, sleepCursor } = useArchiveCursor()

  // ─── Touch direct-follow drag ───────────────────────────────────────────────
  useEffect(() => {
    if (!isTouch) return

    const handlePointerDown = (e) => {
      updateCursor(e.clientX, e.clientY)
      const el = mobileElRef.current
      if (!el) return

      const rect = hitAreaRef.current?.getBoundingClientRect() || el.getBoundingClientRect()
      const isTouchingCursor =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom

      if (isTouchingCursor) {
        pressedRef.current = true
        pressStartRef.current = { x: e.clientX, y: e.clientY }
      } else {
        // A touch that does NOT land on the cursor is the user asking for something
        // else — a scroll, a tap on content. That puts the cursor to sleep, so a
        // parked cursor from an earlier placement cannot keep driving effects while
        // the finger is doing something unrelated.
        sleepCursor()
      }
    }

    const handlePointerMove = (e) => {
      updateCursor(e.clientX, e.clientY)
      if (pressedRef.current && !isDraggingRef.current) {
        const dx = e.clientX - pressStartRef.current.x
        const dy = e.clientY - pressStartRef.current.y
        if (Math.hypot(dx, dy) >= 4) activateCursor()
      }
      if (!isDraggingRef.current) return

      // Past the 4px threshold, so this is a deliberate grab and not a scroll. Calling
      // it on EVERY move would wake the cursor from a passive finger scroll, which is
      // the one thing the gate exists to prevent.
      parkCursor(e.clientX, e.clientY)

      const el = mobileElRef.current
      if (el) {
        el.style.transform = `translate(${e.clientX - 19}px, ${e.clientY - 19}px)`
      }

      const hitArea = hitAreaRef.current
      if (hitArea) {
        hitArea.style.transform = `translate(${e.clientX - 36}px, ${e.clientY - 36}px)`
      }
    }

    const handlePointerUp = (e) => {
      pressedRef.current = false
      // The grab is over, so the cursor stops steering. It keeps its parked position
      // (a later tap on the cursor picks up from there) but is no longer awake.
      sleepCursor()
      if (!isDraggingRef.current) {
        clearDragTimer()
        return
      }

      resetDragState()

      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (target?.closest('.archive-image')) {
        const img = target.closest('.archive-image').querySelector('img')
        if (img) openCanvas(img.src)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true })
    document.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.addEventListener('pointerup', handlePointerUp, { passive: true })
    document.addEventListener('pointercancel', handlePointerUp, { passive: true })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isTouch, openCanvas, isDraggingRef, activateCursor, clearDragTimer, resetDragState, updateCursor, parkCursor, sleepCursor])

  // ─── Initial center position on touch ───────────────────────────────────────
  useEffect(() => {
    if (!isTouch) return

    const el = mobileElRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    updateCursor(vw / 2, vh / 2)
    el.style.transform = `translate(${vw / 2 - 19}px, ${vh / 2 - 19}px)`
    if (hitAreaRef.current) {
      hitAreaRef.current.style.transform = `translate(${vw / 2 - 36}px, ${vh / 2 - 36}px)`
    }
  }, [isTouch, updateCursor])

  // ─── Initial center position on desktop ─────────────────────────────────────
  useEffect(() => {
    if (isTouch) return

    const el = desktopElRef.current
    const dot = desktopDotRef.current
    if (!el || !dot) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const centerX = vw / 2
    const centerY = vh / 2

    currentXRef.current = centerX
    currentYRef.current = centerY
    dotLerpRef.current = { x: centerX - 3, y: centerY - 3 }
    borderXRef.current = centerX - 8
    borderYRef.current = centerY - 8

    updateCursor(centerX, centerY)
    el.style.transform = `translate(${centerX - 8}px, ${centerY - 8}px)`
    dot.style.transform = `translate(${centerX - 3}px, ${centerY - 3}px)`
  }, [isTouch, updateCursor])

// ─── Desktop lerp behavior ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = desktopElRef.current
    if (!el || isTouch) return

    const onPointerMove = (e) => {
      currentXRef.current = e.clientX
      currentYRef.current = e.clientY
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })

    // Exit needs two consecutive negative polls: a row-to-row hop fires
    // mouseleave+mouseenter in the same frame, and committing the first false
    // would build a shrink timeline only to kill it for the morph a frame later
    // (double-timeline fight = jumps). Entrance stays instant. Cost: ~100ms
    // exit latency, invisible against the 0.3s dismiss that follows.
    const checkInterval = setInterval(() => {
      const cursorInRow = cursorInRowRef?.current ?? false
      if (cursorInRow) {
        exitStrikesRef.current = 0
        if (!inRow) setInRow(true)
      } else if (inRow) {
        exitStrikesRef.current += 1
        if (exitStrikesRef.current >= 2) {
          exitStrikesRef.current = 0
          setInRow(false)
        }
      } else {
        exitStrikesRef.current = 0
      }
    }, 50)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      clearInterval(checkInterval)
    }
  }, [inRow, isTouch, cursorInRowRef])

  // ─── Desktop morph/shrink state machine (state-driven, no polling) ───────────
  useEffect(() => {
    const el = desktopElRef.current
    if (!el || isTouch) return

    if (!inRow) {
      if (timelineRef.current) {
        timelineRef.current.kill()
        timelineRef.current = null
      }
      gsap.killTweensOf(el)
      gsap.killTweensOf(desktopDotRef.current)
      gsap.killTweensOf(canvasOpacityRef.current)

      const canvasInner = document.querySelector('.pendulum-canvas__inner')
      const canvasEl = document.querySelector('.pendulum-canvas')
      if (canvasEl) canvasElRef.current = canvasEl

      if (canvasEl) {
        const r = canvasEl.getBoundingClientRect()
        borderXRef.current = r.left
        borderYRef.current = r.top
      }
      morphingRef.current = false
      shrinkingRef.current = true
      // Stay in canvas-centered mode for the whole shrink (RAF centering branch):
      // the ring must collapse toward the canvas center — the exact reverse of the
      // entrance — not travel toward the cursor. shrinkingRef keeps the RAF writing
      // a transform every frame, so the cursor cannot freeze mid-shrink.
      rafEnabledRef.current = false

      const tl = gsap.timeline({
        onComplete: () => {
          rafEnabledRef.current = true
          el.style.opacity = ''
          el.style.transformOrigin = ''
          el.style.borderColor = ''
          el.style.mixBlendMode = ''
          if (desktopDotRef.current) desktopDotRef.current.style.opacity = ''
          if (canvasInner) {
            canvasInner.style.clipPath = ''
            canvasInner.style.opacity = ''
          }
          canvasOpacityRef.current.value = 0
          shrinkingRef.current = false
          borderXRef.current = currentXRef.current - 8
          borderYRef.current = currentYRef.current - 8
          timelineRef.current = null
        },
      })

      tl.to(canvasOpacityRef.current, {
        value: 0,
        duration: 0.15,
        ease: 'power2.in',
      })

      if (canvasInner) {
        tl.to(canvasInner, {
          clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)',
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
        }, 0)
      }

      // Dismiss snaps shut (power2.out, shorter than the entrance): the reversed
      // choreography is kept, but an exit eased like the entrance's mirror
      // (power2.in) stalls visibly for the first ~100ms and reads as lag.
      tl.to(el, {
          width: 16,
          height: 16,
          borderRadius: 8,
          borderColor: 'rgba(255,255,255,0.9)',
          mixBlendMode: 'difference',
          opacity: 1,
          duration: 0.32,
          ease: 'power2.out',
        }, '-=0.1')

      // Reverse of the entrance (dot faded out first): the dot comes back last.
      if (desktopDotRef.current) {
        tl.to(desktopDotRef.current, {
          opacity: 1,
          duration: 0.2,
          ease: 'power2.out',
        }, '-=0.2')
      }
    } else {
      // --- MORPH path: cursor entered the row, morph into canvas shape ---
      rafEnabledRef.current = false
      morphingRef.current = true
      shrinkingRef.current = false

      if (timelineRef.current) {
        timelineRef.current.kill()
        timelineRef.current = null
      }
      gsap.killTweensOf(el)
      gsap.killTweensOf(desktopDotRef.current)
      gsap.killTweensOf(canvasOpacityRef.current)

      el.style.opacity = '1'
      el.style.borderColor = 'rgba(255,255,255,0.9)'
      el.style.mixBlendMode = 'difference'
      el.style.borderRadius = '8px'
      el.style.width = ''
      el.style.height = ''

      const canvasEl = document.querySelector('.pendulum-canvas')
      if (canvasEl) canvasElRef.current = canvasEl
      const canvasInner = document.querySelector('.pendulum-canvas__inner')
      const canvasRect = canvasEl?.getBoundingClientRect()
      const canvasW = canvasRect?.width ?? 340
      const canvasH = canvasRect?.height ?? 440
      canvasSizeRef.current = { w: canvasW, h: canvasH }

      gsap.set(el, { transformOrigin: 'center center', borderColor: 'rgba(255,255,255,0.9)', mixBlendMode: 'difference' })

      if (canvasInner) {
        gsap.set(canvasInner, {
          clipPath: 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)',
          opacity: 0,
        })
      }

      const tl = gsap.timeline({
        onComplete: () => {
          morphingRef.current = false
          rafEnabledRef.current = true
          el.style.opacity = '0'
          timelineRef.current = null
        },
      })

      tl.to(desktopDotRef.current, {
        opacity: 0,
        duration: 0.15,
        ease: 'power2.in',
      }, 0)
        .fromTo(el,
          {
            width: 16,
            height: 16,
            borderRadius: 8,
          },
          {
            width: canvasW,
            height: canvasH,
            borderRadius: 0,
            duration: 0.45,
            ease: 'power2.out',
          }, 0)
        .to(el, {
          opacity: 0,
          duration: 0.08,
          ease: 'none',
        }, 0.35)

      if (canvasInner) {
        tl.to(canvasInner, {
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
        }, 0.1)
      }

      tl.to(canvasOpacityRef.current, {
        value: 1,
        duration: 0.3,
        ease: 'power2.out',
      }, 0.15)

      timelineRef.current = tl
    }
  }, [inRow, isTouch])

  useEffect(() => {
    const el = desktopElRef.current
    if (!el || isTouch) return

    let rafId
    function updatePosition() {
      if (rafEnabledRef.current) {
        const targetBX = currentXRef.current - 8
        const targetBY = currentYRef.current - 8
        borderXRef.current += (targetBX - borderXRef.current) * LERP
        borderYRef.current += (targetBY - borderYRef.current) * LERP
        el.style.transform = `translate(${borderXRef.current}px, ${borderYRef.current}px)`

        // Tight lerp (not direct follow): on the morph/shrink → follow handoff the
        // dot glides from the ring center to the cursor instead of snapping from
        // its frozen pre-morph spot. Trail at full speed is ~1 frame, invisible.
        const dot = desktopDotRef.current
        if (dot) {
          dotLerpRef.current.x += (currentXRef.current - 3 - dotLerpRef.current.x) * DOT_LERP
          dotLerpRef.current.y += (currentYRef.current - 3 - dotLerpRef.current.y) * DOT_LERP
          dot.style.transform = `translate(${dotLerpRef.current.x}px, ${dotLerpRef.current.y}px)`
        }
      } else if (morphingRef.current || shrinkingRef.current) {
        const canvasEl = canvasElRef.current ?? document.querySelector('.pendulum-canvas')
        if (canvasEl) canvasElRef.current = canvasEl
        const r = canvasEl?.getBoundingClientRect()
        if (r && r.width > 0 && r.height > 0) {
          // Ring AND dot glued to the canvas center every frame: on exit reveal
          // the dot is already inside the ring, never at a stale spot.
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          el.style.transform = `translate(${cx - el.offsetWidth / 2}px, ${cy - el.offsetHeight / 2}px)`
          dotLerpRef.current.x = cx - 3
          dotLerpRef.current.y = cy - 3
          const dot = desktopDotRef.current
          if (dot) dot.style.transform = `translate(${dotLerpRef.current.x}px, ${dotLerpRef.current.y}px)`
        } else {
          // Canvas already hidden mid-shrink: glide the ring home to the cursor
          // instead of centering on a zero rect (top-left jump).
          borderXRef.current += (currentXRef.current - 8 - borderXRef.current) * LERP
          borderYRef.current += (currentYRef.current - 8 - borderYRef.current) * LERP
          el.style.transform = `translate(${borderXRef.current}px, ${borderYRef.current}px)`
          const dot = desktopDotRef.current
          if (dot) {
            dotLerpRef.current.x += (currentXRef.current - 3 - dotLerpRef.current.x) * DOT_LERP
            dotLerpRef.current.y += (currentYRef.current - 3 - dotLerpRef.current.y) * DOT_LERP
            dot.style.transform = `translate(${dotLerpRef.current.x}px, ${dotLerpRef.current.y}px)`
          }
        }
      }
      rafId = requestAnimationFrame(updatePosition)
    }
    rafId = requestAnimationFrame(updatePosition)

    return () => cancelAnimationFrame(rafId)
  }, [isTouch])

  // ─── Cleanup stale cursor DOM nodes when switching modes ────────────────────
  useEffect(() => {
    if (isTouch) return

    const mobileEl = mobileElRef.current
    const hitArea = hitAreaRef.current
    if (mobileEl && mobileEl.parentNode === document.body) {
      document.body.removeChild(mobileEl)
      mobileElRef.current = null
    }
    if (hitArea && hitArea.parentNode === document.body) {
      document.body.removeChild(hitArea)
      hitAreaRef.current = null
    }
  }, [isTouch])

  return createPortal(
    <>
      {!isTouch && (
        <>
          <div
            ref={desktopElRef}
            className="archive-cursor"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.9)',
              borderRadius: 8,
              pointerEvents: 'none',
              zIndex: 9999,
              boxSizing: 'border-box',
              mixBlendMode: 'difference',
              transform: 'translate(0,0)',
            }}
            aria-hidden="true"
          />
          <div
            ref={desktopDotRef}
            className="archive-cursor-dot"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 6,
              height: 6,
              background: 'black',
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 10000,
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Mobile cursor — hit area + drag, only on mobile */}
      {isTouch && (
        <>
           <div
             ref={mobileElRef}
             className="archive-cursor archive-cursor--mobile"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 38,
              height: 38,
              border: '2px solid rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              mixBlendMode: 'difference',
              pointerEvents: 'none',
              zIndex: 9999,
              touchAction: 'none',
              willChange: 'transform',
            }}
            aria-hidden="true"
          />
          <div
            ref={hitAreaRef}
            className="archive-cursor-hit-area"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 72,
              height: 72,
              pointerEvents: 'auto',
              zIndex: 10001,
              touchAction: 'none',
              willChange: 'transform',
            }}
            role="button"
            aria-label="Activate archive cursor"
          />
        </>
      )}
    </>,
    document.body
  )
}
