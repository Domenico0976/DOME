# PIANO: Sezione Bento "DESIGN" → Codice (sostituisce hero-glass)

> **Status**: v1.2 — **re-architettura glass-anchored** (direttive utente D1–D6, 2026-10-03): toro full-viewport invariato, la bento si adatta; revisioni Momus round-2 assorbite (D6 → F5.5, canvas anchoring → architettura D1, webglPolicy → D3)
> **Data**: 2026-10-03 (v1.2) · 2026-10-02 (v1.1 — review Momus APPROVED, superata da D1/D2)
> **Decisioni aperte**: S1 (overlap -21vh), S5 (tablet), ROWS, LABEL-MOB → **§10** (con default in forza)
> **Sorgente design**: frame `DESIGN` (`GCM6n`) dentro `Hero section` nel file pen `.pencil/documents/ba5121d0-bf15-47fb-8f05-00c361f3bd20/pencil-new.pen`
> **Supersede**: `PLAN-Hero-Bento-Grid-Design-to-Code-02102026.md` (report di fallimento infrastrutturale, nessun contenuto utile)

---

## 1. Obiettivo

Creare un nuovo componente sezione che implementi fedelmente il frame pen **DESIGN** (griglia bento 1440×1024) e lo inserisca **al posto dell'attuale `TextEntryGlass`** (hero-glass + testo WebGL). La toro a refrazione (hero-glass) **NON entra nella bento**: resta **full-viewport con la sua logica attuale invariata al 100%** (canvas `inset:0` della sezione, `applyFraming(window.innerWidth)`, scroll/pointer, righe WebGL `TEXT_ROWS` — **D1/D2**). La bento si posiziona **adattandosi alla logica del glass**: la **cella A è vuota e trasparente** e lascia vedere il toro; le celle B–F sono opache (niente doppia lettura). La logica di text-fit basata sullo spazio disponibile viene **estratta in un modulo globale ma NON usata** dal nuovo componente.

