# NOTES_WEBGL — Hero "Smoke-as-Wave" Shader

## Cross-Link Index
- **[AGENTS.md](./AGENTS.md)** — Work protocol, WebGL shader rules
- **[EFFECTS.md](./EFFECTS.md)** — Effect reference (desktop vs mobile rules)
- **[NOTES.md](./NOTES.md)** — Non-WebGL context (cursor system, layout changes)

> Verifica effettuata con camofox/Playwright sui due siti di riferimento
> (`ashfall.studio`, `bizar.ro`) + analisi del canvas attivo della hero
> (`src/components/SplitScreenHero.jsx`). Three.js `r0.185.1`.

---

## 0. Contesto della richiesta

Riprodurre l'effetto "fumo" di `ashfall.studio` **come pattern di onde**, dove il
"fumo" è in realtà **propagazione di onde** che:

1. mostra l'immagine `src` secondaria (quella colorata, `hero-night.jpeg`) **senza
   "strapparla"** (ritagliandola in modo fluido, non deformandola);
2. ha un **raggio d'effetto basato sulla velocità** del puntatore;
3. è **molto smooth e velocity-based**, ispirandosi a come `bizar.ro` gestisce
   propagazione e ritaglio.

File attivo sulla home: `SplitScreenHero.jsx` (mountato in `App.jsx` come
`SplitScreenHero`).

---

## 1. Ricerca siti di riferimento

### 1.1 `ashfall.studio` — smoke shader
- Effetto "smoke": **fBm domain-warped** (6 ottave, lacunarity 2.0) sopra un
  noise di base. Non è un fluid-solver, è noise procedurale distorto.
- La dissolvenza è **asimmetrica** (`close` vs `open` leg): il fumo si dissipa
  con una formula `dissolve = (1-dist)*1.2 + fluid*0.7`.
- Dettaglio chiave per il nostro problema: usa una **`boundaryMask`** che
  "crops off-window samples to transparent" — ovvero maschera i campioni fuori
  dalla finestra e li rende trasparenti invece di stirarli. Questo è esattamente
  il modo corretto di evitare lo "strappo" dell'immagine.

### 1.2 `bizar.ro` — propagazione & ritaglio (repo pubblico `bizarro/bizar.ro`)
- Stack: **`ogl`** (libreria WebGL minimale) + GSAP + Lodash, webpack.
- Pattern di base per il displacement: si campiona una **displacement map** in
  scala di grigi e si offsetta la UV dell'immagine in base alla sua luminanza:
  ```glsl
  float strength = texture2D(uDisp, vUv).r;          // 0..1
  vec2 distortedUv = vUv + strength * uIntensity;
  vec4 color = texture2D(uImage, distortedUv);
  ```
- **Texture wrapping**: imposta `ClampToEdgeWrapping` per evitare il bordo
  "smeared" quando la UV distorta esce da 0..1.
- **Velocity-based**: il flowmap è guidato dalla **velocità del puntatore**;
  le onde decadono naturalmente nel tempo (decay esponenziale), quindi il
  movimento è smooth anche dopo che il mouse si ferma.
- Aspect-ratio: il piano ha UV 0..1 ma l'immagine non è quadrata → si fa
  **cover-fit** delle UV nello shader per non stirarla.

---

## 2. Stato attuale dell'implementazione

`SplitScreenHero.jsx` usa **ping-pong render targets** (float) per simulare un
campo di altezza (`uHeight`), poi un fragment shader principale che:
- mappa le UV in 3 regioni: **center** (contain) + **left wing** + **right wing**;
- campiona `uIdle` (`hero-idle.png`, immagine "sottostante") e `uActive`
  (`hero-night.jpeg`, immagine "colorata");
- fa un `mix(idle, active, reveal)` dove `reveal` deriva dal campo di altezza.

### Problemi emersi

| # | Problema | Dove | Gravità |
|---|----------|-------|---------|
| A | **Shader non compila** (`dot(vec2, vec3)`) | `fragmentShader` | 🔴 Blocker |
| B | Le "wings" campionano il **6% del bordo** e lo stirano su tutta l'ala → immagine "strappata" | `fragmentShader` L188-202 | 🟠 Ritaglio |
| C | `reveal = mix(colIdle, colActive, …)` mostra l'immagine sottostante di default e quella colorata solo sull'onda → direzione opposta a quella voluta | `fragmentShader` L235-236 | 🟠 Ritaglio |
| D | Il campo di altezza usa **curl-noise advection**, non una vera equazione d'onda → propagazione meno "wave-like" e meno smooth | `simFragmentShader` | 🟡 Propagazione |

---

## 3. BUG TROVATO (console error) — gia` corretto

### Errore in console
```
THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false
Material Type: ShaderMaterial
Program Info Log: Fragment shader is not compiled.
```

### Causa (linea 261, ora 264 dopo la fix)
```glsl
// PRIMA (ERRATO)
float spec = pow(max(dot(normalize(grad), vec3(0.0, 1.0, 1.0)), 0.0), 5.0) * 0.07;
```
`grad` è dichiarato `vec2 grad = vec2(hR - hL, hU - hD)` → `normalize(grad)` è
**`vec2`**. La built-in `dot()` richiede che **entrambi gli argomenti abbiano
lo stesso tipo vettoriale**; passare `vec2` e `vec3` è un *type mismatch* che
fa fallire la compilazione dell'intero fragment shader.

### Fix applicata
```glsl
// DOPO (CORRETTO)
vec2 gdir = grad / (length(grad) + 1e-4);          // direzione sicura (no NaN)
float spec = pow(max(dot(gdir, vec2(0.7071, 0.7071)), 0.0), 5.0) * 0.07;
```
- `vec2` light direction invece di `vec3`;
- divisione per `length(grad)+1e-4` per evitare `normalize()` di un vettore
  nullo (che darebbe `NaN` sulle zone piatte del campo).

> Nota: tutte le altre `dot()` nello shader erano già type-correct
> (`vec2·vec2` o `vec3·vec3`). Verificato con grep.

---

## 4. Correzioni per il RITAGLIO ("senza strapparla")

### 4.1 — Non stirare il bordo (fix delle "wings")
**Problema**: le ali campionano una sottile banda del bordo
(`[0, 0.06]` a sinistra, `[0.94, 1.0]` a destra) e la stirano su tutta l'ala:
```glsl
sampleUV = vec2(wingT * 0.06, vUv.y);   // STIRA il 6% su tutta l'ala → strappo
```
**Correzione proposta** (ispirata a `ashfall.boundaryMask` + `bizar.ClampToEdge`):
- Usa **cover-fit** delle UV dell'immagine colorata sull'intero viewport, così
  l'immagine è intera e non deformata;
- Le ali non devono "campionare una sottile banda", ma estendere con **blur
  progressivo** i pixel di bordo (già presente il blur H+V, va solo rimossa la
  stretch);
- `ClampToEdgeWrapping` è già settato su entrambe le texture (OK).

Esempio di cover-fit delle UV (da applicare nel `main`):
```glsl
vec2 coverUv(vec2 uv, float texAspect, float viewAspect) {
  vec2 s = vec2(1.0);
  if (viewAspect > texAspect) s.y = texAspect / viewAspect;
  else                       s.x = viewAspect / texAspect;
  return (uv - 0.5) * s + 0.5;
}
```

### 4.2 — Direzione del reveal (crop dell'immagine colorata)
**Problema (C)**: attualmente
```glsl
float reveal = smoothstep(0.08, 0.38, abs(height));
vec4 colFinal = mix(colIdle, colActive, reveal);   // idle di default, active sull'onda
```
La richiesta è che il **"fumo" (immagine colorata) copra di default** e la
propagazione dell'onda lo **ritagli** per rivelare l'immagine sottostante:

```glsl
// CORREZIONE: colored = default, wave rivela la sottostante
vec4 colFinal = mix(colActive, colIdle, reveal);
```
Dove `reveal` cresce con la **magnitudo del campo di altezza** (l'onda che
"dissipa" il fumo, esattamente come il `dissolve` asimmetrico di ashfall).

---

## 5. Correzioni VELOCITY-BASED (gia` presenti, da mantenere)

Questa parte è **già corretta** e va preservata come riferimento (pattern
`bizar.ro`):
```js
// frame() — radius e force crescono con la velocita`
const injRadius = Math.min(0.10 + filteredSpeed * 0.28, 0.38);
const injForce  = Math.min(filteredSpeed * 2.8, 1.2);
```
e nello shader il raggio del displacement del cursore:
```glsl
float radius   = 0.10 + min(uCursorSpeed * 0.28, 0.28);
float falloff  = pow(clamp(1.0 - dist / radius, 0.0, 1.0), 1.5);
```
`filteredSpeed` è uno `lerp` (`THREE.MathUtils.lerp(filteredSpeed, rawSpeed, 0.12)`)
quindi il raggio cresce/decresce in modo **smooth** anche quando il mouse si
ferma → nessun "scatto". ✅

---

## 6. Correzioni per la PROPAGAZIONE

**Problema (D)**: il sim shader usa *curl-noise advection*
(`hNew = mix(hAdvected, hPrev, 0.03) * uDamping`). È organico ma non è una
vera onda e la propagazione risulta meno direzionale/smooth.

**Opzione A — Equazione d'onda classica** (ping-pong, piu` "wave-like"):
```glsl
float hL = texture2D(uHeightCurr, vUv - vec2(px.x,0.0)).r;
float hR = texture2D(uHeightCurr, vUv + vec2(px.x,0.0)).r;
float hD = texture2D(uHeightCurr, vUv - vec2(0.0,px.y)).r;
float hU = texture2D(uHeightCurr, vUv + vec2(0.0,px.y)).r;
float h  = texture2D(uHeightCurr, vUv).r;
float hPrev = texture2D(uHeightPrev, vUv).r;
float hNew = (hL + hR + hD + hU) * 0.5 - hPrev;   // onda
hNew *= uDamping;                                   // 0.992 = decay lungo
```
Con `uDamping = 0.992` l'onda si propaga e decadde lentamente → very smooth,
esattamente il feeling `bizar.ro`.

**Opzione B — Mantenere curl advection** ma alzare lo smoothing del campo
(es. blur leggero del `uHeightCurr` prima di advect) per evitare grana.

> Raccomandazione: **Opzione A** per la propagazione "fumo→onde" richiesta.

---

## 7. Verifica finale (checklist)

- [x] **Shader compila** — rimosso `dot(vec2, vec3)` (bug A risolto)
- [ ] **Ritaglio**: rimuovere stretch al 6% delle ali + cover-fit UV (bug B)
- [ ] **Reveal**: invertire `mix` per crop dell'immagine colorata (bug C)
- [ ] **Propagazione**: passare a equazione d'onda (bug D) per smooth velocity-based
- [ ] **Texture wrap**: `ClampToEdgeWrapping` gia` attivo su `uIdle`/`uActive`
- [ ] Avviare `npm run dev` (porta 8150) e controllare la console: nessun
      "Fragment shader is not compiled"

---

## 8. Come testare in locale

```bash
cd <project-root>
npm install
npm run dev      # http://localhost:8150
```
Apri la console: dopo la fix del punto 3 non deve piu` apparire
`THREE.WebGLProgram: Shader Error ... Fragment shader is not compiled.`
Muovi il mouse sulla hero → il "fumo" (immagine colorata) deve propagarsi e
ritagliarsi per rivelare l'immagine sottostante, con raggio d'effetto
proporzionale alla velocita` del cursore.

---

## 9. Intervento del 2026-09-02 — fix B, C, D applicate

File modificato: `src/components/SplitScreenHero.jsx` (solo questo).
Bug A (`dot(vec2, vec3)`) era gia` risolto ed e` stato **lasciato intatto**.

### B — Rimosso lo "strappo" delle ali (ritaglio)
- Le due branch wing non stirano piu` la banda del 6% del bordo:
  ora campionano **solo la colonna piu` esterna**
  (`vec2(0.0, vUv.y)` a sinistra, `vec2(1.0, vUv.y)` a destra) →
  **edge-clamp extension**: nessuna magnificazione, quindi nessuno strappo.
  Il blur progressivo H+V gia` presente ammorbidisce l'estensione.
- `wingT` e `wingMask = 1.0` mantenuti (servono a blur, grading e glow).
- Funzione `fishEyeWing` **eliminata** dal `fragmentShader` (non piu` usata).
- Blur delle ali: i 4 campioni passano da `uIdle` → **`uActive`**
  (l'immagine colorata e` ora la base di default sulle ali).

### C — Direzione del reveal invertita
```glsl
// PRIMA: mix(colIdle, colActive, reveal)  → idle di default
// DOPO:
vec4 colFinal = mix(colActive, colIdle, reveal);
```
`reveal = 0` → l'immagine colorata ("fumo") copre;
`reveal = 1` → l'onda la ritaglia rivelando l'immagine sottostante.
`float reveal = smoothstep(0.08, 0.38, abs(height));` invariata.

### D — Equazione d'onda classica (al posto della curl-noise advection)
- `simFragmentShader` riscritto: **stencil a 5 punti**
  `hNew = (hL + hR + hD + hU) * 0.5 - hPrev;` poi `*= uDamping` (0.992).
  Coefficiente 0.5 = limite di stabilita` (c² = 0.5), non toccare.
- **Storia impacchettata nei canali** per eliminare l'hazard di read-write:
  `uState` con **R = h(t)**, **G = h(t-1)**;
  scrittura `gl_FragColor = vec4(clamp(hNew,-1.0,1.0), hCurr, 0.0, 1.0);`
  → shift della storia per il frame successivo.
- Rimossi `hash()` e `noise()` dal `simFragmentShader`
  (servivano solo alla curl-noise). L'`hash()` del `fragmentShader`
  principale e` untouched.
