# SOUNDBAR.md — Sound Bar & Audio Reactive Reference

## 1. Obiettivo

La Sound Bar è la barra permanente in basso all’editor. Deve consentire all’utente di:

1. Capire quale traccia è caricata.
2. Controllare playback e volume.
3. Osservare waveform, BPM e beat.
4. Aprire la sezione **Audio Reactive**.
5. Applicare e personalizzare preset.
6. Collegare l’audio ai parametri del visual.
7. Vedere in tempo reale cosa sta modulando.

La Sound Bar non è solo un player: è il **control center della relazione audio → visual**.

---

## 2. Posizionamento

La Sound Bar è fissa in basso, full-width, sotto il canvas.

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar                                                      │
├───────────────┬──────────────────────────────┬───────────────┤
│ Sidebar       │ Canvas                       │ Inspector     │
│               │                              │               │
├───────────────┴──────────────────────────────┴───────────────┤
│ SOUND BAR                                                    │
│ [▶] [waveform] Track · 115 BPM · [♪ Audio Reactive · 3]      │
└──────────────────────────────────────────────────────────────┘
```

### Regole (two-tier live spec — COMPONENT.md §2, nodi `ielwf`/`TCY8O` di SketchTools.pen)

- Altezza a riposo: `101px` (tips `44px` + main bar `57px`).
- Altezza espansa: `249px` (aggiunge il PanelSlot `148px`).
- Larghezza: `100%`.
- Posizione: ultima riga della grid shell, sotto il canvas.
- Non deve coprire il canvas.
- Deve restare visibile durante editing, preview e playback.
- Su schermi stretti (<1024px) il gruppo sorgente entra nel menu Audio options; waveform e meta si comprimono.

---

## 3. Struttura della Sound Bar

### 3.1 Layout desktop

```text
TIPS:  Tips & tricks ................................ [ⓘ Support]
MAIN:  [♪ Audio Reactive] [⋯]   [■] [▶] [track ▾] [BPM] [🎤] [Tap] [Loop]   [MIDI] [🔊] [⌃]
SLOT:  ┈┈ h0 — click ⌃ to expand waveform, timeline, presets, meters ┈┈
```

### 3.2 Zone

| Livello | Elementi | Funzione |
|---|---|---|
| Tips `h-11` (44px) | "Tips & tricks" + Support `100×36` | Onboarding e help, fuori dal bar di trasporto |
| Main LEFT | Audio Reactive `130–180px`, Audio options `32px` | Accesso ai preset e binding; overflow |
| Main CENTER | Stop `36×36`, Play/Pause `36×36`, source pill `150px`, BPM `72–96px`, Mic, Tap tempo, Loop | Transport e identità traccia, centrati |
| Main RIGHT | MIDI `77×36`, Volume `32px`, Expand/Collapse `28×28` | Ingressi e apertura del PanelSlot |
| PanelSlot (`h-0` → `h-[148px]`) | Waveform canvas, Timeline, Volume slider, Preset rail, 4 meters (B/M/T/L) | Dettaglio audio-reattivo, su richiesta |

### 3.3 Layout mobile / stretto

```text
[▶] [waveform] [♪] [more]
```

Il nome traccia, BPM e volume entrano in un popover o drawer.

---

## 4. Stati della Sound Bar

| Stato | Contenuto |
|---|---|
| Empty | CTA “Add audio” |
| Loading | Spinner + “Analyzing track…” |
| Ready | Nome, waveform, BPM, controlli |
| Playing | Playhead animato, meter live |
| Paused | Waveform statica, binding salvati |
| Missing | Warning + “Relink file” |
| Error | Messaggio + retry |
| Reactive active | Badge con numero binding |

---

## 5. Componenti della Sound Bar

### 5.1 Play / Pause

```text
[▶] / [❚❚]
```

- Dimensione: `36 × 36px`
- Raggio: `8px`
- Icona: `20px`
- Stato disabled se audio non pronto
- Tooltip: “Play” / “Pause”
- Shortcut: `Space`

```css
--soundbar-play-size: 36px;
--soundbar-play-bg: rgba(184, 217, 74, 0.14);
--soundbar-play-border: rgba(184, 217, 74, 0.38);
--soundbar-play-icon: #A78BFA;
--soundbar-play-hover-bg: rgba(184, 217, 74, 0.22);
```

### 5.2 Track info

```text
afrobeat.mp3
03:12 · Local file
```

- Nome: `13px`, `500`, `var(--foreground)`
- Meta: `11px`, `400`, `var(--text-muted)` (token corretto ad AA nel redesign)
- Massimo una riga, ellipsis se troppo lungo
- Click: apre dettagli traccia

```css
--soundbar-track-name-size: 13px;
--soundbar-track-name-weight: 500;
--soundbar-track-name-color: #f8f8f5;
--soundbar-track-meta-size: 11px;
--soundbar-track-meta-color: #71717A;
```

### 5.3 Waveform

La waveform occupa lo spazio centrale.

```text
▁▂▄▆█▇▅▃▂▁▁▂▄▆█▇▅▃▂▁
        ▲
     playhead
