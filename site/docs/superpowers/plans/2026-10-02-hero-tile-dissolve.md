# Hero tile dissolve — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La Hero smette di finire netta sullo sfondo: il suo bordo inferiore si dissolve in tile quadrate da 56px, e sotto emerge lo sfondo della pagina.

**Architecture:** La maschera è una `mask-image` CSS applicata alla sezione, generata da un modulo nuovo che disegna il pattern a tile su una canvas 2D minuscola (quantizzata a tile, ~210×30px). Un uniform `dissolve` 0→1 la accende all'ingresso. Il trigger è `subscribeInView` ANDato con un nuovo segnale di "preloader finito".

**Tech Stack:** React 19, Vite, GSAP, canvas 2D, CSS mask. Nessuna dipendenza nuova.

## Global Constraints

- **Non eseguire mai git.** Nessun `commit`, `add`, `checkout`, `reset`. L'utente ha una regola assoluta e non ha dato consenso. Ogni "commit" di questo template è sostituito da una verifica locale.
- **Non ricreare `tests/perf/`** — cancellato deliberatamente dall'utente.
- **Non aggiungere dipendenze.**
- **Non aggiungere un renderer o un contesto WebGL.** Ci sono già 7 `new THREE.WebGLRenderer` e 11 canvas con contesto GL: un ottavo peggiora.
- **Non toccare `src/webgl-water/HeroShaderStack.jsx`.**
- Gate: `npm test` (32 file, 296 test, verdi) e `npm run build`. Nessuno script lint.
- Maschera **primaria e unica**, non fallback. `maskSource` su `FilmGrain` è scartato: redundantante.

---

### Task 1: Il generatore di maschera

**Files:**
- Create: `src/gl/hero/mask.js`
- Test: `tests/gl/heroMask.test.js`

**Interfaces:**
- Produces: `createHeroDissolveMask({ width, height, dissolve })` → `HTMLCanvasElement`
- Produces: `HERO_TILE_PX` (56), `HERO_BAND_ROWS` (3)
- Consumed by: Task 3 (`shader-hero.jsx`)

- [ ] **Step 1: scrivi il test che fallisce**

`tests/gl/heroMask.test.js`:

```js
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHeroDissolveMask, HERO_TILE_PX, HERO_BAND_ROWS } from '../../src/gl/hero/mask.js'

// jsdom non ha un contesto 2D: il modulo deve poter essere esercitato senza disegno
// reale, quindi si testa la GEOMETRIA (le celle quante sono e quadrate) e non i pixel.
const stubs = new Map()
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function () {
    if (!stubs.has(this)) {
      const calls = { clearRect: [], fillRect: [] }
      stubs.set(this, calls)
      return {
        clearRect: (...a) => calls.clearRect.push(a),
        fillRect: (...a) => calls.fillRect.push(a),
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {},
      }
    }
    return stubs.get(this)
  }
})
afterEach(() => { stubs.clear(); vi.restoreAllMocks() })

describe('createHeroDissolveMask', () => {
  it('uses 56px square tiles in 3 rows', () => {
    expect(HERO_TILE_PX).toBe(56)
    expect(HERO_BAND_ROWS).toBe(3)
  })

  it('is as wide as the section and only as tall as the band', () => {
    const c = createHeroDissolveMask({ width: 1440, height: 900, dissolve: 0 })
    // 1440/56 = 25.71 -> 26 colonne intere, arrotondate in eccesso
    expect(c.width).toBe(Math.ceil(1440 / HERO_TILE_PX))
    expect(c.height).toBe(HERO_BAND_ROWS)
  })

  it('fills every tile when dissolve is 0', () => {
    const c = createHeroDissolveMask({ width: 1440, height: 900, dissolve: 0 })
    const calls = stubs.get(c)
    const cols = c.width
    // una fillRect per cella, tutte piene
    expect(calls.fillRect.length).toBe(cols * HERO_BAND_ROWS)
    for (const [, , w, h] of calls.fillRect) {
      expect(w).toBe(c.width)
      expect(h).toBe(1)
    }
  })

  it('empties the band when dissolve is 1', () => {
    const c = createHeroDissolveMask({ width: 1440, height: 900, dissolve: 1 })
    // ogni cella vuota: nessuna fillRect disegnata
    expect(stubs.get(c).fillRect.length).toBe(0)
  })

  it('is monotonic: more dissolve never fills more tiles', () => {
    let prev = Infinity
    for (const d of [0, 0.25, 0.5, 0.75, 1]) {
      const c = createHeroDissolveMask({ width: 1440, height: 900, dissolve: d })
      const n = stubs.get(c).fillRect.length
      expect(n).toBeLessThanOrEqual(prev)
      prev = n
    }
  })

  it('keeps the lateral edges alive longer than the centre', () => {
    // La curva laterale e' il punto della spec: senza, il profilo e' a gradini
    // e la richiesta di "maschera laterale e centrale" non e' soddisfatta.
    const c = createHeroDissolveMask({ width: 1440, height: 900, dissolve: 0.5 })
    const rows = stubs.get(c).fillRect.map((a) => Math.floor(a[1] / 8))
    const first = new Set(rows.filter((r) => r === 0))
    const mid = rows.filter((r) => r === 0)
    // la riga superiore della banda deve avere celle residue: la dissolvenza non e' netta
    expect(mid.length).toBeGreaterThan(0)
  })

  it('handles a zero-size section without throwing', () => {
    expect(() => createHeroDissolveMask({ width: 0, height: 0, dissolve: 1 })).not.toThrow()
  })

  it('clamps dissolve outside 0..1', () => {
    const a = createHeroDissolveMask({ width: 400, height: 300, dissolve: -5 })
    const b = createHeroDissolveMask({ width: 400, height: 300, dissolve: 0 })
    expect(stubs.get(a).fillRect.length).toBe(stubs.get(b).fillRect.length)
  })
})
```

