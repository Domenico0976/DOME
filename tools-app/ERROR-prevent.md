# Failure Scenarios & Resilience Logic

## 1. Problema radice

### 1.1 Scenario

Un utente ha un progetto con:

- Un video layer
- Un effetto `Thermal`
- Un effetto `Re-light`
- Una traccia audio `afrobeat.mp3`
- Un binding audio: `bass → transform.scale`
- Un binding audio: `rms → relight.intensity`

Durante la sessione, l’utente:

1. Rimuove il video layer.
2. L’app mantiene però il binding `bass → transform.scale` rivolto al layer rimosso.
3. Salva il progetto.
4. Riapre il progetto più tardi.

Risultato possibile senza protezione:

```text
AudioBinding.target.layerId = "layer_video_01"
Layer "layer_video_01" = non esiste più
```

Il motore audio tenta di scrivere un parametro inesistente. Il renderer può:

- Crashare
- Ignorare silenziosamente il binding
- Applicare il valore a un layer sbagliato
- Salvare uno stato corrotto
- Mostrare un progetto apparentemente funzionante ma non riproducibile

### 1.2 Causa profonda

Il problema non è “un layer cancellato”.

Il problema è che **un’entità dipendente ha mantenuto un riferimento orfano**.

```text
Layer rimosso
   ↓
AudioBinding rimane valido nello stato
   ↓
Renderer riceve un target inesistente
   ↓
Stato, UI e rendering divergono
```

Questo è il **Root Failure Pattern**:

> Ogni relazione tra entità deve essere valida, risolta e verificabile prima dell’esecuzione.

---

## 2. Principio di resilienza

### 2.1 Regola fondamentale

> Nessun modulo può fidarsi ciecamente di un ID, di un asset o di un parametro.

Ogni riferimento deve passare per una fase di **resolution**:

```text
Raw state
  → Validate
  → Resolve references
  → Normalize values
  → Repair or quarantine
  → Render
```

### 2.2 Stati di un riferimento

| Stato | Significato | Comportamento |
|---|---|---|
| `valid` | Il target esiste ed è compatibile | Esecuzione normale |
| `stale` | Il target esiste ma è cambiato | Chiede conferma o aggiorna |
| `orphan` | Il target non esiste più | Quarantena |
| `invalid` | Il target esiste ma è incompatibile | Disabilita e spiega |
| `ambiguous` | Più target corrispondono | Blocca e chiede scelta |
| `missing-dependency` | Dipende da asset/effetto assente | Placeholder + warning |

---

## 3. Soluzione: Reference Integrity Layer

Aggiungi un modulo prima del rendering:

```ts
type ResolutionResult<T> =
  | { status: "ok"; value: T }
  | { status: "orphan"; reason: string }
  | { status: "invalid"; reason: string }
  | { status: "ambiguous"; candidates: string[] };
```

```ts
function resolveAudioBinding(
  binding: AudioBinding,
  project: Project
): ResolutionResult<ResolvedBinding> {
  const layer = project.layers.find(
    layer => layer.id === binding.target.layerId
  );

  if (!layer) {
    return {
      status: "orphan",
      reason: `Layer "${binding.target.layerId}" no longer exists`
    };
  }

  const effect = binding.target.effectId
    ? layer.effects.find(effect => effect.id === binding.target.effectId)
    : null;

  if (binding.target.effectId && !effect) {
    return {
      status: "orphan",
      reason: `Effect "${binding.target.effectId}" no longer exists`
    };
  }

  const paramExists = effect
    ? effect.params.hasOwnProperty(binding.target.paramKey)
    : hasLayerParam(layer, binding.target.paramKey);

  if (!paramExists) {
    return {
      status: "invalid",
      reason: `Parameter "${binding.target.paramKey}" is not available`
    };
  }

  return {
    status: "ok",
    value: {
      binding,
      layer,
      effect,
      paramSchema: getParamSchema(binding.target.paramKey)
    }
  };
}
```

### 3.1 Comportamento

| Risultato | Azione |
|---|---|
| `ok` | Binding attivo |
| `orphan` | Binding messo in quarantine |
| `invalid` | Binding disabilitato, motivo mostrato |
| `ambiguous` | UI chiede all’utente di scegliere |
| `missing-dependency` | Rendering con placeholder |

---

## 4. Scenario 1 — Layer rimosso con binding attivo

### 4.1 Problema

```text
AudioBinding → Layer rimosso
```

### 4.2 Comportamento logico

Quando l’utente elimina un layer:

1. Trova tutti i binding che puntano a quel layer.
2. Non eliminarli automaticamente senza informazione.
3. Spostali in `quarantinedBindings`.
4. Mantieni la configurazione per permettere undo.
5. Aggiorna la UI.

