# DESIGN-star — Stella 4 punte chrome liquido (spec per render isolato su trasparente)

> Sorgenti: `istruction_AI/Star/star-goldBlue.png` (variante ciano), `istruction_AI/Star/star-goldRed.png` (variante rossa)
> Frame Pencil (file `pencil-new.pen`): `star-goldBlue` (`bqUbp`) + `star-goldRed` (`k6tsiA`)
> Obiettivo: renderizzare **solo la forma stella a 4 punte** con **sfondo trasparente (alpha)**, senza frame bianco, senza ombre esterne.

---

## 1. Cosa si vede — lettura visiva immediata

Entrambe le immagini mostrano **una sola stella-sparkle a 4 punte**, perfettamente centrata, vista frontale ortografica (nessuna prospettiva), su fondo bianco puro `#FFFFFF`.

- **Variante 1 — goldBlue / ciano:** corpo in metallo liquido azzurro-ciano, highlight quasi bianchi, ombre petrolio quasi nere.
- **Variante 2 — goldRed / rossa:** identica forma e identico pattern di riflessi, ma palette rossa: highlight rosa-latte, midtone rosso vivo, ombre bordeaux/nero-rossastro.

A colpo d'occhio sembrano due “gocce di mercurio” a forma di stella. La somiglianza è totale tranne l'hue: **stessa geometria, stessa luce, stesso pattern di turbolenza** — cambia solo il set di 4 colori dello shader.

Screenshot live dei frame Pencil (`TakeScreenshot(["bqUbp","k6tsiA"])`) confermano identità 1:1 con i due PNG: stesso contour scuro perimetrale, stessa “goccia” chiara centrale, stesse striature sulle punte.

---

## 2. Forma — geometria della stella 4 punte

### 2.1 Silhouette 2D