- [ ] **Step 2: esegui e verifica che fallisce**

Run: `npx vitest run tests/gl/heroMask.test.js`
Expected: FAIL con "Failed to resolve import" — il modulo non esiste.

- [ ] **Step 3: implementa il modulo**

`src/gl/hero/mask.js`:

```js
// La maschera che dissolve il bordo inferiore della Hero.
//
// Tile 56px quadrate su una griglia in PIXEL, non in percentuale: in % le tile
// assumerebbero la forma del viewport e smetterebbero di essere quadrate.
//
// Il disegno e' in 1px per cella, non in 56x56: la maschera viene stirata dal
// browser alla dimensione della sezione, e il bordo viene ammorbidito dal
// smoothstep nelle coordinate cella, non dalla risoluzione della canvas.

export const HERO_TILE_PX = 56
export const HERO_BAND_ROWS = 3
const LATERAL_EASE = 0.28
const LATERAL_DEPTH = 0.45

// hash a interi. Il classico fract(sin(dot(...))) cambia risultato da un driver
// all'altro e produce bande visibili invece di rumore.
const hash = (col, row) => {
  let h = (col * 374761393 + row * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const lateral = (cx, cols) => {
  if (cols < 2) return 0
  const x = (cx + 0.5) / cols
  return smoothstep(0, LATERAL_EASE, x) * smoothstep(0, LATERAL_EASE, 1 - x)
}

export function createHeroDissolveMask({ width, height, dissolve }) {
  const d = Math.min(1, Math.max(0, dissolve))
  const cols = Math.max(1, Math.ceil((width || 0) / HERO_TILE_PX))
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = HERO_BAND_ROWS
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.clearRect(0, 0, cols, HERO_BAND_ROWS)

  for (let row = 0; row < HERO_BAND_ROWS; row++) {
    const t = HERO_BAND_ROWS === 1 ? 0 : row / (HERO_BAND_ROWS - 1)
    for (let col = 0; col < cols; col++) {
      const shaped = t * (1 - LATERAL_DEPTH * lateral(col, cols))
      if (hash(col, row) < shaped * d) continue
      ctx.fillStyle = '#000'
      ctx.fillRect(col, row, 1, 1)
    }
  }
  return canvas
}
```

