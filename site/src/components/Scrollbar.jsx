import { useEffect, useRef, useState } from 'react'

const MIN_THUMB = 48
const TRACK_W = 20
const THUMB_W = 10
const FADE_MS = 450

function preloaderGone() {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve()
    const el = document.getElementById('preloader')
    if (!el) return resolve()
    try {
      if (
        el.classList.contains('no-preload') ||
        window.getComputedStyle(el).display === 'none'
      ) {
        return resolve()
      }
    } catch {
      return resolve()
    }
    let done = false
    const rootEl = document.getElementById('root')
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          if (!document.getElementById('preloader')) return finish()
        } else if (
          m.target === rootEl &&
          (rootEl.style.maskImage || rootEl.style.webkitMaskImage)
        ) {
          return finish()
        }
      }
    })
    const finish = () => {
      if (done) return
      done = true
      mo.disconnect()
      clearTimeout(safety)
      resolve()
    }
    mo.observe(document.body, { childList: true })
    if (rootEl) {
      if (rootEl.style.maskImage || rootEl.style.webkitMaskImage) return finish()
      mo.observe(rootEl, { attributes: true, attributeFilter: ['style'] })
    }
    const safety = setTimeout(finish, 20000)
  })
}

function metrics(top) {
  const doc = document.documentElement
  const vh = window.innerHeight
  const docH = Math.max(doc.scrollHeight, vh)
  const trackH = Math.max(1, vh - top)
  const maxScroll = Math.max(0, docH - vh)
  let thumbH = (trackH * vh) / docH
  thumbH = Math.min(trackH, Math.max(MIN_THUMB, thumbH))
  if (docH <= vh + 1) thumbH = trackH
  return { vh, docH, trackH, maxScroll, thumbH }
}

function readLenis() {
  try {
    const lenis = window.__lenis
    if (lenis && typeof lenis.on === 'function') return lenis
  } catch {
    // server render or blocked access: native fallback below
  }
  return null
}

