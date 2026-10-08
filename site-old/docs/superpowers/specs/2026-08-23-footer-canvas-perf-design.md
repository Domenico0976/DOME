# Design — Footer dot-grid canvas: performance & hover più netto

- **Data:** 2026-08-23
- **Stato:** Proposto — in attesa di review utente
- **Scope:** `js/dottedGrid.js` (canvas `#dotted-grid-bg` nel footer di `index.html`). Nessuna modifica a HTML/CSS salvo indicato.
- **Nota sessione:** sessione autonoma; la domanda chiarificatrice su "entrata" non ha ricevuto risposta. Assunzione adottata: *entrata* = (a) footer che entra in viewport durante lo scroll e (b) puntatore che entra nel canvas. Entrambe coperte; le costanti sono centralizzate per ritocco facile dopo il feel-test.

## 1. Contesto e problemi riportati

L'utente segnala sul canvas del footer:
1. **Lag all'"entrata"** (scroll-in-viewport e/o ingresso del mouse nel canvas).
2. **Effetto mouse troppo leggero**: vuole un rimpicciolimento dei dot netto e visibile all'hover.

## 2. Cause radice (verificate nel sorgente)

| ID | Causa | Dove |
|----|-------|------|
| RC1 | Fase draw dominante: ogni frame ~2.400 dot disegnati singolarmente (`beginPath`/`arc`/`fill`) con stringa `hsla()` costruita per-dot | `_drawDot` + loop in `_renderFrame` |
| RC2 | Valutazione forme pesante: ogni 3 frame **tutti** i dot valutano la forma; "infinity" = 64 segmenti × dot (≈150k calcoli distanza in un frame), cubo = 12 spigoli × dot | `_getShapeData`, `getInfinityStrength`, `getCubeStrength` |
| RC3 | Layout thrash: `getBoundingClientRect()` chiamato a **ogni** evento `pointermove` | `_onPointerMove` |
| RC4 | Pop all'entrata: durante lo scroll il render è congelato (`_scrolling` skip totale); al primo frame fermo tutto il lavoro avviene in un colpo solo; inoltre l'IntersectionObserver richiama `_loop()` sincronamente nel callback | `_loop`, observer in `_init` |
| RC5 | Hover morbido: `mouseRadius` 380px diluisce l'effetto; falloff cubico `(1-norm)^3`; smoothing `lerp 0.12` ≈ 130ms di reattività; il fade alpha (`m²·0.5`) fa svanire i dot invece di mostrarne il restringimento | DEFAULTS, blocco cursore in `_renderFrame`, `_drawDot` |

Vincolo geometrico utile (verificato): diametro massimo dot ≈ 17px < `spacing` 20px ⇒ **mai overlap tra dot** ⇒ un fill di unione produce lo stesso risultato di fill individuali anche sotto compositing `difference`.

## 3. Obiettivi

- **G1** Nessun jank visibile quando il footer entra in viewport durante lo scroll: nessun long task >50ms attribuibile a DottedGrid.
- **G2** Hover fluido: ≥55fps sostenuti su laptop di fascia media mentre il cursore si muove sul canvas.
- **G3** Hover netto: "buco" circolare nitido che segue il cursore entro ~2–3 frame; raggio d'azione ~160px; il dot sotto il cursore raggiunge ≥80% del collasso entro ~70ms e arriva a ≤15–20% del raggio base.
- **G4** Zero regressioni visive altrove: griglia grigia identica, ciclo forme col click (incluse transizioni random/collect/hold/disperse), trail sottile invariato, `prefers-reduced-motion` invariato.

## 4. Non-obiettivi

- Scaling DPR/retina (`dpr=1` resta: scelta di performance già fatta).
- Rewrite WebGL/OffscreenCanvas.
- Tuning touch/mobile specifico (comportamento attuale invariato).
- Modifica alla coreografia delle forme o al trail (salvo coefficienti esplicitamente citati).

## 5. Approcci considerati

### A) Ottimizzazione mirata nell'architettura Canvas2D attuale ✅ scelto
Batching del draw, culling della valutazione forme, rimozione layout-thrash, entrata graduale, rituning hover. **Pro:** rischio basso, look identico tranne l'hover voluto, guadagno stimato 3–6× sulla fase draw da solo. **Contro:** il ceiling resta CPU single-thread (accettabile per un widget footer).

### B) Rendering incrementale / dirty-region ❌ scartato
Ridisegnare solo le regioni modificate (mouse/trail) e aggiornare l'ambiente a bassa frequenza su layer offscreen. **Contro:** le forme animano globalmente e il compositing `difference` rende l'invalidazione parziale fragile; alto rischio regressione visiva per poco guadagno extra rispetto ad A.

