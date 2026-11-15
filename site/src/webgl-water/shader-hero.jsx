import React, { Suspense, lazy, useCallback, useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { generateHeroEdgeMask, HERO_EDGE_CONFIG } from './HeroEdgeMask.js'

// The shader stack is the only part that has to wait for the `shaders` package.
// Everything else — the section, its background image, the static fallback — is
// rendered immediately, so the page never has a hole where the hero belongs and
// never jumps when the chunk lands.
const HeroShaderStack = lazy(() => import('./HeroShaderStack.jsx'))

export default function ShaderHero() {
  const [unavailable, setUnavailable] = useState(false)
  const handleUnavailable = useCallback(() => setUnavailable(true), [])
  const isMobile = useIsMobile()
  const sectionRef = useRef(null)

  // `isMobile` selects the copy only. There used to be a second JSX tree for
  // mobile that differed from the desktop one by an aria-label and a comment while
  // its own comment promised a lighter effect — the backend is identical, and
  // keeping two copies of a full-viewport section is how they drift apart.
  const label = isMobile ? 'Interactive hero' : 'Interactive cursor trail'

  // Apply the alpha-dither mask to the section so the bottom edge dissolves into
  // the paper background with no tint. Regenerates on resize (same seed → same
  // pattern, just scaled to the new section dimensions). The mask also animates:
  // a throttled frame loop repaints tail rain + vignette drift (mask-only, the
  // shader underneath is untouched).
  useLayoutEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frameRef = { current: 0 }
    let visible = true

    const apply = (frame) => {
      try {
        const rect = el.getBoundingClientRect()
        const dataUrl = generateHeroEdgeMask({
          width: rect.width,
          height: rect.height,
          frame,
        })
        // ponytail: webkitMaskMode doesn't exist in Safari — alpha is the webkit
        // default for maskImage, so we only set the standard `maskMode` property.
        el.style.webkitMaskImage = `url(${dataUrl})`
        el.style.maskImage = `url(${dataUrl})`
        el.style.webkitMaskSize = '100% 100%'
        el.style.maskSize = '100% 100%'
        el.style.webkitMaskRepeat = 'no-repeat'
        el.style.maskRepeat = 'no-repeat'
        el.style.maskMode = 'alpha'
      } catch (err) {
        // Mask generation failed — degrade gracefully: hero renders unmasked.
        console.warn('[HeroEdgeMask] mask generation failed, continuing unmasked', err)
      }
    }

    apply(0)

    // Frame cache: precompute the whole loop once (chunked so the main thread
    // stays responsive), then each tick only swaps the data URL — no regen cost
    // per tick, no lag. Rebuilt on resize; skipped under reduced motion.
    const cache = { urls: [], ok: false }
    let buildToken = 0
    const buildCache = async (token, w, h) => {
      const urls = []
      const total = HERO_EDGE_CONFIG.loopFrames
      for (let f = 0; f < total; f++) {
        if (token !== buildToken) return
        urls.push(generateHeroEdgeMask({ width: w, height: h, frame: f }))
        if (f % 8 === 7) await new Promise((r) => setTimeout(r, 0))
      }
      if (token !== buildToken || !el.isConnected) return
      cache.urls = urls
      cache.ok = true
    }
    const rebuild = () => {
      const rect = el.getBoundingClientRect()
      buildToken += 1
      cache.ok = false
      apply(frameRef.current)
      if (!reduceMotion) buildCache(buildToken, rect.width, rect.height)
    }

    // ResizeObserver with rAF-coalesced regeneration (pattern from App.jsx:36-44).
    // Same seed means the regenerated pattern looks identical at the new size.
    let scheduled = false
    const onResize = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        rebuild()
      })
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    let timer = 0
    let io = null
    let preMo = null
    let preSafety = 0
    const startCache = () => {
      if (!el.isConnected) return
      const rect = el.getBoundingClientRect()
      buildCache(buildToken, rect.width, rect.height)
    }
    if (!reduceMotion) {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
      })
      io.observe(el)
      if (!document.getElementById('preloader')) {
        startCache()
      } else {
        preMo = new MutationObserver(() => {
          if (preMo) preMo.disconnect()
          if (preSafety) clearTimeout(preSafety)
          startCache()
        })
        preMo.observe(document.body, { childList: true })
        preSafety = setTimeout(() => {
          if (preMo) preMo.disconnect()
          startCache()
        }, 8000)
      }
      timer = setInterval(() => {
        if (document.hidden || !visible || !el.isConnected || !cache.ok) return
        frameRef.current = (frameRef.current + 1) % HERO_EDGE_CONFIG.loopFrames
        const url = cache.urls[frameRef.current]
        if (url) {
          el.style.webkitMaskImage = `url(${url})`
          el.style.maskImage = `url(${url})`
        }
      }, 140)
    }

    return () => {
      buildToken += 1
      ro.disconnect()
      if (io) io.disconnect()
      if (preMo) preMo.disconnect()
      if (preSafety) clearTimeout(preSafety)
      if (timer) clearInterval(timer)
    }
  }, [])

  // Background-only scroll parallax.
  //
  // The `.hero-bg-layer` is the day photo on its OWN DOM layer, behind the
  // shader canvas — so we can drive it without touching the logo (inside the
  // shader) or the ring (in `HeroTextRing`). They stay exactly at their default
  // framing; only the photo drifts/overscans with the scroll.
  //  - progress is 0 at the hero's rest position → default framing on load, no
  //    first-scroll jump;
  //  - translate + a small scale for overscan, so the drift never reveals a gap
  //    at the layer's edges while the section height stays unchanged.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = sectionRef.current
    if (!el) return

    const MAX_Y = -34 // px the photo drifts up across the hero's exit
    const SCALE = 0.10 // overscan headroom (10% at full progress)

    const tick = () => {
      const layer = el.querySelector('.hero-bg-layer')
      if (!layer) return
      const rect = el.getBoundingClientRect()
      // 0 at the hero's rest position, 1 once it has scrolled out by its height.
      const p = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)))
      const t = p * p * (3 - 2 * p) // smoothstep
      // Overscan surplus per edge = (SCALE*t*H)/2 must exceed |MAX_Y*t| so no
      // edge gap shows: 0.05*945 ≈ 47px vs 34px. Safe at every t.
      layer.style.transform = `translate3d(0, ${MAX_Y * t}px, 0) scale(${1 + SCALE * t})`
    }

    let rafId = 0
    const requestTick = () => {
      if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; tick() })
    }
    const onScroll = requestTick
    const onResize = requestTick
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    // Apply as soon as the layer exists (it is synchronous here, but keep the
    // observer for safety if the stack mounts asynchronous content later).
    let mo = null
    if (el.querySelector('.hero-bg-layer')) {
      requestTick()
    } else if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(() => {
        if (el.querySelector('.hero-bg-layer')) {
          requestTick()
          mo.disconnect()
          mo = null
        }
      })
      mo.observe(el, { childList: true, subtree: true })
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (mo) mo.disconnect()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="hero-region hero-region--split"
      aria-label={label}
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100dvh',
        containIntrinsicWidth: '100vw',
        overflow: 'hidden',
        background: 'transparent',
        // Doubles as the pre-shader frame and as the no-GL fallback, so a failed
        // adapter leaves a hero rather than a transparent 100dvh block.
        backgroundImage: 'url(/hero-day-opt.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: '#fff',
      }}
    >
      {!unavailable ? (
        <Suspense fallback={null}>
          <HeroShaderStack onUnavailable={handleUnavailable} />
        </Suspense>
      ) : null}
    </section>
  )
}
