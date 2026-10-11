# DESIGN.md — Sketch Tools UI Reference

## 1. Panoramica

**Sketch Tools** è una web app per creare visual generativi, motion design e grafiche audio-reattive direttamente nel browser. La UI combina:

- Un’area di lavoro centrale (canvas/stage)
- Pannelli di controllo laterali e flottanti
- Una barra superiore per progetto, anteprima, salvataggio e condivisione
- Un sistema di layer e proprietà per comporre scene
- Controlli audio per sincronizzare effetti con musica o BPM

L’interfaccia segue un modello **“dashboard creativa”**: il contenuto principale è sempre visibile, mentre gli strumenti appaiono come pannelli contestuali senza coprire stabilmente il canvas. [1]

---

## 2. Layout generale

```text
┌──────────────────────────────────────────────────────────────┐
│  ┌─ cluster ─────────┐            ┌─ chip ─┐   ┌─ cluster ─┐ │  ← TopBar flottante
│  │ ✨  Qualità  📄    │            │  scene │   │ 💾  📦  👤 │ │    (overlay, h-10)
│  └───────────────────┘            └────────┘   └───────────┘ │
│ ┌────┐                                            ┌─────────┐ │
│ │Tool│              CANVAS / STAGE                │ Params  │ │
│ │Rail│   Visualizzazione del progetto            │ Panel   │ │  ← 290×496,
│ │ 56 │                                            │ float   │ │    left x16 y68
│ └────┘                                            └─────────┘ │
├──────────────────────────────────────────────────────────────┤
│  Tips & tricks                                  [ⓘ Support]  │  ← tips h-11
│ [♪] [⋯]   [■] [▶] [track] [BPM] [🎤] [Loop]   [MIDI] [⌃]     │  ← main h-[57px]
└──────────────────────────────────────────────────────────────┘
   ⌃ espande il PanelSlot (h-0 → h-148px): waveform, timeline,
     preset rail, meter B/M/T/L
```

### Principi di posizionamento

- **Top bar**: cluster flottanti sovrapposti al canvas, non una barra full-width. Azioni globali, non contestuali alla selezione.
- **Tool rail**: barra icone stretta a sinistra (56px), sempre visibile.
- **Canvas centrale**: area dominante, con priorità visiva massima.
- **Params panel**: pannello flottante **a sinistra** (290×496, `x16 y68`), non un inspector a destra. Proprietà dell'oggetto selezionato: parametri, effetti, preset.
- **Sound bar**: due tier a tutto campo in fondo — tips `44px` + main bar `57px` = `101px` a riposo. Waveform, timeline, preset e meter vivono nel PanelSlot espandibile.
- **Bottom area**: playback, BPM, ingressi MIDI/mic e stato del progetto.

---

## 3. Componenti di primo livello

| Componente | Posizione | Funzione | Design tipico |
|---|---|---|---|
| **Top bar** | In alto, full-width | Navigazione, nome progetto, azioni globali | Barra scura o neutra, compatta, con icone e menu |
| **Brand / Logo** | Top-left | Identità prodotto e accesso alla home | Logo + eventuale label “Sketch” |
| **Project title** | Top-center o top-left | Identifica il progetto corrente | Testo editabile o menu progetto |
| **Primary actions** | Top-right | Preview, save, share, download, full-screen | Icon buttons con tooltip |
| **Account menu** | Top-right | Profilo, piano, impostazioni utente | Avatar o icona utente + dropdown |
| **Canvas / Stage** | Centro | Area dove si compone la visual | Sfondo neutro o scuro, contenuto centrato |
| **Layer list** | Sinistra o dentro un pannello | Organizza elementi della scena | Lista verticale con nomi, icone, visibilità e ordine |
| **Inspector** | Destra | Modifica proprietà del layer selezionato | Pannelli a sezioni con field, slider, color picker |
| **Floating panels** | Sovrapposti al canvas | Strumenti temporanei o avanzati | Card con bordo, ombra, header e close button |
| **Audio controls** | Bottom o pannello dedicato | Gestione traccia, BPM e reattività | Waveform, play/pause, slider, BPM input |
| **Status / feedback** | Bottom-right o top-center | Salvataggio, errori, export, hint | Toast, badge o piccola status bar |