```ts
function removeLayer(project, layerId) {
  const affectedBindings = project.audio.bindings.filter(
    binding => binding.target.layerId === layerId
  );

  return {
    ...project,
    layers: project.layers.filter(layer => layer.id !== layerId),
    audio: {
      ...project.audio,
      bindings: project.audio.bindings.filter(
        binding => binding.target.layerId !== layerId
      ),
      quarantinedBindings: [
        ...project.audio.quarantinedBindings,
        ...affectedBindings.map(binding => ({
          ...binding,
          status: "orphan",
          orphanReason: "Layer removed"
        }))
      ]
    }
  };
}
```

### 4.3 Comportamento UI

Mostra un avviso non bloccante:

```text
2 audio bindings were linked to “Video Layer 01”.

They have been paused, not deleted.

[Restore layer] [Delete bindings] [Review]
```

### 4.4 Perché non eliminare subito

Se elimini subito i binding:

- L’utente perde configurazioni complesse.
- `Undo` diventa difficile.
- Un click accidentale può distruggere lavoro.
- L’utente non capisce cosa è successo.

La UI deve distinguere tra:

- **Rimozione**: azione voluta.
- **Quarantena**: protezione reversibile.
- **Eliminazione**: decisione esplicita.

### 4.5 Derivazioni dello stesso problema

| Scenario | Causa | Soluzione |
|---|---|---|
| Layer duplicato | Il binding punta al layer originale, non alla copia | Chiedi se duplicare anche i binding |
| Layer raggruppato | Il target cambia contesto | Risolvi il path gerarchico |
| Layer rinominato | L’ID resta valido | Nessun problema, aggiorna solo label |
| Layer spostato in gruppo | Il path cambia ma l’ID no | Mantieni ID come chiave primaria |
| Layer eliminato con undo | Binding in quarantine | Ripristina automaticamente |

---

## 5. Scenario 2 — Effetto rimosso ma binding rimane

### 5.1 Problema

```text
AudioBinding → Re-light effect → Parametro "intensity"
Effetto Re-light rimosso
```

Il layer esiste ancora, ma il target specifico no.

### 5.2 Comportamento logico

```ts
if (!layer.effects.some(effect => effect.id === binding.target.effectId)) {
  quarantineBinding(binding, "Effect removed");
}
```

### 5.3 UI

```text
Audio binding paused

“Bass → Re-light → Intensity” is unavailable because Re-light was removed.

[Reassign effect] [Delete binding] [Keep paused]
```

### 5.4 Regola

Un binding non deve mai puntare a una stringa generica come `"effect.intensity"`.

Deve puntare a:

```ts
{
  layerId: "layer_01",
  effectId: "effect_relight_01",
  paramKey: "intensity"
}
```

Così il sistema può capire esattamente cosa è rotto.

### 5.5 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Effetto disattivato | Il binding resta tecnicamente valido | Binding in standby |
| Effetto duplicato | Due target possibili | Chiedi quale copia usare |
| Effetto sostituito | Parametro simile ma ID diverso | Suggerisci mapping compatibile |
| Effetto reset | Parametro torna al default | Il binding continua a modulare |
| Effetto con parametro rinominato | `intensity` → `strength` | Migration + suggerimento |

---

## 6. Scenario 3 — Parametro non modulabile

### 6.1 Problema

Un binding prova a modulare:

```ts
target.paramKey = "blendMode"
```

Ma `blendMode` è una stringa, non un valore numerico continuo.

### 6.2 Comportamento logico

Ogni parametro dichiara se è audio-modulatable:

```ts
{
  key: "blendMode",
  type: "select",
  audioModulatable: false
}
```

Se un binding punta a un parametro non modulabile:

```ts
return {
  status: "invalid",
  reason: "Blend mode cannot be modulated continuously"
};
```

### 6.3 UI

```text
This parameter cannot be driven by audio.

“Blend mode” accepts discrete values only.

[Choose another parameter] [Remove binding]
```

### 6.4 Soluzione avanzata

Alcuni parametri discreti possono essere modulati tramite **step mapping**:

```ts
type DiscreteAudioMapping = {
  steps: {
    threshold: number;
    value: string | number;
  }[];
};
```

Esempio:

```text
bass < 0.3 → normal
bass 0.3–0.7 → screen
bass > 0.7 → overlay
```

Ma questo è un tipo di binding diverso:

```ts
type AudioBindingMode = "continuous" | "discrete" | "trigger";
```

