# Piano — eliminazione del lag sugli effetti WebGL (hero + focus callout)

Stato: ** Fase 0 eseguita, callout risolto, caricamento riscritto.** Le ipotesi
sotto sono state verificate e due erano sbagliate; vedi §0. Il resto del documento
descrive il ragionamento e resta valido come storia, ma dove un numero è stato
misurato il numero misurato vince.

File di riferimento dell'analisi precedente: `istruction_AI/lag-roblem.txt`.

---

## 0. Risultati misurati ( Fase 0 + correzioni)

### 0.1 Il bug del callout: confermato, corretto, verificato

La firma di rilevamento sottraeva un `span.getBoundingClientRect()` letto nel frame
corrente da un `containerRect` catturato in un `draw()` precedente. Misurato in
`tests/components/FocusCalloutShader.maskScroll.test.jsx`:

| scenario | prima | dopo |
|---|---|---|
| encode durante 30 frame di scroll continuo | 20 | **0** |
| encode per salto di scroll | 2 | **0** |
| letture di layout a ingresso fermo, 30 frame | 120 (4 righe × ogni frame, per sempre) | **0** |

Il loop `requestAnimationFrame` che girava per tutta la sessione è stato eliminato;
l'ingresso ora ricostruisce la maschera dai tick della timeline GSAP, e un
`ResizeObserver` sostituisce il polling per i cambi di layout. Verificato anche su
browser reale: `toBlob=0` durante lo scroll.

### 0.2 L'ipotesi "l'hero è il problema" era SBAGLIATA

Il piano presumeva che l'hero fosse la superficie costosa. La misura lo smentisce:
a 2560×1440 DPR 2 il backbuffer più grande del sito era `text-entry` a **14.75 Mpx**,
e non l'hero. Applicato il budget di `src/utils/renderScale.js`:
**14.75 → 9.6 Mpx** (4131×2323).

Rilevato anche che il **preloader stesso** chiedeva 5120×2880 = 14.75 Mpx: la
schermata di caricamento era il renderer più grande del sito mentre il sito era
ancora in caricamento. Ora tettato dalla stessa policy.

Il tetto è in `src/utils/renderScale.js` ed è applicato a `text-entry` e al preload.
Per gli `shaders` serve una leva diversa (`transform: scale()` sul box CSS, perché la
libreria non espone prop di risoluzione): l'hook che la implementava è stato
**scritto, testato e poi rimosso** perché nessun consumatore — spedire un'astrazione
senza uso è debito, non inventario. Se la misura lo richiederà, va riscritto: ~25
righe, e la funzione pura `fitScale` è già a posto e testata.

### 0.3 Il vero collo di bottiglia era il caricamento degli script

Il bundle `shaders` non è tree-shakeable: dichiara `sideEffects: false` ma le
~180 definizioni shader restano codice vivo (`PB({name:'Boids'...})` verificato
nel chunk), e `package.json` espone solo `./react`, nessun subpath per componente.
 Viveva nell'entry chunk, quindi blocccava il primo paint.

| | prima | dopo |
|---|---|---|
| FCP | 2380 ms | **264 ms** |
| DOMContentLoaded | 2287 ms | **206 ms** |
| load | 8437 ms | **1884 ms** |
| entry chunk | 3.31 MB (972 KB gz) | **980 KB (280 KB gz)** |
| chunk `shaders` | dentro l'entry | 2.47 MB (689 KB gz), differito |

### 0.4 Il preload non era un loading screen

L'animazione era una coreografia a tempo fisso (counter 000→100 in 2400 ms) e solo
*dopo* attendeva `appReady` con una cap di 1500 ms. Counter e realtà erano scollegati.

Ora: il counter è il progresso reale (Resource Timing) con un *creep* asintotico
che lo tiene in movimento senza mai toccare 100 prima che il caricamento sia
davvero finito; il tetto di attesa è 2200 ms; e `safeTick` garantisce che
un'eccezione non lasci mai il visitatore intrappolato.

Tre bug reali introdotti e risolti durante il rifacimento, documentati nei file:
- `whenSettled()` risolveva su array vuoto (race con `registerLoad`) → preload istantaneo;
- `App` chiamava `window.__preloader.appReady()` che poteva non esistere ancora → preload bloccato;
- il ramo `seal` testava `sealStart !== now`, vero per sempre → sito mai rivelato.

### 0.5 Una corsia aggiuntiva, verificata

