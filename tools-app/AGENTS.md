# Agents.md — App Logic & Architecture

## 1. Obiettivo

Questo documento definisce le logiche funzionali dell’app: come si comportano progetto, sorgenti, layer, effetti, parametri, audio-reactivity, rendering e persistenza.

L’app è un **visual engine modulare**:

```text
Sources → Layers → Effects → Audio Modulation → Compositor → Output
```

Ogni fase è indipendente, testabile e sostituibile. Nessun modulo deve conoscere direttamente l’implementazione degli altri: comunica solo attraverso contratti dati e interfacce.

---

## 2. MVP

### 2.1 Scope MVP

L’MVP consente a un utente di:

1. Creare un progetto.
2. Caricare una sorgente video o immagine.
3. Aggiungere un layer testo.
4. Applicare almeno due effetti: `Re-light` e `Thermal`.
5. Caricare una traccia audio.
6. Configurare BPM e audio-reactivity.
7. Modificare trasformazione, colore, saturazione, opacità e blend mode.
8. Vedere l’anteprima in tempo reale.
9. Salvare il progetto.
10. Esportare il risultato.

### 2.2 Fuori MVP

Non includere nell’MVP:

- Collaborazione multiutente in tempo reale.
- Version history avanzata.
- Plugin marketplace.
- AI generation.
- Timeline multi-traccia complessa.
- Export cloud distribuito.
- Editing collaborativo simultaneo.

Queste funzionalità devono però restare possibili grazie all’architettura modulare.

### 2.3 Criteri di completamento MVP

- Un progetto può contenere almeno: `video`, `image`, `text`, `effect`, `audio`.
- Ogni layer ha proprietà deterministiche e serializzabili.
- Ogni effetto è attivabile, disattivabile, configurabile e rimovibile senza rompere gli altri.
- L’audio può modulare uno o più parametri.
- Il rendering è riproducibile dal medesimo project state.
- Il salvataggio e il caricamento non perdono configurazioni.
- L’aggiunta di un nuovo effetto non richiede modifiche al core renderer.

---

## 3. Principi architetturali

### 3.1 Single Source of Truth

Lo stato del progetto è l’unica fonte di verità:

```ts
type ProjectState = {
  id: string;
  name: string;
  version: number;
  settings: ProjectSettings;
  sources: Record<string, SourceAsset>;
  layers: Layer[];
  audio: AudioConfig;
  output: OutputConfig;
};
```

La UI non contiene logica di rendering: legge e scrive nello stato.

### 3.2 Immutabilità

Ogni modifica produce un nuovo stato o una patch immutabile.

```ts
updateLayer(layerId, patch);
updateEffect(layerId, effectId, patch);
updateAudioMapping(mappingId, patch);
```

Questo permette undo/redo, salvataggio, collaborazione e test.

### 3.3 Composizione

I layer sono componibili:

```text
Source Layer
  → Transform
  → Appearance
  → Effect Stack
  → Audio Modulation
  → Blend into parent/compositor
```

### 3.4 Estensibilità

Un nuovo effetto, sorgente o modulatore deve poter essere aggiunto tramite registrazione, senza modificare il core.

```ts
registerEffect(ThermalEffect);
registerEffect(RelightEffect);
registerAudioModulator(BeatPulseModulator);
registerSourceAdapter(VideoSourceAdapter);
```

### 3.5 Fail-safe

- Un effetto rotto non deve bloccare il rendering.
- Un asset mancante deve mostrare placeholder, non crash.
- Parametri fuori range vengono normalizzati o clamped.
- Ogni entità ha `id`, `type`, `version` e validazione.

---

## 4. Modello dati

### 4.1 Project

```ts
type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  settings: ProjectSettings;
  sources: SourceAsset[];
  layers: Layer[];
  audio: AudioConfig;
  output: OutputConfig;
};
```

### 4.2 Project settings