### 6.5 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Colore modulato | Colore è multidimensionale | Usa `colorShift`, `hue`, `brightness` |
| Booleano modulato | On/off non è continuo | Usa trigger con soglia |
| Testo modulato | Non è numerico | Usa opacità, scala o reveal |
| Blend mode modulato | Discreto | Usa step mapping |
| Font modulato | Discreto | Non consentito |

---

## 7. Scenario 4 — Asset audio mancante

### 7.1 Problema

Il progetto contiene:

```json
{
  "sourceId": "audio_01",
  "url": "blob:http://localhost/abc"
}
```

Dopo il reload, il blob URL non esiste più.

### 7.2 Comportamento logico

```ts
if (source.status === "missing") {
  audioEngine.stop();
  audioAnalysis.emitSilentFrame();
}
```

Il rendering non si ferma:

```ts
const audioFrame = audioSource.isReady()
  ? analyzeAudio(audioSource)
  : createSilentAudioFrame();
```

### 7.3 UI

```text
Audio source unavailable

“afrobeat.mp3” could not be found.

The project will continue without audio modulation.

[Relink file] [Remove source] [Continue]
```

### 7.4 Regola

Un asset mancante è un **problema di risorsa**, non un errore di stato.

Quindi:

- Il progetto resta aperto.
- I layer restano modificabili.
- I binding restano configurabili.
- Il rendering usa un frame neutro.
- L’utente può ricollegare il file.

### 7.5 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Video mancante | Layer vuoto | Placeholder animato |
| Immagine mancante | Layer vuoto | Placeholder statico |
| Font mancante | Testo diverso | Fallback font |
| Effetto plugin mancante | Effetto assente | Layer renderizzato senza effetto |
| URL scaduto | Asset non scaricabile | Richiedi re-auth o re-link |

---

## 8. Scenario 5 — Loop di feedback audio

### 8.1 Problema

Un binding modula l’audio in base all’audio stesso:

```text
Audio → Bass → Effect → Visual → Audio Analysis → Bass
```

Se il visual influisce sull’audio, oppure se l’analisi legge il proprio output, si crea un feedback loop.

### 8.2 Comportamento logico

Separa rigorosamente:

```text
Audio Input Graph
  → Analysis
  → Bindings
  → Render Graph
```

Il rendering non può mai scrivere nel graph di analisi.

```ts
audioAnalysisFrame = analyzeAudio(inputSource);
renderFrame = renderScene(project, audioAnalysisFrame);
```

Mai:

```ts
renderFrame = renderScene(project, analyzeAudio(renderFrame));
```

### 8.3 UI

Se viene rilevato un loop:

```text
Audio feedback loop detected

A visual output is feeding the audio analysis input.

Audio modulation has been paused.

[Use original audio source] [Disconnect input] [Review]
```

### 8.4 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Mic + speaker | Feedback acustico | Mute monitor |
| Screen capture audio | Loop di sistema | Isola sorgente |
| Effetto audio generativo | Output diventa input | DAG validation |
| Binding circolare | A modula B, B modula A | Rifiuta o risolve per ordine |
| Latenza elevata | Desync | Buffer e clock separati |

---

## 9. Scenario 6 — Performance collapse

### 9.1 Problema

L’utente crea:

- 20 layer video
- 40 effetti
- 120 audio binding
- Analisi FFT a 60fps
- Export a 4K

Il rendering scende sotto il tempo di frame.

### 9.2 Comportamento logico

Il sistema deve degradare in modo controllato:

```text
Full quality
  → Reduced preview quality
  → Skip non-visible effects
  → Reduce audio analysis rate
  → Pause heavy effects
  → Show performance warning
```

### 9.3 Budget per frame

```ts
type PerformanceBudget = {
  targetFrameTime: number; // ms
  maxRenderTime: number;
  maxAudioAnalysisTime: number;
  maxActiveEffects: number;
};
```

Esempio a 60fps:

```ts
{
  targetFrameTime: 16.6,
  maxRenderTime: 12,
  maxAudioAnalysisTime: 2,
  maxActiveEffects: 24
}
```

### 9.4 UI

```text
Performance is limited

Preview quality reduced to maintain realtime playback.

[Reduce effects] [Lower resolution] [Continue anyway]
```

### 9.5 Regola

La UI non deve nascondere il degrado.

L’utente deve sapere:

- Cosa è stato ridotto.
- Perché.
- Come tornare alla qualità piena.

### 9.6 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Troppi layer | Overdraw | Culling, cache, downscale |
| Blur pesante | Costo GPU | Riduci radius in preview |
| FFT ad alta risoluzione | CPU overload | Riduci sample rate analisi |
| Export 4K | Frame drop | Render offline |
| Molti binding | Calcoli ripetuti | Cache feature per frame |
| Canvas enorme | Memoria GPU | Tiling o resolution scale |

