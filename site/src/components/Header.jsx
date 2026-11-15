import React, { useRef, useEffect, useLayoutEffect, useState } from 'react'
import gsap from 'gsap'
import { soundCore } from '../sound/core.js'
import { createAmbient } from '../sound/ambient.js'
import { useSoundEnabled, useSoundLocked } from '../hooks/useSoundEnabled.js'

const AMBIENT_URL = () => import.meta.env.BASE_URL + 'assets/audio/Ambient/Ambient-music.mp3'
const GIF_URL = () => import.meta.env.BASE_URL + 'assets/favicon/favicon-black-gif.gif'

const BRAND_TEXTS = ['DOME', 'SOMEBODYWANT3D', 'DOMENICO FUSTO', 'UX/UI DESIGNER', 'FRONT-END DEVELOPER', 'INTERACTION DESIGNER', 'WEB DESIGNER', 'WEB DEVELOPER']

// Capture on window: nothing in the page can hide the first interaction from us by
// stopping propagation, and `passive` keeps scroll/touch behaviour untouched.
const CAPTURE = { capture: true, passive: true }

// The two labels the button can show, as one state machine. The roulette slides
// the outgoing word up and brings the incoming one up from below, character by
// character (same idea as the brand roulette in the header).
const WORDS = { on: 'Sound', off: 'Muted' }

