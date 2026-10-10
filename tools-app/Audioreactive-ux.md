# Sound Bar & Audio Reactive UX

## 1. Obiettivo

La **Sound Bar** è il controllo permanente in basso all’editor. Gestisce la sorgente audio, il playback e l’accesso alla sezione **Audio Reactive**.

La sezione **Audio Reactive** consente di collegare l’analisi dell’audio ai parametri del visual: scala, opacità, colore, intensità effetti, blur, distorsione, particelle e altro.

Il principio UX è:

```text
Ascolta → Osserva → Collega → Regola → Anteprima → Salva
```

L’utente non deve configurare un sistema tecnico astratto: deve creare una relazione percepibile tra suono e immagine.

---

## 2. Sound Bar — posizionamento e ruolo

### 2.1 Posizione

La Sound Bar è fissa nella parte bassa dell’editor.

```text
┌──────────────────────────────────────────────────────────────┐
│ Canvas / Stage                                               │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ SOUND BAR                                                    │
│ [▶] [waveform] afrobeat.mp3 · 115 BPM · [Audio Reactive]     │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Ruolo

La Sound Bar risponde sempre a tre domande:

1. **Quale audio è attivo?**
2. **Sta suonando?**
3. **Sta influenzando il visual?**

### 2.3 Regole di visibilità

| Stato | Sound Bar |
|---|---|
| Nessun audio | Mostra CTA “Add audio” |
| Audio caricato | Mostra nome, waveform e controlli |
| Audio in play | Mostra progresso e analisi live |
| Audio in pausa | Mantiene waveform e binding |
| Audio mancante | Mostra warning e azione “Relink” |
| Audio reactive attivo | Mostra badge e pannello dedicato |

---

## 3. Sound Bar — struttura

### 3.1 Layout consigliato

```text
[Play/Pause] [Track info + waveform] [BPM] [Volume] [Audio Reactive] [More]
```

### 3.2 Zone funzionali

| Zona | Contenuto | Funzione |
|---|---|---|
| **Transport** | Play, pause, restart | Controllo playback |
| **Track identity** | Nome file, durata, sorgente | Conferma cosa sta suonando |
| **Waveform** | Waveform + playhead | Orientamento temporale |
| **Tempo** | BPM, beat indicator | Base per sincronizzazione |
| **Volume** | Slider o icona + popover | Controllo ascolto |
| **Audio Reactive** | Bottone/badge | Accesso alla sezione di modulazione |
| **More** | Menu secondario | Sostituzione, rimozione, analisi, impostazioni |

### 3.3 Stato vuoto

```text
[+] Add audio

Add a track to create audio-reactive visuals.
```

Azioni:

- Upload file
- Scegli da library
- Registra microfono
- Usa sorgente di sistema

### 3.4 Stato caricamento

```text
[spinner] Analyzing afrobeat.mp3…
```

Mostra:

- Nome file
- Progresso
- Azione “Cancel”

### 3.5 Stato errore

```text
⚠ afrobeat.mp3 unavailable

The audio file could not be loaded.

[Relink file] [Remove] [Continue without audio]
```

---

## 4. Sound Bar — componenti

### 4.1 Play / Pause

- Icona chiara e grande.
- Almeno 32–36px.
- Tooltip: “Play” / “Pause”.
- Scorciatoia: `Space`.
- Stato disabled se la sorgente non è pronta.

### 4.2 Track info

```text
afrobeat.mp3
03:12 · Local file
```

Informazioni:

- Nome traccia
- Durata
- Origine: file, URL, microfono, library
- Stato: ready, loading, error, missing

### 4.3 Waveform

La waveform ha tre funzioni:

1. Mostrare la struttura del brano.
2. Indicare la posizione corrente.
3. Visualizzare l’energia o le sezioni ad alta intensità.

```text
[waveform]
      ▁▂▄▆█▇▅▃▂▁▁▂▄▆█
