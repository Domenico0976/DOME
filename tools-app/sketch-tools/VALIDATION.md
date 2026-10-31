# Sketch Tools — Validation checklist

Ogni voce dal reverse ha: stato, controparte DOME, regola anti-distruttiva.
Legenda: ✅ riuso diretto · 🔶 riuso con vista aggiuntiva · ❌ da costruire (additivo).
Nessuna voce richiede modifiche al core (`registry`, `projectStore`, renderer).

## Elementi (bundle `main-DNPwjhJt.js`) — 17 voci

| # | Sketch | DOME | Stato | Regola |
|---|--------|------|-------|--------|
| 1 | Text | `inputs/text` | ✅ | — |
| 2 | Image | `inputs/imageVideo` | ✅ | — |
| 3 | Video | `inputs/imageVideo` | ✅ | loop/mute/playback esistenti |
| 4 | Audio (sorgente analisi) | `inputs/audioFile` | ✅ | attach via `SketchAudioEngine.attach*` |
| 5 | Shape / Background | `inputs/solidColor`, `gradient` | ✅ | — |
| 6 | Camera | `inputs/camera` | ✅ | permesso a runtime, placeholder se negato |
| 7 | Particles | `generative/particles` | ✅ | 4 mode già presenti |
| 8 | Tunnel | `generative/tunnel` | ✅ | — |
| 9 | Kaleidoscope | `generative/kaleidoscope` | ✅ | — |
| 10 | Ferrofluid | `generative/ferrofluid` | ✅ | — |
| 11 | Flowfield | `generative/flowfield` | ✅ | — |
| 12 | Shader | `generative/shaders` | ✅ | — |
| 13 | Filter (halftone/pixel/thermal/relight/…) | `filters/*` + `engine/effects` | ✅ | nuovi filtri via `registerTool`, mai toccare `EFFECT_ORDER` |
| 14 | Rings/Starfield/Plasma/LiquidMetal/Molecules/Doodle/Brutalist | `generative/*` DOME-only (superset) | ✅ | Sketch non li ha: vantaggio DOME, nessuna azione |
| 15 | Waveform | `sketch/waveform` | ✅ (T1) | `amplitude` bindabile, modi bars/line/mirror |
| 16 | Spectrum | `sketch/spectrum` | ✅ (T1) | bucket linear/log, `bands` bindabile |
| 17 | Oscilloscopio | `sketch/spectrum` scope mode | ✅ (T1) | polyline su spectrum |
| 18 | GLTFExport | — | ➖ | fuori scope, ignorare esplicitamente |

## UI / Pannelli / Controlli — 20 voci (dettaglio in `sketchUi.ts`)

| # | Sketch | DOME | Stato | Regola |
|---|--------|------|-------|--------|
| 1 | Sidebar shell collapsible | `ui/Sidebar.tsx` | ✅ | palette nodi come sezione interna |
| 2 | TopBar | `ui/TopBar.tsx` | ✅ | solo nuove voci menu, mai riordinare |
| 3 | Canvas pan/zoom + reset | `ui/CanvasArea.tsx` + `ZoomPanel.tsx` | ✅ | nodi come child layer, zoom resta in App |
| 4 | Empty state + Add tool | `ui/Canvas.tsx` | 🔶 | stesso pattern hint esistente |
| 5 | Bottom audio panel, single dock 57px | `ui/AudioReactPanel.tsx` | ✅ (T6) | UNICO pannello; tabella full-width + slim rail, no form, no tips-row |
| 6 | Timeline slider + durata 01:00 | `AudioReactPanel` | 🔶 | scrive solo `timeline.durationSec` |
| 7 | BPM input (82) | `AudioReactPanel` | 🔶 | manuale vince sul tracker, mai viceversa |
| 8 | Transport Stop/Play | `AudioReactPanel` | ✅ | `seekAudio` solo in export |
| 9 | Upload mp3/wav + mic | `AudioReactPanel` | ✅ | attach additivo |
| 10 | MIDI panel | `projectStore midi` | ✅ | `MidiBinding` invariato |
| 11 | Presets/Scenes toggle | `PresetMegaMenu` | ✅ | scenes = collezioni di preset |
| 12 | 6 colonne + Timeline | `ui/PresetTable.tsx` | ✅ (T3) | vista sopra righe esistenti, Duration resta globale |
| 13 | Dropdown React-to + gear | `ui/ReactToPanel.tsx` | ✅ (T3) | 12 voci `Ont` in `src/audio/reactToOptions.ts`, gear = range + direction |
| 14 | Tooltips colonne | `ui/PresetTable.tsx` | ✅ (T3) | `title` nativi con copy T5 |
| 15 | Nodi stack + connettori SVG | `ui/StackPanel.tsx` | 🔶 | connettori derivati, mai salvati |
| 16 | Tool slots | `core/registry.ts` | ✅ | solo `registerTool` |
| 17 | Param controls | `ui/FloatingPanel.tsx` | ✅ | `ControlDef` generico |
| 18 | Display & Export / Save / Templates | `ui/TopBar.tsx` | 🔶 | piano `sketchExport.ts` dietro entry esistente |
| 19 | Tips carousel dismissabile | `ui/PresetTable.tsx` | ✅ (T3) | barra singola, localStorage, mai blocca canvas |
| 20 | Theme + toast | `globals.css` + toast | ✅ | riuso token/infra |

## Effetti audio-reactive — 6 binding Sketch → DOME

| Sketch (tip CAPTURE) | DOME `AudioBinding.source` | Stato |
|---|---|---|
| React to window (mix) | `level` | ✅ conversione in `sketchColumns.ts` |
| bass pulse (scale/glow) | `bass` | ✅ |
| rms → relight intensity | `level` | ✅ |
| mid → thermal | `mid` | ✅ |
| beat flash | `bpm` + `beat.strength` | ✅ (T2) `beat.strength` fluisce da `readFrame`, binding `beat` attivo |
| treble → particles/flicker | `treble` / `spectrum[band]` | ✅ |

## Export video — 5 formati bundle

| Formato | Sketch | DOME | Stato |
|---|---|---|---|
| mp4 realtime | MediaRecorder | `exportActions.video` | ✅ (T4) `frameExport.exportRealtime` + `pickVideoMimeType` |
| webm realtime | MediaRecorder | `exportActions.video` | ✅ (T4) default, fallback mime testato |
| gif | gify | — | ❌ dopo mp4 (serve encoder) |
| png/jpeg sequence | frame-by-frame + seekAudio | `frameExport.exportSequence` | ✅ (T4) runner; azione PNG multipla non aggiunta (download ostili) |
| 3D (gltf) | GLTFExport | — | ➖ fuori scope |

## Garanzie non-distruttive (verificate dai test)

1. `sketchRowToBinding` ↔ `bindingToSketchRow` round-trip senza perdita (test).
2. `window` ↔ `level` è l'unica traduzione ammessa (test).
3. `clampSensitivity` tiene 0–2 (test); valori fuori range non toccano lo stato.
4. `frameTimeSec` resta dentro `[0, durationSec)` (test).
5. `ELEMENT_GAPS` è vuoto dopo T1 (waveform + spectrum creati, test).
6. `UI_GAPS` = solo viste additive, mai modifiche a store/registry (test).
7. `SCHEMA_VERSION` 4 + migration: lo studio non tocca `src`, quindi zero rischio.