function Word({ text }) {
  return (
    <span className="sound__word" aria-hidden="true">
      {text.split('').map((ch, i) => (
        <span className="sound__char" key={`${ch}-${i}`}>
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </span>
  )
}


export default function Header() {
  // The button is now the site-wide sound switch, not just an ambient toggle:
  // ambient, click sounds and the hero water all read `soundCore`. Default on;
  // an explicit off is remembered across reloads (see sound/core.js).
  const enabled = useSoundEnabled()
  // True while the browser still refuses audio (no gesture yet). The button is
  // "on" in our state and silent in the platform's, so it has to say that — and
  // the hint chip under it says what to do about it.
  const locked = useSoundLocked()
  const audioRef = useRef(null)
  const brandRef = useRef(null)
  const wordsRef = useRef(null)

  // ─── Label roulette ────────────────────────────────────────────────────────
  // Two phases so the swap never renders both words at once: slide the current
  // one out, set the new word, slide it in. The state holds the word on screen,
  // not the desired one — that is what keeps the two halves in order.
  const [shown, setShown] = useState(enabled ? 'on' : 'off')
  const firstLabelRef = useRef(true)

  useEffect(() => {
    const target = enabled ? 'on' : 'off'
    if (target === shown) return
    const chars = wordsRef.current?.querySelectorAll('.sound__char')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !chars || chars.length === 0) {
      setShown(target)
      return
    }
    const tl = gsap.timeline({ onComplete: () => setShown(target) })
    tl.to(chars, { yPercent: -115, opacity: 0, duration: 0.3, ease: 'power3.in', stagger: 0.02 })
    return () => tl.kill()
  }, [enabled, shown])

  useLayoutEffect(() => {
    const chars = wordsRef.current?.querySelectorAll('.sound__char')
    if (!chars || chars.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      gsap.set(chars, { yPercent: 0, opacity: 1 })
      return
    }
    if (firstLabelRef.current) {
      firstLabelRef.current = false
      gsap.set(chars, { yPercent: 0, opacity: 1 })
      return
    }
    const tl = gsap.fromTo(
      chars,
      { yPercent: 115, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.42, ease: 'power3.out', stagger: 0.03 },
    )
    return () => tl.kill()
  }, [shown])

  useEffect(() => {
    // Two elements under the hood: the loop is a 1s crossfade, not a hard restart
    // (see sound/ambient.js).
    // `loopEnd: 60` because Ambient-music.mp3 is 63.86s long but the music itself
    // ends at 1:00 and then rings out to ~63.5s. Looping on the file end put the
    // crossfade inside that dead tail, and the next loop came in at full level out
    // of near-silence — the cut you could still hear. Anchored at 60s the fade-out
    // finishes exactly on the last musical beat and the new loop fades in over it.
    const ambient = createAmbient({
      url: AMBIENT_URL(),
      volume: 0.15,
      crossfadeMs: 800,
      loopEnd: 46,
    })
    audioRef.current = ambient
    return () => {
      ambient.dispose()
      audioRef.current = null
    }
  }, [])

  // Play/pause follows the switch. The first attempt on load is usually blocked
  // (no gesture yet), so it is retried once on the first real gesture instead of
  // leaving the ambient silent until the user happens to hit the button.
  useEffect(() => {
    const ambient = audioRef.current
    if (!ambient) return
    if (!enabled) {
      ambient.stop()
      return
    }

    let cancelled = false
    const GESTURES = ['pointerdown', 'pointerup', 'click', 'keydown', 'touchstart', 'touchend']
    const teardown = () => {
      for (const type of GESTURES) window.removeEventListener(type, start, CAPTURE)
    }
    function start() {
      if (cancelled) return
      ambient.start().then((ok) => {
        if (!ok) return // still no user activation: the listeners stay armed
        teardown()
        soundCore.setLocked(false)
      })
    }

    // The invite chip runs this inside a real click.
    const stopUnlockRequest = soundCore.onUnlockRequest(() => ambient.start())

    start()
    // Capture phase on window: the first interaction of the visit must be caught
    // even if something in the page stops propagation before it bubbles.
    for (const type of GESTURES) window.addEventListener(type, start, CAPTURE)

    return () => {
      cancelled = true
      teardown()
      stopUnlockRequest()
    }
  }, [enabled])

  useEffect(() => {
    const container = brandRef.current
    if (!container) return
    const items = Array.from(container.querySelectorAll('.brand__text'))
    if (items.length < 2) return

    // Split each label into per-character spans.
    items.forEach((el) => {
      const text = el.textContent
      el.textContent = ''
      text.split('').forEach((ch) => {
        const span = document.createElement('span')
        span.className = 'brand__char'
        span.textContent = ch === ' ' ? '\u00a0' : ch
        el.appendChild(span)
      })
    })

    const itemChars = items.map((el) => Array.from(el.querySelectorAll('.brand__char')))

    // Initial state: first visible, second hidden below.
    items.forEach((el, i) => {
      gsap.set(el, { opacity: 1 })
      gsap.set(itemChars[i], { yPercent: i === 0 ? 0 : 100, opacity: 1 })
    })

    let current = 0
    let animating = false
    const tick = () => {
      if (animating) return
      animating = true
      const next = (current + 1) % items.length
      const curChars = itemChars[current]
      const nextChars = itemChars[next]

      const tl = gsap.timeline({
        onComplete: () => { animating = false },
      })
      // Outgoing: chars slide up and out with stagger.
      tl.to(curChars, { yPercent: -100, duration: 0.4, ease: 'power3.in', stagger: 0.02 })
      // Incoming: chars slide up from below with stagger, overlapping.
      tl.fromTo(nextChars, { yPercent: 100 }, { yPercent: 0, duration: 0.4, ease: 'power3.out', stagger: 0.02 }, '-=0.2')

      current = next
    }

    const interval = window.setInterval(tick, 4000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <header className="site-header">
      <nav className="nav" aria-label="Primary">
        <a href="#top" className="brand">
          <img className="brand__gif" src={GIF_URL()} alt="" aria-hidden="true" />
          <span className="brand__roulette" ref={brandRef}>
            {BRAND_TEXTS.map((t) => (
              <span key={t} className="brand__text">{t}</span>
            ))}
          </span>
        </a>
        <div className="nav__menu">
          <span className="eyebrow" aria-hidden="true">Portfolio / 2022 – 2026</span>
          <div className="sound-wrap">
            <button
              type="button"
              className={`sound${enabled ? '' : ' is-muted'}${enabled && locked ? ' is-waiting' : ''}`}
              aria-pressed={enabled ? 'true' : 'false'}
              aria-label={
                !enabled
                  ? 'Play all sound'
                  : locked
                    ? 'Sound is on, waiting for your first click'
                    : 'Mute all sound'
              }
              onClick={() => soundCore.toggle()}
            >
              <span className="sound__meter" aria-hidden="true">
                <span className="sound__bar"></span>
                <span className="sound__bar"></span>
                <span className="sound__bar"></span>
              </span>
              <span className="sound__words" ref={wordsRef}>
                <Word text={WORDS[shown]} />
              </span>
            </button>
            {/* The invite, anchored to the button's right corner. It says the one
                thing the button cannot: the browser needs a click before anything
                may be heard. Decorative for AT (the button's aria-label says it). */}
            {enabled && locked && (
              <span className="sound-hint" aria-hidden="true">
                click anywhere to play sounds
              </span>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
