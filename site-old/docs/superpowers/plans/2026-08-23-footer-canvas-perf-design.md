# Footer Canvas Perf & Sharper Hover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare lag/jank del canvas dot-grid del footer (`#dotted-grid-bg`) e rendere l'effetto hover un collasso netto e visibile dei dot sotto il cursore.

**Architecture:** Tutte le modifiche restano nel singolo modulo IIFE `js/dottedGrid.js` (vanilla Canvas2D, nessuna dipendenza). Sei interventi indipendenti committati in sequenza: tuning hover (config centralizzata), cache rect, entrata graduale, culling forme, draw batched via Path2D buckets, igiene listener.

**Tech Stack:** JavaScript ES2020 vanilla, Canvas 2D API, IntersectionObserver, Pointer Events. Nessun build system: aprire `index.html` nel browser (script non-module ⇒ funziona anche da `file://`).

**Spec:** `docs/superpowers/specs/2026-08-23-footer-canvas-perf-design.md` (committata in `03b8b2e`).

## Global Constraints

- File toccato: **solo** `js/dottedGrid.js`.
- `dpr = 1` resta invariato (spec §4).
- Semantica `prefers-reduced-motion` invariata (ramo statico intoccato).
- Option pubbliche valide: `new DottedGrid({ mouseRadius: X })` deve ancora funzionare (override vince sul default).
- Nessuna dipendenza nuova, nessun test runner (repo statico ⇒ validazione manuale su browser, spec §8).
- Stile commit repo: messaggi brevi minuscoli.
- Ogni task termina con il repo funzionante e committato.

**Nota TDD:** nessuna infrastruttura di test esiste e la spec dichiara validazione manuale; introdurre un framework sarebbe fuori scope (spec §4). Ogni task usa quindi un ciclo **baseline → modifica → verifica osservabile** con valori attesi espliciti nel browser.

**Come verificare (vale per tutti i task):**
1. Apri `index.html` nel browser (doppio click o `start index.html`).
2. Scorri fino al footer ("CLICK TO CHANGE SHAPE").
3. DevTools (F12) → menu comandi (Ctrl+Shift+P) → "Show Frames per second (FPS) meter" per l'FPS; tab Performance per i long task.

---

### Task 1: Hover netto — blocco `HOVER` + influenza cursore riprogettata (spec R5, RC5)

**Files:**
- Modify: `js/dottedGrid.js:14` (DEFAULTS), `js/dottedGrid.js:11-21` (nuovo blocco costante), `js/dottedGrid.js:218` (constructor), `js/dottedGrid.js:393` (`_drawDot`), `js/dottedGrid.js:487-499` (blocco cursore), `js/dottedGrid.js:530` (shrink)

**Interfaces:**
- Consumes: helper esistenti `lerp`, `clamp01`, `smoothstep` (già nel file, righe 32-37).
- Produces: costante module-scope `HOVER = { radius, innerPlateau, attack, release, minScale, alphaFade }`. I task successivi riusano `HOVER.alphaFade` (Task 5). Il default del constructor ora deriva da `HOVER.radius`.

- [ ] **Step 1: Baseline soggettiva**

Apri la pagina, muovi lentamente il cursore sul footer. Annota: alone sfocato ampio (~380px), i dot svaniscono più che restringersi, reazione morbida/lenta. (Questo è lo stato "prima".)

- [ ] **Step 2: Inserire il blocco `HOVER` dopo la riga 8**

Subito sotto `const REDUCED_MOTION_QUERY = ...` e sopra `// ── Config`:

```js
  // ── Hover tuning ──────────────────────────────────────────────────
  // ponytail: all hover "feel" numbers in one place for easy tweaking
  const HOVER = {
    radius: 160,        // px — effect reach (was 380: too diluted)
    innerPlateau: 0.35, // fraction of radius with full collapse (crisp hole)
    attack: 0.38,       // lerp speed growing (~80% collapse in ~70ms @60fps)
    release: 0.15,      // lerp speed decaying (softer release reads natural)
    minScale: 0.15,     // residual radius factor under cursor center
    alphaFade: 0.30,    // alpha removed at full strength (was 0.5: too vanishing)
  };
```

