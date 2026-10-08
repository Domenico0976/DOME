# PLAN-STAR — Sostituzione stella base con stella 4 punte chrome + logica viva

> Spec visiva: `DESIGN-star.md` (questa cartella).
> Validazione: Oracle `bg_c3572ca4` OK (brainstorming + ponytail). Decisione: **Approccio C** — 1 solo file shader nuovo + rewrite `index.jsx`. Niente 4-file split. Pixel-cell detachment → **V2 (defer)**.
> Nota storica: Oracle `bg_65471261` fallito per crediti, piano iniziale da analisi diretta repo + frame Pencil live (`bqUbp`/`k6tsiA`).
> Obiettivo: buttare la stella base esistente e tutta la sua LOGICA non utile, mettere la nuova stella 4 punte leggermente gonfia con i 2 shader analizzati (blu→rosso).

Stack repo: Vite + React 19 + Three 0.185 + GSAP + Lenis. File chiave sotto.

---

## 0. Stato attuale — cosa rimuovere (confermato Oracle)

### 0.1 Stella base esistente

- `src/components/HeroStar/index.jsx` — da riscrivere:
  - `STAR_POINTS = '100,10 117,73 180,73 ...'` → **stella 5 punte** piatta, non la 4 punte sparkle. Buttare.
  - SVG DOM `polygon fill=url(#hsg)` gradiente oro `#FFD700 → #8B0000` + stroke `#D4AF37` → buttare (placeholder, come `istruction_AI/Star/StarGoldBlue.tsx` / `StarGoldRed.tsx`, mai importati in `src/` — confermato via grep).
  - Three.js: `makeStarMesh` con `ShapeGeometry` piatta + `MeshBasicMaterial` additive (`starCore 0xffb833`, `starRim 0xffd700`) + `Sprite` glow radiale arancio → buttare tutto il blocco glow/core/rim.
  - LookAt finto: `camera.rotation` + `counter-translate` + `glowSprite.position` drift → buttare, sostituito da slerp quaternion reale (§3).
  - `IDLE_PULSE_SPEED`, `pulse scale 1.0±0.035`, idle solo mobile → buttare, sostituito da stayAlive unificato (§2).
  - `PARALLAX_PX = 200` con `container.style.transform translate3d` → buttare come meccanismo (tenere solo il valore come riferimento); parallasse passa a `rig.position.y` in GL (§3). Root-cause scatter = doppia autorità CSS+GL nello stesso frame.
  - Portal in `.text-entry`, `IntersectionObserver`, `ResizeObserver` con square-guard, `DPR_CAP=1`, `prefers-reduced-motion` gate, `useIsMobile` / `useCursorGate` → **tenere verbatim** (infrastruttura buona).
- `src/components/TextEntryGlass.jsx` — **nessuna modifica**: tiene `HeroStar` come sibling portalato, `scrollProgress` via engine + `setPointer` smoothed. La nuova stella riusa `scrollRef` e hover-zone `.text-entry` senza toccare il torus.
- `src/hooks/useCursorGate.js`, `src/gl/*`, `src/hero-glass/*` — **nessuna modifica**.

### 0.2 Cosa resta intatto

- `src/hero-glass/engine.js`, `textRows.js`, `params.js` (torus + testo).
- `src/gl/resize.js` (`registerResize`), `src/gl/safety.js`, `src/gl/viewport.js` (`subscribeInView` riusabile per visibility).
- `src/utils/renderScale.js` (`pixelRatioFor` — usare al posto di `DPR_CAP` hardcoded).
- `src/shaders/tileReveal.js` (pattern `export const vertex/fragment` da copiare per il nuovo shader).
- `src/App.jsx` (Lenis + ScrollTrigger).

---

## 1. Architettura nuova — Approccio C (1 shader file + 1 rewrite)