```ts
type ProjectSettings = {
  width: number;
  height: number;
  frameRate: number;
  background: ColorValue;
  duration: number | null;
  loop: boolean;
};
```

### 4.3 Source asset

```ts
type SourceAsset = {
  id: string;
  kind: "video" | "image" | "audio" | "camera" | "screen" | "generative";
  name: string;
  url?: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    bpm?: number;
    sampleRate?: number;
  };
  status: "ready" | "loading" | "error" | "missing";
};
```

### 4.4 Layer

```ts
type Layer = {
  id: string;
  name: string;
  type: LayerType;
  enabled: boolean;
  locked: boolean;
  visible: boolean;
  sourceId?: string;
  transform: Transform;
  appearance: Appearance;
  effects: EffectInstance[];
  audioBindings: AudioBinding[];
  blend: BlendConfig;
  zIndex: number;
};
```

### 4.5 Layer type

```ts
type LayerType =
  | "video"
  | "image"
  | "text"
  | "shape"
  | "solid"
  | "gradient"
  | "particle"
  | "adjustment"
  | "group";
```

---

## 5. Trasformazione

Ogni layer ha una trasformazione standard.

```ts
type Transform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
};
```

Regole:

- `x`, `y`: posizione in pixel oppure percentuale.
- `scaleX`, `scaleY`: moltiplicatori, default `1`.
- `rotation`: gradi, default `0`.
- `opacity`: `0–1`, default `1`.
- `anchor`: punto di pivot normalizzato `0–1`.

### Validazione

```ts
clamp(value, min, max);
normalizePercent(value);
isValidTransform(transform);
```

`opacity` deve essere clampata tra `0` e `1`. Scale non può essere negativa; `0` è consentito solo se il layer resta selezionabile.

---

## 6. Appearance

```ts
type Appearance = {
  fill?: ColorValue;
  stroke?: ColorValue;
  strokeWidth?: number;
  saturation: number;
  brightness: number;
  contrast: number;
  hueShift: number;
  blur: number;
  grain?: number;
  vignette?: number;
};
```

### Parametri base

| Parametro | Range | Default | Effetto |
|---|---:|---:|---|
| `saturation` | `-1 a 2` | `0` | `-1` = bianco e nero, `0` = originale, `>0` = più saturo |
| `brightness` | `-1 a 1` | `0` | Schiarisce o scurisce |
| `contrast` | `-1 a 2` | `0` | Aumenta o riduce il contrasto |
| `hueShift` | `-180 a 180` | `0` | Ruota la tonalità |
| `blur` | `0 a 100` | `0` | Sfoca il layer |
| `opacity` | `0 a 1` | `1` | Trasparenza |

### Regola importante

`Appearance` è separata dagli effetti. Gli effetti possono leggere questi valori, ma non devono sovrascriverli direttamente: producono una modifica derivata.

```ts
effectiveAppearance = resolveAppearance(baseAppearance, activeEffects, audioState);
```

---

## 7. Blend mode

```ts
type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";
```

```ts
type BlendConfig = {
  mode: BlendMode;
  opacity: number;
  blendWith: "previous" | "background" | "group" | "custom";
  targetLayerId?: string;
};
```

### Logica

- `previous`: il layer si blending con il risultato del layer sottostante.
- `background`: il layer si blending con lo sfondo del progetto.
- `group`: il layer si blending con il risultato del gruppo.
- `custom`: richiede `targetLayerId`.

Il blend viene applicato dopo effects e audio modulation:

```text
layerRender = applyEffects(sourceRender, effects)
layerRender = applyAudioModulation(layerRender, audioBindings)
finalPixel = blend(layerRender, targetRender, blendConfig)
```

---

## 8. Effect system

### 8.1 Effect instance

```ts
type EffectInstance = {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  params: Record<string, EffectParamValue>;
  audioBindings: AudioBinding[];
};
```

### 8.2 Effect definition