```

Funzioni:

- Mostra la struttura del brano.
- Indica la posizione di riproduzione.
- Permette seek tramite click.
- Permette scrubbing tramite drag.
- Può evidenziare energia o sezioni intense.

```css
--soundbar-waveform-height: 28px;
--soundbar-waveform-bg: #1F1F26;
--soundbar-waveform-radius: 6px;
--soundbar-waveform-bar-color: rgba(184, 217, 74, 0.45);
--soundbar-waveform-played-color: #A78BFA;
--soundbar-waveform-playhead-color: #f8f8f5;
--soundbar-waveform-playhead-width: 2px;
```

### 5.4 BPM

```text
115 BPM
```

- Font mono.
- Valore allineato a destra.
- Se rilevato automaticamente: badge “Auto”.
- Se manuale: input modificabile.
- Se assente: CTA “Set BPM”.

```css
--soundbar-bpm-width: 84px;
--soundbar-bpm-font: var(--font-mono);
--soundbar-bpm-size: 12px;
--soundbar-bpm-color: #f8f8f5;
--soundbar-bpm-badge-color: #A78BFA;
```

### 5.5 Beat indicator

```text
● ● ● ●
1 2 3 4
```

- Quattro punti o tacche.
- Il beat corrente è più luminoso.
- Serve a far capire all’utente perché un visual pulsa.
- Implementazione attuale: fase approssimata da `timeSec * bpm / 60` (nessun beat detector nel motore — vedi §17).

```css
--soundbar-beat-size: 6px;
--soundbar-beat-color: rgba(184, 217, 74, 0.35);
--soundbar-beat-active-color: #A78BFA;
--soundbar-beat-gap: 6px;
```

### 5.6 Volume

```text
[🔊] ────●──── 70%
```

- Icona + slider compatto.
- Popover su click dell’icona.
- Non influisce sull’analisi audio.
- Mute non disattiva i binding.

```css
--soundbar-volume-width: 96px;
--soundbar-volume-track-height: 4px;
--soundbar-volume-track-bg: #2A2A33;
--soundbar-volume-fill: #A78BFA;
--soundbar-volume-handle-size: 12px;
```

### 5.7 Audio Reactive button

```text
[♪ Audio Reactive · 3]
```

Stati:

| Stato | Etichetta | Stile |
|---|---|---|
| Off | `Audio Reactive` | Neutro |
| Active | `Audio Reactive · 3` | Viola |
| Warning | `Audio Reactive · 1 issue` | Giallo |
| Disabled | `Audio Reactive` | Opacità ridotta |

```css
--soundbar-reactive-height: 32px;
--soundbar-reactive-padding-x: 12px;
--soundbar-reactive-radius: 8px;
--soundbar-reactive-bg: rgba(184, 217, 74, 0.14);
--soundbar-reactive-border: rgba(184, 217, 74, 0.38);
--soundbar-reactive-text: #A78BFA;
--soundbar-reactive-hover-bg: rgba(184, 217, 74, 0.22);
```

### 5.8 More menu

```text
[⋯]
```

Menu:

- Replace audio
- Remove audio
- Reanalyze BPM
- Audio settings
- Export audio analysis
- Open Audio Reactive

---

## 6. Pannello Audio Reactive

### 6.1 Accesso

Il pannello si apre dal bottone **Audio Reactive**.

```text
┌────────────────────────────────────────────┐
│ Audio Reactive                        [X]  │
├────────────────────────────────────────────┤
│ [Presets] [Bindings] [Analyzer]            │
├────────────────────────────────────────────┤
│ Preset attivo: Bass Pulse                  │
│                                            │
│ Modula:                                    │
│ · Video scale                              │
│ · Re-light intensity                       │
│                                            │
│ [Customize] [Disable] [Remove]             │
├────────────────────────────────────────────┤
│ + Add audio modulation                     │
└────────────────────────────────────────────┘
```

### 6.2 Posizionamento

- Pannello flottante sopra la Sound Bar.
- Larghezza: `320–380px`.
- Altezza massima: `70vh`.
- Non copre il layer selezionato.
- Chiudibile con `Esc`, click fuori o `X`.

### 6.3 Token

```css
--audio-panel-width: 360px;
--audio-panel-max-height: 70vh;
--audio-panel-bg: rgba(22, 22, 26, 0.96);
--audio-panel-border: rgba(255, 255, 255, 0.12);
--audio-panel-radius: 14px;
--audio-panel-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
--audio-panel-padding: 16px;
```

---

## 7. Tab Presets

### 7.1 Funzione

La tab **Presets** contiene configurazioni pronte che collegano l’audio a uno o più parametri visual.

Un preset non è un effetto: è una **ricetta di modulazione**.

```text
Preset = audio feature → target parameter → amount → smoothing
```

### 7.2 Layout

```text
Presets
├── Search
├── Categories
├── Preset cards
└── Active preset summary
```

```text
[Search presets…]

