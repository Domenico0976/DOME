# Task 2 Report — Cache del rect

## Status: DONE

## Commit
`a04194c cache footer canvas rect` su branch `footer-canvas-perf` (base `08b0276`) — `js/dottedGrid.js`, +8/−1.

## Cambiamenti
1. Constructor: aggiunto `this._rect = null; // cached getBoundingClientRect (layout-read cache)` dopo `this.hiddenTimer = null;`.
2. `_resize()`: aggiunto `this._rect = rect;` subito prima di `this._createDots();` (la variabile locale esiste già).
3. Nuovo metodo `_cacheRect()` subito dopo `_resize()`.
4. `_onScroll`: `this._cacheRect();` come prima istruzione — il rect è viewport-relative quindi va invalidato/aggiornato a ogni batch di scroll.
5. `_onPointerMove`: sostituito il read diretto con `const rect = this._rect || this.canvas.getBoundingClientRect();` (fallback di sicurezza per casi non cachati).

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Il percorso pointermove non esegue più layout-read quando la cache è valida.
- Verifica visiva (buco sotto il cursore durante scroll + resize) differita alla handoff finale all'utente.

## Concerns: nessuno.