```ts
type EffectDefinition = {
  type: string;
  label: string;
  category: "color" | "light" | "distort" | "style" | "generate" | "audio";
  defaultParams: Record<string, EffectParamValue>;
  params: EffectParamSchema[];
  supportsAudio: boolean;
  render: (input: RenderInput) => RenderOutput;
};
```

### 8.3 Param schema

```ts
type EffectParamSchema = {
  key: string;
  label: string;
  type: "number" | "slider" | "color" | "select" | "boolean" | "vector2";
  min?: number;
  max?: number;
  step?: number;
  default: EffectParamValue;
  options?: { value: string; label: string }[];
  audioModulatable: boolean;
};
```

### 8.4 Contract

Ogni effetto deve:

- Ricevere un input renderizzato.
- Restituire un output dello stesso formato.
- Non mutare lo stato globale.
- Non conoscere gli altri effetti.
- Dichiarare i propri parametri.
- Supportare fallback se un parametro è mancante.
- Essere serializzabile.

```ts
type RenderInput = {
  canvas: RenderSurface;
  layer: Layer;
  effect: EffectInstance;
  time: number;
  audio: AudioAnalysisFrame;
  project: Project;
};

type RenderOutput = {
  canvas: RenderSurface;
};
```

---

## 9. Effetti MVP

### 9.1 Re-light

Simula una modifica della luce sulla scena.

```ts
type RelightParams = {
  intensity: number;       // 0–2
  lightX: number;          // -1–1
  lightY: number;          // -1–1
  radius: number;          // 0–1
  color: ColorValue;
  contrast: number;        // -1–1
  ambient: number;         // 0–1
};
```

Comportamento:

- `intensity = 0`: nessuna modifica.
- `lightX/lightY`: posizione della luce.
- `radius`: ampiezza dell’illuminazione.
- `color`: tinta della luce.
- `ambient`: luce di base non direzionale.

### 9.2 Thermal

Applica una mappatura termica/coloristica.

```ts
type ThermalParams = {
  intensity: number;       // 0–1
  lowColor: ColorValue;
  midColor: ColorValue;
  highColor: ColorValue;
  thresholdLow: number;    // 0–1
  thresholdHigh: number;   // 0–1
  smoothness: number;      // 0–1
  invert: boolean;
};
```

Comportamento:

- Calcola luminanza del pixel.
- Mappa la luminanza su `lowColor → midColor → highColor`.
- `intensity` miscela il risultato con l’immagine originale.
- `invert` inverte la mappatura.

### 9.3 Color adjust

```ts
type ColorAdjustParams = {
  saturation: number;
  brightness: number;
  contrast: number;
  hueShift: number;
};
```

### 9.4 Blur

```ts
type BlurParams = {
  radius: number;
  type: "gaussian" | "motion" | "radial";
  angle?: number;
};
```

---

## 10. Audio-reactive system

### 10.1 Obiettivo

L’audio non modifica direttamente il rendering. Produce invece un frame di analisi che può essere mappato su parametri di layer ed effetti.

```text
Audio source
  → Audio analysis
  → Normalized bands / features
  → Audio bindings
  → Parameter modulation
  → Rendering
```

### 10.2 Audio analysis frame

```ts
type AudioAnalysisFrame = {
  time: number;
  duration: number;
  isPlaying: boolean;
  rms: number;             // 0–1
  peak: number;            // 0–1
  bass: number;            // 0–1
  lowMid: number;          // 0–1
  mid: number;             // 0–1
  highMid: number;         // 0–1
  treble: number;          // 0–1
  spectrum: Float32Array;  // normalizzato
  beat: {
    detected: boolean;
    strength: number;      // 0–1
    bpm: number;
    phase: number;         // 0–1
    interval: number;      // secondi
  };
};
```

### 10.3 Bande consigliate