- [ ] **Step 3: Unica fonte di verità per il raggio**

In `DEFAULTS` rimuovere la riga `mouseRadius: 380,`. Nel constructor sostituire:

```js
      this.mouseRadius = options.mouseRadius ?? DEFAULTS.mouseRadius;
```

con:

```js
      this.mouseRadius = options.mouseRadius ?? HOVER.radius;
```

- [ ] **Step 4: Alpha-fade governato da config**

In `_drawDot` sostituire:

```js
      const mouseFade = mouseStrength * mouseStrength * 0.5;
```

con:

```js
      const mouseFade = mouseStrength * mouseStrength * HOVER.alphaFade;
```

- [ ] **Step 5: Curza cursore: plateau piatto + bordo nitido, attacco/rilascio asimmetrici**

Sostituire l'intero blocco (oggi alle righe 487-499):

```js
        // Cursor head influence (distSq — no sqrt)
        let targetMouseStrength = 0;
        if (mouse.active) {
          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = this.mouseRadius * this.mouseRadius;
          if (distSq < mrSq) {
            const norm = Math.sqrt(distSq) / this.mouseRadius;
            targetMouseStrength = (1 - norm) ** 3;
          }
        }
        dot.currentMouseStrength = lerp(dot.currentMouseStrength, targetMouseStrength, 0.12);
```

con:

```js
        // Cursor head influence: flat collapse plateau + crisp smoothstep edge
        let targetMouseStrength = 0;
        if (mouse.active) {
          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = this.mouseRadius * this.mouseRadius;
          if (distSq < mrSq) {
            const inner = this.mouseRadius * HOVER.innerPlateau;
            targetMouseStrength =
              distSq <= inner * inner
                ? 1
                : 1 - smoothstep(inner, this.mouseRadius, Math.sqrt(distSq));
          }
        }
        const kMouse =
          targetMouseStrength > dot.currentMouseStrength
            ? HOVER.attack
            : HOVER.release;
        dot.currentMouseStrength = lerp(
          dot.currentMouseStrength,
          targetMouseStrength,
          kMouse
        );
```

- [ ] **Step 6: Profondità di collasso dal config**

Sostituire:

```js
        const mouseShrink = 1 - dot.currentMouseStrength * 0.75;
```

con:

```js
        const mouseShrink = 1 - dot.currentMouseStrength * (1 - HOVER.minScale);
```

(la riga `trailShrink` successiva resta invariata.)

- [ ] **Step 7: Verifica osservabile**

Ricarica la pagina. Atteso:
- Buco circolare **nitido** che segue il cursore, raggio d'azione ~160px (prima: alone ~380px).
- Dot sotto il cursore: pallina piccola ma visibile (~15% del raggio), non invisibile.
- Flick rapido dentro/fuori: reazione netta entro ~0.1s.
- Click cicla ancora le forme; la griglia fuori dal buco è identica a prima.

- [ ] **Step 8: Commit**

```bash
git add js/dottedGrid.js
git commit -m "sharpen footer canvas hover"
```

---

### Task 2: Cache del rect — niente layout-read per pointermove (spec R3, RC3)

**Files:**
- Modify: `js/dottedGrid.js:252` (constructor), `js/dottedGrid.js:287-294` (`_onScroll`), `js/dottedGrid.js:312-321` (`_resize`), `js/dottedGrid.js:343-356` (`_onPointerMove`)

**Interfaces:**
- Consumes: nulla di nuovo.
- Produces: campo interno `this._rect` (DOMRect cache) letto da `_onPointerMove`; metodo `_cacheRect()`.

- [ ] **Step 1: Campo nel constructor**

Dopo `this.hiddenTimer = null;` aggiungere:

```js
      this._rect = null; // cached getBoundingClientRect (layout-read cache)
```

- [ ] **Step 2: `_resize` aggiorna la cache**

In `_resize`, dopo `const rect = this.canvas.getBoundingClientRect();` la variabile locale esiste già — aggiungere il salvataggio in fondo al metodo, subito prima di `this._createDots();`:

