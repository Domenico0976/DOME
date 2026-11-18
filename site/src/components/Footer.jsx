import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useHeroWaterSound } from '../hooks/useHeroWaterSound.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import HeroTextRing from '../webgl-water/HeroTextRing.jsx'
import { useFooterChoreography } from '../footer/useFooterChoreography.js'
import { containBox } from '../footer/geometry.js'
import { resizeLenis } from '../smooth/lenisBoot.js'

const FooterWater = lazy(() => import('./FooterWater.jsx'))

// TODO(domenico): incolla qui le URL reali dei profili social.
// Una voce con URL vuoto resta testo non cliccabile: niente link morti in fondo pagina.
const SOCIAL_URLS = {
  LinkedIn: 'https://www.linkedin.com/in/domenico-fusto-a74273189/',
  GitHub: 'https://github.com/Domenico0976',
  Instagram: 'https://www.instagram.com/xoxomenico/',
}

const EMAIL = 'grafico.good@gmail.com'

const INDEX_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'Featured', href: '#featured' },
  { label: 'Archives', href: '#archives' },
]

// Le righe 01-05 dell'archivio: sono i cinque case study (id work-01 … work-05).
const WORK_LINKS = [
  { label: 'AlFly', href: '#work-01' },
  { label: 'Policlinico Milano', href: '#work-02' },
  { label: 'uBank', href: '#work-03' },
  { label: 'SISALFUNCLUB', href: '#work-04' },
  { label: 'iTour', href: '#work-05' },
]

const SOCIAL_LINKS = ['LinkedIn', 'GitHub', 'Instagram']

