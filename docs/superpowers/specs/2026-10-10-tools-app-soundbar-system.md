# Tools-App Soundbar + Component System — Spec (approvata)

- Data: 2026-10-10 · Branch: `Tools-initial--0` · Scope: `tools-app/` soltanto
- Base: report Oracle soundbar+DS, `COMPONENT.md`, spec 2026-10-09 (design + modal)
- Stato: 208 test verdi · `tsc` clean · dev `http://localhost:5173/tools/`
- Vincolo produzione: deploy solo su push a `react-full-site`. Niente commit (decisione utente).

## Sezione 1 — Soundbar 136px a due fasce ✅ approvata

Wrapper `footer[aria-label]`: `flex flex-col border-t border-border bg-surface px-3 h-[136px]`.
SOPRA 44px (`flex items-center gap-2 px-2 h-11`): transport Play/Stop/Loop 32px
(Space=play, L=loop) + source Load/Mic/MIDI + BPM label+input+Tap + volume
flex-1 + voce Download unica (dropdown Export PNG-Instagram-Spotify /
View Fullscreen / Project Reset, trigger primary `h-8 px-3`, menu
`min-w-[200px]` align end). SOTTO 92px invariata (waveform/timeline/status +
preset/creator/meters); colonna 140px vuota (track-identity rimandata).
ExportMenu eliminato, logica in `src/ui/exportActions.ts`
(png/instagram/spotify/fullscreen/resetView + computeRasterForced/GpuForced).
Responsive: ≥768 full; 480–767 source icon-only, BPM senza label/Tap, volume
senza icona; <480 transport 28px, source in popover, Download icon-only,
preset 220px, creator in AudioPresetMenu, meter singolo/nascosti. Aria/keyboard
per controllo come da report (Esc chiude, focus torna al trigger).

## Sezione 2 — Design system ✅ approvata

4 famiglie: global chrome / singular params / floating / feedback. Nuovi:
NumberInput (72px, mono, stepper), Field (label+control+ValuePill+helper,
`data-invalid`), ColorPicker (swatch 22px + hex + popover), EmptyState,
Progress (+ValuePill promossa con variante audio). Variant `audio` su Button,
`audio`/`selected` su Badge. Token nuovi in `:root` + `.dark`:
`--accent-audio`, `--surface-panel/raised/input`, `--audio-meter-fill-*`,
`--soundbar-*`, `--button-bg-audio-*`, `--badge-bg-audio/selected`.
Contraddizioni risolte: NodeRow≠LayerItem, TopBar globale≠riga soundbar,
dialog 512 ok, menu min 192px.

## Sezione 3 — Gap + esecuzione ✅ approvata

P0: Download unico, layout top-row, tipo dropdown a gruppi, token coerenti,
varianti audio. P1: meter hardcoded→token, NumberInput/Field/ColorPicker/
EmptyState nuovi, creator su Select, ValuePill in spec. Ordine: WS3 token
→ WS1 soundbar + WS2 componenti in parallelo → WS4 docs. Particelle
intoccabili (gate sha256). QA: tsc + suite + spot light/dark + 3 width.

## Fasi

1. **WS3 token** (questa sessione, diretto): token in globals.css + Canvas
   bg token + hex residui.
2. **WS1 soundbar** (delegato): Zone A/B, exportActions, ExportMenu delete +
   test migrati, Space/L, meter token.
3. **WS2 componenti** (delegato, parallelo a WS1): varianti audio/selected +
   5 nuovi primitivi + test.
4. **Verifica**: tsc + suite + dev check (orchestratore).
5. **WS4 docs**: sync COMPONENT.md (rimandato, docs-only, zero rischio).