**Conferme utente v1 (2026-10-02, maintained):**
- Font: **Italianno** = parti script blu/viola (#5736CF); **Hedvig Letters Serif** = paragrafi (bio); **Bricolage Grotesque** = tutto il resto (Helloooo, I'm, Designer, label). *Inter non assegnato → non caricare.*
- *(Superseded v1.2 da D1/D2: "Cella A con hero-glass + overflow sopra il bordo, leggermente invasivo in B/C" → la cella A è **vuota** e il toro resta **full-viewport** dietro la griglia.)*
- Cella E: per ora un **quadrato bianco, senza padding, adiacente al bordo** del suo contenitore (niente label "Shader pixel", niente gray).
- **Ogni sezione divisa = un div della bento grid** per gestire il responsive.
- Responsive pianificato secondo la skill `/responsive` (mobile-first, redesign per breakpoint, non scaling passivo).

**Direttive v1.2 (D1–D6, 2026-10-03 — authoritative):**
- **D1** — "il nostro torus deve sempre riflettere la sua logica… noi gestiamo sempre lui come a tutta viewport e nella bento grid inseriamo come primo elemento una cella vuota, lui non deve uscire fuori… adattando solamente la posizione e la bento alla LOGICA del glass e non il contrario."
- **D2** — "Voglio che rifletta tutto come già fa adesso senza modificare la sua logica, noi adattiamo la bento alla logica esistente." → 6 righe `TEXT_ROWS`, effetti, lifecycle, `margin-top:-21vh` e z-order: **invariati**.
- **D3** — Correggere il piano: il gating di TextEntryGlass **NON** è `webglPolicy.js` ma `matchMedia('(prefers-reduced-motion: reduce)')` (`TextEntryGlass.jsx:90-91,139-145,170`).
- **D4** — "La cella E lasciala vuota… successivamente un effetto webgl dentro di essa… lasciala come next step ma crea la cella vuota." → placeholder bianco, **reserved per futuro shader**.
- **D5** — Mobile: "non si veda la cella vuota ma lui sul lato senza cella e la bento in grid verticale" → **nessuna cella A**; griglia verticale che **parte da B** (`Helloooo`, `I'm`, `Domenico`…); toro "sul lato" col layout mobile esistente del motore.
- **D6** — Animazione one-shot della bento (NON del toro): fade verticale top→bottom, **banda di blur sul 20% della parte visibile in caricamento, sul fondo**, che scompare al completamento; avviata da scroll trigger, **senza possibilità di reset** in scroll → **§6, fase F5.5**.

---

## 2. Design spec (ground truth estratta dal .pen)

### 2.1 Colori
| Ruolo | Hex |
|---|---|
| Background sezione/frame | `#F4EDE5` |
| Bordi / testo nero | `#000000` |
| Accento script (viola/blu) | `#5736CF` |
| Placeholder E (quadrato) | `#FFFFFF` |
| (gray `#D9D9D9` del design = notazione placeholder, NON da renderizzare) | — |

### 2.2 Font (mappa confermata dall'utente)
| Elemento | Font | Peso (start, da tunare) |
|---|---|---|
| "Domenico", "Service", "ux/ui" | **Italianno** (400, unico peso) | 400 |
| Bio (3 paragrafi) | **Hedvig Letters Serif** | 400 |
| "Helloooo", "I'm", "Designer", label "Hero Glass" | **Bricolage Grotesque** | Helloooo ~400/500, I'm + Designer ~700 |
| ~~Inter~~ | non usato in questo componente | — |

`index.html`: aggiungere solo **Italianno** alla Google Fonts link (Bricolage + Hedvig già caricati; verificare che il range pesi Bricolage copra 400..800, estendere se serve).

### 2.3 Copia esatta (TYPO PRESERVATI — non correggere)
- Heading: `Helloooo` · `I’m` · `Domenico` (apostrofo curvo U+2019)
- Ruoli: `Service Designer` · `ux/ui Designer` (tutto minuscolo)
- Bio (3 paragrafi, 788×250 a 1440):
  1. `As an Interactive Designer, Service and UX|UI Designer with multidisciplinary approach, focused on interaction, affordance and pretty cool effect.`
  2. `My goal is to connect people with brand, focus on detail, achive your idea and create.`
  3. `I like to experiment with design and music, i like to create them both, mix togheter and make Visual Art`
  - Errori intenzionali da preservare: `achive`, `togheter`, `UX|UI`, `i like` (minuscolo).
- Label cella A: `Hero Glass`

### 2.4 Geometria (frame 1440×1024, tutto in coordinate frame o % )

**Box esterno** (bordo 4px nero): `x=133.76, y=59.88, w=1222.4, h=904.24`
→ margini frame: left **9.29%**, right **5.82%**, top **5.85%**, bottom **5.85%** (asimmetria reale del design: preservare).

**Band rows** (altezze sul box): top **35.93%** (59.88→384.77) · middle **28.14%** (384.77→639.23) · bottom **35.93%** (639.23→964.12)

**Colonne** (sul box, coordinate locali = abs − 133.76/59.88):
| Col | Locale X | % sul box | Confine |
|---|---|---|---|
| col1 (A/C/F-left) | 0 → 509.47 | **41.68%** | Line 80 a x=509.47 |
| col2 (D/F-right) | 509.47 → 863.56 | **28.97%** | Line 79 (861.52) + bordo F (863.56) → **normalizzare a 863.56** (jitter hand-drawn ±2px) |
| col3 (E) | 863.56 → 1222.4 | **29.35%** | — |

**Aree grid** (`grid-template-areas`):
```
"a b b"
"c d e"
"f f e"
```

### 2.5 Celle
| Cella | Contenuto | Geometria (frame-abs o %) |
|---|---|---|
| **A** (top-left) | **CELLA VUOTA + TRASPARENTE (D1)**: nessun contenuto, nessun clip — il toro (full-viewport, z0) si vede attraverso di essa; label `Hero Glass` centrata (z3, sopra toro) | col1 × row1 (zona A frame-abs **x[134–643] × y[60–385]**). Il placeholder gray del design non ha più significato. @1440 progress-0: bbox toro ≈ x[468–627]×y[27–186] → dentro A in orizzontale, sporgenza top ~33px dentro margine frame (~60px), niente invasione B/C — gate QA §7 |
| **B** (top-right) | heading composizione | col2+col3 × row1 (x 643.23→1356.16, y 59.88→384.77) |
| **C** (mid-left) | `Service Designer` | col1 × row2 (origin abs 133.76, 384.77; 509.47×254.46) |
| **D** (mid-center) | `ux/ui Designer` | col2 × row2 (origin abs 643.23, 384.77; 354.09×254.46) |
| **E** (right) | **quadrato bianco pieno, flush al bordo, no padding, no label — reserved: futuro effetto WebGL dentro E (D4, next step)** | col3 × rows2-3 (regione 863.56→1222.4, 324.89→904.24 locale). *Il gray inset del design (1003,390,340×560) è SOLEPASSATO: ora riempie tutta la cella.* |
| **F** (bottom-left) | bio 3 paragrafi | col1+col2 × row3 (`x133.76, y639.23, 863.56×324.89`, bordo 4px) |

### 2.6 Text positions (start per QA, da tunare vs screenshot pen)

| Testo | Origin frame-abs | Relativo alla cella (%) | Size start @1440 | cqw (frame) |
|---|---|---|---|---|
| Helloooo | (672.3, 153.5) box 253×50 | B: left 4.08%, top 28.81% | ~64px | 4.44cqw |
| I’m | ~ (674, 213) | B: left 4.36%, top ~47% | ~76px, w700 | 5.28cqw |
| Domenico | fine box ~1334 (right 3.07% di B) | B: top 28.81%, right 3.07% | ~160px | 11.1cqw |
| Service (viola) | (173.25+36, 419.36) | C: ~left 8.5%, top 13.6% | ~115px | 8cqw |
| Designer (nero) | (173.25, 419.36+67) | C: left 7.75%, top ~39.9% | ~80px, w700 | 5.56cqw |
| ux/ui (viola) | (647+51, 456.2) | D: ~left 16%, top 28% | ~115px | 8cqw |
| Designer-2 (nero) | (647, 456.2+~75) | D: left 1.06%, top ~57% | ~80px, w700 | 5.56cqw |
| Bio blocco | (158.45, 680.67) box 788×250 | F: left 2.86%, top 12.76%, width 91.25% | ~20px/1.35 | 1.39cqw, `max(14px,·)` |
| Label Hero Glass | centrata in A | center/center | ~15px | 1.04cqw |

> I testi nel pen sono **outlines vettoriali pieni** (fill, non stroke): in codice sono **testo reale** con i font web — niente `-webkit-text-stroke`, niente SVG text.

### 2.7 Dividers (SVG desktop — tutte linee 4px nero, viewBox `0 0 1222.4 904.24`, box-local)
| # | Da → a (locali) | Corrisponde a |
|---|---|---|
| R1 | rect `x2 y2 w1218.4 h900.24` (stroke centrato dentro) | bordo esterno (2.4) |
| H1 | `(0, 324.89) → (1222.4, 324.89)` | bordo sotto row1, piena larghezza (Rect 12418) |
| H2 | `(0, 579.35) → (863.56, 579.35)` | bordo sopra F, solo col1-2 (Rect 12419) |
| V1 | `(509.47, 0) → (509.47, 324.89)` | Line 80, A\|B |
| V2 | `(863.56, 324.89) → (863.56, 904.24)` | Line 79 + bordo destro F, fusi (normalizzati) |
| DG | `(510.74, 322.62) → (370.74, 579.62)` | **Line 78 diagonale** (rotation −118.56°, length 293): da angolo alto-destro di C in basso-sinistra. Fine in basso a x≈504-abs |

> Nota: **nessuna verticale C\|D** — il confine C/D è solo la diagonale. I testi C (max x 494) e D (min x 647) stanno già da entrambi i lati della diagonale (check: a y=456 diagonale a x≈604; a y=606 a x≈523).

---

## 3. Decisioni architetturative (Oracle + integrate)

| # | Domanda | Decisione | Perché |
|---|---|---|---|
| 1 | Traduzione grid assoluta→responsive | **CSS Grid + `grid-template-areas`**, un `div` per cella (volere esplicito utente). Desktop: frame `aspect-ratio: 1440/1024` + `container-type: inline-size`, posizioni in % e font in **cqw**. | Fedeltà fluida + celle come div = responsive gestibile |
| 2 | Bordi 4px senza doppi | **Desktop: SVG overlay** (tutte le linee incl. diagonale, parziali, rettangolo esterno). **≤1024: tecnica gap+background** (`background:#000` su grid, `gap:4px`, celle bg cream) | SVG = geometria esatta del design (linee parziali, diagonale, nessuna C\|D doppia). Gap = bordi uniformi 4px quando le celle si ristrutturano. Mai `border` tra celle adiacenti (doppi 8px) |
| 3 | Diagonale | **`<line>` SVG** nel overlay desktop; `display:none` ≤1024 | Deformazione impossibile, coordinate 1:1 col design, responsive = on/off |
| 4 | Cella A / toro | **Cella A vuota e trasparente (D1)**: nessun wrapper, nessun inset, nessun clip. Il toro resta **full-viewport come oggi** (canvas `inset:0` della sezione, **z0 sotto tutto**); la bento si posiziona perché il bbox del toro @1440 (progress 0) rientri nel frame e nella zona A: verificato x[468–627] ⊂ A x[134–643], sporgenza top ~33px assorbita dal margine frame (~60px). **`margin-top:-21vh` MANTENUTO (D2)** → top del frame dietro SplitScreenHero = **S1 (§10, default: frame centrato + QA a schermo)** | Adattamento bento→glass, non il contrario (D1); zero modifiche al motore (D2) |
| 5 | Semantica sostituzione | **`App.jsx:111`**: `<TextEntryGlass />` → `<DesignBento />`. SplitScreenHero **rimane**. Motore toro riusato **full-viewport** (canvas **primo figlio della `<section>`**, non dentro A) con **lifecycle identico** a `TextEntryGlass.jsx`: preloader gate, IntersectionObserver `rootMargin '200% 0px'` (:76-80), **`matchMedia('(prefers-reduced-motion: reduce)')` → `animated: !reducedMotion`** (:90-91, :139-145, :170 — **NON `webglPolicy.js`**, D3), **`rows: TEXT_ROWS` mantenuti** (:171, D2), resize registry, `setScrollProgress`, `setPointer`, dispose. `TextEntryGlass.jsx` resta nel repo come dead-code per revert | Boundary di migrazione reversibile con 1 riga; engine 100% invariato (D2) |
| 6 | Estrazione text-fit globale | **`src/hero-glass/textLayout.js` → `src/utils/textFit.js`** (contenuto spostato: `fitFontSize`, `layoutRows`, `FIT_MIN/MAX/ITERATIONS`, `TAIL_DIVISOR`). `src/hero-glass/textLayout.js` diventa **shim di 2 righe** (`export … from '../utils/textFit'`). Test `tests/hero-glass/textLayout.test.js` restano validi senza modifiche. `readTextMetrics` (in TextEntryGlass.jsx): estrarre solo se pura e disaccoppiata, altrimenti resta (valutare implementando) | Globale ✔, shim = zero rottura, il componente BENTO **non importa mai** `textFit` (vincolo utente) |
| 7 | Label E | **Rimosse** (istruzione: quadrato bianco plain). Label A `Hero Glass` **mantenuta** (presente nel design) | — |
| 8 | Testo outlined | È fill pieno vettorizzato → **testo reale**, non stroke | Accessibilità, SEO, selezionabilità |

### 3.1 Struttura DOM
```html
<section class="bento" aria-label="Introduzione">       <!-- ex .text-entry: height 100dvh + margin-top -21vh (D2, mantenuti) -->
  <canvas class="bento__glass-canvas" aria-hidden="true"></canvas>  <!-- inset:0, z0 — toro FULL VIEWPORT, logica invariata (D1/D2) -->
  <div class="bento__frame">                <!-- desktop: width min(100%,1440px), aspect 1440/1024, max-height 100dvh (S2), container-type -->
    <div class="bento__grid">               <!-- box: inset % margini, display:grid, grid-template-areas -->
      <svg class="bento__lines" viewBox="0 0 1222.4 904.24" aria-hidden="true">…R1,H1,H2,V1,V2,DG…</svg>
      <div class="bento__cell bento__cell--a"></div>      <!-- VUOTA + trasparente: il toro si vede dietro (D1) -->
      <div class="bento__cell bento__cell--b">
        <h1 class="bento__heading"><span class="hello">Helloooo</span><span class="im">I’m</span><span class="nome">Domenico</span></h1>
      </div>
      <div class="bento__cell bento__cell--c"><h2>…<span class="script">Service</span><span class="display">Designer</span></h2></div>
      <div class="bento__cell bento__cell--d"><h2>…<span class="script">ux/ui</span><span class="display">Designer</span></h2></div>
      <div class="bento__cell bento__cell--e"></div>          <!-- white, flush — reserved D4 -->
      <div class="bento__cell bento__cell--f"><div class="bento__bio"><p>×3</p></div></div>
    </div>
  </div>
  <span class="bento__label">Hero Glass</span>              <!-- z3, sopra il canvas; ancorata a A (§2.6); mobile: display:none (default) -->
</section>
```
- `h1` in B (la pagina non ha h1 visibile — le CSS `.hero__title` esistenti non hanno JSX corrispondente), `h2` per i ruoli, `p`×3 per la bio.
- **z-stack (invertito rispetto all'attuale `.text-entry`, dove il canvas sta sopra il testo)**: canvas `z0` (figlio della sezione, `inset:0`) → SVG lines `z1` → celle `z2` (A `transparent`; B/C/D/F `#F4EDE5`; E `#FFF`) → testi `z3` → label `z3`.
- Le righe `TEXT_ROWS` (WebGL) restano montate (D2) ma sono **visibili solo attraverso A e i margini del frame** (nascoste dietro le celle opache) → **nessuna doppia lettura**.

---

## 4. Piano responsive (skill `/responsive`)

**Mobile-first**: base = ≤720, layer `min-width` verso l'alto. Breakpoint progetto: **720** (`MOBILE_BREAKPOINT`), **1024** (`TABLET_BREAKPOINT`).

### Regime BASE — ≤720 (mobile) — **D5**
- **1 colonna, NESSUNA cella A** ("non si veda la cella vuota ma lui sul lato senza cella"): ordine `B → C → D → F → E`; la griglia verticale **parte da B** (`Helloooo`, `I’m`, `Domenico`…).
  ```css
  grid-template-columns: 1fr;
  grid-template-areas: "b" "c" "d" "f" "e";
  ```
- Canvas resta full-viewport dietro la griglia; il toro sta "sul lato" col **layout mobile esistente del motore** (`params.js` LAYOUTS mobile, scale 1.75×) — zero modifiche (D2). Label `Hero Glass`: `display:none` (nessuna A che la ospiti) — default, §10 LABEL-MOB.
- Nessun `aspect-ratio`, altezze naturali, padding sezione 20px.
- Bordi: gap tecnica (`grid gap:4px; background:#000`, celle bg `#F4EDE5`, E `#FFF`), `outline:4px solid #000` per il bordo esterno.
- Diagonale nascosta. Linee SVG nascoste.
- Font: `clamp()` con floor **16px** corpo (bio `max(16px, …)`).
- Gate reduced-motion: **pattern reale di `TextEntryGlass.jsx`** — `matchMedia('(prefers-reduced-motion: reduce)')` (:90-91, :139-145) → `animated: !reducedMotion` (:170). **NON `webglPolicy.js`** (D3: è usato solo da FeaturedGallery/SelectedProjects/MobileCanvas, non da TextEntryGlass).
- `dvh` per altezze full-screen, no `vh`.

### Regime TABLET — 721→1024 — **S5: DECISIONE DA CONFERMARE (§10)**
- **Default (raccomandato)**: come desktop ma compatto — **A resta vuota e trasparente**, toro visibile dietro (layout tablet del motore, scale 1.25×, D2). Aree `"a b" / "c d" / "f f" / "e e"`.
  - Bordi gap+bg, diagonale nascosta, SVG nascosto.
  - Altezze righe auto; font `clamp()` assoluti (no cqw — niente frame aspect).
- **Alternativa** (se user preferisce l'allineamento mobile di D5): senza A, griglia 2-col che parte da B.
- Touch target: nessun controllo interattivo nelle celle (N/A); effetti pointer del toro disattivati su touch (comportamento esistente).

### Regime DESKTOP — ≥1025
- Frame pieno: `width:min(100%,1440px)`, `aspect-ratio:1440/1024`, **`max-height:100dvh` (S2: a 1440×900 il frame 1440×1024 verrebbe clippato — la clamp lo porta a 1440×900; contenuti %-based e font cqw restano coerenti)** , margini % (2.4), aree 3×3 (2.4), **SVG lines + diagonale visibili**, posizioni testo %, font **cqw** con clamp:
  - script: `clamp(48px, 8cqw, 128px)` · Domenico: `clamp(72px, 11.1cqw, 176px)`
  - display Designer: `clamp(40px, 5.56cqw, 88px)` · Helloooo: `clamp(28px, 4.44cqw, 72px)`
  - bio: `max(14px, 1.39cqw)` · label: `clamp(12px, 1.04cqw, 16px)`
- Verifica math: @1025 bio ≈14.2px in box 615×231 → il testo (~6 righe) sta comunque comodo (calcolato).
- **Posizione verticale del frame — S1 (default §10, da validare a schermo)**: `margin-top:-21vh` mantenuto (D2) → top ~21vh della sezione dietro SplitScreenHero. Frame **centrato nella sezione**. Gate QA a schermo (1440×900, scroll=0): (1) bordo top del box visibile, (2) toro completo (bbox non coperto dalla hero), (3) label `Hero Glass` leggibile. Se fallisce → alternative §10 (shift frame verso la banda visibile; togliere -21vh solo con permesso user).

### Checklist QA responsive (dalla skill — obbligatoria)
- [ ] 320px · 375px (niente overflow orizzontale, bio ≥16px)
- [ ] 768px portrait + landscape
- [ ] 1024, 1366, 1440, 1920 (frame capped a 1440, box centrato)
- [ ] Nessuna scroll orizzontale (tranne carousels intenzionali — assenti)
- [ ] `prefers-reduced-motion` → parallax/animazioni toro disabilitati (come site-wide) + animazione bento F5.5 assente
- [ ] Layout diverso ad ogni regime (non semplicemente "più piccolo")
- [ ] Contrasto: `#5736CF` su `#F4EDE5` = **≈6.4:1** ✓; nero su cream ≈17:1 ✓
- [ ] **S1**: 1440×900, scroll=0 → box top border + toro visibili (non dietro SplitScreenHero)
- [ ] **S2**: frame ≤ 100dvh (nessun overlap su FeaturedGallery a 1440×900 / 1280×800)
- [ ] **S5**: regime tablet confermato (default: 2-col con A vuota)
- [ ] **D5/D6**: mobile senza A; animazione one-shot senza ri-reset su scroll

---

## 5. File coinvolti

| File | Azione |
|---|---|
| `src/utils/textFit.js` | **NUOVO** — `fitFontSize`, `layoutRows` + costanti (spostati da textLayout.js) |
| `src/hero-glass/textLayout.js` | **MOD** — shim re-export (2 righe) |
| `src/components/DesignBento.jsx` | **NUOVO** — componente sezione (~220 righe): canvas full-viewport (`mountTorusKnot`, `rows: TEXT_ROWS`, D2), grid bento, animazione one-shot F5.5 (GSAP) |
| `src/styles/global.css` | **MOD** — ~140 righe `.bento-*` (mobile-first; riproduce da `.text-entry`: `100dvh` + `margin-top:-21vh` + canvas `inset:0`); NON toccare `.text-entry` (fase 1, dead code per revert) |
| `index.html` | **MOD** — aggiungere `family=Italianno` (+ peso Bricolage se serve) |
| `src/App.jsx` | **MOD** — riga 111: swap import/uso `TextEntryGlass` → `DesignBento` |
| `tests/utils/textFit.test.js` | opzionale (quello esistente già passa via shim) |
| `tests/components/DesignBento.test.jsx` | **NUOVO** — invarianti layout/copy |
| `TextEntryGlass.jsx`, `.text-entry` CSS | **INVITI** (dead code per revert; cleanup solo dopo sign-off) |

---

## 6. Fasi di implementazione (atomiche, verificabili)

**F1 — Estrazione text-fit globale**
1. Sposta contenuto `textLayout.js` → `src/utils/textFit.js`; lascia shim.
2. Esegui `npx vitest run tests/hero-glass/textLayout.test.js` → verde, 0 modifiche ai test.
3. Verifica: `grep -r "utils/textFit" src/components/DesignBento*` → nessun risultato (ancora non esiste, sarà un assertion del test in F6).

**F2 — Font**
4. Aggiungi Italianno a `index.html`; conferma `display=swap` + preconnect già presenti.

**F3 — Struttura + desktop CSS**
5. `DesignBento.jsx`: DOM §3.1, copia §2.3 letter-per-letter.
6. CSS desktop (≥1025): frame, grid areas, margini %, SVG lines §2.7, posizioni testo % §2.6, font cqw §4.
7. **Verifica**: screenshot a 1440 side-by-side col frame pen (TakeScreenshot del pen come riferimento) — geometria ±4px.

**F4 — Toro full-viewport (D1/D2 — zero modifiche al motore)**
8. `<canvas class="bento__glass-canvas">` **primo figlio della `<section>`** (`inset:0`, `z0`, `aria-hidden`), mount `mountTorusKnot` con **lifecycle identico** a `TextEntryGlass.jsx`: preloader gate, IO `rootMargin '200% 0px'` (:76-80), **gate reduced-motion via `matchMedia('(prefers-reduced-motion: reduce)')` → `animated: !reducedMotion`** (:90-91, :139-145, :170 — **NON `webglPolicy.js`**, D3), **`rows: TEXT_ROWS` mantenuti** (:171, D2), resize registry, `setScrollProgress`, `setPointer`, dispose.
9. Z-stack: canvas sotto tutto (z0), SVG z1, celle opache z2, testi/label z3 (§3.1); `margin-top:-21vh` **mantenuto** sulla sezione (D2).
10. **Verifica**: @1440 progress-0 → bbox toro ⊂ frame, dentro zona A (x[468–627]×y[27–186] vs A x[134–643]×y[60–385]); nessuna invasione B/C; righe WebGL visibili solo in A+margini (niente doppia lettura); label `Hero Glass` sopra il toro.

**F5 — Responsive**
11. Regime tablet (721-1024) e mobile (≤720) secondo §4, mobile-first.
12. **Verifica**: checklist §4 completa (320→1920).

**F5.5 — Animazione one-shot fade+blur (D6)**
13. GSAP timeline **sulla bento, NON sul toro** (D2): celle **B, C, D, F, E + label** (A vuota → niente da animare; canvas intoccato).
14. Meccanica per elemento: reveal verticale **dall'alto verso il basso** (`clip-path: inset(0 0 (100-p)% 0)`, p: 0→100, ~0.8s, `power2.out`) + **banda di blur sul 20% della parte visibile in caricamento, sul fondo** (`::after` height 20% dell'elemento, `backdrop-filter: blur(6px)`, posizionata sul fronte del reveal) → **la banda scompare al completamento** (clip a 0, banda rimossa/opacity 0, nessun residuo).
15. Stagger top→bottom: B → (C, D) → (F, E) → label, offset ~0.1s.
16. Trigger: ScrollTrigger (o IntersectionObserver) quando sezione ≥50% visibile → **one-shot**: `toggleActions: "play none none none"` + flag `played`; **nessun reset su scroll up/down** ("senza possibilità di reset in scroll").
17. `prefers-reduced-motion` → niente animazione, niente blur: contenuto subito visibile.
18. **Verifica**: QA §7 "no-ri-reset" (scroll avanti/indietro 3× → 1 sola esecuzione); banda blur presente solo durante il reveal; reduced-motion → assente.

**F6 — Integrazione + test**
19. Swap `App.jsx:111`; flusso pagina: Header → SplitScreenHero → **DesignBento** → FeaturedGallery → …
20. `tests/components/DesignBento.test.jsx`: celle con classi giuste (A presente e vuota in DOM; mobile: area B prima); SVG con 6 elementi linea; bio = 3 `<p>` con copy esatto (typo assertions: `achive`, `togheter`, `UX|I|UI`); `h1` presente; nessun import di `textFit`; cella E = background `#FFF`; canvas primo figlio della sezione; gating via `matchMedia` (non `webglPolicy`).
21. `npx vitest run` → tutta la suite verde. `npx vite build` → exit 0.

**F7 — QA visivo + decisioni**
22. Screenshot 1440 vs pen (font size/letter-spacing/posizioni: tunare §2.6 fino a match).
23. Confronto user sui default §10: **S1** (top frame dietro hero: centrato / shift in basso / togliere -21vh?), **S5** (tablet: 2-col con A vuota vs allineamento mobile?), **ROWS** (`TEXT_ROWS` attive in A+margini vs `rows: []`), **LABEL-MOB** (nascosta); margini asimmetrici (134/84 → centrare?).
24. Dopo sign-off: cleanup opzionale (rimuovere `TextEntryGlass.jsx` + CSS `.text-entry`).

---

## 7. Test & QA — criteri di accettazione

- [ ] Screenshot 1440: match col frame DESIGN (geometria, colori, font, copy) — tolleranza ±4px / tuning tipografico a vista
- [ ] **Toro (D1/D2)**: canvas full-viewport `z0` (primo figlio della sezione); logica invariata; @1440 progress-0 → bbox toro ⊂ frame e dentro zona A, nessuna invasione B/C; `margin-top:-21vh` presente
- [ ] **Righe WebGL**: `TEXT_ROWS` montati; visibili **solo** attraverso A e margini (celle B–F opache) → nessuna doppia lettura
- [ ] **Label `Hero Glass`**: `z3` sopra il canvas, leggibile sul toro; mobile: `display:none` (default §10)
- [ ] Cella A: vuota, trasparente, nessun wrapper/clip; Cella E: quadrato bianco flush, senza padding, senza label (reserved D4)
- [ ] **S1**: 1440×900, scroll=0 → box top border + toro visibili, non dietro SplitScreenHero (default: frame centrato)
- [ ] **S2**: frame `max-height:100dvh` → zero overlap su FeaturedGallery (1440×900, 1280×800)
- [ ] `textFit` vive in `src/utils/textFit.js`, path vecchio funziona (shim), test esistenti verdi, DesignBento non lo importa
- [ ] Suite vitest completa verde; build exit 0
- [ ] Checklist responsive §4 tutta spuntata; nessun h-scroll; bio ≥16px mobile / ≥14px desktop; mobile senza cella A (D5)
- [ ] Reduced-motion rispettato via pattern `matchMedia` (D3): toro `animated:false` + animazione bento F5.5 assente
- [ ] **D6 one-shot**: timeline eseguita **1× sola**; scroll up/down → nessun ri-trigger; banda blur 20% presente solo durante il reveal, assente a riposo e a fine animazione
- [ ] Italianno caricato; Inter non caricato/inutilizzato
- [ ] Italianno ha `display=swap` (già presente in `index.html`) + fallback stack `cursive`: se Google Fonts non risponde, il layout/posizioni delle celle **non devono rompersi** (solo glyph diversi) — verificare a 1440 con rete bloccata

---

## 8. Rischi (Top 5, da Oracle)

| # | Rischio | Severità | Mitigazione |
|---|---|---|---|
| 1 | Toro su mobile: canvas full-viewport dietro griglia opaca (costo GPU senza gain visivo, A assente D5) | Media | Comportamento identico all'attuale TextEntryGlass (D2); se in QA il costo su dispositivo reale è alto → fallback statico con pattern `MobileSectionCanvas` — **decisione esplicita**, mai implicita |
| 2 | Bordi doppi 8px alle giunzioni | Media | Mai border tra celle; SVG desktop / gap tecnica ≤1024 (§3.2) |
| 3 | Top frame dietro SplitScreenHero per `-21vh` (S1) + frame 1024 > 100dvh (S2) | Alta | `max-height:100dvh` + frame centrato (default §10) + gate QA a schermo §7 a 1440×900 scroll=0; alternative solo con conferma user |
| 4 | Testo display che esplode su viewport larghi | Alta | Font cqw con clamp (min/max sempre presenti) |
| 5 | Font size/posizioni stimate ≠ design (testo vettorizzato) | Alta | Step F7 obbligatorio con side-by-side; §2.6 = valori start, non finali |

---

## 9. Assumptions log (decisioni senza conferma esplicita)

1. **SplitScreenHero rimane** — "al posto della nostra hero-glass" = solo TextEntryGlass. (Se l'utente vuole rimuovere anche lo shader acqua: rivedere §3.5.)
2. Margini frame **asimmetrici preservati** (134/84) — opzione centrare (108.8/108.8) alla QA.
3. Label `Hero Glass` mantenuta in A; label `Shader pixel` rimossa (istruzione esplicita).
4. Legacy bleed `−21vh` **MANTENUTO** (D2) — conseguenza: possibile overlap top frame/hero = **S1** (§10, default: frame centrato + QA a schermo).
5. Pesi Bricolage: Helloooo ~400/500, I'm/Designer ~700 — da confermare a vista.
6. Bio = 3 `<p>` (paragrafi visibili nello screenshot pen, separati da doppi spazi nel nome nodo).
7. Valori font-size §2.6 sono stime da outlines → tunare in F7.
8. **S5 tablet**: default 2-col con A vuota (desktop compatto) — da confermare (§10).
9. **ROWS**: `TEXT_ROWS` mantenuti attivi (D2); visibili solo in A+margini. `rows: []` solo su richiesta user.
10. **LABEL-MOB**: label `Hero Glass` `display:none` su mobile (nessuna A, D5) — da confermare (§10).

## 10. Decisioni aperte (pending conferma user — v1.2)

| # | Decisione | Default (in forza finché non confermato) | Alternative |
|---|---|---|---|
| **S1** | Top del frame dietro SplitScreenHero per `-21vh` (mantenuto, D2) | Frame **centrato** nella sezione; gate QA: box top + toro visibili a 1440×900, scroll=0 | (a) shift frame verso il basso (allineare box top alla banda visibile ≈79vh); (b) togliere `-21vh` (violerebbe D2 — solo se user accetta) |
| **S5** | Regime tablet 721–1024 non definito dall'utente (D5 copre solo mobile) | Come desktop compatto: **A vuota trasparente**, 2-col `"a b"/"c d"/"f f"/"e e"`, SVG/diagonale nascosti | Allineamento mobile (D5): senza A, griglia che parte da B |
| **ROWS** | Righe WebGL `TEXT_ROWS` nella bento | **Attive** (D2), visibili solo attraverso A + margini | `rows: []` (solo toro, zero testo WebGL) |
| **LABEL-MOB** | Label `Hero Glass` su mobile (nessuna cella A) | `display:none` | Posizionarla sopra B (anchoring nuovo — non raccomandato) |

> Non bloccanti per l'avvio F1–F4: le fasi F5–F7 consumano i default e la QA §7 li verifica a schermo.

---

## 11. Out of scope
- Effetto WebGL **dentro** la cella E — **next step esplicito (D4)**: per ora solo placeholder bianco
- Rimozione definitiva di TextEntryGlass (dopo sign-off, fase 18)
- Qualsiasi uso del text-fit nel nuovo componente (vietato per vincolo utente)
- Cambi a SplitScreenHero, FeaturedGallery, SelectedProjects, Archives, Footer
