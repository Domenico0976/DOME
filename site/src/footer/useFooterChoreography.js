import { useEffect } from 'react'
import {
  creditsReveal,
  creditsShift,
  coverScale,
  entryTransforms,
  expandProgress,
  layoutFor,
  pinOffset,
} from './geometry.js'
import { scaleState } from './scale.js'

// Entrata a strati, espansione e scala finale, in un solo rAF.
//
// Entrata: banda e immagine sono cornici fisse col contenuto che scorre
// dentro (niente buchi). L'immagine non trasla: parte con una scala che si
// assesta (1.06 → 1), perché una traslazione richiederebbe overscan e
// l'overscan zoomerebbe la scena aperta.
//
// Credits: la targa è incollata al bordo della banda (dove finisce
// l'immagine) e si stacca dal fondo del viewport solo come conseguenza dello
// scroll. Nessun cambio di `position`, nessuna classe: una sola traslazione
// continua, quindi entra e esce senza scatti e resta per tutto lo scroll.
//
// Espansione e scala: tutto derivato dalla posizione del media. Finché la
// cima del media è sotto l'header non c'è pin e l'arte resta a scala banda;
// quando la cima arriva sotto l'header il pin parte 1:1 con lo scroll e la
// scala scende al target contenuto. Essendo derivato, salendo si riavvolge
// da solo: nessuno stato da azzerare.
const AMP = 90
const STAGGER = 0.22
const INVERT = true

// Altezza della banda dalla custom property: un `height` inline (scena
// aperta) non deve falsare la misura, e ai breakpoint cambia da sola.
const bandHeight = (el) => {
  if (!el) return 0
  try {
    const v = Number.parseFloat(getComputedStyle(el).getPropertyValue('--band-h'))
    if (Number.isFinite(v) && v > 0) return v
  } catch {}
  return el.clientHeight || 0
}

