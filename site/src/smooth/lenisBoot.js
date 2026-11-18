import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Lenis a livello di modulo, fuori da React.
//
// Era dentro un `useEffect` di App: con StrictMode quell'effetto gira due volte
// (crea, distrugge, ricrea) e nel mezzo `window.__lenis` resta null per un
// frame — ed è esattamente quello che leggono il lock del footer, la scrollbar,
// il preloader e SelectedProjects. In pratica Lenis finiva per non essere
// attivo affatto: scroll nativo, `lenis.stop()` no-op, e ogni animazione
// scroll-driven un frame in ritardo. Un singleton creato prima del mount non ha
// quel buco.
let instance = null
let rafId = 0

// --- Taratura dello scroll -------------------------------------------------
//
// `duration` sceglie il percorso temporale di Lenis (non `lerp`) e senza
// `easing` esplicito usa il suo expo-out: la corsa decelera fino a fermarsi,
// invece di inseguire il target a percentuale fissa per frame. 1.35s è lungo
// di proposito: è quello che rende il gesto "di velluto" invece che elastico.
const SCROLL_DURATION = 1.1
// Quanta strada fa ogni tacca di rotella (1 = come il browser). Sotto 1 la
// stessa spinta muove meno: è la "forza" limitata che si chiedeva.
const WHEEL_MULTIPLIER = 1.0
// Il touch resta nativo (`syncTouch: false`): intercettarlo toglierebbe
// l'inerzia del sistema e litigherebbe col lock a trascinamento del footer.
const TOUCH_MULTIPLIER = 1

export function bootLenis() {
  if (typeof window === 'undefined') return null
  if (instance) return instance

  gsap.registerPlugin(ScrollTrigger)

  // Lenis rispetta la preferenza solo nei `scrollTo` programmatici
  // (`prefersReducedMotion` → immediate): la rotella resterebbe smussata per
  // 1.35s anche a moto ridotto. Con `smoothWheel: false` lo scroll torna
  // nativo, che è ciò che la preferenza chiede.
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const lenis = new Lenis({
    duration: SCROLL_DURATION,
    wheelMultiplier: WHEEL_MULTIPLIER,
    touchMultiplier: TOUCH_MULTIPLIER,
    smoothWheel: !reduceMotion,
    syncTouch: false,
    // Lenis misura da sé il contenuto (ResizeObserver): il footer che si apre
    // non richiede una chiamata, ma `resizeLenis()` resta per i casi in cui la
    // misura arriva prima del reflow.
    autoResize: true,
    // Il loop lo guidiamo noi qui sotto: due rAF sullo stesso motore
    // raddoppierebbero l'avanzamento.
    autoRaf: false,
    // I link interni li gestisce `jump()` nel footer, con l'offset dell'header.
    anchors: false,
  })
  instance = lenis
  window.__lenis = lenis

  // ScrollTrigger deve leggere la posizione da Lenis: senza questo le
  // animazioni scroll-driven restano ancorate allo scroll nativo e partono un
  // frame indietro.
  lenis.on('scroll', ScrollTrigger.update)

  // Un solo loop, quello di Lenis: `raf` deve girare ogni frame o lo scroll
  // non si muove affatto.
  const loop = (time) => {
    lenis.raf(time)
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  // Le misure dei trigger cambiano quando arrivano i font e quando il layout
  // si assesta (mobile <-> desktop). Un refresh coalesced per frame.
  let scheduled = false
  const refresh = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      ScrollTrigger.refresh()
    })
  }
  if (document.fonts?.ready) document.fonts.ready.then(refresh).catch(refresh)
  window.addEventListener('load', refresh)
  setTimeout(refresh, 400)

  return lenis
}

export function getLenis() {
  return instance
}

// Da chiamare quando il contenuto cambia altezza fuori dal flusso normale
// (il footer che si apre o si richiude): Lenis tiene un `limit` misurato, e
// senza questo lo scroll si ferma prima o lascia coda vuota.
export function resizeLenis() {
  if (!instance) return
  try {
    instance.resize()
  } catch {}
}