| Feature | Range indicativo | Uso tipico |
|---|---:|---|
| `bass` | `20–160 Hz` | Scale, glow, distorsione |
| `lowMid` | `160–500 Hz` | Colore, calore, blur |
| `mid` | `500–2000 Hz` | Movimento, morphing |
| `highMid` | `2–6 kHz` | Dettaglio, texture |
| `treble` | `6–16 kHz` | Particelle, flicker, noise |
| `rms` | Dinamica globale | Opacità, intensità generale |
| `beat.strength` | Transitori | Pulse, flash, zoom |
| `beat.phase` | Fase del beat | Animazioni cicliche |

### 10.4 Audio binding

```ts
type AudioBinding = {
  id: string;
  enabled: boolean;
  source: "track" | "microphone" | "system" | "custom";
  feature: AudioFeature;
  target: {
    layerId: string;
    effectId?: string;
    paramKey: string;
  };
  mapping: AudioMapping;
};

type AudioFeature =
  | "rms"
  | "peak"
  | "bass"
  | "lowMid"
  | "mid"
  | "highMid"
  | "treble"
  | "beat.strength"
  | "beat.phase"
  | "spectrum.average";

type AudioMapping = {
  mode: "absolute" | "additive" | "multiply" | "override";
  min: number;
  max: number;
  baseline: number;
  sensitivity: number;
  smoothing: number;
  attack: number;
  release: number;
  invert: boolean;
  quantizeSteps?: number;
};
```

### 10.5 Formula di modulazione

Per ogni binding:

```ts
raw = audioFrame[feature];

normalized = clamp((raw - min) / (max - min), 0, 1);

if (invert) normalized = 1 - normalized;

modulated = normalized * sensitivity;

smoothed = smooth(
  previousValue,
  modulated,
  attack,
  release
);

finalValue = applyMappingMode(
  baseline,
  smoothed,
  mapping.mode
);

finalValue = clamp(finalValue, paramMin, paramMax);
```

### 10.6 Mapping mode

| Mode | Formula | Uso |
|---|---|---|
| `absolute` | `min + smoothed * (max - min)` | Il parametro è interamente controllato dall’audio |
| `additive` | `baseline + smoothed * amount` | L’audio aggiunge movimento al valore base |
| `multiply` | `baseline * (1 + smoothed * amount)` | L’audio amplifica o riduce il valore base |
| `override` | `smoothed >= threshold ? overrideValue : baseline` | Attivazione a soglia |

### 10.7 Smoothing

Usa attack e release separati:

```ts
if (current > previous) {
  smoothed = previous + (current - previous) * attack;
} else {
  smoothed = previous + (current - previous) * release;
}
```

- `attack`: velocità di salita, consigliato `0.2–0.8`.
- `release`: velocità di discesa, consigliato `0.05–0.35`.
- `smoothing`: filtro aggiuntivo opzionale per ridurre jitter.

### 10.8 Beat detection

```ts
type BeatDetectorConfig = {
  sensitivity: number;
  minInterval: number;
  maxInterval: number;
  bpmRange: [number, number];
  resetAfterMs: number;
};
```

Logica:

1. Analizza energia bassa e transitori.
2. Confronta l’energia corrente con una media mobile.
3. Se supera la soglia, registra un beat.
4. Calcola intervallo tra beat.
5. Stima BPM.
6. Espone `beat.strength` e `beat.phase`.

Il BPM può essere:

- Rilevato automaticamente.
- Impostato manualmente.
- Preso dai metadata del file audio.

Nel progetto di esempio, la traccia `afrobeat.mp3` è associata a `115 BPM`. [1]

---

## 11. Configurazioni audio-reactive consigliate

### 11.1 Bass pulse

```json
{
  "feature": "bass",
  "target": {
    "layerId": "video-layer",
    "paramKey": "transform.scaleX"
  },
  "mapping": {
    "mode": "additive",
    "baseline": 1,
    "min": 0,
    "max": 1,
    "sensitivity": 0.18,
    "attack": 0.65,
    "release": 0.18,
    "smoothing": 0.25
  }
}
```

