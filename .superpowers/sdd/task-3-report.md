# Task 3 Report — Entrata graduale

## Status: DONE

## Commit
`acc9eb5 smooth footer canvas entry` su branch `footer-canvas-perf` (base `a04194c`) — `js/dottedGrid.js`, +63/−51.

## Cambiamenti
1. `_init`: aggiunto `this._scrollTick = 0;` accanto a `this._scrolling = false;`.
2. IntersectionObserver callback: la ripresa visibilità ora pianifica `requestAnimationFrame(() => this._loop())` invece di chiamare `_loop()` sincronicamente nel callback (nessun burst dentro l'observer).
3. `_loop`: il ramo `_scrolling` non congela più — conta i tick e renderizza **1 frame su 3** in modalità ambientale (`_renderFrame(true)`), tornando a pieno regime ~150ms dopo lo stop dello scroll (debounce esistente).
4. `_renderFrame(ambient = false)`: nuova firma; quando `ambient`, salta l'aggiornamento `mouse.x/y` verso i target.
5. Blocchi "Cursor head influence" e "Trail influence" (inclusi i rispettivi lerp di `currentMouseStrength`/`currentTrailStrength`) racchiusi in `if (!ambient) { ... }` con re-indentazione corretta: nei frame ambientali i dot mantengono le dimensioni correnti mentre le forme continuano ad animare (shape lerp e draw restano attivi).

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Invariante rAF preservata: "timer impostato ⇒ nessun rAF pendente" (il resume cancella prima il timer poi schedula via rAF).
- Ramo `reduceMotion` non toccato.
- Verifica visiva (scroll attraverso footer ×5, assenza long task >50ms, ripresa interazione ≤0.2s) differita alla handoff finale all'utente.

## Concerns: nessuno.
