# Sketch Tools — Studio REA (tools.sketchdesign.club)

Studio di reverse engineering del tool online, fatto con REA (browser-scenario capture +
analisi statica del bundle). Obiettivo: riusare i concetti (canvas a stack di nodi,
colonne audio-reactive, export video) dentro DOME `tools-app`, che è già un visual
engine modulare (`Sources → Layers → Effects → Audio Modulation → Compositor`).

> Regola DOME che resta valida: l'audio **modula parametri**, mai pixel diretti.
> Ogni binding è serializzabile, ordinabile, rimovibile senza rompere il resto.

## 1. Evidence REA (tracciabilità)

| # | Operazione | Evidence / artefatto |
|---|-----------|----------------------|
| 1 | Landing capture (goto + 10s wait, DOM+screenshot+network) | `ev_d2e99502…` + `tool_192280…` (1.7 MB) |
| 2 | Click-test, strict-mode violation → 26 bottoni nominati | `ev_61df5b41…` (fallita con lista ruoli accessibili) |
| 3 | Click "New Project" + DOM editor | `tool_1922f6e1…` (~200 KB) |
| 4 | Bundle `main-DNPwjhJt.js` 4 474 130 byte scaricato in `%TEMP%\opencode\sketch-rev\main.js`, grep statico | conteggi §4 (REA `analyze_javascript_application` in timeout su 4.4 MB → fallback grep verificabile) |

## 2. Landing (`https://tools.sketchdesign.club/`)

- Titolo: **"Sketch Tools | A new way to create"**, meta descrive *"design motion and
  audio-reactive visuals right in your browser"*.
- SPA React + Tailwind + Radix + Sonner, dark mode via `localStorage` key `theme`.
- Un solo bundle: `/assets/main-DNPwjhJt.js` (+ preload `vaultProtocol-D6oDJs9z.js`).
- Sidebar 260 px, 4 nav + CTA community, grid template, community projects con remix
  count, sort radio (Most popular / Newest). 200 div, 26 button, 53 SVG, 49 img.
- Media su Supabase (`qxvchqmvmt…supabase.co`, signed URL con JWT). Analytics: FB Pixel
  + gtag. Nessun endpoint API catturato (solo 10s wait).

## 3. Editor (`https://tools.sketchdesign.club/#tools`, dopo "New Project")

- **Niente `<canvas>`, niente WebGL/three.js**: il "canvas" è un container DOM/SVG con
  pan/zoom via `transform` (`data-canvas-pan-zoom → data-canvas-area-stack →
  data-stack-workspace`), reset view dedicato.
- Nodi = `data-stack-node` (header draggable 28px, handle 28×20) con porte circolari
  8×8 (`data-stack-node-port`), connettori = `<path stroke="var(--stack-connector)">`.
  Empty state: *"Add a tool to get started"* + bottone `Add tool` (×6 istanze contate).
- **Pannello audio inferiore** (`data-motion-audio-panel`, collapsible 320ms):
  slider timeline (0–60s, tick ogni 3s), input durata `01:00`, input **BPM `82`**,
  transport Stop/Play, upload `.mp3,.wav`, `Record mic`, bottone **MIDI**
  (`aria-label="Open MIDI assignment panel"`), toggle expand.
- **Griglia colonne** (template `258px 158px 132px 144px 132px 44px minmax(0,1fr)`):
  `Duration | Presets | React to | Sensitivity | Value range | Frequency | Timeline`
  con toggle Presets/Scenes e tooltip "About the X column" per colonna.
- La colonna **React to** ha solo info-icon nell'header; il dropdown (dove vive
  l'opzione *"React to window"* + gear citati nel tip di bordo:
  *"fine-tune how strongly visuals react to sound with the gear icon in the React to
  window"*) è renderizzato on-demand, non era nel DOM catturato.
- Export: bottone **Display & Export** + Save Project / Templates / Browse tools.

## 4. Bundle JS (conteggi statici verificati via grep)