Risultato: il video pulsa leggermente sui bassi.

### 11.2 Re-light intensity

```json
{
  "feature": "rms",
  "target": {
    "layerId": "video-layer",
    "effectId": "relight-effect",
    "paramKey": "intensity"
  },
  "mapping": {
    "mode": "absolute",
    "min": 0.1,
    "max": 1.6,
    "sensitivity": 1,
    "attack": 0.5,
    "release": 0.22
  }
}
```

### 11.3 Thermal color shift

```json
{
  "feature": "mid",
  "target": {
    "layerId": "video-layer",
    "effectId": "thermal-effect",
    "paramKey": "intensity"
  },
  "mapping": {
    "mode": "additive",
    "baseline": 0.35,
    "min": 0,
    "max": 1,
    "sensitivity": 0.45,
    "attack": 0.4,
    "release": 0.25
  }
}
```

### 11.4 Beat flash

```json
{
  "feature": "beat.strength",
  "target": {
    "layerId": "text-layer",
    "paramKey": "appearance.brightness"
  },
  "mapping": {
    "mode": "additive",
    "baseline": 0,
    "min": 0,
    "max": 1,
    "sensitivity": 0.65,
    "attack": 0.85,
    "release": 0.12
  }
}
```

### 11.5 Treble particles

```json
{
  "feature": "treble",
  "target": {
    "layerId": "particle-layer",
    "paramKey": "emissionRate"
  },
  "mapping": {
    "mode": "absolute",
    "min": 0,
    "max": 250,
    "sensitivity": 1,
    "attack": 0.55,
    "release": 0.2
  }
}
```

---

## 12. Pipeline di rendering

```text
1. Load project state
2. Resolve sources
3. Sort layers by zIndex
4. For each enabled layer:
   a. Render source
   b. Apply transform
   c. Apply base appearance
   d. Apply effect stack in order
   e. Apply audio bindings
   f. Apply blend mode
   g. Composite into scene
5. Apply project-level post effects
6. Render preview / export frame
```

### Regole di ordine

- Gli effetti vengono applicati nell’ordine definito da `effect.order`.
- L’audio modulation avviene dopo gli effetti statici, ma può anche puntare a parametri di effetto.
- Il blend avviene dopo la modulazione.
- I layer `adjustment` si applicano ai layer sottostanti.
- I gruppi compositano prima i propri figli, poi si comportano come un unico layer.

---

## 13. Gestione delle sorgenti

### 13.1 Sorgenti supportate MVP

| Tipo | Input | Note |
|---|---|---|
| `video` | File, URL | Loop, mute, playback rate |
| `image` | File, URL | Statica |
| `text` | Testo | Font, dimensione, colore |
| `audio` | File | Analisi FFT, BPM |
| `solid` | Colore | Sfondo o layer base |
| `camera` | Dispositivo | Richiede permesso |

### 13.2 Stati sorgente

```ts
type SourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "error"
  | "missing";
```

### 13.3 Regole

- Una sorgente può essere riusata da più layer.
- La rimozione di una sorgente deve verificare che nessun layer la stia usando.
- Un video rimosso deve rilasciare memoria e decoder.
- Un audio rimosso deve interrompere analisi e binding.
- Se una sorgente è missing, il layer mostra placeholder ma resta configurabile.

---

## 14. Persistenza

### 14.1 Project state

Salva:

```json
{
  "project": {
    "id": "proj_123",
    "name": "Audio Visual 01",
    "schemaVersion": 1,
    "settings": {},
    "sources": [],
    "layers": [],
    "audio": {},
    "output": {}
  }
}
```

### 14.2 Asset

Gli asset pesanti non vanno inseriti nel JSON di progetto:

- Salva metadata e riferimento.
- Carica il file binario separatamente.
- Usa URL firmati, blob storage o file locale.
- Conserva checksum per rilevare file mancanti o modificati.

### 14.3 Migrazione