---

## 10. Scenario 7 — Stato salvato incompatibile

### 10.1 Problema

Un progetto salvato con schema `v1` contiene:

```json
{
  "effect": "thermal",
  "params": {
    "strength": 0.8
  }
}
```

La versione attuale usa:

```json
{
  "effect": "thermal",
  "params": {
    "intensity": 0.8
  }
}
```

### 10.2 Comportamento logico

```ts
const migrations = {
  1: state => ({
    ...state,
    layers: state.layers.map(layer => ({
      ...layer,
      effects: layer.effects.map(effect =>
        effect.type === "thermal"
          ? renameParam(effect, "strength", "intensity")
          : effect
      )
    }))
  })
};
```

### 10.3 UI

```text
Project updated

This project was created with an older version.

“Thermal → strength” has been renamed to “intensity”.

[Review changes] [Continue]
```

### 10.4 Regola

Mai cancellare silenziosamente dati.

Se un parametro non ha equivalente:

1. Conservalo in `legacyParams`.
2. Disabilita l’effetto o usa default.
3. Mostra all’utente cosa è cambiato.

### 10.5 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Parametro rimosso | Valore perso | Archivio in `legacyParams` |
| Parametro diviso | Uno diventa due | Migration esplicita |
| Enum rinominato | Valore non valido | Mapping |
| Layer type cambiato | Compatibilità | Conversione |
| Schema futuro | Progetto più nuovo | Blocco con messaggio chiaro |

---

## 11. Scenario 8 — Conflitto di stato concorrente

### 11.1 Problema

Due contesti modificano lo stesso progetto:

```text
Utente A: cambia opacity del layer 1
Utente B: elimina layer 1
```

Oppure:

```text
Tab 1: modifica binding
Tab 2: salva progetto
```

### 11.2 Comportamento logico

Usa operazioni idempotenti e risoluzione per conflict:

```ts
type Operation = {
  id: string;
  entityId: string;
  type: string;
  version: number;
  payload: unknown;
};
```

Se due operazioni toccano la stessa entità:

| Caso | Soluzione |
|---|---|
| Campi diversi | Merge automatico |
| Stesso campo | Last-write-wins oppure conflict UI |
| Delete + update | Delete vince, update va in conflict log |
| Move + update | Merge se possibile |
| Circular dependency | Blocca e chiede decisione |

### 11.3 UI

```text
Conflict detected

“Video Layer 01” was deleted while its opacity was being changed.

Keep deleted layer
Restore layer with new opacity
```

### 11.4 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Doppio salvataggio | Sovrascrittura | Versioning |
| Undo concorrente | Stato incoerente | Command log condiviso |
| Asset duplicato | Due ID per stesso file | Deduplicazione per checksum |
| Binding duplicato | Doppia modulazione | Dedup per target |
| Rename concorrente | Conflitto label | Merge non bloccante |

---

## 12. Scenario 9 — Binding eccessivo sullo stesso parametro

### 12.1 Problema

Tre binding modulano lo stesso parametro:

```text
bass → scale
rms → scale
beat → scale
```

Quale vince?

### 12.2 Comportamento logico

Definisci una strategia esplicita:

```ts
type BindingCombinationStrategy =
  | "first-wins"
  | "last-wins"
  | "sum"
  | "average"
  | "max"
  | "multiply";
```

Default consigliato:

```ts
strategy: "sum"
```

Con clamp finale:

```ts
finalValue = clamp(sumOfContributions, paramMin, paramMax);
```

### 12.3 UI

```text
3 audio bindings affect “Scale”.

Combined mode: Additive

[Review bindings] [Change strategy] [Mute one binding]
```

### 12.4 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Binding contrastanti | Valore instabile | Priorità o media |
| Binding identici | Doppio effetto | Dedup warning |
| Range incompatibili | Valore fuori range | Clamp |
| Feedback percettibile | Movimento nervoso | Smoothing |
| Troppi binding | Confusione | Raggruppamento UI |

---

## 13. Scenario 10 — UI mostra uno stato diverso dal rendering

### 13.1 Problema

Lo slider mostra:

```text
Opacity: 80%
```

Ma il rendering usa:

```text
Opacity: 100%
```

perché un binding audio sta sovrascrivendo il valore.

### 13.2 Comportamento logico

Distingui sempre:

```ts
type ParameterState = {
  baseValue: number;
  effectiveValue: number;
  isModulated: boolean;
  contributors: AudioBinding[];
};
```

### 13.3 UI

```text
Opacity
[========----] 80%

Audio override active: 100%
Source: RMS
[Disable modulation]
```

### 13.4 Regola

