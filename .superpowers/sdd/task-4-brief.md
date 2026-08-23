# Task Brief (estratto verbatim dal piano)

### Task 4: Culling valutazione forme via bbox (spec R2, RC2)

**Files:**
- Modify: `js/dottedGrid.js` â€” zona helper (~riga 37), `getCubeStrength` (head), `getInfinityStrength` (head), `computeShapeGeometry` (ritorno + campioni)

**Interfaces:**
- Consumes: parametro `geo` giÃ  presente nelle firme delle due funzioni strength.
- Produces: helper module-scope `bboxOf(points, margin)`; campi `geo.cubeBBox` / `geo.infBBox` (`[minX, minY, maxX, maxY]` in unitÃ  normalizzate).

- [ ] **Step 1: Helper `bboxOf` dopo `smoothstep` (~riga 37)**

```js
  function bboxOf(points, margin = 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return [minX - margin, minY - margin, maxX + margin, maxY + margin];
  }
```

- [ ] **Step 2: Early-out nel cubo**

In `getCubeStrength`, subito dopo `const py = (y - cy) / scale;`:

```js
    const b = geo.cubeBBox;
    if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return 0;
```

(margine 0.25 > `edgeThickness` 0.22 â‡’ nessun falso negativo sul bordo.)

- [ ] **Step 3: Early-out nell'infinito**

In `getInfinityStrength`, subito dopo `const py = (y - cy) / scale;`:

```js
    const b = geo.infBBox;
    if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return 0;
```

(margine 0.25 > `thickness` 0.14.)

- [ ] **Step 4: `computeShapeGeometry` â€” bbox e campioni ridotti**

Dopo la costruzione dell'array `cube` aggiungere:

```js
    const cubeBBox = bboxOf(proj, 0.25);
```

Cambiare i campioni della lemniscate (riga ~183):

```js
    const a = 0.7, pInf = 2.5, samples = 48;
```

Dopo il loop `infinity.push(...)` aggiungere:

```js
    const infBBox = bboxOf(infinity, 0.25);
```

Cambiare il ritorno finale del metodo:

```js
    return { cube, infinity, cubeBBox, infBBox };
```

(64â†’48 campioni: visivamente indistinguibile alla scala del footer, âˆ’25% loop distanze.)

- [ ] **Step 5: Verifica osservabile**

1. Click sul canvas fino al **cubo** (1Â° shape): wireframe completo, spigoli presenti durante la rotazione.
2. Click fino all'**infinito** (5Â° shape): banda continua, nessuna interruzione.
3. FPS meter con cubo/infinito visibile: â‰¥ baseline del Task 1.

- [ ] **Step 6: Commit**

```bash
git add js/dottedGrid.js
git commit -m "cull off-bbox dots cube infinity"
```

---


