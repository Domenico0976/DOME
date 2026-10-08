# DOME Creative Tools — Render Core v2 (Sottoprogetto 1/3)

**Data:** 2026-08-25 · **Stato:** bozza per revisione owner · **Fase:** 1 di 3 (Render Core)
**Fonti:** `.omo/dome-creative-tools/final/Tool-Render.md`, prompt owner 2026-08-25
**Vincoli ereditati:** Budget €0 · UI copy inglese · mai push senza autorizzazione · architettura "universo" (registry versionato, migrateProject, retrocompatibilità)

---

## 1. Problema e obiettivi

I tool generativi attuali sono placeholder (es. Ferrofluid = gradienti radiali sfocati) e manca totalmente il sistema Effects dell'originale Sketch Tools. Obiettivi di questa fase:

1. **Algoritmi reali** per i generatori, equivalenti alle descrizioni/codice di `Tool-Render.md` (Gray-Scott reaction-diffusion, metaballs, Chladni, curl-noise, ecc.).
2. **Motore Effects componibile**: 7 pass di post-processing (Adjustments, Aberration, Glow, Waves, Edge Blur, Distort Lens, Grain) applicabili in pipeline sopra il risultato del tool.
3. **Modello dati + migrazione**: le istanze effetto entrano nello schema progetto senza rompere i progetti esistenti.
4. **Tab Controls/Effects** funzionante nel pannello nodo (lavoro UI minimo; il workspace cyber è la Fase 2).

## 2. Approcci valutati

| | A — Ibrido Canvas2D→WebGL2 ✅ | B — Pass CPU puri (ImageData) | C — Tutto su GPU |
|---|---|---|---|
| Contratto `ToolDef.render` | invariato | invariato | riscritto in GLSL |
| Perf a 720p–1080p @60fps con più effetti | buona (shader) | scarsa (blur/radiali in JS = jank) | ottima |
| Requisito "grid/shader GPU" del prompt | soddisfatto per gli effetti | violato | soddisfatto ovunque |
| Complessità/rischio | media | bassa | molto alta |
| Tool "Shaders" (nebula GLSL) | possibile via compositor | impossibile | naturale |
| Testabilità unitaria | alta (solver RD + fallback CPU in TS puro) | altissima | bassa |

**Decisione: Opzione A.** I generatori continuano a dipingere su Canvas2D offscreen (contratto invariato, rischio contenuto); gli effetti girano come fragment shader WebGL2 su texture; il Ferrofluid usa un solver Gray-Scott su griglia CPU (visivamente equivalente, deterministicamente testabile, upgrade-GPU possibile dopo dietro stessa interfaccia). L'Opzione C è il naturale passo successivo in futuro ma oggi sarebbe una riscrittura totale senza beneficio proporzionato.

## 3. Architettura del frame loop

```
requestAnimationFrame
 └─ base2d (offscreen Canvas2D, risoluzione da quality)
     └─ evaluateStack(...)            // invariato: tools dipingono in ordine
 └─ visibleCanvas
     ├─ NESSUN effetto attivo  → ctx2d.drawImage(base2d)      // path zero-cost preservato
     └─ ≥1 effetto attivo      → compositor.apply(base2d, chain, frame)
         ├─ texImage2D(base2d)                    // upload 1×/frame
         ├─ per ogni EffectInstance enabled, in ordine fisso:
         │    ping-pong FBO + fragment shader dell'effetto
         └─ draw quad finale sul canvas visibile (WebGL2)
```

Moduli nuovi:
- `src/engine/compositor.ts` — gestione contesto WebGL2, upload texture, catena pass ping-pong, fallback.
- `src/engine/effects/<type>.ts` ×7 — ognuno esporta `{ type, controls: ControlDef[], fragment: string, uniforms(params, frame, audio) }`.
- `src/engine/cpu-fallback.ts` — implementazioni TS pure di adjustments/waves/grain (reference + fallback no-GL).
- `src/engine/rd.ts` — solver Gray-Scott (§7).

Integrazione: `Canvas.tsx` crea il canvas offscreen e invoca il compositor; quando non servono effetti il comportamento è identico all'attuale (nessuna regressione perf).

## 4. Modello dati e migrazione

```ts
export type EffectType =
  | 'adjustments' | 'aberration' | 'glow' | 'waves'
  | 'edgeblur' | 'lens' | 'grain'

export type EffectInstance = {
  uid: string
  type: EffectType
  enabled: boolean
  params: Record<string, number>
}

// StackItem guadagna il campo OPZIONALE:
effects?: EffectInstance[]
```