---

## 4. Top bar

### Struttura

```text
[Logo] [Project name] ................ [Preview] [Quality] [Save] [Share] [Download] [Full screen] [Menu] [Account]
```

### Elementi osservati

- **New to Sketch? / Start here**: onboarding contestuale per nuovi utenti. [1]
- **Dashboard**: collegamento alla vista progetti. [1]
- **Preview**: attiva un’anteprima della composizione.
- **Quality**: controllo della qualità di rendering o preview.
- **Save Project**: salvataggio dello stato corrente.
- **Share**: condivisione del progetto o del risultato.
- **Download**: esportazione del file/video/immagine.
- **Open full-screen display**: modalità a schermo intero per vedere il canvas senza UI.
- **Open menu**: menu principale o menu contestuale.
- **Account menu**: gestione account e preferenze. [1]

### Logica UX

- Le azioni distruttive o globali stanno a destra.
- Le azioni di visualizzazione, come **Preview** e **Full screen**, sono separate dalle azioni di persistenza, come **Save** e **Download**.
- I menu a discesa riducono il rumore visivo: non tutte le opzioni devono essere sempre visibili.

---

## 5. Dashboard iniziale

La schermata iniziale mostra un modello più semplice rispetto all’editor:

```text
┌────────────────────────────────────────────┐
│ Header / Brand                             │
├────────────────────────────────────────────┤
│ Welcome block                              │
│ “Welcome to Sketch”                        │
│ “The design tool for audio lovers.”        │
│ [New Project]                              │
├────────────────────────────────────────────┤
│ Projects section                           │
│ “Your projects”                            │
│ Project cards / empty state                │
└────────────────────────────────────────────┘
```

### Componenti

| Componente | Ruolo | Dettagli |
|---|---|---|
| **Welcome hero** | Orienta l’utente | Titolo grande, sottotitolo descrittivo, CTA principale |
| **New Project CTA** | Azione primaria | Pulsante ad alto contrasto |
| **Projects grid** | Accesso ai progetti | Card con anteprima, nome, data e azioni |
| **Empty state** | Guida quando non ci sono progetti | Messaggio tipo “Saving projects is available only for users” |
| **Auth / plan gate** | Limita funzionalità | Invita a registrarsi o effettuare l’upgrade |

La dashboard usa una gerarchia chiara: **brand → valore del prodotto → azione principale → contenuti personali**. [1]

---

## 6. Canvas e stage

Il canvas è il cuore dell’app. Ospita:

- Video, immagini o sfondi
- Testi
- Forme e layer generativi
- Effetti visivi
- Visualizzazioni audio-reattive

### Comportamento previsto

- Il layer selezionato evidenzia bounding box, handle o outline.
- Il canvas supporta zoom, pan e selezione.
- Gli elementi possono essere trascinati, ridimensionati e ruotati.
- Gli effetti si applicano a un layer oppure all’intera scena.
- La modalità **full-screen** nasconde i pannelli per la sola visualizzazione.

### Suggerimento per la tua dashboard

Usa una griglia centrale con:

```css
.canvas-area {
  position: relative;
  flex: 1;
  overflow: hidden;
}
```

I pannelli flottanti devono usare `position: absolute` dentro il canvas, non modificare il layout principale.

---

## 7. Sistema di layer

Un layer rappresenta un elemento della scena.

### Struttura consigliata

```text
Layer
├── ID
├── Nome
├── Tipo: video / image / text / shape / effect / audio
├── Visibilità
├── Lock
├── Ordine Z
├── Trasformazione: x, y, scale, rotation, opacity
├── Proprietà specifiche
└── Effetti applicati
```

