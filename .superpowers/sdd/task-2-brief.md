# Task Brief (estratto verbatim dal piano)

### Task 2: Cache del rect â€” niente layout-read per pointermove (spec R3, RC3)

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

In `_resize`, dopo `const rect = this.canvas.getBoundingClientRect();` la variabile locale esiste giÃ  â€” aggiungere il salvataggio in fondo al metodo, subito prima di `this._createDots();`:

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

- [ ] **Step 4: Scroll invalida la cache (il rect Ã¨ viewport-relative)**

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

1. Posizionati a metÃ  pagina, scorri fino al footer, muovi il mouse: il buco appare **esattamente** sotto il cursore.
2. Ridimensiona la finestra e ri-hovera: posizione corretta.
3. DevTools â†’ Performance, registra mentre hoveri: nessuna voce "Recalculate Style / Layout" associata agli eventi pointermove (prima ce n'era una per evento).

- [ ] **Step 7: Commit**

```bash
git add js/dottedGrid.js
git commit -m "cache footer canvas rect"
```

---