Ogni cambiamento di schema richiede:

```ts
type Migration = {
  from: number;
  to: number;
  migrate: (state: unknown) => unknown;
};
```

Il caricamento deve:

1. Leggere `schemaVersion`.
2. Applicare le migration in ordine.
3. Validare il risultato.
4. Normalizzare parametri mancanti.
5. Caricare il progetto.

---

## 15. Undo / redo

Usa command pattern:

```ts
type Command = {
  id: string;
  type: string;
  payload: unknown;
  apply: (state: ProjectState) => ProjectState;
  revert: (state: ProjectState) => ProjectState;
};
```

Esempi:

- `ADD_LAYER`
- `REMOVE_LAYER`
- `UPDATE_LAYER_TRANSFORM`
- `ADD_EFFECT`
- `UPDATE_EFFECT_PARAM`
- `ADD_AUDIO_BINDING`
- `UPDATE_AUDIO_BINDING`
- `REORDER_LAYERS`

Le modifiche continue, come slider drag, devono essere debounced o raggruppate in una sola command al rilascio.

---

## 16. Validazione e error handling

### 16.1 Validazione

Ogni entità deve essere validata prima del rendering.

```ts
validateProject(project);
validateLayer(layer);
validateEffect(effect);
validateAudioBinding(binding);
```

### 16.2 Errori

| Errore | Comportamento |
|---|---|
| Asset missing | Placeholder + warning |
| Effetto non registrato | Layer renderizzato senza effetto + warning |
| Parametro invalido | Fallback al default |
| Binding circolare | Binding disabilitato + errore |
| Audio non disponibile | Rendering statico |
| Export fallito | Toast + retry |
| Stato corrotto | Migration o reset sicuro |

### 16.3 Regola critica

Nessun errore periferico può interrompere il loop di rendering.

```ts
try {
  output = effect.render(input);
} catch (error) {
  reportError(error);
  output = input;
}
```

---

## 17. Interfacce per estensioni future

### 17.1 Nuova sorgente

```ts
interface SourceAdapter {
  kind: string;
  canHandle(asset: SourceAsset): boolean;
  load(asset: SourceAsset): Promise<SourceRuntime>;
  dispose(runtime: SourceRuntime): void;
}
```

### 17.2 Nuovo effetto

```ts
interface EffectPlugin {
  definition: EffectDefinition;
  register(registry: EffectRegistry): void;
}
```

### 17.3 Nuovo modulatore audio

```ts
interface AudioModulator {
  id: string;
  analyze(frame: AudioAnalysisFrame): number;
}
```

### 17.4 Nuovo output

```ts
interface OutputAdapter {
  format: string;
  export(project: Project, frames: AsyncIterable<RenderedFrame>): Promise<ExportResult>;
}
```

---

## 18. Roadmap post-MVP

| Fase | Funzionalità | Dipendenza |
|---|---|---|
| 2 | Timeline, keyframe, animazioni | Project state + command system |
| 3 | Gruppi e precompose | Layer tree + compositor |
| 4 | Mask, matte, tracking | Render pipeline |
| 5 | Microfono e input live | Audio analysis |
| 6 | Preset e template | Effect registry |
| 7 | Collaborazione | CRDT o Operational Transform |
| 8 | Plugin SDK | Registry + sandbox |
| 9 | Export avanzato | Output adapters |
| 10 | AI assist | Source/effect adapters |

---

## 19. Regole non negoziabili

1. Lo stato è serializzabile.
2. Ogni layer è indipendente ma componibile.
3. Ogni effetto dichiara i propri parametri.
4. L’audio modula parametri, non direttamente pixel.
5. Ogni binding ha mapping, range, smoothing e fallback.
6. Gli effetti sono ordinabili e rimovibili.
7. I blend mode sono espliciti.
8. Gli asset sono separati dal project JSON.
9. Ogni errore è isolato.
10. Ogni nuova funzione si aggiunge tramite adapter o registry.