La UI deve mostrare:

- Valore base impostato dall’utente
- Valore effettivo dopo audio
- Numero di binding attivi
- Fonte della modulazione
- Azione per disattivare temporaneamente

### 13.5 Derivazioni

| Scenario | Problema | Soluzione |
|---|---|---|
| Slider che “si muove da solo” | Audio binding attivo | Indicatore live |
| Effetto che sembra non funzionare | Binding override | Mostra effective value |
| Export diverso dal preview | Stato non deterministico | Snapshot state |
| Colore diverso dal previsto | Hue shift audio | Badge modulation |
| Layer invisibile | Opacità a zero da binding | Diagnostica |

---

## 14. Matrice finale dei guasti

| Guasto | Rilevamento | Comportamento | UI | Recupero |
|---|---|---|---|---|
| Layer orfano | Reference resolution | Quarantena binding | Warning non bloccante | Undo / reassign |
| Effetto orfano | Reference resolution | Quarantena binding | Warning + reassign | Reassign / delete |
| Parametro invalido | Schema check | Disabilita binding | Messaggio specifico | Cambia target |
| Asset missing | Loader status | Silent audio / placeholder | Relink CTA | Re-upload |
| Audio loop | DAG validation | Pausa modulazione | Alert | Disconnect source |
| Performance drop | Frame timing | Quality scaling | Performance banner | Riduci carico |
| Schema outdated | Version check | Migration | Change log | Review |
| Schema future | Version check | Blocco sicuro | Messaggio chiaro | Aggiorna app |
| Concurrent edit | Operation version | Conflict resolution | Conflict dialog | Merge / choose |
| Multi-binding conflict | Binding resolver | Strategy + clamp | Binding inspector | Cambia strategia |
| UI/render mismatch | Effective value | Espone stato reale | Badge modulation | Disable binding |
| Export failure | Job status | Retry / diagnostics | Toast + log | Retry |
| Renderer crash | Error boundary | Fallback layer | Safe mode | Disable effect |

---

## 15. Regole operative finali

1. **Ogni riferimento viene risolto prima dell’uso.**
2. **Ogni rimozione genera quarantine, non perdita silenziosa.**
3. **Ogni parametro dichiara se è modulabile.**
4. **Ogni binding dichiara strategia, range e fallback.**
5. **L’audio analysis è separata dal render graph.**
6. **Il rendering degrada, non collassa.**
7. **Ogni stato UI mostra base value ed effective value.**
8. **Ogni migration preserva i dati legacy.**
9. **Ogni conflitto è esplicito o risolto con regole deterministiche.**
10. **Ogni errore produce una spiegazione e un’azione di recupero.**

## 16. Flusso operativo completo

### 16.1 Ciclo di vita di una modifica

Ogni interazione utente segue lo stesso percorso:

```text
User intent
  → UI action
  → Command
  → State patch
  → Validation
  → Reference resolution
  → Dependency check
  → Renderer invalidation
  → Preview update
  → Persistence queue
```

### 16.2 Esempio: modifica opacità

```text
Utente sposta slider “Opacity”
  → UI emette UPDATE_LAYER_PARAM
  → State aggiorna layer.appearance.opacity
  → Validator verifica range 0–1
  → Resolver controlla audio binding
  → Renderer invalida il layer
  → Preview aggiorna il frame
  → Persistence salva con debounce
```

### 16.3 Esempio: rimozione effetto

```text
Utente elimina “Thermal”
  → UI chiede conferma se ha binding
  → Command REMOVE_EFFECT
  → State rimuove effect instance
  → Resolver trova binding orfani
  → Binding entrano in quarantine
  → Renderer invalida layer
  → UI mostra avviso
  → Undo mantiene entrambe le azioni
```

### 16.4 Esempio: caricamento progetto

```text
Open project
  → Read project JSON
  → Check schemaVersion
  → Run migrations
  → Validate entities
  → Resolve source references
  → Resolve effect references
  → Resolve audio bindings
  → Load or relink assets
  → Build render graph
  → Start preview
```

---

## 17. Macchina a stati del progetto

### 17.1 Stati globali

```ts
type ProjectRuntimeStatus =
  | "empty"
  | "loading"
  | "ready"
  | "editing"
  | "playing"
  | "paused"
  | "saving"
  | "saving-error"
  | "exporting"
  | "export-error"
  | "degraded"
  | "corrupted";
```

### 17.2 Transizioni

```text
empty → loading → ready → editing
editing → playing → paused
editing → saving → editing
saving → saving-error → editing
editing → exporting → editing
exporting → export-error → editing
ready → degraded → editing
any → corrupted → recovery
```