### Esempi presenti nell’app

- **Video layer**: video Pexels usato come base visiva. [1]
- **Text layer**: testo modificabile, con font, dimensione, colore e posizione.
- **Effect layer / effect stack**: effetti come **Re-light** e **Thermal**. [1]
- **Audio layer / audio source**: file `afrobeat.mp3`, con BPM 115. [1]

### Interazioni

| Azione | Risultato |
|---|---|
| Click sul layer | Selezione e apertura Inspector |
| Drag nel layer list | Cambia ordine di rendering |
| Eye icon | Mostra/nasconde layer |
| Lock icon | Blocca modifiche accidentali |
| Duplicate | Crea copia del layer |
| Delete | Rimuove layer |
| Right-click | Menu contestuale |

---

## 8. Inspector e pannelli di proprietà

L’Inspector è il pannello destro che cambia in base alla selezione.

### Struttura consigliata

```text
Inspector
├── Header: nome layer + tipo
├── Transform
│   ├── Position X / Y
│   ├── Scale
│   ├── Rotation
│   └── Opacity
├── Appearance
│   ├── Fill / Color
│   ├── Stroke
│   ├── Blend mode
│   └── Blur
├── Effects
│   ├── Re-light
│   └── Thermal
├── Audio reactivity
│   ├── Source
│   ├── Sensitivity
│   ├── Frequency band
│   └── Smoothing
└── Advanced
    ├── Blend / mask
    └── Custom parameters
```

### Tipi di field

| Field | Uso | Controllo UI |
|---|---|---|
| **Text input** | Nome, URL, valore esatto | Input con label |
| **Number input** | Coordinate, dimensioni, BPM | Input + stepper |
| **Slider** | Intensità, opacità, sensibilità | Slider + valore numerico |
| **Color picker** | Colore, tinta, luminosità | Swatch + popover |
| **Dropdown** | Font, blend mode, sorgente | Select |
| **Toggle** | Visibilità, attivazione effetto | Switch |
| **Segmented control** | Modalità rapida | 2–4 opzioni affiancate |
| **File picker** | Video, immagine, audio | Bottone “Upload” o drag & drop |
| **Range dual** | Intervallo | Due handle |
| **Accordion** | Raggruppare impostazioni | Sezioni espandibili |

---

## 9. Effetti e parametri

Gli effetti appaiono come moduli aggiungibili a un layer o alla scena.

### Modello consigliato

```text
Effect
├── Nome
├── Enabled
├── Preset
├── Parametri
│   ├── Intensity
│   ├── Radius
│   ├── Threshold
│   ├── Color
│   └── Blend mode
├── Audio mapping
│   ├── Trigger: bass / mid / high
│   ├── Sensitivity
│   └── Smoothing
└── Azioni: duplicate / reset / delete
```

### Effetti osservati

- **Re-light**: modifica illuminazione, contrasto o resa luminosa del contenuto. [1]
- **Thermal**: applica una mappatura termica/coloristica al video o all’immagine. [1]

### Regola UI importante

Ogni effetto dovrebbe avere:

- Un toggle per attivarlo senza eliminarlo
- Un bottone **Reset** per tornare ai valori di default
- Un bottone **Delete** per rimuoverlo
- Un indicatore visivo quando è attivo
- Parametri raggruppati in accordion

---

## 10. Sistema audio

Sketch Tools è orientato alla sincronizzazione audio-visiva. Nel progetto visibile è presente una traccia `afrobeat.mp3` con BPM 115. [1]

### Componenti consigliati

```text
Audio Panel
├── Track name
├── Play / Pause
├── Timeline / waveform
├── Volume
├── BPM
├── Beat detection
├── Frequency bands
│   ├── Bass
│   ├── Mid
│   └── High
└── Audio-reactive mappings
```

### Logica consigliata

