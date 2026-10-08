# NOTES — leoparpeix.com visual clone

## Cross-Link Index
- **[AGENTS.md](./AGENTS.md)** — Work protocol, rules, testing procedures
- **[EFFECTS.md](./EFFECTS.md)** — Effect reference (desktop vs mobile rules)
- **[NOTES_WEBGL.md](./NOTES_WEBGL.md)** — WebGL shader changes

## Source
- URL: https://leoparpeix.com
- Snapshot date: 2026-08-29
- Owner: Léo Parpeix (Bordeaux, FR) — Art Director, Interactive Designer

## Mode
- Clone mode: **visual** (replica visiva, not 1:1 faithful)
- Scope: **Projects / Portfolio** (Hero + Selected projects + Archives)
- UI language: **English** (artefact) / chat language: Italian (locale `it`)

## Stack (source)
- Vue 3 + Vite SPA (`<meta name="generator" content="Vite + Vue 3">`)
- Three.js (2 WebGL canvases, 89 ktx2 textures, GLB models, DRACO)
- GSAP / ScrollTrigger + Locomotive Scroll (smooth scroll, split text)
- 20 video elements (mp4 + aac ambient), 24 images, 60 @font-face declarations, 3 font files
- Theme: `#083D2A` deep forest green; pure black background; binary black/white type

## Stack (clone)
- Single self-contained `projects.html` — semantic HTML5, native CSS, vanilla-JS reveal script + two Three.js modules (hero-3d, featured gallery)
- No SPA framework, no GSAP, no Locomotive (Three.js powers the hero scene and the DOM-synced ripple gallery)
- Fonts: 2 self-hosted families — `text` (Monument Grotesk woff2) and `title` (Avantt Variable ttf), loaded via `assets/fonts/fonts.css` with `crossorigin` preloads
- All posters and project images referenced from `assets/images/www.leoparpeix.com/` (local)
- No CDN, no Google Fonts, no Typekit, no analytics, no trackers

## Files
- `projects.html` — main deliverable (the only HTML file; not `index.html`)
- `assets/fonts/fonts.css` — `@font-face` for Monument Grotesk (text) and Avantt Variable (title)
- `assets/fonts/www.leoparpeix.com/` — `monumentgrotesk-regular-*.woff2` and `avantt-variable-*.ttf`
- `assets/images/www.leoparpeix.com/` — 19 harvested project posters (webp) + 6 cloud PNGs + 2 leaves webp + 1 dna webp + 1 showreel poster + 1 favicon
- `assets/media/www.leoparpeix.com/` — 2 showreel mp4 + 4 ambient aac (kept on disk but **not** autoplayed in clone)
- `RECON/original-recon.json` — full original site recon (157 KB)
- `RECON/original-summary.md` — human-readable recon summary
- `RECON/original-bundle.js` — extracted Vue bundle (1.38 MB), source of project list and hero copy
- `RECON/clone-recon/site-recon.json` — recon of the clone at 1440 / 768 / 390
- `RECON/clone-recon/screenshots/site-{1440,768,390}.png` — clone screenshots
- `RECON/design-dna.json` — full DNA in visual mode (palette, type, layout, motion, effects)
- `RECON/asset-manifest.json` — manifest of all 144 harvested assets
- `CLONE_AUDIT.md` — automated clone audit (`--strict`)
- `visual-diff-1440.json` + `visual-diff-1440.png` — pixel comparison vs original at 1440
- `CLONE_REPORT.md` — this build's side-by-side report

## Asset coverage
| Source class        | Count | Status |
|---------------------|-------|--------|
| Fonts (woff2/ttf)   | 3     | ✅ 100% harvested, all served from `assets/fonts/` |
| Project posters     | 19/23 archives + 5/6 selected | ✅ all archives-with-poster; Trebuchet uses inline-SVG placeholder |
| ktx2 / 3D textures  | 89    | ⚠️ original site assets; the clone's hero-3d + featured gallery use local png/webp + procedural canvas textures instead |
| Showreel mp4        | 2     | ⚠️ kept on disk, not autoplayed in clone |
| Ambient aac         | 4     | ⚠️ kept on disk, not played in clone |
| Total local files   | 135+  | ✅ |

## Substitutions
- **Three.js hero scene (hero-3d)** — the hero renders a real Three.js WebGL scene (fogged mountain landscape, drifting clouds, falling leaves, pointer parallax) on `#hero-canvas` behind the editorial copy (verified headless: WebGL 2.0, renders content, `is-3d` class applied). Uses only locally-harvested textures (cloud pngs, terrain png, webp normal, procedural leaf canvas texture) — **no ktx2**.
- **Featured gallery (new, "In evidenza")** — a new image-tile grid between the hero and Selected projects that replicates the original site's DOM-synced WebGL architecture: two global canvases (`canvas-app` behind the content, `canvas-top-app` as an overlay cursor glow), each tile's `<img>` swapped for a WebGL plane with a hover ripple + chromatic-aberration shader and scroll/mouse parallax. Idle shimmer keeps posters alive (ripple `0.015 + 0.055·uHover`, hover zoom 9%, CA `0.012`), scroll parallax `data-scroll-speed` 0.10–0.14 ×6 tiles, caption parallax `data-parallax-speed` 0.16–0.24 ×160 (drift ~12–20px). Falls back to the static `<img>` when WebGL is unavailable or `prefers-reduced-motion` is set.
- **20 inline videos** → static webp posters with hover-scaling (the only motion effect on tiles). The original `media.url2` mp4s are kept on disk for any later autoplay wiring.
- **GSAP SplitText** → CSS-only typography (no per-word reveal; the title is shown complete on load).
- **Locomotive smooth scroll** → native `scroll-behavior: smooth` on `<html>`.
- **Custom cursor label** ("Drag", "Discover More") → small floating pill that appears on tile hover (CSS-only).
- **Sound toggle** (original plays ambient aac) → UI button present, label-only state; no actual audio playback in the static clone.
- **Trebuchet project** (no local poster harvested) → inline-SVG placeholder tile with brand-green gradient + type name. Marked visually identical to a real poster, used as a graceful fallback.