- **Tipologia:** stella sparkle 4 punte (north / east / south / west), asse verticale dominante.
- **Orientamento:** punta a nord a ore 12, perfettamente verticale. Simmetria verticale + orizzontale (simmetria d'ordine 4 approssimata, con allungamento verticale).
- **Proporzioni (stima da PNG 1:1 e frame 521×521):**
  - Estensione verticale: ~90–92% del box (punte N/S quasi toccano il bordo con ~4–5% di padding).
  - Estensione orizzontale: ~82–86% del box (punte E/O leggermente più corte / più rientrate delle N/S).
  - Rapporto punta lunga / punta corta ≈ 1.08–1.12 : 1.
  - Larghezza alla “vita” (valli concave tra le punte): ~28–32% della lunghezza totale.
- **Apici:** estremamente affilati, angolo al vertice < 12–15°, senza arrotondamento visibile (raggio ~0–1 px a 1000 px). Le punte S ed E/O mostrano un filo di lama quasi tagliente.
- **Valli interne (concavità tra una punta e l'altra):** angolo rientrante ~85–95°, **smussato con raccordo morbido** (fillet ~12–20 px a 1000 px). È questo raccordo a dare l'aspetto “gonfiabile” e non tagliente al centro.
- **Bordi:** dritti o leggermente convessi dai colli verso le punte; nessuna concavità secondaria, nessun frastaglio.

### 2.2 Volume 3D percepito

- **Corpo “inflated” / pillow:** centro rigonfio come un cuscino d'aria, spessore massimo al centro geometrico, rastremazione continua verso le 4 punte (effetto mongolfiera sgonfia verso le estremità).
- **Bevel:** bevel perimetrale molto morbido e largo (~6–10% della semi-larghezza locale), senza spigoli hard-surface. Il passaggio faccia→fianco è continuo (G2).
- **Cresta centrale:** leggera cresta longitudinale verticale + orizzontale appena accennata, più visibile sulle punte N e S dove la luce crea una lama speculare lineare.
- **Spessore:** non c'è estrusione laterale visibile (vista frontale pura); lo spessore è suggerito solo dal shading, non da facce laterali.

### 2.3 Composizione scena attuale

- Singolo oggetto centrato in frame quadrato.
- Frame Pencil: `560×560` esterno (`fill: #FFFFFF`, `clip: true`, `layout: none`), inner `521×521` offset `x:19,y:19` (`element-star_LOGO.svg`).
- Padding bianco attorno alla stella: ~19 px per lato a 560 px (~3.4%) + ulteriore aria interna perché le punte non toccano il box path.
- Nessun testo, nessuna ombra portata, nessun ground-plane, nessun riflesso esterno. Per il render finale **eliminare il fondo bianco → alpha 0**.

---

## 3. Colori — palette misurata

Lo shader usa **4 stop colore** (`u_color1 → u_color4`, dal più scuro al più chiaro). Stessi parametri per entrambi, cambia solo il set.

### 3.1 Variante ciano (star-goldBlue / `bqUbp`)

| Ruolo | Uniform | Valore | Dove appare |
|---|---|---|---|
| Ombra profonda / edge | `u_color1` | `#001417` (nero-petrolio) | Fascia perimetrale continua, interno valli N, lama su punta S, striature laterali |
| Mezzatinta scura | `u_color2` | `#0d6b7a` (petrolio) | Transizione bordo→centro, alone attorno alla fascia scura, pancia punte E/O |
| Tinta viva | `u_color3` | `#3bdcff` (ciano elettrico) | Corpo principale, pance laterali, code delle striature |
| Highlight | `u_color4` | `#d9f7ff` (azzurro ghiaccio quasi bianco) | Goccia centrale, velature sulle punte, filo lama sui bordi luce |

Percezione: highlights ~ `#FFFFFF → #E6FBFF`, mid ~ `#2BD4F5 → #7EE9FF`, deep ~ `#06333D → #001417`.

### 3.2 Variante rossa (star-goldRed / `k6tsiA`)

| Ruolo | Uniform | Valore | Dove appare |
|---|---|---|---|
| Ombra profonda / edge | `u_color1` | `#000000` (nero puro) | Stessa fascia perimetrale, valli N, lama S |
| Mezzatinta scura | `u_color2` | `#7a140d` (bordeaux bruciato) | Transizione, pancia punte |
| Tinta viva | `u_color3` | `#ff3b3b` (rosso vivo) | Corpo principale |
| Highlight | `u_color4` | `#ffd9d9` (rosa-latte) | Goccia centrale, velature |

Percezione: highlights ~ `#FFFFFF → #FFEDED`, mid ~ `#FF6B6B → #FF2E2E`, deep ~ `#4A0F0A → #000000`.

### 3.3 Nota sui file `StarGoldBlue.tsx` / `StarGoldRed.tsx`

I due componenti React nella stessa cartella sono **placeholder** (SVG `polygon` con `linearGradient` oro `#FFD700 → #4169E1` / `#FFD700 → #8B0000`, stroke `#D4AF37`). **Non corrispondono** al look chrome finale — il look reale è prodotto dallo shader Pencil sotto descritto. Non usarli come riferimento colore; tenerli solo come segnaposto dei nodeId `bqUbp` / `k6tsiA`.

---

## 4. Effetti — shader `mercury-shape.glsl`

Entrambi i path usano:

```
fill: { type: "shader", enabled: true, url: "images/mercury-shape.glsl", uniforms: {...} }
```

### 4.1 Uniforms identici (prova di stessa scena/luce)

```
u_speed: 0.82
u_gradientAngle: 198
u_scale: 1.387
u_turbAmp: 1.02
u_turbFreq: 0.997
u_waveFreq: 2.362
u_edgeDistance: 0.023
u_reflection: 0.64
u_contourStrength: 0.81
+ 4 colori (vedi §3)
```

Lettura effetto-per-effetto:

- **`mercury-shape` (metallo liquido):** riflessione ambientale distorta da turbolenza, tipica “cromatura bagnata”. Non è un PBR con HDRI nitido: le forme riflesse sono allungate e sciolte.
- **`u_scale 1.387`:** scala del pattern riflesso — valori >1 comprimono le bande, creando le striature fini sulle punte.
- **`u_turbAmp 1.02 / u_turbFreq 0.997`:** ampiezza/frequenza del rumore che deforma il riflesso. Ampiezza ~1 = deformazione forte ma fluida (le “venature” a marmorizzazione visibili al centro). Frequenza ~1 = venature larghe, non granulosa.
- **`u_waveFreq 2.362`:** frequenza secondaria che crea le onde concentriche attorno alla goccia centrale.
- **`u_gradientAngle 198°`:** direzione del gradiente master (quasi verticale, 180° = top→bottom, +18° di tilt verso destra). Spiega perché la punta N è più chiara in alto e la S ha lama scura a destra.
- **`u_edgeDistance 0.023`:** distanza SDF dal bordo entro cui scatta l'edge-darkening. Valore piccolo = fascia scura sottile e tagliente, aderente al perimetro (quello che vediamo come “contorno inchiostro”).
- **`u_contourStrength 0.81` + `u_reflection 0.64`:** intensità del contorno scuro (0.81 = molto marcato, quasi nero) e peso della riflessione (0.64 = medio-alto, il corpo resta leggibile senza bruciare).
- **`u_speed 0.82`:** se animato, velocità di scorrimento del mercurio; nel fermo immagine fissa la fase della turbolenza (stessa fase nei due PNG → stessa “impronta” di pieghe).

### 4.2 Tipo di shader (da `scripts-and-shaders.md`)

Shader WebGL1 fragment (`#version 100`) con convenzioni Pencil: uniforms annotati `@color/@default/@label/@range`, probabile uso di `@sdf` (signed distance del path stella: canale R = distanza con segno, GB = gradiente) per edge/contour e di `@resolution` per normalizzare `gl_FragCoord`. È uno shader **SDF-driven**: il bordo scuro e il gonfiore seguono la distanza dal contorno, non una texture.

---

## 5. Riflessi e lighting — analisi dettagliata

1. **Fascia scura perimetrale continua (“ink edge”):** anello scuro di ~4–10 px (a 1000 px) che segue tutto il perimetro interno, più spesso nelle valli concave N-E / N-O e lungo il fianco destro della punta S. È il tratto distintivo: fa sembrare la stella ritagliata da una lastra di cromo con bordo smussato che riflette una zona scura dello studio. In termini PBR: environment con striscia nera orizzontale riflessa dal bevel radente.
2. **Hot-spot centrale a goccia / lacrima:** area lattiginosa a forma di goccia rovesciata (punta della goccia verso il basso) al centro-alto, colore `u_color4` quasi piatto, con alone ondulato. È il riflesso di una softbox grande sopra la camera. Attorno, anello di transizione con doppia onda (chiara→viva→chiara) che dà l'effetto “latte versato”.
3. **Striature longitudinali sulle punte:** su ogni punta, 2–3 bande chiare/scure parallele all'asse della punta (es. punta E: banda ciano viva al centro, filetti scuri ai margini; punta S: lama bianca a sinistra, lama nera a destra). Derivano dalla compressione del riflesso dove la superficie si assottiglia.
4. **Zone di compressione turbolenta:** a destra del centro (tra centro e punta E) una chiazza più satura di `u_color3` con bordo ondulato — è il “nodo” della turbolenza (stessa posizione in entrambe le varianti → stesso seed).
5. **Micro-riflessi:** nessun grain, nessun sparkle puntiforme; superfici perfettamente lisce (roughness apparente 0.05–0.15 al centro, 0.25–0.35 nella fascia scura dove il riflesso si allarga).
6. **Direzione luce presunta:** key softbox grande a ore 12–13, leggermente a destra (spiega goccia centrata ma lama scura più marcata a destra della punta S); fill molto debole da basso (le punte S/E non sono mai nere piatte, conservano velatura chiara); nessun rim da dietro (nessun filo luce esterno al perimetro).
7. **Contrasto:** altissimo ma senza clipping: i bianchi non bruciano (max ~250, non 255 piatto tranne 1–2 px), i neri restano leggibili (luminanza min ~4–10, non crush totale). Gamma morbida sulle transizioni chiare, dura sul passaggio contour→corpo.

---

## 6. Somiglianza tra le due varianti — verdetto

- **Geometria: identica al pixel** (stesso path `element-star_LOGO.svg`, stessa scala 521px). Sovrapponendo i due PNG in differenza, i bordi coincidono; cambia solo l'hue.
- **Lighting / pattern: identici** (stessi 9 uniforms numerici, stessa fase `u_speed`). Le pieghe della turbolenza, la forma della goccia, la posizione delle striature sono nello stesso punto.
- **Colori: swap 1:1** `petrolio→bordeaux`, `ciano→rosso`, `ghiaccio→rosa-latte`, `nero-petrolio→nero puro`. La variante rossa appare leggermente più contrastata perché `u_color1=#000000` è più profondo di `#001417`.
- **Conseguenza pratica:** basta **un solo modello / un solo materiale** con 4 slot colore per generare entrambe (e infinite altre varianti) — non servono due mesh.

---

## 7. SPEC di render — solo stella 4 punte su trasparente

### 7.1 Silhouette (obbligatoria)

- Ricreare path stella 4 punte con: 4 vertici cuspide (raggio 0), 4 valli concave con fillet 3–4% della lunghezza punta.
- Proporzioni target (box 1000×1000, centro 500,500):
  - N (500, 20) — S (500, 980)
  - E (930, 500) — O (70, 500) *oppure* E/O a 910/90 se si vuole rispettare il leggero accorciamento orizzontale osservato.
  - Valli a ~±160–180 px dal centro in diagonale (es. 500±170, 500±170) con raccordo Bézier, non angolo vivo.
- Chiusura perfetta, winding consistente, nessun self-intersect.

### 7.2 Rendering fedele (via shader Pencil / WebGL)

- Usare `images/mercury-shape.glsl` con gli uniforms sopra (§4.1). Per sfondo trasparente: `gl_FragColor.a = smoothstep` su SDF (dentro=1, fuori=0, AA 1–2 px), **non** compositare su bianco.
- Mantenere `u_edgeDistance 0.023`, `u_contourStrength 0.81`, `u_reflection 0.64`, `u_scale 1.387`, `u_turbAmp 1.02`, `u_turbFreq 0.997`, `u_waveFreq 2.362`, `u_gradientAngle 198`, `u_speed 0.82` (fermo) per replica 1:1.
- Palette: per nuova variante, sostituire solo i 4 colori mantenendo la gerarchia luminanza (ombra ~L5%, mezzatinta ~L25%, viva ~L60%, highlight ~L95%).
- Export: PNG 1024 o 2048 px, `alpha: true`, padding minimo 6% per lato (le punte sono a 1 px dal bordo: allargare il viewBox del 12% per evitare clipping dell'AA), nessun premultiplied artefatto su bianco.

### 7.3 Alternativa PBR (Three.js / Blender, se senza shader custom)

- Mesh: estrusione leggera della silhouette con bevel largo e segmenti alti (es. `bevelThickness 0.08, bevelSize 0.06, bevelSegments 8`), più displacement “pillow” (gonfiore centrale via vertex sculpt o normal-based inflation).
- Materiale: `metalness 1.0`, `roughness 0.08–0.15` (mappa: 0.08 al centro → 0.3 sulla fascia edge), `clearcoat 1.0`, `envMap` studio con una grande area bianca sopra + bande nere laterali per ottenere l'ink-edge.
- HDRI: studio bianco con 2 strisce scure verticali (simulano il contour). Ruotare HDRI finché la goccia chiara è al centro-alto e la fascia scura è continua.
- Tinta: `baseColor` bianca + `envMapTint` con i 4 colori, oppure `iridescence` leggera; più semplice: Act come cromo e colorare via `colorGrade` in post (curva che mappa luminanza→palette §3).
- Render: Cycles/Eevee o `MeshPhysicalMaterial`, film `transparent: true`, nessun piano, nessuna ombra, AA 8x, export PNG RGBA.

### 7.4 Checklist accettazione render

- [ ] Solo stella, zero pixel di fondo (alpha 0 fuori dal path, verificare con checkerboard)
- [ ] Punte N/S/E/O affilate, non arrotondate, non clippate
- [ ] Fascia scura perimetrale continua e nitida tutto attorno
- [ ] Goccia highlight centrale presente e lattiginosa, non bruciata
- [ ] Striature longitudinali visibili su tutte e 4 le punte
- [ ] Stesso pattern turbolento in ogni variante colore (non ri-seedare tra varianti)
- [ ] PNG 2048px pesato < 1.5MB, bordi senza alone bianco (decontaminate / straight-alpha corretto)

---

## 8. Riferimenti incrociati

- PNG alta ris: `star-goldBlue.png`, `star-goldRed.png` (questa cartella)
- Placeholder React (non finali): `StarGoldBlue.tsx` (`bqUbp`), `StarGoldRed.tsx` (`k6tsiA`)
- Frame Pencil: `star-goldBlue` 560×560 @ (2185,-744) → child `eiNS3` → path `mb0YB` | `star-goldRed` 560×560 @ (2805,-744) → child `ARjHk` → path `n0C6T`
- Shader: `images/mercury-shape.glsl` — uniforms §4.1

*File generato da analisi visiva diretta dei PNG + ispezione live dei frame Pencil (Get depth:2 + screenshot nodi).*