// --- Roulette hover ----------------------------------------------------------
// Stessa meccanica della brand roulette dell'header (Header.jsx): i caratteri
// escono verso l'alto con stagger e rientrano dal basso. Qui è guidata da CSS
// invece che da GSAP: ogni cella contiene due copie del carattere impilate e
// sull'hover lo stack trasla di -50% con un delay per indice. Vantaggi: è
// interrompibile (il mouse-out inverte a metà), funziona anche su
// :focus-visible da tastiera e non sposta il layout (la maschera è alta 1lh).
// `step` è il ritardo per carattere in ms: più corto sulle label lunghe.
function RouletteLabel({ label, step = 15 }) {
  const chars = Array.from(label)
  return (
    <span className="rl-mask" aria-hidden="true">
      {chars.map((ch, i) => (
        <span className="rl-cell" key={`${i}-${ch}`}>
          <span className="rl-stack" style={{ '--i': i, '--step': `${step}ms` }}>
            <span className="rl-char">{ch === ' ' ? '\u00A0' : ch}</span>
            <span className="rl-char" aria-hidden="true">
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}

function RouletteLink({ label, href, onClick, className = '', external = false, step }) {
  const cls = `${className} footer-roulette`
  const body = <RouletteLabel label={label} step={step} />
  if (external) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer" aria-label={label}>
        {body}
      </a>
    )
  }
  return (
    <a className={cls} href={href} onClick={onClick} aria-label={label}>
      {body}
    </a>
  )
}

export default function Footer() {
  const mediaRef = useRef(null)
  const artRef = useRef(null)
  const legalRef = useRef(null)
  const sceneRef = useRef(null)
  const bandRef = useRef(null)
  const creditsRef = useRef(null)
  const runwayRef = useRef(null)
  const bannerRef = useRef(null)
  // Quanta corsa copre la scala (80vh, decisa allo sblocco).
  const scaleTravelRef = useRef(0)
  const chipRef = useRef(null)
  const chipFillRef = useRef(null)
  const [glDead, setGlDead] = useState(false)
  const isMobile = useIsMobile()

  // Water audio follows the cursor over the single canvas, same hook as the
  // hero (desktop pointermove inside the rect, touch via dragged cursor).
  useHeroWaterSound(mediaRef)

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Entrata a strati (banda, immagine, credits) e poi espansione + scala,
  // tutte derivate dalla posizione del media: nessuno stato da sincronizzare.
  useFooterChoreography({
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
    reducedMotion: reduceMotion,
  })

  // No WebGL on reduced-motion (static dither instead). On failure the stack
  // reports unavailable and we fall back to the same static.
  const showGl = !reduceMotion && !glDead

  // Nuova coppia day/night (2752x1536, 16:9): mobile = crop verticale 800x1100
  // (stesse righe alte, pixel 1:1, generato via PIL).
  // Il night deve seguire la STESSA soglia del <source> del day (767px):
  // `useIsMobile` usa 720, e fra 721 e 767 il day sarebbe il ritaglio
  // verticale mentre il night resterebbe il frame 16:9 — disallineati.
  const isNarrow =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px)').matches
  const nightSrc = isNarrow
    ? '/assets/images/footer/footerNew-night-mobile.png'
    : '/assets/images/footer/footerNew-night.png'

  // Scroll alle sezioni: Lenis se c'è, altrimenti il browser.
  const jump = (e, href) => {
    const target = document.querySelector(href)
    if (!target) return
    e.preventDefault()
    const head = document.querySelector('.site-header')
    const offset = -((head?.offsetHeight || 0) + 12)
    const lenis = window.__lenis
    if (lenis && typeof lenis.scrollTo === 'function') lenis.scrollTo(target, { offset })
    else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof window.DottedGrid !== 'function') return
    const canvas = document.getElementById('dotted-grid-bg')
    // Il canvas è nascosto (display:none): non avviare un loop rAF che non disegna.
    if (!canvas || canvas.offsetParent === null) return
    const instance = new window.DottedGrid()
    return () => instance.destroy()
  }, [])

  // Magnete + espansione. Un solo media (base giorno + notte WebGL): fase 1
  // banda bassa cropata, ancorata in alto; durante il lock lo scrollY resta
  // congelato (la cima resta ferma, sotto non si vede niente).
  // All'arrivo completo: lock SILENZIOSO (chip spenta, somma a zero).
  // Spingendo (soglia 2000 ≈ due scroll quasi completi) appare la chip e la
  // barra sale; mollando, dopo 250ms senza tocchi la somma SCENDE da sola:
  // se si azzera, la chip si nasconde senza aprire (lock resta, si può
  // rispingere). A soglia il media adotta il riquadro aperto SENZA muovere
  // niente (cresce in basso, dietro la targa) e da lì è lo scroll a scoprire
  // l'immagine, 1:1 col gesto: nessuno scatto. La targa credits resta al
  // fondo per tutta la sequenza e torna a viaggiare con la banda quando si
  // risale. Lo sblocco vale finché resti nella sezione: tornando sopra la
  // posizione di banda il footer rientra in fase 1 e il lock si riarma.
  const WHEEL_NEED = 2000
  const TOUCH_MULT = 2.4
  const KEY_STEP = 280
  // Dopo IDLE_MS senza tocchi la somma scende da sola (smooth). Su touch
  // i flick hanno pause lunghe: grace estesa, altrimenti il drain mangia
  // tutto tra un trascinamento e l'altro e il canvas non si apre mai.
  const isCoarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const IDLE_MS = isCoarse ? 800 : 250
  // Scarico: piena→zero in ~1.7s di release.
  const DRAIN_RATE = 1200

  useEffect(() => {
    const media = mediaRef.current
    const art = artRef.current
    const legal = legalRef.current
    const chip = chipRef.current
    const fill = chipFillRef.current
    if (!media || !art || !legal) return

    const canLock =
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const small = () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches

    // Riquadro aperto: l'immagine contenuta nello spazio fra header e targa.
    // Non più a filo del viewport, altrimenti la cima va sotto l'header e il
    // fondo sotto i credits.
    const openBox = () => {
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900
      const header = document.querySelector('.site-header')
      const legalEl = legalRef?.current
      return containBox({
        fileW: small() ? 800 : 2752,
        fileH: small() ? 1100 : 1536,
        freeW: typeof window !== 'undefined' ? window.innerWidth : 1440,
        freeH: Math.max(
          1,
          vh -
            (header ? header.getBoundingClientRect().height : 0) -
            (legalEl ? legalEl.getBoundingClientRect().height : 0),
        ),
      })
    }
    const applyOpenBox = () => {
      const box = openBox()
      media.style.width = `${box.w}px`
      media.style.marginInline = 'auto'
      media.style.height = `${box.h}px`
      return box.h
    }
    const fullForWidth = () => openBox().h

    // Altezza della banda dalla custom property CSS (380 / 300 / 240 secondo
    // il breakpoint). Non si legge dal rect: allo sblocco il media ha
    // un'altezza inline e la banda non c'è più.
    const readBandH = () => {
      try {
        const v = Number.parseFloat(
          getComputedStyle(media).getPropertyValue('--band-h'),
        )
        if (Number.isFinite(v) && v > 0) return v
      } catch {}
      return media.clientHeight || 0
    }
    let bandH = readBandH()

    let raf = 0
    let queued = false
    let locked = false
    // Sblocco attivo finché resti nella sezione (niente re-lock mentre la
    // guardi); tornando su tutto rientra in fase 1 da solo.
    let unlocked = false
    let acc = 0
    let full = 0
    let lastInput = 0
    let lastTick = 0
    let idleRaf = 0
    let prevBottom = -Infinity
    let prevY = typeof window !== 'undefined' ? window.scrollY : 0
    let lastTouchY = null

    const lenis = () => (typeof window !== 'undefined' ? window.__lenis : null)

    // Lo sblocco e il riavvolgimento cambiano l'altezza del media senza
    // muovere lo scroll: nessun evento nativo ripartirebbe, e l'hook
    // resterebbe un frame indietro (targa sul fondo del media invece che sul
    // fondo del viewport). Questo è il segnale esplicito.
    const reflow = () => {
      try {
        window.dispatchEvent(new Event('footer:reflow'))
      } catch {}
    }

    // Il fondo del media si incolla al BORDO SUPERIORE della barra credits,
    // non al fondo del viewport: la targa è fissa lì e altrimenti mangia gli
    // ultimi pixel di immagine in ogni fase.
    const bottomTarget = () => {
      const legalEl = legalRef?.current
      const legalH = legalEl ? legalEl.getBoundingClientRect().height : 0
      return window.innerHeight - legalH
    }
    // Posizione della cima del media con la banda appoggiata alla targa.
    const lockTop = () => bottomTarget() - bandH
    const pinBottom = () => {
      try {
        const delta = media.getBoundingClientRect().bottom - bottomTarget()
        if (Math.abs(delta) > 0.5) window.scrollTo(0, window.scrollY + delta)
      } catch {}
    }

    // La chip è visibile solo mentre la somma è sopra zero (si spinge o si è
    // appena spinto); la barra è la somma che sale coi tocchi e scende in
    // release.
    const paintProgress = () => {
      const show = locked && acc > 0
      if (chip) chip.style.opacity = show ? '1' : '0'
      if (fill) fill.style.transform = `scaleX(${Math.min(1, acc / WHEEL_NEED).toFixed(3)})`
    }

    const stopIdle = () => {
      if (idleRaf) cancelAnimationFrame(idleRaf)
      idleRaf = 0
    }

    // Timer di release: dopo IDLE_MS senza tocchi la somma scende smooth;
    // a zero la chip si nasconde (lock resta: si può rispingere).
    const idleTick = (now) => {
      idleRaf = 0
      if (!locked) return
      const dt = lastTick ? now - lastTick : 0
      lastTick = now
      if (dt > 0 && acc > 0 && now - lastInput >= IDLE_MS) {
        acc = Math.max(0, acc - (DRAIN_RATE * Math.min(dt, 100)) / 1000)
        paintProgress()
      }
      idleRaf = requestAnimationFrame(idleTick)
    }

    const startIdle = () => {
      stopIdle()
      lastTick = 0
      lastInput = performance.now()
      idleRaf = requestAnimationFrame(idleTick)
    }

    const releaseBlockers = () => {
      stopIdle()
      window.removeEventListener('wheel', onWheel, { passive: false })
      window.removeEventListener('touchmove', onTouchMove, { passive: false })
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
    }

    // Sblocco. Il riquadro aperto si adotta QUI, ma non si muove niente:
    // il media cresce in basso (fuori dal viewport e dietro la targa) e
    // l'arte viene compensata, quindi la banda resta identica al pixel. Da
    // questo istante è lo scroll a scoprire l'immagine, 1:1 col gesto:
    // nessun `scrollTo`, che era l'altra metà dello scatto.
    const finishOpen = () => {
      full = applyOpenBox()
      locked = false
      unlocked = true
      acc = 0
      releaseBlockers()
      const l = lenis()
      if (l && typeof l.start === 'function') {
        try {
          l.start()
        } catch {}
      }
      if (chip) chip.style.opacity = '0'

      scaleTravelRef.current = Math.round(window.innerHeight * 0.8)
      reflow()

      requestAnimationFrame(() => {
        // Corsa: da qui alla fine pagina servono l'espansione (quanto è
        // cresciuto il riquadro) più la corsa della scala. Se manca scroll,
        // allungo il runway; se ne avanza, lo accorcio. Senza, la scala non
        // arriverebbe mai al target.
        const rw = runwayRef.current
        if (!rw) return
        const want = Math.round(full - bandH) + scaleTravelRef.current
        const have =
          document.documentElement.scrollHeight - window.innerHeight - window.scrollY
        const gap = want - have
        if (Math.abs(gap) > 1) {
          rw.style.height = `${Math.round(
            rw.getBoundingClientRect().height + gap,
          )}px`
        }
        // Il documento è cambiato di altezza: Lenis ha un `limit` misurato e
        // senza questo lo scroll si fermerebbe prima del fondo.
        resizeLenis()
      })
    }

    const cancel = () => {
      if (!locked) return
      locked = false
      // Niente è cresciuto (lock silenzioso): si esce e basta. Il magnete
      // può riattivarsi in discesa; il reset in fase 1 scatta fuori sezione.
      releaseBlockers()
      const l = lenis()
      if (l && typeof l.start === 'function') {
        try {
          l.start()
        } catch {}
      }
      if (chip) chip.style.opacity = '0'
    }

    const engage = () => {
      locked = true
      acc = 0
      lastTouchY = null
      full = fullForWidth()
      const l = lenis()
      if (l && typeof l.stop === 'function') {
        try {
          l.stop()
        } catch {}
      }
      window.addEventListener('wheel', onWheel, { passive: false })
      window.addEventListener('touchmove', onTouchMove, { passive: false })
      window.addEventListener('touchend', onTouchEnd)
      window.addEventListener('keydown', onKeyDown)
      pinBottom()
      paintProgress()
      startIdle()
      try {
        art.style.clipPath = ''
      } catch {}
    }

    function onWheel(e) {
      if (!locked) return
      e.preventDefault()
      const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      if (d < -8) {
        cancel()
        return
      }
      if (d <= 0) return
      acc += d
      lastInput = performance.now()
      if (acc >= WHEEL_NEED) finishOpen()
      else paintProgress()
    }

    function onTouchMove(e) {
      if (!locked) return
      e.preventDefault()
      const t = e.touches && e.touches[0]
      if (!t) return
      if (lastTouchY === null) {
        lastTouchY = t.clientY
        return
      }
      const d = lastTouchY - t.clientY
      lastTouchY = t.clientY
      if (d < -10) {
        cancel()
        return
      }
      if (d <= 0) return
      acc += d * TOUCH_MULT
      lastInput = performance.now()
      if (acc >= WHEEL_NEED) finishOpen()
      else paintProgress()
    }

    function onTouchEnd() {
      lastTouchY = null
    }

    function onKeyDown(e) {
      if (!locked) return
      if (e.key === 'Tab') return
      const down = ['ArrowDown', 'ArrowRight', 'PageDown', 'End', ' ']
      const up = ['ArrowUp', 'ArrowLeft', 'PageUp', 'Home']
      if (up.includes(e.key)) {
        cancel()
        return
      }
      if (down.includes(e.key)) {
        e.preventDefault()
        acc += KEY_STEP
        lastInput = performance.now()
        if (acc >= WHEEL_NEED) finishOpen()
        else paintProgress()
      }
    }

    const update = () => {
      raf = 0
      queued = false
      let rm = media.getBoundingClientRect()

      // Riavvoglimento. Salendo, l'espansione si richiude da sola: la
      // geometria è derivata dalla posizione del media, non da uno stato.
      // Quando la cima torna in posizione di banda si rientra in fase 1 —
      // altezza CSS, larghezza piena, lock riarmato — e il cambio avviene
      // tutto sotto la targa, quindi non si vede.
      if (!locked && unlocked && rm.top > lockTop() + 1) {
        media.style.height = ''
        media.style.width = ''
        media.style.marginInline = ''
        unlocked = false
        acc = 0
        rm = media.getBoundingClientRect()
        reflow()
        resizeLenis()
      }

      if (!locked && !unlocked && canLock) {
        const mb = rm.bottom
        const y = window.scrollY
        const target = bottomTarget()
        // Attraversamento verso il basso della soglia "banda completa": il
        // frame prima il fondo banda era sotto la targa (prevBottom > target),
        // ora è sopra (mb <= target). All'arrivo da sotto non scatta.
        if (prevBottom > target && mb <= target && y >= prevY) engage()
      }
      prevBottom = rm.bottom
      prevY = window.scrollY
    }

    const schedule = () => {
      if (!queued) {
        queued = true
        raf = requestAnimationFrame(update)
      }
    }

    const onResize = () => {
      bandH = readBandH()
      if (unlocked) {
        // Il riquadro si ricalcola sulla nuova misura; la scala e il pin sono
        // derivati dalla geometria, quindi non c'è niente da riancorare.
        full = applyOpenBox()
      } else if (locked) {
        // Lock: target ricalcolato + fondo riancorato subito e dopo il reflow
        // (rotazione: il resize può arrivare prima che media query e layout si
        // assestino e la banda resta staccata dal fondo).
        full = fullForWidth()
        pinBottom()
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (locked) {
              full = fullForWidth()
              pinBottom()
            }
          }),
        )
      }
      schedule()
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize)
    const l0 = lenis()
    if (l0 && typeof l0.on === 'function') l0.on('scroll', schedule)
    schedule()

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
      releaseBlockers()
      const l = lenis()
      if (l && typeof l.start === 'function') {
        try {
          l.start()
        } catch {}
      }
      media.style.height = ''
      media.style.width = ''
      media.style.marginInline = ''
      art.style.clipPath = ''
      art.style.transform = ''
      if (chip) chip.style.opacity = '0'
    }
  }, [])

  return (
    <footer className="dotted-grid-footer">
      <div className="footer-canvas">
        <div className="dotted-grid-hint">
          <p>CLICK TO CHANGE SHAPE</p>
        </div>
        <canvas id="dotted-grid-bg" data-managed="footer" />
      </div>

      <div className="dotted-grid-meta" ref={sceneRef}>
        <div className="footer-panel">
          {/* La banda è una cornice: il contenuto scorre dentro il clip, così
              il parallasse d'ingresso non apre buchi e il nero resta fermo. */}
          <div className="footer-panel__clip">
            <div className="footer-panel__grid footer-drift" ref={bandRef}>
              {/* Desktop: [brand ··· nav] ··· contact me, due livelli di
                  space-between. Tablet/mobile: i wrapper diventano
                  display:contents e il grid originale resta invariato (vedi
                  media query in global.css). */}
              <div className="footer-main">
                <div className="footer-brand">
                  {/* L'anello 3D al posto del titolo: stesso testo e font
                      dell'hero, ruota piano da solo. Con `region` agganciata
                      alla banda nera riceve anche l'hover dell'hero (inclina
                      verso il cursore e accelera la texture), ma solo quando
                      il cursore si muove DENTRO la banda del footer. h2 tenuto
                      per screen reader/SEO. */}
                  <div className="footer-ring" aria-hidden="true">
                    <HeroTextRing
                      size={200}
                      region=".footer-panel"
                      regionBox
                      restPose="hero"
                      style={{
                        position: 'relative',
                        left: 'auto',
                        top: 'auto',
                        transform: 'none',
                        width: 'min(200px, 58vw)',
                      }}
                    />
                  </div>
                  <h2 className="footer-wordmark sr-only">SOMEBODYWANT3D</h2>
                </div>

                <nav className="footer-nav" aria-label="Footer">
                  <div className="footer-col footer-col--index">
                    <p className="footer-col-label">Index</p>
                    <span className="footer-rule" aria-hidden="true" />
                    <ul className="footer-list">
                      {INDEX_LINKS.map((l) => (
                        <li key={l.label}>
                          <RouletteLink
                            label={l.label}
                            href={l.href}
                            onClick={(e) => jump(e, l.href)}
                            className="footer-link"
                            step={16}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="footer-col footer-col--work">
                    <p className="footer-col-label">Selected work</p>
                    <span className="footer-rule" aria-hidden="true" />
                    <ul className="footer-list">
                      {WORK_LINKS.map((l) => (
                        <li key={l.label}>
                          <RouletteLink
                            label={l.label}
                            href={l.href}
                            onClick={(e) => jump(e, l.href)}
                            className="footer-link"
                            step={14}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="footer-col footer-col--elsewhere">
                    <p className="footer-col-label">Elsewhere</p>
                    <span className="footer-rule" aria-hidden="true" />
                    <ul className="footer-list footer-social">
                      {SOCIAL_LINKS.map((s) => (
                        <li key={s}>
                          {SOCIAL_URLS[s] ? (
                            <RouletteLink
                              label={s}
                              href={SOCIAL_URLS[s]}
                              external
                              className="footer-link"
                              step={16}
                            />
                          ) : (
                            <span className="footer-link footer-link--pending" aria-disabled="true">
                              {s}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </nav>
              </div>

              <div className="footer-contact">
                <p className="footer-note">Keep in touch, thx for your visit ❤️</p>
                <span className="footer-rule" aria-hidden="true" />
                <a className="footer-email footer-roulette" href={`mailto:${EMAIL}`} aria-label={EMAIL}>
                  <RouletteLabel label={EMAIL} step={10} />
                </a>
                <p className="footer-tagline" style={{ fontSize: '20px' }}>
                  <strong>Domenico Fusto</strong>
                </p>
                <p className="footer-tagline">
                  <em>UX/UI Designer &amp; Frontend Developer</em>
                </p>
                <p className="footer-meta">Calabria, Italy</p>
              </div>
            </div>
          </div>

          {/* Pezzo nero della giunta: vive nella banda, ancorato al basso, e
              scende di (altezza − 10px) così 10px coprono il bordo della banda
              e il resto si fonde sull'inizio dell'immagine. Deve stare fuori da
              `.footer-media` e fuori dal clip, che lo taglierebbero. */}
          <div className="footer-banner" ref={bannerRef} aria-hidden="true">
            <img
              src="/assets/images/footer/footer-banner.png"
              width="1440"
              height="131"
              alt=""
              decoding="async"
            />
          </div>
        </div>

        {/* Canvas unico (base giorno + notte WebGL): fase 1 banda bassa; allo
            sblocco il media passa al riquadro contenuto fra header e targa e
            lo scroll lo rimpicciolisce in un'unica animazione. */}
        <div className="footer-visual">
          <div className="footer-media" ref={mediaRef}>
            <div className="footer-art" ref={artRef}>
              <picture className="footer-daypic">
                <source media="(max-width: 767px)" srcSet="/assets/images/footer/footerNew-day-mobile.png" />
                <img
                  className="footer-day"
                  src="/assets/images/footer/footerNew-day.png"
                  width="2752"
                  height="1536"
                  alt=""
                  decoding="async"
                />
              </picture>
              {showGl && (
                <Suspense fallback={null}>
                  <FooterWater nightSrc={nightSrc} onUnavailable={() => setGlDead(true)} />
                </Suspense>
              )}
            </div>

          </div>

          {/* Targa credits: FUORI dal media, così resta larga quanto il
              visual anche quando il media si restringe alla misura contenuta
              allo sblocco (dentro perderebbe 24px per lato). La posizione
              verticale la guida il JS con una traslazione continua; senza JS
              (o con reduced motion) resta appoggiata al fondo, che qui
              coincide col fondo del media. */}
          <div className="footer-legal" ref={legalRef}>
            <div className="footer-credits__drift" ref={creditsRef}>
              <p>© 2026 by Domenico Fusto</p>
              <p>Made with ❤️</p>
              <RouletteLink
                label="Back to top ↑"
                href="#top"
                onClick={(e) => jump(e, '#top')}
                className="footer-top"
                step={14}
              />
            </div>
          </div>

          <div className="footer-chip" ref={chipRef} aria-hidden="true">
            <span className="footer-chip-label">continue to scroll</span>
            <span className="footer-chip-bar">
              <span ref={chipFillRef} />
            </span>
          </div>

          {/* La corsa: senza di lei dopo lo sblocco non resta scroll (misurato:
              0px) e la scala non avrebbe dove avvenire. */}
          <div className="footer-runway" ref={runwayRef} aria-hidden="true" />
        </div>
      </div>
    </footer>
  )
}