```js
      this._rect = rect;
```

- [ ] **Step 3: Nuovo metodo `_cacheRect`**

Subito dopo `_resize`:

```js
    _cacheRect() {
      this._rect = this.canvas.getBoundingClientRect();
    }
```

- [ ] **Step 4: Scroll invalida la cache (il rect è viewport-relative)**

Nel body di `_onScroll`, come prima istruzione:

```js
        this._cacheRect();
```

- [ ] **Step 5: `_onPointerMove` legge solo la cache**

Sostituire:

```js
      const rect = this.canvas.getBoundingClientRect();
```

con:

```js
      const rect = this._rect || this.canvas.getBoundingClientRect();
```

(il fallback copre qualunque caso non ancora cachato.)

- [ ] **Step 6: Verifica osservabile**

1. Posizionati a metà pagina, scorri fino al footer, muovi il mouse: il buco appare **esattamente** sotto il cursore.
2. Ridimensiona la finestra e ri-hovera: posizione corretta.
3. DevTools → Performance, registra mentre hoveri: nessuna voce "Recalculate Style / Layout" associata agli eventi pointermove (prima ce n'era una per evento).

- [ ] **Step 7: Commit**

```bash
git add js/dottedGrid.js
git commit -m "cache footer canvas rect"
```

---

### Task 3: Entrata graduale — resume via rAF + render ambientale durante lo scroll (spec R4, RC4)

**Files:**
- Modify: `js/dottedGrid.js:285` (init campi scroll), `js/dottedGrid.js:296-306` (observer callback), `js/dottedGrid.js:420-430` (`_loop`), `js/dottedGrid.js:432+` (`_renderFrame` firma e guardie mouse/trail)

**Interfaces:**
- Consumes: struttura `mouse.trail` e blocchi influenza cursore/trail esistenti.
- Produces: `_renderFrame(ambient = false)` — i task successivi che toccano `_renderFrame` (Task 5) devono mantenere questo parametro.

- [ ] **Step 1: Contatore tick nel setup scroll**

In `_init`, accanto a `this._scrolling = false;` aggiungere:

```js
      this._scrollTick = 0;
```

- [ ] **Step 2: Resume fuori dal callback dell'observer**

Sostituire nel callback dell'IntersectionObserver:

```js
        if (this.isVisible && this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
          this._loop();
        }
```

con:

```js
        if (this.isVisible && this.hiddenTimer) {
          clearTimeout(this.hiddenTimer);
          this.hiddenTimer = null;
          // defer the heavy render out of the observer callback (no jank burst)
          requestAnimationFrame(() => this._loop());
        }
```

- [ ] **Step 3: Durante lo scroll: render ridotto invece di freeze**

Sostituire in `_loop`:

```js
      // ponytail: skip the heavy render while the user is actively scrolling;
      // canvas holds its last frame (shapes rotate too slowly to notice),
      // loop stays alive and resumes ~150ms after the scroll stops
      if (this._scrolling) {
        this.rafId = requestAnimationFrame(() => this._loop());
        return;
      }

      this._renderFrame();
```

con:

```js
      // ponytail: while scrolling run a reduced-rate ambient loop (1 frame
      // every 3 ticks, no mouse/trail updates) instead of freezing — the
      // canvas keeps living and full rate resumes ~150ms after scroll stops
      if (this._scrolling) {
        this._scrollTick++;
        if (this._scrollTick % 3 !== 0) {
          this.rafId = requestAnimationFrame(() => this._loop());
          return;
        }
        this._renderFrame(true);
        this.rafId = requestAnimationFrame(() => this._loop());
        return;
      }

      this._renderFrame();
```

- [ ] **Step 4: `_renderFrame` accetta modalità ambient**

Cambiare firma:

```js
    _renderFrame(ambient = false) {
```

e saltare gli aggiornamenti stantie quando ambient:

```js
      if (!ambient) {
        mouse.x = lerp(mouse.x, mouse.targetX, 0.12);
        mouse.y = lerp(mouse.y, mouse.targetY, 0.12);
      }
```

(sostituisce le due righe `mouse.x = lerp(...)` / `mouse.y = lerp(...)` in testa al metodo). Nel loop dot, racchiudere i due blocchi "Cursor head influence" e "Trail influence" (inclusi i rispettivi `dot.currentMouseStrength = lerp(...)` e `dot.currentTrailStrength = lerp(...)`) dentro `if (!ambient) { ... }`. Il resto (shape lerp, radius calc, draw) resta identico: in ambient i dot mantengono le dimensioni correnti mentre le forme continuano ad animare.

- [ ] **Step 5: Verifica osservabile**

1. Scorri su/giù attraverso il footer 5 volte lentamente: le forme continuano a ruotare debolmente durante lo scroll (prima: congelato), nessun scatto al termine.
2. Performance panel durante l'entrata: nessun task >50ms attribuibile a `dottedGrid.js`.
3. Dopo lo scroll, hover immediato: effetto reattivo entro ~0.2s.

- [ ] **Step 6: Commit**

```bash
git add js/dottedGrid.js
git commit -m "smooth footer canvas entry"
```

---

### Task 4: Culling valutazione forme via bbox (spec R2, RC2)

**Files:**
- Modify: `js/dottedGrid.js` — zona helper (~riga 37), `getCubeStrength` (head), `getInfinityStrength` (head), `computeShapeGeometry` (ritorno + campioni)

**Interfaces:**
- Consumes: parametro `geo` già presente nelle firme delle due funzioni strength.
- Produces: helper module-scope `bboxOf(points, margin)`; campi `geo.cubeBBox` / `geo.infBBox` (`[minX, minY, maxX, maxY]` in unità normalizzate).

- [ ] **Step 1: Helper `bboxOf` dopo `smoothstep` (~riga 37)**

```js
  function bboxOf(points, margin = 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return [minX - margin, minY - margin, maxX + margin, maxY + margin];
  }
```

- [ ] **Step 2: Early-out nel cubo**

In `getCubeStrength`, subito dopo `const py = (y - cy) / scale;`:

```js
    const b = geo.cubeBBox;
    if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return 0;
```

(margine 0.25 > `edgeThickness` 0.22 ⇒ nessun falso negativo sul bordo.)

- [ ] **Step 3: Early-out nell'infinito**

In `getInfinityStrength`, subito dopo `const py = (y - cy) / scale;`:

```js
    const b = geo.infBBox;
    if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return 0;
```

(margine 0.25 > `thickness` 0.14.)

- [ ] **Step 4: `computeShapeGeometry` — bbox e campioni ridotti**

Dopo la costruzione dell'array `cube` aggiungere:

```js
    const cubeBBox = bboxOf(proj, 0.25);
```

Cambiare i campioni della lemniscate (riga ~183):

```js
    const a = 0.7, pInf = 2.5, samples = 48;
```

Dopo il loop `infinity.push(...)` aggiungere:

```js
    const infBBox = bboxOf(infinity, 0.25);
```

Cambiare il ritorno finale del metodo:

```js
    return { cube, infinity, cubeBBox, infBBox };
```

(64→48 campioni: visivamente indistinguibile alla scala del footer, −25% loop distanze.)

- [ ] **Step 5: Verifica osservabile**

1. Click sul canvas fino al **cubo** (1° shape): wireframe completo, spigoli presenti durante la rotazione.
2. Click fino all'**infinito** (5° shape): banda continua, nessuna interruzione.
3. FPS meter con cubo/infinito visibile: ≥ baseline del Task 1.

- [ ] **Step 6: Commit**

```bash
git add js/dottedGrid.js
git commit -m "cull off-bbox dots cube infinity"
```

---

### Task 5: Draw batched — Path2D buckets (spec R1, RC1)

**Files:**
- Modify: `js/dottedGrid.js` — `_drawDot` (~righe 392-403), `_renderFrame` (prima del loop dot ~467 e flush dopo il loop ~545-548)

**Interfaces:**
- Consumes: `HOVER.alphaFade` (Task 1); firma `_renderFrame(ambient = false)` (Task 3 — da preservare).
- Produces: nessuna nuova API pubblica. Correttezza garantita dal vincolo no-overlap (diametro max ≈17px < spacing 20px ⇒ union fill == fill individuali anche sotto `difference`).

- [ ] **Step 1: `_drawDot` accumula nei bucket invece di disegnare**

Sostituire l'intero metodo:

```js
    _drawDot(x, y, radius, brightness, grayDisperse, trailStrength, mouseStrength, edgeFade = 1, buckets = null) {
      const mouseFade = mouseStrength * mouseStrength * HOVER.alphaFade;
      const trailFade = trailStrength * 0.3;
      // ponytail: grid visible gray, graphic black; edgeFade keeps top/bottom fade
      const alpha = clamp01(0.75 + brightness * 0.25 - mouseFade - trailFade) * edgeFade;
      if (alpha <= 0.002) return;
      const srcLightness = lerp(18, 100, brightness);

      if (!buckets) {
        this.ctx.beginPath();
        this.ctx.fillStyle = `hsla(210, 0%, ${srcLightness}%, ${alpha})`;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        return;
      }

      // ponytail: quantize style → few Path2D buckets → one fill() each
      const rQ = Math.round(radius * 2);
      const lQ = Math.round(srcLightness / 8);
      const aQ = Math.round(alpha * 20);
      const key = rQ | (lQ << 7) | (aQ << 12);
      let b = buckets.get(key);
      if (!b) {
        b = { style: `hsla(210, 0%, ${lQ * 8}%, ${aQ / 20})`, path: new Path2D() };
        buckets.set(key, b);
      }
      b.path.moveTo(x + radius, y);
      b.path.arc(x, y, radius, 0, Math.PI * 2);
    }
```

- [ ] **Step 2: `_renderFrame` crea e flusha i bucket**

Prima del loop dot (`for (let i = 0; i < this.dots.length; i++)`) aggiungere:

```js
      const buckets = new Map();
```

Entrambe le chiamate `_drawDot(...)` nel loop ricevono `, buckets` come ultimo argomento — anche quella del ramo `reduceMotion`, che diventa:

```js
          this._drawDot(dot.x, dot.y, radius, brightness, 0, 0, 0, edgeFade, buckets);
```

Subito dopo la chiusura del loop e PRIMA di `this.frameCount++` inserire il flush:

```js
      // ponytail: one fill() per style bucket instead of thousands per frame
      for (const b of buckets.values()) {
        this.ctx.fillStyle = b.style;
        this.ctx.fill(b.path);
      }
```

(l'ordine conta: il flush avviene ancora sotto `globalCompositeOperation = "difference"`.)

Bit budget della key: `rQ` max ≈17 (<128), `lQ` max ≈13 (<128), `aQ` max 20 (<4096) ⇒ nessuna collisione.

- [ ] **Step 3: Verifica osservabile**

1. Screenshot della griglia prima/dopo allo stesso viewport: identico.
2. FPS meter ≥ baseline dei task precedenti durante sweep del mouse.
3. Buco hover e trail visivamente invariati.

- [ ] **Step 4: Commit**

```bash
git add js/dottedGrid.js
git commit -m "batch footer canvas draws path2d"
```

---

### Task 6: Igiene listener + resize debounced + istanza esposta (spec R6)

**Files:**
- Modify: `js/dottedGrid.js` — constructor (~riga 252), blocco listener in `_init` (~278-281), nuovo metodo `_scheduleResize`, `destroy` (~551-560), auto-init (~564-571)

**Interfaces:**
- Consumes: metodi esistenti `_onPointerMove`, `_onClick`, `_resize`, campo `_onScroll`.
- Produces: `window.dottedGridInstance` (per verifica/destroy manuale da console); `_scheduleResize()`.

- [ ] **Step 1: Campi nel constructor**

Dopo `this.hiddenTimer = null;` aggiungere:

```js
      this._handlers = null;
      this._resizeTimer = null;
```

- [ ] **Step 2: Listener salvati (oggi destroy() è un no-op)**

Sostituire il blocco "// Pointer events" in `_init` con:

```js
      // Pointer events (stored handlers so destroy() can actually remove them)
      this._handlers = {
        pointermove: (e) => this._onPointerMove(e),
        pointerleave: () => (this.mouse.active = false),
        click: () => this._onClick(),
        resize: () => this._scheduleResize(),
      };
      this.canvas.addEventListener("pointermove", this._handlers.pointermove);
      this.canvas.addEventListener("pointerleave", this._handlers.pointerleave);
      this.canvas.addEventListener("click", this._handlers.click);
      window.addEventListener("resize", this._handlers.resize);
```

- [ ] **Step 3: Resize debounced (evita rebuild a raffica nel drag)**

Nuovo metodo subito dopo `_resize`:

```js
    _scheduleResize() {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this._resizeTimer = null;
        this._resize();
      }, 150);
    }
```

- [ ] **Step 4: `destroy()` che rimuove davvero i listener**

Sostituire l'intero metodo `destroy` con:

```js
    destroy() {
      cancelAnimationFrame(this.rafId);
      if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
      if (this._scrollDebounce) clearTimeout(this._scrollDebounce);
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      window.removeEventListener("scroll", this._onScroll);
      if (this._handlers) {
        this.canvas.removeEventListener("pointermove", this._handlers.pointermove);
        this.canvas.removeEventListener("pointerleave", this._handlers.pointerleave);
        this.canvas.removeEventListener("click", this._handlers.click);
        window.removeEventListener("resize", this._handlers.resize);
      }
    }
```

(oggi le `removeEventListener` su arrow functions appena create sono no-op.)

- [ ] **Step 5: Auto-init espone l'istanza**

Sostituire il blocco di auto-init a fondo file:

```js
  // ── Auto-init when DOM ready ──────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.dottedGridInstance = new DottedGrid();
    });
  } else {
    window.dottedGridInstance = new DottedGrid();
  }
```

(la riga `window.DottedGrid = DottedGrid;` resta invariata.)

- [ ] **Step 6: Verifica osservabile**

1. Console: `window.dottedGridInstance.destroy()` → muovendo il mouse sul footer nessuna reazione, zero errori in console.
2. `location.reload()` → tutto funziona di nuovo.
3. Drag del bordo finestra → un solo rebuild (debounce), layout corretto a fine drag.

- [ ] **Step 7: Commit**

```bash
git add js/dottedGrid.js
git commit -m "fix dotted grid cleanup"
```

---

## Self-review del piano

**Copertura spec ↔ task:** RC1→Task 5 · RC2→Task 4 · RC3→Task 2 · RC4→Task 3 · RC5→Task 1 · R6→Task 6 · G1→verifica Task 3 · G2→FPS check Task 1/5 · G3→verifica Task 1 · G4→checklist Task 1/4/5. Tutti i punti della spec hanno almeno un task; nessun gap.

**Placeholder scan:** nessun TBD/TODO/"implement later"; ogni step contiene codice completo o procedura verificabile con valori attesi espliciti.

**Coerenza nomi/tipi:** `HOVER.alphaFade` (Task 1) riusato dal Task 5 ✓ · `_rect` introdotto e usato solo nel Task 2 ✓ · `_renderFrame(ambient = false)` prodotto dal Task 3 e preservato dal Task 5 ✓ · `bboxOf`/`cubeBBox`/`infBBox` autocoerenti nel Task 4 ✓ · `_handlers`/`_resizeTimer`/`window.dottedGridInstance` coerenti nel Task 6 ✓.

**Ordine dipendenze:** Task 1 prima del Task 5 (`HOVER.alphaFade`); gli altri sono indipendenti ma l'ordine indicato minimizza i conflitti di riga tra edit consecutivi.

## Handoff

Dopo l'esecuzione: validare i criteri G1–G4 della spec (§3) in DevTools e regolare il blocco `HOVER` se il feel lo richiede — tutti i numeri dell'hover stanno lì, senza cercarli nel codice.