- **Bass** può pilotare scale, glow o distorsione.
- **Mid** può controllare colore, blur o velocità.
- **High** può controllare particelle, flicker o dettaglio.
- **BPM** può sincronizzare animazioni e transizioni.
- Ogni mapping deve avere un valore minimo, massimo e smoothing.

---

## 11. Pannelli flottanti

I pannelli flottanti sono elementi sovrapposti al canvas, usati per funzioni che non devono occupare permanentemente il layout.

### Tipologie

| Pannello | Quando appare | Contenuto |
|---|---|---|
| **Preview** | Su richiesta | Anteprima pulita del risultato |
| **Asset picker** | Quando si aggiunge contenuto | Video, immagini, audio, template |
| **Color picker** | Quando si modifica un colore | Palette, hex, alpha |
| **Effect settings** | Quando si seleziona un effetto | Parametri specifici |
| **Export settings** | Prima del download | Formato, risoluzione, durata, qualità |
| **Share modal** | Quando si condivide | Link, permessi, embed |
| **Project settings** | Dal menu | Nome, dimensioni, fps, sfondo |
| **Toasts** | Dopo azioni | “Saved”, “Export started”, “Error” |

### Design consigliato

```css
.floating-panel {
  position: absolute;
  background: rgba(18, 18, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(14px);
  padding: 14px;
}
```

### Regole

- Massimo 1–2 pannelli flottanti visibili contemporaneamente.
- Ogni pannello deve avere titolo, close button e area scrollabile.
- Non coprire mai completamente il canvas.
- Chiudi con `Esc`, click fuori oppure pulsante X.
- Mantieni la posizione se l’utente lo sposta.

---

## 12. Stati dell’interfaccia

### Stati di progetto

| Stato | UI |
|---|---|
| **Empty** | Onboarding, CTA “New Project” |
| **Loading** | Skeleton o spinner |
| **Editing** | Canvas + Inspector + layer list |
| **Preview** | UI ridotta o nascosta |
| **Saving** | Indicatore “Saving…” |
| **Saved** | Toast o badge “Saved” |
| **Error** | Toast rosso con azione di retry |
| **Exporting** | Progress bar o stato “Rendering…” |

### Stati di layer

| Stato | Indicatore |
|---|---|
| Selected | Bordo evidziato / Inspector aperto |
| Hidden | Icona occhio spenta |
| Locked | Icona lucchetto |
| Audio-reactive | Piccolo badge audio o icona waveform |
| Has effects | Badge o conteggio effetti |

---

## 13. Pattern riutilizzabili per la tua dashboard

### 13.1 Shell dell’app

Usa una shell stabile:

```text
AppShell
├── TopBar
├── Sidebar
├── MainArea
├── RightPanel
└── BottomBar
```

La shell non cambia; cambiano solo i contenuti dei pannelli.

### 13.2 Pannello contestuale

Il pannello destro deve rispondere alla selezione:

```text
if selection exists:
  show Inspector(selection)
else:
  show SceneSettings
```

### 13.3 Field group

Raggruppa i field per intento, non per tipo:

```text
Transform
- Position
- Scale
- Rotation

Appearance
- Color
- Opacity
- Blend

Motion
- Speed
- Direction
- Audio reactivity
```

### 13.4 Azioni primarie vs secondarie

- **Primarie**: New, Save, Preview, Export.
- **Secondarie**: Duplicate, Reset, Settings, Help.
- **Distruttive**: Delete, Remove effect — sempre con conferma o undo.

### 13.5 Feedback immediato

Ogni modifica dovrebbe avere feedback:

- Slider: il canvas si aggiorna in tempo reale.
- Save: indicatore di stato.
- Export: progress o toast.
- Errore: messaggio chiaro e azione di recovery.

---

## 14. Gerarchia visiva consigliata

