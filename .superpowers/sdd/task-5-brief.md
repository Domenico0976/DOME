# Task Brief (estratto verbatim dal piano)

### Task 5: Draw batched â€” Path2D buckets (spec R1, RC1)

**Files:**
- Modify: `js/dottedGrid.js` â€” `_drawDot` (~righe 392-403), `_renderFrame` (prima del loop dot ~467 e flush dopo il loop ~545-548)

**Interfaces:**
- Consumes: `HOVER.alphaFade` (Task 1); firma `_renderFrame(ambient = false)` (Task 3 â€” da preservare).
- Produces: nessuna nuova API pubblica. Correttezza garantita dal vincolo no-overlap (diametro max â‰ˆ17px < spacing 20px â‡’ union fill == fill individuali anche sotto `difference`).

- [ ] **Step 1: `_drawDot` accumula nei bucket invece di disegnare**

Sostituire l'intero metodo:

```js
    _drawDot(x, y, radius, brightness, grayDisperse, trailStrength, mouseStrength, edgeFade = 1, buckets = null) {
      const mouseFade = mouseStrength * mouseStrength * HOVER.alphaFade;
      const trailFade = trailStrength * 0.3;
      // ponytail: grid visible gray, graphic black; edgeFade keeps top/bottom fade
      const alpha = clamp01(0.75 + brightness * 0.25 - mouseFade - trailFade) * edgeFade;
      if (alpha <= 0.002) return;
      const srcLightness = lerp(18, 100, brightness);

      if (!buckets) {
        this.ctx.beginPath();
        this.ctx.fillStyle = `hsla(210, 0%, ${srcLightness}%, ${alpha})`;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        return;
      }

      // ponytail: quantize style â†’ few Path2D buckets â†’ one fill() each
      const rQ = Math.round(radius * 2);
      const lQ = Math.round(srcLightness / 8);
      const aQ = Math.round(alpha * 20);
      const key = rQ | (lQ << 7) | (aQ << 12);
      let b = buckets.get(key);
      if (!b) {
        b = { style: `hsla(210, 0%, ${lQ * 8}%, ${aQ / 20})`, path: new Path2D() };
        buckets.set(key, b);
      }
      b.path.moveTo(x + radius, y);
      b.path.arc(x, y, radius, 0, Math.PI * 2);
    }
```

- [ ] **Step 2: `_renderFrame` crea e flusha i bucket**

Prima del loop dot (`for (let i = 0; i < this.dots.length; i++)`) aggiungere:

```js
      const buckets = new Map();
```

Entrambe le chiamate `_drawDot(...)` nel loop ricevono `, buckets` come ultimo argomento â€” anche quella del ramo `reduceMotion`, che diventa:

```js
          this._drawDot(dot.x, dot.y, radius, brightness, 0, 0, 0, edgeFade, buckets);
```

Subito dopo la chiusura del loop e PRIMA di `this.frameCount++` inserire il flush:

```js
      // ponytail: one fill() per style bucket instead of thousands per frame
      for (const b of buckets.values()) {
        this.ctx.fillStyle = b.style;
        this.ctx.fill(b.path);
      }
```

(l'ordine conta: il flush avviene ancora sotto `globalCompositeOperation = "difference"`.)

Bit budget della key: `rQ` max â‰ˆ17 (<128), `lQ` max â‰ˆ13 (<128), `aQ` max 20 (<4096) â‡’ nessuna collisione.

- [ ] **Step 3: Verifica osservabile**

1. Screenshot della griglia prima/dopo allo stesso viewport: identico.
2. FPS meter â‰¥ baseline dei task precedenti durante sweep del mouse.
3. Buco hover e trail visivamente invariati.

- [ ] **Step 4: Commit**

```bash
git add js/dottedGrid.js
git commit -m "batch footer canvas draws path2d"
```

---


