# Tools-App Modal System — Spec (approvata)

- Data: 2026-10-09 · Branch: `Tools-initial--0` · Scope: `tools-app/` soltanto
- Base: spec 2026-10-09 design-system (Fasi 1-4 implementate) + report Oracle modal-system
- Input: `DESIGN.md`, `AGENTS.md`, `ERROR-prevent.md`, `Audioreactive-ux.md`, skill `ui-ux-patterns`, skill `anti-ai-design-slop`
- Stato: 175 test verdi · `tsc` clean · dev `http://localhost:5173/tools/`
- Vincolo produzione: deploy solo su push a `react-full-site`

## Sezione 1 — Tassonomia modale ✅ approvata

GLOBALI (sezione "Component" dedicata sopra i tab di NodeOptions): opacity,
blendMode, hidden. Globali di progetto (restano dov sono): quality, aspect,
BPM, volume, theme. SINGOLARI: transform, per-tool params, per-effect params,
audio bindings.

Store: `opacity`, `blendMode`, `hidden` diventano gruppo tipizzato
`component { opacity, blendMode, hidden, scope }` con migration identità
(nessun dato perso). Novità: controllo scope su ogni globale
(`Questo elemento / Sopra+questo / Questo+sotto`) con badge range (`#0-2`).
Opacity esce dalla riga inline e diventa sezione modale con slider +
ValuePill + scope. Il fan-out sopra/sotto è helper additivo opt-in, non tocca il renderer.

## Sezione 2 — Layer-stack UI ✅ approvata

Posizione = indice (0 = fronte). Ogni nodo mostra sempre: badge indice `#N`,
badge audio `♪N` con tooltip dei binding, badge effetti `fN`, Hidden come
`Badge` (mai testo inline). Header NodeOptions con sottotitolo
`Elemento · #2 di 7`. Righe preset con identità elemento
(`#2 Video · Bass → Scale`). Cluster azioni sempre visibili (opacity-70,
mai hover-only). Reorder tastiera anche in FloatingStack. Header
FloatingPanel dinamico (`{label} · #{index}` con ellipsis + tooltip).

## Sezione 3 — Regole sezioni + igiene ✅ approvata

Label MAI a capo (ellipsis + tooltip + min-width); valori live solo in
ValuePill, mai nel testo label; un solo scroll per pannello; accordion ed
effect sempre richiudibili; pannelli flottanti clamp 12px + Esc + focus trap;
Catalog truncate + title; effective-value `base → effective` su slider con
binding; dimensioni disciplinate (bottoni 28/32/40, icone 16-20, pannelli
max 360px). QA a 3 width × 2 temi. Pannello Quarantine con clamp responsive.

## Guardrail anti-ai-slop (skill dedicata)

Un solo accento dominante (`#6C8CFF`, variante scura `#4A5FD9` per testi su
chiaro — mai accento chiaro su bianco sotto 4.5:1). Neutri freddi (tinta blu,
mai grigi puri). Niente `transition: all` (proprietà specifiche, 120–240ms
ease-out); animare solo transform/opacity; `prefers-reduced-motion` ovunque.
Hover variati per tipo (mai scale(1.05) dappertutto). Solo icone Lucide, mai
emoji. Max 2 livelli di superficie. Raggi misti per funzione, non un solo
radius. Focus ring 2px sempre visibile.

## Boundary Particelle

`src/tools/generative/particles.ts` + `src/engine/shaders/particles.ts`
intoccabili nel comportamento (gate sha256); solo restyle attorno.

## Fasi di implementazione

1. **Modal/store**: gruppo `component` + migration + `setComponent` + sezione
   Component + badge nodi + scope fan. Verifica: tsc, test nuovi (fan range,
   undo), subtitle e badge visibili.
2. **Layer-stack UI**: subtitle header, identità preset, cluster visibili,
   reorder tastiera FloatingStack, header dinamico. Verifica: acceptance
   osservabili + test.
3. **Igiene**: label-only, badge Hidden, Catalog truncate, status row bounded,
   Quarantine clamp, effective-value badge audio. Verifica: QA 3 width ×
   2 temi, zero wrap/overflow.
4. **QA gate**: suite verde, build ok, sha256 Particelle invariati, Esc/focus/
   badge/scope verificati a mano light+dark. Agenti paralleli di check:
   uno per unità (regression suite), uno visual-QA (screenshot 3×2),
   uno scenari ERROR-prevent.