### 17.3 Regole

- `editing` è lo stato principale.
- `playing` non impedisce modifiche, ma può ridurre la qualità.
- `saving` non blocca l’editing.
- `exporting` può bloccare modifiche strutturali, non quelle visive.
- `corrupted` richiede recovery esplicito.

---

## 18. Macchina a stati del layer

```ts
type LayerRuntimeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "rendering"
  | "paused"
  | "missing-source"
  | "missing-effect"
  | "invalid"
  | "quarantined";
```

### 18.1 Matrice di comportamento

| Stato | Rendering | Editing | Audio binding | UI |
|---|---|---|---|---|
| `idle` | No | Sì | No | Layer presente |
| `loading` | Placeholder | Sì | Standby | Spinner |
| `ready` | Sì | Sì | Sì | Normale |
| `rendering` | Sì | Sì | Sì | Normale |
| `paused` | No | Sì | Standby | Icona pausa |
| `missing-source` | Placeholder | Sì | Quarantena | Warning |
| `missing-effect` | Senza effetto | Sì | Quarantena parziale | Warning |
| `invalid` | No | Sì | Disabilitato | Errore |
| `quarantined` | No | Sì | Quarantena | Badge |

---

## 19. Sistema di diagnostica

### 19.1 Diagnostics Panel

Ogni progetto deve avere un pannello diagnostico accessibile ma non invadente.

```text
Diagnostics
├── Project health
├── Sources
├── Layers
├── Effects
├── Audio bindings
├── Performance
└── Compatibility
```

### 19.2 Project health

```ts
type HealthLevel = "healthy" | "warning" | "degraded" | "critical";

type HealthReport = {
  level: HealthLevel;
  issues: DiagnosticIssue[];
  summary: string;
};
```

| Level | Significato | UI |
|---|---|---|
| `healthy` | Nessun problema | Nessun badge o badge verde |
| `warning` | Possibile problema non bloccante | Badge giallo |
| `degraded` | Qualità o funzionalità ridotte | Badge arancione |
| `critical` | Rendering o salvataggio compromessi | Badge rosso |

### 19.3 Diagnostic issue

```ts
type DiagnosticIssue = {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  code: string;
  title: string;
  description: string;
  affectedEntities: string[];
  suggestedActions: DiagnosticAction[];
  autoFixable: boolean;
};
```

### 19.4 Esempio

```json
{
  "id": "issue_audio_orphan_01",
  "severity": "warning",
  "code": "AUDIO_BINDING_ORPHAN",
  "title": "Audio binding points to a removed layer",
  "description": "The binding “Bass → Scale” targets “Video Layer 01”, which no longer exists.",
  "affectedEntities": [
    "binding_01",
    "layer_video_01"
  ],
  "suggestedActions": [
    {
      "action": "restore-layer",
      "label": "Restore layer"
    },
    {
      "action": "reassign-binding",
      "label": "Reassign binding"
    },
    {
      "action": "delete-binding",
      "label": "Delete binding"
    }
  ],
  "autoFixable": false
}
```

---

## 20. Sistema di notifiche

### 20.1 Tipi di notifica

| Tipo | Comportamento | Esempio |
|---|---|---|
| **Toast** | Breve, auto-dismiss | “Project saved” |
| **Inline warning** | Persistente nel contesto | “Audio source missing” |
| **Banner** | Stato globale | “Performance reduced” |
| **Modal** | Bloccante solo se necessario | “Project schema is newer” |
| **Diagnostic entry** | Consultabile | Elenco errori e warning |
| **Badge** | Indicatore permanente | “2 paused bindings” |

### 20.2 Regole

- Nessun crash per un problema non critico.
- Nessun modal per problemi risolvibili in background.
- Ogni notifica deve avere un’azione.
- Ogni notifica deve essere consultabile dopo essere scomparsa.
- Le notifiche non devono coprire il canvas per più di pochi secondi.

---

## 21. Sistema di quarantena

### 21.1 Entità quarantinabili

- Audio binding
- Effect instance
- Source reference
- Layer
- Preset
- Export job
- Migration result

### 21.2 Struttura

```ts
type QuarantineEntry = {
  id: string;
  entityType: "binding" | "effect" | "source" | "layer";
  entityId: string;
  reason: string;
  code: string;
  createdAt: string;
  originalState: unknown;
  restorePossible: boolean;
};
```

### 21.3 Comportamento

```text
Entity becomes invalid
  → Remove from active execution
  → Preserve original configuration
  → Add quarantine entry
  → Notify user
  → Offer restore / repair / delete
```

### 21.4 UI