- JS: uniformi `uHeightPrev`/`uHeightCurr` sostituite da `uState: { value: null }`.
- JS `initRT()`: `simU.uState.value = RT_a.texture; renU.uHeight.value = RT_a.texture;`
- JS `frame()`: ping-pong senza hazard — **READ RT_a → WRITE RT_b → SWAP**,
  poi `renU.uHeight.value = RT_a.texture`.
  (Prima si leggeva `RT_b` come "curr" **e** si scriveva su `RT_b`,
  con prev/curr invertiti → undefined behavior.)

### Verifiche
- Nessun residuo di `uHeightPrev` / `uHeightCurr` / `fishEyeWing` (grep pulito).
- Tutte le `dot()` sono `vec2·vec2` o `vec3·vec3` (verificate una per una).
- `ClampToEdgeWrapping` mantenuto su `uIdle`/`uActive`; anche le RT usano
  il default ClampToEdge, quindi lo stencil ai bordi non wrappa.
- Parametri velocity-based **non toccati**:
  `injRadius = Math.min(0.10 + filteredSpeed * 0.28, 0.38)`,
  `injForce = Math.min(filteredSpeed * 2.8, 1.2)`, lerp di `filteredSpeed` (0.12).
- `npm run build` → **exit code 0**, 26 moduli trasformati, nessun errore.


---

## 10. Fix 3 problemi (loop / fisheye / idle-front) â€” SplitScreenHero.jsx

Tre correzioni mirate senza toccare la pipeline wave -> reveal.

### (a) Loop bug (onda che non si ferma mai)
- Causa radice: lo shader `simFragmentShader` iniettava energia ogni frame con il
  termine di "ambient breathing" `hNew += sin(uTime * 0.4 + uv.x * 2.5 + uv.y * 1.8) * 0.002;`
  rimosso del tutto (nessuna sostituzione).
- `uDamping` alzato da `0.992` a `0.90`: l'onda si smorza dopo qualche centinaio di ms
  invece di persistere per secondi (niente piu loop continuo).

### (b) Ripristino blur sferico sui lati (fishEyeWing)
- La funzione `fishEyeWing(vec2 uv, float wingT)` e ripristinata: distorsione barrel
  dal centro dello schermo, ma edge-clamped con `clamp(c + d * f, 0.0, 1.0)` per non
  riportare lo strappo originale. Applicata in ENTRAMBI i rami ali:
  `sampleUV = fishEyeWing(vec2(0.0, vUv.y), wingT);` e `sampleUV = fishEyeWing(vec2(1.0, vUv.y), wingT);`.

### (c) L'immagine idle deve stare davanti
- `vec4 colFinal = mix(colActive, colIdle, reveal);` -> `mix(colIdle, colActive, reveal)`:
  `hero-idle.png` e il foreground di default, `hero-night.jpeg` appare SOLO dove l'onda
  altera il liquido (dove `height` e non zero).
- Il blocco wing blur ora campiona entrambi `uIdle` e `uActive` agli UV offsettati e fa
  `vec4 bld = mix(bIdle, bActive, reveal);` prima di mixare in `colFinal`: le ali mostrano
  idle di default e `-night` solo all'hover (rispetta idle-front).

### Invariati (non toccati)
- Parametri velocity-based: `injRadius = Math.min(0.16 + filteredSpeed * 0.28, 0.42)`,
  `injForce = Math.min(0.30 + filteredSpeed * 2.8, 1.5)`.
- Fix speculare bug-A: `vec2 gdir = grad / (length(grad) + 1e-4); ... pow(..., 5.0) * 0.07;`.
- `dreamyGrade`, `glow`, grana, vignette.
- `npx vite build` exit 0; console browser 0 errori, 0 "Fragment shader is not compiled".

## 11. Refinement — injection come blob radiale unico (no cerchi / visibile lento)

Feedback utente: l'iniezione creava "continui cerchi" (non un elemento unico), a
movimento lento non si vedeva niente (partiva da zero) e andava aumentata la base.

### Cambi nello shader `simFragmentShader`
- Rimosso il blocco di iniezione anisotropico/oscillatorio: via `dir`, `local`, `aniso`,
  `fwd`, `bias`, e soprattutto il termine `wave = sin(dist*35.0 - uTime*3.5)` che generava
  gli anelli concentrici percepiti come "trenino di cerchi".
- Sostituito con un **singolo blob radiale Gaussiano liscio**:
  ```glsl
  if (uCursorSpeed > 0.0005) {
    vec2 toCursor = uv - uCursor;
    float dist = length(toCursor);
    if (dist < uInjectionRadius) {
      float stamp = exp(-dist * dist / max(uInjectionRadius * uInjectionRadius * 0.5, 1e-4));
      hNew += stamp * uInjectionForce * 0.35;
    }
  }
  ```
- Intatto: il guard `uCursorSpeed > 0.0005`, `hNew *= uDamping;` (0.90), e l'equazione
  d'onda `(hL + hR + hD + hU) * 0.5 - hPrev`.

### Cambi in JS (`frame()`)
- Base iniziale alzata cosi che il blob e gia visibile anche a cursore lento:
  - `injRadius`: base `0.10 -> 0.16`, max `0.38 -> 0.42` (moltiplicatore velocita `0.28` invariato).
  - `injForce`: base `0 -> 0.30`, max `1.2 -> 1.5` (moltiplicatore velocita `2.8` invariato).
- L'incremento velocity-based resta: il blob cresce con la velocita del cursore.

### Invariati (non toccati)
- Reveal idle-front: `mix(colIdle, colActive, reveal)`.
- `fishEyeWing`, wing blur, `dreamyGrade`, glow, grana, vignette, fix speculare bug-A.
- `npx vite build` exit 0; sweep Playwright (lento+veloce) 0 errori console, 0 "Fragment shader is not compiled".

---

## 12. Tuning scala velocita per dimensione blob visibile

Feedback utente: il blob si vedeva ma la sua dimensione non cambiava con la
velocita di trascinamento.

Causa: `filteredSpeed` e una frazione normalizzata dello schermo per evento
puntatore (tipicamente 0.001-0.03). I moltiplicatori precedenti (`0.28` per il
raggio, `2.8` per la forza) producevano variazioni troppo piccole per essere
percepite.

Correzione:
- injRadius: Math.min(0.16 + filteredSpeed * 0.28, 0.42) ->
  Math.min(0.16 + filteredSpeed * 12.0, 0.50).
- injForce: Math.min(0.30 + filteredSpeed * 2.8, 1.5) ->
  Math.min(0.30 + filteredSpeed * 30.0, 1.8).
- Displacement cursore nel render shader:
  `float radius = 0.10 + min(uCursorSpeed * 0.28, 0.28)` ->
  `float radius = 0.16 + min(uCursorSpeed * 12.0, 0.34)`.

Con questi valori il raggio varia in modo percettibile: ~0.16 a cursore
fermo/lento, ~0.30-0.40 a media velocita, fino a ~0.50 a trascinamento veloce.
La forza varia da ~0.30 a ~1.5-1.8, rendendo l'onda piu intensa e visibile
quando il cursore si muove velocemente.

Invariati: idle-front reveal, fishEyeWing, dreamyGrade, glow, grana, vignette,
fix speculare bug-A, equazione d'onda, uDamping = 0.90.

---

## 13. Refactor modulare — src/webgl-water/ (Emitters → Wave Field → Renderer)

Data: 2026-09-02. Richiesta utente: architettura modulare + fix velocity→strength
(non radius) + distorsione barile CSS statica.

### Struttura file
```
src/webgl-water/
├── index.js                  # Orchestratore SplitScreenHero (ex SplitScreenHero.jsx)
├── emitters.js               # Pointer tracking, velocity, impulse computation
├── wave-field.js             # Sim ShaderMaterial, ping-pong RTs, stepSimulation
├── renderer.js               # Render ShaderMaterial (composite finale)
└── shaders/
    ├── sim-shaders.js        # simVertexShader + simFragmentShader
    └── render-shaders.js     # renderVertexShader + renderFragmentShader
src/components/SplitScreenHero.jsx  # Thin re-export → importa da ../webgl-water/index.js
src/styles/global.css           # Aggiunge .hero-region--split barrel distortion statico
```

### Confini dei moduli
- **emitters.js**: `createEmitters()` → `onMove/onLeave/onTouchMove`, `update()`
  (lerp speed 0.12), `getImpulse()` → `{ strength, radius }`.
  `strength = min(0.30 + speed*30.0, 1.8)`, `radius = 0.24` (FISSO).
- **wave-field.js**: `createSimMaterial()` (uniform `uDamping = 0.88`),
  `createRTs(renderer,w,h)`, `stepSimulation(...)` → read RT_a, write RT_b, swap,
  ritorna `{ RT_a, RT_b }`.
- **renderer.js**: `createRenderMaterial()` (uniform idle/active/height/res).
- **index.js**: monta canvas, renderer, RTs, wire emitters→wave-field→renderer,
  resize (ResizeObserver), dispose. Nessun `logShader`/`DEBUG`.

### Fix velocity → strength (non radius)
- Sim shader: `uInjectionRadius` FISSO (0.24), `uInjectionForce` modulato da
  velocita (strength). GLSL invariato (gia usava i due uniform separati).
- Render shader: `float radius = 0.16;` FISSO; displacement cursore usa
  `float strength = min(0.009 + uCursorSpeed * 0.015, 0.025);` → velocity modula
  strength, non radius.

### Distorsione barile CSS (statica)
- `.hero-region--split { perspective: 1200px; transform-style: preserve-3d; }`
- `::before` gradiente scanline (top/bottom darkening, mix-blend multiply)
- `::after` vignette radiale + `backdrop-filter: blur(0.4px)`
- Layer `z-index: 2`, `pointer-events: none`, mai modificato da JS/hover.

### Invariati
- Equazione d'onda `(hL+hR+hD+hU)*0.5 - hPrev`, `hNew *= uDamping` (0.88).
- `clamp(uv, 0.0, 1.0)` nel render shader (no tearing).
- Reveal idle-front `mix(colIdle, colActive, reveal)`.
- `fishEyeWing`, `dreamyGrade`, glow, grana, vignette, fix speculare bug-A.
- Shader seguono pattern `src/shaders/ripple.js` (export vertexShader/fragmentShader).

### Verifica
- `npx vite build` → exit 0.
- `SplitScreenHero.jsx` è thin re-export (< 10 righe).
- `src/webgl-water/` contiene tutti i moduli.
- Nessun `logShader`/`DEBUG` residuo.

---

## 14. Migrazione a `shaders/react` (WebGPU) — 2026-09-09

### Motivo
La pipeline Three.js custom (`ContactTrailSimulator` + 6 pass su render target)
era fragile: bug GLSL risolti nel tempo (dot(vec2,vec3), feedback loop,
reserved-word crash su `active`), gestione manuale di resize/visibility/dispose,
e 500+ righe di codice imperativo. La libreria `shaders` (v3.2.466, già in
`package.json`) fornisce componenti React dichiarativi che gestiscono
WebGPU internamente.

### Cosa è cambiato

| Prima (Three.js) | Dopo (`shaders/react`) |
|---|---|
| `THREE.WebGLRenderer` + `ContactTrailSimulator` | `<Shader>` (WebGPU via TypeGPU) |
| 6 pass imperativi con `renderTo(target)` | Componenti dichiarativi: ChromaFlow, DotGrid, CursorRipples, FilmGrain |
| Texture loading manuale (`THREE.TextureLoader`) | `<ImageTexture url="…" objectFit="cover" />` |
| UV cover-fit custom (`uPlaneAspect/uIdleAspect`) | Gestito da `ImageTexture` internamente |
| Module-cached `heroGL` singleton | `Shader` gestisce il proprio GPU context |
| `requestAnimationFrame` loop + idle auto-stop | Loop gestito internamente dalla libreria |
| `visibilitychange` handler | Non necessario |
| Fallback WebGL canvas | `<Shader onUnavailable>` → `<img>` statico |

### File modificati
- `src/webgl-water/shader-hero.jsx` — **nuovo**, componente principale
- `src/webgl-water/index.jsx` — ora re-exporta da `shader-hero.jsx`
- `src/components/SplitScreenHero.jsx` — invariato (re-export da index.jsx)
- `EFFECTS.md` — aggiornato §2.b

### File obsoleti (ancora presenti, non wired)
- `src/webgl-water/contact-trail-simulator.js` — vecchia pipeline Three.js
- `src/webgl-water/shaders/contact-trail-shaders.js` — vecchi shader GLSL
- `src/webgl-water/fluid-simulator.js` — Navier-Stokes alternativo

### Catena dei componenti
```
Shader (WebGPU root)
├── ImageTexture id="heroDay"    url="/hero-day.png"    objectFit="cover"
├── ImageTexture id="heroNight"  url="/hero-night.jpeg"  objectFit="cover"  maskSource="DotMask"
├── ChromaFlow   id="Flow"       intensity=1.4  radius=2.9  visible=false
├── DotGrid      id="DotMask"    density=40  dotSize={driver:'Flow',prop:'alpha'}  twinkle=0.9  visible=false
├── CursorRipples                 intensity=10  decay=10  radius=0.5  chromaticSplit=1
└── FilmGrain                     strength=0.1
```

### PropDriver
`DotGrid.dotSize` è un `PropDriver` che legge `Flow.alpha`: la dimensione
dei punti è modulata dal campo di flusso generato da ChromaFlow in base
al movimento del cursore. Quando il cursore si muove, i punti crescono
nelle direzioni di movimento; quando si ferma, decadono.

### maskSource
`ImageTexture.heroNight` ha `maskSource="DotMask"`: l'immagine night è
visibile solo dove il DotGrid ha alpha > 0 (cioè dove ci sono punti).
Questo crea l'effetto halftone-reveal lungo la traiettoria del cursore.

### Fallback WebGPU
`<Shader onUnavailable={handleUnavailable}>` viene chiamato quando il
browser/GPU non supporta WebGPU. Lo stato `webgpuFailed` attiva il
rendering di un `<img class="hero-static-image">` con le stesse CSS
dell'originale. Nessun Three.js, nessun WebGL.