`FocusCalloutShader` è `React.lazy` e la timeline dell'ingresso nasce al mount:
non è garantito che i due siano in passo. Il visitatore può scorrere dentro il
callout mentre il chunk da 2.4 MB è ancora in volo, e l'ingresso continua a
tichettare senza handle a cui consegnare la maschera. L'`?.()` lo copre, ma
"è coperto" è esattamente il tipo di affermazione che va testata: in questa
sessione tre bug di ordine sono rimasti invisibili finché qualcosa non è stato
eseguito. Coperto da
`tests/components/SelectedProjects.calloutEntrance.test.jsx` ("survives the
entrance starting before the shader chunk has resolved"). Quando il chunk arriva,
il componente disegna lo stato corrente del DOM al mount, quindi un arrivo tardivo
mostra la maschera assestata e non il vuoto.

### 0.6 Non verificato — e come sbloccarlo

Il probe headless usa `--enable-unsafe-swiftshader`: la console dice
`No available adapters`, quindi **WebGPU non esiste in quell'ambiente**. Conseguenze
oneste:

- hero e callout mostrano solo i fallback, mai lo shader reale;
- i tempi GPU assoluti di quei run non descrivono l'hardware dell'utente.

Restano due cose che **non** ho potuto misurare e che non vanno date per fatte:

1. **Hero e callout renderizzano davvero su una GPU reale?** Il percorso è verificato
   solo in jsdom con `shaders/react` mockato, e la struttura dei chunk è verificata
   (entrambi i chunk lazy importano lo stesso chunk `shaders`, entry a 980 KB).
2. **L'hero ha bisogno del render scale?** Non applicato di proposito. Per i
   `shaders` la leva sarebbe un `transform: scale()` sul box CSS (la libreria non
   espone prop di risoluzione, vedi §0.2), e senza WebGPU qui non posso vedere né
   allineamento né artefatti. Applicarlo alla cieca ammorbidirebbe l'hero senza
   sapere se il costo lo giustifica. Derivazione, non misura: la sezione è
   `105vh`, quindi ~1920×1134 CSS, ~8.7 Mpx a DPR 2 — stessa classe di costo di
   `text-entry` (14.75 Mpx, già tettata).

**Sblocco:** `tests/perf/verify-in-browser.js` espone `probeWebGL()` e
`probeAdapter()`, da incollare nella console del sito sul browser dell'utente. Sono
sole letture del DOM, nessuna chiamata WebGPU e nessuna modifica di stato. Restituisce
adapter disponibile, backbuffer per superficie (un `300x150` segnala un renderer mai
dimensionato, cioè non inizializzato), DPR effettivo, `--reveal` per riga del callout
e i tempi FCP/DOMContentLoaded/load.

Con quei numeri la decisione sull'hero è immediata: se il backbuffer dell'hero è
nell'ordine di 8–9 Mpx il tetto ha senso, se è già contenuto va lasciato stare.

---

## 1. Sintomo

Due superfici a viewport pieno soffrono di lag:

- **Hero** — `src/webgl-water/shader-hero.jsx` (via `src/components/SplitScreenHero.jsx`, re-export di 2 righe).
- **Focus callout** — `src/components/FocusCalloutShader.jsx` (622 righe), montato da `src/components/SelectedProjects.jsx:1409`.

Triade riportata dall'utente:

1. lag in entrambe;
2. scorrendo oltre, performance che recuper nettamente;
3. **rimpicciolendo la finestra del browser il lag sparisce**.

Il punto 3 è la pista più forte: un difetto che scala con l'area della finestra è un
difetto di **fill rate**, non di logica. Ma da solo non spiega il callout, che ha una
superficie piccola. Conclusioni: **sono due difetti distinti, non uno**.

---

## 2. Evidenze verificate sul sorgente del vendor (`shaders@3.2.467`, in `node_modules`)

Questi fatti sono letti nei file, non ipotizzati. Cambiano il piano precedente in più punti.

| # | Fatto | Fonte |
|---|---|---|
| V1 | `<Shader>` **non espone nessuna prop** di risoluzione / DPR / scala. Props reali: `children, disableTelemetry, colorSpace, toneMapping, isPreview, onReady, onUnavailable, style, className, ...rest`. `...rest` va sulla `<div>`, mai sul renderer. | `shaders/dist/react/Shader.js:7`, `:222-238` |
| V2 | Il canvas ha stile inline forzato `width:100%; height:100%` | `shaders/dist/react/Shader.js:229-236` |
| V3 | **Il vendor già sospende fuori viewport**: `IntersectionObserver({threshold:0})` → `startAnimation()` / `stopAnimation()`; in più `frameGate` in core. | `Shader.js:136-155`; `core/sdf3d-*.js` `frameGate` |
| V4 | DPR di default = `Math.min(devicePixelRatio, maxPixelRatioForDevice())`; `maxPixelRatioForDevice()` = **2** desktop, 1.5 viewport coarse ≤1366px. `bufferSize = round(currentW * pixelRatio) × round(currentH * pixelRatio)`. **Nessun budget di pixel.** | `core/index.js:2826-2829`, `:2269-2272`; `core/device-m0ud8-Fn.js:7-9` |
| V5 | `clampToTextureCap` limita **solo la singola dimensione** a `min(w, viewportW, floor(maxTextureDim/pr)-1)`. Un viewport 2560×1440 a DPR 2 → buffer **5120×2880 = 14.7 Mpx**, non viene ridotto. | `core/sdf3d-*.js` `clampToTextureCap` |
| V6 | I nodi multipli **sono** passaggi full-screen: il core compila una IR (`composeNodeTree`) + `createPassManager`, tiene `liveCompositions` con `passManager.resize(bufW,bufH)`, e i texture intermedi sono `kind === "rtt"`. | `core/index.js:2278-2300`, `:2850` |
| V7 | I knob esistono (`setResolutionScale`, `setFrameRateCap`, `setForceFullFrameRate`) ma **irraggiungibili da React**: il renderer nasce da una factory `shaderRendererGPU()` chiusa dentro `Shader.js`, `shaders/react` non la esporta, non c'è registry canvas→renderer. Chiamarla dal codice app crea un renderer separato e inutilizzato. | `core/index.js:1513`, `:3518-3529`, `:3494-3498`; `react/index.js` (nessun export) |
| V8 | Il renderer è **WebGPU-only**: `initialize({ context })` con contesto WebGL lancia. | `core/index.js:3253` |
| V9 | `ImageTexture` è **URL-only**: `url` è un uniform, non esiste sorgente `HTMLCanvasElement`. | `react/ImageTexture.js` (props: `url, objectFit, maskSource, maskType, boundingBox, transform, opacity, visible, blendMode, renderOrder, absolute, flow, id`) |
| V10 | I componenti `capturesDOM` (es. `DOMTexture`) portalizzano una canvas di cattura a `window.innerWidth × min(dpr,2)` → **peggio** del problema attuale. | `react/ImageTexture.js:57-61`, `:201-214` |
| V11 | Il numero di passaggi è **misurabile e non coincide con il numero di nodi**: un passaggio RTT per nodo con `requiresRTT: true`, più il composite a schermo → `rttPasses.length + 1`. `getPerformanceStats()` espone `nodeCount` e `rttNodeCount`. **11 nodi dichiarati ≠ 11 passaggi.** | `core/index.js:677,731,755,767-768,3440-3445` |
| V12 | Cambiare `url` su `ImageTexture` **non ricompila nulla**: il loader fa decode asincrono e scrive nella `SwappableMediaTexture` esistente; la texture GPU viene ricreata solo se cambiano le dimensioni. | `core/mediaLifecycle-BTPb5i1-.js:47-55, 73-120` |
| V13 | Cambiare una prop numerica (es. `intensity` all'hover del callout) **non ricompila**: scrive nel buffer di uniformi esistente. Solo i cambi strutturali ricostruiscono la composizione. | `core/index.js:2358`, `:1529-1531` |
| V14 | Fuori schermo o con tab nascosta il core **throttla a 1 fps** (`OFF_SCREEN_FPS_INTERVAL = 1000`), oltre a `stopAnimation()`. | `core/gpu/frame.d.ts:54-55`; `core/index.js:3450-3463` |
| V15 | I warning `powerPreference ignorato su Windows` e Three.js `X4122` **non vengono da `shaders`**: il package non ha dipendenza three.js. Provengono dallo stack three.js dell'app (`hero-glass/engine.js` → PMREM in `geometry.js:11`). | `shaders/README.md`; `core/support-GJphyuEe.js:44` |

Conseguenza operativa: **l'unica leva supportata dalla API pubblica per ridurre i
pixel del backbuffer è ridurre la scatola CSS del canvas**, perché il canvas è
vincolato al 100% del contenitore (V1, V2). Fork/patch del vendor sono esclusi:
la licenza (Shader Effects License) vieta redistribuzione e modification, e
comunque è debito di manutenzione.

---

## 3. Verdetto sul piano precedente (`lag-roblem.txt`)

**Corretto e da tenere:** la diff CPU-vs-pixel come test principale; la regola
"ottimizza solo il costo misurato"; il rifiuto di usare StrictMode come soluzione; la
sospetta sui `getBoundingClientRect` misurati in frame diversi; i difetti `atRest`,
ripristino transform e stato globale di modulo; l'osservazione che i rami mobile e
desktop dell'hero sono JSX identico.

**Morto — non va eseguito.** `§5` passo 1 "sospendere i renderer fuori viewport": è
già fatto dal vendor (V3). L'unico loop che gira davvero fuori viewport è **quello
della maschera del callout**, che è nostro e non è gated (V3 non lo copre).

**Falso positivo — da rimuovere.** Il rischio `[lines` instabile: `SelectedProjects.jsx:1282`
sceglie fra due costanti a livello di modulo (`SelectedProjects.jsx:19-20`), quindi il
riferimento è stabile e l'effetto non si rimonta. Non è un rischio.

**Chiuso — non è un sospetto.** I due warning del log (`powerPreference` ignorato su
Windows, Three.js `X4122` dalla generazione PMREM) **non vengono da `shaders`**, che
non ha dipendenza three.js (V15). Appartengono allo stack three.js dell'app
(`hero-glass/engine.js` → `geometry.js:11`). Vanno curati a parte, se mai, e non
spiegano il lag. Stessa sorte per la ricompilazione shader: da V12/V13 né il cambio
di `url` né il cambio di prop numeriche ricompilano, quindi la pista "reinizializzazione
durante lo scroll" va eliminata dal piano precedente.

**Da riformulare — il test "metà risoluzione".** Il piano lo dà per eseguibile
("dimmezare solo larghezza e altezza interne del rendering"). Con V1/V2/V7 **non è
eseguibile così com'è**: va eseguito come *render scale* via CSS. Fortunatamente è la
stessa meccanica del fix, quindi diventa un caso particolare (vedi §5.2).

---

## 4. I due difetti

### 4.1 Callout — tempesta di rebuild della maschera (CPU) — CAUSA CONFERMATA

`FocusCalloutShader.jsx:528-555`, `loopMask`:

```js
const r = span.getBoundingClientRect()              // frame corrente
sig += Math.round(r.left - containerRectRef.current.left) + '|' + ...  // containerRect dall'ULTIMO draw()
```

`containerRectRef.current` viene aggiornato solo dentro `draw()` (`:365`). Quindi la
firma sottrae una misura di adesso a una misura di prima. **La conseguenza non è
quella descritta nel piano precedente, ed è peggiore:** non è "un rebuild spurioso
alla fine dello scroll", è un rebuild **permanente a ogni altro frame di scroll**.

Derivazione (Δ = spostamento di scroll di un frame):

| frame | `containerRect` usato | `sig` | esito |
|---|---|---|---|
| N | `c(N-1)` | `live(N) - c(N-1)` | ≠ `lastSig` → **draw** → `containerRect := c(N)`, `lastSig := sig` |
| N+1 | `c(N)` | `live(N+1) - c(N)` | `= lastSig - 2Δ` → ≠ `lastSig` → **draw** |
| N+2 | `c(N+1)` | `live(N+2) - c(N+1)` | **== `lastSig`** → nessun draw |

Poi il pattern si ripete. Risultato: **rebuild continui per tutta la durata dello
scroll, con l'entrata già conclusa**, e per ogni rebuild:

`composite` su canvas → `toBlob('image/png')` → `createObjectURL` → `setMaskDataUrl`
→ render React → uniform update su `ImageTexture` → re-upload texture GPU.

**Misurato** in `tests/components/FocusCalloutShader.maskScroll.test.jsx`:

| scenario | encode sprecati |
|---|---|
| salto di scroll singolo (una notch) | 2 |
| scroll continuo, 30 frame (come Lenis) | **20** → 2 frame su 3 |
| 30 frame a ingresso fermo, nessuno scroll | 0 (la firma è stabile) |
| letture di layout a ingresso fermo | **4 righe × ogni frame, per sempre** (120 in 30 frame) |

Con il throttle a 33ms e 60fps, lo scroll continuo si stabilizza intorno a **~30
encode al secondo**, ciascuno con encode PNG + render React + re-upload texture per
una maschera che non cambia mai. Il caso peggiore non è lo scroll: è la **quarta
riga**, cioè un callout già fermo che continua a leggere il layout a ogni frame per
tutta la sessione.

Da V12: il cambio di `url` **non** ricompila shader né pipeline. Quindi il costo non
è una ricostruzione del grafo, è puramente encode + decode + transfer + re-render
React. Da V13: neppure il flip di `ChromaFlow.intensity` all'hover (`:602`) ricompila
— **quella pista si chiude qui, non è un sospetto**.

Il throttle `MASK_MIN_INTERVAL_MS = 33` (`:111`) è il limite effettivo: il bug è
il generatore, il throttle è solo il soffocatore. E il commento a `:538`
("Relative to the container, so scrolling the page cannot change it") **descrive
l'intento, non il comportamento**.

Nota: il callout **non** è a viewport pieno. `.focus-callout__canvas` è
`position:absolute; inset:0` dentro `.focus-callout`, che a `font-size:
clamp(64px,12vw,200px)` e 4 righe a `line-height:0.66` sta sui ~530px di altezza
(`global.css:453-465`). Quindi qui il costo è **CPU/React/transfer**, non fill.

### 4.2 Hero — backbuffer senza tetto × N passaggi full-screen (GPU) — CAUSA CONFORME

Con V4/V5/V6: viewport desktop 2560×1440 a DPR 2 → **5120×2880 = 14.7 Mpx** per
passaggio, e la sezione è `height: 105vh` (`global.css:127`) con il wrapper
`inset:0`, quindi ~15.4 Mpx. `shader-hero.jsx:49-110` dichiara **11 nodi**
(2 `DotGrid`, 1 `ChromaFlow`, 6 `ImageTexture`, `CursorRipples`, `FilmGrain`).

**Da V11 il numero di passaggi non è 11 e non va stimato a occhio**: va letto
`rttNodeCount` (o contato il numero di `GPURenderPass` nel trace) e il totale è
`rttNodeCount + 1`. Stimare "11 passaggi" per poi scoprire che erano 5 falserebbe
l'analisi. Cosa resta comunque acquisito: **il costo per passaggio è 15.4 Mpx e non
ha tetto**, e su GPU integrata 15 Mpx × 4-6 passaggi × 60 fps non si regge.
**Rimpicciolendo la finestra i pixel calano linearmente e il sintomo sparisce** —
esattamente ciò che l'utente osserva.

Manca inoltre: nessun tetto alla risoluzione, e i due rami mobile/desktop sono
**JSX identico** (`shader-hero.jsx:124-190` differiscono solo per `aria-label` e un
commento). Il commento "mobile path" promette un alleggerimento che non esiste.
Il gate fuori viewport c'è ed è efficace (V3, V14): non è un difetto.

### 4.3 Contributore candidato — `backdrop-filter` su area piena

`global.css:175` `.hero-region--split::after { backdrop-filter: blur(0.4px) }` su
`inset:0` con `z-index:2`, e `global.css:82` `.nav { backdrop-filter: blur(12px) }`.
Un `backdrop-filter` sopra un canvas WebGPU costringe il compositor a rileggere il
backdrop a ogni frame, con costo proporzionale all'area. Anche questo scala con la
finestra. **Da misurare, non da presume** — è già il caso in §4.2.

---

## 5. Cosa fare

### 5.1 Callout — il loop della maschera diventa scoped al ciclo di vita

Fine obiettivo: **zero `getBoundingClientRect` e zero `getComputedStyle` per frame
dopo l'entrata**, e nessun rebuild durante lo scroll a ingresso fermo.

La maschera è funzione di due soli input: **layout** (chiave di cache, che già
esclude la posizione di proposito) e **stato dell'entrata**. Lo scroll non è un
input, per costruzione. Quindi:

1. **Costruisci la maschera statica** una volta al mount, su `fonts.ready` e su
   `resize`/`_cacheKey` — il percorso `draw()` esiste già, va solo chiamato nei
   momenti giusti.
2. **Durante l'entrata, ricostruisci da GSAP, non dal DOM.** La timeline in
   `SelectedProjects.jsx:1341-1378` sta già tweenando `span.x/y` e `line.--reveal`:
   `gsap.getProperty(span,'x'|'y')` dà l'offset corrente esatto, e la posizione
   mascherata diventa `restX + x` — **scroll-invariant per costruzione**, la classe
   di bug di §4.1 sparisce invece di essere corretta. Si aggancia con `onUpdate`
   sulla timeline, non con un rAF che gira per sempre.
3. **Alla `onComplete` della timeline, un'ultima ricostruzione e basta.** Da lì in
   poi nessun loop.
4. **Al `ctx.revert()`** (`SelectedProjects.jsx:1384`, su cambio `isMobile`): senza
   transform residui la maschera statica è già corretta → una ricostruzione una tantum.
5. **Gate su intersezione** con l'hook già esistente `src/hooks/useInView.js`
   (margine `240px 0px`), che oggi il callout non usa. Se la sezione non è in
   viewport non si ricostruisce nulla. Nota: il gate va sulla *ricostruzione*, non
   sul posizionamento iniziale della maschera, altrimenti si riproduce il bug che il
   commento a `:519-524` descrive (maschera che smette di seguire il DOM ≡ ingresso
   rotto).

Dalla `:525-556` si cancellano: il rAF perpetuo, la stringa `sig`, il throttle come
*policy* ( resta la guardia di coalescenza), `containerRectRef`, e le letture
per-frame di `getComputedStyle`. È una cancellazione di complessità, non uno
spostamento.

Correzioni obbligatorie nella stessa mossa (difetti reali, indipendenti dal
performance):

- **`:271` fast path `atRest`**: confronta `s.x`/`s.y` contro `s.restX`/`s.restY`
  nello stesso spazio. Oggi confronta `dx = s.x - s.pad` con `restX` salvato senza
  il `pad`, quindi la condizione è quasi sempre falsa e il percorso veloce non gira
  mai.
- **`:397-400` ripristino transform**: salva e ripristina il valore precedente
  (`''` cancella la transform di GSAP). Meglio ancora: non toccare il nodo animato
  — misura la geometria finale da un clone o da `offsetLeft/offsetTop` + la
  transform corrente, senza scrivere inline.
- **Stato globale di modulo** (`_lineCache`, `_lineEls`, `_cacheKey`,
  `containerRectRef`, `_encodeSeq`, `_currentUrl`, `:25-45`): in `useRef` per
  istanza. Oggi due callout sulla pagina si sovrascrivono a vicenda e il cleanup non
  svuota la cache dei riferimenti DOM.
- **Coalescenza encode** (`:53-79`): `_encodeSeq` scarta i risultati superati ma
  non impedisce di avviare più codifiche contemporanee. Una sola in corso, un
  "pending" flag, al termine si applica solo lo stato più recente.

### 5.2 Hero — un unico meccanismo per test e fix: il render scale via CSS

Dato V1/V2/V7, l'unico intervento supportato è ridurre la scatola CSS del canvas e
riportarla a dimensione con `transform: scale()`, lasciando che il compositor
risampioni. È la stessa meccanica del test "metà risoluzione" del piano precedente:
**stesso codice, valore diverso di `k`**.

- `k = 1` → oggi.
- `k = 0.5` → il test diagnostico del piano precedente, finalmente eseguibile.
- `k` da budget di pixel → il fix.

La funzione pura `fitScale` (equivalente di `k = min(1, sqrt(budget / (w*h)))`) è
già in `src/utils/renderScale.js` e testata: se la misura richiederà questa leva, il
lavoro residuo è solo il wrapper React, ~25 righe, che misura la scatola dell'host e
restituisce lo stile del frame. Struttura: uno `stage` in
`position:absolute; inset:0; overflow:hidden` e dentro un `frame` con
`width/height = w*k, h*k` e `transform: scale(1/k); transform-origin: 0 0`.
**Non esiste oggi** — è stato scritto, testato e rimosso quando la misura ha detto
che l'hero non andava toccato alla cieca, e spedire un'astrazione senza consumatori
è debito.

Perché un hook e non una policy: `src/utils/webglPolicy.js` è già uno stub di 3
righe che ignora il proprio argomento `isMobile` e viene chiamato con due forme
diverse (`{isMobile,...}` da `FeaturedGallery.jsx:296`, `{isTouch,...}` da
`SelectedProjects.jsx:1168`). **Non si estende quella roba** — non serve e nessuno
la chiama per hero e callout. Il vincolo del vendor (V1/V2/V7) è however una
conoscenza non ovvia da nessun singolo call site, quindi merita un posto unico con
il constraint scritto dentro — ed è `src/utils/renderScale.js`, che serve già
`text-entry` e il preload.

Costo previsto: da 14.7 Mpx a `budget/4` per passaggio. Con un budget di ~2.4 Mpx
CSS (≈1.9 Mpx device a DPR 2) siamo a un ordine di grandezza di riduzione. Il
**budget è un parametro da calibrare con la Fase 0**, non un numero da decidere qui.

Rischio da mettere in conto: la sfumatura. Per effetti a grana, rifrazione e
aberrazione è probabilmente invisibile; va comunque verificato con screenshot
prima/dopo (Vedi §7).

### 5.3 Hero — puliture che si pagano da sole, a rischio basso

- **Cancella i due rami duplicati** (`shader-hero.jsx:124-190`): un solo `<section>`,
  una sola style injection. Il commento "mobile path — sempre WebGL" menteva.
  ~60 righe in meno e un bug di manutenzione in meno.
- **Sposta i blocchi `<style>` in `global.css`**: sono iniettati per istanza dentro
  il componente e duplicati identici nei due rami.
- **Riconcilia `height: 105vh` (`global.css:127`) con `minHeight:'100dvh'` inline.**
  Il wrapper è `inset:0`, quindi lo shader copre il 105%: ~5% di fill sprecato.
  Decidere consapevolmente se il 105% serve all'animazione di scroll; se no,
  allineare. Se sì, va detto nel commento, non lasciato come conflitto silenzioso.
  **Dopo il render scale il costo è già risolto**: questo è un optional, non un P0.
- **Non ridurre il numero di nodi.** I rami duplicati di `hero-night.jpeg` e
  `hero-hover.svg` e il `FilmGrain` sono coperti da `istruction_AI/decisions.md`:
  linguaggio a flauti S-arch, cascade per flauto, hover luminance-driven. Tagliarli
  è una decisione di design, non un fix. Se la Fase 0 dice che un passaggio domina,
  si ritorna sul tavolo **con la scheda di design aperta**, non di nascosto.

---

## 6. Cosa NON fare (con il perché, per non riaprire la discussione)

- **Non toccare `MASK_DPR = 1`** (`FocusCalloutShader.jsx:100`). Il commento è
  corretto: la composizione è in pixel CSS dentro una canvas `w * MASK_DPR`;
  abbassarlo porta fuori canvas i glifi. Se serve più risoluzione va fatto con la
  transform della composizione, non con quel numero.
- **Non "estendere la libreria"** per passare una canvas a `ImageTexture`: URL-only
  (V9), e la licenza vieta modification/redistribuzione.
- **Non usare `DOMTexture`/`HTMLInCanvas`** al posto della maschera: portalizza una
  canvas `innerWidth × min(dpr,2)` (V10), peggio del problema che si vuole risolvere.
- **Non fare un "reveal solo su GPU" con maschera statica.** Sarebbe la mossa più
  pulita in assoluto (elimina l' encode PNG del tutto), ma richiederebbe un uniform
  per riga (offset + clip window + progress = 3 × 4 righe) e i nodi vendor non
  espongono uniform arbitrari: `FilmGrain` dà solo `strength` + mask. Richiederebbe
  un fragment node custom, che è dietro il code-export Pro. **Non è implementabile
  con questa licenza** — non è "un po' di lavoro in più".
- **Non costruire un layer di policy WebGL.** Vedi §5.2.
- **Non rimuovere StrictMode** e non "risolvere" con `react-smooth`/`remove-scroll`.
- **Non cambiare `isMobile` gating del callout**: lo swap 3/4 righe su cambio
  breakpoint è intenzionale (`SelectedProjects.jsx:1386-1389`).

---

## 7. Fase 0 — misurare (bloccante per 5.2 e 5.3)

Nessun passo di 5.2/5.3 parte senza un numero. Il 5.1 invece è giustificato dal
codice e ha un test di regressione (§8): si può implementare in parallelo.

Su **build di produzione** (`npm run build` + `npm run preview`), non su dev —
l'overhead di sviluppo maschera il segnale. Percorso identico ogni volta:
hero in quiete → hero con movimento cursore → callout in ingresso → callout a
ingresso concluso, scorrendo.

Estrarre per ogni superficie:

1. dimensioni reali del backbuffer (`canvas.width/height`) e `devicePixelRatio` —
   deve confermare 5120×2880 su un desktop 2560×1440 a DPR 2;
2. **numero di passaggi render GPU**: contare gli eventi `GPURenderPass` nel trace.
   `rttNodeCount` di `getPerformanceStats()` non è raggiungibile da React (V7), quindi
   la fonte pratica è il trace. Atteso `rttNodeCount + 1` (V11), **non 11**;
3. **durata GPU per frame** per ciascun passaggio;
4. costo del `requestAnimationFrame` del loop maschera, con **contatore di `toBlob`
   e di `createObjectURL`** (è la metrica diretta del bug di §4.1: atteso ~30/s
   durante lo scroll a ingresso fermo, 0 dopo il fix);
5. durata di `backdrop-filter`/compositing sulla hero.

Soglie di decisione:

| Misura | Soglia | Conseguenza |
|---|---|---|
| GPU frame time hero, viewport pieno, in quiete | > 16.7 ms | il render scale è la priorità; calibra il budget sul valore misurato |
| GPU frame time hero a DPR 1 (o finestra ridotta) | < 8 ms | conferma che il costo è per-pixel, non per-nodo |
| `toBlob`/`createObjectURL` per secondo, callout a ingresso fermo, in scroll | > 0 | **conferma §4.1**; atteso 0 dopo 5.1 |
| `rAF` maschera + encode durante l'ingresso | > 8 ms | il percorso PNG è il soffocatore → alza `MASK_MIN_INTERVAL_MS` dopo 5.1 |
| `rAF` maschera con ingresso fermo, durante scroll | > 2 ms | **conferma §4.1**: atteso ≈0 dopo 5.1 |
| rebuild maschera per secondo, ingresso fermo, in scroll | > 0 | bug confermato; atteso 0 dopo 5.1 |
| `backdrop-filter` hero | > 2 ms | proporre di sostituire il gradiente con backdrop-filter |

Il test "finestra ridotta" che l'utente ha già fatto a mano va ripetuto in modo
controllato: stessa pagina, finestra che passa da ~2560×1440 a ~1280×720, e
 annotare il delta dei due numeri GPU. Serve a separare "costo per pixel" da
"comportamento diverso a dimensione desktop", che era la domanda aperta del piano
precedente.

---

## 8. Verifica

### Regressione in CI (vitest + jsdom, `tests/`)

Il bug del callout **è** testabile in jsdom, perché non richiede un GPU. È il
test più importante di tutto il piano.

1. **`tests/focusCalloutMaskScroll.test.jsx` (nuovo)** — il test del bug.
   Monta `FocusCalloutShader` con righe stabili, simula l'ingresso concluso
   (`--reveal: 1` su tutte le righe), poi fa avanzare i rAF mentre sposta
   **contenitore e span della stessa quantità** (scroll), e asserisce che il
   contatore di `compositeLinesUrl`/`encodeMask` **non aumenta**. Oggi fallisce;
   quel fallimento è la prova. Usa uno `spy` su `HTMLCanvasElement.prototype.toBlob`
   come contatore, così il test non dipende dall'esportazione di funzioni interne.
2. **`atRest` fast path** — unit test su `compositeLinesUrl` con `x === restX`:
   asserisce che lo `scratch` canvas non viene toccato.
3. **Isolamento per istanza** — monta due `FocusCalloutShader` con righe diverse,
   asserisce che le cache non si sovrascrivono. Fallisce oggi.
4. **Transform preservata** — asserisce che `span.style.transform` è invariata
   dopo la costruzione della cache.
5. **`fitScale` / `pixelRatioFor`** — test puro sul calcolo del fattore
   (`k = 1` sotto budget, `k < 1` sopra, mai `> 1`, mai `NaN` a dimensione zero, e il
   rapporto che non scende sotto il pavimento). **Già fatto**, in
   `tests/utils/renderScale.test.js`.
6. **`shader-hero` senza duplicazione** — asserzione di rendering che il ramo
   mobile e desktop producono lo stesso albero (o, meglio, che ne esiste uno solo).

### Misura manuale (non automatizzabile in jsdom)

Il tempo frame GPU non esiste in CI. Da fare a mano e riportata in
`istruction_AI/issues.md`:

- riverifica dei cinque numeri di §7 dopo ogni fase;
- screenshot della hero e del callout in stati chiave (idle, ingresso a metà,
  ingresso concluso, hover attivo) prima e dopo il render scale: nessuna
  degradazione visiva accettabile;
- verifica che scrollando fuori dall'hero non compaiono più `GPURenderPass`;
- verifica che il callout a ingresso concluso non produca più encode durante lo
  scroll, con il contatore esposto in `window.__calloutMask` **solo in dev**.

---

## 9. Sequenza

| # | Passo | File | Precondizione | Può partire in parallelo |
|---|---|---|---|---|
| 0 | Trace di Fase 0 | — | build di produzione | con 1 |
| 1 | Test di regressione del bug (fallisce) | `tests/focusCalloutMaskScroll.test.jsx` | — | con 0, 2 |
| 2 | Callout: maschera guidata da GSAP, loop scoped, `atRest`, transform, stato per-istanza, coalescenza | `FocusCalloutShader.jsx`, `SelectedProjects.jsx:1341-1378` | 1 (il test che deve passare) | no (dipende da 1) |
| 3 | Tetto di risoluzione su `text-entry` e sul preload | `src/utils/renderScale.js`, `hero-glass/engine.js`, `preloader/scene.js` | — | **fatto** |
| 4 | **Calibrazione del budget con `k` = 0.5** (il test diagnostico del piano precedente) | `shader-hero.jsx` | 0 (serve il confronto) | no |
| 5 | Render scale sull'hero (solo se la misura lo giustifica) | `shader-hero.jsx` | 4 + verifica su GPU reale | no |
| 6 | Cancellazione rami duplicati + `<style>` → `global.css` | `shader-hero.jsx`, `global.css` | 5 | con 7 |
| 7 | Decisione su `backdrop-filter` e su `105vh` vs `100dvh` | `global.css` | 0 | con 6 |
| 8 | Riverifica §7 + screenshot, aggiornamento di `issues.md` | — | 5, 6, 7 | no |

Il passo 4 è quello che il piano precedente chiamava "il test più importante": è
stato rimandato per primo perché senza 0 non si sa cosa calibrare.

---

## 10. Criteri di uscita

- **Callout**: con ingresso concluso, zero rebuild di maschera durante lo scroll
  (test §8.1 verde, e contatore manuale a 0). GPU frame time della pagina in
  scroll attraverso la sezione callout senza regressioni rispetto alle sezioni
  non-shaded.
- **Hero**: GPU frame time sotto 16.7 ms a viewport pieno, in quiete, sulla
  macchina di riferimento. Budget scelto e scritto in un commento con il
  giustificativo.
- **Nessuna modifica visiva** verificata con screenshot prima/dopo su tutti gli
  stati chiave.
- Il commento a `FocusCalloutShader.jsx:538` è stato corretto o cancellato: non
  deve più descrivere un comportamento che il codice non ha.
- `istruction_AI/decisions.md` aggiornato con: il vincolo del vendor su
  risoluzione/DPR (V1, V2, V4, V7) e la ragione del render scale, e la nota che
  il gate fuori viewport è del vendor, non nostro.
