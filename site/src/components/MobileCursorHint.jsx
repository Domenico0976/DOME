import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCursorGate } from '../hooks/useCursorGate'
import { useActiveSection } from '../hooks/useActiveSection'
import { pickHint } from '../content/mobileCursorHints'

// Mobile-cursor tutorial pill.
//
// Shown only on touch, anchored just above the floating mobile cursor, for the
// section currently filling the viewport. It is purely additive guidance:
// `pointer-events: none`, so it can never block a scroll or a tap.
//
// Lifecycle: appears once the user has been idle for IDLE_MS; hides the instant
// they grab the cursor or tap the page; comes back after another idle window with
// a fresh random phrase (never the same twice in a row).
const IDLE_MS = 3000
const POLL_MS = 180
const GAP = 20

export default function MobileCursorHint() {
  const { isTouch, isAwake } = useCursorGate()
  const sectionId = useActiveSection()
  const [hint, setHint] = useState({ visible: false, phrase: '', left: 0, top: 0, section: null })
  const lastActRef = useRef(
    typeof performance !== 'undefined' ? performance.now() : 0,
  )
  const lastPhraseRef = useRef('')
  const sectionRef = useRef(sectionId)

  useEffect(() => {
    sectionRef.current = sectionId
  }, [sectionId])

  // Any tap/click on the page counts as activity: hide + reset the idle clock.
  useEffect(() => {
    if (!isTouch) return
    const bump = () => {
      lastActRef.current = performance.now()
    }
    window.addEventListener('pointerdown', bump, { passive: true, capture: true })
    return () => window.removeEventListener('pointerdown', bump, { capture: true })
  }, [isTouch])

  useEffect(() => {
    if (!isTouch) return
    let cancelled = false
    lastActRef.current = performance.now()

    const evaluate = () => {
      if (cancelled) return
      const now = performance.now()
      const awake = !!isAwake.current
      // Steering the cursor is activity: keep the pill hidden while it moves.
      if (awake) lastActRef.current = now
      const idle = now - lastActRef.current
      const cursorEl = document.querySelector('.archive-cursor--mobile')
      const section = sectionRef.current
      const canShow =
        !!cursorEl && !awake && idle >= IDLE_MS && !document.hidden && !!section

      setHint((prev) => {
        if (!canShow) return prev.visible ? { ...prev, visible: false } : prev

        const r = cursorEl.getBoundingClientRect()
        const vw = window.innerWidth || 1
        // Keep the centred pill fully on screen: half of the max pill width.
        const half = Math.min(160, vw * 0.39)
        const cx = r.left + r.width / 2
        const left = Math.max(Math.min(half + 8, vw / 2), Math.min(vw - half - 8, cx))
        const top = Math.max(r.height + GAP + 4, r.top - GAP)

        // Fresh phrase on (re)appearance or when the section changed under it.
        const needNew = !prev.visible || prev.section !== section
        const nextPhrase = needNew ? pickHint(section, lastPhraseRef.current) : prev.phrase
        if (!nextPhrase) return prev.visible ? { ...prev, visible: false } : prev
        if (needNew) lastPhraseRef.current = nextPhrase

        if (
          prev.visible && prev.section === section &&
          prev.left === left && prev.top === top && prev.phrase === nextPhrase
        ) return prev
        return { visible: true, phrase: nextPhrase, left, top, section }
      })
    }

    const id = setInterval(evaluate, POLL_MS)
    evaluate()
    window.addEventListener('resize', evaluate)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('resize', evaluate)
    }
  }, [isTouch, isAwake])

  if (!isTouch || !hint.visible || !hint.phrase) return null

  return createPortal(
    <div
      className="cursor-hint"
      role="status"
      aria-live="polite"
      style={{ left: hint.left, top: hint.top }}
    >
      <span className="cursor-hint__dot" aria-hidden="true" />
      <span className="cursor-hint__text">{hint.phrase}</span>
    </div>,
    document.body,
  )
}
