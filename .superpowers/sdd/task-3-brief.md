# Task Brief (estratto verbatim dal piano)

### Task 3: Entrata graduale â€” resume via rAF + render ambientale durante lo scroll (spec R4, RC4)

**Files:**
- Modify: `js/dottedGrid.js:285` (init campi scroll), `js/dottedGrid.js:296-306` (observer callback), `js/dottedGrid.js:420-430` (`_loop`), `js/dottedGrid.js:432+` (`_renderFrame` firma e guardie mouse/trail)

**Interfaces:**
- Consumes: struttura `mouse.trail` e blocchi influenza cursore/trail esistenti.
- Produces: `_renderFrame(ambient = false)` â€” i task successivi che toccano `_renderFrame` (Task 5) devono mantenere questo parametro.

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
      // every 3 ticks, no mouse/trail updates) instead of freezing â€” the
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

- [ ] **Step 4: `_renderFrame` accetta modalitÃ  ambient**

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

1. Scorri su/giÃ¹ attraverso il footer 5 volte lentamente: le forme continuano a ruotare debolmente durante lo scroll (prima: congelato), nessun scatto al termine.
2. Performance panel durante l'entrata: nessun task >50ms attribuibile a `dottedGrid.js`.
3. Dopo lo scroll, hover immediato: effetto reattivo entro ~0.2s.

- [ ] **Step 6: Commit**

```bash
git add js/dottedGrid.js
git commit -m "smooth footer canvas entry"
```

---