[Pulse] [Color] [Motion] [Texture]

┌────────────────────────────────────┐
│ ♪ Bass Pulse                       │
│ Makes visuals pulse with low end.  │
│                                    │
│ Affects: Scale, Re-light           │
│ [Apply] [Preview]                  │
└────────────────────────────────────┘
```

### 7.3 Preset card

```css
--preset-card-bg: rgba(184, 217, 74, 0.08);
--preset-card-border: rgba(184, 217, 74, 0.24);
--preset-card-radius: 12px;
--preset-card-padding: 14px;
--preset-card-title-size: 13px;
--preset-card-title-weight: 600;
--preset-card-description-size: 12px;
--preset-card-description-color: #a8ac9d;
--preset-card-hover-bg: rgba(184, 217, 74, 0.16);
```

### 7.4 Categorie

| Categoria | Scopo |
|---|---|
| `Pulse` | Scale, brightness, flash |
| `Color` | Hue, saturation, thermal |
| `Motion` | Position, rotation, distortion |
| `Texture` | Grain, noise, particles |

(La categoria `Structure` è rimossa: non esiste nel codice e nessun controllo la supporta.)

### 7.5 Preset MVP

| Preset | Driver | Target | Effetto |
|---|---|---|---|
| **Bass Pulse** | Bass | Scale, Re-light intensity | Il visual pulsa sui bassi |
| **Energy Glow** | RMS | Brightness, saturation, blur | L’immagine si accende con l’energia |
| **Beat Flash** | Beat | Opacity, brightness, scale | Flash breve sul beat |
| **Color Drive** | Mid / High | Hue shift, saturation, Thermal | Il colore evolve con la musica |
| **Motion React** | Bass / Mid | Position, rotation, distortion | Movimento e deformazione |
| **Detail React** | Treble | Grain, particles, sharpness | Dettaglio reattivo agli alti |

---

## 8. Come funziona un Preset (contratto reale: `AudioBinding = { param, source, curve, amount }`)

Un preset crea binding reali sul layer selezionato. Per i target effetto usa la chiave
`"${effectUid}.${param}"`; se l'effetto manca viene aggiunto prima del binding.
Effetti reali: `adjustments, aberration, waves, glow, edgeblur, lens, grain`.
Non esistono `relight`, `thermal`, `transform.scale`, `beat`, né il pulsante Preview (tagliato: indefinito).

### 8.1 Struttura

```ts
type AudioPreset = {
  id: string;
  name: string;
  description: string;
  category: "pulse" | "color" | "motion" | "texture";
  bindings: AudioBindingTemplate[];
  defaultAmount: number;
  requires?: string[];
};
```

### 8.2 Esempio: Bass Pulse (entità reali)

```json
{
  "id": "preset_bass_pulse",
  "name": "Bass Pulse",
  "description": "Makes glow breathe with low frequencies.",
  "category": "pulse",
  "bindings": [
    { "effectType": "glow", "param": "intensity", "source": "bass", "amount": 0.5 }
  ]
}
```

Il catalogo completo vive in `src/audio/presets.ts` (6 ricette, solo param reali).

### 8.3 Applicazione (vecchia numerazione conservata)

```text
User clicks Apply
  → Show affected parameters
  → Check compatible layer
  → Check missing effects
  → Create bindings
  → Set default amount
  → Start live preview
  → Show “Customize”
```

### 8.4 UI di conferma

```text
Apply “Bass Pulse”?

This will modulate:
· Selected layer — Glow intensity (effect added if missing)