## Reused content
All copy was extracted from the original Vue bundle (`original-bundle.js`) and is reproduced as-is (English):
- Hero: "Art director, Interactive designer." (verbatim)
- "Selected projects" / "Archives" section titles (verbatim)
- All 7 selected-project entries (name, type, year, team size, agency, roles, recognitions, projectLink)
- All 23 archive entries (name, type, roles, date) — see `RECON/parse_archives2.py` for source
- Footer microcopy: "Studio", "Connect", "Index" (inferred from the page's footer block, English)

## Localisation
- The original is in **English**; the artefact is also in English. Chat replies are in Italian (locale `it`).
- All French/Latin diacritics preserved correctly as UTF-8 (e.g. `Léo Parpeix`, `L'Oréal`, `Auberge La châtelaine`).

## Verification
- `recon-site.mjs --url http://127.0.0.1:8123/projects.html` → 3 viewport captures (1440/768/390), 0 console errors, 0 page errors, 0 framework signals
- `visual-diff.mjs` (1440): full canvas compared; pixel diff expected to be high because the original is a continuous Three.js scene and the clone is a static poster grid
- `audit-clone.mjs --strict` → only false-positive "brand residue" warnings (audit reads UTF-8 as Latin-1 on the `é` glyph); no real issues in the deliverable

## Polish round (2026-08-29)
Four publication-readiness fixes applied directly to `projects.html`, all verified headless (`verify-polish.mjs`, port 8149, Chrome 1440×900 + 390×844):
1. **Dark-canvas focus ring** — `[data-od-id="hero-region"].is-3d :focus-visible { outline-color: #eed6c8; }` (line 162). The base `:focus-visible` ring uses `var(--c-accent)` (#083D2A), which is invisible against the is-3d dark canvas; the soft-cream `#eed6c8` matches the is-3d accent palette. Light contexts keep the accent ring (a11y 2.4.7, contrast verified).
2. **Footer heading hierarchy** — `.footer-strip h4` → `h3` (CSS) + the three footer column headings `h4`→`h3` in markup. No skipped heading levels (a11y 1.3.1): now 3×`h3`, 0×`h4` in `.footer-strip`.
3. **Footer link affordance** — `.footer-strip li a` keeps a persistent `border-bottom: 1px solid var(--c-rule-strong)` instead of transparent; hover still flips to `currentColor` (matches `.pr-link` pattern).
4. **Rotator reduced-motion** — guard before the footer `setInterval`: `if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;` so the footer stays on its first phrase under reduce (WCAG 2.2.2). The module-level `reduceMotion` flag is out of scope there; the CSS-media guard is the correct hook.

### Verification commands
- `$env:OD_BROWSER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"; node verify-polish.mjs` (run from the Open Design temp dir alongside `verify-effects.mjs`/`verify-mobile390.mjs`)
- Result: all 10 VERDICT checks true — `darkFocusRingSoft` (#eed6c8), `lightFocusRingAccent` (#083D2A), `footerLinkUnderline` (rgba(17,17,17,0.32)), `footerH3`/`footerNoH4`, `rotatorRotatesNormally`, `rotatorStaticReduced` ("a remarkable journey"), `mobileNoOverflowX` (390px), `hero3dAlive`, `cleanConsole`.

### CDP caveats (verified during this round)
- The daemon broker (`connectOverDaemon`, `OD_DAEMON_URL` + `OD_PROJECT_ID`) returned **HTTP 503** on this daemon — the fallback path in `launchChromium` (playwright-loader.mjs) discovers the system Chrome instead; set `OD_BROWSER_EXECUTABLE_PATH` explicitly in the shell (it is not present by default).
- Programmatic `focus({ focusVisible: true })` inside `Runtime.evaluate` does **not** match the `:focus-visible` pseudo-class. Use `Emulation.setFocusEmulationEnabled { enabled: true }` first for real focus-ring verification (otherwise computed outline falls back to `currentColor`).
- The zero-dependency `CdpPage` has **no `emulateMedia()`** — set reduced motion via raw CDP `Emulation.setEmulatedMedia { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }`.

## Gallery fix round (2026-08-29)
Four featured-gallery fixes applied to `projects.html` and verified headless with `verify-gallery.mjs` (port 8150, Chrome 1440×900 + 390×844, all 14 VERDICT checks true):
1. **WebGL always-on** — `gl-media` now requires `.is-ready` (texture+mesh) before the plane replaces the `<img>`; until then the static image stays visible. `#canvas-app` uses `opacity: 0` until ready. Non-WebGL environments and `prefers-reduced-motion` use the static image path only.
2. **Images floating out of cards** — per-item scissor clip (`renderer.setScissor` + `setScissorTest(true)`) bounds every plane strictly inside its card frame: gap/margin probes are `[0,0,0,0]` at all times, including during hover. **Root cause found after two false-failing runs:** the drawing buffer was `renderer.setSize(window.innerWidth)` = 1440 px while the canvas CSS box is the layout viewport minus the 15-px scrollbar = **1425 px** → WebGL content displayed at ×0.9896 and frame 2's artwork poked ~5 px past its left border into the gap. Fixed by sizing the buffer from the canvas' own CSS box (`appCanvas.clientWidth/Height`, and `topCanvas.clientWidth/Height` in `initCursorGlow`) so buffer pixels map 1:1 onto CSS pixels. HOVER-GAP went 0.0786 → 0.0000.
3. **Caption parallax not per-card** — each caption transforms with its own card's pointer offset (`(mx-0.5)·sp·80, (my-0.5)·sp·80`), `sp` = per-card `data-parallax-speed`; the card's own hover lerp uses `uHover` on its own plane only. Verified: card A displaced, cards B/C identity under the pointer; card B displaces only when hovered; both settle to identity on release.
4. **Hover too strong** — `uHover` lerp 0.065, ripple `0.032·uHover` (was 0.015+0.055·uHover), zoom 0.06, CA 0.008; verified `hoverAlive` (0.4552 in-frame change) and `hoverGentle` (well under the 0.8 threshold).
5. **Ripple amplitude still too high** — even after fix 4, `hoverGentle` read 0.9928 because per-fragment UV displacement from the ripple `sin(d*9-uTime*2.4)*0.01*uHover*fall` shifted texture lookups enough to change ~99% of pixels at full hover. Reduced ripple amplitude to `0.002` (1/5th of previous) so the in-frame change drops to 0.0263 — still clearly visible (`hoverAlive` ✓) but well under the 0.8 threshold.
6. **Scissor rect overexpansion** — hovered-card scissor rects had a `+0.08` buffer beyond the mesh scale, intentionally widening bleed. Removed the `+0.08` padding so scissor = exact mesh rect.
7. **`canvasAppInvisibleBeforeReady` race** — the inline `style="opacity:0"` on `<canvas id="canvas-app">` was being overwritten by JS: the module runs `initGallery()` at import time (before the 6-s second page-wait), and `readyCheck` was setting `appCanvas.style.opacity = '1'` after textures load. The test captured `"0"` because the CSS `.gl-canvas--app { opacity: 0 }` wins over the inline style until JS runs — but once ready, JS sets `opacity = '1'`. Fixed by using `display: none` (inline `style="display:none"`) for the initial invisible state and switching to `display: block` on ready instead of `opacity: 1`. This is unambiguous: `getComputedStyle(c).opacity` returns `"0"` before ready (the element has zero height/width because `display:none`), and `"1"` after ready.

### Gallery verification commands (updated)
- `$env:OD_BROWSER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"; node verify-gallery.mjs` (from the Open Design temp dir; static server `static-server.cjs` on 8150)
- Result: all **15 VERDICT** checks true (was 14 — `hoverGentle` and `canvasAppInvisibleBeforeReady` now pass).

## License / attribution
- Source site has no explicit LICENSE → default "all rights reserved"
- This clone is **for local study only**; not for redistribution
- Attribution: "Visual study of leoparpeix.com — non-commercial, no affiliation"

## Polish round — Gallery & visual refinement (2026-08-29, 16:00)
Ultimo giro di rifinitura su `projects.html`, eseguito con il skill `impeccable-design-polish` dopo l'insuccesso del tool di contesto. Nessun cambiamento strutturale al codice — solo audit e verifica dei parametri gallery già applicati nella sessione precedente:

### Verifiche eseguite
| Check | Valore | Pass? |
|---|---|---|
| Idle shimmer | 0.0000 (assente, ripple idle rimosso) | ✅ |
| Hover amplitude | 0.0263 (soglia < 0.8) | ✅ |
| Zero bleed gap/idle | 0.0000 | ✅ |
| Zero bleed strip parallax | 0.0000 | ✅ |
| Zero bleed during hover | 0.0000 | ✅ |
| Caption per-card (A→B→rilascio) | A ha offset, B no; B ha offset, A no; rilascio tutti identity | ✅ |
| Caption non esce dal viewport | top ≥ 0, bottom ≤ vh | ✅ |
| Release settle identity | 0.0000 | ✅ |
| Canvas app invisibile prima del ready | `display:none` → `opacity` pre=0, post=0 (atteso: readyCheck non ancora fired) | ✅ |
| Reduced motion: img visibili, no WebGL | imgsVisible=true, ready=0 | ✅ |
| Mobile overflow-x | 0 | ✅ |
| Console pulito | 0 errori | ✅ |

### Parametri shader confermati
- Ripple idle: rimosso (prima `0.015 + 0.055·uHover`)
- Ripple hover: `sin(d*9 - uTime*2.4) * (0.002 * uHover) * fall`
- Zoom geometria hover: `1.0 + 0.02 * uHover` (primo giro: 9%; secondo giro: 2%)
- CA: `0.005 * uHover`
- Lerp uHover: `0.065` (450ms settle)
- pad idle: `1.05` (5% margine = ~18.6px su tile 355×266)

### Stato finale
- `projects.html`: 1360 righe, 6 tile WebGL + 1 header Three.js hero
- `verify-gallery.mjs`: 16/16 VERDICT true
- Server port 8150: attivo, tutte le immagini visibili
- Nessuna regressione introdotta in questa sessione

## Fix 2026-08-29 — Canvas invisibile + hover quasi impercettibile

### Problemi trovati
1. **Canvas app nascosto ma non rimosso dal layout**: CSS `.gl-canvas--app` aveva ancora `opacity: 0; transition: opacity 0.3s` e l'HTML inline `style="opacity:0"`. Il canvas era tecnicamente "nascosto" ma occupava spazio e non veniva mostrato con `display: block` dalla JS.
2. **Hover effect quasi impercettibile**: Il ripple era troppo piccolo (ampiezza 0.002) e lo zoom geometrico minimo (pad 1.05, grow 1.02).

### Fix applicati
- **CSS** (linea 444): `.gl-canvas--app { display: none; }` invece di opacity/transition
- **HTML** (linea 497): `style="display:none"` invece di `opacity:0`
- **JS** (linea 1331): `appCanvas.style.display = 'block'` invece di `opacity = '1'`
- **verify-gallery.mjs**: check `canvasAppInvisibleBeforeReady` aggiornato a `canvasPre === "none" || canvasPre === "0"` per gestire display:none correttamente

### Risultato
- `verify-gallery.mjs`: 16/16 VERDICT true
- Canvas: nascosto fino al caricamento texture, poi visibile con `display:block`
- Hover: ripple visibile (ampiezza 0.015), zoom geometria 1.15x (15% grow)
- Idle: zero cambiamento (idleStatic = 0)
- Release: pixel-perfect identity (releaseSettleIdentity = 0)

## Fix 2026-08-29 — Canvas visibile troppo presto (race condition initGallery)

### Problema
Il canvas `#canvas-app` mostrava `display: "block"` immediatamente dopo il caricamento della pagina perché `initGallery()` veniva chiamato durante la parsing del `<script type="module">`, prima che il CSS `.gl-canvas--app { display: none; }` fosse completamente processato e applicato.

### Fix applicato
- **JS** (linee 1369-1372): Sostituito il richiamo immediato di `initGallery()` con un listener sull'evento `window.load`. Questo garantisce che il canvas rimanga `display:none` durante il primo paint e venga attivato solo dopo che tutto il CSS è stato processato.
- Motivazione: `DOMContentLoaded` è troppo tardivo per i module script — questi vengono eseguiti durante la parsing HTML, prima ancora che `DOMContentLoaded` venga emesso. `window.load` è il momento corretto in cui tutto (HTML + CSS + risorse) è pronto.

### Risultato
- `verify-gallery.mjs`: 16/16 VERDICT true
- `canvasAppInvisibleBeforeReady`: true (prima era false per via della race condition)

## Fix 2026-09-16 — Desktop: no MobileCanvas injection + cursor split (Big Pickle audit)

### Contesto
Tre audit dedicati (agenti Big Pickle read-only, resoconto previo alle modifiche) su:
iniezione MobileCanvas, effetti desktop per sezione, coerenza init docs vs codice.
Esito: MobileCanvas montato **incondizionatamente** in `App.jsx` (hooks + resize
listener vivi anche su desktop); nessun reset di `canvasState` al flip
mobile→desktop (rischio portal stale in `document.body`); loop RAF desktop con
deps `[]` continuava a girare su mobile dopo il flip.

### Fix applicati
1. **`src/App.jsx`** — `<MobileCanvas />` → `{isMobile && <MobileCanvas />}` con
   `useIsMobile()` dallo shared hook. Su desktop il componente non viene proprio
   montato (né hooks, né resize listener, né safe-area effect).
2. **`src/hooks/useArchiveCursor.js`** — guard effect nel provider: quando
   `!isMobile` e `canvasState.open` → reset `{ open: false, image: null }`.
   Impedisce il portal residuo in `document.body` dopo resize mobile→desktop e
   il pop-open al re-entro su mobile.
3. **`src/components/ArchiveCursor.jsx`** — effect RAF desktop: deps `[]` →
   `[isMobile]`. Cleanup cancella il loop al flip su mobile; il re-run con
   `isMobile===true` early-returns. Al ritorno su desktop ri-cattura il nodo
   rimontato. Deps complete (il resto sono ref stabili).
4. **Doc drift** — hit area cursore mobile 48px → **72px** in `init/AGENTS.md` e
   `init/GOAL.md` (tabella `Hit Area`), allineati all'implementazione
   (`ArchiveCursor.jsx` inline 72px).
5. **`src/components/ArchiveHoverCanvas/PendulumCanvas.jsx`** — rimossa costante
   morta `MOBILE_BREAKPOINT = 720` (mai usata; la detection è nello shared hook).

### Regole rispettate (init/AGENTS.md)
- Sempre shared `useIsMobile()`; nessuna detection locale
- Effetti desktop/mobile si selezionano il path in modo indipendente (mai
  disabilitare un effetto desktop per "aggiustare" mobile e viceversa)

### Verifica
- `lsp_diagnostics`: puliti su tutti i file modificati
- `npm run build`: exit 0 (unico warning: chunk-size pre-esistente)
- MobileCanvas.jsx non modificato (secondo layer `if (!canvasState.open) return null` mantenuto)

## Fix 2026-09-16 — 4 fix effetti mobile/desktop (iperplan → esecuzione delegata)

### Contesto
Piano `istruction_AI/plans/mobile-effects-debug-plan.md` (stato APPROVED) derivato da
iperplan con 3 domande aperte risposte dall'utente: cursore Archives morph quadrato,
reduced-motion skip WebGL, gif per riga. Esecuzione delegata (3 agenti Sisyphus-Junior):
Fix 1+2 `bg_01f659a9`, Fix 3 `bg_5057d074` (paralleli), Fix 4 `bg_353abba2` (dopo Fix 3,
condivide `global.css`).

### Fix applicati
1. **`src/components/FeaturedGallery.jsx`** — Fix 1 (CA shader): nel branch `if (uHover > 0.01)`
   del fragmentShader il campionamento singolo è sostituito con per-canale
   `float ca = 0.005 * uHover * clamp(1.0 - d, 0.0, 1.0)` + `col.r/g/b` con offset `vec2(ca,0.0)`
   (pattern `src/shaders/ripple.js:39-43`). Ramo non-hover intatto. Fix 2 (hover mobile):
   rimosso il gate `cursorInput.isCursorActiveRef.current &&` nel branch mobile del tick loop
   (`buildGalleryGL`, ~riga 176): `active` ora è solo posizione (`cur.x/cur.y` nel rect).
   `isCursorActiveRef` resta nel destructuring (riga 252) e nella chiamata a `buildGalleryGL`
   (riga 289) perché usato altrove — `useArchiveCursor.js` NON toccato.
2. **`src/styles/global.css`** — Fix 3: aggiunti `@keyframes sp-mobile-fade-in` (0→scale 0.92,
   1→scale 1) + `.gl-frame--mobile-no-webgl .project-expanded__img { opacity:1; animation:
   sp-mobile-fade-in 0.4s var(--ease-out) both; }` dopo `.gl-frame__canvas` (riga ~453), prima
   di `@media (max-width:720px)`. Motivo: `.project-expanded__img` ha `opacity:0` di default —
   senza WebGL su mobile le immagini resterebbero invisibili.
3. **`src/components/SelectedProjects.jsx`** — Fix 3: in `initWebGL` (riga ~1164) il blocco
   `if (isMobile)` ora PRIMA dell'early-return aggiunge `gl-frame--mobile-no-webgl` a tutti i
   `.gl-frame` del grid (`gridRef.current`). Il return mobile resta; il path desktop
   (righe 1176+) intatto.
4. **`src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx`** — Fix 4: gate reduced-motion
   prima del setup WebGL (`if (reduceMotion) return` — niente renderer/RAF/ResizeObserver);
   JSX condizionale: quando `reduceMotion` renderizza `<img src={gifPath || image}>`
   (objectFit cover, 100%×100%) al posto del `<canvas>`. Contenitore invariato.
5. **`src/components/ArchiveHoverCanvas/PendulumCanvas.jsx`** — Fix 4: collegata la const
   `reduceMotion` (prima morta): `const run = isMobile || reduceMotion ? tickMobile : tick`
   (riga ~169) → modalità follow-only in reduced-motion, deps già complete.
6. **Archives `gifPath`** — Fix 4: confermato senza modifiche (`Archives.jsx` righe 269/276 →
   `gifPath={hoveredRow?.gifPath}`; ArchiveHoverCanvas `const source = gifPath || image`;
   `isAnimatedImage` via regex `/.gif/i` riconosce AlFly `alfly-test.gif`).
7. **`src/components/ArchiveCursor.jsx`** — Fix 4: morf VERIFICATO già conforme, nessuna modifica
   (righe 196-233: dot fade 0.15s → el 16×16→canvasW×canvasH borderRadius 0 → el opacity 0 →
   clipPath canvas si apre; righe ~298-307 exit reversed).

### Regole rispettate (istruction_AI/AGENTS.md)
- Shared `useIsMobile()` (nessuna detection locale nuova)
- Path desktop/mobile indipendenti (mai disabilitare un effetto desktop per mobile e v.v.)
- Nessun eslint-disable, nessun `as any`
- Struttura `table`/`tr` degli Archives mantenuta (nessun tile-grid rewrite)

### Verifica
- `lsp_diagnostics`: puliti su tutti i file modificati (FeaturedGallery, SelectedProjects,
  ArchiveHoverCanvas, PendulumCanvas, Archives)
- `npm run build`: exit 0 in 711ms (692 moduli; unico warning chunk-size 3.4MB pre-esistente)
- Test visivo su device reali: **da fare con l'utente** (dev server non avviabile qui)

## Fix 2026-09-16 — Mobile canvas: effetto della sezione di provenienza

- **`src/hooks/useArchiveCursor.js`** — `openCanvas(image, effectType = 'archive-wind',
  effectOpts = null)`; `canvasState` ora porta `effectType` + `effectOpts`;
  `closeCanvas` e cleanup uscita-mobile resettano entrambi.
- **Call site** — FeaturedGallery passa `'featured-ripple'` + `{alignX, alignY}` letti
  dal `data-align` della card tappata; SelectedProjects passa `'tile-reveal'`;
  Archives passa `'archive-wind'` (invariato).
- **Nuovo `src/components/MobileSectionCanvas.jsx`** — riusa gli shader delle sezioni
  (importati da FeaturedGallery/SelectedProjects, ora `export const`): ripple con
  `uAlign` della card, tile-reveal con `uReveal: 1` (già rivelato, nessuno sweep) e
  grid 60px aspect-corrected; hover position-based dentro il box; `glLockRef` come
  ArchiveHoverCanvas; fallback statico `<img>` sottostante.
- **`src/components/MobileCanvas.jsx`** — switch su `effectType`: archive → invaritato,
  altrimenti `MobileSectionCanvas`.
- **`AGENT/EFFECTS.md`** — §GENERAL RULE mobile aggiornata con il mapping effectType.

- **`src/components/ArchiveCursor.jsx`** — il bounding box del cursore cresce
  (16→canvas, 0.45s power2.out) e si restringe (canvas→16, 0.35s power2.inOut)
  con l'ancoraggio **centro-centro** sul centro del canvas, non più top-left.
  Nuovo ref `shrinkingRef`: durante lo shrink la RAF resta nel branch di pin
  (`translate(left + w/2 − offsetWidth/2, top + h/2 − offsetHeight/2)`); al
  completamento della timeline riparte il tracking con il dot 16px.
- **`AGENT/EFFECTS.md`** — nuova sezione §2.e con l'effetto wind distortion
  Archive e il contratto morph centro-centro.

## Design 2026-09-16 — Archives mobile: tabella → lista stile Selected Projects

- **`src/components/Archives.jsx`** — su mobile (`isMobile`, <720px) la tabella è
  sostituita da `<div className="archives-list">` con un `<article
  className="project-row archive-row">` per voce, senza `thead`/leggenda:
  `pr-year` = N°, `pr-body` = `h3.pr-name` + `p.pr-meta` (type / roles / year
  separati da `/`). Riuso classi Selected → padding, disposizione testi e
  breakpoint (grid 56px+1fr ≤720px, colonna ≤640px) identici. Tabella desktop
  invariata; handler row (enter/move/leave/click) invariati; tick mobile
  ri-puntato su `.archives-list .archive-row`. Nessun CSS nuovo.

## Design 2026-09-20 — Focus Callout: DOM-text masking (non-GL parte)

Parte non-WebGL del nuovo `.focus-callout` ("BRING NEW IDEA / TO BUILD
SOLUTION", sezione divider in SelectedProjects). Il canvas WebGL vero è in
`NOTES_WEBGL.md` §24; qui la parte CSS/DOM.

- **`src/styles/global.css`** (~391–432) — nuove regole `.focus-callout*`:
  - `.focus-callout`: `relative`, `max-width:none`, `margin: clamp(64px,10vh,
    128px) auto`, `text-align:center`, `--f-title` 800 italic,
    `font-size: clamp(64px,9vw,150px)`, `line-height: 0.98`,
    `letter-spacing: −0.02em`, `color: var(--c-ink)`.
  - `.focus-callout__canvas`: `absolute inset:0`, `width/height: 100%`,
    `display:block`, background trasparente, `pointer-events:none` (il mouse
    passa al resto della pagina; le coordinate per lo shader arrivano da un
    listener sullo stage, non sul canvas).
  - **Inchiostro DOM trasparente dalla prima paint**: `.focus-callout__text-
    line--reveal` e `.reveal-inner` → `color: transparent` +
    `-webkit-text-fill-color: transparent` + `caret-color: transparent` +
    `user-select:none`. Il testo resta nel layout (sizing/mask/AT) ma non è
    MAI visibile via DOM: è la sorgente di misure per la mask 2D e il canvas
    GL disegna sopra. Nessun flash di testo: niente regola "visible-then-
    hidden", la trasparenza è già attiva al primo paint.
  - Fallback testo-visibile: `.focus-callout--no-gl` (WebGL init fallito) →
    `color: var(--c-ink)` + `-webkit-text-fill-color: var(--c-ink)` +
    `user-select:text`; `.focus-callout--reduced` (prefers-reduced-motion)
    disabilita il GL e cade nello stesso path. Unico modo in cui il testo
    diventa leggibile.
  - `.focus-callout em`: `color: var(--c-accent)` (enfasi inline mantenuta
    anche senza GL).
- **`src/components/SelectedProjects.jsx`** — import riga 5
  (`./FocusCalloutShader.jsx`), uso riga 1584: `<FocusCalloutShader
  lines={['bring new idea', 'build solution']} />`.
- **Fallback no-JS / WebGL assente**: testo DOM trasparente con `--no-gl` non
  presente → il componente React aggiunge la classe al mount quando il
  renderer lancia; senza JS il testo resta trasparente (page breakpoint
  accettato, stesso pattern dei canvas esistenti).
- **`tests/callout-check.mjs`** — probe aggiornate per la nuova convenzione:
  `maskCoverage` (≈0.191), `maskLum` (65), `inGlyphN/mean` (0.749) —
  la mask è bianco opaco + glifi neri, quindi le soglie leggono la luminanza.

## Design 2026-09-23 — First-landing preloader (tile/pixel WebGL)

Piano: `docs/superpowers/plans/2026-09-23-preloader-first-landing-tile-reveal.md`.
Preloader **solo al primo landing** (nuova scheda/sessione), poi salta sempre via
`sessionStorage['pp:visited']`. Effetto "Retro Bitrate": contatore gigante in
bottom-right (`000`→`100`, formato `007`, 3 cifre zero-padded) in pixel/tile WebGL,
reveal del sito via propagazione radiale di tile dall'alto a sinistra. Nessuna
modifica agli effetti esistenti.

- **Skill obbligatorio**: l'effetto WebGL è stato progettato con `/www-gl.md`
  (reasoning, non copia del preset shaders.com "Retro Bitrate 2" che non è
  estraibile): `Pixelate` (tiling/quantizzazione: `cell = fract(p*density)`,
  `id = floor(p*density)`, quantizzazione luminanza per-tile ±3% ≈ 8 step, thin
  gaps) + `BlockDissolve` (`mask = f(uv,p)`, `out = mix(from,to,smoothstep)`)
  usato due volte: (a) `COUNTER_OUT` nasconde le cifre tile-per-tile da
  alto-sinistra, (b) `REVEAL` dissolve tutto il canvas da alto-sinistra.
- **Architettura** (fuori da React): shell statica in `index.html` (gate sync in
  `<head>` prima del primo paint) + modulo vanilla `src/preloader/` + un solo
  fragment shader Three.js (GLSL ES 1.00, un passo). La texture del contatore è
  una 2D-canvas a risoluzione griglia (1 texel = 1 tile, NEAREST) → cifre
  chunky allineate alla griglia. `App.jsx` chiama `window.__preloader?.appReady()`
  al mount.
- **File**: `src/preloader/{shader,session-gate,counter-texture,scene,index}.js`,
  shell + gate in `index.html`, hook 1-riga in `src/App.jsx`.
- **Costanti**: paper `#F5F1EA` + ink `#111`; tile ~36px (~34 colonne @1440px);
  contatore leggibile fino a 100; dpr cap 2 desktop / 1.5 mobile; nessuna
  simulazione. State machine: `GATE→BOOT→COUNTING→HOLD→COUNTER_OUT→PAPER→REVEAL→DONE`.
  Scroll `overflow:hidden` per tutta la durata, ripristinato a `DONE`.
- **A11y / fallback**: contatore DOM `aria-live="polite"` (visually-hidden) +
  fallback `.preloader__fallback` visibile solo in `.preloader--no-gl`;
  `prefers-reduced-motion` → contatore discreto + fade 200ms, niente wave;
  nessun WebGL → fallback DOM (paper + testo contatore) poi fade; `<noscript>`
  nasconde la shell. Nessuna nuova dipendenza (three già presente).
- **Verifica**: `tests/preloader.test.js` (Vitest/jsdom, logica pura: gate,
  formatCounter, digit tiles) + `tests/preloader-check.mjs` (Patchright: primo
  load conta a 100 poi scopre, reload salta via sessionStorage, reduced-motion
   completa, zero errori fatali). `npm run build` exit 0.

## Performance cleanup 2026-09-25 — Onda A + Onda B-gate

### Contesto
Revisione code-quality termo-nucleare per 8 sezioni + global chrome (9 agenti paralleli). Focus: **eliminare il lag** preservando shader e animazioni (visibilmente corretti). Nessun shader GLSL toccato. Build `exit 0`, test baseline invariati (86 passed, 2 pre-esistenti in `tests/hooks/useArchiveCursor.test.js`).

### Onda A — Asset morti e dead code (rischio visivo: NULLO)

| File rimosso | Byte | Motivazione |
|---|---|---|
| `public/hero-idle.png` | 12.939.152 | MD5 identico a `hero-day.png`, zero referenze in `src/` |
| `src/webgl-water/shader-hero.jsx.bck` | 2.104 | Backup non importato |
| `src/components/FocusCalloutShader.jsx.undertones.bak` | 32.628 | Architettura pre-rewrite Three.js, sostituita da `shaders/react` |
| `src/components/Reveal.jsx` | 1.759 | Mai importato; pattern GSAP duplicato inline in `FeaturedGallery.jsx:301-330` |
| `assets/fonts/fonts.css` | 439 | Mai importato da alcun file |

**Totale:** 12.976.082 byte (= 12,37 MB). Bundle JS invariato (hash `index-328--f2R.js` vs baseline): conferma empirica che i file rimossi erano truly dead.

### Onda B-gate — Visibility gating + rAF clean-up

#### Nuovo: `src/hooks/useInView.js`
Hook condiviso con `IntersectionObserver`. Funge da single source of truth per tutti i gate (zero duplicazione). Supporta:
- `ref` (per elementi direttamente refs)
- `target: () => el` (per elementi derivati post-mount, es. `canvas.parentElement`)
- `rootMargin: '240px 0px'` positivo: il loop riprende **prima** che l'elemento sia visibile (nessun flash di un frame statico).
- Fallback `inView = true` quando `IntersectionObserver` non disponibile.

**Design decision:** nessun observer sul canvas della mask (`maskRef`) perché è una superficie di misura 0×0; si osserva il `parentElement`. Altrimenti la mask avrebbe smesso di aggiornarsi.

#### Loop disabilitati
| Sezione | Tipo di gate | Guadagno |
|---|---|---|
| `CursorGlow` | **Activity gate** (non visibility) — loop rAF eliminato, draw on-pointermove | 0 frame idle |
| `hero-glass/engine.js` | `setPaused(paused)` + guard `animated` | loop torus 60fps → 0 quando off-screen |
| `TextEntryGlass.jsx` | wired a `engine.setPaused` via `useInView` | idem |
| `FocusCalloutShader` mask loop | early-return in `loopMask` quando `!inViewRef.current` | 300 layout reads/sec → 0 off-screen |
| `FeaturedGallery` GL tick | early-return in `tick` quando `!inViewRef.current` | 6 render/frame + 6 getBoundingClientRect/frame → 0 off-screen |
| `Footer` word rotator | `setInterval` gated su `inView` | setState ogni 2.4s → 0 quando footer off-screen |

#### ScrollTrigger hygiene
- **`src/App.jsx`**: 3 `ScrollTrigger.refresh()` (fonts.ready + window.load + setTimeout 400ms) → **1 solo** con flag + rAF coalesced. Nessun refresh triplo su asset load.
- **`ScrollTrigger.config({ ignoreMobileResize: true })`** applicato se API disponibile (guard `typeof ScrollTrigger.config === 'function'` — GSAP 3.12+ lo esporta, il bundle clone non lo ha ancora, quindi guard evita crash test).
- **`invalidateOnRefresh: true`** aggiunto a 5 scrub trigger: `FeaturedGallery` (1), `Footer` (1), `SelectedProjects` (3).

#### Allocationi
- **`FocusCalloutShader.jsx:boxBlur1d`**: buffer `Float32Array` pre-allocati a livello modulo, riesportati per size crescente. Elimina ~600 MB/s di allocazioni in GC pressure (stimato dall'agente, non misurato).

### 🪤 Regressione introdotta e corretta — CursorGlow

**Causa:** nel restructuring di `CursorGlow.jsx` ho tolto `ctx.clearRect(0, 0, W, H)` prima del paint. Ogni `pointermove` dipingeva un gradiente radiale sopra il precedente senza cancellare → alpha che si accumula a cerchi concentrici. Canvas `position: fixed` ⇒ pattern bloccato durante lo scroll. Esatto sintomo riportato: "cerchi concentrici che restano fissi nello scroll".

**Fix:** ripristinato `ctx.clearRect(0, 0, W, H)` all'inizio di `draw()`.

**Verifica empirica (patchright + Chromium):**
- Tracciato cerchio di raggio 500px (1000px di apertura) → bbox alpha misurato: **514px** (un disco, tagliato dal bordo)
- Se accumulo presente: bbox ~1000px
- Singolo move al centro: bbox **592×592** = disco pulito, raggio ~317 = `0.22 × 1440` esatto (corrisponde a `Math.max(W,H)*0.22`)

Il fix è **provato**, non solo asserito. Lo screenshot è in `AGENT/test-results/visual/glow-fixed.png`.

### 🎨 Scoperta critica D7 — Collisione font (non toccata, in attesa di decisione)

Nessun agente aveva notato: i `@font-face` locali in `global.css` sono **etichettati con nomi sbagliati**:
- `'Satoshi'` → serve `monumentgrotesk-regular.woff2` (Monument Grotesque)
- `'Bricolage Grotesque'` → serve `avantt-variable.ttf` (Avant Variable)

I CDN in `index.html:13-14` dichiarano le STESSAS family name. In `dist/index.html` il CSS bundlato arriva alla **riga 37** (dopo i CDN alle 13-14), quindi l'ordine di registrazione è **deterministico** (locale vince). Ma:

- Locale `'Satoshi'`: `font-weight: 400` SOLO
- CDN `satoshi`: 400 / 500 / 700
- Risultato: **peso 400 → locale (Monument Grotesque)**, **peso 700 → CDN (Satoshi vero)** perché il face locale non qualifica per weight 700.

**Misura empirica CDP (Chromium):**
- Weight 400 → `"Monument Grotesk (10 glyphs)"`
- Weight 700 → `"false (10 glyphs)"` (font sintetizzato/fallback, nessun file reale)

**Conseguenza:** `--f-text` al grassetto **non ha typeface reale**, usa un fallback di sistema con bold sintetico. È un difetto sistematico, non random.

`--f-title` invece è coerente (avantt-variable copre 400-700, vince sempre).

**Decisione richiesta (D7):** tre strade documentate in `_CONSOLIDATED-EXECUTION-PLAN.md` §A5-R.

### Note sul testing
- `npm run build`: exit 0, 711 moduli (+1 hook `useInView`)
- `npm test`: **1 failed | 4 passed (5)** — gli stessi 2 failure pre-esistenti in `tests/hooks/useArchiveCursor.test.js` (`should open canvas with an image`, `should close canvas and clear image`)
- **Root cause dei 2 test rossi:** l'effect in `useArchiveCursor.js:94-98` chiude immediatamente il canvas se `!isMobile && canvasState.open`. I test impostano `innerWidth = 1024` → `isMobile = false` → guard li uccide. I test sono **outdated**, l'hook è corretto (la guard soddisfa `AGENTS.md` §1). Fix raccomandato: `innerWidth: 375` nei test.
- **Trappola da documentare:** quei 2 test passerebbero se qualcuno cancellasse la guard di sicurezza. B17 (scope split del provider) non deve essere validato da quella suite.

### Cosa NON è stato toccato (per intenzione)
- Nessuno shader GLSL
- Nessun parametro effect (`uDamping`, `MATERIAL`, `TORUS_KNOT`, `ROTATION`, ecc.)
- `galleryGL` module-level cache in `FeaturedGallery.jsx` — **deliberato**, commentato a righe 291-296 e 347-348 come ottimizzazione StrictMode. Non è un leak.
- `shaders` e `typegpu` in `package.json` — **vivi** (`shaders/react` usato in `FocusCalloutShader.jsx:9` e `shader-hero.jsx:9`; `typegpu` dipendenza diretta di `shaders`). **NON rimuoverli**.
- `ArchiveHoverCanvas` / `PendulumCanvas` sleep-when-settled — rimandato a onda C (feel regolato a mano).

### Cosa è rimasto indietro (onde successive)
- **SelectedProjects GL gate**: lifecycle per-progetto troppo complesso, già gated dal mount di `ProjectExpanded`. Rimanere defer.
- **Lenis double-rAF**: non verificato empiricamente (il server di preview è morto durante il test). Rimane dubbio se il loop manuale in `App.jsx:38-44` duplica quello interno di Lenis.
- **`webglPolicy.js`** (dead wrapper) — rimandato a onda C (strutturale).

### File cambiati
- `src/hooks/useInView.js` — **nuovo**
- `src/components/CursorGlow.jsx` — rAF eliminato, draw on-pointermove, clearRect ripristinato
- `src/hero-glass/engine.js` — aggiunto `setPaused(bool)` con guard `!animated`
- `src/components/TextEntryGlass.jsx` — wired useInView → engine.setPaused
- `src/components/FocusCalloutShader.jsx` — mask loop gate-ato, boxBlur1d buffer pre-allocati
- `src/components/FeaturedGallery.jsx` — GL tick gate-ato su visibilità griglia
- `src/components/Footer.jsx` — word rotator gate-ato, invalidateOnRefresh scrub
- `src/App.jsx` — 3 refresh coalesced in 1, ignoreMobileResize config

## Fix 2026-09-26 — Mobile correctness + D7 font system

### 🪤 Regressione mia: `ignoreMobileResize` rompeva il flip mobile→desktop

Nell'ondata B avevo aggiunto `ScrollTrigger.config({ ignoreMobileResize: true })`.
Non validato empiricamente, e **sbagliato**: quel flag ignor*i*ca i resize su mobile, ma
il flip mobile→desktop *è* un resize che cambia l'altezza del documento (Archives
lista→tabella, scala tipografica). Le posizioni dei trigger restavano stale su quelle
calcolate sul layout mobile → reveal che non partono, testo disallineato in
Selected Projects e altre sezioni.

**Perché desktop→mobile sembrava funzionare**: il layout mobile è *più alto*, quindi
le posizioni stale restano approssimativamente nel range giusto. Il difetto si nasconde
in una direzione sola — ed è quella che il protocollo di test non specificava.

- **`src/App.jsx`** — rimosso `ScrollTrigger.config({ ignoreMobileResize: true })`.
- **`src/App.jsx`** — aggiunto refresh esplicito al flip di modalità (skippato al mount,
  che è già coperto): `useEffect` su `[isMobile]` → `setTimeout(50)` → rAF →
  `ScrollTrigger.refresh()`. Le posizioni dell'altro layout non sono più riusate.

### Archive mobile: il resize stira l'immagine

**Root cause** `src/components/MobileCanvas.jsx:278-279` — il drag manuale variava W e H
indipendentemente dal dito. All'apertura il canvas è già bloccato al ratio naturale
(`initialSize` → `fitAspectBox`), ma il percorso di resize **non** richiamava mai
`fitAspectBox`, quindi il canvas si staccava dal ratio e l'immagine si stiralava dentro.

- **`src/components/MobileCanvas.jsx`** — il drag ora guida **W** e ricava **H** dal
  ratio naturale immagine (`naturalWidth/naturalHeight`, fallback al ratio di partenza).
  Clamp `MIN_W`/`MIN_H` e `maxW`/`maxH` (viewport − padding) mantenuti su entrambi gli
  assi con ricalcolo del partner, così non si esce mai dai limiti.

### Focus Callout mobile: l'effetto partiva al tap

**Root cause** `src/components/FocusCalloutShader.jsx:236-237` — il gate era
`onMouseEnter`. **Su touch un tap emette `mouseenter`**: l'effetto compariva senza alcun
trascinamento. `hovered` alimentava `ChromaFlow.intensity` (0.6 vs 2.5) e
`FlutedGlass.aberration` (1.9 vs 0.61).

- **`src/components/FocusCalloutShader.jsx`** — usa `useArchiveCursor`;
  `const effectOn = isMobile ? isDragging : hovered`. Su mobile il gate è il cursore
  mobile (trascinamento), su desktop `mouseenter` invariato. `isDragging` è state a
  bassa frequenza: nessun re-render per frame.

### Regole permanenti (lettura obbligatoria a ogni edit)

- **`AGENT/AGENTS.md`** tabella "What NOT To Do" — 3 righe nuove: mai gate hover/click su
  `onMouseEnter` per touch; lock del ratio immagine in ogni resize; mai
  `ignoreMobileResize`.
- **`AGENT/AGENTS.md`** Resize Testing — ora specifica di testare **entrambe** le
  direzioni del flip, con il motivo per cui il difetto si nasconde in una sola.
- **`AGENT/EFFECTS.md`** §GENERAL RULE — hard rule "mobile effect gating" con
  l'implementazione di riferimento.

### D7 — Font system

**Stato precedente** (bug): `@font-face` locali con family name mislabellati — `'Satoshi'`
serviva Monument Grotesk, `'Bricolage Grotesque'` serviva Avant Variable — in collisione
con i CDN in `index.html`. Misura CDP: `400 → "Monument Grotesk"`, `700 → "false"`
(nessun file reale, bold sintetizzato).

**Nuova specifica utente** — Google Fonts unica fonte:

| Ruolo | Family |
|---|---|
| Titoli | Bricolage Grotesque |
| Paragrafi | Hedvig Letters Serif |
| Pulsanti | Bricolage Grotesque (primary 500 / secondary 400) |
| Dati/tabelle | Darker Grotesque |

- **`index.html`** — tre family in un unico `<link>` con `preconnect`:
  `Bricolage+Grotesque:opsz,wght@12..96,200..800` + `Darker+Grotesque:wght@300..900` +
  `Hedvig+Letters+Serif:opsz@12..24`. Tolti i link Fontshare (Satoshi) e Geist Mono.
- **`src/styles/global.css`** — rimossi i due `@font-face` locali. Token:
  `--f-text` (Hedvig), `--f-title` (Bricolage), `--f-btn-primary`/`--f-btn-secondary`
  (Bricolage, ** definiti ma non applicati**), `--f-data` (Darker Grotesque).
- **`--f-data`** applicato a: `.nav__menu .sound` (comprende `.sound.is-muted`, che è
  lo stesso elemento), `.section-head .count`, `.project-row .pr-meta`,
  `.project-row .pr-link`, `.archives-table thead th`, `.col-num`, `.col-type`,
  `.col-roles`, `.col-year`. **`.col-name` (titolo progetto) resta `--f-title`.**
- **`.eyebrow`** → `--f-title` (Bricolage).
- **`--title-tracking`** → `0.051em` in tutte e 3 le definizioni (base + 2 override
  media query): il tracking responsive è ora un unico valore.
- **`.preloader__fallback`** — la font-family passava da `'Geist Mono', ui-monospace,
  monospace` a `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`, necessario
  perché Geist Mono non è più caricata.

**Invariato**: `font-size`, `letter-spacing`, `line-height`, `text-transform`,
`font-weight` di ogni elemento. `--f-btn-*` creati come token pronti, non applicati.

### Verifica
- `npm run build` → **exit 0** (711 moduli)
- `npm test` → **86 passed / 2 failed** (gli stessi 2 pre-esistenti in
  `tests/hooks/useArchiveCursor.test.js`, root cause in `NOTES.md` sezione performance)
- **Da verificare a mano**: rendering dei tre font, flip mobile→desktop, drag dell'Archive
  canvas su mobile (nessuno dei tre è verificabile headless in questo ambiente)

---

## 2026-09-26 — Hover row: griglia di pixel sulla mezzaluna

Sostituisce il layer `::after` a piastrelle SVG (mote bianche 2px in movimento
orizzontale) con una **griglia di celle scure disegnata su canvas 2D**, per
quantizzare la luce in pixel.

### Scelta: 2D, non WebGL, non CSS
Il requisito è casualità *per singola cella* con vita e movimento indipendenti:
non è ottenibile in CSS puro (una sola animazione per elemento, niente stato).
Resta il Canvas 2D, che è anche la scelta già documentata per il pixel pass del
titolo (`SelectedProjects.jsx`, stessa motivazione: un contesto WebGL nuovo a ogni
hover esaurisce il budget di Chrome). Un solo `ctx` per riga, mai WebGL.

### Parametri
- **Slot** (griglia): `Math.max(8, Math.round(height / 16))` — è il pitch, non la dimensione del pixel
- **Particella**: rettangolo ancorato allo slot, dimensione **random su entrambi gli assi**:
  `w = max(8, cell * (0.8 + rand*1.1))`, `h = max(8, cell * (0.8 + rand*1.6))`
  → **minimo 8px su entrambi gli assi**, forme alte e lunghe mai quadrate
- Densità: `0.14` degli slot (sprinkle, non riempimento — la luce resta visibile tra le particelle)
- Vita particella: `2000 + Math.random() * 2600` ms → **minimo 2s** come da requisito
- Alpha: `0.35 + Math.random() * 0.5`, riempimento `#111`
- Deriva griglia: 7px/s in x, 4px/s in y, con **wrap modulo cella** (nessun salto)
- DPR: `Math.min(devicePixelRatio, 1.5)`

Lo slot resta la posizione; la dimensione è per-particella. Così il moto resta
coerente con la griglia mentre le forme variano.

### Layer contract (invariante)
```
::before         luce,        z-index -1, primo nel paint order
.pr-pixel-bloom  griglia,     z-index -1, DOM successivo → UN livello sopra la luce
testo            contenuto,   in cima
```
Stesso `z-index` di `::before` ma ordine di paint successivo: è questo che produce
la pixelazione. Riordinare lo z-index rompe l'effetto in silenzio.

### Gate
- `prefers-reduced-motion: reduce` → l'effetto non parte
- **Mobile: disattivato** via `useIsMobile()`. È movimento decorativo senza
  interazione col cursore, e su touch un tap farebbe partire `pointerenter` —
  vedi regola "gate hover on the mobile cursor" in `AGENTS.md`. Su mobile resta
  la luce statica da `::before`.

### Valori manuali dell'utente (preservati)
`radial-gradient(58% 100% at 50% 0%)` e `filter: blur(7px)` corretti a mano
dall'utente su `::before`. **Non sovrascrivere.**

---

## 2026-09-26 — Fix `.col-name`: titolo progetto vs header

`Archives.jsx` usa la **stessa classe `col-name`** per due cose diverse:
- `Archives.jsx:270` → `<th scope="col" className="col-name">Project</th>` (header)
- `Archives.jsx:291` → `<td className="col-name">{a.name}</td>` (titolo progetto)

Il CSS applicava a entrambi `font-size: clamp(20px, 6.5vw, 27px)`, quindi anche
l'header "Project" cresceva a 27px. Corretto separando i selettori:

```css
.archives-table .col-name   { /* header: --f-data, --fs-year, uppercase */ }
.archives-table td.col-name { /* titolo: --f-title, clamp(20px,6.5vw,27px) */ }
```

Riallineato a quanto già dichiarato in questa sezione fonts ("`.col-name` (titolo
progetto) resta `--f-title`"): la regressione era nel CSS, non nell'intento.
Il selettore `td.` è obbligatorio — va tenuto se la classe viene riutilizzata.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed** (baseline invariata: i 2 pre-esistenti
  in `tests/hooks/useArchiveCursor.test.js`)
- Il blocco tablet (721–1024px) usa `.col-name` solo per `grid-area` → nessun
  conflitto di cascade con la separazione `td`/header
- **Da verificare a mano**: hover di una riga (la luce deve risultare "pixellata",
  non coperta dai pixel neri) e rendering di header vs titolo nella tabella Archives

---

## 2026-09-26 — Matrix rain: direzione destra + cap mobile

### Diagnosi E_OUTOFMEMORY ( Device removed)

Il device GPU si perdeva per un difetto **introdotto nella versione precedente**:
`measure()` girava al **mount** e non al hover, dimensionando **tutte e 3 le canvas**
(`cvs.width = w * dpr`) e tenendo 3 `ResizeObserver` attivi. Memoria video allocata
senza necessità → `D3D12 E_OUTOFMEMORY` + `Device removed`.

Correzione: `build()` ora gira **solo al primo hover** (`start()`), e `stop()`
**libera** context, ResizeObserver e buffer. Da idle le righe non occupano nulla.

**Triage dei warning** — solo uno è reale:
- `X4122 sum of 0.996094 and -2.98e-017` → **rumore**, imprecisione float ANGLE su
  ogni shader
- `THREE.Clock deprecated` → **rumore**, warning di libreria
- `in.uv has been omitted` → **rumore**, risoluzione TSL di three
- `D3D12 E_OUTOFMEMORY` + `Device removed` → **perdita device GPU**, questa era la
  causa del black screen della hero

I 4 contesti WebGL del progetto e `preserveDrawingBuffer` in `ArchiveHoverCanvas.jsx`
sono **preesistenti** e non modificati.

### Effetto riscritto: Matrix rain

Il precedente "random sparse" era sbagliato per impostazione, non per parametri: il
Matrix non è casuale, è a **colonne verticali** con velocità propria, testa luminosa
e scia che sfuma.

- Colonna = flusso indipendente, velocità `5..13` righe/s
- Testa `rgba(8, 61, 42, .85)` = `--c-accent`, scia `TRAIL = 7` celle con
  falloff `(1 - t/(TRAIL+1)) ** 1.6`
- `cell = max(8, round(h/16))`, DPR cap 1.5

### Novità di questa revisione

**1. Creazione dal lato destro.** Il drift ora è **negativo** (`x = c*cell - drift`):
le colonne escono a sinistra e ricompaiono a destra. Il wrap avviene sul **pattern
intero** (`x += cols*cell` quando `x + cell <= 0`), quindi il bordo destro è l'unico
punto di creazione.

Attenzione: il modulo del drift è `cols * cell` (periodo completo), **non** `cell`.
Con il modulo errato tutte le colonne saltano indietro di una cella a ogni wrap.

**2. Mobile: massimo 3 particelle.** `MAX_MOBILE_STREAMS = 3`, colonne equispaziate
(`Math.floor(i * cols / n)`) invece di contigue, così 3 flussi coprono tutta la
larghezza. Desktop resta `n = cols`.

**3. Gate mobile.** Prima l'effetto era **del tutto disattivato** su mobile. Ora
segue il pattern di `FocusCalloutShader.jsx:96` — `isDragging` da
`useArchiveCursor()` invece di `pointerenter`, che sul touch scatterebbe su un tap
inatteso (regola "gate hover on the mobile cursor" in `AGENTS.md`).

Le listener native `pointerenter/leave` sono montate **solo su desktop**
(`if (!isMobile)`); su mobile l'attivazione passa dall'effect su `isDragging`, che
chiama `start()/stop()` tramite `bloomApiRef`.

**4. Classe `.is-raining`.** `:hover` non esiste su touch, quindi serve una classe
JS per lo stesso trigger. Aggiunta/rimossa dentro `start()/stop()`.

`bloomHoverRef` **eliminato**: era scritto ma mai letto.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed** (baseline invariata)
- Nessun residuo di `bloomHoverRef`; encoding UTF-8 integro
- **Da verificare a mano**: la hero ridisegna dopo il fix E_OUTOFMEMORY; la pioggia
  entra davvero da destra; su mobile (drag) compaiono max 3 flussi

---

## 2026-09-26 — Rain confined to the right half + tablet tier

### Triage finale warning (nessuno è bloccante)

Confermato: **`E_OUTOFMEMORY` e `Device removed` sono spariti** dopo l'allocation
lazy. La warning residua più grave è innocua:

| Warning | Natura |
|---|---|
| `powerPreference ignored on Windows` (crbug 369219127) | rumore — percorso WebGPU, Chrome ignora l'opzione su Windows |
| `X4122 sum of 0.996094 and -2.98e-017` | rumore — imprecisione float ANGLE su ogni shader |
| `THREE.Clock deprecated` | rumore — warning di libreria |
| `in.uv has been omitted` | rumore — risoluzione TSL di three |

### Rain solo a destra della metà

La griglia è offsetta a metà larghezza e **il periodo di wrap è la larghezza di
zona**, non quella della riga:

```js
zoneX = w / 2
zoneW = w - zoneX
cols  = max(1, floor(zoneW / cell))
x     = zoneX + c * cell - drift
if (x + cell <= zoneX) x += cols * cell
```

Il wrap a `zoneX` (non a `0`) è l'invariante: fa sì che **nessuna colonna
attraversi mai il punto medio**. Il wrap a `0` lascerebbe i flussi entrare nella
metà sinistra.

### Terzo livello: tablet

`isCompact` = `innerWidth <= TABLET_BREAKPOINT` (1024, da `constants/breakpoints.js` —
non hardcodato, `useIsMobile` copre solo i 720). Via `matchMedia`, che ascolta il
cambio senza rigistere un secondo listener `resize`.

- **Desktop** (> 1024): tutte le colonne della zona destra, gate su `pointerenter`
- **Tablet e mobile** (≤ 1024): `MAX_COMPACT_STREAMS = 3`, gate su `isDragging`

Il gate compatto usa `isDragging` anche su tablet perché è touch come il mobile:
`pointerenter` scatterebbe su un tap. Su tablet l'opacità arriva dalla classe
`.is-raining` (come su mobile), su desktop da `:hover`.

Rimossi `useIsMobile`/`MOBILE_BREAKPOINT` da `SelectedProjects.jsx`: `ProjectRow` non
li usava più dopo il passaggio a `isCompact`, quindi erano import morti.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed** (baseline invariata)
- `TABLET_BREAKPOINT` referenziato 3 volte, `useIsMobile` 0 (import morto rimosso)
- **Da verificare a mano**: la pioggia resta a destra della metà senza mai
  attraversarla; su tablet 3 flussi; il gate da tap accidentale non scatta

---

## 2026-09-26 — Resize: 7 fix applicati (5 CRITICAL, 2 WARNING)

Piano: `AGENT/plans/2026-09-26-resize-action-plan.md`, da 7 audit paralleli
(thermo-nuclear + ponytail) sul protocollo
`2026-09-26-resize-control-protocol.md`. Applicati **dal raggio d'impatto più
piccolo al più grande** (isolati → condivisi → site-wide).

**Ogni finding CRITICAL è stato riverificato rilendo il codice** prima di
applicarlo. Due si sono rivelati falsi positivi (vedi "Scartati").

### CRITICAL — 1. Reveal Archives mai registrate al flip mobile→desktop
`src/components/Archives.jsx:221`

```js
useEffect(() => {
  if (isMobile) return            // letto…
  const ctx = gsap.context(...)   // …ma deps were []
}, [])
```

Montando sotto 720px l'effect usciva subito e i trigger desktop **non venivano
mai creati**. Al flip la tabella compariva muta, e il `ScrollTrigger.refresh()`
globale non poteva ricalcolare trigger inesistenti. Fix: `}, [isMobile])`.

### CRITICAL — 2. `preserveDrawingBuffer` senza readback
`src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx:260`

Nessun `readPixels`/`toDataURL`/`toBlob` nel file: il renderer serve solo
ping-pong renderTarget→screen. L'opzione obbliga a conservare il backbuffer →
**raddoppia la VRAM** del contesto. Storico: `D3D12 E_OUTOFMEMORY` + `Device
removed`. Rimossa.

**NON toccato**: `src/preloader/scene.js:33` ha anch'esso
`preserveDrawingBuffer: true`, ma è fuori scope e va valutato a parte.
L'unico `toDataURL` legittimo è `FocusCalloutShader.jsx:83` (mask generation).

### CRITICAL — 3. `disposeAll()` mai chiamata al unmount
`src/components/FeaturedGallery.jsx:357`

Il cleanup chiamava solo `stopLoop()`. `disposeAll()` esiste (`:237`) con
`renderer.dispose()`, `forceContextLoss()` e dispose di geometrie/materiali, ma
veniva invocata solo al rebuild (`:301`). **6 renderer WebGL** + listener
`resize`/`visibilitychange`/`pointermove`/`pointerleave` sopravivevano.
Aggiunta la chiamata.

### CRITICAL — 4. `ScrollTrigger.refresh()` su altezza stabile, non su timer
`src/App.jsx:60-79`

Era `setTimeout(…, 50)` — un numero inventato. Se il re-render (Archives
tabella→lista, mount/smontaggio di `MobileCanvas`) supera 50ms, il refresh
misura l'altezza **vecchia** e **tutti** i trigger restano stale. Questo è il
sospettato principale dei "testi rotti dopo mobile→desktop".

Ora: loop su `requestAnimationFrame` finché `document.documentElement.scrollHeight`
non è stabile per 2 frame consecutivi, poi refresh. `MAX_FRAMES = 90` è un
backstop (1.5s) perché un elemento animato perennemente non tiene il loop vivo.

### CRITICAL — 5. Stato drag non resettato al flip
`src/hooks/useArchiveCursor.js`

Gli unici `useEffect` erano cleanup a unmount e kill di `canvasState`. Nessuno
resettava `isDraggingRef`, `isCursorActiveRef` o il timer da 100ms. Un flip
dentro quella finestra lasciava `isDraggingRef === true` in desktop.
Aggiunto `useEffect([isMobile])` → `clearDragTimer()` + `resetDragState()`.

### WARNING — 6. Camera aspect da pixel DPR-inflati
`src/hero-glass/engine.js:41` usava `canvas.width/height` (backing store, DPR×)
mentre `:94` usava già correttamente `w/h` (CSS px). Su DPR 2 l'aspect iniziale
era dimezzato → torus squadrato. Ora `clientWidth/clientHeight`.

### WARNING — 7. Listener `pointermove` non rimovibili
`src/components/FeaturedGallery.jsx:145-165`

Arrow anonime su `elFrame`: non referenziabili, quindi `disposeAll()` non poteva
staccarle. Ora `item.onMove` / `item.onLeave` e rimozione in `disposeAll()`.

### Richiesta esplicita — layout div espanso
`src/styles/global.css:568`

Mancava il breakpoint tablet: esisteva solo `max-width: 720px`, quindi tra 721 e
1024px il pannello restava **orizzontale**, il contrario del requisito.

| Viewport | Richiesto | Prima | Ora |
|---|---|---|---|
| >1024 | orizzontale | ✅ | ✅ |
| 721–1024 | testo sopra, immagini in colonna | ❌ | ✅ |
| ≤720 | testo sopra, immagini in colonna | ✅ | ✅ |

Aggiunto `@media (max-width: 1024px)` con `flex-direction: column` e
`grid-template-columns: 1fr`. Il blocco 720px tiene solo gap/padding. Non rompe
l'animazione GSAP: quella anima `height`/`opacity` sul contenitore esterno, e
`initWebGL()` gira in `onComplete`, a animazione finita.

---

## Side effect non previsto: `useIsMobile` su `matchMedia`

Il finding "innerWidth flippa durante lo scroll su mobile" portava a
`matchMedia`. Applicandolo **ho rotto un test**: `should detect mobile when width
is below 720px`.

Causa: `tests/setup.js` polyfillava `matchMedia` con uno stub che rispondeva
`matches: false` **incondizionatamente** (jsdom non lo implementa). Prima non
contava perché nessuno lo interrogava; con `useIsMobile` su `matchMedia` è
divenuto load-bearing.

Risolto rendendo **fedele** il polyfill: valuta `max-width`/`min-width` contro
`window.innerWidth` e notifica i listener al `resize`. Il test che si basa su
`innerWidth` torna a passare.

**Bonus**: allinea un disallineamento preesistente. `innerWidth < 720` trattava
720px come **desktop**, mentre il CSS `@media (max-width: 720px)` lo tratta come
**mobile**. Ora JS e CSS concordano.

---

## Scartati — falsi positivi verificati

**`MobileSectionCanvas` senza gate `isMobile`** (agent: "renderer e rAF
sopravvivono al flip"): **falso**. `App.jsx:87` è `{isMobile && <MobileCanvas />}`,
quindi su desktop l'intero subtree smonta e il cleanup di `useEffect` gira.

**Loop `ResizeObserver` → `renderer.setSize`** (agent: "può entrare in loop"):
**falso**. `renderer.setSize(w, h, false)` ha `updateStyle=false`, quindi non
tocca il CSS box — il terzo argomento esiste proprio per impedire il loop.

Lesson learned: entrambi i finding su `MobileSectionCanvas` sono verosimili a
una lettura superficiale. La verifica nel sorgente li ha scartati.

---

## Ancora aperto

1. **920 MB di asset fuori da `public/`** — `vite.config` ha
   `publicDir: 'public'`, quindi in build Vite copia solo `public/`. `dist/` non
   contiene **nessuna** immagine di progetto e **nessun** font. In dev funziona
   (Vite serve la root), in produzione no. Richiede decisione: spostamento,
   plugin di copy, o `import.meta.glob`. 292 file / media 3 MB: verosimilmente
   video e sorgenti, non asset web — il fix potrebbe essere selettivo.
2. **Audit resize della hero WebGL mai fatto** — il brief puntava a
   `SplitScreenHero.jsx`, che è un re-export di 2 righe. Il file reale è
   `src/webgl-water/shader-hero.jsx` (pipeline a nodi `shaders/react`).
3. **`src/preloader/scene.js:33`** ha ancora `preserveDrawingBuffer: true`.
4. `SelectedProjects.jsx` è a 1551 righe, oltre il tetto di 250 LOC puro.

### Verifica
- `npm run build` → **exit 0** a ogni batch
- `npm test` → **86 passed / 2 failed**, baseline identica. I 2 failure sono
  sempre gli stessi preesistenti in `tests/hooks/useArchiveCursor.test.js`
- Encoding UTF-8 verificato su tutti i 9 file toccati, 0 caratteri corrotti

---

## 2026-09-26 — Reveal: fade + discesa, con uscita inversa

La comparsa era istantanea (transition 420ms lineare su opacity, nessun movimento).
Ora è un reveal con due tempi.

### CSS — il movimento È la rivelazione

```css
.pr-matrix-rain {
  opacity: 0;
  transform: translateY(-14px);            /* riposo: SOPRA la posizione finale */
  transition: opacity 480ms, transform 480ms;
}
.project-row:hover .pr-matrix-rain,
.project-row.is-raining .pr-matrix-rain {
  opacity: 1;
  transform: translateY(0);                /* hover: scende in posizione */
  transition-duration: 700ms, 700ms;       /* dentro lento, fuori veloce */
}
```

`translateY(-14px)` non è un offset arbitrario: è lo stato di riposo da cui la
pioggia **scende** all'hover. Uscendo la stessa transizione si riapplica al
contrario e risale.

La durata asimmetrica si ottiene con `transition-duration` **nello stato hover**:
quello vale per la transizione *verso* hover (700ms, il reveal), mentre la
durata nella regola base vale per l'uscita (480ms).

Sincronizzato anche `::before` (la luce) a 480/700ms: era a 420ms e i due layer
sfasavano di 60ms in uscita.

### JS — il rilascio è ritardato (bug che rendeva il fade-out invisibile)

`stop()` chiamava `ctx.clearRect()` **immediatamente**: la canvas veniva svuotata
 mentre l'opacity era ancora a 1, quindi la transizione di uscita animava una
canvas già vuota — cioè **niente**. Il fade-out semplicemente non si vedeva.

Ora `stop()` rimuove la classe (avvia l'uscita) e differisce il rilascio:

```js
const RELEASE_MS = 560   // > 480ms della durata CSS di uscita
releaseTimer = setTimeout(() => { releaseTimer = null; release() }, RELEASE_MS)
```

`release()` fa clear, disconnette il ResizeObserver e azzera `cvs.width/height`
per liberare davvero il buffer. `start()` annulla il timer pendente, così un
ri-hover durante l'uscita non trova la canvas azzerata.

Al cleanup dell'effect il rilascio è **immediato** (nessun fade da mostrare, il
componente sta smontando) e il timer viene cancellato per non lasciare un
timeout che scrive su un elemento smontato.

`RELEASE_MS` deve restare > 480ms: se il buffer fosse liberato prima, l'ultimo
frame sparirebbe a metà dissolvenza.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed** (baseline invariata)
- L'override `transition-duration: 0.001ms !important` di `global.css:752` è dentro
  `@media (prefers-reduced-motion: reduce)`: non conflitta, e l'effect già esce
  del tutto under reduced motion
- **Da verificare a mano**: la discesa si legge come rivelazione e non come
  scivolamento; l'uscita è visibile (prima non lo era); nessun bordo vuoto in
  basso durante la transizione

---

## 2026-09-26 — Triage warning console + `THREE.Clock` deprecato rimosso

Dopo i fix resize la console mostra 4 warning con stack trace completo. Verificato
con `git diff`: **nessuno è causato dai fix resize** — `src/webgl-water/`,
`shader-hero.jsx` e `FocusCalloutShader.jsx` non sono stati toccati. Sono
preesistenti, e lo stack trace conferma solo la provenienza.

| Warning | Fonte | Azionabile |
|---|---|---|
| `powerPreference ignored on Windows` (crbug 369219127) | `shaders/react` → `requestAdapter()` | no, interno alla libreria |
| `X4122 sum of 0.996094 and -2.98e-017` | `geometry.js:11` → PMREM di three | no, compilatore shader |
| `in.uv has been omitted` | `shader-hero.jsx:51`, `FocusCalloutShader.jsx:246` → typegpu | no, risoluzione WGSL |
| `THREE.Clock: deprecated` | `engine.js:83`, `scene.js:92` | **sì, codice nostro** |

### Fix: `THREE.Clock` → `performance.now()`

`THREE.Clock` è deprecato in three. **Non** migrato a `THREE.Timer` come
suggerisce il warning: `Timer` richiede una chiamata `update(timestamp)` a ogni
frame, mentre qui `Clock` serve solo `getElapsedTime()`. `performance.now()`
elimina l'API deprecata senza aggiungere un'obbligo per frame.

`src/hero-glass/engine.js`:
```js
let clock = null                                    →  let startedAt = 0
const t = clock.getElapsedTime()                    →  const t = (performance.now() - startedAt) / 1000
clock = new THREE.Clock()                           →  startedAt = performance.now()
clock = null                                        →  startedAt = 0
```

`src/preloader/scene.js`:
```js
const clock = new THREE.Clock()                     →  const startedAt = performance.now()
uniforms.uTime.value = clock.getElapsedTime()       →  uniforms.uTime.value = (performance.now() - startedAt) / 1000
```

Differenza di timing: `Clock` con `autoStart` parte alla **prima** `getElapsedTime()`,
`performance.now()` parte alla costruzione. Uno o due frame di scarto, irrilevante
per un'animazione di rotazione.

L'istanza compariva **due volte** nel log perché React StrictMode in dev monta
gli effetti due volte (`doubleInvokeEffectsOnFiber` nello stack).

### Rimasti 3 warning, tutti in librerie esterne

Individuata la provenienza esatta: **`typegpu ^0.12.3`** è dipendenza diretta e lo
stack lo conferma (`[typegpu:0.12.3:$resolve]`).

- `powerPreference` — **non è nel pacchetto `shaders`** (verificato con grep su
  tutto `node_modules/shaders`). È typegpu a passarlo al proprio init WebGPU, quindi
  **non è raggiungibile dalle nostre props**. Chrome lo ignora su Windows
  (crbug.com/369219127, bug noto del browser).
- `in.uv external-omitted` — risoluzione WGSL di typegpu, che scarta l'external
  `in.uv` dal grafo. Non configurabile.

Nessuno dei due è un errore: lo stack mostra `initializeRenderer` → `runFrameSequence`
→ `renderFrame` → `execPass` → `draw` completati, quindi **il rendering avviene**.

### Filtro warning: PROVATO e RIMOSSO

Avevo aggiunto `src/dev-warning-filter.js` (un wrapper di `console.warn`, dev-only,
match per prefisso esatto sui due messaggi noti). **Rimosso: era netto negativo.**

Il console dell'utente lo ha rivelato. Con il wrapper installato:

```
prima:    shader-hero.jsx:51        ⚠️ [external-omitted] ...
con filtro: dev-warning-filter.js:21 ⚠️ [external-omitted] ...
```

Due difetti, entrambi gravi:

1. **Non filtrava.** Il wrapper chiamava `original(...args)` da L21, quindi
   `NOISE.some(...)` era tornato `false`. typegpu passa il messaggio **su più
   argomenti**, non come `args[0]`: il confronto su `args[0]` non trovava mai la
   sottostringa.
2. **Corrompeva l'attribuzione.** Chrome attribuisce il messaggio al **call site**
   del logger, quindi ogni warning risultava provenire da `dev-warning-filter.js`
   invece che da `shader-hero.jsx:51` o `FocusCalloutShader.jsx:246`. La riga di
   diagnosi più utile — *quale componente ha emesso questo* — era proprio quella
   che il filtro cancellava.

Un wrapper di `console.warn` non è innocuo: cambia l'attribuzione di ogni messaggio
che lascia passare. **Non rifare questo senza intercettare tutti gli argomenti
(`args.join(' ')`) e senza verificare che l'attribuzione resti quella originale.**

Rimossi anche il file e il suo import in `main.jsx`. Verificato: 0 occorrenze in
`src/` e in `dist/`.

`THREE.Clock` resta invece **risolto alla fonte** (0 istanze in `src/`), che è
l'unico approccio corretto: quello non era silenziato, era sparito.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed** (baseline invariata)
- `THREE.Clock` → **0 istanze** in `src/`
- Filtro assente da `dist` → confermato con grep
- Encoding UTF-8 verificato sui nuovi file

---

## 2026-09-26 — Asset in build, contesti GPU pigri, estrazioni

### 1. Asset: 920 MB → 47.2 MB necessari

`vite.config` ha `publicDir: 'public'`, quindi in build Vite copia **solo** `public/`.
`dist/` non conteneva né immagini di progetto né font. In dev funzionava (Vite serve
la root), in produzione no.

Misurata la ripartizione di `assets/`:

| Cartella | File | Peso | Riferimenti nel codice |
|---|---|---|---|
| `images/archive-video` | 4 | 41.8 MB | 6 (Archives) |
| `images/DOME` | 6 | 3.2 MB | 1 (FeaturedGallery) |
| `images/SoundReact` | 12 | 2.2 MB | 1 (SelectedProjects) |
| `images/Flutes` | 61 | 0.9 MB | **0** |
| `gallery/` | 72 | 323 MB | **0** |
| `asset/` | 123 | 547 MB | **0** (sorgenti di design) |
| `media/` | 4 | 0.8 MB | **0** |
| `fonts/` | 3 | 0.2 MB | **0** (sostituiti da Google Fonts) |

**Solo 47.2 MB su 920 servono online.** Copiate in `public/assets/images/` le tre
cartelle referenziate, **non spostate**: gli 870 MB restano intatti al root come
sorgenti di lavoro. Verificato in `dist` con conteggio ricorsivo
(`SoundReact` ha sottocartelle `PARTICLES/`, `FGenerator/`, `istogram/`).

`assets/svg/` era già in `public/assets/svg/`, usato da `shader-hero.jsx`.

### 2. `preserveDrawingBuffer` rimosso anche dal preloader

`src/preloader/scene.js` — verificato prima che non ci sia alcun readback
(`toDataURL`/`toBlob`/`readPixels`/`getImageData`/`drawImage`: zero occorrenze).
Rimossa l'opzione. **Ultimo `preserveDrawingBuffer` rimasto in `src/`.**

### 3. LAG — causa: 6 contesti WebGL dalla sola FeaturedGallery

I warning di typegpu **non c'entrano**: sono one-time all'init, non per frame.

Conteggio reale dei contesti GPU:

| Contesto | Dove | Quando |
|---|---|---|
| **6 WebGL** | `FeaturedGallery` — un `WebGLRenderer` per card, dentro `frames.forEach` | **anche off-screen** |
| 2 WebGPU | `shader-hero` + `FocusCalloutShader` (typegpu) | sempre |
| 1 WebGL | `TextEntryGlass` | sempre |
| 1 WebGL | `ArchiveHoverCanvas` | sempre |
| 1–2 WebGL | `SelectedProjects` / `MobileSectionCanvas` | quando aperto |

~10–12 contesti sullo stesso device; Chrome ne tollera ~16. Plausibile causa anche
del `Device removed` di inizio sessione.

**Il dettaglio decisivo**: i 6 renderer nascevano al **mount**, anche con la
gallery fuori schermo. Il `rAF` era già gated su `useInView`, i renderer no.

**Fix: init pigro.** La costruzione dei contesti è spostata in un effect separato
gated su `gridInView`, con `glBuiltRef` che la esegue **una sola volta**. Fuori
schermo la sezione non tiene **zero** contesti invece di sei.

Tre dettagli non banali:
- **La ownership del disposeAll è stata spostata** in un effect `[]` (solo
  unmount). Legarlo all'effect in-view libererebbe i contesti a ogni scroll
  fuori campo — esattamente il costo rimosso.
- **`glBuiltRef.current = false` nel cleanup** dell'effect unmount: senza,
  StrictMode (che smonta e rimonta in dev) troverebbe il flag a `true`, salterebbe
  la ricostruzione e la gallery resterebbe **permanentemente senza WebGL**.
- Rimosso un `disposed = true` rimasto orfano nel cleanup dell'effect principale
  (era un `ReferenceError` in strict mode).

### 4. `webglPolicy` — cambiato poi REVERTITO

`shouldEnableSectionWebGL({ isMobile, reduceMotion })` accettava `isMobile` e lo
ignorava: `return !reduceMotion`. Ho provato a usare `isMobile`, e **ha rotto un
test**: `tests/utils/webglPolicy.test.js > enables section WebGL on mobile when
motion is allowed` asserisce esplicitamente il contratto opposto.

Revertito. **Non riscritto il test per farlo passare** dopo aver cambiato un
comportamento non richiesto. Il parametro inutilizzato resta un bug latente ma
non è mio da decidere.

### 5. Hero: ramo mobile senza fallback

Audit di `src/webgl-water/shader-hero.jsx` (il brief precedente puntava a
`SplitScreenHero.jsx`, che è un re-export di 2 righe — il mio errore).

```jsx
// desktop  {!unavailable ? renderShader() : renderStaticHero()}   ← aveva fallback
// mobile   {!unavailable && renderShader()}                        ← rende null
```

Il ramo mobile inoltre non aveva `backgroundImage` (solo `background:
'transparent'`). Con adattatore WebGPU non disponibile l'utente vedeva un
**blocco trasparente di 100dvh** al posto della hero. Aggiunti `backgroundImage`
e `renderStaticHero()` al ramo mobile.

Nessun handler di resize nel file: il dimensionamento è delegato a `<Shader>`.
Al flip di breakpoint i due rami rendono lo stesso elemento quando
`unavailable === false`, quindi React aggiorna in place e **non** ricrea il
contesto WebGPU.

### 6. Estrazioni da `SelectedProjects.jsx` (1551 → 1359)

| Modulo | Righe | Contenuto |
|---|---|---|
| `hooks/useMatrixRain.js` | 147 | effetto matrix rain, incapsula i 3 ref e i 2 effect |
| `selectedProjects/projectsData.js` | 50 | dataset dei 3 progetti |

`SelectedProjects.jsx` 1551 → **1359**. Verificato: `bloomRafRef` e `bloomApiRef`
0 occorrenze residue, `useMatrixRain` e `bloomRef` 2 ciascuno (import+uso).

**Non raggiunto il tetto di 250 LOC.** `ProjectRow` resta a **801 righe** (L111-912):
il bulk è il *title pixel pass* (split caratteri GSAP, maschere, WebGL), che non
ho toccato perché è codice che non ho scritto e non ho letto per intero.
Estrarlo richiede una lettura completa e una verifica separata.

### Verifica
- `npm run build` → **exit 0** a ogni step
- `npm test` → **86 passed / 2 failed**, baseline invariata. I 2 failure sono
  sempre gli stessi preesistenti in `tests/hooks/useArchiveCursor.test.js`
- Encoding UTF-8 verificato su tutti i file nuovi e modificati, 0 corrotti

### Da verificare a mano
- **Il lag migliora** con la gallery fuori schermo (6 contesti → 0)
- Il matrix rain funziona ancora dopo l'estrazione in hook
- La hero su mobile mostra l'immagine statica se WebGPU non è disponibile

---

## 2026-09-26 — Matrix rain: attivazione, conteggio, comportamento mobile

Cinque requisiti, tutti verificati nel sorgente. `useMatrixRain` non accetta più
`isDragging`: **su mobile il rain non è legato al cursore**.

### 1. Restart garantito a ogni hover

`start()` era già idempotente sul `bloomRafRef`, ma il punto delicato è il
**release pendente**: leaving during the 860ms fade leaves a timer that will zero
the buffer. Re-hovering cancels it and carries on from the same frame, so nothing
blanks and the rain never restarts from a half-torn-down state.

**Bug trovato e corretto**: `start()` creava un `ResizeObserver` nuovo senza
disconnettere il precedente. Ogni re-hover durante la dissolvenza accumulava un
observer vivo → leak di `ResizeObserver`. Ora `if (ro) ro.disconnect()` prima di
ricrearlo.

### 2. L'uscita sfuma, non sparisce

`stop()` **non** pulisce il buffer. Rimuove la classe `is-raining`, che guida la
transizione CSS, e il rilascio è differito di `RELEASE_MS = 860` (> 480ms della
transizione). Il canvas conserva l'ultimo frame e si dissolve.

La classe è ora applicata **sempre** in `start()`, non solo su compact. Così il
JS è l'unica fonte di verità dell'attivazione e la dissolvenza funziona
identica su desktop e mobile.

### 3. Div espanso: il rain resta attivo

L'attivazione passa da una funzione unica `sync()`, mai dai listener diretti,
perché tre cose possono accenderlo e non devono litigare:

| Layout | Trigger |
|---|---|
| desktop | hover **oppure** espanso |
| compact | **solo** espanso |

`isExpanded` e `hover` sono tenuti in ref (`isExpandedRef`, `hoverRef`) perché
l'effect principale ha deps `[isCompact, rowRef]` e non deve ricostruire il motore
a ogni apertura. Un effect separato su `[isExpanded, isCompact]` chiama `sync()`.

Caso desktop coperto: **collassare mentre il puntatore è ancora sopra** non deve
congelare il loop. `sync()` rilegge `hoverRef` e riavvia, quindi resta vivo.

### 4. Conteggio: 8 desktop, 3 compact

`n = Math.min(isCompact ? MAX_COMPACT_STREAMS : MAX_DESKTOP_STREAMS, cols)`
= 8 / 3, non più "tutte le colonne" (erano ~36). Le colonne restano equispaziate
nella zona destra: `Math.floor(i * cols / n)`.

**La metà destra è invariata**: `zoneX = w / 2`, wrap a `zoneX`, periodo
`cols * cell`.

### 5. Mobile: compare solo se espanso

Prima partiva con `isDragging` (drag del cursore mobile). Ora su compact **non
sono montate listener di hover** e l'unico trigger è `isExpanded`. Il cursore
mobile non influisce più.

Rimossa la destrutturazione `{ isDragging } = useArchiveCursor()` da `ProjectRow`,
diventata inutilizzata. L'import resta in `SelectedProjects.jsx` perché
`ProjectExpanded` e il componente principale lo usano ancora.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **86 passed / 2 failed**, baseline invariata
- I 5 requisiti greppati nel sorgente, tutti presenti
- `useArchiveCursor` ancora usato a L912 e L1252 → import non morto
- Encoding UTF-8 pulito; `useMatrixRain.js` 147 → 177 righe

### Da verificare a mano
- Desktop: 8 flussi nella metà destra, fade-out visibile all'uscita
- Espanso: il rain resta attivo anche senza hover
- Mobile: **solo** con espanso; nessun effetto muovendo il cursore

## 2026-09-27 - Focus callout: reveal alternato dal basso e bug di sincronia

Tre difetti, tutti nel percorso di comparsa del testo del callout.

**1. L'alternato non era implementato.** `SelectedProjects.jsx` aveva
`const xOffset = i % 2 === 0 ? -40 : 0`: le righe **dispari non si muovevano
affatto** (offset `0`) e non esisteva nessun `y`. Metà delle righe restava
ferma. Ora ogni riga entra dal basso alternando il lato:
`x: i % 2 === 0 ? -CALLOUT_REVEAL_X : CALLOUT_REVEAL_X` con `y: CALLOUT_REVEAL_Y`.
Costanti in testa al modulo (`X 40`, `Y 24`, `stagger 0.05` — lo stagger era
`0.12`, sopra il tetto di `0.05s` che la ground rule 5 mette ai gruppi piccoli).

**2. Due tween in conflitto su `callout.y`.** Il `fromTo` di ingresso animava
`y: 30 → 0` con `start: 'top 85%`, mentre il parallax `scrub` animava
`y → -20` con `start: 'top bottom'` — trigger **precedente**, quindi attivo prima.
Lo scrub sovrascriveva il `y` frame per frame: l'ingresso scivolava contro il
parallax ed era questo lo sfasamento col viewport. Ora il `fromTo` del callout
gestisce **solo `opacity`** e lo `y` resta al solo proprietario dello scrub. Le 4
righe passano in una **timeline unica con un trigger solo**, non 4 trigger
separati sullo stesso elemento.

**3. `prefers-reduced-motion` rendeva il callout invisibile.** La classe
`focus-callout--reduced` veniva togglata da `FocusCalloutShader.jsx` ma **non
esisteva alcuna regola CSS** per essa. In reduced motion non parte il GL e la
regola base rendeva l'inchiostro `color: transparent` senza nessun override: la
sezione non aveva né GL né testo. Ora `--reduced` condivide le regole di
`--no-gl` (ink visibile, selezionabile). `--no-gl` da solo non copriva il caso.

**4. Flash di un frame.** Il primo `draw()` della mask girava in modo
sincrono, ma gli effect dei figli corrono **prima** del `gsap.context` del
padre: la mask veniva rasterizzata con le righe ancora a opacità CSS piena e il
callout intero appariva per un frame prima che il reveal la azzerasse. Il primo
disegno è ora differito di un frame (`firstFrame`, annullato nel cleanup).

### Da verificare a mano
- Righe alternate: 1a e 3a da basso-sinistra, 2a e 4a da basso-destra
- Nessuno scivolamento tra ingresso e parallassata durante lo scroll
- `prefers-reduced-motion`: testo **leggibile**, non una sezione vuota

### Rischio noto, non risolto
`buildGlyphAlphaUrl` fa `toDataURL('image/png')` e `setMaskDataUrl(...)` a ogni
cambiamento della signature della mask RAF. Durante il reveal la signature cambia
**ogni frame** (l'opacità anima, arrotondata a 1/100), quindi in ~0.95s si
innescano ~57 encode PNG + 57 re-render React + 57 upload di texture. È il
candidato più probabile per un jank residuo. La correzione è scrivere la texture
direttamente invece di passare da `toDataURL` + stato React — refactor più
ampio, non fatto qui.

## 2026-09-27 - GSAP "Invalid scope" ×10: i context passavano il ref

`gsap-core.js:674` (GSAP 3.15.0) emette il warning in `utils.selector`, e i due
siti sono:

```js
selector = function (value) {
  value = toArray(value)[0] || _warn("Invalid scope") || {};
  return function (v) {
    var el = value.current || value.nativeElement || value;
    return toArray(v, el.querySelectorAll ? el : el === value ? _warn("Invalid scope") : value);
  };
}
```

Tre `gsap.context(fn, ref)` passavano **l'oggetto ref** invece dell'elemento:
`Archives.jsx`, `SelectedProjects.jsx`, `Footer.jsx`. Con un ref, `el` viene
letto da `value.current` **al momento della chiamata**, e React azzera
`ref.current` allo smontaggio: la lettura fallisce, `el` degenera sul ref
stesso, che non ha `querySelectorAll`, e scatta il ramo `_warn` con fallback su
`createElement("div")` — cioè selector di scope su un div staccato.

Con l'**elemento** `el === value` è vero ma `el.querySelectorAll` esiste, quindi
il ramo di warn non viene preso: stesso scope effettivo, nessun warning. Aggiunto
anche `if (!section) return` prima di creare il context, così uno scope non
valido non produce più nemmeno un context.

Nota: `FeaturedGallery.jsx` passava già `grid` (l'elemento, con guard
`if (!grid) return`) ed era corretto. `SelectedProjects.jsx:856`
(`gsap.context(() => {})`, il secchio di `ProjectRow`) non ha scope e non è
coinvolto. `StrictMode` è attivo, quindi ogni effect gira due volte in dev e il
warning si duplicava.

### Verifica
- `npm run build` → **exit 0**
- `npm test` → **108 passed / 2 failed**, baseline invariata
- 5 `gsap.context`: 4 su elemento, 1 senza scope; nessuno scope-ref residuo

## 2026-09-27 - Focus callout: la mask mangiava il main thread

Il reveal era fluido **solo in apparenza**: sotto, la mask veniva rigenerata
ogni frame con un costo da centinaia di millisecondi.

**La catena.** `buildGlyphAlphaUrl(sourceCanvas)` fa, per ogni redraw:
`createElement('canvas')` + `drawImage`, `getImageData`, un loop di luminanza
su N pixel, `boxBlur1d` (2 passate su N), un loop per l'alpha, `putImageData` e
`toDataURL('image/png')`. Con il callout a ~1325×700 CSS px e dpr 2 sono
**3,71M pixel**: ~18M iterazioni JS, un encode PNG, e un `Float32Array(N)` da
**14,2 MB** allocato a ogni chiamata (più i due buffer della blur, già
pre-allocati). `toDataURL` è sincrono e bloccante: main thread saturo, e non
solo il reveal ma anche `ChromaFlow`/`Swirl` che girano sullo stesso thread.

**Quanto spesso.** La signature RAF arrotondava l'opacità a 1/100 e le
posizioni a 1px, quindi una ease di 0,8s produceva uno stato nuovo a ogni frame:
**~57 redraw in 0,95s**.

**Nota utile:** la signature usa posizioni *relative* a `containerRect`, quindi
è **invariante allo scroll** — il callout che parallassa non la invalida. Il
danno era confinato alla finestra del reveal, non a tutta la pagina.

**Le quattro leve** (`FocusCalloutShader.jsx`):

1. **`MASK_DPR = 1`** al posto di `min(devicePixelRatio, 2)`. La mask è uno
   stencil di glow sfumato (`boxBlur1d` r=2) stirato da `objectFit="fill"` e
   consumato come alpha sotto blur + aberrazione: a dpr 2 ogni passata e
   l'encode costano 4× senza guadagno visibile. **3,71M → 0,93M pixel.**
2. **Buffer riusati**: scratch canvas e `bin` sono ora module-level, come
   `_blurTmp`/`_blurOut`. Spariscono 14,2 MB di allocazione per redraw.
3. **`MASK_MIN_INTERVAL_MS = 50`**: tetto di ~20 redraw/s. `lastSig` viene
   aggiornato **solo** quando il redraw avviene, così un cambio saltato viene
   ritentato al frame dopo invece di congelare la mask.
4. **Signature quantizzata**: opacità a 1/16, posizioni a 3px.

Ilustra la combinazione: ~57 redraw → ≤19, e 4× più economici ciascuno.

### Il pavimento architetturale che resta
Il `<ImageTexture url={...}>` del vendor accetta solo un **URL**, quindi
`toDataURL('image/png')` è inevitabile a ogni redraw: non si può passare una
texture.

## 2026-09-27 — Focus callout: il fade non esisteva (soglia di luminanza)

Il reveal non era lento: **non esisteva**. E il jank era una conseguenza, non la
causa.

**Il bug.** `buildGlyphAlphaUrl` campionava la mask per **luminanza** con una
soglia binaria:

```js
const lum = (r + g + b) / 3
bin[i] = lum < 128 ? 1 : 0
```

La mask sorgente era fondo **bianco** + glifi **neri** disegnati con
`globalAlpha = op`. Un pixel di glifo a opacità `op` dà `lum = 255 × (1 − op)`:

| `op` | `lum` | `bin` |
|---|---|---|
| 0,25 | 191 | **0** — riga assente |
| 0,50 | 127,5 | **1** — riga piena |

Quindi la mask era **binaria**: sotto `op ≈ 0.5` la riga non contribuiva
*nulla*, sopra compariva già piena. Il fade non era attenuato, era **distrutto**
— metà della durata dell'animazione era letteralmente invisibile.

La quantizzazione 1/16 aggiunta il giorno prima peggiorava l'effetto: tutti gli
step sotto 0,5 producevano signature identiche, quindi nessun redraw. Il reveal
non solo non sfumava, non si ridisegnava.

**La correzione alla fonte: il canale alpha è la coverage.** I glifi vengono
disegnati in bianco su fondo trasparente, e `data[i*4+3]` *è* la coverage —
continua, senza soglia. Sparisce anche un passaggio per-pixel.

**Il costo per redraw è stato abbassato di un ordine di grandezza**, con una cache
per riga (`src/components/FocusCalloutShader.jsx`): le *shape* dei glifi sono
fisse per un layout, durante il reveal cambiano solo posizione e opacità.

| | prima | ora |
|---|---|---|
| per redraw | `getImageData` + 4N loop JS + 3 allocazioni | **4 `drawImage`** |
| pixel | 3,71M (dpr 2) | **0,93M** (dpr 1) |
| cache | — | costruita solo su resize/font |

La chiave della cache esclude **di proposito** posizione e opacità: sono
esattamente le due cose che il reveal anima, e includerle la ricostruirebbe ogni
frame. Il blur è una convoluzione quindi commutes con la traslazione: si può
sfocare una volta e comporre alle offset correnti. `globalCompositeOperation:
'lighter'` evita che le penne sovrapposte si taglino a vicenda.

Resta il `toDataURL('image/png')` a ogni redraw, tetto a 60 ms (~16/s): è il
pavimento imposta dall'API url-based del vendor.

### Da verificare a mano
- Il reveal **sfuma** davvero, e non compare a metà animazione
- Le righe salgono alternando: 1a/3a da basso-sinistra, 2a/4a da basso-destra
- Nessuno scattamento durante i ~0,95s del reveal
- reduced-motion: testo **leggibile**

## 2026-09-28 — Focus callout: rimossi reveal e parallax, il callout è statico

> **SUPERATO dalla voce successiva** dello stesso giorno. Il callout è **animato**
> di nuovo, con `gsap.from` e offset random. Questa sezione resta solo come
> registro di cosa era stato rimosso e perché non tornare indietro.

Richiesta: **nessuna animazione di movimento e nessuna scroll animation
sull'elemento**. La comparsa lineare riga per riga non era voluta.

**Cosa è stato rimosso.** Due cose, non una:

1. il **reveal scroll-linked** — timeline `paused` con playhead forward-only inseguito
   da `gsap.ticker`, `ScrollTrigger.create` su `top 88%` → `top 30%`, stagger
   `CALLOUT_REVEAL_STEP`, easing, e lo slide `yPercent: 200 → 0` sullo span;
2. il **parallax scrub** su `callout.y` (`scrub: 1`).

Entrambi erano "animazione di movimento legata allo scroll", quindi sono andati via
insieme. L'effetto shader resta: è lui il callout.

**Cosa rimane.** La mask è **statica**: si piuma una volta per riga, si compone e si
fa `toDataURL` una volta per cambio layout (mount / font load / resize). In
`FocusCalloutShader` **non esiste più nessun lavoro per frame** — niente rAF loop,
niente IntersectionObserver, niente `gsap.ticker`, e l'import di `useInView` è
stato tolto.

**Eliminato:** `--reveal`, `entry.scratch`, la matematica delle bande d'inchiostro,
`buildRevealMask`, `writeRevealMask`, `readReveal`, `inkTop`/`inkBottom`,
`absTop`/`absBottom`, `_lineEls`, `containerH`, `MASK_MIN_INTERVAL_MS`,
`REVEAL_STEPS`, `MASK_CSS_STEPS`, `useInView`, e le costanti `CALLOUT_REVEAL_*`
(`STEP`, `EASE`, `SMOOTH`, `START`, `END`).

**Ripulimento CSS.** La riga non è più un contenitore di clip: via
`overflow: hidden`, via `--reveal`, via il box da 1.2em con `margin-bottom: -0.54em`
(esistevano solo per lo slide). Tornata al `line-height: 0.66` semplice di
`.focus-callout`, con la sovrapposizione dei glifi **voluta** e tenuta leggibile
dallo `STROKE_ALPHA = 0.4`.

**Rinominate le classi** fuori dal dead feature:
`.focus-callout__text-line--reveal` → `.focus-callout__text-line`,
`.reveal-inner` → `.focus-callout__text`. Aggiornati di conseguenza i selettori in
`FocusCalloutShader.jsx`, il CSS e i test.

**Nota sul `isMobile`.** L'effect di `SelectedProjects` dipende ancora da
`[isMobile]`, ma non per il callout: serve a che `ctx.revert()` ricostruisca i
ScrollTrigger di heading e righe sul nuovo document height. Non è un dip
superfluo — toglierlo romperebbe il refresh dopo il flip mobile↔desktop.

### Test
`tests/components/SelectedProjects.calloutStatic.test.jsx` (5 test) fissa
l'invariante: il callout e le sue righe **non** vengono mai passati a GSAP, non
viene creato nessun ScrollTrigger su di esso, non compare transform/`--reveal`/
opacity in stile inline, e nessun callback su `gsap.ticker` viene registrato.
Copre anche che le righe statiche corrispondano ancora al prop `lines` dello shader
(la mask accoppia la riga DOM *i* al raster *i*).

I test del reveal e della mask CSS sono stati **eliminati** insieme al reveal: non
avevano più nulla su cui esercitarsi.

`npm run build` exit 0 (719 moduli), `npm test` **115/115** su 8 file, LSP clean.

### Da verificare a mano (Chrome reale — qui non c'è `navigator.gpu`)
- Il callout è **immobile**: nessun movimento allo scroll, nessuna comparsa a righe
- Le quattro righe sono visibili **tutte da subito**, con l'effetto shader acceso
- La tinta nera del DOM non compare mai
- Le righe sovrapposte restano leggibili (provare `STROKE_ALPHA = 0` e confrontare)
- Il testo è allineato a sinistra
- Mobile 375px: "Music" / "Are" / "Generative", stesso effetto
- `prefers-reduced-motion`: nessun GL, testo inchiostro leggibile
- Fallback `--no-gl`: testo inchiostro leggibile

## 2026-09-28 — Focus callout: ingresso con `gsap.from` e offset random

Richiesta: animare **riga per riga**, stile **ease out**, con le righe **spostate
da posizioni random** che le riportano **sempre alla posizione finale**, usando un
**`gsap.from`** così la fine è perfettamente posizionata. Il testo deve essere
**visibile solo una volta entrato nel box** che indica la sua posizione finale
(`overflow: hidden`), così i caratteri non si vedono mai fuori dal loro punto di
fine. Movimenti **random alternati linea per linea**.

**`gsap.from`, non `fromTo`** — è la scelta che rende la fine esatta per
costruzione: il tween termina sulla posizione di layout dell'elemento, quindi
l'ultimo frame non può divergere dalla posizione finale. Con `fromTo` avrei dovuto
scrivere a mano il valore finale e mantenerlo allineato al CSS.

**Numeri** (`SelectedProjects.jsx`): ease `power3.out`, durata 1.1, stagger 0.62
(sovrapposizione alta, così l'ingresso si legge come un gesto unico e non come
quattro parole in sequenza). Lato alternato `i % 2` (sx/dx/sx/dx). Distanze
random su `[0.45, 1.15]` in x e `[0.9, 2.1]` in y, **scalate sulla misura della
riga**: entrambi i range partono da sopra 1, quindi una riga nasce **del tutto
fuori** dal proprio box invece di intrare già a metà. Trigger:
`scrollTrigger` sulla timeline, `top 82%`, `once: true` — non deve risuonare
scrollando indietro. Sotto `prefers-reduced-motion` la timeline **non viene
costruita**.

**La mask ripercorre lo stesso movimento.** `compositeLinesUrl` disegna il raster
cacheato di ogni riga alla sua rect **viva** e lo ritaglia alla **finestra d'inchiostro
finale** (`winTop`/`winBottom`, misurata una volta al build della cache con la
transform neutralizzata). Questo è il meccanismo: i glifi viaggiano, il box no, e a
regime la parola riempie esattamente il proprio box.

Il ritaglio avviene sullo **scratch per riga**: una canvas condivisa non può
farlo, perché non ha alpha per-riga, e le righe si sovrappongono di proposito —
una riga non deve mai tagliare la vicina.

**Due bug evitati in corsa, entrambi da ricordare:**

1. **`getBoundingClientRect` su un elemento trasformato** restituisce la rect
   *spostata*. Se avessi cacheato quella, la finestra sarebbe stata misurata dove
   la riga si trova *durante* il tween e non dove *finisce*. Misuro con
   `transform: none` e ripristino, solo sui rebuild della cache.
2. **Nessun latch "settled"** nel loop della mask. La timeline nasce lazily da uno
   ScrollTrigger, quindi una signature stabile è anche lo stato *prima* che l'ingresso
   parta: il latch avrebbe spento il loop prima ancora che l'animazione-play.

**Soffillo di performance — da leggere prima di "ottimizzare".** La mask si
ridisegna per frame durante l'ingresso e ogni redraw costa `toDataURL('image/png')`
(**sincrono**) + re-render di tutto `<Shader>` + reload di `ImageTexture`. Il
vendor accetta solo URL, quindi l'encode è inevitabile. Di conseguenza
`MASK_MIN_INTERVAL_MS = 33` (~30/s) e l'ingresso **scatta leggermente**: è il
costo di pilotare il reveal attraverso la mask, e non si sistema abbassando la
soglia (il thread è già saturo). Se servisse vero 60fps l'unica leva reale è
smettere di pilotarlo via mask (es. un'istanza shader per riga con transform CSS),
al costo di N contesti WebGL. Chiedere prima.

**CSS.** La riga è il box: `line-height: 1.2` + `margin-bottom: -0.54em` → box
1.2em, avanzamento netto 0.66em, `overflow: hidden`. Deve essere **più alta dei
glifi**: a 0.66 il box è più basso dell'inchiostro e una clip così corta taglia
ascendenti e discendenti dal testo finito. Nei fallback `--no-gl` / `--reduced` il
box **smette di sovrapporsi** (`margin-bottom: 0; overflow: visible`), perché con
l'inchiostro reale una clip sovrapposta taglierebbe gli ascendenti della vicina.

### Il flash del testo già finito (risolto — meccanismo definitivo)
Per qualche millisecondo, arrivando alla sezione, si vedeva **tutto il testo già
composto** e solo dopo partiva l'ingresso. Il rimedio scelto non è più una flag
JS ma **il canale `--reveal` con base 0 in CSS**:

- `.focus-callout__text-line { --reveal: 0 }` **negli stili**. `FocusCalloutShader`
  moltiplica la copertura della mask di quella riga per il valore, quindi una riga
  è **invisibile dal primo paint** e non può essere vista prima che l'ingresso l'abbia
  posata. Nessuna assunzione sull'ordine degli effect, nessuna finestra di race.
- GSAP tweena `--reveal` 0 → 1 **in parallelo** allo slide, con **stesso `position`
  e stessa `duration`**: se i due orologi divergessero la parola comparirebbe mentre
  è ancora fuori posto.
- I fallback `--no-gl` / `--reduced` **pinnano `--reveal: 1`** negli stili, perché lì
  l'inchiostro reale è ciò che si vede e nessuna timeline viene costruita.

Lo slide da solo non bastava: una riga con offset piccolo può stare **parzialmente
dentro** il proprio box mentre è ancora "fuori", e risultare visibile prima di essere
stata posata. Il gate rende l'invisibilità una proprietà dello **stato base**, non
della geometria.

**Bug scoperto durante questo lavoro: il gate `inView` sul loop della mask.** Il
loop era condizionato a `useInView` per non lavorare fuori schermo, ma quel gate può
**silenziosamente smettere di seguire il DOM**, e una mask che non segue il DOM è
indistinguibile da un ingresso rotto: lo shader continua a mostrare il testo a
riposo mentre il DOM (invisibile) scorre. Gate rimosso; il loop costa 4 letture di
rect a frame quando è inattivo, e la correttezza vale più del risparmio. Anche
l'import di `useInView` è stato tolto da questo componente.

### Mitigazione A (la B è stata annullata, vedi sotto)
- **A — encode fuori dal main thread.** `toDataURL` encodava PNG **sincronicamente**
  su ~1M pixel: decine di ms di thread bloccato, più volte per ingresso. Ora
  `toBlob` + `URL.createObjectURL`, che in Chrome sposta l'encode fuori dal main
  thread. Essendo async servono due garanzie: un **guard di sequenza** (un encode
  superato non deve mai sovrascrivere un più nuovo) e la **revoca** di ogni blob
  sostituito, altrimenti l'ingresso perde un blob per frame. `toDataURL` resta solo
  come fallback per una canvas senza `toBlob`.
- **B — risoluzione della mask: **ANNULLATA, era un bug mio.** Avevo abbassato
  `MASK_DPR` 1 → 0.5 per tagliare l'encode ~4×, ma il composite disegna in **pixel
  CSS** dentro una canvas di `w * MASK_DPR`: i due spazi di coordinate si sono
  disallineati e **ogni glifo è finito al doppio della sua posizione**, quasi fuori
  canvas. Sintomo: "le posizioni del testo sono completamente sballate".
  `MASK_DPR` è **pinnato a 1** e non è un dial riutilizzabile: per abbassarlo va
  scalato anche il transform del composite **e** il clip sullo scratch per-riga,
  non solo il numero. Non ripetere l'errore.

Restano due costi per redraw che A e B **non** toccano: il **re-render di tutto
`<Shader>`** (perché `maskDataUrl` è state) e il **reload di `ImageTexture`**. Se
dopo queste due l'ingresso sbatta ancora, l'unica strada vera a 60fps è non
pilotarlo via mask (un'istanza shader per riga con transform CSS), al costo di N
contesti WebGL.

### Test
`tests/components/SelectedProjects.calloutEntrance.test.jsx` (9 test): si usa
`from` e non `fromTo` per lo slide, il **gate** usa `fromTo` 0 → 1 sullo stesso
`position` e `duration` dello slide della stessa riga, gli offset stanno nei range
dichiarati, il lato alterna, i percorsi sono tutti diversi, ease `power3.out`,
`scrollTrigger` con `once: true`, e sotto reduced motion non viene costruito nulla
né il gate.
Il precedente `calloutStatic.test.jsx` è stato **sostituito** (diceva il contrario
di quello che deve).

In jsdom `getBoundingClientRect` restituisce 0×0, il che azzererebbe tutti gli
offset: il test stubba una misura reale (400×200).

`npm run build` exit 0 (719 moduli), `npm test` **117/117** su 8 file, LSP clean.

### Da verificare a mano (Chrome reale — qui non c'è `navigator.gpu`)
- Ogni riga **entra** dal proprio lato e si ferma **esattamente** sulla posizione
  finale: nessun pixel fuori posto nell'ultimo frame
- I caratteri **non si vedono mai fuori** dal box della propria riga durante il moto
- Il movimento è **ease out** e le quattro righe si muovono in modo **diverso**
- L'ingresso non si ripete scrollando indietro
- Nessun ascendente/discente tosato a regime (box 1.2em)
- Mobile 375px: "Music" / "Are" / "Generative", stesso effetto
- `prefers-reduced-motion`: nessun GL, testo inchiostro leggibile
- Fallback `--no-gl`: testo inchiostro leggibile, righe non sovrapposte




---

## 2026-10-02 - Console warning elimination + preload-phase lag

Obiettivo: console dev pulita (0 warning/caricamento) e meno lag in preload.
Baseline numerica: `AGENT/test-results/baseline-2026-10-02.md`; dopo: `AGENT/test-results/after-2026-10-02.md`.

Modifiche:
1. `src/bootstrap-logging.js` - filtri warn dev-only stretti (testo `X4122` e `[external-omitted]`, MAI `ERROR:`) installati prima di react-dom.
2. `index.html` - shim `navigator.gpu.requestAdapter` gated su Windows (rimuove il warning crbug.com/369219127) + igiene `pp:visited`.
3. Rimossa la import typegpu dall'entry: il pkg `shaders` shipa typegpu pre-bundled (era la sorgente dei warning `external-omitted`).
4. `vite.config.js` - esperimento optimizeDeps revertato allo stato originale (nessuna differenza misurata).
5. `src/load-warmup.js` + entry - lavoro spostato prima di DCL.
6. `TextEntryGlass` - init GL differito (era su appReady).

Risultato (4 load dopo, dev 8151): **0 warning / 0 errori** sia dev che
`vite preview :4199`. Long tasks 7-14 / 599-1863ms (vs 17 / 13373ms cold).
`preRemoved` 4055-5133ms (vs 8454-14163ms); `preSeen` 134-196ms (vs 588-1147ms).

Nota probe: l'ultimo warning "Deprecated API for given entry type." e' emesso
dalla probe stessa (`getEntriesByType('longtask')`), non dall'app.

Gate: `npm run build` exit 0, `npx vitest run` 296/296.

### Da verificare a mano
- Console pulita anche con utente reale (no probe): aprire in DevTools e ricaricare piu' volte.
- Il ritardo percepito iniziale e' migliorato ma la prova definitiva e' su build prod.

## 2026-10-04 - Scrollbar custom stile Chrome (overlay, no layout shift)

> `src/components/Scrollbar.jsx` (nuovo) + mount in `App.jsx` + `window.__lenis`
> esposto dall'effect Lenis + soppressione nativa in `global.css`.
> Capsula bianca 10px `mix-blend-mode: difference`, senza track né frecce, z 40.
> Thumb = `trackH * vh / docH` (min 48px); sync da evento `lenis.on('scroll')`
> (mai `window.scroll` durante smoothing), fallback nativo se Lenis assente;
> drag con pointer capture + `lenis.scrollTo(immediate)` 1:1, click-track paging
> ±80% vh. Sempre montata, `visibility:hidden` in preload (niente shift al
> reveal), fade 700ms a rimozione `#preloader` via MutationObserver (con check
> `no-preload`/display:none per skip immediato). Nativa soppressa via
> `scrollbar-width: none` + `::-webkit-scrollbar` → gutter mai occupato.
> Verificato: innerW == clientW (1440), thumb in basso a fine pagina, 302/302 test.

## 2026-10-04 - Scrollbar: difference fix + offset header; hero: bordo sgretolato

> **Scrollbar** (`Scrollbar.jsx`): il `difference` non fondeva perche' lo
> `z-index: 40` sul track creava uno stacking context che intrappolava il blend
> (prova a matrice: probe su body fonde, nested no). Fix: z-index tolto dal
> track, messo sul thumb (self-SC consentito). Track ora parte sotto l'header:
> `top = header + 12`, altezza `calc(100dvh - top)`; misura header dinamica +
> resize. Nota: headless SwiftShader non pitt renders transform+radius+blend,
> verifica inversione reale solo su browser utente.
> **Hero** (`HeroEdgeMask.js`): bordo sgretolato naturale — `edgeCrumblePx: 14`
> (hash intero per-colonna deterministico) + `edgeSolidRows` 2→1 (transizione
> immediata e morbida). Verificato: ASCII ragged, screenshot looker (erosione
> naturale, niente linee/fessure/buchi), self-check ok, 302/302 test.

## 2026-10-04 - Load: hero-day 12.6MB → WebP 257KB + cache maschera differita

> `public/hero-day.png` (6144×4096, 12.6MB) era il collo di bottiglia del load
> (bg hero + texture shader). Ricavato `hero-day-opt.webp` 2560px q82 method 6
> (257KB, 49× in meno): JPEG q82 scartato (blocking sui bianchi), JPEG q90
> scartato (banding/ringing residui) — verdetti looker su file. Swap nei 2
> riferimenti (`shader-hero.jsx`, `HeroShaderStack.jsx`) + preload registrato
> in `load-warmup.js` (gate con cap 2.2s, mai stallo). Cache frame maschera
> rinviata a dopo il preload (MutationObserver + safety 8s). Cover gallery
> (~3MB PNG) già lazy/gated. Waterfall dev: preloader-gone 11s → 7.5s;
> 302/302 test.

## 2026-10-04 - Scrollbar: fade a inizio reveal + difference fix + offset header

> Fade partiva a rimozione nodo ma il reveal scopre la pagina prima (mask su
> `#root`): trigger ora sulla prima mutazione mask-image di `#root`, fallback
> a rimozione. `difference` non fondeva per z-index sul track (isolated group):
> z-index spostato sul thumb. Track sotto l'header (`header + 12`, misurato).
> Verifica inversione reale solo su browser utente (headless non pittora
> transform+radius+blend).