[playhead]
```

Interazioni:

- Click: seek
- Drag: scrubbing
- Hover: tooltip tempo
- Zoom: opzionale in modalità avanzata

### 4.4 BPM

```text
115 BPM
```

Comportamento:

- Se rilevato: mostra “Detected”.
- Se manuale: mostra campo editabile.
- Se assente: mostra “Set BPM”.

Il BPM serve per:

- Sincronizzare animazioni cicliche.
- Quantizzare effetti sul beat.
- Creare transizioni regolari.
- Pilotare pulse, flash e movement.

### 4.5 Beat indicator

Piccolo indicatore pulsante:

```text
● ● ● ●
1   2   3   4
```

Funzioni:

- Conferma che il beat detection è attivo.
- Mostra il tempo musicale.
- Aiuta l’utente a capire perché un effetto pulsa.

### 4.6 Volume

Il volume controlla solo l’ascolto, non l’analisi.

```text
Volume
[────●────] 70%
[Mute]
```

Regola importante:

> Il volume non deve modificare l’intensità dell’audio-reactivity.

Se l’utente abbassa il volume, i visual devono continuare a reagire alla traccia originale.

### 4.7 Audio Reactive button

Stati:

| Stato | Etichetta | Colore |
|---|---|---|
| Off | “Audio Reactive” | Neutro |
| On | “Audio Reactive · 3” | Accento |
| Warning | “Audio Reactive · 1 issue” | Giallo |
| Disabled | “Audio Reactive” | Disabilitato |

Il numero indica quanti binding sono attivi.

---

## 5. Pannello Audio Reactive

### 5.1 Accesso

Il pannello si apre:

- Dal bottone **Audio Reactive** nella Sound Bar.
- Selezionando un layer e aprendo la tab **Audio**.
- Cliccando un badge di modulazione su un parametro.

### 5.2 Layout

```text
┌────────────────────────────────────────────┐
│ Audio Reactive                        [X]  │
├────────────────────────────────────────────┤
│ [Presets] [Bindings] [Analyzer]            │
├────────────────────────────────────────────┤
│ Active preset                              │
│ Bass Pulse                                 │
│                                            │
│ Affects:                                   │
│ · Video scale                              │
│ · Re-light intensity                       │
│                                            │
│ [Customize] [Disable] [Remove]             │
├────────────────────────────────────────────┤
│ + Add audio modulation                     │
└────────────────────────────────────────────┘
```

### 5.3 Tab

| Tab | Funzione |
|---|---|
| **Presets** | Applica configurazioni pronte |
| **Bindings** | Crea e modifica collegamenti audio → parametro |
| **Analyzer** | Osserva bass, mid, high, RMS e beat |

---

## 6. Preset Audio Reactive

### 6.1 Funzione dei preset

Un preset non è un effetto: è una **ricetta di modulazione**.

```text
Preset = insieme di audio bindings + range + smoothing + target
```

Esempio:

```text
Bass Pulse
├── Bass → Video scale
├── Bass → Re-light intensity
└── Beat → Text brightness
```

### 6.2 Preset MVP

| Preset | Feature audio | Parametri modificati | Risultato |
|---|---|---|---|
| **Bass Pulse** | Bass, beat | Scale, brightness, glow | Il visual pulsa sui bassi |
| **Energy Glow** | RMS | Brightness, blur, saturation | L’immagine si accende con l’energia |
| **Beat Flash** | Beat strength | Opacity, exposure, scale | Flash breve sul beat |
| **Color Drive** | Mid, high | Hue shift, saturation, thermal intensity | Il colore cambia con la musica |
| **Motion React** | Bass, mid | Position, rotation, distortion | Il visual si muove e si deforma |
| **Detail React** | Treble | Particle emission, noise, sharpness | I dettagli reagiscono agli alti |

### 6.3 Struttura preset

```ts
type AudioReactivePreset = {
  id: string;
  name: string;
  description: string;
  category: "pulse" | "color" | "motion" | "texture" | "structure";
  requires: {
    layerTypes: LayerType[];
    effects?: string[];
  };
  bindings: AudioBindingTemplate[];
  defaultIntensity: number;
};
```

### 6.4 Comportamento all’applicazione

```text
User clicks preset
  → Show preview of affected parameters
  → Check compatible layers
  → Check missing effects
  → Create bindings
  → Apply safe default intensity
  → Start live preview
  → Show “Customize” CTA
```

### 6.5 UI di applicazione

```text
Apply “Bass Pulse”?

