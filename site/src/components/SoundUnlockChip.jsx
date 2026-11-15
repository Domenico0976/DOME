import React, { useEffect, useState } from 'react'
import { soundCore } from '../sound/core.js'
import { useSoundEnabled, useSoundLocked } from '../hooks/useSoundEnabled.js'

// Custom invite that replaces the browser's own "click to enable audio" dead end.
//
// Why it exists: Chrome keeps every audio API suspended until the page has had a
// real gesture — measured, not assumed (`AudioContext` stays `suspended` and
// `HTMLMediaElement.play()` rejects with NotAllowedError after twenty mouse moves
// and a wheel). Mouse movement is not a gesture. So a visitor who only ever hovers
// hears nothing, and the header button alone cannot fix it.
//
// This chip IS the gesture. One tap runs every audio owner's unlock handler inside
// the click (ambient + water), then disappears for good. It never blocks anything:
// it sits at the bottom, the page scrolls and clicks behind it.
//
// Hidden when: the site is muted by choice, already unlocked, or the visitor
// arrived with activation (reload after any click) — `soundCore` starts unlocked
// in that case, so no chip flashes for people who are already listening.
const APPEAR_DELAY_MS = 900

export default function SoundUnlockChip() {
  const enabled = useSoundEnabled()
  const locked = useSoundLocked()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  const wanted = enabled && locked

  // Two gates before the invite appears: the preloader must be gone (it covers the
  // viewport at z-9999, and this chip would otherwise float on top of the counter),
  // and then a short settle delay so it does not land mid-reveal.
  useEffect(() => {
    if (!wanted) {
      setVisible(false)
      return
    }

    let hidden = false
    let timer = 0
    let observer = null

    const schedule = () => {
      if (hidden) return
      timer = setTimeout(() => setVisible(true), APPEAR_DELAY_MS)
    }

    const root = typeof document !== 'undefined' ? document.getElementById('preloader') : null
    const covered = root && getComputedStyle(root).display !== 'none'

    if (!covered) {
      schedule()
    } else {
      observer = new MutationObserver(() => {
        if (!root.isConnected || getComputedStyle(root).display === 'none') {
          observer.disconnect()
          observer = null
          schedule()
        }
      })
      observer.observe(document.body, { childList: true })
    }

    return () => {
      hidden = true
      clearTimeout(timer)
      if (observer) observer.disconnect()
    }
  }, [wanted])

  if (!wanted || !visible) return null

  const handleClick = () => {
    if (busy) return
    setBusy(true)
    soundCore.requestUnlock().finally(() => setBusy(false))
  }

  return (
    <button
      type="button"
      className="sound-unlock"
      data-busy={busy ? 'true' : undefined}
      onClick={handleClick}
      aria-label="Turn the sound on for this site"
    >
      <span className="sound-unlock__dot" aria-hidden="true" />
      <span className="sound-unlock__text">Tap to hear the site</span>
    </button>
  )
}
