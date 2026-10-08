import { useRef, useEffect } from 'react'

// Matrix-style digital rain on a fixed grid, confined to the right half. Streams
// fall in columns while the grid drifts left, so a column that exits on the left
// of the zone is re-created on its right — that wrap is the only entry point.
// Allocated on first activation and released on stop, so the rows hold no GPU
// memory while idle.
//
// Activation is driven by sync(), never by the listeners directly, because three
// things can turn it on: hover (desktop only), an expanded row (both layouts),
// and a layout flip. Going through one function keeps those from fighting:
//
//   desktop  hover wins, expansion forces it on, collapsing while still hovered
//            must NOT freeze the loop
//   compact  expansion is the ONLY trigger — no hover, no cursor drag
export function useMatrixRain({ rowRef, isCompact, isExpanded }) {
  const bloomRef = useRef(null)
  const bloomRafRef = useRef(0)
  const bloomApiRef = useRef(null)
  const hoverRef = useRef(false)
  const isExpandedRef = useRef(isExpanded)

  useEffect(() => { isExpandedRef.current = isExpanded }, [isExpanded])

  useEffect(() => {
    const cvs = bloomRef.current
    const el = rowRef.current
    if (!cvs || !el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const MIN_CELL = 12
    const TRAIL = 12
    const SPEED_MIN = 2
    const SPEED_MAX = 16
    const DRIFT = 2
    const MAX_DESKTOP_STREAMS = 10
    const MAX_COMPACT_STREAMS = 5
    const HEAD = 'rgb(132, 150, 179)'
    // How long a head keeps falling after it leaves the grid, dissolving as it goes. The
    // hard bottom edge is not drawn here: .project-row clips the canvas (which is 103%
    // tall) so the overflow is already cut for us.
    const DEATH_FADE_MS = 350
    // Same language as the blur(7px) on .project-row::before. Only the dying head gets it.
    const DEATH_BLUR_PX = 7
    // Must outlast the 480ms CSS exit on .pr-matrix-rain, or the buffer is freed
    // while the last frame is still fading.
    const RELEASE_MS = 560

    let ctx = null
    let ro = null
    let releaseTimer = null
    let w = 0, h = 0, cell = MIN_CELL, cols = 0, rows = 0
    let zoneX = 0, zoneW = 0
    let drift = 0, last = 0
    let active = []
    const streams = new Map()

    const build = () => {
      const r = el.getBoundingClientRect()
      w = Math.max(1, Math.round(r.width))
      h = Math.max(1, Math.round(r.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      cvs.width = Math.round(w * dpr)
      cvs.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cell = Math.max(MIN_CELL, Math.round(h / 16))
      rows = Math.ceil(h / cell)
      // Rain lives only in the right half: the grid is offset to mid-width and the
      // wrap period is the zone width, so no column ever crosses the midpoint.
      zoneX = w / 2
      zoneW = w - zoneX
      cols = Math.max(1, Math.floor(zoneW / cell))
      const n = Math.min(isCompact ? MAX_COMPACT_STREAMS : MAX_DESKTOP_STREAMS, cols)
      active = []
      for (let i = 0; i < n; i++) active.push(Math.floor(i * cols / n))
      for (const c of active) {
        // diedAt is the frame timestamp at which the head left the grid, 0 while alive.
        streams.set(c, {
          y: Math.random() * rows,
          speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
          diedAt: 0,
        })
      }
    }

    const frame = (now) => {
      bloomRafRef.current = requestAnimationFrame(frame)
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      // Modulo the zone width, so wrapping drift shifts every column by one whole
      // period and the pattern lands on itself — no visible jump.
      drift = (drift + DRIFT * dt) % (cols * cell)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = HEAD
      for (const c of active) {
        const s = streams.get(c)
        s.y += s.speed * dt
        let x = zoneX + c * cell - drift
        if (x + cell <= zoneX) x += cols * cell

        // The head starts dying the moment it leaves the grid at the bottom. From here it
        // keeps falling instead of being culled, so the row's overflow clips it mid-block:
        // the last block reads as trying to cross the edge and being absorbed by it.
        if (!s.diedAt && s.y > rows) s.diedAt = now
        const deathT = s.diedAt ? Math.min(1, (now - s.diedAt) / DEATH_FADE_MS) : 0

        for (let t = 0; t <= TRAIL; t++) {
          const ry = s.y - t
          if (ry < 0) continue
          // A live head is still culled below the grid; a dying one must be allowed past it,
          // otherwise there is nothing left to fade.
          if (!s.diedAt && ry > rows) continue
          const dying = t === 0 && !!s.diedAt
          if (dying) {
            ctx.shadowBlur = DEATH_BLUR_PX
            ctx.shadowColor = HEAD
          }
          ctx.globalAlpha = (1 - t / (TRAIL + 1)) ** 1.6 * 0.85 * (1 - deathT)
          ctx.fillRect(x, ry * cell, cell, cell)
          if (dying) ctx.shadowBlur = 0
        }

        // Reset only once the fade is over. Resetting where the old `s.y - TRAIL > rows`
        // check stood would respawn the stream in the same frame the head died, so the
        // dissolve would never be on screen for a single frame.
        if (s.diedAt && deathT >= 1) { s.diedAt = 0; s.y = -Math.random() * 4 }
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
    }

    const start = () => {
      // A pending release means we are mid-fade. Re-hovering has to cancel it and
      // carry on from the same buffer, so nothing blanks and the rain never
      // restarts from a half-torn-down state.
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
      if (bloomRafRef.current) return
      ctx = cvs.getContext('2d')
      if (!ctx) return
      // Drop any observer left over from a previous cycle before making a new one,
      // otherwise every re-hover stacks another live ResizeObserver.
      if (ro) { ro.disconnect(); ro = null }
      build()
      ro = new ResizeObserver(build)
      ro.observe(el)
      el.classList.add('is-raining')
      last = 0
      bloomRafRef.current = requestAnimationFrame(frame)
    }

    const release = () => {
      if (ro) { ro.disconnect(); ro = null }
      if (ctx) { ctx.clearRect(0, 0, w, h); ctx = null }
      cvs.width = 0
      cvs.height = 0
    }

    const stop = () => {
      if (bloomRafRef.current) cancelAnimationFrame(bloomRafRef.current)
      bloomRafRef.current = 0
      // The class drives the CSS fade, so the canvas keeps its last frame and
      // dissolves through the transition instead of vanishing on the next tick.
      el.classList.remove('is-raining')
      if (releaseTimer) clearTimeout(releaseTimer)
      releaseTimer = setTimeout(() => { releaseTimer = null; release() }, RELEASE_MS)
    }

    const sync = () => {
      const wanted = isExpandedRef.current || (!isCompact && hoverRef.current)
      if (wanted) start()
      else stop()
    }

    bloomApiRef.current = { start, stop, sync }

    if (!isCompact) {
      const onEnter = () => { hoverRef.current = true; sync() }
      const onLeave = () => { hoverRef.current = false; sync() }
      el.addEventListener('pointerenter', onEnter)
      el.addEventListener('pointerleave', onLeave)
      return () => {
        if (bloomRafRef.current) cancelAnimationFrame(bloomRafRef.current)
        bloomRafRef.current = 0
        if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
        release()
        el.removeEventListener('pointerenter', onEnter)
        el.removeEventListener('pointerleave', onLeave)
        bloomApiRef.current = null
      }
    }

    // Compact: no hover listeners at all. sync() below reacts to expansion.
    return () => {
      if (bloomRafRef.current) cancelAnimationFrame(bloomRafRef.current)
      bloomRafRef.current = 0
      if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
      release()
      bloomApiRef.current = null
    }
  }, [isCompact, rowRef])

  useEffect(() => {
    const api = bloomApiRef.current
    if (!api || !api.sync) return
    api.sync()
  }, [isExpanded, isCompact])

  return bloomRef
}
