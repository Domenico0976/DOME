import React, { useState, useCallback, useRef, useEffect } from 'react'
import gsap from 'gsap'

const AMBIENT_URL = () => import.meta.env.BASE_URL + 'assets/audio/Ambient/Ambient-music.mp3'
const GIF_URL = () => import.meta.env.BASE_URL + 'assets/favicon/favicon-black-gif.gif'

const BRAND_TEXTS = ['DOME', 'SOMEBODYWANT3D']

export default function Header() {
  const [muted, setMuted] = useState(true)
  const audioRef = useRef(null)
  const brandRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(AMBIENT_URL())
    audio.volume = 0.35
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

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

  const toggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      const audio = audioRef.current
      if (audio) {
        if (next) {
          audio.pause()
        } else {
          audio.play().catch(() => {})
        }
      }
      return next
    })
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
          <button
            type="button"
            className={`sound${muted ? ' is-muted' : ''}`}
            aria-pressed={muted ? 'false' : 'true'}
            aria-label={muted ? 'Play ambient sound' : 'Mute ambient sound'}
            onClick={toggle}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
            <span>Sound</span>
          </button>
        </div>
      </nav>
    </header>
  )
}
