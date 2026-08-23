# Task Brief (estratto verbatim dal piano)

### Task 1: Hover netto â€” blocco `HOVER` + influenza cursore riprogettata (spec R5, RC5)

**Files:**
- Modify: `js/dottedGrid.js:14` (DEFAULTS), `js/dottedGrid.js:11-21` (nuovo blocco costante), `js/dottedGrid.js:218` (constructor), `js/dottedGrid.js:393` (`_drawDot`), `js/dottedGrid.js:487-499` (blocco cursore), `js/dottedGrid.js:530` (shrink)

**Interfaces:**
- Consumes: helper esistenti `lerp`, `clamp01`, `smoothstep` (giÃ  nel file, righe 32-37).
- Produces: costante module-scope `HOVER = { radius, innerPlateau, attack, release, minScale, alphaFade }`. I task successivi riusano `HOVER.alphaFade` (Task 5). Il default del constructor ora deriva da `HOVER.radius`.

- [ ] **Step 1: Baseline soggettiva**

Apri la pagina, muovi lentamente il cursore sul footer. Annota: alone sfocato ampio (~380px), i dot svaniscono piÃ¹ che restringersi, reazione morbida/lenta. (Questo Ã¨ lo stato "prima".)

- [ ] **Step 2: Inserire il blocco `HOVER` dopo la riga 8**

Subito sotto `const REDUCED_MOTION_QUERY = ...` e sopra `// â”€â”€ Config`:

```js
  // â”€â”€ Hover tuning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ponytail: all hover "feel" numbers in one place for easy tweaking
  const HOVER = {
    radius: 160,        // px â€” effect reach (was 380: too diluted)
    innerPlateau: 0.35, // fraction of radius with full collapse (crisp hole)
    attack: 0.38,       // lerp speed growing (~80% collapse in ~70ms @60fps)
    release: 0.15,      // lerp speed decaying (softer release reads natural)
    minScale: 0.15,     // residual radius factor under cursor center
    alphaFade: 0.30,    // alpha removed at full strength (was 0.5: too vanishing)
  };
```

- [ ] **Step 3: Unica fonte di veritÃ  per il raggio**

In `DEFAULTS` rimuovere la riga `mouseRadius: 380,`. Nel constructor sostituire:

```js
      this.mouseRadius = options.mouseRadius ?? DEFAULTS.mouseRadius;
```

con:

```js
      this.mouseRadius = options.mouseRadius ?? HOVER.radius;
```

- [ ] **Step 4: Alpha-fade governato da config**

In `_drawDot` sostituire:

```js
      const mouseFade = mouseStrength * mouseStrength * 0.5;
```

con:

```js
      const mouseFade = mouseStrength * mouseStrength * HOVER.alphaFade;
```

- [ ] **Step 5: Curza cursore: plateau piatto + bordo nitido, attacco/rilascio asimmetrici**

Sostituire l'intero blocco (oggi alle righe 487-499):

```js
        // Cursor head influence (distSq â€” no sqrt)
        let targetMouseStrength = 0;
        if (mouse.active) {
          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = this.mouseRadius * this.mouseRadius;
          if (distSq < mrSq) {
            const norm = Math.sqrt(distSq) / this.mouseRadius;
            targetMouseStrength = (1 - norm) ** 3;
          }
        }
        dot.currentMouseStrength = lerp(dot.currentMouseStrength, targetMouseStrength, 0.12);
```

con:

```js
        // Cursor head influence: flat collapse plateau + crisp smoothstep edge
        let targetMouseStrength = 0;
        if (mouse.active) {
          const dx = dot.x - mouse.x;
          const dy = dot.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          const mrSq = this.mouseRadius * this.mouseRadius;
          if (distSq < mrSq) {
            const inner = this.mouseRadius * HOVER.innerPlateau;
            targetMouseStrength =
              distSq <= inner * inner
                ? 1
                : 1 - smoothstep(inner, this.mouseRadius, Math.sqrt(distSq));
          }
        }
        const kMouse =
          targetMouseStrength > dot.currentMouseStrength
            ? HOVER.attack
            : HOVER.release;
        dot.currentMouseStrength = lerp(
          dot.currentMouseStrength,
          targetMouseStrength,
          kMouse
        );
```

- [ ] **Step 6: ProfonditÃ  di collasso dal config**

Sostituire:

```js
        const mouseShrink = 1 - dot.currentMouseStrength * 0.75;
```

con:

```js
        const mouseShrink = 1 - dot.currentMouseStrength * (1 - HOVER.minScale);
```

(la riga `trailShrink` successiva resta invariata.)

- [ ] **Step 7: Verifica osservabile**

Ricarica la pagina. Atteso:
- Buco circolare **nitido** che segue il cursore, raggio d'azione ~160px (prima: alone ~380px).
- Dot sotto il cursore: pallina piccola ma visibile (~15% del raggio), non invisibile.
- Flick rapido dentro/fuori: reazione netta entro ~0.1s.
- Click cicla ancora le forme; la griglia fuori dal buco Ã¨ identica a prima.

- [ ] **Step 8: Commit**

```bash
git add js/dottedGrid.js
git commit -m "sharpen footer canvas hover"
```

---