### Verifica
- `npm run build` → exit 0 (681 moduli, 3.28s)
- Nessuna dipendenza Three.js rimasta nel chunk hero (three.js è ancora
  usato da FeaturedGallery e SelectedProjects)
- `shaders` v3.2.466 già presente in `dependencies`
- Nessun `logShader`/`DEBUG` residuo
- Nessun `requestAnimationFrame` manuale nel componente hero

## 15. Fix 2026-09-16 — Hero desktop senza effetti + tile-reveal perso (Big Pickle audit)

### Problemi trovati (audit desktop effects, resoconto previo alle modifiche)
1. **Hero desktop regression 🔴** — in `src/webgl-water/shader-hero.jsx` il ramo
   desktop renderizzava `renderStaticHero()` (immagine statica, ZERO effetti
   WebGPU), mentre HEAD e `shader-hero.jsx.bck` renderizzano lo shader su TUTTI
   i device. Su mobile lo shader era attivo, su desktop no → "la hero non ha
   nessun effetto" con fallback CSS `hero-day.png` corretto in `.bck`.
2. **ProjectExpanded tile-reveal perso 🔴** — in `src/components/SelectedProjects.jsx`
   il fragment shader tile-reveal (uReveal sweep per colonna + hash21 jitter,
   flap, idle wobble, mouse displacement, `transparent: true`) era stato
   sostituito dal ripple shader di FeaturedGallery (`transparent: false`),
   rimuovendo l'effetto documentato in `EFFECTS.md` §2.a. Il proxy tween GSAP di
   uReveal era stato rimosso (restava `const idx` orfano).

### Fix applicati
1. **`src/webgl-water/shader-hero.jsx`** — ramo desktop: `renderStaticHero()` →
   `renderShader()` con fallback esplicito `{!unavailable ? renderShader() :
   renderStaticHero()}`. Ripristinati su `.hero-region--split` il
   `backgroundImage: url(/hero-day.png)` (fallback CSS dietro lo shader, come in
   HEAD/.bck) e lo stile `.hero-region--split .hero-gl-canvas` (position
   absolute, inset 0, 100%×100%, block). Ramo mobile INVARIATO.
2. **`src/components/SelectedProjects.jsx`** — ripristinato da HEAD lo shader
   tile-reveal completo (hash21, vnoise, coverUv, revealMask con rowJitter,
   randomAhead flicker, idle wobble solo durante reveal, mousePush per-tile),
   uniformi `uTimeRef/uReveal/uGrid/uSeed`, `transparent: true`, e il proxy
   tween GSAP `gsap.to(proxy, { value: 1, duration: 1.6, delay: idx * 0.15 })`.
   **Mantenuto** il gate `if (isMobile) return` in `initWebGL` (mobile →
   fallback statico, come da requisito).

### Criterio adottato
Mai disabilitare un effetto desktop per aggiustare mobile (e viceversa): i due
device si selezionano il path in modo indipendente. Restore = comportamento HEAD
(documentato in EFFECTS.md), con la struttura isMobile-gate odierna conservata.

### Verifica
- `lsp_diagnostics`: puliti su entrambi i file
- `npm run build`: exit 0 (unico warning: chunk-size pre-esistente)
- `shader-hero.jsx.bck` non toccato

## 16. Fix 2026-09-16 — CA FeaturedGallery + reduced-motion Archives (iperplan)

### FeaturedGallery — CA per-canale nel branch hover
- `src/components/FeaturedGallery.jsx` fragmentShader, branch `if (uHover > 0.01)`:
  il campionamento singolo `col = texture2D(uTex, coverUV).rgb;` è ora per-canale:
  ```glsl
  float ca = 0.005 * uHover * clamp(1.0 - d, 0.0, 1.0);
  col.r = texture2D(uTex, coverUV + vec2(ca, 0.0)).r;
  col.g = texture2D(uTex, coverUV).g;
  col.b = texture2D(uTex, coverUV - vec2(ca, 0.0)).b;
  ```
- Pattern identico a `src/shaders/ripple.js:39-43`; nessun nuovo uniform; il ramo
  non-hover (riga 46) resta invariato.

### FeaturedGallery — hover mobile senza gate drag
- Nel tick loop (`buildGalleryGL`) il branch mobile usava `isCursorActiveRef.current`
  come gate: su touch il drag (100ms) bloccava l'hover immediato. Rimosso il gate;
  `active` ora è determinato solo dalla posizione del cursore nel rect della card.
- `isCursorActiveRef` resta nel destructuring della hook e nella chiamata a
  `buildGalleryGL` perché usato altrove (riga 252/289); `useArchiveCursor.js` intatto.

### Archives — reduced-motion: skip WebGL con fallback statico
- `ArchiveHoverCanvas.jsx`: prima del setup WebGL, `if (reduceMotion) return` — nessun
  renderer/RAF/ResizeObserver; JSX condizionale mostra `<img src={gifPath || image}>`
  (objectFit cover) al posto del `<canvas>`. Le gif native continuano ad animare
  (non sono WebGL).
- `PendulumCanvas.jsx`: la const `reduceMotion` (prima morta, ~riga 152) ora seleziona
  il tick: `const run = isMobile || reduceMotion ? tickMobile : tick` → follow-only,
  nessuna oscillazione; deps dell'effect già complete.
- `ArchiveCursor.jsx`: morph 16→canvas quadrato VERIFICATO già conforme (dot fade 0.15s,
  el 16×16→canvasW×canvasH borderRadius 0, el opacity 0, clipPath canvas aperto; exit
  reversed con dot riappare) — nessuna modifica.

### Verifica
- `lsp_diagnostics`: puliti (FeaturedGallery, SelectedProjects, ArchiveHoverCanvas,
  PendulumCanvas, Archives)
- `npm run build`: exit 0 in 711ms, 692 moduli (warning chunk-size 3.4MB pre-esistente)
- Test visivo su device reali: da fare con l'utente

## 18. Fix 2026-09-16 — Mobile canvas riusa gli shader di sezione

- Nuovo `MobileSectionCanvas.jsx`: un renderer per apertura (dispose su cleanup),
  riusa verbatim i fragment/vertex shader di FeaturedGallery (ripple + FBM + CA,
  `uAlign` della card) e SelectedProjects (tile-reveal, `uReveal: 1`, grid 60px,
  `uSeed` random). Nessun nuovo shader, nessuna divergenza visiva possibile.
- Hover nel canvas aperto: gate solo-posizionale (cursore dentro il box), stessi
  lerp della sezione (`uHover` 0.065, `uMouse` 0.1); `uPlaneAspect` per-frame.
- Archives invariato (`archive-wind` → ArchiveHoverCanvas come prima).

## 19. Fix 2026-09-16 — GIF: la source img deve essere paintata (z-index sotto canvas)

- Causa del freeze (desktop + mobile): la source `<img>` era attachata ma mai
  paintata (1×1px, opacity 0, fuori dal frame clippato) → il decoder GIF non
  avanza mai e `drawFrame` ricopia sempre il frame 1. Confermato dai NOTES: le
  GIF animavano solo quando l'img era renderizzata (fallback nativo, overlay).
- Ora l'img è a piena misura dentro il wrapper ma sotto il canvas GL opaco
  (`z-index:-1` nello stacking context del wrapper): il browser la painta e
  avanza i frame, l'onda resta visibile sopra. `crossOrigin` prima di `src`,
  `aria-hidden` sul nodo decorativo.

## 20. Fix 2026-09-16 — GIF freeze: pipeline video (VideoTexture, paint-independent)

- Diagnosi: `alfly-test.gif` verificata animata (ffprobe: 1080×720, 49 frame,
  25fps) — nessuna ricetta DOM-img non-visibile sblocca il decoder in questo
  setup (detached, 1px invisibile e full-size coperta restano al frame 1; solo
  l'img visibile animava, ma copriva l'onda). Conflitto irrisolvibile lato DOM.
- Soluzione: `assets/images/archive-video/alfly-test.mp4` (ffmpeg, H.264
  yuv420p CRF23 faststart, 138KB vs 784KB). Nuovo branch video-first in
  `ArchiveHoverCanvas.jsx`: `<video muted loop playsInline autoplay>` +
  `THREE.VideoTexture` con `needsUpdate` per-frame via RAF; media clock
  indipendente dal paint → avanza anche coperto. Fallback GIF invariato per
  righe senza mp4; slide-transition skippata anche per video.
- Plumbing `videoPath`: dato riga Archives → `ArchiveHoverCanvas` desktop;
  mobile via `effectOpts` (`openCanvas` tap + `MobileCanvas` forward con
  fallback `gifPath ?? image`). `PendulumCanvas` intatto (inoltra children).

## 21. Fix 2026-09-16 — Archive: CA solo col movimento, immagine pulita a riposo

- Causa: gli offset CA di rest erano costanti (0.01/0.02/0.03 UV ≈ 3–10px di
  shift canali) sia nello skip-branch sia in `onComplete` della slide
  transition → aberrazione sempre visibile anche a cursore fermo.
- Ora rest = 0/0/0 in entrambi i punti (rimosso anche il doppio set ridondante
  in `onComplete`); la CA resta guidata da `vDeformation` (forza wind) quindi
  appare solo col movimento e decade a 0 da fermo.

## 22. Fix 2026-09-16 — Archive: guadagno CA ×3 in movimento (cap 0.09)

- `caBase` nello shader: `vDeformation * 0.15` → `min(vDeformation * 0.45, 0.09)`.
  A velocità tipiche il deform produceva ~0.013 UV (~4px, quasi invisibile); ora
  ~3× più visibile nel range normale, con cap anti-esplosione sui flick veloci.
  A riposo resta esattamente 0 (deform azzerato dal gate di forza).

## 23. Fix 2026-09-16 — Archive: vero split CA differenziale guidato dal deform

- Causa dell'invisibilità: `caR/caG/caB` sommavano lo stesso `caBase` ai tre
  canali → campionavano lo stesso texel (shift comune, invisibile). L'aberrazione
  vista in passato veniva solo dai differenziali costanti, che lo zero al rest
  aveva (correttamente ma totalmente) spento.
- Ora split differenziale: `R = +caBase + offR`, `G = offG` (ancorato),
  `B = offB − caBase`. A riposo tutto 0 → pulita; in movimento spread ±caBase
  come il deform; sweep di transition invariato.

