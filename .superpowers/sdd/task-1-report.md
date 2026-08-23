# Task 1 Report — Hover netto

## Status: DONE

## Commit
`08b0276 sharpen footer canvas hover` su branch `footer-canvas-perf` (base `6a800ae`) — `js/dottedGrid.js`, +29/−8.

## Cambiamenti
1. Blocco module-scope `HOVER` inserito dopo `REDUCED_MOTION_QUERY`: radius 160, innerPlateau 0.35, attack 0.38, release 0.15, minScale 0.15, alphaFade 0.30.
2. Rimosso `mouseRadius: 380` da `DEFAULTS`; constructor usa `options.mouseRadius ?? HOVER.radius` (override pubblico preservato).
3. `_drawDot`: coefficiente alpha-fade da `0.5` a `HOVER.alphaFade`.
4. Blocco cursore sostituito: falloff cubico `(1-norm)^3` → plateau piatto (`distSq <= inner²` ⇒ 1) + bordo `smoothstep` nitido; lerp fisso 0.12 → attacco/rilascio asimmetrici (`HOVER.attack`/`HOVER.release`).
5. Profondità shrink: `× 0.75` → `× (1 - HOVER.minScale)` ⇒ collasso al 15% del raggio al centro.

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Ramo `reduceMotion` non toccato (passa ancora zeri); `trailShrink` invariato; option API compatibile.
- Verifica visiva/FPS differita alla handoff finale all'utente (checklist dedicata).

## Concerns: nessuno.