1. **Canvas**: elemento più importante.
2. **Layer selezionato**: evidenziato con outline o handle.
3. **Inspector**: leggibile ma subordinato al canvas.
4. **Top bar**: discreta, con azioni chiare.
5. **Pannelli flottanti**: comparsi solo quando servono.
6. **Toast e status**: brevi, non bloccanti.

---

## 15. Template finale per la tua dashboard

```text
DashboardShell
├── TopBar
│   ├── Brand
│   ├── ProjectTitle
│   ├── GlobalActions
│   └── UserMenu
├── Workspace
│   ├── LeftRail
│   │   ├── Tools
│   │   ├── Assets
│   │   ├── Layers
│   │   └── Templates
│   ├── Canvas
│   │   ├── SceneContent
│   │   ├── SelectionOverlay
│   │   └── FloatingPanels
│   └── Inspector
│       ├── SelectionHeader
│       ├── TransformFields
│       ├── AppearanceFields
│       ├── EffectsSection
│       └── AudioSection
├── BottomBar
│   ├── PlaybackControls
│   ├── Timeline
│   ├── AudioControls
│   └── StatusIndicator
└── OverlayLayer
    ├── Modals
    ├── ColorPicker
    ├── ExportPanel
    ├── SharePanel
    └── Toasts
```

# UI STYLE SYSTEM — Sketch-inspired Dashboard

## 1. Direzione visiva

Lo stile è **dark, tecnico e professionale**, pensato per un’app di creazione dove il contenuto — canvas, video, visual e audio — deve dominare sull’interfaccia.

Principi:

- **Dark-first**: superfici scure per ridurre l’affaticamento e far risaltare i contenuti colorati.
- **Content-first**: il canvas occupa la maggior parte dello spazio.
- **Low-chrome UI**: bordi sottili, poche ombre, controlli compatti.
- **High contrast**: testo e controlli sempre leggibili sopra superfici scure.
- **Precision**: valori numerici, slider e campi input sono centrali nell’esperienza.
- **Calm motion**: animazioni brevi e funzionali, mai decorative.

---

## 2. Palette

### Superfici

| Token | Valore consigliato | Uso |
|---|---:|---|
| `--background` | `75 20% 3%` (`#080906`) | Sfondo generale dell’app |
| `--bg-canvas` | `75 20% 3%` (`#080906`) | Area di lavoro centrale |
| `--surface-panel` | `75 7% 10%` (`#191a17`) | Sidebar, Params panel, pannelli |
| `--surface-raised` | `78 6% 14%` | Card, modali, dropdown |
| `--surface-input` | `78 6% 12%` (`#1e211d`) | Input, select, number field |
| `--surface-2` | `78 6% 12%` (`#1e211d`) | Hover su righe, bottoni secondari |
| `--surface-accent` | `75 42% 15%` (`#2b3616`) | Stato attivo o selezionato |

### Bordi

| Token | Valore | Uso |
|---|---:|---|
| `--border-subtle` | `rgba(255,255,255,0.06)` | Separatori interni |
| `--border-default` | `rgba(255,255,255,0.10)` | Bordi di pannelli e input |
| `--border-strong` | `rgba(255,255,255,0.18)` | Hover, focus, elementi importanti |
| `--border-selected` | `#b8d94a` | Layer o item selezionato |

### Testo

| Token | Valore | Uso |
|---|---:|---|
| `--text-primary` | `#f8f8f5` | Titoli, label principali, valori |
| `--text-secondary` | `#a8ac9d` | Descrizioni, helper text |
| `--text-muted` | `#71717A` | Metadati, placeholder |
| `--text-disabled` | `#52525B` | Controlli non disponibili |

### Accenti

| Token | Valore | Uso |
|---|---:|---|
| `--primary` | `74 60% 57%` (`#b8d94a`) | Azione principale, selezione, focus |
| `--accent-success` | `#34D399` | Salvato, export completato |
| `--accent-warning` | `#FBBF24` | Avvisi, modifiche non salvate |
| `--accent-danger` | `#F87171` | Elimina, errore, conflitto |
| `--accent-audio` | `#A78BFA` | Audio, BPM, waveform, reattività |