This will modulate:
· Video Layer — Scale
· Re-light — Intensity
· Text Layer — Brightness

No existing settings will be deleted.

[Apply] [Preview] [Cancel]
```

---

## 7. Filosofia UX delle alterazioni real time

### 7.1 Problema utente

L’utente pensa:

> “Voglio che il video pulsi con il basso.”

Non pensa:

> “Voglio creare un binding da bass a transform.scaleX con attack 0.6 e release 0.2.”

### 7.2 Soluzione

L’interfaccia deve tradurre intenti creativi in configurazioni tecniche.

```text
User language          System language
─────────────          ──────────────
“Pulse with bass”  →   Bass → Scale
“Glow with energy” →   RMS → Brightness
“Flash on beat”    →   Beat → Opacity
“Change color”     →   Mid → Hue shift
“Shake on drop”    →   Bass → Position noise
```

### 7.3 Principi

1. **Prima il risultato, poi il controllo tecnico.**
2. **Ogni modifica deve essere visibile immediatamente.**
3. **Ogni parametro modulato deve dichiarare la propria origine.**
4. **L’utente deve poter tornare al valore base.**
5. **L’intensità è il controllo principale.**
6. **I parametri avanzati restano disponibili ma non invadenti.**

---

## 8. Flusso UX: creare un’alterazione

### 8.1 Flusso consigliato

```text
1. Seleziona layer o effetto
2. Apri Audio Reactive
3. Scegli un preset
4. Vedi anteprima live
5. Regola intensità
6. Personalizza il mapping
7. Salva o rimuovi
```

### 8.2 Esempio: “Voglio che il video pulsi”

```text
1. Utente seleziona Video Layer
2. Apre Audio Reactive
3. Sceglie “Bass Pulse”
4. Il video inizia a pulsare
5. Regola “Pulse amount”
6. Apre advanced settings
7. Cambia sorgente da Bass a Beat
8. Salva
```

### 8.3 UI passo-passo

```text
Step 1 — Choose what should react
[Video Layer] [Text Layer] [Effect]

Step 2 — Choose audio driver
[Bass] [Mid] [High] [Energy] [Beat]

Step 3 — Choose visual response
[Scale] [Brightness] [Color] [Blur] [Distort]

Step 4 — Adjust intensity
Pulse amount [────●──] 45%

Step 5 — Preview
Audio is modulating Video Scale.
```

---

## 9. Parametri modificabili

### 9.1 Trasformazione

| Parametro | Reazione tipica | Range consigliato |
|---|---|---:|
| `scale` | Pulse sui bassi | `-0.3 a +0.5` |
| `positionX/Y` | Shake o drift | `-50 a +50 px` |
| `rotation` | Swing o wobble | `-15 a +15°` |
| `opacity` | Flash o fade | `0 a 1` |
| `blur` | Soft pulse | `0 a 40 px` |

### 9.2 Appearance

| Parametro | Reazione tipica | Range consigliato |
|---|---|---:|
| `brightness` | Glow con energia | `-0.5 a +1` |
| `saturation` | Colori più vividi | `-1 a +1` |
| `contrast` | Impatto sul beat | `-0.5 a +1` |
| `hueShift` | Cambio colore | `-90 a +90°` |
| `grain` | Texture sugli alti | `0 a 1` |

### 9.3 Effetti

| Effetto | Parametro | Reazione |
|---|---|---|
| Re-light | `intensity` | Luce che pulsa |
| Re-light | `radius` | Luce che si espande |
| Thermal | `intensity` | Colore che si scalda |
| Thermal | `thresholdHigh` | Aree calde che si espandono |
| Blur | `radius` | Sfocatura dinamica |
| Distort | `amount` | Deformazione sul basso |
| Particles | `emissionRate` | Emissione sugli alti |

### 9.4 Parametri non consigliati

Non modulare direttamente:

- `blendMode`
- `fontFamily`
- `sourceId`
- `layerType`
- `effectType`

Questi sono parametri strutturali o discreti. Se necessario, usare trigger o step mapping.

---

## 10. Struttura di un Audio Binding

### 10.1 Modello semplice

```text
[Audio feature] → [Visual parameter]
```

Esempio:

```text
Bass → Scale
```

### 10.2 Modello completo

```text
Audio source
  → Feature
  → Range
  → Sensitivity
  → Smoothing
  → Mapping mode
  → Target parameter
  → Min / Max
  → Blend with base value
