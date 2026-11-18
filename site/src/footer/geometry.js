// Geometria del footer: tutta la matematica del movimento, senza DOM.
//
// Vive qui perché è la parte che sbaglia in silenzio: un contain calcolato
// male o un pin arrotondato storto non lancia errori, sposta l'immagine di
// qualche pixel e nessuno se ne accorge finché non è in produzione. Con i
// numeri in un modulo puro, ogni valore è verificabile senza browser.

const clamp01 = (t) => Math.min(1, Math.max(0, t))
// Arrotonda a due decimali e normalizza -0 a 0: `Object.is(-0, 0)` è falso,
// e una transform che scrive "-0px" è tanto inutile quanto confusa.
const round2 = (n) => {
  const r = Math.round(n * 100) / 100
  return r === 0 ? 0 : r
}

// Dimensione dell'immagine contenuta nello spazio libero, con un margine
// interno (inset) su entrambi gli assi. Mai zero: un viewport più basso
// dell'immagine degrada a 1px, non a un box invisibile.
export function containScale({ fileW, fileH, freeW, freeH, inset }) {
  const availW = Math.max(0, freeW) * inset
  const availH = Math.max(0, freeH) * inset
  const ratio = Math.min(availW / fileW, availH / fileH)
  return {
    w: Math.max(1, Math.round(fileW * ratio)),
    h: Math.max(1, Math.round(fileH * ratio)),
  }
}

// Lo spazio libero dell'immagine a scena contenuta: il viewport meno
// l'header e la barra credits. Mai negativo.
export function freeHeight({ vh, headerH, creditsH }) {
  return Math.max(0, vh - headerH - creditsH)
}

// Rapporto di scala fra la misura di apertura e il target contenuto.
// Tre decimali: è la precisione che GSAP scrive nella transform.
export function scaleFor({ openW, targetW }) {
  if (!openW) return 1
  return Math.round((targetW / openW) * 1000) / 1000
}

// Quanto scroll serve perché il fondo del media torni sul fondo del
// viewport. Positivo = scorrere in giù. È la formula che il lock usa per
// assestarsi, ed è quella che si è rotta due volte dopo una rotazione.
export function pinDelta({ mediaBottom, vh }) {
  return Math.round(mediaBottom - vh)
}

export function easeOutCubic(t) {
  const x = 1 - clamp01(t)
  return 1 - x * x * x
}

// Progressione dentro una finestra di p (0..1) che parte a `from` e dura
// `len`. Fuori dalla finestra si ferma agli estremi.
const windowProgress = (p, from, len) =>
  clamp01((clamp01(p) - from) / Math.max(0.0001, len))

// Posizione dei due strati dell'entrata, in px, e le loro opacità.
// Inverso: la banda entra da sopra (-), l'immagine da sotto (+).
export function entryTransforms({ p, amp, stagger, invert }) {
  const pb = easeOutCubic(windowProgress(p, 0, 0.55))
  const pi = easeOutCubic(windowProgress(p, stagger, 0.55))
  const imageDir = invert ? 1 : -1
  return {
    band: round2((1 - pb) * -amp),
    image: round2((1 - pi) * amp * 1.6 * imageDir),
    bandOpacity: round2(pb),
    imageOpacity: round2(pi),
  }
}

// I credits non aspettano la fine dell'ingresso della scena: entrano quando
// la TARGA arriva, cioè quando il bordo della banda supera il fondo del
// viewport. Prima di quel punto la targa è sotto il bordo e il testo sarebbe
// invisibile comunque. Corsa = due volte l'altezza della targa, così il
// sipario si chiude appena dopo il pin e resta chiuso per tutto lo scroll.
export function creditsReveal({ vh, bandBottom, creditsH }) {
  const h = Math.max(1, creditsH)
  const e = easeOutCubic(clamp01((vh - bandBottom) / (h * 2)))
  return {
    // Da sopra: il testo scende dentro la targa, non sale da sotto.
    y: round2(-(1 - e) * h * 2),
    opacity: round2(e),
    p: round2(e),
  }
}

