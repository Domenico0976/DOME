import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCursorGate } from '../hooks/useCursorGate'
import MobileSectionCanvas from './MobileSectionCanvas'

// Mobile: show the featured-gallery dissolve ON the card the floating cursor is
// dragged over — without opening the MobileCanvas.
//
// On phones the gallery deliberately does NOT hold six per-card WebGL contexts
// (that overran the browser's context budget and reclaimed the hero/text-entry
// contexts). So instead we mount ONE `MobileSectionCanvas` (a single context,
// the same 'featured-ripple' effect the opened canvas uses) clipped exactly over
// the hovered card's frame. Moving the cursor off the card dissolves it back and
// the overlay unmounts after a short grace, disposing the context.
const GRACE_MS = 450
const POLL_MS = 90

export default function GalleryTouchEffect() {
  const { isTouch, isAwake, parked } = useCursorGate()
  const [target, setTarget] = useState(null) // { src, alignX, alignY, left, top, width, height, key }
  const lastHitRef = useRef(0)
  const lastKeyRef = useRef(null)

  useEffect(() => {
    if (!isTouch) return
    let cancelled = false

    const readCard = () => {
      const frames = document.querySelectorAll('.gl-media__frame')
      if (!frames.length) return null
      const p = parked.current
      const vh = window.innerHeight || 1
      for (const f of frames) {
        const r = f.getBoundingClientRect()
        if (r.bottom < 0 || r.top > vh) continue // off screen
        if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
          const img = f.querySelector('img')
          const src = img?.currentSrc || img?.src || ''
          if (!src) return null
          return {
            src,
            alignX: parseFloat(f.dataset.alignX) || 0.5,
            alignY: parseFloat(f.dataset.alignY) || 0.5,
            left: r.left, top: r.top, width: r.width, height: r.height,
          }
        }
      }
      return null
    }

    const tick = () => {
      if (cancelled) return
      const now = performance.now()
      // Only track while the cursor is actually being dragged (awake) — a bare
      // scroll never runs the effect.
      const hit = isAwake.current ? readCard() : null
      if (hit) lastHitRef.current = now

      const withinGrace = now - lastHitRef.current <= GRACE_MS
      if (!hit && !withinGrace) {
        if (lastKeyRef.current !== null) {
          lastKeyRef.current = null
          setTarget(null)
        }
        return
      }
      if (!hit) return // keep the last card during the grace window (dissolve-out)

      const r = hit
      const key = `${r.src}|${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}|${r.alignX},${r.alignY}`
      if (key === lastKeyRef.current) return
      lastKeyRef.current = key
      setTarget(r)
    }

    const id = setInterval(tick, POLL_MS)
    tick()
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isTouch, isAwake, parked])

  if (!isTouch || !target) return null

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: target.left,
        top: target.top,
        width: target.width,
        height: target.height,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 9000, // above the page, below the mobile cursor (9999)
      }}
    >
      <MobileSectionCanvas
        effectType="featured-ripple"
        image={target.src}
        cursorRef={parked}
        effectOpts={{ alignX: target.alignX, alignY: target.alignY }}
      />
    </div>,
    document.body,
  )
}
