# Task 4 Report — Culling forme via bbox

## Status: DONE_WITH_CONCERNS (deviazione pianificata corretta e documentata)

## Commit
`cdf31ec cull off-bbox dots cube infinity` su branch `footer-canvas-perf` (base `acc9eb5`) — `js/dottedGrid.js`, +38/−7.

## ⚠️ Deviazione dal piano (correzione bug del piano)
Gli Step 2–3 del brief usavano `geo.cubeBBox` / `geo.infBBox` **dentro** `getCubeStrength`/`getInfinityStrength`, ma quelle funzioni NON ricevono `geo`: ricevono solo `edges`/`pts` come ultimo parametro (vedi `getRawShapeStrength`). Il codice del piano avrebbe lanciato `ReferenceError: geo is not defined` a ogni valutazione forma, bloccando il render.
**Risoluzione** (fedele all'intento: early-out dopo la normalizzazione px/py, prima dei loop di distanze): il bbox viene passato come **parametro aggiuntivo** dalle uniche due call-site esistenti:
- `getCubeStrength(x, y, time, width, height, edges, cubeBBox)`
- `getInfinityStrength(x, y, time, width, height, pts, infBBox)`
- `getRawShapeStrength` ora passa `geo.cubeBBox` / `geo.infBBox`.

## Cambiamenti
1. Helper module-scope `bboxOf(points, margin)` dopo `smoothstep`.
2. Early-out cubo: fuori da `[minX,minY,maxX,maxY]+0.25` ⇒ `return 0` senza loop (margine 0.25 > edgeThickness 0.22 ⇒ nessun falso negativo).
3. Early-out infinito: analogo (0.25 > thickness 0.14).
4. `computeShapeGeometry`: `const cubeBBox = bboxOf(proj, 0.25);` dopo il cubo; `const infBBox = bboxOf(infinity, 0.25);` dopo la lemniscate; return `{ cube, infinity, cubeBBox, infBBox }`.
5. Campioni lemniscate 64 → 48 (commento aggiornato di conseguenza).

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Unicità call-site verificata: le due funzioni strength sono chiamate solo da `getRawShapeStrength` (nessun altro chiamante da aggiornare).
- Semantica invariata per i dot esterni al margine: restituivano già 0 oltre soglia (0.22 / 0.14 < 0.25) ⇒ nessun cambiamento visivo possibile dal culling.
- Verifica visiva (cubo wireframe completo, banda infinito continua) differita alla handoff finale.

## Concerns
- La deviazione sopra: il piano va considerato corretto nell'intento; se il piano viene riusato altrove, gli step 2–3 vanno emendati.