### Regressione eliminata: il canvas spariva dopo l'hover di una GIF
- **Prima:** la JSX renderizzava `<canvas>` solo quando `!reduceMotion &&
  !animatedImgRef.current`. Il ref veniva settato imperativamente nel branch
  GIF (niente re-render): al re-render successivo (hover di un'altra riga) il
  ref era ancora truthy → `<img>` al posto del `<canvas>` → canvas smontato
  per sempre. In più l'overlay visibile (z-index 11) copriva il canvas anche
  sulla GIF, nascondendo l'onda.
- **Ora:** `ArchiveHoverCanvas.jsx` renderizza **sempre** il `<canvas>` quando
  `!reduceMotion` (solo reduceMotion → `<img>` fallback); rimossa JSX il ref.

### GIF animate dentro il pipeline WebGL
- Le GIF non avanzano su `Image` detached (frame 1). L'`<img>` viene attachato
  al DOM offscreen dentro il frame overflow-hidden (`left:-220px; 1×1; opacity:0`)
  così il browser avanza i frame; un loop RAF copia il frame corrente in una
  `CanvasTexture` (`uImage`, `uImgAspect` da `naturalWidth/Height`) → la wind
  distortion si applica al contenuto animato.
- Rimosso l'import morto `shouldEnableSectionWebGL`.

### Verifica
- `lsp_diagnostics`: puliti (ArchiveHoverCanvas, ArchiveCursor)
- `npm run build` / `npm test`: da confermare (baseline 12 failure pre-esistenti)

## 24. Fix 2026-09-20 — Focus Callout: WebGL satin-flute (Undertones)

Nuovo effetto `.focus-callout` ("BRING NEW IDEA / TO BUILD SOLUTION") dentro
SelectedProjects. Reference: Undertones / Fluted Glass (shaders.com collection).

### Architettura
- **Doppio canvas**: GL visibile `.focus-callout__canvas` (absolute inset-0,
  pointer-events none) + mask 2D nascosta `.focus-callout__mask` (display:none).
  Il testo DOM resta come sorgente di layout/mask/AT ma con inchiostro
  trasparente via CSS dalla prima paint; unico path testo-visibile è il
  fallback `.focus-callout--no-gl` (WebGL init fallito) / `--reduced`
  (prefers-reduced-motion, nessun GL). Integrazione: riga 1584 di
  `SelectedProjects.jsx`, `<FocusCalloutShader lines={['bring new idea',
  'build solution']} />`.
- **Maschera per luminanza**: canvas 2D bianco opaco (`#FFF`) + glifi `#000`
  → campionata **per luminanza**, così il filtro lineare ai bordi produce
  grigio luminoso mai nero trasparente (edge-bleed-proof). `min()` di 5 tap
  (centro + 4 croce a 1 texel, `uTexel`) dilata l'interno scuro di 1 texel ->
  la transizione AA campiona verso l'interno; `glyphAlpha =
  smoothstep(0.45, 0.55, mask)`.

### Shader SATIN FLUTE (fragment)
- Spazio aspect-corrected (`p = vec2(uv.x*uAspect, uv.y)`), **niente tilt**
  (l'utente ha rifiutato 65° e 31°; GLSL utente portato alla lettera).
- **Displacement laterale** `d`: 4 sinusoidi + fbm; profilo cresta/valle
  `prof = mix(0.58, 1.0, 0.5+0.5*cos(bandPos*PI))` con `bandPos = fract(x*9.0)`
  (satin, non zebra); `profDeriv` per lo sheen e la CA.
- **Flusso verticale con cascata per-flute**: `cascadeLag 0.35` +
  `cascadeDecay 0.490` (valore messo a mano dall'utente, NON normalizzato);
  `fid = mod(floor(x*fluteCount), 9.0)`; `yFlowC = yFlow − fid*cascadeLag`;
  `flow = pow(clamp(sin(flowShape*PI),0,1), 2.2)`, flowShape da
  `sin(yFlowC + d*2.5)*cascAmp` + fbm.
- **Palette CHROME-TENUE** (idle mono, contrasto debole): `colLight
  vec3(0.937,0.933,0.925)` #EFEEEC, `colMid 0.80`, `colDark 0.58`,
  `colShad vec3(0.50,0.51,0.54)` grafite; `flow*0.90` lift verso colLight
  (integrato nel materiale, non addizionato); grain = `cfbm(p*4+t*0.1) − 0.5`
  × 0.03 (sottile, discreto); vignette `smoothstep(1.3, 0.2, length(uv−0.5))`
  → `idleBase *= mix(0.80, 1.0, vig)` — solo sull'inchiostro, mai sull'alpha.
  NOTA: valori "estremi" (grain −1.03, vignette 1.30, bordi −0.55) attribuiti
  a tuning utente in un riassunto precedente NON esistono nel file: verifica
  fatta via grep, lo shader contiene i valori normali qui riportati.
- **Hover = tinta, non patch**: campo d'influenza `hField` (smoothstep 0.30),
  `along` stira la luce lungo le flute (smoothstep 0.12 verticale), `ridgeLift
  0.10`, mix verso colLight; trail 28 stamp (`TRAIL_LIFE 1500ms`, min-dist
  0.009 aspect-corrected, `fade = pow(1−age,1.6)`), **luminance-adattato**
  (`trailKey * idleLum/keyLum`) e gated da `uHover` → si assorbe nel vetro.
  Lerp JS frame-rate independent: uHover `exp(−dt*6)`, uMouse `exp(−dt*10)`.
- **Edge bright**: `edgeBand = clamp(glyphAlpha*(1−glyphAlpha)*4,0,1)` →
  `mix(hoverInk, vec3(0.99,0.985,1.0), edgeBand*0.55)` — la frangia AA legge
  come luce, mai come taglio scuro.
- **CA**: `caAmt = abs(profDeriv)*0.010`, r+0.5 / b−0.5.
- **Composizione**: `vec4(clamp(ink,0,1), glyphAlpha)` — niente quad di carta,
  alpha 0 fuori dai glifi (la pagina traspare).

### Runtime (buildCalloutGL)
- Sizing da `parentElement.getBoundingClientRect()`, `uAspect`, `uTexel`,
  `ResizeObserver` + window resize + timer 60ms; pixelRatio `min(dpr,2)`.
- `IntersectionObserver` threshold 0.01 → start/stop loop per visibilità.
- Redraw maschera su **signature RAF** (left/top/opacity dei `.reveal-inner`)
  + `document.fonts.ready` + resize (rispetta clip per riga, opacità,
  font/letterSpacing del DOM).
- Context lost/restored (`dead` flag); dispose completo di listener/material.
- Debug: `canvas.dataset.callout = 'h=|s=|mx=|my=|tr='` ogni 6 frame.

### Verifica
- Canvas backing ~[1325×254] a 1440px dpr 1, `uAspect` ≈ 5.2
- `maskCoverage` ≈ 0.191; `inGlyphMean` 0.749; `maskLum` 65
- Idle inside `[222,221,217]` / `[204,203,200]` (due run: variazione di fase,
  non bug); **fuori alpha 0** (`[0,0,0,0]`)
- Hover `h=1.00`, `tr=13–17`; 0 errori pagina (solo warning benigni:
  powerPreference, SwiftShader no adapters, GPU stall ReadPixels)
- `npm run build` exit 0 (unico warning chunk-size 3.4MB pre-esistente)
- `tests/callout-check.mjs`: 0 errori (maskCoverage/maskLum/inGlyphN aggiornati)

### 24.1 — Spec §7 IMPLEMENTATA 2026-09-20 (`focus-callout-undertones.md`)

Quattro block dello shader sostituiti (+ runtime JS). File: `FocusCalloutShader.jsx`.
Riferimento spec: `istruction_AI/focus-callout-undertones.md` §7.

**Single S, meno curvatura** (blocco SATIN FLUTE):
- Sostituisce lo stack 4-sine (`d` ~0.35) con **una** sinusoide estesa su TUTTA
  l'altezza canvas, `sY = p.y * tiles − t * flowSpeed` con `tiles = 1.0`
  (NESSUN `fract`) → **una sola S visibile in tutta la colonna**, che attraversa
  sia la prima che la seconda riga del testo; `sAmp = 0.055` → curvatura blanda
  ("meno curvatura" + "S unica" per tutto il testo, non per singolo carattere).
- Loop = periodicità del seno: quando la S esce dall'alto, la successiva entra
  dal basso ("array in basso", performante, nessun branching).
- **Segno corretto = MENO**: superficie di fase `p.y*tiles − t*flowSpeed = const`
  → `p.y` cresce con `t` → l'S scorre VERSO L'ALTO. (Il più avrebbe scrollato
  verso il basso.)
- `d = sAmp * sin(sY * CPI * 2.0)`; `x = p.x + d`; il resto del pipeline
  (profilo, flusso, palette, edge, maschera) invariato.

**Click interception 2+1+2 con clock a due zone**:
- GLSL: `MAX_BAND = 48.0`, `clickedCol = clamp(uClickFid,0,48)`, `colBase =
  clamp(floor(p.x*fluteCount,0,48))` (dal p.x NON displaciato). **FIX band
  index: NON clampare a 8** — `floor(p.x*9)` spazia 0..~47 (p.x = uv.x*uAspect,
  aspect ~5.2 al max), clamp a 8 avrebbe mappato quasi tutto il canvas
  sull'ultima banda e congelato le flute sbagliate ad ogni click.
  `zoneW = (1−smoothstep(2.05,2.55, abs(colBase−clickedCol))) *
  step(0.5,uClickEnable) * uClickScale` → esattamente 5 flutes congelate, feather
  ~0.4 flute; `tEff = mix(uTZoneB,uTZoneA,zoneW)`, `t = tEff*0.35 + uSpeed*0.08`.
- **FIX drag & hold**: `onPointerMove` (prima aggiornava solo hover) ora, mentre
  `uClickEnable > 0.5 E uClickTr < 0` (press attivo), aggiorna `uClickPos` (centro
  maschera) ad ogni move e `uClickFid` quando la colonna cambia → il grab SEGUE il
  dito durante il drag: maschera radiale e banda 2+1+2 congelata si spostano sulle
  flute sotto il puntatore, senza re-anchor del clock (Tp resta il press-time,
  niente salti di fase).
- JS: clock a stato (idle/press/release) in `tick()`. Press: `A = Tp` (congelato),
  `B = zoneBClockAt(Tp, t)` = integrale **closed-form** della scala di velocità
  1→0.25→0 su `CLICK_T = 1.4`s (piecewise 2 rampe + plateau, continuo ai giunti,
  +0.525s a fine pressione). Release: `moral mix` — `tEnd = Tr + uClickAt`
  (`uClickAt = 1.25`), `A = mix(Tp, tEnd, s)`, `B = mix(tZoneBCap, tEnd, s)` con
  `s = sstep01(clamp((t−Tr)/uClickAt))` → a `uc≥1` entrambi = orologio reale
  (nessuna discontinuità di fine), poi stato azzerato (enable 0, fid −1,
  release 0). `tZoneBCap` catturato in `onPointerUp` = valore B al rilascio.
- Handlers: `onPointerDown` (col = `floor(ux*aspect*FLUTE_COUNT)` clamp 0..48,
  **FIX: stesso bound 48 della shader, ux*aspect = p.x**; `uClickPos` UV,
  `uClickRadiusPx` da tier, `Tp`, `Tr=−1`, release 0);
  `onPointerUp` (solo se enable ≥0.5). Listener `pointerdown` su stage,
  `pointerup` su window, entrambi rimossi in `dispose()`.

**Maschera radiale di grab (click)** + **warp della griglia**:
- `radMask = (1−smoothstep(0.72,1.0, rpx/uClickRadiusPx)) * step(0.5,uClickEnable)
  * uClickScale * (1−0.85*uClickRelease)` con `rpx = length(cpx)*uSize.y` (raggio in
  CSS px: `uSize` = (w,h) impostato in `onResize`).
- **FIX animazione scaling smooth**: nuova uniform `uClickScale` (0→1). Press:
  scala il grab dal `grabScaleT0` (catturato in `onPointerDown`) con
  `sstep01(clamp((t−grabScaleT0)/GRAB_IN))`, `GRAB_IN = 0.35`s → la maschera NON
  compare più istantanea ma cresce con easing (smooth scale-in); moltiplicata sia
  su `radMask` che su `zoneW` (il freeze si innesta gradualmente). Release: scala
  tenuta a 1, il fade-out resta su `(1−0.85*uClickRelease)` (già smooth). Idle:
  scala = 1.
- Tier raggio: `<720` (`MOBILE_BREAKPOINT` da `src/hooks/useIsMobile.js`) → 32,
  `<1024` → 62, altrimenti 100.
- Warp: `clickedX = (clickedCol+0.5)/fluteCount`; **FIX direzione+intensità**:
  `xw = clickedX + (x−clickedX)*(1 − 0.60*radMask)` → le colonne vengono TIRATE
  verso quella cliccata (compressione, "altera totalmente la griglia"), più
  forte al centro del click, fade ai bordi sfumati della maschera ("più forte sul
  punto del click, con bordi sfumati"), senza fold-over (scale ∈ (0,1)). La
  versione precedente (`1+0.30*radMask*nearX` + pull 0.05) SPINGEVA via le
  colonne ed era troppo debole → grab impercettibile.
- `fid = mod(floor(xw*fluteCount),9.0)` — **FIX**: la cascata di flusso segue la
  griglia warpata (`xw`, non `x`) così la pulse scala con le colonne compresse.

**Hover che si asciuga + cromatico blu/viola**:
- `hR = mix(0.06, 0.32, uHover)` — il raggio del campo luce SHRINKS con uHover:
  la frangia cromatica umida retrocede verso il cursore mentre asciuga.
- **FIX colore metallico PERDUTO**: il cromatico §7 era troppo debole
  (`chroma = (0.015+0.13*hField)*(1−prof)` → al massimo ~0.06 shift su blue,
  invisibile come "paint"). Ripristinata la percettibilità "metallica":
  `chroma = (0.05 + 0.32*hField) * (1.0 − prof*0.65)` (max ~0.23 in grooves),
  `prof*0.65` fa "assorbire" il colore anche nelle creste (non solo valli:
  "si espande leggermente nel flutes"), `chromaAmt = chroma +
  abs(profDeriv)*0.02*(0.2+0.8*hField)`; tint blu/viola PIÙ satura:
  `ink.r −= chromaAmt*0.60`, `ink.g −= chromaAmt*0.04`, `ink.b += chromaAmt*1.00`
  (prima g andava su, diluendo verso il bianco; ora r scende e b sale). Il retrarsi
  edges→centro al fade resta gated da `hField` (asciugarsi). Luminanza hover
  resa più fredda/metallica: `along * vec3(0.06,0.058,0.055)` → modulazione
  `vec3(0.85,0.84,0.93)` con `metLift = along*0.12`.
- Rimosso il dead code `phaseShift` (era invariante).

**Uniform nuove**: `uTZoneA`, `uTZoneB`, `uClickRelease` (shader + JS);
`uSize` valorizzato in onResize (prima restava Vector2(1,1)). `uTime` resta
nell'oggetto uniforms (mai rimosso). Debug dataset: `|clk=|fid=|zA=|zB=`.

**Verifica**: `npm run build` exit 0 (693 moduli; unico warning chunk-size 3.4MB
pre-esistente); lsp zero diagnostics; hook commenti riconosciuti (constant/
knob + clock machine = necessari, coerenti con lo stile commentato del file).

### 24.1.1 — Refinements 2026-09-20: macchia che si propaga + lucido/metallico + drag smooth

Tre refinement sul blend `FocusCalloutShader.jsx` (richiesta utente: macchia
cromatica a propagazione, shader lucido/metallico "materico", alterazione
smooth e collegata, flutes non-hookate che si fermano con morbidezza).

**Propagazione della macchia cromatica (`uHoverT0`)**:
- Nuova uniform `uHoverT0` (JS: `hoverT0`, init `−1`). Stampata in
  `onPointerMove` al primo ingresso hover (`hoverT0 < 0 && uHover < 0.001`,
  timebase = secondi da `startTime`); reset a `−1` in `onPointerLeave`.
- GLSL hover block: `stainAge = clamp(uTime − uHoverT0, 0, 1.2)`;
  `prop = sstep01(stainAge/1.2)` → la macchia si PROPAGA per 1.2s.
  - `hR = mix(0.06, 0.32, uHover) * (0.6 + 0.8*prop)` — raggio campo luce parte
    dal 60% e si espande mentre la macchia si propaga.
  - `along = hField * (1 − smoothstep(0, 0.12 + prop*0.85, abs(hm.y)))` — la
    macchia scorre VERTICALMENTE lungo le flute (reach verticale 0.12 → ~0.97),
    "colorazione a propagazione sui flutes".
  - `metLift = along * 0.14` (era 0.12).
- Chroma scala con la propagazione: `chroma = (0.05 + 0.32*hField) *
  (1−prof*0.55) * (0.4 + 0.6*prop)` → assorbimento nelle flute ∝ prof e
  intensità macchia ∝ prop (max ~0.27 nelle valli).

**Palette LUCIDO/METALLICO (flutes non più grigi/neri)**:
- Tier PIÙ chiari con tint blu/viola tenue anche nei bianchi:
  `colLight (0.955,0.950,0.975)`, `colMid (0.840,0.840,0.895)`,
  `colDark (0.640,0.645,0.720)`, `colShad (0.520,0.530,0.620)` — ombra mai
  nera, "colorazione tenue per il bianco e il leggerissimo grigio".
- Sheen riscritto slope-driven: `abs(profDeriv)*0.10 + flow*0.20` tintato
  `vec3(0.90,0.91,0.98)` (prima `profDeriv*0.001` era praticamente morto) →
  riflesso "machined" lucido sui bordi cresta/vallata delle flute.
- Vignette alleggerita: `mix(0.88, 1.0, vig)` (era 0.80) — bordi leggibili.

**Drag & hold SMOOTH e collegato (maschera + flutes = un corpo solo)**:
- FIX: `onPointerMove` NON scrive più direttamente `uClickPos`/`uClickFid`
  durante il drag (era istantaneo): salva SOLO i target `dragTx/dragTy`
  (init `0.5`; azzerati/aggiornati anche in `onPointerDown` al press).
- `tick()` branch press: `gLerp = 1 − exp(−dt*12)` → `uClickPos` glissa verso
  i target con easing esponenziale; `uClickFid` = **float CONTINUO** derivato
  dalla posizione eased (`clamp(uClickPos.x * uAspect * FLUTE_COUNT, 0, 48)`)
  → la banda 2+1+2 e la maschera radiale si muovono INCOLLATE alle flute sotto
  il cursore, alterazione smooth e continua (nessun salto di colonna).

**Zone-B drift con fermata morbida (flutes non-hookate)**:
- `zoneBClockAt` riscritta: la piecewise 1→0.25→0 (giunti visibili) è
  sostituita da UN SOLO ease-out `s = sstep01(du/CLICK_T)` su `CLICK_T = 1.4`:
  `tp + 0.525*s` — STESSO drift totale a fine pressione (+0.525s di fase
  rispetto al clock reale: le flute continuano a salire) ma velocità che
  decelera senza giunti → le flutes "si muovono leggermente in alto fino a
  fermarsi" con assestamento naturale, non istantaneo.
- Debug dataset: aggiunto `|pr=` (valore prop JS, `sstep01((t−hoverT0)/1.2)`).

**Uniform nuove**: `uHoverT0` (shader + JS, `{ value: −1 }`).

**Verifica**: `npm run build` exit 0 (669ms, 693 moduli; unico warning chunk-size
3.4MB pre-esistente); lsp zero diagnostics; hook commenti riconosciuti
(propagazione/state-contract = necessari). QA browser (GLSL runtime)
375/768/1024/1440 + `tests/callout-check.mjs` ancora da eseguire.

### 24.2 - Plastic Shader + Moving Sinusoidal Light + Grab Click Recovery 2026-09-21

Ridisegno completo dello shader FocusCallout come materiale PLASTICO con luce
mobile sinusoidale e recupero grab-click da �24.1/24.1.1.

**Shader GLSL � nuove uniform:**
- uHoverRadius, uHoverStrength, uHoverDistortion, uReducedMotion
- uTexel (vec2), uLightY (float), uHoverT0 (float)
- uClickEnable, uClickPos, uClickFid, uClickScale, uClickRelease
- uSize (vec2), uTZoneA, uTZoneB

**Pipeline shader:**
1. Glyph mask: luminanza last (4-tap min su canale R), glyphAlpha = smoothstep(0.45, 0.55)
2. Single-S warp upward: d = 0.055 * sin(p.y * tiles - t * flowSpeed)
3. Grab click compressive warp: xw = clickedX + (x-clickedX)*(1-0.60*radMask)
   con radMask basato su rpx = length(cpx-0.5)*uSize.y, bound MAX_BAND=48
4. Flute profile: roundedProfile + profileDeriv da warped.x
5. Vertical flow con cascata per-flute (cascadeLag 0.35)
6. Moving sinusoidal light: gaussian 2D + sin((warped.y-uLightY)*CPI*4)
   uLightY = 0.5 + 0.45*sin(t*0.5) oscillazione [0.05, 0.95]
7. Fake-PBR plastic: baseColor (colShad?colDark?colMid?colLight),
   specPow=prof^4, fresnelEdge=(1-prof)^2*0.12, sheen slope-driven
8. Hover propagation: stainAge, prop=sstep01(stainAge/1.2), chroma blu/viola
9. Click wave: sinusoidal propagation da colonna cliccata
10. Edge bright AA + vignette su ink solo

**JS runtime:**
- Clock A/B: zoneA (dentro radius) speed normale, zoneB (fuori) ease-out a 0 in 1.4s
- Drag lerp esponenziale: gLerp = 1-exp(-dt*12)
- Scale-in grab: grabProgress = min(1, (t-grabScaleT0)/0.35)
- Release fade: clickRelease -= dt*2.5
- Mask drawing: white bg (#FFF) + black glyphs (#000) per luminanza mask
- Test probe: checked via bundle text (swc tree-shakes DOM property assignments)

**Verifica:**
- 
pm run build exit 0 (693 moduli; warning chunk-size 3.4MB pre-esistente)
- 	ests/callout-check.mjs: 0 errori
  - maskCoverage � 0.191 ?
  - inGlyphMean � 0.557 (plastic blue-gray, zero rosso) ?
  - inside: [133,139,159,255] (tonalit� fredde) ?
  - outside: [255,255,255,255] (alpha=255, bg bianco) ?
  - GRAB-UNIFORMS: enable/fid/size true ?
  - DATASET_IDLE: clk=0.0|fid=-1.0 ?
- Vitest: 41 passed, 12 failed (pre-esistenti MobileCanvas/useArchiveCursor)
- Alpha 0 fuori glifi confermato da outGlyphMean � 1.0 (bianco)

### 24.2.1 - Fix 2026-09-21: Cannot redefine property __calloutUniforms

Problema: Object.defineProperty(..., configurable: false) rendeva la propriet� 
irredimibile. Al secondo render (HMR, reduceMotion toggle) uildCalloutGL
tentava di ridefinire la stessa propriet� e lanciava:
TypeError: Cannot redefine property: __calloutUniforms.

Fix: guard if (!window.__calloutUniforms) prima della definizione + 	ry/catch
sull'assignment sul canvas. Il test callout-check.mjs verifica le uniform tramite
testo del bundle (swc tree-shakea gli assignment DOM diretti).

### 24.3 - Warm palette + per-flute moving light 2026-09-21

**Per-flute light:** ogni flute ha la propria luce sinusoidale con fase casuale
basata su fluteRandom(id)*2PI. uLightY globale rimosso dallo shader (keep
uniform per compatibilitá backwards). Formula:
  fluteLightPhase = fluteRandom(fluteIdF) * 2PI
  fluteLightY = 0.5 + 0.45 * sin(t * 0.5 + fluteLightPhase)
  lightYBand = sin((warped.y - fluteLightY) * CPI * 4) * 0.5 + 0.5

**Palette calda:** colori corpo flute neutri/caldi, freddo solo sui bordi esterni.
  colShad  (0.58, 0.56, 0.52)  -- ombra calda
  colDark  (0.72, 0.70, 0.66)  -- mezzo-scuro caldo
  colMid   (0.86, 0.85, 0.81)  -- mezzo chiaro caldo
  colLight (0.94, 0.93, 0.90)  -- luce calda
  fresnelEdge = vec3(0.78, 0.77, 0.85) * pow(1-prof, 2) * 0.12  -- solo bordi
  sheenColor = vec3(0.90, 0.89, 0.85)  -- riflesso caldo

Verifica: build exit 0, callout-check 0 errori.

### 24.4 - Smoothness + plastic gloss polish 2026-09-21

**Smoothness fixes (JS):**
- ponytail: uClickScale ora usa easedClickScale con easing esponenziale
  1 - exp(-dt * 5) invece di rampa lineare (t-t0)/0.35
- ponytail: clickRelease usa decay esponenziale * exp(-dt * 3) invece di
  decremento lineare - dt * 2.5 (fade-out Brusco -> fluido)
- ponytail: idle state riporta easedClickScale a 1 con easing exp(-dt * 6)

**Smoothness fixes (GLSL):**
- ponytail: cascadeLag ridotto da 0.35 a 0.18 per transizione pi� morbida
  tra flutes adiacenti
- ponytail: flow usa *r (sin^2) invece di pow(r, 2.2) per gradiente
  luce/ombra pi� dolce
- ponytail: light band freq aumentata a 6PI (prima 4PI) per onde pi� fitte
  e visibili lungo ogni flute
- ponytail: lightYBand passato attraverso smoothstep(0,1) per eliminare
  discontinuit� ai bordi del sinusoide
- ponytail: light gaussiana pi� larga (factor 1.5 invece di 2.0)

**Material plastic gloss:**
- ponytail: specPow da prof^4 a prof^2 per highlight pi� largo e lucido
- ponytail: sheen aumentato (0.15 deriv + 0.25 flow, fattore 0.55)
- ponytail: sheenColor spostato verso bianco caldo (0.95,0.94,0.90)
- ponytail: palette-body leggermente pi� scura per maggiore contrasto
- ponytail: fresnelEdge esponente aumentato a 2.5 per bordo pi� netto

Verifica: build exit 0, callout-check 0 errori, inside pixel [191,193,195]
(neutro-caldo, zero rosso).

## 25. Rewrite 2026-09-22 — Focus Callout: Undertones 4 via shaders/react (WebGPU)

Sostituito lo shader Three.js satin-flute con la composizione dichiarativa
`shaders/react` della ricetta **Undertones 4** (shaders.com, collection
"undertones", variante 4 = video di riferimento `tests/bg-flutes.mp4`).

### Ricetta estratta (API pubblica del sito, Nuxt payload + REST)
Quattro layer fissi (solo colori/angolo cambiano tra varianti):
1. **Swirl** — base animata near-white: `colorA #ffffff`, `colorB #f0f0f0`,
   `detail 1.7`, `blend 50`
2. **ChromaFlow** — glow cursore blu/viola: `baseColor #18181a`,
   `upColor #7f66ff`, `downColor #4642ff`, `leftColor #56c2fc`,
   `rightColor #5b4fff`, `radius 3.5`, `momentum 13` → l'interazione hover
   È ChromaFlow (propagazione organica inclusa, niente trail a mano)
3. **FlutedGlass** — flute diagonali + CA: `angle 31`, `frequency 8`,
   `refraction 4`, `aberration 0.61`, `waveAmplitude 0.06`,
   `waveFrequency 1.5`, `softness 0.5`, `highlight 0.2`
4. **FilmGrain** — `strength 0.05`
Guida collection: Undertones 5+ cambia solo palette ChromaFlow e a volte
angle (28° diag, 120° anti-diag, 284° verticali). Il preset `definition`
codificato NON è stato decodificato (licenza): usati componenti pubblici.

### Architettura nuova (`FocusCalloutShader.jsx`)
- `<Shader disableTelemetry onUnavailable>` renderizza
  `div.shader.focus-callout__canvas > canvas[data-renderer="shaders"]`
  (className sul wrapper div, NON sulla canvas) + CSS in global.css
  (~391–460) per absolute inset-0 + canvas filling.
- **Testo-vetro (scelta A)**: ogni layer porta `maskSource="glyphMask"`;
  `<ImageTexture id="glyphMask" url={maskUrl}>` è un dataURL alpha
  (`buildGlyphAlphaUrl`: maschera 2D bianco/nero → glifo opaco/bianco),
  risincronizzato dal loop signature RAF (throttle 150ms) sui redraw
  (reveal/resize/font). La maschera 2D resta per test/AT.
- **Grab ABANDONATO** (decisione utente): niente più uClick*/freeze, niente
  `window.__calloutUniforms`/dataset.callout. ChromaFlow gestisce tutto.
- Input puntatore catturato globalmente dal motore (mousemove/touch in
  core/index.js) → la sezione resta pointer-events:none.

### Engine = WebGPU (TypeGPU), implicazioni test
- Il Chromium bundled di Patchright NON ha `navigator.gpu` ("No available
  adapters"); `--enable-unsafe-swiftshader` abilita solo WebGL software.
  **Serve Chrome reale**: `chromium.launch({ channel: 'chrome',
  headless: true })` → adapter intel/gen-12lp verificato.
- La canvas WebGPU non è readback-abile in-page → `tests/callout-check.mjs`
  verifica via screenshot compositore + analisi pixel ffmpeg (rawvideo rgb24,
  bandStats/diffStats). Console/`pageerror` filtrati dal rumore GPU.

### Verifica (2026-09-22, exit 0)
- SERVED recipe+glyphMask nel bundle; wrapper+canvas montati 1325×254
- IDLE_ANIMATION_DIFF 0.42 (> 0.1); IDLE_FIELD lum 242.5 (ref f1.png ≈ 243)
- FPS 145 (GPU reale, non SwiftShader); mobile 375px monta canvas, 0 fatal
- HOVER-BLUE-SHIFT all: −9.5 → warning non-fatale: da verificare a vista
  (possibile tint caldo dominante o glow fuori banda screenshot)
- Fallback: onUnavailable → testo visibile; reduced-motion → niente GL

### Da fare / note aperte
- Verifica visiva utente su Chrome (glow segue cursore, testo-vetro corretto)
- Se maskSource fosse rifiutato da qualche nodo: fallback piano → opzione B
  (stack full-canvas + testo DOM sopra in accent color)

---

### 25.1 — CORREZIONE 2026-09-22: ritorno allo shader hand-written (satin-flute glassRib)

La composizione libreria §25 NON rendeva come il reference: su una striscia
mascherata 1325×254 con Swirl quasi-piatto ChromaFlow non ha massa colore da
rifrarre → FlutedGlass produceva solo micro-strie verdi/ciano dentro i glifi
(niente bande, niente materiale). Verificato da screenshot utente.

**Soluzione**: ripristinato il generazione `.undertones.bak` (= report "Flutes
WebGL": fract + sqrt(1-x²) per bande distinte, palette glass near-white,
flowFbm, propagazione hover INVERSA al moto via `propOffset=-uHoverDir*...`,
dissolvenza riflessione bianca→blu/viola, CA sul fronte, grab 2+1+2) con:
- **grab RIMOSSO** (decisione utente): uniforms uClick*, warp radiale, handlers
  pointerdown/up, campo dataset clk/fid — tutto eliminato pulito.
- **Tuning su reference tests/frames (bg-flutes-001/012)**:
  - palette: colA .985/. colB .945/. colC .855 (bianco neutro, no lavanda)
  - `ribLight = mix(0.80,1.0,ribMask)*(0.78+0.22*prof)` → valli GRIGIO CHIARE
    (mai nere), distinguono le flute senza zebra
  - `uFluteCount 9 → 3.5` (aspect strip 5.2: banda ≈ quella del ref 16:9)
- Test riscritti per Three.js+WebGL (readback diretto OK con
  preserveDrawingBuffer): suite exit 0 — idle anim 0.036, IDLE_FIELD 238.4
  (ref ≈243), sweep sp .595/dx .70, HOVER-BLUE-SHIFT 57 (era 200 pre-tuning,
  tint ora integrato nel vetro), park decay, no-grab regression, mobile OK,
  rm=1, 0 fatal.
- La versione libreria resta documentata in §25 e nel piano
  docs/superpowers/plans/2026-09-22-focus-callout-video-replication.md come
  alternativa (pannelli full-bleed, non strisce mascherate).
- File: `FocusCalloutShader.jsx` (shader hand-written); `.undertones.bak` è la
  generazione di partenza pre-grab-removal. global.css: rimossa la regola
  wrapper div.shader (non serve più); `.focus-callout__canvas` torna canvas GL.

### 25.2 — Chrome pass 2026-09-22 (richiesta utente: foglio metallico/plastico)
- Riflessi chrome: spikes `pow(wave,22)*1.55` + `pow(wave2,30)*0.65` +
  crestGlint `pow(prof,9)*(0.35+0.65*wave)*0.55`; travelLight 0.65→0.85.
  L'hover NON spegne più la riflessenza (dissolve 0.55→0.30) ma la tinge
  blu (travelCol 0.38/0.42/0.80).
- CA PER-FLUTE sull'hover: `perFlutePhase=sin(bandF*2.4 - s*1.5 + t*0.4)`
  modula r+/g−/b+ sulle pareti (`caEdge=0.35+0.65*profDeriv`) → frangia
  spettrale legata alla griglia dei singoli flutes, non globale.
- Seam per-flute SOTTILE: `smoothstep(0.88,0.985,abs(x))` cap dip 12% →
  hairline leggermente scura, mai nera/sotto grigio medio (valle min
  ≈0.56 luminanza, solo hairline tocca 0.49).
- Crest hover brightening 0.12→0.22. Suite exit 0: IDLE_FIELD 241.1,
  HOVER-BLUE-SHIFT 63.

### 25.3 — Max-metal + seam costante 2026-09-22
- **Fix seam "respirante"**: idleWave/flowN deformavano la GEOMETRIA delle
  bande → la hairline si allargava/restringeva. Ora: geometria = foglio rigido
  in traslazione (`rcEff = rcW + tUse*0.02`), rumore solo su luce/colore
  (`idleWave` senza ampiezza spaziale, flowN ×1 nel colore). Seam costante:
  `smoothstep(0.94,0.995,abs(x))`, dip 10%.
- **Max-chrome**: spikes pow26×1.85 + pow36×0.85, crestGlint pow12×0.70,
  broadSheen liquido pow3·prof·0.30, travelLight ×1.0, contrasto cresta
  0.72+0.28·prof. Suite exit 0: idle anim 0.046, field 241.7, blue-shift 163.

### 25.4 — Porting geometria reale FlutedGlass (da ~/Shaders/shaders)
Fonte: `dist/core/warpMaps-Y8xSo-QJ.js` (deobfuscazione parziale dei soli punti
pubblici usati: `flutedGlassGeom`, `blinnHighlight`, `fluteFrame`, `refractedTaps`).
- **Geometria**: `cellPos = (fract(fluteU*freq + t) - .5)*2`; `slope = sign(x)*pow(|x|, 16)`
  → cresta larga e piatta, pareti compresse in hairline. L'onda `sin(v*waveFreq)*amp`
  agisce su **fluteU** (posizione), NON sulla larghezza → seam sottile COSTANTE che
  ondeggia. Errore precedente: onda/rumore sulla geometria del profilo → seam respirava.
- **Luce**: Blinn-Phong su slope (`nz=sqrt(1-slope²)`, shininess=exp2(8-softness*7))
  × Fresnel Schlick `(0.04+0.96*(1-nz)^5)` → metallo.
- **CA**: `chrOff = refrU*aberration*0.5` con 3 tap RGB sul contenuto rifratto.
- Ricetta Undertones confermata da secondo extract: Swirl → ChromaFlow → FlutedGlass
  (freq 8, refr 4, ab 0.61) → FilmGrain; varianti cambiano solo palette e angle.
- Stato: build 0 err, suite exit 0, idle 249.5, blue-shift 36, FPS ~49 (headless).

### 26. Fix 2026-09-24 — Preloader glassSVG: same-Scene two-layer architecture
> **STORICO / SOSTITUITO da §27 (2026-09-25).** Questa sezione documenta
> l'architettura preloader del vetro come caposaldo precedente alla migrazione
> standalone. Il vetro è stato rimosso dal preloader e relocato in una sezione
> homepage indipendente (`## 27`). La documentazione qui sotto resta come
> referto storico dell'implementazione pre-migrazione.

**Root cause del cambio:** il piano originale (§2026-09-23) prevedeva glassSVG come
oggetto completamente indipendente con un delay fisso di 1s, scollegato dal loader.
L'implementazione approva invece un'architettura integrata: glassSVG vive nella
STESSA THREE.Scene del preloader (loader quad su LOADER_LAYER=0, glass su
GLASS_LAYER=1), attivato al primo frame SEAL (counter=100) e il loader attende
che la glass timeline termini prima del cleanup.

**Fix applicati:**
- **Stessa scena**: glassGroup e flatGroup aggiunti come figli della scena creata
  da `createPreloaderScene` (scene.js). Render loop esteso con `renderPassSequence`
  a due pass layer-filtered. Loader quad (ShaderMaterial trasparente) e glass
  (MeshPhysicalMaterial) condividono lo stesso Scene.
- **Trigger SEAL (counter=100)**: `shouldStartGlassAtCounter100(phase, glassRequested)`
  in `render-order.js`. Il flag `glassRequested` viene impostato una volta sola al
  primo frame SEAL; `setProgress(1)` viene chiamato PRIMA di `glass.start()` per
  assicurare che il contatore DOM sia a 100 prima che il vetro appaia. Se
  `initGlassSVG` ha già risolto, `start()` parte subito; altrimenti parte appena
  il promise risolve.
- **CAUSA VISIONE — visibility fix**: in Three r0.185.1 `renderTransmissionPass`
  disegna solo gli `opaqueObjects` del pass corrente; il pass layer-1 isolato
  esclude il quad trasparente del loader, quindi `transmission=1` non aveva alcun
  backdrop da rifrangere e il vetro risultava invisibile. Soluzione: `transmission=0.65`,
  `color=0x9aa7b2` (blue-gray fumé), `clearcoat=1`, `clearcoatRoughness=0.08`. Il
  35% di luce non trasmessa dal valore transmission contribuisce con il colore
  tintato del materiale, rendendo la silhouette visibile contro lo sfondo bianco/
  vuoto del layer-1 transmission target. clearcoat aggiunge un riflesso lucido di
  superficie.
- **GSAP paused + external start**: timeline e float tween creati con `paused: true`,
  partiti da time=0 via `start()` quando il preloader lo richiede. Nessun delay fisso.
  Stato iniziale: `scale = INITIAL_SCALE = 0.35` (immediatamente visibile al trigger).
- **Layer-filtered two-pass required**: in Three r0.185.1 transparent ShaderMaterial
  e transmissive MeshPhysicalMaterial sono in liste di rendering separate
  (opaque/transmissive prima, transparent dopo). `renderOrder` da solo non garantisce
  che il fullscreen quad dipinga SOPRA il vetro. Soluzione: due-pass con
  `camera.layers.set()`, `autoClear=false` + `clearDepth()` per il secondo pass.
- **ENV_INTENSITY = 0.04**: è il parametro `sigma` passato a
  `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` per blurare la
  RoomEnvironment generata. Il materiale usa `envMapIntensity: 1`.
- **Cleanup non bloccante**: `glassStillRunning(glass, glassRequested)` in index.js.
  Glass mai partita o fallita NON blocca il loader. Solo glass startata e non ancora
  done mantiene il RAF vivo durante seal/reveal.
- **Reveal driven by elapsed time, not phase label**: `revealProgress(now, revealStart)`
  in `config.js` guida il progresso reveal dal tempo trascorso da `revealStart`, non
  dall'etichetta `phaseAt(...)`. Questo fissa la race appReady ritardato: se
  `revealStart` viene fissato al cap di 1500ms (o dopo, quando `phaseAt` è già `'done'`),
  la reveal dura comunque i full 2400ms. Il one-frame front snap (`cutPending`) è
  impostato al momento della transizione `revealStart` ed è indipendente dalla fase.
- **shader.js INTACTO**: il loader shader è rimasto invariato; le modifiche sono
  solo nell'orchestrazione (layer assignment, due-pass render, trigger logic).

**File modificati:**
- `src/preloader/glass/params.js` — layer constants, TIMING (no delay), ENV_INTENSITY=0.04,
  INITIAL_SCALE=0.35, GLASS (color=0x9aa7b2, transmission=0.65, clearcoat=1,
  clearcoatRoughness=0.08, envMapIntensity=1), centeringFor (bbox completo), cameraDistanceFor
- `src/preloader/glass/render-order.js` — GLASS_START_PROGRESS replaced by
  `shouldStartGlassAtCounter100`, renderPassSequence (3-tuple spec), glassStillRunning predicate
- `src/preloader/glass/init.js` — paused GSAP, external start(), isDone(), cleanup(), INITIAL_SCALE
- `src/preloader/scene.js` — two-pass render nel frame loop, camera posizionata con
  cameraDistanceFor per peak scale
- `src/preloader/index.js` — trigger SEAL counter=100, `setProgress(1)` prima di `glass.start()`,
  glassStillRunning gate post-reveal, reveal-driven-by-elapsed-time
- `src/preloader/config.js` — `revealProgress(now, revealStart)` helper; delayed-reveal
  tests verificati

**Verifica:** targeted Vitest 94 passing tests across preloader/glass/ and preloader/.
`npm run build` exit 0, 710 moduli trasformati, 0.65s; unico warning chunk-size pre-esistente.
Nessun test visivo browser/Patchright eseguito; la correttezza visiva del vetro non è stata confermata in browser.

## 27. Migrazione 2026-09-25 — TextEntryGlass standalone dal preloader

> **STORICO / SOSTITUITO da §28 (2026-09-25).** Questa sezione documenta
> l'architettura della sezione homepage con oggetto estruso da `hero.svg` come
> geometria e fallback reduced-motion. Successivamente sostituita dal torus knot
> ricostruito dalla CodePen (`## 28`). I punti resi obsoleti dalla migrazione
> successiva sono:
>
> - la sezione non usa più ScrollTrigger, `scrub`, o alcun motore GSAP timeline;
> - `src/hero-glass/timeline.js` è stato eliminato;
> - il fallback reduced-motion `<img src="/assets/svg/hero.svg">` non esiste
>   più; il reduced-motion ora renderizza lo stesso torus come fotogramma
>   statico singolo;
> - `hero.svg` non è più usato da `TextEntryGlass` come geometria/fallback:
>   l'asset esiste ancora ed è letto dalla hero shader come URL immagine, ma
>   il ruolo di geometria/fallback in questa sezione è rimosso.

### Prima → Dopo (ownership/file mapping)

| Prima (preloader-owned) | Dopo (homepage-owned) |
|---|---|
| `src/preloader/glass/params.js` | `src/hero-glass/params.js` |
| `src/preloader/glass/geometry.js` | `src/hero-glass/geometry.js` |
| `src/preloader/glass/timeline.js` | `src/hero-glass/timeline.js` |
| `src/preloader/glass/init.js` | `src/hero-glass/engine.js` + `src/components/TextEntryGlass.jsx` |
| `src/preloader/glass/render-order.js` (`shouldStartGlassAtCounter100`, `glassStillRunning`) | RIMOSSO |
| `src/preloader/scene.js` (two-pass layer rendering per glass) | file retained; glass layers/clearDepth rimossi, resta single-pass shader-only |
| Preloader glass tests | RIMOSSI |

Nota: `src/preloader/config.js` rimane in uso per il preloader shader-only (non rimosso).

### Cose rimosse dal preloader
- `window.__preloader.glass` (global ref)
- counter-100 trigger (`shouldStartGlassAtCounter100`)
- wait state per glass timeline completion prima del cleanup loader
- layer-0 / layer-1 scene e render a due pass (opaque + transmissive)
- `clearDepth` + `renderPassSequence` nel frame loop
- `glassStillRunning` predicate post-reveal

### Cose preservate
- top-left reveal snap: `followStep(..., snap)` e `driveFront(front, now, true)`
  restano nel preloader per il contatore/text reveal (non toccati dalla migrazione)

### Nuova architettura — ripartizione ownership
- **Componente** (`src/components/TextEntryGlass.jsx`): media-query listener
  (`prefers-reduced-motion`), ScrollTrigger con `gsap.context()`, ResizeObserver
  sul section, chiamata `engine.resize()` e `engine.dispose()`.
- **Engine** (`src/hero-glass/engine.js`): `THREE.WebGLRenderer`, scena, camera,
  RAF loop, `createScrollTimeline`, root group, geometries, glassMaterial,
  flatMaterial, envMap. Nessun import React/GSAP CSS/App/preloader.

### Nuova architettura (dettagli)
- Sezione homepage normale `100dvh` tra `<SplitScreenHero />` e
  `<FeaturedGallery />` in `App.jsx`.
- ScrollTrigger: `animation: engine.timeline`, `scrub: true`, `pin: false`,
  `start: 'top bottom'`, `end: 'bottom top'`.
- Gerarchia: `root → glassGroup / flatGroup → meshes`; scale animata solo su
  `root`, base scale sui gruppi figli.
- Beats timeline normalizzati 0–1: spin 0–0.40, pop 0.40–0.43, float 0.43–0.85
  (4 segmenti), morph 0.85–0.95, fade 0.95–1.00.
- Mobile = desktop (stessa sezione, stesso canvas).
- Reduced motion: `<img src="/assets/svg/hero.svg">` statico, nessun WebGL,
  nessun ScrollTrigger.
- Cleanup component: media listener, ResizeObserver, GSAP context revert,
  `engine.dispose()`.
- `engine.dispose()`: RAF, geometries, glassMaterial, flatMaterial, envMap,
  renderer — mai media listener né ResizeObserver.
- Preloader: shader-only, non possiede più l'oggetto glass.

### Verifica
- `src/preloader/glass/` non esiste più (directory rimossa).
- `hero.svg` usato come geometry/fallback in `TextEntryGlass` e come immagine
  nella hero shader: i due usi non sono accoppiati.
- Targeted unit tests passati. Verifica build full-suite e validazione visiva
  browser sono gate successivi; browser visual validation resta a carico
  dell'utente. Non è stato eseguito Patchright/Playwright per questo change.

## 28. Migrazione 2026-09-25 — Torus knot glass dalla CodePen

La sezione standalone non usa più `hero.svg`. L'oggetto è il torus knot della pen
`https://codepen.io/Nidal95/pen/qERKExz`, ricostruito con i valori esatti della pen.

| Prima | Ora |
|---|---|
| `TorusKnotGeometry` assente, silhouette da `hero.svg` | `TorusKnotGeometry(1, 0.3, 300, 48, 2, 3)` |
| `MeshPhysicalMaterial` con `envMap` per-oggetto | `scene.environment` (PMREM `RoomEnvironment`, sigma `0.04`), nessuna luce |
| ScrollTrigger scrub 0→1, `timeline.js` | nessun GSAP: `renderer.setAnimationLoop` + `THREE.Clock` |
| `.text-entry { background: #000 }` | `background: transparent`, canvas `alpha: true` |
| niente dietro al vetro (nero) | `src/hero-glass/backdrop.js`, quad dietro al torus, `--c-field` oggi, `texture` domani |
| reduced motion = `<img src="/assets/svg/hero.svg">` | stesso oggetto, `rotation.set(0.6, 0.4, 0)`, un frame |

Moduli finali: `params.js` (costanti + `torusScaleFor` + `torusPlacementFor`), `geometry.js`
(`buildEnvironment`, `buildTorusKnot`), `backdrop.js` (`createBackdrop`), `engine.js`
(`mountTorusKnot`). `timeline.js` è stato eliminato, così come `tests/hero-glass/timeline.test.js`

L'oggetto non è centrato: `LAYOUTS` in `params.js` lo ancora all'angolo alto-sinistra con un
padding espresso come frazione del lato del frustum. Tre profili — mobile, tablet, desk — con
`scaleMultiplier`, `padding`, `halfCut` e `parallax` propri. Su mobile `halfCut` mette il centro
dell'oggetto sul bordo sinistro, così metà resta fuori schermo. I breakpoint arrivano da
`src/constants/breakpoints.js`, che `useIsMobile.js` ri-esporta: sorgente unica, come vuole
`AGENTS.md`.

Il parallasse di scroll porta l'oggetto in basso finché il suo bordo superiore non arriva a
metà sezione (`world y = 0`, perché la camera guarda l'origine). Il `parallax` del profilo è la
quota di corsa applicata: 1 su desktop, 0.6 su mobile, dove l'oggetto è già più grande.

Il breakpoint segue la **viewport**, non la sezione: `resize` usa `window.innerWidth` per il
layout e le dimensioni ricevute solo per l'aspect ratio della camera.
(teste associato al modulo rimosso).

**Caveat tecnico (r0.184+):** `RoomEnvironment` in Three.js r0.184+ produce
illuminazione leggermente diversa da quella della r0.170 usata nella CodePen
originale. Il vetro potrebbe necessitare di un aggiustamento visivo di
`envMapIntensity` o `scene.environmentIntensity` per eguagliare l'aspetto della
pen. Questo è verificabile solo visivamente, non con unit test.

**Decisione da ricordare:** la `transmission` su canvas trasparente senza nulla dietro rende il
vetro scuro. Il backdrop esiste per questo e non è decorativo: è il futuro punto di innesto di
un contenuto sotto la sezione.

## 29. Migrazione 2026-09-27 - Le righe di testo dentro la scena 3D

Realizzato quel "punto di innesto" rimandato: il backdrop non contiene più solo `--c-field`,
e le righe non sono più DOM.

| Prima | Ora |
|---|---|
| righe = `<span>` DOM sotto il canvas | righe = piani texturizzati dentro la scena |
| il vetro campionava un quad di colore piatto | il vetro campiona il testo e lo deforma |
| fit a ricerca binica sul DOM, in `TextEntryGlass.jsx` | `textLayout.js`, funzione pura con `measure` iniettata |
| nessuno shader per il testo | `src/shaders/heroGlassText.js`, GLSL ES 1.00 |
| flag sopra/sotto inesistente | `TEXT_ROWS[].behind` seleziona la draw pass |

**Il meccanismo.** three disegna in tre passate: opaque → transmissive → transparent. Il torus
è transmissive, quindi campiona solo ciò che è già stato rasterizzato. Una riga `behind: true`
deve stare nella passata **opaca**, e poiché ha alfa questo si ottiene con `alphaTest` +
`discard` nello shader: i frammenti sotto soglia vengono scartati e il piano resta opaco,
finendo nel render target della transmission. Con `transparent: true` andrebbe invece nella
passata transparent, cioè *dopo* il vetro, e si mostrerebbe sopra — l'inverso del flag.
`behind: false` fa il contrario: blending, `depthTest: false`, `renderOrder` alto.

**Moduli.** `textRows.js` (config + `normalizeRows`, `behind` troncato con `=== true`),
`textLayout.js` (`fitFontSize` + `layoutRows`, puro e testabile), `textAtlas.js` (una sola
canvas per tutte le righe, fette UV, `flipY = false`), `textLayer.js` (un piano per fetta,
UV scalate nella geometry, dispose). `engine.js` espone `rebuildText()` e `textStatus()`.

**Tre bug incontrati e risolti durante l'implementazione**, annotati perché sono la classe di
errore che questo effetto genera più spesso:

1. `measure` riceveva sempre `rows[0].text`: ogni riga veniva dimensionata sul testo della
   prima e quella lunga esplodeva. Ora `measure(size, row, index)`.
2. `contentBox.width` veniva usato sia come bersaglio del fit sia come dimensione dello
   schermo per la conversione mondo — due grandezze diverse. Ora `box` e `screen` sono
   separati.
3. Un backtick dentro un commento GLSL chiudeva il template literal JS e faceva fallire la
   build. Nei literal GLSL niente backtick.
4. **Ordine dei vertici di `PlaneGeometry` sbagliato.** Con `flipY = false` il `v = 0` della
   texture è il *top* della canvas, ma il bordo superiore del piano porta `uv.y = 1`:
   abbinando i vertici a caso le righe uscivano ruotate di 180°. L'ordine reale, verificato
   con un probe su three, è `0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right` — non
   l'ordine "counter-clockwise dal basso" che si presume. È il peggiore dei quattro: non
   crasha, nessun test lo intercetta, e il sintomo è solo visivo.

**Materiale:** `envMapIntensity` portato da `1` a `0.35`. `scene.environment` è la PMREM di
`RoomEnvironment`, uno studio bianco con pannelli luminosi: su una superficie quasi specchio
riflesse lo studio sull'intero oggetto e il testo rifratto sparisce dentro. Il valore scala
solo la IBL speculare, la `transmission` resta a `1`.

**Ripristinato:** il backdrop era stato reso `opacity: 0` il 2026-09-26, contro la regola
scritta in questa stessa sezione. Ora è di nuovo opaco.

**Test:** `tests/hero-glass/textRows.test.js` e `textLayout.test.js` — 22 test, nessuno
richiede DOM o WebGL. `hero-glass` non aveva alcun test prima. Baseline invariata: le 2
failure di `useArchiveCursor` sono preesistenti.

**Da verificare a occhio** (non possibile con i soli test): che le righe `behind: true`
resultino effettivamente deformate dal vetro e non sovrapposte — è l'unico punto in cui un
errore di draw pass è invisibile al build.


---

## 30. Rework 2026-10-02 - Hero dither dissolve: edge organica e cascata dal 20%

Richiesta utente: dithering piu' grande, che emerga dal bordo inferiore,
con edge organico (niente riga di punti dritta) e cascata che parte **almeno
dal 20% dal basso** e continua fino al fondo (rif. immagine allegata: campo di
girasoli che si dissolve nel crema).

Modifiche in `src/webgl-water/HeroEdgeMask.js` (unico file + coupling CSS):

- `HERO_EDGE_CONFIG` (sorgente unica di verita', nessun override in `shader-hero.jsx`):
  - `edgeLiftRatio` 0.12 -> **0.2** (zone tail = 20% dell'hero, req. >=20%)
  - `curveDepthPx` 8 -> **40** (bowl concavo piu' marcato: i lati salgono)
  - `cellSizePx` 12 -> **16** (dot piu' chunky, ref ~15-35px)
  - **nuovi** `edgeWobblePx: 18`, `edgeWobblePoints: 9`
- **Wobble seeded**: `makeEdgeNoise(seed ^ 0x9e3779b9, points)` (mulberry32 su
  stream separato dal cell loop, cosine interpolation tra control points) +
  `edgeShapeAt(u, curveD, wobAmp, noise)` = bowl parabolico + wobble. Il
  boundary ora ondula organicamente invece di essere una parabola liscia.
- **colEdgeY condiviso**: l'edge per colonna e' precomputato UNA volta (clamp
  `[0, bitmapH-1]`) e letto sia dalla staircase fill sia dal cell loop - mai
  ricalcolato in due posti diversi (invariant critico). `minEdgeY` = min
  dell'array (il puo' sollevare una colonna oltre l'estremo del bowl).
- Staircase: il gate `if (curveD > 0)` e' sparito (sempre utile, h>0 internamente).
- Self-check Node esteso: `edgeLiftRatio >= 0.2`, determinism del noise
  (stesso seed = stessa curva / seed diverso = curva diversa), spread del
  wobble > 4px con curveD=0, wobble bound <= ampiezza. Tutti PASSED.
- `src/styles/global.css` `.text-entry`: `margin-top: -13vh` -> **-21vh**
  (coupling diretto: 0.2 x 105vh = 21vh). Commento aggiornato.

### Verifica
- Node self-check: `HeroEdgeMask self-check: ALL PASSED`
- Visivo Playwright 375/768/1440 (`.playwright-mcp/dither-*.png`): edge
  organico ondulato si, cascata parte da ~20% dal basso e arriva al fondo,
  dot chunky ~15-35px. 768: nessun overlap. 375: occhiata manuale al
  angolo basso-sinistra (previsto overlap del bordo, ma verificare).
- `npm run build` exit 0, `npx vitest run` 296/296, console dev+prod 0/0.

### Tuning
Tutto passa da `HERO_EDGE_CONFIG`: per ritoccare la forma cambiare li'
(`edgeWobblePx` = ampiezza onda, `edgeWobblePoints` = densita',
`curveDepthPx` = concavita'). Se la cascata sembra troppo rada/fitta:
`tailStrength`/`tailDecay`.

### Da verificare a mano
- Su Chrome reale: il bordo non deve mai leggersi come linea dritta a 1440.
- 375px: angolo basso-sinistra, nessuna sovrapposizione antiestetica col
  testo sotto (coupling -21vh).
- Scroll: la coda di punti galleggia sulle prime righe di `.text-entry`
  come da design (-21vh).

### Fix 2026-10-02 (segue 30) - seam bianca all''inizio del dither
Sintomo: linea sottilissima orizzontale (piu` chiara) esattamente dove parte
la maschera/dither, per tutta la larghezza. Probe pixel sulla mask generata:
la riga y=362 aveva 640/713 colonne con alpha PARZIALE (0<a<255).
Causa: `minEdgeY` e i rettangoli della staircase erano FRAZIONARI (min di
valori float da wobble+parabola) → canvas2d antialiasa fillRect con Y
frazionaria → solid fill e staircase contribuiscono entrambi una riga
parziale, il composite resta <1 → il crema traspare dritto.
Fix: `minEdgeYInt = floor(minEdgeY)`; solid fill a `minEdgeYInt+1`; bottom
della staircase `ceil(colEdgeY[cx])` con overlap di 1 riga (tutto intero, nessun
AA). Probe dopo: `partialRows: []`. Verifica visiva: transizione omogenea,
nessuna linea. Gate: self-check ALL PASSED, build exit 0, vitest 296/296.

### Fix 2026-10-03 (segue 31) - tile-reveal: edge stretch -> UV warp con edge-pinning
Sintomo (prima ancora): con hover sulle immagini espanse (`.gl-frame`) le celle
ai bordi strisciavano (banda smearata). La fix "geometria per-cellula" ha
risolto lo smear ma ha introdotto il problema opposto: le celle si "spezzavano"
(gap tra quad in movimento). L'utente ha chiesto di tornare al movimento UV
(originale, piaciuto) + un trattamento bordo "tessuto in tensione" + puntatore
sfumato, usando la logica dei template www-gl (non la libreria, che e' WGSL/
WebGPU e sarebbe invasiva).
Causa dello smear originario: `clamp(coverUv + offset, 0, 1)` su quad unico.
Fix finale (single quad + warp UV, modulo `src/shaders/tileReveal.js`):
- vertex: passthrough triviale (`vUv = uv`), nessun `aCell`, nessuna geometria;
- fragment: cella recuperata da `floor(vUv * uGrid)`; displacement `idle` +
  `mousePush` (graded: `pow(smoothstep(0.7,0.0,d),1.5) * uHover * 0.18` -> non
  tutte le celle al 100%);
- **edge taper "tensioned fabric"**: `target = suv + offset * k`,
  `k = 1.0 - smoothstep(room*0.5, room, length(offset))`,
  `room = min(suv, 1.0 - suv)`. Vicino al bordo l'offset sfuma a 0, `target`
  resta sempre in `[0,1]` -> niente banda smear E niente gap (equivalente
  warp-template di `edgePinning` di Surface3D).
- mesh = `PlaneGeometry(2, 2)` (SelectedProjects E MobileSectionCanvas);
  `buildCellQuadGeometry` rimosso; `.is-settled` rimosso (niente gap da coprire)
  da SelectedProjects.jsx (import/export, onComplete reveal, disposeWebGL) e
  da global.css.
ATTENZIONE precision: `uPlaneAspect` ora SOLO nel fragment (vertex non lo
dichiara) -> nessun mismatch tra stage, nessun `precision mediump float;` nel
fragment.
Gate: `tests/shaders/tileReveal.test.js` (6 test: no clamp, passthrough, edge
taper room/k, mousePush graded, uniform presenti), vitest 33 file / 302 test,
build exit 0. Verifica runtime: Playwright (chromium swiftshader) espande il
progetto, muove il mouse sui bordi -> 0 console error (nessun shader compile
error), 0 page error, canvas attivo. Screenshot: AGENT/test-results/visual/
tilereveal-uv-edge-{br,tl}.png. Script: AGENT/test-results/verify-tilereveal.cjs.

**Segue 31b - ghost layer sotto le celle (mix-blend-mode difference).** L'utente
vedeva l'immagine statica `.project-expanded__img` trasparire sotto il canvas
in movimento e ha chiesto di stilarla: `mix-blend-mode: difference; opacity:
0.65;` sulla regola base, e rimosso il `opacity: 0` di
`.gl-frame.is-ready .project-expanded__img` (ora 0.65) che la nascondeva nello
stato attivo. Il canvas dipinge sopra, quindi il difference si fonde col
backdrop di pagina; su `.gl-frame--fallback` (niente canvas) l'img resta a
`opacity: 1`. Verifica runtime: Playwright -> computed style
`opacity: 0.65`, `mixBlendMode: difference`, 0 console error, 0 page error.
Script: AGENT/test-results/verify-blend.cjs; screenshot:
AGENT/test-results/visual/blend-check.png.

## 32. Feature 2026-10-03 — Orbiting cylinder-text ring on the hero SVG

Nuovo effetto in `src/webgl-water/HeroShaderStack.jsx`: banda di testo
"SOMEBODYWANT3D" che orbita attorno alla hero SVG (`/assets/svg/hero.svg`)
nello stesso canvas WebGPU.

### Approccio (meccanismo R5, verificato empiricamente)
- `<ConcentricSpin intensity={0} speed={0.5} speedRandomness={0} center={0.5,0.5}
  boundingBox={RING_BOX}>` → `<PolarCoordinates center={0.5,0.5} wrap={1}
  radius={1} intensity={1} boundingBox={RING_BOX}>` → `<Text text="SOMEBODYWANT3D"
  fontFamily="Bricolage Grotesque" fontWeight={500} fontSize={30px}
  letterSpacing={-0.037} color="#ffffff" center={0.5,0.5}>`.
- `Text` campiona `uvContext ?? ctx.uv` (Text-i-Z fragment), quindi la UV warp
  dei genitori si propaga al testo → il testo piatto diventa un anello curvo.
- `polarCoordsUV` mappa la uv di schermo in `(normalizedAngle*wrap, r*radius)`;
  `intensity:1, wrap:1, radius:1` piega il testo in un anello.
- `boundingBox` in **px** posiziona/ridimensiona l'anello sul canvas (risolto
  contro il canvas, come `heroSvgBox`); `RING_BOX` speculare a `heroSvgBox`
  (280×280, y:92, origin top-center) → anello concentrico all'artwork.
- `ConcentricSpin._animTime`: ogni istanza ha un accumulatore WeakMap (seed 0)
  avanzato di `dt*speed`; speed 0.5 ≈ 0.02 cicli/s (rate = 0.25*speed rad/s).
- Band posizionata DOPO `hero.svg` (quindi in PRIMO piano rispetto alla SVG).
- Fade-in: `useState` opacity 0 → ramp 0→1 (~800ms rAF) al removal di
  `#preloader` (MutationObserver, stesso pattern di `TextEntryGlass`);
  `prefers-reduced-motion`: opacity 1 subito e `speed=0` (statico).

### CONSTRAINT CRITICA — le maschere NON funzionano sui warp
`maskSource`/`maskType` sui componenti **warp** (`ConcentricSpin`,
`PolarCoordinates`) **non sono supportati** da `shaders/react` (v3.x): la
variante di shader mascherata del warp **non compila** →
`[Invalid RenderPipeline] ... SetPipeline` → `[Invalid CommandBuffer]` (errore
GPU, "due to a previous error"). Verificato per isolamento: rimuovendo la mask
dal warp l'errore sparisce; i mask funzionano solo su nodi foglia
(`ImageTexture`, `Text`, `SolidColor` — vedi `hero-night`/`trailDots` nello
stack).

**Conseguenza:** lo "split" speccato (banda front mascherata alla metà inferiore
+ banda back dietro la SVG per l'effetto "avvolgente") **non è realizzabile**
con questa libreria. Implementato invece come **singolo anello completo in
primo piano** sulla SVG (orbita preservata, nessuna mask). Opzioni per l'utente:
(a) anello in primo piano (attuale); (b) anello dietro la SVG (halo, non
copre l'artwork); da rivedere con l'utente.

### Verifica (programmatica — il modello non legge immagini)
- Decode PNG via Node + zlib (script temporaneo rimosso): anello magenta
  rilevato centrato sulla SVG (viewport x≈458 = centro), bbox coerente con
  `RING_BOX`; shape a arco (testo più corto della circonferenza) → orbita OK.
- Console `:8151`: solo info React DevTools, **0 errori GPU**, dopo rimozione
  della mask dal warp.
- `npm run build` / vitest: da confermare (sezione seguente).

### File
- `src/webgl-water/HeroShaderStack.jsx` — unica modifica (import ConcentricSpin/
  PolarCoordinates/Text, costanti RING_BOX/RING_CENTER, componente `RingText`,
  band nell stack, fade-in + reduced-motion). Nessun file nuovo.

### Fix 2026-10-03 (segue 32) - lag da preload + anello fermo
Due regressioni dopo il deploy della ring:
1. **Lag "già dal preload".** L'anello (`ConcentricSpin`+`Text`) era montato
   dall first paint con `opacity:0`; l'engine rasterizza il nodo `Text` a ogni
   frame mentre il preloader è su → costo GPU/main-thread. In più il
   `MutationObserver({subtree:true})` su `document.body` scattava a ogni mutazione
   del DOM durante il churn del preload → jank.
2. **Anello fermo ("ferma al centro").** `ringSpeed = reduceMotion ? 0 : 0.5`
   azzerava l'orbita sotto `prefers-reduced-motion` (OS Reduce Motion attivo
   sull'utente) → `_animTime` non avanza → anello statico. Anche `speed:0.5`
   (~50s/giro) era troppo lento per leggersi come moto.

Fix:
- **Mount-gating:** stato `revealed`; l'anello è nel tree SOLO dopo la rimozione
  di `#preloader` (è figlio diretto di `<body>`, index.html:40 →
  `MutationObserver` su `document.body` con `childList` senza `subtree` la
  intercetta, + safety 20s). Durante il preload l'anello NON esiste → 0 costo.
- **Orbita sempre attiva:** `ringSpeed = 0.8` (costante, anche con reduced-motion;
  solo il fade-in è istantaneo sotto reduced-motion). L'anello orbita e si legge
  come moto. Nota a11y: deviazione voluta dal freeze di reduced-motion, chiedere
  all'utente se preferisce ripristinare lo statico.
- Fade-in 0→1 in ~700ms dopo il reveal (rAF); reduced-motion → opacity 1 subito.

Verifica: `npm run build` exit 0; console `:8151` pulita (solo React DevTools)
anche dopo il reveal/mount dell'anello; `#preloader` direct-child di body → gate
ok. Mancano screenshot multi-viewport (il modello non legge immagini) e conferma
visiva dell'utente su orbita + sparizione lag.

### Anello testo orbitale singolo (frontale) — revisione 2026-10-03

> **REVISO dopo feedback utente.** La variante "torus dietro+davanti" è stata
> **scartata**: l'utente vedeva il testo **3 volte** (back ring + front ring in
> parallax + percezione di doppio) e voleva invece *"un solo anello, frontale,
> semplice e pulito, con il logo al centro come un pianeta e il testo come
> anelli"*, in movimento continuo. Nessun wrap dietro/davanti.

Implementazione (`src/webgl-water/HeroShaderStack.jsx`), **un solo** `OrbitRing`:
- `ConcentricSpin`+`PolarCoordinates`+`Text` "SOMEBODYWANT3D", `wrap=1`,
  `speed=0.8`, montato DENTRO lo `<Shader>` principale, **dopo** `hero.svg` /
  `FilmGrain` → layer più in alto, quindi **davanti** al logo. Unica istanza →
  niente triplicazione.
- **RING_BOX** 400×400 (y=32, origin top-center) vs `heroSvgBox` 280×280 (y=92):
  l'anello cerchia il logo concentrico (centro ≈ y 232), logo nel "buco".
- `revealed`-gate (montato dopo il preloader) + fade-in 0→1 ~700ms (rAF);
  reduced-motion → opacity 1 subito.
- **Orbita continua**: `ringSpeed = 0.8` (costante, anche con reduced-motion) —
  richiesta esplicita "movimento continuo"; la freeze a11y è stata rimossa.

Rimosso: il secondo `<Shader>` (canvas `hero-gl-canvas--front`) e la regola CSS
`.hero-region--split .hero-gl-canvas--front` (mask banda) — non più necessari
con un solo anello frontale.

Nota engine (ancora valida): `maskSource` crasherebbe su nodi WARP
(`ConcentricSpin`/`PolarCoordinates`) → `Invalid RenderPipeline`; non usato qui
(nessuna mask). L'engine è WebGPU-first (`canvas.getContext("webgpu")`).

Verifica (LIMITATA): `npm run build` exit 0; `tsc --noEmit` pulito; **302/302
vitest pass** (nessun regressione). **NON verificabile a video headless**: Chromium
headless senza WebGPU adapter → `onUnavailable` → `HeroShaderStack` non monta.
Da confermare nel browser reale dell'utente (WebGPU): (1) un SOLO anello di testo
intorno al logo, (2) rotazione continua e pulita, (3) il logo resta leggibile al
centro, (4) niente doppi / box nero.

### Anello three.js (HeroTextRing.jsx) — revisione 2026-10-03

> L'anello WebGPU (`ConcentricSpin`+`PolarCoordinates`+`Text`) è stato **rimosso
> da `HeroShaderStack.jsx`**: il testo copriva solo ~⅔ del giro (misurato:
> 276px su box 400 → arco 248°, spicchio mancante di 112° a sinistra), quindi a
> video appariva come scritta dritta + frammento obliquo invece che anello.
> Su richiesta utente l'anello ora è **three.js** (`HeroTextRing.jsx`, overlay
> nella stessa section, montato da `shader-hero.jsx` anche se WebGPU manca):
> texture canvas 1024 con testo distribuito per lunghezza d'arco (chiusura
> esatta a 360°), piano frontale ortografico centrato sul logo
> (`hero.svg`/`hero-hover.svg`, 280px a y=92 → centro y≈232), rotazione rigida
> continua `rotation.z`. Reveal-gated come prima, fade-in 700ms, pausa
> fuori-schermo via IntersectionObserver.

### Cornice dithering + zero lag — 2026-10-03

> La vignetta è una cornice arrotondata (rounded-rect SDF, solo lati+alto, il
> basso resta bowl+pioggia) che dissolve SOLO il bordo: il canvas centrale è
> sempre integro dietro la cornice. Zona protetta (disco su logo+anello, raggio
> proporzionato) mai intaccata. Anti-lag: i 40 frame del loop sono precalcolati
> una volta in chunk (regen ~6ms), poi ogni tick scambia solo data URL.
> Verificato: loop chiuso, 302/302 test, screenshot senza tagli né artefatti.

### Hero perf: offscreen skip + no forced layout — 2026-10-04

> Misurato headless (SwiftShader): hero visibile 0.6–4.5fps con longtask fino
> a 6s ad attribuzione vuota (raster software), hero fuori vista ~49fps. Fix:
> (1) `HeroTextRing` legge `getBoundingClientRect` in cache (refresh coalesced
> su scroll/resize), niente più layout forzato ogni frame; (2)
> `content-visibility: auto` + intrinsic size sulla hero così fuori schermo
> salta layout/paint/composite — scrollHeight stabile, screenshot al ritorno
> integro; (3) mask tick già cached + IO-gated. Nota dev: StrictMode in
> `main.jsx` (double-mount solo in dev). Suite 302/302 (3 flaky sotto carico
> parallelo, 18/18 isolati).
