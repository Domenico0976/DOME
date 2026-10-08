# Reference Notes — Sketch Tools originale (estratte live via camofox)

Fonte: https://tools.sketchdesign.club/#tools · tab camofox `d5336e8b` (userId=dome NON riutilizzare: crea le tue con userId/sessionKey unici).

## Pattern di piattaforma confermati (validi per OGNI tool)
- Nodo stack con 3 azioni: **Edit <Tool>** (apre pannello), **Switch tool**, **Node options** (⋮ hide/remove).
- Pannello tool = **tab Controls | Effects** + header col nome tool + "Close tool editor".
- Tab **Controls**: dropdown **Modes** in cima (varianti = motori distinti con parametri propri), sezioni **collassabili** (Parameters / Colors), ogni parametro = coppia *value-button* (mostra valore formattato es. "5", "2px", "100%") + slider, **Reset settings to default** in fondo.
- Sezione **Colors**: tipicamente due color-picker — Particle + Background.
- Tab **Effects**: avviso *"Adding effects disables SVG exports."*; le 7 sezioni collassabili sempre presenti (Adjustments, Aberration, Glow, Waves, Edge Blur, Distort Lens, Grain) + **Reset effect settings to default** (disabled quando vuoto).
- Extra piattaforma: **Symmetry on/off**, aspect selector "1:1" accanto al canvas, Export unificato + "Video loop for Spotify Canvas" (disabilitato senza audio), **BPM default 82**, timeline duration default 01:00, quality button etichettato "PREVIEW QUALITY Ultra 4K — 60fps", Reset view, light/dark.

## Esempio esaustivo captato — PARTICLES (Controls, mode Chladni figures)
Parametri (label → default):
- Handle X → 0 ; Handle Y → 0   *(anchor point trascinabili sul canvas — vedi Editor-Nodi §3.2)*
- Frequency → 5 (slider 4.6)
- Density → 100
- Particle Size → 2px
- Opacity → 100%
Colors: Particle picker + Background picker.

Modes della famiglia (dal dropdown): **Chladni figures / Sphere / Cube / Flow Waves** ⇒ ogni mode ha un SET PARAMETRI DIVERSO (cambia mode ⇒ cambiano i controlli, Editor-Nodi §3.3).

## Esempio esaustivo captato — EFFECT ADJUSTMENTS (espanso)
Parametri tutti **[0..100], default 50 = neutro**, display "%":
- Contrast 50% · Exposure 50% · Saturation 50% · Temperature 50% · Tint 50%
⇒ il nostro attuale Brightness/Contrast/Saturation con range [-100..100]/[-1..1] è **parametrizzazione sbagliata**: mancano Temperature+Tint (white-balance), Exposure ≠ brightness, semantica centro-neutro diversa.

## Cosa OSSERVARE nel sito per il tuo tool (playbook agente)
1. Crea il tuo tab: POST /tabs {"userId":"<tuo-id>","sessionKey":"<tuo-key>"} poi POST /tabs/{id}/navigate {"userId":"<tuo-id>","url":"https://tools.sketchdesign.club/#tools"}
2. Chiudi welcome modal (ref Close).
3. Aggiungi il TUO tool: click "Add tool" → catalogo → scegli il nome del tuo tool. (Se già presente usa Edit.)
4. Click "Edit <Tool>" → documenta TUTTI i Controls: nomi label esatti, valori default, formato display ("px","%","°"), ordine, sezioni, Modes presenti e varianti.
5. Apri tab **Effects** → per ognuna delle 7 sezioni: espandi e documenta parametri esatti (nome, range, default, formato).
6. **Test reattività**: trascina/clicca uno slider (sposta valore) → screenshot prima/dopo → il canvas cambia SUBITO? Documenta.
7. Screenshot: GET /tabs/{id}/screenshot?userId=... → PNG binario → salva con `curl -o`.
8. Interagisci anche con **Modes** (se presenti): apri dropdown, elenca varianti, selezionane un'altra e documenta i nuovi parametri.

## API camofox cheat-sheet
- POST /tabs {"userId","sessionKey","url"?} → {tabId}
- GET  /tabs/{id}/snapshot?userId=X → tree con refs eN (+offset pagination se truncated)
- POST /tabs/{id}/click {"userId","ref"| "selector"} · /type {"userId","text","ref"?,"clear"?} · /press {"key"} · /scroll {"direction","amount"}
- GET  /tabs/{id}/screenshot?userId=X → PNG binario (salvare con -o)
- POST /tabs/{id}/evaluate {"userId","expression"} → JS nella pagina
- POST /tabs/{id}/navigate {"userId","url"} · /wait {"userId","selector","timeout"}

## I nostri sorgenti da confrontare (repo)
- tools-app/src/tools/generative/<tool>.ts (uno per tool) + engine/effects/*.ts (7 shader) + engine/compositor.ts + ui/Canvas.tsx (loop) + ui/NodeOptions*.tsx (pannello)
- Doc locale: .omo/dome-creative-tools/final/Tool-Render.md (sezioni §1.x tool, §3.x effetti)