| Segnale | Conteggio | Lettura |
|---|---|---|
| `AudioContext` / `createAnalyser` / `getByteFrequencyData` | 15 / 8 / 7 | FFT via Web Audio, `fftSize` configurabile |
| `bpm` / `beat` / `bass` / `mid` / `reactTo` / `reactivity` / `frequency` | 288 / 117 / 101 / 111 / 59 / 23 / 53 | beat-tracking + bande, reattività per-sorgente |
| `canvas` / `HTMLCanvasElement` / `OffscreenCanvas` / `WebGL` | 714 / 58 / 14 / 156 | rendering canvas (l'editor nodi è DOM, il render è canvas) |
| `MediaRecorder` / `recordCanvas` / `frameByFrameExport` / `seekExport` | 17 / 21 / 5 / 13 | export video: realtime + frame-by-frame con `seekAudio` sync |
| `mp4` / `png` / `jpeg` / `gify|gif` | 82 / 141 / 40 / 176+ | formati export |
| `GLTFExport` 23 | — | export 3D (fuori scope DOME) |
| Text 5849 / Image 1019 / Video 883 / Audio 854 / Filter 765 / Shape 607 / Shader 564 / Background 440 / Tunnel 305 / Particles 252 / Kaleidoscope 69 / Ferrofluid 91 / Waveform 19 / Spectrum 11 / Oscilloscope 29 / Flowfield 15 | — | catalogo elementi (§6) |
| `activeTool` 42 / `slotTool` 22 / `htmlTool` 21 / `audioTool` 7 / `newlyAddedElement` 7 | — | sistema tool modulare a slot |

## 5. Architettura Sketch (ricostruita)

```text
Project (Supabase: templates + user-projects firmati)
  └─ Stack (nodi data-stack-node + porte + connettori SVG, pan/zoom DOM)
       ├─ Tool speciali: audioTool (sorgente analisi) + slotTool/htmlTool (contenitori)
       └─ Colonne per nodo: Duration · Presets · ReactTo · Sensitivity · ValueRange · Frequency · Timeline
            └─ AudioEngine (AudioContext → Analyser → fftSize → getByteFrequencyData
                            → bande bass/mid/treble + level + beat/bpm)
                 └─ Export (MediaRecorder realtime | frame-by-frame + seekAudio | mp4/webm/gif/png)
```

## 6. Mappatura Sketch → DOME (cosa riusare, cosa manca)

| Sketch | DOME esistente | Azione |
|---|---|---|
| stack nodi + porte SVG | `StackItem[]` + `StackPanel` | modellare come vista, non duplicare lo stato |
| colonne Duration/Presets/ReactTo/Sensitivity/ValueRange/Frequency | `AudioBinding {param, source, band, curve, amount, range}` + `AudioPreset` | `sketchColumns.ts` converte riga-colonne → binding |
| bande bass/mid/treble/level + bpm/beat | `AudioFrame {bass, mid, treble, level, spectrum, bpm}` | `sketchAudio.ts` implementa analisi mancante (beat/BPM) |
| Particles/Tunnel/Kaleidoscope/Ferrofluid/Flowfield | `src/tools/generative/*` già presenti | riuso diretto |
| Text/Image/Video/Audio/Shape/Background | `src/tools/inputs/*` già presenti | riuso diretto |
| Waveform / Spectrum / Oscilloscopio | **mancano** | nuovi tool `sketch-waveform`, `sketch-spectrum` |
| MediaRecorder + frame-by-frame + seekAudio | export DOME esistente (§10 roadmap) | `sketchExport.ts` come piano export |
| MIDI panel | `MidiBinding {uid, param, cc}` già in types | riuso |
| GLTFExport | fuori scope | ignorare |

## 7. File di questo studio

```text
sketch-tools/
  STUDIO.md           ← questo file (reverse + decisioni)
  sketchTypes.ts      ← nodi stack, colonne, progetto (tipi puri, zero dipendenze)
  sketchAudio.ts      ← engine AnalyserNode: bande + beat/BPM + sensitivity/reactivity
  sketchElements.ts   ← catalogo elementi dal bundle + mapping verso ToolDef DOME
  sketchColumns.ts    ← definizioni colonne + conversione riga → AudioBinding/Preset
  sketchExport.ts     ← piano export (MediaRecorder realtime / frame-by-frame)
  index.ts            ← barrel + EVIDENCE + snippet di integrazione
```

## 8. Integrazione in DOME (1 riga + 2 tool)

```ts
// src/tools/index.ts — ✅ implementato in T1 (2026-10-31) come waveform/spectrum
import { waveformTool } from './sketch/waveform'
import { spectrumTool } from './sketch/spectrum'
registerTool(waveformTool)
registerTool(spectrumTool)
```

Dettaglio: gli elementi Sketch già coperti da DOME non si duplicano; si aggiungono solo
`sketch-waveform` e `sketch-spectrum` (generativi, leggono `AudioFrame` esistente).
Le colonne diventano una vista sopra `AudioPreset`/`AudioBinding`, il pannello audio
resta `AudioReactPanel` (footer) — niente pannelli duplicati (regola AGENTS §11.19.11).

## 9. Prossimi passi

1. ✅ `waveform` + `spectrum` come `ToolDef` in `src/tools/sketch/` (T1, 2026-10-31).
2. Vista "Columns" sopra `PresetTable` esistente (Duration/ReactTo/Sensitivity/
   ValueRange/Frequency) — solo UI, zero cambi di stato. ✅ (T3, 2026-10-31:
   6 colonne funzionali — Duration resta globale nel soundbar; dropdown 12 voci
   `Ont` in `src/audio/reactToOptions.ts`, Direction toggle, Frequency band).
3. ✅ Export frame-by-frame con `seekAudio` (T4, 2026-10-31): `src/engine/frameExport.ts`
   (`exportSequence` + `exportRealtime`) dietro `exportActions.video` (3s webm/mp4).
4. ✅ Opzioni dropdown "React to" (T5, 2026-10-31): 12 voci `Ont` + gear/range/curve.
5. ✅ Soundbar single-dock (T6, 2026-10-31): transport 57px + `PresetTable`
   full-width + slim rail (waveform/volume/meters/diag); creazione righe solo dal
   mega menu; `PresetRail`/`PresetSettingsFields` rimossi.
