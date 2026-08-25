# Effects Reference — parametri reali catturati dal sito originale (camoufox, live)

Stato di default dell'originale: TUTTI gli effetti a intensità 0 (off) — si "accendono" alzando l'intensità.
Formato display universale: percentuali 0–100%. Ogni sezione ha il suo "Reset <effect> to default".

## 1. Adjustments (già captato)
| Param | Default | Display |
|---|---|---|
| Contrast | 50 | 50% |
| Exposure | 50 | 50% |
| Saturation | 50 | 50% |
| Temperature | 50 | 50% |
| Tint | 50 | 50% |
Semantica: centro 50 = neutro (white-balance inclusi temperature/tint).

## 2. Aberration
| Param | Default |
|---|---|
| Displace | 0% |
| Area | 50% |
| Falloff | 50% |

## 3. Glow
| Param | Default |
|---|---|
| Intensity | 0% |
(un solo parametro nell'originale!)

## 4. Waves
| Param | Default |
|---|---|
| Intensity | 0% |
| Quantity | 0% |
| Organic | 0% |
(parametro "Organic" assente nella nostra implementazione)

## 5. Edge Blur
| Param | Default |
|---|---|
| Intensity | 75% |
| Falloff | 50% |
| X | 0% |
| Y | 0% |
(no "Area": il centro nitido è implicito; posizione X/Y del fuoco presente)

## 6. Distort Lens
| Param | Default |
|---|---|
| Intensity | 0% |
| X | 0% |
| Y | 0% |

## 7. Grain
| Param | Default |
|---|---|
| Intensity | 0% |
| Motion | switch on/off |
| Size | 50% |
(nostra Size mancante; Motion confermato come switch)

---

# Implicazioni per i nostri defs (engine/effects/*.ts)

| Nostro effetto | Azione allineamento |
|---|---|
| adjustments.ts | Riscrivere controls+shader: 5 parametri centro-50, aggiungere temperature/tint (shift R↔B e G↔M su bianco), exposure moltiplicativa |
| aberration.ts | Rinominare Frequency→Area semantica? No: original = Displace/Area/Falloff → sostituire frequency con area/falloff che modulano raggio onda |
| glow.ts | Ridurre a solo Intensity (radius/threshold interni fissi o derivati); default 0 = off |
| waves.ts | Aggiungere Organic (rumore sulla fase); rimappare Quantity/Speed→Quantity |
| edgeblur.ts | Rimappare: Intensity(forse assente nell'originale?) — captato Intensity 75/Area→rimossa, Falloff 50, X/Y offset centro |
| lens.ts | Allineare a Intensity/X/Y (no center separato dai nostri centerX/Y — rinomina) |
| grain.ts | Aggiungere Size (densità/grana più grossa), Intensity range 0..1 ok, Motion switch ok |

Nota UI originale: ogni sezione è collassabile con header cliccabile + "Reset <effect> to default" individuale.
