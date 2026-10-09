# Tools-App Design System — Spec (approvata)

- Data: 2026-10-09 · Branch: `Tools-initial--0` · Scope: `tools-app/` soltanto
- Approccio: **A — token-first restyle** (struttura invariata, logica engine/store intatta)
- Input: `tools-app/DESIGN.md`, `AGENTS.md`, `ERROR-prevent.md`, 2 report Oracle, skill `ui-ux-patterns`
- Stato: 136 test verdi · build `tsc --noEmit && vite build` · dev su `http://localhost:5173/tools/`
- Vincolo produzione: il deploy parte solo su push a `react-full-site` — qui nessun deploy

## Sezione 1 — Token light/dark ✅ approvata

Dark = palette DESIGN.md mappata sui var HSL esistenti (`globals.css`):
bg-app `#0B0B0D`, bg-canvas `#111114`, bg-panel `#16161A`, raised `#1C1C21`,
text `#F4F4F5` / secondary `#A1A1AA` / muted `#71717A`.

Light = NUOVA: bg `#F4F4F6`, panel `#FFFFFF`, text `#18181B`,
muted **`#57575F`** (fix P0-1: 38%→46%+ per 4.5:1 su secondari).

Accento **`#6C8CFF`** in entrambi i temi (sostituisce l'arancione `28 90% 50%`
attuale, come da DESIGN.md). Su light, accento-come-testo in variante
scurita `#4A5FD9`. Primary-button: fill accento + testo scuro (dark) / bianco (light).

**Canvas FISSO scuro `#111114` in entrambi i temi** (modello Figma/Blender:
giudizio visivo costante). Rimosso il gradiente radiale di `App.tsx:39`.

Altri token: `--scrollbar` dedicato (fix P0-6: dark `rgba(255,255,255,0.18)`,
light `rgba(0,0,0,0.25)`, ≥3:1). Font UI **Geist** (già caricato in `index.html`, nessuna nuova dipendenza),
valori numerici **Geist Mono** tabular-nums. Spaziatura base 4px, radius 6/10/14/999,
motion 120–240ms + `prefers-reduced-motion` (già presente, estendere a GSAP).

## Sezione 2 — Shell layout ✅ approvata

Struttura invariata, misure a spec:
- **Sidebar**: resta icon-rail compatta 64px con tooltip (NON i 220–260px di
  DESIGN.md: lo stack nodi vive in FloatingStack).
- **TopBar 48px**: brand + project + azioni (Save primario blu,
  Preview/Quality/Export) + ThemeToggle + account.
- **Canvas centrale dominante**, sfondo fisso, priorità visiva massima.
- **Bottom**: ExportMenu + AudioReactPanel invariati di posizione.
- **FloatingPanel**: header con grip-icon 16px + titolo + close; clamp 12px dai
  bordi canvas; mai sopra il layer selezionato (nudge automatico); `Esc`
  chiude; focus trap + ritorno focus; max 1–2 pannelli visibili.
- **FloatingStack**: resta dov'è; nodi con grip-icon, cursor grab/grabbing,
  `aria-grabbed`, reorder anche da tastiera.

## Sezione 3 — Regole interazione ✅ approvata

- **Slider**: orizzontali, min-sx. Ognuno con ValuePill mono live + min/max
  visibili. Timeline disabilitata con readout `0.0s / 0.0s` se `max=0` (fix P0-2).
  BPM clampato 20–300 su commit (fix). Blend `Plus darker`→`multiply` (fix duplicato).
- **Tab**: trigger con badge conteggi (`Effects (2)`); tab-bar richiudibile a
  pill; tab inattivo smontato (`unmountOnIdle`); frecce/Home/End native Radix.
- **Scroll**: un solo contesto per pannello; tutti gli `overflow-*` grezzi
  (Stack, FloatingStack-track, Catalog, presets) → `ScrollArea` con rail
  visibile o fade; niente scroll-trap nidificati.
- **Movable**: grip-icon lucide 16px + cursor + `aria-grabbed` su pannello,
  nodi stack, canvas pan; pan canvas da tastiera (frecce 8px, Shift 32px);
  resize-handle con `onKeyDown`.
- **Disclosure**: effect-card in accordion (header 1-riga summary + toggle /
  reset / delete); sezioni Audio/MIDI/Automations collapsible (MIDI e
  Automations collassate di default); cluster azioni sempre visibili
  (mai hover-only); Catalog con filtro + search; badge al posto di liste aperte.

## Sezione 4 — A11y + error-prevention ✅ approvata

- Focus ring 2px blu sempre visibile; aria-label su ogni icon-button;
  label↔control associati; hit target ≥44px (fix preset-toggle 2px);
  `aria-valuetext` su ogni slider; `lang`, skip-link già ok.
- **ToastProvider nuovo** con `aria-live="polite"` per save/export/quarantine.
- **Effective-value**: ogni slider con binding audio mostra badge live
  `Audio: x.xx` (display-only, mai write-back) + azione disable modulation
  (fix mismatch UI/render ERROR-prevent §10/§13).
- **Reference integrity**: rimozione layer/effetto → binding in quarantine con
  toast non bloccante `[Restore] [Delete] [Review]`; mai delete silenziosa;
  restore su undo; migrazioni con `legacyParams` (ERROR-prevent §1–§9).
- **Performance**: banner degrado esplicito (cosa/ perché/ come tornare).
- **Boundary Particelle**: `src/tools/generative/particles.ts` +
  `src/engine/shaders/particles.ts` intoccabili nel comportamento; solo
  restyle attorno. Formula `resolveEffectValue`, schema store e pipeline
  render invariati.

## Fasi di implementazione

1. **Token** (`globals.css`, tailwind map, scrollbar, clamp BPM store, blend fix)
   → verifica: `tsc` + test verdi, contrasti misurati light/dark.
2. **Shell** (TopBar, rail, canvas bg, FloatingPanel clamp/Esc/trap, Stack rail)
   → verifica: test esistenti + nuovi (Esc, margini, rail visibile).
3. **Pannelli tool** (ValuePill ovunque, tab badge/collapse, accordion effetti,
   effective-value badge, Catalog filter, cluster sempre visibili)
   → verifica: acceptance check P0–P1 del report Oracle UX.
4. **Toast + quarantine UI + banner performance** → verifica: scenari
   ERROR-prevent §1–§9 simulati in test.
5. **QA visiva** su `http://localhost:5173/tools/` light+dark, 136+ test verdi.

Criterio di done per fase: build verde, test verdi (vecchi + nuovi),
acceptance check osservabili a mano. Particelle perfette in ogni fase.