```
src/components/HeroStar/index.jsx   (rewrite: geometria + tick + LookAt + morph + wire)
src/shaders/mercuryStar.js          (NUOVO, unico file nuovo: vertex+fragment template literal)
istruction_AI/Star/StarGoldBlue.tsx (DELETE)
istruction_AI/Star/StarGoldRed.tsx  (DELETE)
```

Niente `starGeometry.js` / `useStayAlive.js` / `WireGlow.js` (over-decomposizione: sarebbero 3 file <50 righe per un'unica mesh con un unico tick — grep conferma zero altri consumer degli internals HeroStar).

Regole d'oro (ponytail):
1. **Una sola geometria, un solo materiale.** Blu e rosso sono 2 set di `u_color1..4` mixati in shader, mai 2 mesh.
2. Niente SVG DOM sopra il canvas — tutto in WebGL con alpha, così wireframe/glow hanno prospettiva corretta.
3. Una sola autorità per frame (`tick` in `index.jsx` scrive `quaternion`/`position` una volta); vietato `container.style.transform` dopo Fase 2.
4. Riusa stdlib/Three nativi: `THREE.Shape` + `ExtrudeGeometry`, `Quaternion.slerpQuaternions`, `LineSegments` + `WireframeGeometry`, `smoothstep` GLSL.

Geometria 4 punte (da DESIGN-star §7.1): N(500,20) S(500,980) E(930,500) O(70,500), valli diagonali ±170px con fillet Bézier. Costruzione inline in `index.jsx`: `THREE.Shape` → `ExtrudeGeometry { depth:0.12, bevelThickness:0.08, bevelSize:0.06, bevelSegments:8, curveSegments:24 }` → inflate pillow via displace vertici lungo normali con falloff gaussiano dal centro (`inflation 0.06–0.09`). Centrare + normalizzare a raggio 1. Wireframe = `WireframeGeometry(stessaGeo)` come figlio (eredita quaternion → prospettiva corretta).

---

## 2. Fase 1 — Base + stayAlive + rotazione costante

File: rewrite `src/components/HeroStar/index.jsx` (tenere portal, visibility gate, resize square-guard, `pixelRatioFor`, reduced-motion).

- Renderer `alpha:true`, `clearAlpha 0`, camera `fov 38, z=5`.
- `StarRig` (Group) bottom-left come ora (`left clamp(14px,3.2vw,44px)`, `bottom clamp(14px,3.5vh,52px)`), starSize 130 desktop / 72 mobile.
- stayAlive **sempre attivo, orologio mai pausato** (anche in hover come base-blend):
  - float: `pos.y += sin(t*0.8)*0.03`, `pos.x += cos(t*0.6)*0.02` in unità GL.
  - breathing scale: `1.0 + sin(t*1.4)*0.015`.
  - rotazione costante su sé stessa: `rot.z += dt * 0.25 rad/s` (≈24 s/giro). Asse Z (vista frontale); non trasla, gira solo.
- Done: stella gonfia in basso-sx che respira e ruota lenta, 60fps, nessun jitter a resize.

---

## 3. Fase 2 — Parallasse scroll + hover LookAt senza strappi

### 3.1 Parallasse in alto allo scroll

- Sorgente: `scrollRef` esistente (`index.jsx:229-237`: `(vh - rect.top)/(vh + rect.height)` su `.text-entry`, clamp 0..1, rAF-coalesced). Riuso diretto anche per `u_morph` (§4).
- Effetto: `Rig.position.y = baseY + scrollP * 1.6` (equivale ai 200px CSS ma in unità mondo, coerente con LookAt). Smoothing `sm += (target-sm)*min(1,dt*4)` + deadband `0.0005`. Lenis già liscio.
- Vietato CSS transform sul container da qui in poi.

### 3.2 LookAt su hover `text-entry`

- Hover-zone: `.text-entry` via `useCursorGate.isOver(rect)` (mobile parked incluso; se `!isAwake` resta STAY). Fallback document-level `pointermove` esistente (`docPtrRef`) dove serve.
- `isHov=true`: raycast → punto su piano stella, target quaternion = `LookAt(starPos → hit)` clamp ±0.35 rad, damping `slerp 5/s`. Ruota, non trasla.
- `isHov=false`: **blend-back**: `qExit` congelato → slerp verso `qStay(t)` (l'orologio stayAlive è avanzato anche in hover → nessun salto). Peso `wLook 1→0` con `dt*3`, singola assegnazione `quaternion` per frame.
- Done: 10 sweep dentro/fuori veloci senza snap/scatter.

---

## 4. Fase 3 — Morph shader blu→rosso guidato da scroll % (V1 senza celle, V2 con celle)

**Bloccante:** `images/mercury-shape.glsl` non esiste in repo (solo nei frame Pencil) — portarlo inline in `src/shaders/mercuryStar.js` come template literal (pattern `tileReveal.js`), uniforms DESIGN-star §4: `u_speed 0.82, angle 198, scale 1.387, turbAmp 1.02, turbFreq 0.997, waveFreq 2.362, edge 0.023, reflection 0.64, contour 0.81`.

```glsl
uniform vec3 u_colA1,u_colA2,u_colA3,u_colA4; // blu: #001417 #0d6b7a #3bdcff #d9f7ff
uniform vec3 u_colB1,u_colB2,u_colB3,u_colB4; // rosso: #000000 #7a140d #ff3b3b #ffd9d9
uniform float u_morph;   // 0=blu → 1=rosso, da scroll %
uniform float u_front;   // frontiera (0 basso → 1 alto)
uniform float u_time;
varying vec2 vUv; varying float vY;
```

- V1 (ship): `u_morph = smoothstep(0.15, 0.85, scrollP)`, `u_front = u_morph`, `m = smoothstep(u_front-0.08, u_front+0.08, vY)`, `col_i = mix(Ai, Bi, m)` poi pipeline mercury invariata. Forma identica, solo palette (come PNG).
- **V2 (defer — pixel-transformation):** banda `|vY-u_front|<0.06` con `cell=floor(vUv*vec2(90,140))`, hash stabile per cella (mai `time` dentro `floor`), offset detach verso alto + swelling normale + `edgeGlow`. ~80 righe fragment per gain marginale → non blocca V1.
- **Spin 360° zero-g durante morph (V1 incluso):** `0<u_morph<1` → `rotY = easeOutCubic(u_morph)*2π` (dura tutto lo scroll) + coda `sin((u_morph-1)*π)*0.15`. Composizione obbligata `qFinal = qStayLook.clone().multiply(qMorph)` in **singola assegnazione** (doppia scrittura = gimbal drift). Centro fisso = rilascio senza gravità senza movimento.
- Alpha trasparente: `gl_FragColor.a = smoothstep` su SDF; se canale SDF Pencil non disponibile fuori Pencil, fallback con silhouette geometria estrusa + `fwidth` AA (mai `step` secco).

---

## 5. Fase 4 — Wireframe superiore + glow da cursore (prospettiva corretta)

- `WireOverlay` = `LineSegments(WireframeGeometry(starGeo))` figlio della mesh. Niente sprite screen-space (quello vecchio va cancellato).
- Raycast/frame in hover → uniform `u_hoverPos` in **spazio oggetto** + `u_hoverOn 0..1` (fade `dt*6`).
- Wire shader/opacity: `alpha = u_hoverOn * (0.25 + 0.75*exp(-dist*3.0))`. Colore: ciano `#9FF3FF` ↔ rosa `#FFB3B3` mixato con `u_morph`, `additive`, `depthTest true`.
- `GlowShell` (scala 1.03, `fresnel = pow(1-dot(N,V),2.5)*hoverProximity): opzionale — skippare se budget perf stretto.
- Done: glow ancorato al punto mesh e gira con la stella (prova rotazione: non resta fisso a schermo).

---

## 6. Ordine di lavoro — Approccio C

| Fase | File | Azione | Done |
|---|---|---|---|
| 0 Cleanup | `HeroStar/index.jsx`, `StarGold*.tsx` | Cancella STAR_POINTS 5 punte, SVG `hsg`, sprite glow, rim, pulse, `container.style.transform` | `grep STAR_POINTS` vuoto, nessun `hsg` |
| 1 Shader | `src/shaders/mercuryStar.js` (**unico file nuovo**) | Porta `mercury-shape.glsl` + uniforms morph/frontiera (+celle solo V2) | Importabile come `tileReveal.js`, testabile come `tests/shaders/tileReveal.test.js` |
| 2 Rewrite | `HeroStar/index.jsx` | Shape 4 punte + extrude + inflate, stayAlive + `rot.z dt*0.25`, parallasse mondo, FSM STAY/LOOK, `u_morph` da `scrollRef`, spin 360° `qStayLook*qMorph`, wire child + raycast | Stella gonfia su trasparente, sweep hover senza snap, 0% blu / 100% rosso |
| 3 QA | `tests/herostar.spec` o Playwright | reduced-motion (statico, no GL), mobile parked, resize square, alpha-check checkerboard | Verdi, nessun alone bianco (straight-alpha) |

Stima: F0 0.5gg, F1 shader 1gg (fidelity GLSL domina), F2 rewrite 1–1.5gg, F3 QA 0.5gg. Totale ~3–3.5gg (vs 5gg del piano a 4 file). V2 celle: +1gg separato, non bloccante.

---

## 7. Rischi + anti-scatter (aggiornati Oracle)

1. **Doppia autorità** (CSS + GL) → una sola scrittura/frame in `tick`; mai più `container.style.transform`.
2. **Salto fine hover** → orologio stayAlive mai pausato + `qExit` blend-back.
3. **Frontiera dentellata** → `smoothstep 0.16` + `fwidth` AA.
4. **Celle tremolanti (V2)** → hash stabile, animare solo intensità.
5. **Spin che trasla / gimbal drift** → solo `qFinal = qStayLook*qMorph`, mai `position` nel morph, mai due assegnazioni quaternion/frame.
6. **Wireframe schermo-spazio** → wire figlio + `u_hoverPos` oggetto-spazio da raycast.
7. **GLSL assente in repo** → estrarre da Pencil o ricostruire dai 9 uniforms DESIGN §4.1; nessun loader `.glsl` necessario (template literal).
8. **Perf** → DPR via `pixelRatioFor` (cap 1–1.5), geo <8k tri, shader unico, gate `visible` esistente.

---

## 8. Verifica finale

- [ ] Solo stella, alpha 0 fuori (checkerboard), nessun fondo bianco.
- [ ] Bottom-left iniziale, sale con scroll smooth (Lenis).
- [ ] Rotazione costante lenta sempre attiva.
- [ ] Hover text-entry → attenzione al cursore; uscita → ripresa continua senza scatti (test sweep 10×).
- [ ] Scroll 0% tutto blu, 100% tutto rosso, 50% frontiera a metà + mezza rotazione 360° (V1); celle staccate/rigonfie solo V2.
- [ ] Hover → wireframe + glow locale ancorato alla mesh (test rotazione).
- [ ] Reduced-motion: statico, nessun contesto GL. Mobile: parked-cursor.
- [ ] Nessun `STAR_POINTS` 5 punte o `hsg` residuo. `StarGold*.tsx` cancellati.

---

## 9. Appendice — esito validazione Oracle `bg_c3572ca4`

Confermati gap CRITICAL (geometria, single-mesh, mercury assente, morph assente) + HIGH (LookAt finto). Scelta Approccio C contro B (4 file = over-engineering, zero riusi esterni confermati via grep). Approccio A (tutto in `index.jsx`) scartato per non-testabilità GLSL — C mantiene convenzione `src/shaders/*.js` + test shader esistente. Dettaglio completo nel report Oracle in chat.
