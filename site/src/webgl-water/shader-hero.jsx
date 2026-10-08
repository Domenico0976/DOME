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

  // Manual scroll-driven transform on the GL wrapper.
  // Overrides any ScrollTrigger usage — this is a bare passive listener + rAF
  // coalesce so it works alongside Lenis without interfering with GSAP scroll state.
  useEffect(() => {
    // Respect user's motion preference: no transforms if reduced motion is on.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const cfg = {
      maxScale: 1.25,
      maxRotateZ: .2,
      maxTranslateY: -28,
      progressStart: 0.15,
      progressEnd: 0.85,
    }

    const el = sectionRef.current
    if (!el) return

    const tick = () => {
      const wrapper = el.querySelector('.hero-shader-wrapper')
      if (!wrapper) return

      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      const raw = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)))
      const p = Math.max(0, Math.min(1, (raw - cfg.progressStart) / (cfg.progressEnd - cfg.progressStart)))
      // smoothstep easing
      const t = p * p * (3 - 2 * p)

      // ASSIGN, never compound — each tick writes the full transform string.
      wrapper.style.transform = `translate3d(0, ${cfg.maxTranslateY * t}px, 0) scale(${1 + (cfg.maxScale - 1) * t}) rotate(${cfg.maxRotateZ * t}deg)`
    }

    let rafId = 0
    const requestTick = () => {
      if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; tick() })
    }
    const onScroll = requestTick
    const onResize = requestTick

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    requestTick() // one initial tick so state is correct on mount

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
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
