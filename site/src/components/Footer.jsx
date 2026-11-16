import React, { useEffect, useRef } from 'react'

// TODO(domenico): incolla qui le URL reali dei profili social.
// Una voce con URL vuoto resta testo non cliccabile: niente link morti in fondo pagina.
const SOCIAL_URLS = {
  LinkedIn: 'https://www.linkedin.com/in/domenico-fusto-a74273189/',
  GitHub: 'https://github.com/Domenico0976',
  Instagram: 'https://www.instagram.com/xoxomenico/',
}

const EMAIL = 'domenicofusto55@gmail.com'

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

// ─── Roulette hover ──────────────────────────────────────────────────────────
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
  const bandRef = useRef(null)

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

  // La banda ditherata entra con lo scroll: si apre dall'alto verso il basso, così
  // il suo bordo superiore — la dissolvenza ditherata dal nero — resta attaccato
  // al pannello ink e la transizione non si vede.
  //
  // Guidato dalla geometria live (rAF + getBoundingClientRect), non da posizioni
  // cachate: dopo un resize i trigger con scrub restavano congelati perché le
  // start/end misurate prima del resize non venivano ricalcolate in tempo, e la
  // banda spariva tornando a desktop. Qui il progress è ricalcolato a ogni
  // frame da scroll/resize, quindi non esiste alcuno stato stantio.
  useEffect(() => {
    const band = bandRef.current
    if (!band) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let queued = false
    const update = () => {
      raf = 0
      queued = false
      const r = band.getBoundingClientRect()
      const vh = window.innerHeight
      // Ex-start 'top 92%' / ex-end 'bottom bottom-=40': progress 0 quando il
      // top della banda è al 92% del viewport, 1 quando il bottom è a vh-40.
      const startTop = vh * 0.92
      const endTop = vh - 40 - r.height
      const total = startTop - endTop
      const p = total > 0 ? (startTop - r.top) / total : 1
      const clamped = Math.min(1, Math.max(0, p))
      band.style.clipPath = `inset(0% 0% ${((1 - clamped) * 100).toFixed(2)}% 0%)`
    }
    const schedule = () => {
      if (!queued) {
        queued = true
        raf = requestAnimationFrame(update)
      }
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const lenis = window.__lenis
    if (lenis && typeof lenis.on === 'function') lenis.on('scroll', schedule)
    schedule()
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
      band.style.clipPath = ''
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

      <div className="dotted-grid-meta">
        <div className="footer-panel">
          {/* Desktop: [brand ··· nav] ··· contact me, due livelli di space-between.
              Tablet/mobile: i wrapper diventano display:contents e il grid
              originale resta invariato (vedi media query in global.css). */}
          <div className="footer-main">
            <div className="footer-brand">
              <h2 className="footer-wordmark">SOMEBODYWANT3D</h2>
              <p className="footer-tagline">UX/UI Designer &amp; Frontend Developer</p>
              <p className="footer-meta">Calabria, Italy</p>
            </div>

            <nav className="footer-nav" aria-label="Footer">
              <div className="footer-col footer-col--index">
                <p className="footer-col-label">Index</p>
                <span className="footer-rule" aria-hidden="true" />
                <ul className="footer-list">
                  {INDEX_LINKS.map((l) => (
                    <li key={l.label}>
                      <RouletteLink label={l.label} href={l.href} onClick={(e) => jump(e, l.href)} className="footer-link" step={16} />
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
                      <RouletteLink label={l.label} href={l.href} onClick={(e) => jump(e, l.href)} className="footer-link" step={14} />
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
                        <RouletteLink label={s} href={SOCIAL_URLS[s]} external className="footer-link" step={16} />
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
            <p className="footer-col-label">Contact me</p>
            <span className="footer-rule" aria-hidden="true" />
            <a className="footer-email footer-roulette" href={`mailto:${EMAIL}`} aria-label={EMAIL}>
              <RouletteLabel label={EMAIL} step={10} />
            </a>
            <p className="footer-note">New projects, collaborations, or an odd brief — say hi.</p>
          </div>
        </div>

        <div className="footer-band" ref={bandRef}>
          <picture className="footer-band-media">
            <source media="(max-width: 767px)" srcSet="/assets/images/footer/footer-hero-day-dither-mobile.png" />
            <img
              src="/assets/images/footer/footer-hero-day-dither.png"
              width="1440"
              height="380"
              alt=""
              decoding="async"
            />
          </picture>
        </div>

        <div className="footer-legal">
          <p>© 2026 by Domenico Fusto</p>
          <p>Made with ❤️</p>
          <RouletteLink label="Back to top ↑" href="#top" onClick={(e) => jump(e, '#top')} className="footer-top" step={14} />
        </div>
      </div>
    </footer>
  )
}