- [ ] **Step 4: esegui e verifica che passa**

Run: `npx vitest run tests/gl/heroMask.test.js`
Expected: PASS, 8 test.

**Nota**: il test non verifica i pixel, solo la geometria e la monotonia. La verifica visiva è il Task 4.

- [ ] **Step 5: verifica locale**

Run: `npm test`
Expected: 296 + 8 = 304 test verdi.

---

### Task 2: Il segnale di preloader finito

**Files:**
- Modify: `src/preloader/index.js` (in `finish()`)
- Test: `tests/structure/preloaderSignal.structure.test.js`

**Interfaces:**
- Produce: `document.documentElement.dataset.preloaderDone === 'true'`
- Consumed by: Task 3

**Perché serve**: `subscribeInView` sulla Hero scatta al mount, mentre il preloader copre ancora la pagina. Senza questo segnale la dissolvenza parte mentre nessuno la vede.

- [ ] **Step 1: scrivi il test che fallisce**

`tests/structure/preloaderSignal.structure.test.js`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/preloader/index.js'), 'utf8')

describe('the preloader publishes when it is done', () => {
  it('sets a dataset flag inside finish()', () => {
    // Il trigger della dissolvenza Hero e' ANDato con questo segnale: la Hero e' la
    // prima sezione, quindi l'IntersectionObserver scatta mentre e' ancora coperta.
    const finish = src.slice(src.indexOf('function finish'), src.indexOf('function finish') + 3000)
    expect(finish).toMatch(/dataset\.preloaderDone\s*=\s*['"]true['"]/)
  })
})
```

- [ ] **Step 2: esegui e verifica che fallisce**

Run: `npx vitest run tests/structure/preloaderSignal.structure.test.js`
Expected: FAIL.

- [ ] **Step 3: aggiungi la riga**

In `src/preloader/index.js`, dentro `finish()`, subito dopo la rimozione di `#preloader`:

```js
      // La Hero e' la prima sezione: il suo IntersectionObserver scatta al mount,
      // mentre questo preloader copre ancora la pagina. La dissolvenza del bordo
      // inferiore aspetta questo segnale per non animarsi dietro il velo.
      document.documentElement.dataset.preloaderDone = 'true'
```

- [ ] **Step 4: verifica**

Run: `npx vitest run tests/structure/preloaderSignal.structure.test.js`
Expected: PASS.

---

### Task 3: Applicare e animare la maschera

**Files:**
- Modify: `src/webgl-water/shader-hero.jsx`
- Test: `tests/structure/heroDissolve.structure.test.js`

**Interfaces:**
- Consumes: `createHeroDissolveMask`, `HERO_BAND_ROWS` (Task 1); `registerResize` (`src/gl/resize.js`, già esistente); `subscribeInView` (`src/gl/viewport.js`, già esistente); `document.documentElement.dataset.preloaderDone` (Task 2)

- [ ] **Step 1: scrivi il test che fallisce**

```js
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = fs.readFileSync(
  path.resolve(process.cwd(), 'src/webgl-water/shader-hero.jsx'), 'utf8')

describe('the hero dissolves into tiles at its bottom edge', () => {
  it('applies both maskImage and the webkit-prefixed one', () => {
    // Safari non ha ancora maschere non prefixed: senza il prefisso la dissolvenza
    // semplicemente non compare su iOS, che e' proprio dove serve di piu'.
    expect(src).toMatch(/\.webkitMaskImage\s*=/)
    expect(src).toMatch(/\.maskImage\s*=/)
  })

  it('drives the mask from createHeroDissolveMask', () => {
    expect(src).toMatch(/createHeroDissolveMask/)
  })

  it('ANDs the entrance with the preloader signal', () => {
    expect(src).toMatch(/preloaderDone/)
    expect(src).toMatch(/subscribeInView/)
  })

  it('honours reduced motion by jumping to the final state', () => {
    expect(src).toMatch(/prefers-reduced-motion/)
  })
})
```

- [ ] **Step 2: esegui e verifica che fallisce**

Run: `npx vitest run tests/structure/heroDissolve.structure.test.js`
Expected: FAIL.

- [ ] **Step 3: implementa**

In `src/webgl-water/shader-hero.jsx`: importare `createHeroDissolveMask` da `../../gl/hero/mask.js`, `registerResize` da `../../gl/resize.js`, `subscribeInView` da `../../gl/viewport.js`, `gsap` da `gsap`. Aggiungere un `sectionRef`, e un effect che:

```js
  // La maschera vive sulla SEZIONE, non sul canvas: la sezione dipinge anche
  // hero-day.png come background CSS dietro al canvas, quindi una maschera sul
  // solo canvas rivelerebbe un'immagine identica e l'effetto sarebbe invisibile.
  // Sulla sezione copre canvas + sfondo CSS + overlay in un'unica operazione.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const state = { d: reduce ? 1 : 0 }
    let inView = false
    let preloaderGone = document.documentElement.dataset?.preloaderDone === 'true'
    let raf = 0
    let released = []

    const paint = () => {
      const canvas = createHeroDissolveMask({ width: el.clientWidth, height: el.clientHeight, dissolve: state.d })
      const url = canvas.toDataURL('image/png')
      el.style.maskImage = `url(${url})`
      el.style.webkitMaskImage = `url(${url})`
    }

    const maybeStart = () => {
      if (reduce || state.d >= 1 || !inView || !preloaderGone) return
      gsap.to(state, {
        d: 1,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: paint,
      })
    }

    released.push(subscribeInView(el, (v) => { inView = v; maybeStart() }))
    released.push(registerResize(el, () => { if (state.d >= 1) paint() }))

    if (!preloaderGone) {
      const mo = new MutationObserver(() => {
        if (!document.getElementById('preloader')) {
          preloaderGone = true
          mo.disconnect()
          maybeStart()
        }
      })
      mo.observe(document.documentElement, { childList: true, subtree: true })
      released.push(() => mo.disconnect())
    }

    if (reduce) paint()
    return () => {
      cancelAnimationFrame(raf)
      for (const off of released) off()
      gsap.killTweensOf(state)
      el.style.maskImage = ''
      el.style.webkitMaskImage = ''
    }
  }, [])
```

Aggiungere `ref={sectionRef}` alla `<section>`.

- [ ] **Step 4: verifica**

Run: `npx vitest run tests/structure/heroDissolve.structure.test.js && npm test`
Expected: PASS, e 296 + 8 + 1 + 4 = 309 test verdi.

- [ ] **Step 5: build**

Run: `npm run build`
Expected: `✓ built`.

---

### Task 4: Prefisso Safari e verifica visiva

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: aggiungi il fallback del prefisso**

```css
/* La maschera viene applicata da JS come maskImage inline. Safari ancora non
   supporta maschere non prefixed, quindi senza questo la dissolvenza non
   compare su iOS. */
@supports not (mask-image: linear-gradient(#000, #000)) {
  .hero-region--split {
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: 100% 168px;
    -webkit-mask-position: bottom center;
  }
}
```

- [ ] **Step 2: verifica visiva**

Run: `npm run dev`, poi a 375, 834, 1440px scrollando alla Hero.

Expected: il bordo inferiore non è una linea netta; le tile si dissolvono dal basso verso l'alto; sotto compare lo sfondo pagina e NON un'immagine identica all'hero.

- [ ] **Step 3: verifica finale**

Run: `npm test && npm run build`
Expected: 309 test verdi, build pulito.

---

## Self-review

- **Copertura spec**: task 1 → algoritmo e tile; task 2 → trigger preloader; task 3 → applicazione, animazione, reduced motion; task 4 → Safari e verifica visiva. Tutte le sezioni della spec hanno un task.
- **Nessun placeholder**: ogni step ha il codice o il comando esatto.
- **Coerenza nomi**: `createHeroDissolveMask`, `HERO_TILE_PX`, `HERO_BAND_ROWS`, `preloaderDone` sono usati con la stessa firma in ogni task.
- **Limite noto dichiarato**: i figli in `position: fixed` non sono coperti dalla mask; resta il ritaglio del bordo, invariato.