// Avanzamento dell'espansione: 0 con il media ancora in posizione di banda
// (lock), 1 quando la sua cima arriva a quella di riposo. `restTop` è dove la
// scena aperta si appoggia: NON sempre l'header — quando l'immagine è limitata
// dalla larghezza (mobile) resta più in basso, appoggiata alla targa, e usare
// l'header come riferimento la farebbe salire di troppo staccandola dai
// credits. Derivato dalla geometria e non dallo scroll, così dopo un resize si
// ricalcola da sé.
export function expandProgress({ lockTop, restTop, mediaTop }) {
  const span = lockTop - restTop
  if (!(span > 0)) return 1
  return clamp01((lockTop - mediaTop) / span)
}

// Quanto traslare l'arte perché resti ferma mentre la corsa scorre: zero
// finché la cima del media è sotto la sua posizione di riposo, poi cresce
// 1:1 con lo scroll. Non arrotondato: un compenso intero su uno scroll
// frazionario oscilla di mezzo pixel a ogni frame, e su un'immagine
// ditherizzata si vede come tremolio. Questa traslazione serve solo al
// passaggio (la fase pinzata usa `position: fixed`, vedi l'hook).
export function pinOffset({ restTop, mediaTop }) {
  return Math.max(0, restTop - mediaTop)
}

// Traslazione della targa credits. Il suo bordo superiore resta incollato al
// bordo della banda (dove finisce l'immagine) finché quello è sotto il
// viewport; da lì in poi resta fermo al fondo. `naturalTop` è dove starebbe
// senza traslazione (`top: 0` del suo contenitore, cioè la cima del visual):
// NON il fondo, che include la corsa — variabile a runtime — e lascerebbe la
// targa qualche decina di pixel fuori posto.
export function creditsShift({ vh, creditsH, mediaTop, bandH, naturalTop }) {
  const target = Math.max(vh - creditsH, mediaTop + bandH)
  // Senza arrotondare: la targa deve stare esattamente sul target. Un intero
  // su uno scroll frazionario la fa ballare di ±0.5px per frame, e il bordo
  // bianco sull'immagine lo mostra come una linea che tremola.
  return target - naturalTop
}

// Quanto è più larga la banda della scena contenuta: l'arte parte con questa
// scala (identica alla banda, al pixel) e si assesta a 1 a fine espansione.
// Sopra 1 solo quando è l'altezza a limitare il riquadro aperto (desktop).
export function coverScale({ bandW, openW }) {
  if (!bandW || !openW) return 1
  return Math.round((bandW / openW) * 10000) / 10000
}

// Avanzamento sulla corsa dedicata alla scala, dopo il reveal.
export function runwayProgress({ scrolled, runway }) {
  if (!runway || runway <= 0) return 1
  return clamp01(scrolled / runway)
}

// Altezza dell'immagine aperta: la larghezza piena, ma mai oltre lo spazio
// libero fra header e barra credits — altrimenti la targa le mangia il fondo
// e la cima finisce sotto l'header.
export function openHeight({ openW, fileW, fileH, vh, headerH, creditsH }) {
  const byWidth = openW * (fileH / fileW)
  return Math.max(1, Math.round(Math.min(byWidth, freeHeight({ vh, headerH, creditsH }))))
}

// Riquadro dell'immagine contenuta nello spazio libero: larghezza e altezza
// che ci stanno dentro senza ritagli. Serve alla fase aperta, che deve già
// stare sotto l'header e sopra i credits.
export function containBox({ fileW, fileH, freeW, freeH }) {
  return containScale({ fileW, fileH, freeW, freeH, inset: 1 })
}

// Quale asset e quale spazio libero, dato il viewport. Sotto i 768px il
// footer usa il ritaglio verticale (8/11); sopra, il frame intero 16:9.
export function layoutFor({ width, vh, headerH, creditsH }) {
  const mobile = width < 768
  return {
    fileW: mobile ? 800 : 2752,
    fileH: mobile ? 1100 : 1536,
    freeW: width,
    freeH: freeHeight({ vh, headerH, creditsH }),
  }
}