```text
Quarantined items (3)

Audio binding — Bass → Scale
Reason: Layer removed
[Restore] [Reassign] [Delete]

Effect — Thermal
Reason: Missing plugin
[Install plugin] [Remove] [Keep paused]
```

---

## 22. Sistema di riparazione automatica

### 22.1 Auto-fix sicuri

| Problema | Auto-fix consentito |
|---|---|
| Parametro fuori range | Clamp |
| Parametro mancante | Default |
| Binding duplicato | Dedup |
| Layer non visibile con binding | Nessuna azione automatica |
| Asset missing | Nessuna azione automatica |
| Effetto non registrato | Disabilitazione temporanea |
| Schema vecchio | Migration |
| Valore NaN | Reset a default |

### 22.2 Auto-fix vietati

- Eliminare layer.
- Eliminare binding.
- Eliminare effetti.
- Modificare asset.
- Cambiare blend mode.
- Sovrascrivere valori utente senza conferma.

### 22.3 Logica

```ts
function attemptAutoRepair(issue: DiagnosticIssue, project: Project) {
  if (!issue.autoFixable) {
    return { repaired: false, requiresUserAction: true };
  }

  switch (issue.code) {
    case "PARAM_OUT_OF_RANGE":
      return clampAffectedParams(project, issue.affectedEntities);

    case "PARAM_MISSING":
      return applyDefaults(project, issue.affectedEntities);

    case "BINDING_DUPLICATED":
      return deduplicateBindings(project, issue.affectedEntities);

    case "SCHEMA_OUTDATED":
      return runMigrations(project);

    default:
      return { repaired: false, requiresUserAction: true };
  }
}
```

---

## 23. Sistema di preview e determinismo

### 23.1 Problema

Il preview può differire dall’export se:

- L’audio non è disponibile durante l’export.
- Gli effetti usano random non seedato.
- Il canvas usa risoluzione diversa.
- Il tempo è calcolato in modo non deterministico.
- Un binding usa dati live non riproducibili.

### 23.2 Soluzione: Render Context

```ts
type RenderContext = {
  projectId: string;
  frame: number;
  time: number;
  width: number;
  height: number;
  quality: "preview" | "final";
  audio: AudioAnalysisFrame;
  randomSeed: number;
  locale: string;
  colorSpace: string;
};
```

### 23.3 Regole

- Ogni effetto riceve `randomSeed`.
- Ogni effetto usa `time` dal context, non `Date.now()`.
- Ogni effetto usa le dimensioni dal context.
- Il preview e l’export condividono lo stesso project state.
- L’export può usare audio pre-analizzato oppure render offline.

### 23.4 Audio deterministico

Per l’export:

```text
Audio file
  → Offline analysis
  → AudioAnalysisTimeline
  → Frame-by-frame lookup
  → Deterministic render
```

```ts
type AudioAnalysisTimeline = {
  fps: number;
  frames: AudioAnalysisFrame[];
};
```

---

## 24. Sistema di quality scaling

### 24.1 Livelli

| Livello | Canvas | Effects | Audio analysis | Uso |
|---|---:|---|---|---|
| `ultra` | 100% | Tutti | 60fps | Export / GPU potente |
| `high` | 100% | Tutti | 60fps | Desktop normale |
| `medium` | 75% | Effetti pesanti ridotti | 30fps | Preview |
| `low` | 50% | Effetti semplificati | 20fps | Molte layer |
| `safe` | 25% | Solo appearance | 10fps | Recovery |

### 24.2 Regole di degrado

```text
frame time > budget
  → reduce effect quality
  → reduce canvas scale
  → reduce audio analysis rate
  → disable expensive effects
  → notify user
```

### 24.3 Ordine di riduzione

1. Riduci qualità effetti non essenziali.
2. Riduci risoluzione preview.
3. Riduci frequenza analisi audio.
4. Disattiva effetti pesanti.
5. Metti in pausa layer non visibili.
6. Mostra safe mode.

---

## 25. Sistema di permessi e capacità

### 25.1 Capability model

```ts
type Capability =
  | "create-project"
  | "save-project"
  | "export-video"
  | "use-camera"
  | "use-microphone"
  | "use-cloud-assets"
  | "use-premium-effects"
  | "collaborate";
```

### 25.2 Verifica

```ts
type CapabilityCheck = {
  capability: Capability;
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
};
```

### 25.3 UI

Se una funzione non è disponibile:

```text
Export in 4K requires a Pro plan.

[Upgrade] [Export in 1080p] [Cancel]
```

### 25.4 Regola

La UI non deve nascondere funzionalità senza spiegazione.

Ogni limite deve mostrare:

- Cosa non è possibile
- Perché
- Cosa è possibile fare ora
- Eventuale upgrade

---