export function useFooterChoreography({
  sceneRef,
  bandRef,
  mediaRef,
  creditsRef,
  legalRef,
  artRef,
  runwayRef,
  bannerRef,
  chipRef,
  scaleTravelRef,
  reducedMotion,
}) {
  useEffect(() => {
    if (reducedMotion) return
    const scene = sceneRef?.current
    const band = bandRef?.current
    const media = mediaRef?.current
    const credits = creditsRef?.current
    if (!scene || !band || !media || !credits) return

    let raf = 0
    let queued = false
    let bandH = bandHeight(media)
    const baseCreditsY = { current: 0 }
    // Bounce dei credits (solo testi) quando si e' in fondo.
    let bounceInterval = null
    let bounceScheduled = false
    let bounceRaf = 0
    const bounceState = { active: false, start: 0, peak: 15, duration: 900 }
    let wasScaling = false
    const atBottomRef = { current: false }
    const legalBaseY = { current: 0 }
    const creditsBaseY = { current: 0 }
    let transitionUntil = 0

    const measure = () => {
      const header = document.querySelector('.site-header')
      const legal = legalRef?.current || document.querySelector('.footer-legal')
      return {
        vh: window.innerHeight || 1,
        headerH: header ? header.getBoundingClientRect().height : 0,
        creditsH: legal ? legal.getBoundingClientRect().height : 0,
      }
    }

    const paint = () => {
      queued = false
      const m = measure()
      const vh = m.vh

      // ── entrata ────────────────────────────────────────────────────────
      const rect = scene.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.85)))
      const t = entryTransforms({ p, amp: AMP, stagger: STAGGER, invert: INVERT })

      band.style.transform = `translate3d(0, ${t.band}px, 0)`
      band.style.opacity = String(t.bandOpacity)

      // ── credits ────────────────────────────────────────────────────────
      // Due trasformazioni su due elementi diversi: la targa (.footer-legal)
      // si sposta verso il fondo, il contenuto (.footer-credits__drift)
      // scivola dentro la targa dall'alto. Sommandosi non si disturbano.
      const mediaRect = media.getBoundingClientRect()
      const mediaTop = mediaRect.top
      const pinned = media.style.height ? Math.max(0, (vh - m.creditsH - mediaRect.height) - mediaTop) : 0
      const locked = !media.style.height
      const footerVisible = locked && pinned === 0 && rect.top < vh && rect.bottom > 0
      const atBottom = footerVisible
      atBottomRef.current = atBottom
      const cr = creditsReveal({
        vh,
        bandBottom: mediaTop + bandH,
        creditsH: m.creditsH,
      })
      creditsBaseY.current = cr.y
      baseCreditsY.current = cr.y
      // Gestione timer bounce (solo testi, solo quando crediti visibili).
      const startBounce = () => {
        if (bounceState.active) return
        bounceState.active = true
        bounceState.start = performance.now()
        const base = creditsBaseY.current || baseCreditsY.current
        credits.style.transform = `translate3d(0, ${base}px, 0)`
        const tick = () => {
          const elapsed = performance.now() - bounceState.start
          if (elapsed < bounceState.duration) {
            const t = elapsed / bounceState.duration
            const off = bounceState.peak * Math.sin(Math.PI * t)
            credits.style.transform = `translate3d(0, ${base + off}px, 0)`
            bounceRaf = requestAnimationFrame(tick)
          } else {
            bounceState.active = false
            credits.style.transform = `translate3d(0, ${base}px, 0)`
            bounceRaf = 0
          }
        }
        bounceRaf = requestAnimationFrame(tick)
      }
      if (atBottom && !bounceScheduled) {
        bounceScheduled = true
        startBounce()
        bounceInterval = setInterval(() => {
          if (atBottomRef.current) startBounce()
        }, 4500)
      } else if ((!atBottom || pinned > 0) && bounceScheduled) {
        bounceScheduled = false
        if (bounceInterval) { clearInterval(bounceInterval); bounceInterval = null }
        if (bounceRaf) { cancelAnimationFrame(bounceRaf); bounceRaf = 0 }
        bounceState.active = false
      }
      const legal = legalRef?.current || document.querySelector('.footer-legal')
      if (!bounceState.active) credits.style.transform = `translate3d(0, ${cr.y}px, 0)`
      // Quando lo sblocco parte (pinned > 0) la targa credits scompare e
      // l'header risale, lasciando solo l'immagine animata.
      const legalEl = legalRef?.current || document.querySelector('.footer-legal')
      if (pinned > 0) {
        if (!wasScaling) transitionUntil = performance.now() + 500
        wasScaling = true
        // Lo scroll e' pinnato: i credits resterebbero fermi in alto. Eliminiamo
        // l'intero footer legal (con i testi) durante la scala.
        if (legalEl) {
          legalEl.style.transition = performance.now() < transitionUntil ? 'opacity 0.45s ease' : 'none'
          legalEl.style.opacity = '0'
          legalEl.style.visibility = 'hidden'
        }
        credits.style.opacity = '0'
        const headerEl = document.querySelector('.site-header')
        if (headerEl) {
          headerEl.style.transition = performance.now() < transitionUntil ? 'transform 0.45s ease' : 'none'
          headerEl.style.transform = `translateY(-${m.headerH}px)`
        }
      } else {
        const reverse = wasScaling
        if (reverse) transitionUntil = performance.now() + 500
        wasScaling = false
        const _shift = creditsShift({
          vh,
          creditsH: m.creditsH,
          mediaTop,
          bandH,
          naturalTop: legalEl && legalEl.parentElement ? legalEl.parentElement.getBoundingClientRect().top : mediaRect.top,
        })
        legalBaseY.current = _shift
        creditsBaseY.current = cr.y
        if (legalEl) {
          legalEl.style.transition = performance.now() < transitionUntil ? 'opacity 0.45s ease' : 'none'
          legalEl.style.visibility = 'visible'
          legalEl.style.opacity = String(cr.opacity)
          legalEl.style.transform = `translate3d(0, ${_shift}px, 0)`
        }
        const headerEl = document.querySelector('.site-header')
        if (headerEl) {
          headerEl.style.transition = performance.now() < transitionUntil ? 'transform 0.45s ease' : 'none'
          headerEl.style.transform = ''
        }
        credits.style.transition = performance.now() < transitionUntil ? 'transform 0.45s ease, opacity 0.45s ease' : 'none'
        credits.style.opacity = String(cr.opacity)
        baseCreditsY.current = cr.y
        if (!bounceState.active) credits.style.transform = `translate3d(0, ${cr.y}px, 0)`
      }
      if (false) {
        // `naturalTop`: dove starebbe la targa senza traslazione, cioè la cima
        // del suo contenitore (`top: 0`). Non il fondo: il fondo include la
        // corsa, che a runtime cambia lunghezza.
        const host = legal.parentElement
        const naturalTop = host
          ? host.getBoundingClientRect().top
          : mediaRect.top
        legal.style.transform = `translate3d(0, ${creditsShift({
          vh,
          creditsH: m.creditsH,
          mediaTop,
          bandH,
          naturalTop,
        })}px, 0)`
      }

      // ── espansione, pin e scala ────────────────────────────────────────
      const art = artRef?.current
      const runway = runwayRef?.current
      if (!art || !runway) return

      // Altezza inline = scena aperta: prima dello sblocco non c'è niente da
      // pinzare e la scala resta 1.
      const open = !!media.style.height
      // Dove si appoggia la scena aperta. Non è l'header: se l'immagine è
      // limitata dalla larghezza (mobile) resta più in basso, con il fondo
      // sulla targa. Con l'header come riferimento salirebbe di ~100px e si
      // staccherebbe dai credits a metà corsa.
      const restTop = vh - m.creditsH - mediaRect.height
      const q = open
        ? expandProgress({ lockTop: vh - m.creditsH - bandH, restTop, mediaTop })
        : 0
      // pinned già calcolato sopra (fase credits)

      const runwayH = runway.getBoundingClientRect().height
      if (!runwayH) return
      const travel = scaleTravelRef?.current || runwayH

      const layout = layoutFor({ width: media.clientWidth || window.innerWidth, ...m })
      const { scale, bannerOpacity } = scaleState({
        ...m,
        openW: layout.freeW,
        fileW: layout.fileW,
        fileH: layout.fileH,
        scrolled: pinned,
        runway: travel,
      })

      // L'arte entra con una scala che si assesta (1.06 → 1), poi tiene la
      // larghezza della banda per tutta l'espansione (la compensazione che
      // evita il salto quando il riquadro si restringe alla misura contenuta)
      // e infine scende al target.
      const entryScale = 1 + (1 - t.imageOpacity) * 0.06
      const cover = open ? coverScale({ bandW: window.innerWidth, openW: layout.freeW }) : 1
      const bandScale = 1 + (cover - 1) * (1 - q)
      const total = entryScale * bandScale * scale

      // Origine in cima durante l'espansione (la cima resta ferma sulla
      // cucitura), al centro durante la scala (l'arte rimpicciolisce dentro
      // lo spazio libero). A scala 1 le due origini coincidono: nessun salto.
      // L'immagine torna all'animazione precedente: niente distacco dall'alto.
      // Mantiene la velocita' della fase 1 (transformOrigin al centro quando pinned>0).
      art.style.transformOrigin = pinned > 0 ? '50% 50%' : '50% 0'
      art.style.transform = `translate3d(0, ${pinned}px, 0) scale(${total.toFixed(3)})`

      if (bannerRef?.current) bannerRef.current.style.opacity = String(bannerOpacity)
      if (chipRef?.current && pinned > 0) chipRef.current.style.opacity = '0'
    }

    const schedule = () => {
      if (queued) return
      queued = true
      raf = requestAnimationFrame(paint)
    }

    const onResize = () => {
      bandH = bandHeight(media)
      schedule()
    }

    // Lo scroll lo guida Lenis dentro il suo rAF. Se dipingessimo nel rAF
    // successivo (come fa `schedule`) il transform arriverebbe un frame dopo
    // lo scroll: l'immagine pinzata oscillerebbe di 2-3px per frame, che su un
    // dither si vede come tremolio. Dentro l'evento di Lenis siamo nello
    // stesso frame dello scroll, quindi il compenso è esatto.
    const lenis = typeof window !== 'undefined' ? window.__lenis : null
    const onLenisScroll = () => paint()
    const usesLenis = !!lenis && typeof lenis.on === 'function'
    if (usesLenis) lenis.on('scroll', onLenisScroll)
    else window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('footer:reflow', schedule)
    paint()

    return () => {
      if (usesLenis && typeof lenis.off === 'function') lenis.off('scroll', onLenisScroll)
      else window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('footer:reflow', schedule)
      if (raf) cancelAnimationFrame(raf)
      if (bounceInterval) clearInterval(bounceInterval)
      if (bounceRaf) cancelAnimationFrame(bounceRaf)
      band.style.transform = ''
      band.style.opacity = ''
      credits.style.transform = ''
      credits.style.opacity = ''
      const legal = legalRef?.current || document.querySelector('.footer-legal')
      if (legal) { legal.style.transform = ''; legal.style.transition = ''; legal.style.opacity = ''; legal.style.visibility = '' }
      credits.style.transform = ''
      credits.style.transition = ''
      credits.style.opacity = ''
      if (artRef?.current) artRef.current.style.transform = ''
      if (bannerRef?.current) bannerRef.current.style.opacity = ''
      const headerEl = document.querySelector('.site-header')
      if (headerEl) headerEl.style.transform = ''
    }
  }, [sceneRef, bandRef, mediaRef, creditsRef, legalRef, artRef, runwayRef, bannerRef, chipRef, scaleTravelRef, reducedMotion])
}