---

## 3. Contrasto e accessibilità

Usa contrasti sufficienti per testo e componenti interattivi:

- Testo principale su `--bg-panel`: almeno **7:1**.
- Testo secondario su `--bg-panel`: almeno **4.5:1**.
- Testo su bottoni primari: almeno **4.5:1**.
- Bordi di input e controlli: almeno **3:1** rispetto allo sfondo.
- Non comunicare lo stato solo con il colore: aggiungi icona, testo o badge.

### Esempi sicuri

```css
/* Testo principale */
color: #f8f8f5;
background: #191a17;

/* Testo secondario */
color: #a8ac9d;
background: #191a17;

/* Bordo input */
border: 1px solid #30332f;
```

### Focus visibile

Ogni elemento interattivo deve avere un focus ring chiaro:

```css
:focus-visible {
  outline: 2px solid #b8d94a;
  outline-offset: 2px;
  border-radius: 6px;
}
```

Non rimuovere mai l’outline senza sostituirlo con un indicatore altrettanto visibile.

---

## 4. Tipografia

Usa un font UI neutro e altamente leggibile.

```css
--font-ui: "Inter", "SF Pro Text", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SFMono-Regular", monospace;
```

| Ruolo | Font | Peso | Dimensione | Uso |
|---|---|---:|---:|---|
| Display | `--font-ui` | 600–700 | 28–36px | Titolo dashboard |
| Page title | `--font-ui` | 600 | 20–24px | “Your projects” |
| Panel title | `--font-ui` | 600 | 14–15px | “Transform”, “Effects” |
| Body | `--font-ui` | 400–500 | 13–14px | Label, descrizioni |
| Field label | `--font-ui` | 500 | 12–13px | “Opacity”, “BPM” |
| Meta | `--font-ui` | 400 | 11–12px | Data, formato, stato |
| Numeric value | `--font-mono` | 500 | 12–13px | Coordinate, percentuali, BPM |

### Regole

- Le label dei field devono stare sopra o a sinistra del controllo.
- I valori numerici usano font monospazio per allineamento stabile.
- Non usare testo sotto 12px per informazioni essenziali.
- Le descrizioni helper devono essere brevi e non sostituire la label.

---

## 5. Spaziature e griglia

Usa una scala a 4px.

| Token | Valore | Uso |
|---|---:|---|
| `--space-1` | `4px` | Distanze minime tra icona e testo |
| `--space-2` | `8px` | Padding compatto di bottoni e field |
| `--space-3` | `12px` | Padding standard dei pannelli |
| `--space-4` | `16px` | Spaziatura tra sezioni |
| `--space-5` | `20px` | Separazione tra gruppi |
| `--space-6` | `24px` | Margini esterni dei pannelli |
| `--space-8` | `32px` | Aree principali della dashboard |

### Layout

```css
.app-shell {
  display: grid;
  grid-template-columns: 240px 1fr 300px;
  grid-template-rows: 48px 1fr 56px;
  height: 100vh;
}
```

- **Sidebar sinistra**: 220–260px.
- **Inspector destro**: 280–340px.
- **Top bar**: 44–52px.
- **Bottom bar**: 48–64px.
- **Canvas**: flessibile, sempre dominante.

---

## 6. Raggi, ombre e profondità

Lo stile deve essere moderno ma sobrio.

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-full: 999px;

--shadow-panel:
  0 12px 32px rgba(0, 0, 0, 0.38),
  0 2px 8px rgba(0, 0, 0, 0.24);

--shadow-modal:
  0 24px 64px rgba(0, 0, 0, 0.55),
  0 4px 16px rgba(0, 0, 0, 0.32);