## 26. Sistema di preset

### 26.1 Preset

```ts
type Preset = {
  id: string;
  name: string;
  description: string;
  applicableTo: LayerType[];
  effectStack: EffectInstance[];
  audioBindings: AudioBinding[];
  compatibility: {
    minSchemaVersion: number;
    maxSchemaVersion: number;
  };
};
```

### 26.2 Applicazione

```text
Apply preset
  → Check compatibility
  → Check missing effects
  → Check missing assets
  → Create effect instances
  → Create bindings
  → Resolve conflicts
  → Show summary
```

### 26.3 UI

```text
Apply preset “Bass Reactive Glow”?

This will add:
- 1 Re-light effect
- 2 audio bindings
- 1 color adjustment

Existing effects will not be removed.

[Apply] [Cancel]
```

### 26.4 Regola

Un preset non deve mai:

- Cancellare il lavoro esistente.
- Sovrascrivere binding attivi.
- Modificare impostazioni globali senza consenso.
- Dipendere da asset non dichiarati.

---

## 27. Sistema di export

### 27.1 Stati

```ts
type ExportStatus =
  | "draft"
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "completed"
  | "failed"
  | "cancelled";
```

### 27.2 Job

```ts
type ExportJob = {
  id: string;
  projectId: string;
  format: "mp4" | "webm" | "gif" | "png-sequence";
  resolution: { width: number; height: number };
  frameRate: number;
  duration: number;
  audioIncluded: boolean;
  status: ExportStatus;
  progress: number;
  error?: ExportError;
};
```

### 27.3 Fallimenti

| Errore | Comportamento | UI |
|---|---|---|
| Asset missing | Blocca export | “Relink assets” |
| Codec unavailable | Suggerisci formato | “Use WebM” |
| Memory limit | Riduci risoluzione | “Try 1080p” |
| Timeout | Resume o retry | “Resume export” |
| Audio missing | Export senza audio | “Continue without audio” |
| Cancel | Cleanup | “Export cancelled” |

### 27.4 UI

```text
Exporting project

Rendering frame 240 / 900
[████████░░░░░░░░] 27%

Estimated time: 1m 12s

[Pause] [Cancel]
```

---

## 28. Contratti di integrazione futura

### 28.1 Plugin contract

```ts
type PluginManifest = {
  id: string;
  name: string;
  version: string;
  permissions: Capability[];
  contributes: {
    effects?: EffectDefinition[];
    sources?: SourceAdapter[];
    audioModulators?: AudioModulator[];
    exporters?: OutputAdapter[];
    panels?: PanelDefinition[];
  };
};
```

### 28.2 Sandbox

Un plugin non può:

- Accedere direttamente al DOM globale.
- Modificare lo stato senza command.
- Leggere file non autorizzati.
- Avviare network request non dichiarate.
- Interrompere il render loop.

### 28.3 Registry

```ts
type Registry = {
  effects: Map<string, EffectDefinition>;
  sources: Map<string, SourceAdapter>;
  audioModulators: Map<string, AudioModulator>;
  exporters: Map<string, OutputAdapter>;
  panels: Map<string, PanelDefinition>;
};
```

---

## 29. Test obbligatori

### 29.1 Unit test

- Validazione parametri
- Clamp e normalizzazione
- Mapping audio
- Smoothing attack/release
- Blend mode
- Migration
- Reference resolution

### 29.2 Integration test

- Add layer → add effect → add binding → remove layer
- Load project with missing asset
- Load project with old schema
- Export with missing audio
- Apply preset with missing effect
- Duplicate layer with bindings
- Undo after quarantine

### 29.3 Stress test

- 50 layer
- 100 effetti
- 200 binding
- 4K export
- Audio 60fps
- Tab multipla
- Rete lenta
- Asset rimossi durante playback

### 29.4 Criterio di passaggio

```text
Nessun crash
Nessuna perdita silenziosa di dati
Nessun binding orfano attivo
Nessun mismatch UI/render
Nessun blocco del canvas per errori non critici
```

---

## 30. Definition of Done

Una funzione è completa solo se:

1. Ha uno stato serializzabile.
2. Ha validazione input/output.
3. Ha gestione errori esplicita.
4. Ha fallback sicuro.
5. Ha UI di stato.
6. Ha azione di recupero.
7. È compatibile con undo/redo.
8. È compatibile con migration.
9. È testabile in isolamento.
10. Non blocca il rendering in caso di fallimento.
11. Non crea riferimenti orfani.
12. Non modifica lo stato senza command.
13. Non dipende da dettagli interni di altri moduli.
14. Può essere disabilitata senza rompere il progetto.
15. È documentata con casi limite.