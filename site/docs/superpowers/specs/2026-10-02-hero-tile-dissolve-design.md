# Hero — dissolvenza a tile sul bordo inferiore

Data: 2026-10-02
Stato: design rivisto dopo verifica con Oracle. Non implementato.
Reviso: sostituisce la prima stesione, che aveva premesse false (vedi "Cosa è cambiato").

## Problema

La Hero finisce netta sullo sfondo. Il bordo inferiore è una linea tagliente e la
transizione alla sezione successiva è secca. Serve qualcosa di più omogeneo.

## Decisione

Le tile **consumano il contenuto** della sezione verso il basso: sotto emerge lo sfondo
della pagina. Non è un ritaglio geometrico, né un semplice profilo.

La maschera vive in una **`mask-image` CSS sulla sezione**, non dentro lo shader.

## Perché non dentro lo shader (verificato, non ipotizzato)

`HeroShaderStack.jsx` è una composizione dichiarativa di componenti prebuilt di
`shaders/react` (`shaders@3.2.467`). L'export completo del package **non espone alcun hook di
fragment custom**: niente `CustomShader`, `Fragment`, `Code` o `Raw`. Il fragment è
posseduto dalla libreria, quindi non c'è codice in cui scrivere.

Lo stack è inoltre **WebGPU via TypeGPU**, non WebGL: il GLSL della prima stesione
(`gl_FragColor`, `discard`, `varying`) era anche nel linguaggio sbagliato.

`core/BlockDissolve`, che sembrava l'alternativa ovvia perché è già nel package, **non va
bene**: `blockSize` è una frazione della *larghezza* del frame, quindi su un canvas non
quadrato le tile non sono quadrate (56px larghe → ~31px alte su un hero 1440×800), e non ha
prop per griglia in pixel, banda ancorata al fondo, né curva laterale.

## Il buco che la prima stesione non vedeva

La sezione dipinge `backgroundImage: url(/hero-day.png)` sul **proprio elemento**
(`src/webgl-water/shader-hero.jsx`, inline style ~riga 33), *dietro* al canvas, e il layer
base del canvas è la stessa immagine (`HeroShaderStack.jsx:56`).

Quindi mascherare **solo il canvas** non rivela lo sfondo pagina: rivelerebbe
`hero-day.png`, identica pixel per pixel, e l'effetto sarebbe invisibile.

La `mask-image` sulla sezione risolve questo: copre canvas + sfondo CSS + overlay in una
operazione sola, e funziona anche nel path no-GL. Per questo è il meccanismo **primario e
unico**, non il fallback. `maskSource` sull'ultimo nodo diventa redundante e non si usa.

## Tile

- **56px**, quadrate, su griglia in pixel CSS
- **3 righe**, banda di ~168px ancorata al fondo della sezione
- Griglia in pixel, non in percentuale: in `%` le tile non resterebbero quadrate

## Algoritmo (JS, su canvas 2D)

Il pattern è quantizzato a tile, quindi è calcolabile in JS: nessun uniform, nessuna
lettura della risoluzione nello shader.

```
per ogni cella (col, row) nella banda:
    h        = hash(col, row)                  // 0..1 stabile, mai cambia
    t        = riga / BAND_ROWS               // 0 top banda, 1 fondo
    shaped   = t * (1 - 0.45 * lateral(x))    // curva: le tile laterali resistono di più
    se h < shaped * dissolve: cella vuota
```

- `hash` a interi, non il classico `fract(sin(dot(...)))`, che cambia risultato da un driver
  all'altro
- `lateral(x)` = `smoothstep` sulle due estremità, `e = 0.28`
- bordi delle tile ammorbiditi con `smoothstep` sulle coordinate locali (~8% della tile),
  altrimenti `step` aliasa

## Risoluzione

La maschera si rigenera alle dimensioni misurate della sezione, via `registerResize` di
`src/gl/resize.js`. Quel modulo **esiste già** ed è testato: coalesce su un frame e scarta
le variazioni di sola altezza dovute alla barra dei browser. Nota: i suoi unici caller oggi
sono in `TextEntryGlass.jsx` — non è già collegato alla Hero, va collegato.

## Animazione

`dissolve` 0→1 all'ingresso: le tile si accendono in sequenza dal basso verso l'alto.

Il trigger **non** è `subscribeInView` da solo: la Hero è la prima sezione, quindi
l'IntersectionObserver scatta **al mount, dietro il preloader**, mentre è ancora coperta. Il
momento reale è la **rivelazione del preloader**, e `src/preloader/index.js` **non pubblica
nessun segnale** (rimuove `#preloader` alla riga 149, e basta).

Serve un canale: un flag `html.dataset` in `finish()`, o un `MutationObserver` sulla
rimozione di `#preloader`. Il tween parte quando `subscribeInView` ha visto la sezione
**E** il preloader è finito.

Con `prefers-reduced-motion: reduce`: `dissolve = 1` immediato, resta la dissolvenza.

## Limite noto

I figli in `position: fixed` non sono coperti da una `mask-image` sul genitore. Non è un
problema: restano comunque ritagliati dal bordo della sezione, che è il comportamento di
oggi. La maschera aggiunge lo sfumato, non cambia la geometria.

## File toccati

| File | Cosa cambia |
|---|---|
| `src/gl/hero/mask.js` | **nuovo** — genera il pattern a tile su canvas 2D |
| `src/webgl-water/shader-hero.jsx` | applica la `mask-image` alla sezione, la aggiorna a ogni cambio di `dissolve`, registra il resize, collega il trigger |
| `src/styles/global.css` | `-webkit-mask-image` per Safari |
| `src/preloader/index.js` | **una riga** — pubblica il segnale di "preloader finito" |

`HeroShaderStack.jsx` **non si tocca**.

## discard vs alpha

Non è più una domanda. Entrambi i meccanismi possibili sono alpha per costruzione
(`mask-image` CSS). E se un pass finale custom un giorno esistesse, alpha vincerebbe: dietro
non c'è nulla in quel pass, e `discard` su una soglia per tile che cambia ogni frame degrada
early-Z sulle GPU tiled.

## Costo

La maschera è quantizzata a tile, quindi la canvas è minuscola: ~26×3 celle su 1440px, con
il feather ~8×8 texel per tile → ~210×30px. Il `toBlob` su una canvas così è trascurabile, e
molto più economico del encode a piena area di `FocusCalloutShader`.

## Test

1. Strutturale: `src/gl/hero/mask.js` espone `createHeroDissolveMask()` e nessun'altra sezione lo duplica
2. Unit: la maschera ha celle quadrate a 375, 834, 1440px; il pattern cambia con `dissolve`; a `dissolve=0` la banda è piena, a `1` è vuota
3. Unit: `hash` è stabile — due chiamate consecutive danno lo stesso risultato
4. Strutturale: `shader-hero.jsx` applica `maskImage` **e** `webkitMaskImage`
5. Strutturale: il tween è ANDato con il segnale di preloader finito
6. Runtime: con reduced motion, `dissolve` è 1 al primo frame
7. Visivo: nessun bordo tagliente sotto la Hero a 375, 834, 1440px

## Fuori scope

- Cambiare contenuto o layout della Hero
- Consolidare i 7 renderer in uno (problema separato, già segnalato: 11 canvas con contesto GL)
- `maskSource` su `FilmGrain` — scartato, redundantante con la mask CSS
- Animazione della dissolvenza al resize