```

| Elemento | Raggio | Ombra |
|---|---:|---|
| Button | `--radius-sm` | Nessuna o molto leggera |
| Input | `--radius-sm` | Nessuna |
| Card progetto | `--radius-md` | Leggera |
| Floating panel | `--radius-lg` | `--shadow-panel` |
| Modal | `--radius-lg` | `--shadow-modal` |
| Avatar / badge | `--radius-full` | Nessuna |

---

## 7. Bottoni

### Varianti

| Variante | Uso | Stile |
|---|---|---|
| **Primary** | New Project, Save, Export | Sfondo `--primary`, testo scuro o bianco ad alto contrasto |
| **Secondary** | Preview, Share, Settings | Sfondo trasparente o `--bg-hover`, bordo `--border-default` |
| **Ghost** | Azioni ricorrenti non critiche | Solo icona/testo, hover leggero |
| **Danger** | Delete, Remove effect | Bordo o testo `--accent-danger`, conferma richiesta |
| **Icon button** | Toolbar | 32–36px, icona centrata, tooltip obbligatorio |

### Dimensioni

```css
--button-height-sm: 28px;
--button-height-md: 32px;
--button-height-lg: 40px;
```

### Esempio

```css
.btn-primary {
  background: #b8d94a;
  color: #080906;
  border-radius: 8px;
  height: 32px;
  padding: 0 14px;
  font-weight: 600;
}

.btn-secondary {
  background: transparent;
  color: #f8f8f5;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  height: 32px;
  padding: 0 12px;
}
```

---

## 8. Input e field

Ogni field deve avere:

1. Label visibile
2. Controllo
3. Valore corrente
4. Eventuale helper text
5. Stato di errore accessibile

### Struttura

```text
Label
[ Control ] [ Value ]
Helper text / error message
```

### Tipologie

| Field | Design |
|---|---|
| **Text input** | Altezza 32px, sfondo `--bg-input`, bordo `--border-default` |
| **Number input** | Input + stepper o drag-to-change |
| **Slider** | Traccia sottile, handle visibile, valore numerico affiancato |
| **Toggle** | Switch 36×20px, stato on con colore accento e label |
| **Select** | Select compatto con chevron e menu scuro |
| **Color picker** | Swatch quadrato 20–24px + hex value |
| **File upload** | Area drop con bordo tratteggiato e CTA chiara |
| **Segmented control** | Gruppo di opzioni affiancate, selezione con sfondo attivo |

### Esempio slider

```css
.slider-track {
  height: 4px;
  background: #2A2A33;
  border-radius: 999px;
}

.slider-fill {
  background: #b8d94a;
  border-radius: 999px;
}