```

### 10.3 UI progressiva

Mostrare solo il necessario:

```text
Basic
├── Audio driver: Bass
├── Visual parameter: Scale
└── Amount: 45%

Advanced
├── Mapping: Additive
├── Min: 0
├── Max: 1
├── Sensitivity: 1.0
├── Attack: 0.65
├── Release: 0.20
└── Invert: Off
```

---

## 11. Controlli principali

### 11.1 Amount

È il controllo più importante.

```text
Pulse amount
[────●────────] 45%
```

Funzione:

- Controlla quanto l’audio influisce sul parametro.
- `0%` = nessuna alterazione.
- `100%` = massima alterazione nel range scelto.

### 11.2 Sensitivity

```text
Sensitivity
[──────●────] 1.2x
```

Funzione:

- Amplifica o riduce la risposta dell’audio.
- Utile se la traccia è troppo piatta o troppo intensa.

### 11.3 Smoothing

```text
Smoothing
[────●──────] Medium
```

Funzione:

- Riduce jitter e movimenti nervosi.
- Valori bassi = reazione istantanea.
- Valori alti = movimento morbido.

### 11.4 Attack / Release

```text
Attack  [██░░░░░░] Fast
Release [░░░░████] Slow
```

Funzione:

- **Attack**: velocità di salita.
- **Release**: velocità di discesa.
- Attack rapido + release lento = pulse percettibile.
- Attack lento + release lento = respiro continuo.

### 11.5 Range

```text
Scale range
Min: 1.00x
Max: 1.35x
```

Funzione:

- Definisce i limiti fisici dell’alterazione.
- Evita che il layer diventi invisibile o esca dal canvas.

### 11.6 Invert

```text
Invert response [ ]
```

Funzione:

- Inverte la relazione.
- Esempio: invece di aumentare la luce sul basso, la riduce.

---

## 12. Modalità di mapping

### 12.1 Additive

```text
Final = Base + Audio contribution
```

Uso:

- Movimento
- Glow
- Distorsione
- Particles

### 12.2 Absolute

```text
Final = Min + Audio * (Max - Min)
```

Uso:

- Scala
- Opacità
- Intensità effetto

### 12.3 Multiply

```text
Final = Base * (1 + Audio contribution)
```

Uso:

- Scale
- Saturation
- Brightness

### 12.4 Trigger

```text
Audio > threshold → activate
Audio < threshold → deactivate
```

Uso:

- Flash
- Toggle visibilità
- Transizione
- Effetto momentaneo

### 12.5 UI

```text
Mapping
( ) Absolute
(- ) Additive
( ) Multiply
( ) Trigger
```

Per l’MVP, consigliare **Additive** come default.

---

## 13. Real-time feedback

### 13.1 Regola fondamentale

L’utente deve sempre capire:

```text
Cosa sta ascoltando l’app
Cosa sta modulando
Quanto sta modulando
Dove può intervenire
```

### 13.2 Indicatore sul parametro

```text
Scale
[────●────] 1.18x
● Audio · Bass
```

Il punto colorato indica che il valore è modulato.

### 13.3 Indicatore sul layer

```text
Video Layer 01      [♪ 2]
```

Il badge indica due binding audio attivi.

### 13.4 Indicatore sulla Sound Bar

```text
[♪] Audio Reactive · 3
```

### 13.5 Live meter

```text
Bass  [██████░░░░] 62%
Mid   [████░░░░░░] 38%
High  [██░░░░░░░░] 21%
Beat  ●
```

Il live meter aiuta l’utente a scegliere la feature giusta.

---

## 14. Interazioni consigliate

### 14.1 Drag dal meter al parametro

```text
Bass meter ──drag──→ Scale slider
```

Al rilascio:

```text
Create modulation?
Bass → Scale

[Create] [Cancel]
```

### 14.2 Click su parametro modulato

Apre il binding:

```text
Scale is modulated by Bass.