No existing settings will be removed.

[Apply] [Cancel]
```

(Il pulsante Preview è tagliato: comportamento tecnicamente indefinito.)

---

## 9. Personalizzazione preset

### 9.1 Dopo l’applicazione

```text
Bass Pulse is active

Amount [────●────] 45%

Affects
· Video scale
· Re-light intensity

[Customize] [Disable] [Remove]
```

### 9.2 Customize (contratto reale: solo Amount + driver + Remove)

```text
Bass Pulse — Customize

Amount
[────●────] 50%

Driver: Bass (cambiabile per-binding)

[Remove]
```

Sensitivity/Attack/Release/Smoothing/Mapping avanzati non esistono nel contratto
`AudioBinding` reale e sono post-MVP.

### 9.3 Regole

- `Amount` è il controllo principale.
- `Audio driver` cambia la sorgente del movimento.
- `Visual response` cambia il parametro target.
- I controlli avanzati sono secondari.
- Ogni modifica è visibile immediatamente.
- L’utente può disattivare senza eliminare.

---

## 10. Parametri e significato

### 10.1 Amount

```text
Amount [────●────] 45%
```

Controlla quanto l’audio altera il parametro.

- `0%`: nessuna alterazione.
- `45%`: alterazione moderata.
- `100%`: massima alterazione nel range.

### 10.2 Sensitivity

```text
Sensitivity [────●────] 1.2x
```

Amplifica o riduce la risposta dell’audio.

- `< 1.0x`: risposta più soft.
- `1.0x`: risposta normale.
- `> 1.0x`: risposta più accentuata.

### 10.3 Smoothing

```text
Smoothing [────●────] Medium
```

Riduce jitter e movimenti nervosi.

- `Low`: reazione istantanea.
- `Medium`: equilibrio.
- `High`: movimento morbido.

### 10.4 Attack

```text
Attack [██░░░░░░] Fast
```

Velocità con cui il parametro sale quando l’audio aumenta.

- Fast: pulse percettibile.
- Slow: respiro graduale.

### 10.5 Release

```text
Release [░░░░████] Slow
```

Velocità con cui il parametro torna al valore base.

- Fast: effetto breve.
- Slow: coda più lunga.

### 10.6 Range

```text
Scale range
Min: 1.00x
Max: 1.35x
```

Definisce i limiti dell’alterazione.

- Evita layer invisibili.
- Evita layer fuori canvas.
- Evita valori non sensati.

### 10.7 Invert

```text
Invert response [ ]
```

Inverte la relazione.

- Bass alto → più luce.
- Invert → bass alto → meno luce.

---

## 11. Modalità di mapping (post-MVP — il motore attuale risolve first-wins + amount)

Il contratto reale supporta solo `curve: linear | invert`. Le modalità sotto restano
come riferimento per evoluzioni future del motore.

### 11.1 Additive

```text
Final = Base + Audio contribution
```

Default consigliato.

Uso:

- Scale
- Brightness
- Distortion
- Particles

### 11.2 Absolute

```text
Final = Min + Audio * (Max - Min)
```

Uso:

- Opacity
- Effect intensity
- Parameter interamente pilotato

### 11.3 Multiply

```text
Final = Base * (1 + Audio contribution)
```

Uso:

- Scale
- Saturation
- Brightness

### 11.4 Trigger

```text
Audio > threshold → activate
Audio < threshold → deactivate
```

Uso:

- Flash
- Toggle
- Transizione

---

## 12. Tab Bindings

### 12.1 Layout

```text
Bindings
├── + Add binding
├── Binding list
└── Binding detail
```

```text
┌────────────────────────────────────┐
│ ♪ Bass → Scale               [on]  │
│ Amount 45%  [live waveform strip]  │
│ [Edit] [Mute] [Remove]             │
```

Ogni riga preset è un widget unico ed espandibile: driver (React to), Sensitivity e
mini-waveform sono gli stessi campi del creator (`PresetSettingsFields`), visibili sia in
creazione che in mantenimento. Il drag sulla waveform regola solo il suo Amount. Mute mette
in pausa la modulazione nel motore (`disabledAudioBindings`), senza eliminare il binding.
Un parametro accetta una sola modulazione: crearne un'altra sullo stesso parametro
sostituisce la precedente con avviso esplicito.
├────────────────────────────────────┤
│ ♪ RMS → Re-light intensity  [on]   │
│ Amount 60%                         │
│ [Edit] [Mute] [Remove]             │
└────────────────────────────────────┘
```

