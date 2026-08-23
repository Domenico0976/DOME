# Task 6 Report — Igiene listener + resize debounced + istanza esposta

## Status: DONE

## Commit
`1677354 fix dotted grid cleanup` su branch `footer-canvas-perf` (base `394d1df`) — `js/dottedGrid.js`, +32/−11.

## Cambiamenti
1. Constructor: aggiunti `this._handlers = null;` e `this._resizeTimer = null;` dopo il campo `_rect`.
2. Blocco "Pointer events" in `_init`: handler anonimi sostituiti da oggetto `this._handlers` salvato (pointermove/pointerleave/click/resize); registrazione via riferimenti salvati.
3. Nuovo metodo `_scheduleResize()` (dopo `_cacheRect`): debounce 150ms del `_resize` con timer tracciato e azzerato.
4. `destroy()`: ora rimuove DAVVERO i listener (prima rimuoveva arrow functions appena create = no-op), pulisce anche `_resizeTimer`, e protegge con guard su `this._handlers`.
5. Auto-init espone l'istanza in `window.dottedGridInstance` (sia via DOMContentLoaded che immediato); `window.DottedGrid = DottedGrid` resta invariato.

## Nota di processo
Il primo batch di edit per questo task non è mai stato applicato al disco (chiamata persa dal layer strumenti, risultato assente): il commit successivo è fallito correttamente con "no changes". Le modifiche sono state riapplicate con chiamata singola e verificate dal diff prima del commit.

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Verifica runtime (`window.dottedGridInstance.destroy()` → nessuna reazione hover, zero errori; reload ok) differita alla handoff finale all'utente.

## Concerns: nessuno.