- **SCHEMA_VERSION 1 → 2** (`core/schema.ts`; incremento additivo). `migrateProject` oggi passa `raw.stack` intatto: il passo di migrazione aggiunge quindi anche la normalizzazione per-item (`effects: []`).
- `migrateProject`: nuova versione aggiunge `effects: []` a ogni item; **nessun dato perso**.
- Azioni store: `addEffect(uid, type)`, `removeEffect(uid, effectUid)`, `setEffectParam(uid, effectUid, param, value)`, `toggleEffect(uid, effectUid)` — tutte marcano `unsaved`.
- **Ordine di applicazione fisso** secondo la lista del documento di riferimento; `enabled=false` salta il pass.
- **Export raster-forced**: se esiste ≥1 effetto abilitato, l'export dialog mostra badge "Raster output" (flag `rasterForced` calcolato; l'exporter SVG non esiste ancora — il flag è riservato per quando arriverà).

## 5. Matematica esatta dei 7 effetti (fonte: Tool-Render.md)

Ogni shader implementa fedelmente il codice di riferimento; qui la forma canonica e i parametri:

1. **Adjustments** — `brightness` additivo; contrasto `c=(259·(k+255))/(255·(259−k))` scalato attorno a 128; saturazione = lerp verso luminanza (0.299/0.587/0.114). Params: Brightness [−100..100], Contrast [−100..100], Saturation [−100..100].
2. **Aberration** — onda concentrica `wave = sin(dist·f)·displace`; canale R campionato a `x+wave`, B a `x−wave`, G fermo. Params: Displace [0..40], Frequency [0.01..0.15].
3. **Glow** — bright-pass (soglia) → blur gaussiano separabile 2×9-tap → blend additivo `out = base + blurred·intensity`. Params: Intensity [0..2], Threshold [0..1], Radius [1..16].
4. **Waves** — shift orizzontale per riga `shift = round(sin(y·quantity + t·speed)·intensity)`. Params: Intensity [0..40], Quantity [0.01..0.5], Speed [0..4] *(speed = estensione animata coerente col riferimento VHS)*.
5. **Edge Blur** — `r = dist/maxDist`; raggio locale `max(0,(r−area)/falloff)·MAXRAD`; campionamento medio radiale. Params: Area [0..0.8], Falloff [0.05..0.6].
6. **Distort Lens** — bulge fisheye `pow(norm, 1−intensity)` con rimapping radiale + specular highlight (gradiente radiale bianco vicino al centro). Params: Intensity [0..0.95], Center X/Y [0..1].
7. **Grain** — rumore hash per-pixel `(hash−0.5)·255·intensity` sommato ai canali; `motion=true` rigenera il seed a ogni frame (`u_seed = u_frame`). Params: Intensity [0..1], Motion (toggle 0/1).