### 12.2 Creazione binding

```text
1. Choose audio feature
2. Choose target layer or effect
3. Choose parameter
4. Choose response
5. Adjust amount
6. Save
```

### 12.3 UI guidata

```text
Create audio modulation

What should react?
[Video Layer] [Text Layer] [Effect]

What should drive it?
[Bass] [Energy] [Beat] [Mid] [High]

What should change?
[Scale] [Brightness] [Color] [Blur]

Amount
[────●────] 45%

[Create] [Cancel]
```

---

## 13. Tab Analyzer

### 13.1 Layout

```text
Analyzer
├── Live waveform
├── Band meters
├── Beat indicator
└── Feature values
```

```text
Bass  [██████░░░░] 62%
Mid   [████░░░░░░] 38%
High  [██░░░░░░░░] 21%
RMS   [█████░░░░░] 51%
Beat  ●
```

### 13.2 Funzione

L’Analyzer permette di:

- Capire quale banda è più intensa.
- Scegliere il driver giusto.
- Verificare che l’audio sia analizzato.
- Osservare beat e RMS.

### 13.3 Regola

L’Analyzer è osservativo: non modifica direttamente il visual.

---

## 14. Reattività visiva

### 14.1 Indicatore sul parametro

```text
Scale
[────●────] 1.18x
● Audio · Bass
```

### 14.2 Indicatore sul layer

```text
Video Layer 01 [♪ 2]
```

### 14.3 Indicatore sulla Sound Bar

```text
[♪ Audio Reactive · 3]
```

### 14.4 Regola

L’utente deve sempre capire:

```text
Suono → parametro → visual
```

---

## 15. Conflitti tra binding

### 15.1 Problema

```text
Bass → Scale
Beat → Scale
```

### 15.2 Soluzione default

Somma additive:

```text
Final scale =
Base scale
+ Bass contribution
+ Beat contribution
```

Poi clamp:

```ts
finalValue = clamp(finalValue, min, max);
```

### 15.3 UI

```text
Scale is affected by 2 audio sources.

Combined mode: Additive

Bass contribution: +0.18x
Beat contribution: +0.08x

[Review] [Change mode] [Mute one]
```

---

## 16. Stati del binding

| Stato | Significato | UI |
|---|---|---|
| `active` | Sta modulando | Badge viola |
| `paused` | Salvato ma non attivo | Badge neutro |
| `muted` | Disattivato temporaneamente | Icona mute |
| `orphan` | Target rimosso | Warning |
| `invalid` | Parametro non compatibile | Errore |
| `missing-source` | Audio non disponibile | Warning |
| `conflict` | Conflitto con altri binding | Badge giallo |

---

## 17. Flusso tecnico

```text
Audio file
  → Decode
  → AnalyserNode
  → FFT
  → Bands (bass/mid/treble/level, nessuna beat detection — post-MVP)
  → Normalize
  → AudioAnalysisFrame
  → Resolve bindings
  → Apply mapping
  → Update parameters
  → Invalidate layers
  → Render frame
```

### 17.1 Per frame

```text
1. Read audio frame
2. Update waveform and meters
3. Resolve active bindings
4. Apply smoothing
5. Compute effective values
6. Update layer/effect params
7. Render scene
8. Update UI badges
```

---

## 18. Regole non negoziabili

1. Il volume non modifica l’audio-reactivity.
2. Ogni preset dichiara cosa modifica.
3. Ogni preset è personalizzabile.
4. Ogni binding ha target esplicito.
5. Ogni parametro modulato mostra base ed effective value.
6. Ogni binding è disattivabile senza eliminarlo.
7. Ogni conflitto è visibile.
8. Ogni errore audio non blocca il rendering.
9. L’analisi audio è separata dalla pipeline visiva.
10. L’utente vede sempre la relazione: **suono → parametro → visual**.


---

## 19. Reference osservato (sketchdesign.club/#tools, via MCP browser)

Interpretazioni adottate nel nostro design system:

- Play primario bianco pieno e circolare, stop/loop ghost secondari, transport in pill.
- Thumb slider bianco pieno, track invariata da token.
- Gruppi Zone A come pill: BPM input e track arrotondate.
- Inspector loro: label + value pill a destra, slider sotto (pattern gia nostro, confermato).
- Kebab loro verticale full-width: da noi DropdownMenu compatto, stesse voci e ordine.
- Non adottato: tab Presets/Scenes, MIDI/CC, waveform a riga singola (la nostra porta timeline + preset).