Amount: 45%
[Edit] [Mute] [Remove]
```

### 14.3 Hover sul badge audio

```text
2 active modulations
· Bass → Scale
· RMS → Re-light intensity
```

### 14.4 Right-click sul layer

```text
Add audio modulation
├── Pulse with bass
├── Glow with energy
├── Flash on beat
└── Custom…
```

---

## 15. Stati del binding

| Stato | Significato | UI |
|---|---|---|
| `active` | Sta modulando | Badge accento |
| `paused` | Configurato ma non attivo | Badge neutro |
| `muted` | Temporaneamente disattivato | Icona mute |
| `orphan` | Target non esiste | Warning |
| `invalid` | Parametro non compatibile | Errore |
| `conflict` | Conflitto con altri binding | Badge giallo |
| `missing-source` | Audio non disponibile | Warning |

---

## 16. Gestione dei conflitti

### 16.1 Problema

Due binding modificano lo stesso parametro:

```text
Bass → Scale
Beat → Scale
```

### 16.2 Soluzione default

Usa **additive combination**:

```text
Final scale = Base scale + Bass contribution + Beat contribution
```

Poi clamp:

```ts
finalValue = clamp(finalValue, paramMin, paramMax);
```

### 16.3 UI

```text
Scale is affected by 2 audio sources.

Combined mode: Additive

Bass contribution: +0.18x
Beat contribution: +0.08x

[Review] [Change mode] [Mute one]
```

### 16.4 Strategie

| Strategia | Uso |
|---|---|
| `additive` | Default, somma contributi |
| `average` | Movimento più stabile |
| `max` | Solo la sorgente più intensa |
| `first-wins` | Priorità al primo binding |
| `last-wins` | Priorità all’ultimo binding |
| `multiply` | Amplificazione composta |

---

## 17. Onboarding Audio Reactive

### 17.1 Primo accesso

```text
Make your visual react to music

Choose a preset to start:

[Bass Pulse] [Energy Glow] [Beat Flash]

You can customize every connection later.
```

### 17.2 Dopo aver applicato un preset

```text
Bass Pulse is active.

Your video now reacts to low frequencies.

[Adjust intensity] [Change audio driver] [Open advanced]
```

### 17.3 Se nessun layer è selezionato

```text
Select a layer to create an audio modulation.

Or apply a preset to the whole scene.
```

### 17.4 Se l’audio è in pausa

```text
Audio is paused.

Bindings are saved but not modulating.

[Play audio] [Configure anyway]
```

---

## 18. Regole di design della sezione

- La Sound Bar è sempre visibile ma discreta.
- Il pannello Audio Reactive non copre il canvas.
- Ogni preset mostra subito cosa modifica.
- Ogni binding ha un nome leggibile.
- Ogni parametro modulato mostra il valore effettivo.
- Ogni alterazione è reversibile.
- L’intensità è il primo controllo.
- I controlli avanzati sono progressivi.
- Le modifiche sono visibili in tempo reale.
- L’utente può sempre tornare al valore base.

---

## 19. Flusso tecnico consigliato

```text
Audio file loaded
  → Decode audio
  → Create AnalyserNode
  → Compute FFT
  → Extract bands
  → Detect beats
  → Normalize values
  → Build AudioAnalysisFrame
  → Resolve bindings
  → Apply mapping
  → Update target parameters
  → Invalidate affected layers
  → Render frame
```

### 19.1 Ordine per frame

```text
1. Read audio frame
2. Update meters
3. Resolve active bindings
4. Apply smoothing
5. Compute effective parameter values
6. Update layer/effect params
7. Render scene
8. Update UI indicators
```

---

## 20. Regole non negoziabili

1. Il volume non modifica l’audio-reactivity.
2. Ogni binding ha un target esplicito.
3. Ogni parametro modulato mostra base value ed effective value.
4. Ogni preset dichiara cosa modifica.
5. Ogni preset è personalizzabile.
6. Ogni binding è disattivabile senza eliminarlo.
7. Ogni conflitto è visibile e risolvibile.
8. Ogni errore audio non blocca il rendering.
9. L’analisi audio è separata dalla pipeline visiva.
10. L’utente vede sempre la relazione causa-effetto: **suono → parametro → visual**.