Tutti i parametri sono agganciabili al sistema **AudioBinding/Automations/MIDI esistente** (le binding puntano a `param` dentro l'istanza effetto con chiave `effectUid.param`) — nessun nuovo motore di reattività.

## 6. Riscrittura generatori (mapping verso Tool-Render.md)

| id registry | Algoritmo | Parametri chiave | Note |
|---|---|---|---|
| `ferrofluid` **2.0.0** | Gray-Scott reaction-diffusion (§7) | Feed, Kill, Scale, Speed, Attractors, Accent(color) | bass audio → perturbazione Feed |
| `particles` **2.0.0** | Aggregazione su linee nodali di Chladni | Count, a, b, m, n, Damping | trama sabbiosa su nero |
| `flowfield` **2.0.0** | Streamlines curl-noise integrate | Segments, Step Length, Curl, Hue | migliaia di segmenti corti |
| `liquidmetal` (nuovo) | Metaball field + soglia + shading `pow(N·L,20)` | Blobs, Threshold, Light Angle | riflesso metallico |
| `molecules` (nuovo) | Rete nodi/legami pseudo-3D proiettata | Nodes, Link Distance, Depth Fade | alpha per profondità |
| `tunnel` **2.0.0** | Anelli prospettici verso punto di fuga | Rings, Speed, Shape(circle/square) | loop z ciclico |
| `shaders` (nuovo) | Nebula fbm-noise via pass GLSL dedicato | Scale, Speed, Palette | unico tool nativo GPU |
| `doodle` (nuovo) | Tratti quadratici jitter + ink blur | Strokes, Jitter, Width | stile acquerello |
| `brutalist` (nuovo) | Griglia forme geometriche B/N | Cols, Cell Size, Mix | menu click-cell = Fase 3 |
| `particles2` (nuovo) | Particelle multi-attractore | Count, Attractors, Strength | evoluzione dinamica |

- **Versioning**: i rewrite cambiano algoritmo e parametri → **major bump a 2.0.0**; i def 1.x vengono rimossi dal bundle e `migrateProject` traduce i vecchi item (`toolId@1.x → 2.0.0` + rimappatura parametri, es. `blobs→attractors`, `hue→accent`). Coerenza con la direttiva "universo": i progetti vecchi continuano ad aprirsi e renderizzare, aggiornati.
- **Icone de-slop**: `ToolDef.icon` resta `string` ma diventa una **chiave lucide** (`'atom' | 'sparkles' | 'waves' | …`); Catalog/Stack renderizzano `<Icon/>`. Eliminate le emoji (🟣 ✸ 🌊 …) segnalate come slop.
- La reconciliazione definitiva degli id (gli 8 generativi attuali vs i 10 target) avviene in fase di piano: gli id mancanti si aggiungono, nessun id esistente si elimina se non sostituito dalla tabella sopra.

## 7. Solver Gray-Scott (`engine/rd.ts`)

```ts
class ReactionDiffusion {
  constructor(size: number)                 // griglia quadrata size×size (default 160)
  seed(attractors: number, rng: () => number): void   // blob di B + rumore lieve
  step(feed: number, kill: number): void    // 1 iterazione laplaciana (ping-pong Float32Array)
  toImageData(accent: [number,number,number]): ImageData
}
```

- Bordi **toroidali** (wrap) → pattern continuo senza seam.
- **PRNG seeded (mulberry32)** → simulazione deterministica ⇒ unit-test ripetibili.
- Budget per frame: 160² celle × ~10 step ≈ 256k update ≈ trascurabile su CPU moderna; upscale con `drawImage(smoothing)` sul layer base.
- Il colore finale segue il riferimento: `mix(nero, accent, b[i])`.

Test dedicati: determinismo (stesso seed ⇒ stesso stato dopo N step), divergenza sana (media B entro range dopo N step), nessun NaN.

## 8. UI minima di Fase 1 (dentro NodeOptions)

- `Tabs` shadcn (già costruita): **Controls | Effects** nel pannello nodo selezionato.
- Tab Effects: elenco istanze (icona tipo + nome + `Switch` enabled + remove ghost icon) e per ciascuna gli slider dei propri parametri con lo **stesso contratto di accessibilità** dei Controls (`<label htmlFor>` + `id` + native range dove serve ai test).
- `Select "+ Add effect"` per istanziare un effetto; badge "Raster" in ExportMenu quando `rasterForced`.
- **Zero modifiche al layout App** — infinite canvas, pannelli fluttuanti, timeline espandibile sono Fase 2.

## 9. Fallback, errori, performance, a11y

- **Nessun WebGL2** → fallback CPU automatico per adjustments/waves/grain (implementazioni condivise in `cpu-fallback.ts`); gli altri 4 risultano disabilitati con tooltip "Requires WebGL".
- **Context loss GL** → ricrea il contesto al frame successivo; un frame di passthrough.
- `quality: low` riduce anche la risoluzione dei pass GL (0.5×).
- `prefers-reduced-motion`: Grain motion statico, Waves time-freeze, Speed clampato.
- Focus ring/token coerenti col design system esistente; copy inglese; nessun emoji.

## 10. Testing e verifica

- **vitest nuovi**: `rd.test.ts` (determinismo/divergenza/no-NaN), `cpu-fallback.test.ts` (reference impl adjustments/waves/grain), migrazione schema v1→v2 (item senza `effects` normalizzato), azioni store effetti, tab Effects in NodeOptions (add/remove/toggle/param).
- **Regressione**: i 39 test esistenti devono restare verdi; `tsc --noEmit` pulito; `vite build` ok.
- **Verifica visiva manuale**: per ogni tool ed effetto, confronto con gli screenshot di riferimento forniti dall'owner su `http://localhost:5173/tools/` (checklist allegata al piano).
- **Budget performance**: 60fps @720p con ≥3 effetti attivi su hardware medio (profilo DevTools).

## 11. Fuori scope (Fase 2/3)

Canvas infinito pan/zoom + dot-grid, pannelli fluttuanti draggable, catena nodi con connettori, timeline espandibile, modale "React to", Modes per-tool, anchor point sul canvas, galleria template con conferma unsaved, menu contestuale celle Brutalist.

## 12. Assunzioni decisionali (prompt auto-rispondente, domande non pervenute)

- **A1** Confermata scomposizione 1→2→3 (rispecchia la struttura A/B/C del prompt owner).
- **A2** Scelta l'Opzione A (ibrido); upgrade full-GPU possibile in futuro dietro stessa interfaccia `EffectPass`.
- **A3** Il restyle "cyber" della palette arriva interamente con la Fase 2; in questa fase solo de-slop (icone lucide, zero emoji).
- **A4** Gli effetti vivono **per-StackItem** (tab del nodo), non come entry dello stack — coerente col riferimento "tab Effects nel panel del nodo selezionato".
- **A5** Major-bump generatori + migrazione parametri invece di doppia registrazione delle versioni.
