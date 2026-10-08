# CONSOLIDATED BUG INVENTORY — Generative Tools vs Original

**Data:** 2026-08-25 · Fonti: analisi codice + sito live (camofox) + Tool-Render.md · Stato repo: 44 commit locali su `Tools-Dome`, tree pulito
Tag: `[FIDELITY]` fedeltà algoritmo/visual · `[CUSTOM]` customizzabilità parametri · `[REACTIVITY]` efficienza aggiornamento live · Severità: **H** blocca l'uso come nell'originale / **M** divario evidente / **L** polish

---

## REACTIVITY — il reclamo principale ("le modifiche non aggiornano in modo efficiente")

### R1 [REACTIVITY][H] Cambio parametri strutturali = reseed distruttivo della simulazione
- **Dove:** `ferrofluid.ts` — sig `${attractors}|${size}`; `particles.ts` — sig `${count}|${a}|${b}|${m}|${n}`; `particles2.ts`, `molecules.ts`, `doodle.ts` analoghi.
- **Causa:** al cambio di UN parametro incluso nella signature l'intero stato (griglia RD / nube particelle / skeleton) viene ricreato da seed → il pattern salta o svanisce invece di transire.
- **Fix:** transizione continua — per RD: ri-seed SOLO degli attractor blob mantenendo il campo B esistente (lerp verso nuova densità); per particelle: aggiungi/rimuovi particle incrementalmente preservando le posizioni; rimuovere i parametri strutturali dalla sig dove possibile.

### R2 [REACTIVITY][H] Allocazione per-frame nel percorso ferrofluid
- **Dove:** `engine/rd.ts → toImageData()` alloca `new ImageData(n,n)` (~100KB) ad ogni frame, chiamato da `ferrofluid.render`; più `putImageData` + `drawImage` full-surface.
- **Effetto misurato:** 30fps floor headless con solo ferrofluid (baseline vuota 62).
- **Fix:** buffer ImageData riusato memorizzato nella Sim + `fillImageData(target, accent)`; opzionale offscreen canvas persistente.

### R3 [REACTIVITY][M] Sliders effetti OK ma senza feedback di valore
- Gli slider Effects aggiornano per-frame correttamente, ma mancano i *value-button* formattati dell'originale ("50%", "2px") che mostrano il valore corrente.

## FIDELITY — algoritmi/parametri diversi dall'originale

### F1 [FIDELITY][H] Adjustments: parametrizzazione sbagliata
- **Nostro:** Brightness/Contrast/Saturation, range misti ([-100..100], [-1..1]).
- **Originale (captato live):** **Contrast / Exposure / Saturation / Temperature / Tint**, tutti [0..100] con **50 = neutro**, display %, + Reset per-effetto. Mancano completamente Temperature e Tint (white-balance).

### F2 [FIDELITY][H] Gli altri 6 effetti: parametri interni NON verificati contro l'originale
- Le sezioni Aberration/Glow/Waves/Edge Blur/Distort Lens/Grain sono collassabili sull'originale e vanno espanse per catturare nomi/range/default reali (sospetto: semantica centro-neutro 0..100 uniforme anche lì, diversa dai nostri range).

### F3 [FIDELITY][H] Particles: set controlli completamente diverso
- **Originale (live):** Modes **Chladni figures / Sphere / Cube / Flow Waves**; Chladni espone Handle X, Handle Y, Frequency, Density, Particle Size(px), Opacity(%); Colors = Particle + Background.
- **Nostro:** Count/Size/Speed/Hue/A/B/M/N/Damping — nessun Handle, nessuna Opacity, hue al posto di Colors, no Density.

### F4 [FIDELITY][M] Shaders: fallback CPU vs fbm GPU — visuale diversa senza WebGL; palette da verificare sul live.

### F5 [FIDELITY][L] Glow single-pass 24-tap vs separable multi-FBO (già deviazione documentata); Edge Blur wrap-vs-clamp bordi.

## CUSTOM — customizzazione totale mancante (pattern piattaforma assenti)

### C1 [CUSTOM][H] Sistema **Modes** per-tool assente
- Originale: dropdown Modes in cima ai Controls con varianti-motore (Particles: Chladni/Sphere/Cube/Flow Waves) che cambiano l'intero set di parametri. Noi: nessun concetto di mode.

### C2 [CUSTOM][H] **Anchor points** sul canvas assenti
- Originale: Handle X/Y trascinabili direttamente sul rendering, sincronizzati bidirezionalmente con gli slider.

### C3 [CUSTOM][M] Sezioni collassabili Parameters/Colors + **Colors per-tool** (Particle/Background picker) assenti nei nostri pannelli.

### C4 [CUSTOM][M] **Reset settings to default** per-tool ed **Reset effect settings** per-effetto assenti (abbiamo solo remove/toggle istanze).

### C5 [CUSTOM][M] **Value-button** accanto a ogni slider (mostra valore formattato "5", "2px", "100%") assente — l'originale li ha su OGNI parametro.

### C6 [CUSTOM][L] **Symmetry** toggle (lock/unlock) presente sull'originale vicino al canvas — feature intera mancante.

### C7 [CUSTOM][L] Preview quality etichettata "**Ultra 4K — 60fps**" nell'originale; nostra etichetta semplice.

## PLATFORM — altri divari UI osservati (bassa priorità)
- Export unificato singolo bottone + voce dedicata "Video loop for Spotify Canvas" (disabilitato senza audio).
- BPM default **82** (nostro 120), timeline duration editabile 01:00.
- Nodo stack originale: chip con icona + Edit/Switch/⋮ sempre visibili (no hover-only).

---

## Priorità di fix suggerite (ondate)
1. **Wave A (reattività, H):** R1 + R2 — rende le modifiche fluide e recupera fps.
2. **Wave B (fedeltà effetti, H):** F1 + F2 (cattura restanti 6 effetti dal live poi riscrittura uniforms/shader).
3. **Wave C (custom):** C1–C5 (Modes system, anchor points, sezioni, reset, value-buttons).
4. **Wave D (polish):** C6, C7, F3-particolari residui, F4/F5.
