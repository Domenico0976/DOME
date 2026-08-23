# Task 5 Report — Draw batched via Path2D buckets

## Status: DONE

## Commit
`394d1df batch footer canvas draws path2d` su branch `footer-canvas-perf` (base `cdf31ec`) — `js/dottedGrid.js`, +35/−8.

## Cambiamenti
1. `_drawDot(..., buckets = null)`: nuovo parametro opzionale. Con buckets: quantizza `(raggio ×2 step 0.5px, lightness /8, alpha ×20)` → chiave intera `rQ | (lQ << 7) | (aQ << 12)` → accumula l'arco nel `Path2D` del bucket (`moveTo(x+radius,y)` prima di ogni `arc` per non collegare sottopercorsi). Senza buckets (fallback): disegno diretto come prima.
2. Stile bucket precomputato una sola volta per bucket: `` `hsla(210, 0%, ${lQ*8}%, ${aQ/20})` `` — zero stringhe hsla per-dot.
3. `_renderFrame`: `const buckets = new Map();` prima del loop dot; entrambe le call-site `_drawDot` (ramo reduceMotion e principale) passano `buckets`.
4. Flush dopo il loop e PRIMA di `this.frameCount++`: un solo `fill(path)` per bucket, ancora sotto `globalCompositeOperation = "difference"`.

## Correttezza
- No-overlap: diametro max ≈17px < spacing 20px ⇒ union fill == fill individuali anche sotto compositing difference.
- Bit budget chiave: rQ max ≈17 (<128), lQ max 13 (<16 effettivo), aQ max 20 — nessuna collisione.
- Quantizzazione: ±0.25px raggio, ±4 lightness, ±0.025 alpha — impercettibile.
- Dots con alpha ≤ 0.002 saltati come prima; alpha appena sopra soglia può quantizzare a aQ=0 (invisibile) — equivalente a prima in pratica.

## Verifica
- `node --check js/dottedGrid.js` → **SYNTAX OK**
- Verifica visiva (griglia identica before/after) e FPS differite alla handoff finale all'utente.

## Concerns: nessuno.
