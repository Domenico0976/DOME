# Task Brief (estratto verbatim dal piano)

### Task 6: Igiene listener + resize debounced + istanza esposta (spec R6)

**Files:**
- Modify: `js/dottedGrid.js` â€” constructor (~riga 252), blocco listener in `_init` (~278-281), nuovo metodo `_scheduleResize`, `destroy` (~551-560), auto-init (~564-571)

**Interfaces:**
- Consumes: metodi esistenti `_onPointerMove`, `_onClick`, `_resize`, campo `_onScroll`.
- Produces: `window.dottedGridInstance` (per verifica/destroy manuale da console); `_scheduleResize()`.

- [ ] **Step 1: Campi nel constructor**

Dopo `this.hiddenTimer = null;` aggiungere:

```js
      this._handlers = null;
      this._resizeTimer = null;
```

- [ ] **Step 2: Listener salvati (oggi destroy() Ã¨ un no-op)**

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
  // â”€â”€ Auto-init when DOM ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

1. Console: `window.dottedGridInstance.destroy()` â†’ muovendo il mouse sul footer nessuna reazione, zero errori in console.
2. `location.reload()` â†’ tutto funziona di nuovo.
3. Drag del bordo finestra â†’ un solo rebuild (debounce), layout corretto a fine drag.

- [ ] **Step 7: Commit**

```bash
git add js/dottedGrid.js
git commit -m "fix dotted grid cleanup"
```

---