export default function Scrollbar() {
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const posRef = useRef({ scroll: 0 })
  const geomRef = useRef({ vh: 1, docH: 1, trackH: 1, maxScroll: 0, thumbH: MIN_THUMB })
  const dragRef = useRef(null)
  const driveRef = useRef(null)
  const syncRef = useRef(null)
  const topRef = useRef(0)
  const [revealed, setRevealed] = useState(false)
  const [trackTop, setTrackTop] = useState(0)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    let dead = false
    let fallbackOff = null
    preloaderGone().then(() => {
      if (!dead) setRevealed(true)
    })

    const measureHeader = () => {
      const h =
        document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0
      const t = h + 12
      topRef.current = t
      setTrackTop(t)
    }
    measureHeader()

    const sync = () => {
      const m = metrics(topRef.current)
      geomRef.current = m
      const y = Math.min(Math.max(posRef.current.scroll, 0), m.maxScroll)
      const travel = Math.max(0, m.trackH - m.thumbH)
      const top = m.maxScroll > 0 && m.docH > m.vh + 1 ? (y / m.maxScroll) * travel : 0
      const th = thumbRef.current
      if (th) {
        th.style.height = `${m.thumbH}px`
        th.style.transform = `translateY(${top}px)`
      }
    }

    const drive = (target, immediate) => {
      const g = geomRef.current
      const y = Math.min(Math.max(target, 0), g.maxScroll)
      posRef.current.scroll = y
      const lenis = readLenis()
      if (lenis && typeof lenis.scrollTo === 'function') {
        try {
          lenis.scrollTo(y, immediate ? { immediate: true } : undefined)
          if (!immediate) sync()
          else {
            const m = metrics(topRef.current)
            geomRef.current = m
            const travel = Math.max(0, m.trackH - m.thumbH)
            const top = m.maxScroll > 0 && m.docH > m.vh + 1 ? (y / m.maxScroll) * travel : 0
            const th = thumbRef.current
            if (th) {
              th.style.height = `${m.thumbH}px`
              th.style.transform = `translateY(${top}px)`
            }
          }
          return
        } catch {
          // fall through to native scroll below
        }
      }
      window.scrollTo(0, y)
    }

    const lenis = readLenis()
    if (lenis) {
      const onScroll = (e) => {
        if (dead || dragRef.current) return
        if (e && typeof e.scroll === 'number') posRef.current.scroll = e.scroll
        else posRef.current.scroll = window.scrollY
        sync()
      }
      lenis.on('scroll', onScroll)
    } else {
      const onScroll = () => {
        if (dead || dragRef.current) return
        posRef.current.scroll = window.scrollY
        sync()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      fallbackOff = () => window.removeEventListener('scroll', onScroll)
    }

    let raf = 0
    let scheduled = false
    const resync = () => {
      if (scheduled) return
      scheduled = true
      raf = requestAnimationFrame(() => {
        scheduled = false
        if (dead) return
        const h =
          document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0
        const t = h + 12
        if (t !== topRef.current) {
          topRef.current = t
          setTrackTop(t)
        }
        sync()
      })
    }
    window.addEventListener('resize', resync)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(resync)
      ro.observe(document.documentElement)
    }

    sync()
    driveRef.current = drive
    syncRef.current = sync

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resync)
      if (ro) ro.disconnect()
      if (fallbackOff) fallbackOff()
      driveRef.current = null
      syncRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onThumbDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startY: e.clientY, startScroll: posRef.current.scroll }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // pointer capture unsupported: moves still tracked on the thumb
    }
  }

  const onThumbMove = (e) => {
    const d = dragRef.current
    const drive = driveRef.current
    if (!d || !drive) return
    const g = geomRef.current
    const scale = g.maxScroll / Math.max(1, g.trackH - g.thumbH)
    drive(d.startScroll + (e.clientY - d.startY) * scale, true)
  }

  const onThumbUp = () => {
    dragRef.current = null
    if (syncRef.current) syncRef.current()
  }

  const onTrackDown = (e) => {
    if (e.target !== trackRef.current) return
    const drive = driveRef.current
    if (!drive) return
    const rect = trackRef.current.getBoundingClientRect()
    const th = thumbRef.current.getBoundingClientRect()
    const dir = e.clientY - rect.top < th.top - rect.top ? -1 : 1
    drive(posRef.current.scroll + dir * window.innerHeight * 0.8, false)
  }

  return (
    <div
      ref={trackRef}
      aria-hidden="true"
      onPointerDown={onTrackDown}
      style={{
        position: 'fixed',
        top: trackTop,
        right: 0,
        width: TRACK_W,
        height: `calc(100dvh - ${trackTop}px)`,
        // Sopra ogni cosa (hero/textEntry/footer canvas, pendulum 9999):
        // senza z-index il track sta sotto i layer con stacking proprio.
        zIndex: 100000,
        pointerEvents: revealed ? 'auto' : 'none',
        visibility: revealed ? 'visible' : 'hidden',
        opacity: revealed ? 1 : 0,
        transition: reduceMotion ? 'none' : `opacity ${FADE_MS}ms ease`,
      }}
    >
      <div
        ref={thumbRef}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        style={{
          position: 'absolute',
          top: 0,
          right: (TRACK_W - THUMB_W) / 2,
          width: THUMB_W,
          height: MIN_THUMB,
          borderRadius: 999,
          // Bianco + difference = |sfondo - bianco| = sfondo invertito: sempre
          // visibile ovunque. Nero + difference darebbe |sfondo - 0| = sfondo
          // = thumb invisibile (era il bug).
          background: 'white',
          mixBlendMode: 'difference',
          zIndex: 99999,
          pointerEvents: revealed ? 'auto' : 'none',
          touchAction: 'none',
          cursor: 'grab',
        }}
      />
    </div>
  )
}