.slider-handle {
  width: 14px;
  height: 14px;
  background: #f8f8f5;
  border: 2px solid #b8d94a;
  border-radius: 50%;
}
```

---

## 9. Pannelli

### Pannello laterale

```css
.panel {
  background: #191a17;
  border: 1px solid #30332f;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}
```

Struttura:

```text
Panel
├── Header
│   ├── Title
│   └── Actions
├── Scroll area
│   ├── Field group
│   ├── Field group
│   └── Effect cards
└── Footer
    └── Primary action
```

### Pannello flottante

```css
.floating-panel {
  position: absolute;
  min-width: 240px;
  max-width: 360px;
  max-height: 70vh;
  overflow: auto;
  background: rgba(22, 22, 26, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(16px);
}
```

Regole:

- Header sempre presente con titolo e close button.
- Chiudibile con `Esc`.
- Non deve coprire il layer selezionato.
- Deve avere scroll interno se il contenuto è lungo.
- Deve mantenere una distanza minima di 12px dai bordi del canvas.

---

## 10. Iconografia

Usa icone lineari, coerenti e di 16–20px.

| Icona | Uso |
|---|---|
| `plus` | New project / add layer |
| `play` / `pause` | Playback |
| `eye` / `eye-off` | Visibilità layer |
| `lock` / `unlock` | Blocco layer |
| `layers` | Layer list |
| `sliders` | Inspector / settings |
| `waveform` | Audio |
| `download` | Export |
| `share` | Condivisione |
| `expand` | Full screen |
| `trash` | Delete |
| `copy` | Duplicate |
| `x` | Close |

Regole:

- Le icone devono avere `aria-label` se non sono accompagnate da testo.
- Le icone destructive devono essere accompagnate da testo o tooltip.
- Non usare icone ambigue per azioni importanti.

---

## 11. Stati interattivi

| Stato | Trattamento |
|---|---|
| **Default** | Superficie scura, bordo sottile |
| **Hover** | Leggero aumento di luminosità |
| **Active / pressed** | Superficie più chiara o scale 0.98 |
| **Selected** | Bordo accento + sfondo leggermente evidenziato |
| **Focus** | Outline accento visibile |
| **Disabled** | Opacità 45–55%, cursore `not-allowed` |
| **Loading** | Spinner, skeleton o progress bar |
| **Error** | Bordo/testo `--accent-danger` + messaggio esplicito |

---

## 12. Motion

Le animazioni devono essere brevi e non bloccanti.

| Interazione | Durata | Easing |
|---|---:|---|
| Hover | 120–160ms | `ease-out` |
| Pannello che appare | 160–220ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Modal | 180–240ms | Fade + leggero scale |
| Toast | 200ms in, 200ms out | `ease-out` |
| Canvas transform | 80–120ms | `ease-out` |

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 13. Componenti chiave

### Layer item

```text
[icon] Layer name ................ [eye] [lock] [more]
```

- Altezza: 32–36px.
- Selezione: bordo sinistro accento o sfondo `--bg-active`.
- Drag handle visibile solo in hover o quando è attiva la modalitàRiordina.
- Il nome deve essere troncato con ellipsis, mai nascosto completamente.

### Effect card

```text
[Effect icon] Re-light ............... [toggle]
Intensity -------------------- 64%
Radius ----------------------- 32%
[Reset] [Delete]
```

- Il toggle attiva/disattiva senza eliminare.
- I parametri sono nascosti o ridotti quando l’effetto è off.
- Reset ripristina i default.
- Delete richiede conferma o supporta undo.

### Audio panel

```text
afrobeat.mp3
[▶] [waveform] 115 BPM
Bass ---- 72%
Mid ----- 48%
High ---- 25%
```

- BPM deve essere modificabile e allineato a destra.
- Le bande audio usano slider con valori numerici.
- Lo stato “audio reactive” deve essere indicato con un badge o icona waveform.

---

## 14. Pattern di accessibilità

- Usa semantic HTML: `header`, `nav`, `main`, `aside`, `button`, `input`, `dialog`.
- Ogni modale deve intrappolare il focus e restituirlo alla chiusura.
- Ogni icon button deve avere `aria-label`.
- Ogni field deve avere `label` collegata tramite `for` / `id`.
- Gli errori devono essere annunciati con `aria-live="polite"` o `role="alert"`.
- Le shortcut da tastiera devono essere documentate.
- Il contrasto non deve dipendere solo dal colore.
- Fornisci alternativa testuale per waveform, anteprime e visual generativi.

### Esempio field accessibile

```html
<label for="opacity">Opacity</label>
<input
  id="opacity"
  type="range"
  min="0"
  max="100"
  value="80"
  aria-describedby="opacity-help"
/>

<span id="opacity-help">Controls the transparency of the selected layer.</span>
```

---

## 15. Regole finali di coerenza

- Un solo colore d’accento principale per azione e selezione.
- Un solo stile di pannello per tutte le sezioni laterali.
- Le azioni primarie sono sempre nello stesso punto.
- I pannelli flottanti non sostituiscono l’Inspector permanente.
- Ogni controllo ha label, valore e feedback.
- Ogni stato è comprensibile senza fare affidamento solo sul colore.
- Il canvas resta sempre l’elemento visivamente dominante.