### C) Rewrite WebGL (quad instanziati) ❌ scartato
Massime prestazioni ma overkill per un widget footer: shader da mantenere, parità visiva da ricreare (difference blending, edge fade), nessun bisogno reale dopo A.

## 6. Design scelto (Approccio A)

Tutte le modifiche restano dentro `js/dottedGrid.js`. Nuovo blocco `HOVER` di tuning in testa al file così che l'utente possa regolare la sensazione senza cercare numeri nel codice:

```js
const HOVER = {
  radius: 160,        // era mouseRadius 380
  innerPlateau: 0.35, // % del raggio dentro cui collasso pieno
  attack: 0.38,       // lerp risposta (era 0.12) → ~60-70ms
  release: 0.15,      // decadimento leggermente più morbido
  minScale: 0.15,     // raggio residuo al centro (era effettivo 25%)
  alphaFade: 0.30,    // era 0.5: conta il restringimento, non lo svanire
};
```

### R1 — Draw batched (attacca RC1)
Quantizzare `(raggio, lightness, alpha)` in bucket (es. raggio step 0.5px, lightness step ~8, alpha step ~6); accumulare gli archi in un `Path2D` per bucket; **un solo `fill()` per bucket** con stile precomputato (niente stringhe hsla per-dot). I dot con `alpha <= 0.002` vengono saltati come oggi. Correttezza garantita dal vincolo di non-overlap (§2). Attesa: decine di fill invece di migliaia.

### R2 — Culling valutazione forme (RC2)
A ogni refresh geometria (già ogni 3 frame in `computeShapeGeometry`) calcolare il bbox proiettato di: spigoli cubo e lemniscate; i dot fuori da `bbox + margine` prendono `shapeStrength = 0` direttamente nello `shapeCache` senza loop di distanze. Campioni infinity ridotti 64 → 48 (visivamente indistinguibile a quella scala).

### R3 — Niente layout-read per evento (RC3)
`this._rect` cache aggiornata in `_resize()` e nel listener scroll passivo esistente (uno per batch di scroll), letta da `_onPointerMove` senza `getBoundingClientRect()`.

### R4 — Entrata graduale (RC4)
1. Ripresa visibilità: l'observer pianifica `_loop` via `requestAnimationFrame` invece di renderizzare sincronicamente nel callback.
2. Durante lo scroll attivo: invece del freeze totale, **render ridotto** — 1 frame su 3, senza aggiornamenti mouse/trail (sarebbero comunque stantie) — così il canvas "vive" e al termine dello scroll (debounce 150ms esistente) si torna a pieno regime senza scatto.

### R5 — Hover netto (RC5)
Vedi blocco `HOVER`: raggio 160px, plateau interno piatto con bordo `smoothstep` nitido (forza = `1 - smoothstep(R·0.35, R, dist)`), attacco rapido/decadenza morbida, profondità di collasso al 15%, alpha-fade ridotto a 0.30 perché l'effetto percepito sia il rimpicciolimento. Trail invariato.

### R6 — Igene listener (miglioramento mirato, tocca codice che cambiamo comunque)
Salvare gli handler bound; correggere `destroy()` che oggi rimuove arrow functions appena create (no-op) → rimozione reale; debounce del `resize` (150ms) per evitare rebuild a raffica durante il drag; pulizia del timer nel `destroy()`.

## 7. Gestione errori / edge case

- Canvas mancante: warning console (invariato).
- `prefers-reduced-motion`: percorso statico invariato; i nuovi parametri hover non si applicano (mouse.active=false come oggi).
- Resize durante hover: `_rect` ricache-ata in `_resize`.
- `destroy()`: nessun listener orfano, nessun timer pendente.

## 8. Validazione (manuale — il repo non ha infrastruttura di test)

1. **Perf entrata:** DevTools Performance, scroll ripetuto verso il footer → nessun task >50ms su `dottedGrid.js`.
2. **Perf hover:** FPS meter attivo, sweep ampio del mouse sul canvas → ≥55fps.
3. **Feel hover:** buco nitido che segue il cursore entro ~2–3 frame; confronto prima/dopo su stessa pagina.
4. **Checklist visiva:** griglia invariata; click cicla le 5 forme con transizione completa; trail sottile; reduced-motion statico.
5. **Robustezza:** resize finestra senza errori; `grid.destroy()` manuale stacca davvero i listener.

I criteri G1–G4 (§3) sono la definizione misurabile di "fatto".
