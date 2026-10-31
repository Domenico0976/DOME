// Sketch UI inventory — every panel/control found in the #tools editor DOM
// (tool_1922f6e1) + landing buttons (ev_61df5b41 strict-mode list), mapped to the
// DOME component that already implements it. Statuses: 'covered' (reuse),
// 'adapt' (reuse with a view-only change), 'gap' (to build, non-destructively).

export type UiStatus = 'covered' | 'adapt' | 'gap'

export type UiEntry = {
  /** Sketch UI item as captured. */
  readonly sketch: string
  /** Where it was found. */
  readonly evidence: string
  /** DOME component file, or null when missing. */
  readonly domeUi: string | null
  readonly status: UiStatus
  /** Non-destructive validation rule: how to add it without touching existing. */
  readonly rule: string
}

export const UI_INVENTORY: readonly UiEntry[] = [
  // --- Shell ---
  { sketch: 'Left sidebar shell (collapsible, data-sidebar-shell)', evidence: 'editor DOM', domeUi: 'src/ui/Sidebar.tsx', status: 'covered', rule: 'Reuse as-is; Sketch node palette becomes a section inside, no Sidebar edits.' },
  { sketch: 'Top bar (menu, support, whats-new, templates, save, sign-in)', evidence: 'editor DOM buttons', domeUi: 'src/ui/TopBar.tsx', status: 'covered', rule: 'Add Sketch actions as new menu items only; never reorder existing items.' },
  { sketch: 'Canvas area with pan/zoom + reset view', evidence: 'data-canvas-pan-zoom, Reset canvas position', domeUi: 'src/ui/CanvasArea.tsx + ZoomPanel.tsx', status: 'covered', rule: 'Stack-nodes view is a CanvasArea child layer; zoom state stays in App.' },
  { sketch: 'Empty state "Add a tool to get started" + Add tool', evidence: 'editor DOM h2 + 6 Add-tool buttons', domeUi: 'src/ui/Canvas.tsx', status: 'adapt', rule: 'Empty-state copy maps to existing "Select a node" hint pattern; additive only.' },
  // --- Bottom audio panel ---
  { sketch: 'Bottom audio panel (collapsible, drag handle, 320ms)', evidence: 'data-motion-audio-panel', domeUi: 'src/ui/AudioReactPanel.tsx', status: 'covered', rule: 'THE single audio panel (AGENTS §11.19.11). Sketch transport/duration/BPM render here; no second panel anywhere.' },
  { sketch: 'Audio timeline slider 0–60s + duration input 01:00', evidence: 'role=slider, Timeline duration input', domeUi: 'src/ui/AudioReactPanel.tsx', status: 'adapt', rule: 'Duration input writes timeline.durationSec only; loop flag untouched.' },
  { sketch: 'BPM input (default 82)', evidence: 'aria-label BPM, value 82', domeUi: 'src/ui/AudioReactPanel.tsx', status: 'adapt', rule: 'Manual BPM overrides tracker; tracker never overwrites a manual value.' },
  { sketch: 'Transport Stop/Play', evidence: 'aria-label Stop, title Play', domeUi: 'src/ui/AudioReactPanel.tsx', status: 'covered', rule: 'Reuse transport; Sketch "seekAudio" sync is export-time only.' },
  { sketch: 'File upload .mp3/.wav + Record mic', evidence: 'accept=.mp3,.wav + mic button', domeUi: 'src/ui/AudioReactPanel.tsx', status: 'covered', rule: 'Reuse source pickers; engine attach via SketchAudioEngine.attach* (additive).' },
  { sketch: 'MIDI assignment panel button', evidence: 'aria-label Open MIDI assignment panel', domeUi: 'src/state/projectStore.ts midi', status: 'covered', rule: 'Bind via existing MidiBinding {uid, param, cc}; no store shape change.' },
  { sketch: 'Presets/Scenes toggle', evidence: 'bottom panel toggle', domeUi: 'src/ui/AudioReactPanel.tsx PresetMegaMenu', status: 'covered', rule: 'Scenes = named preset collections; additive to preset rail.' },
  // --- Columns grid ---
  { sketch: 'Columns: Duration/Presets/ReactTo/Sensitivity/ValueRange/Frequency/Timeline', evidence: 'grid-template 258/158/132/144/132/44/1fr', domeUi: null, status: 'gap', rule: 'New view over PresetTable rows (sketchColumns.ts converters); zero state changes.' },
  { sketch: 'React-to dropdown incl. "React to window" + gear', evidence: 'tip text; dropdown not in DOM (on-demand)', domeUi: null, status: 'gap', rule: 'Dropdown options = ReactToSource union; gear edits sensitivity via clampSensitivity.' },
  { sketch: 'Column info tooltips (About the X column)', evidence: '4 tooltip triggers in DOM', domeUi: null, status: 'gap', rule: 'Static copy from STUDIO.md §3; no logic.' },
  // --- Nodes / tools ---
  { sketch: 'Stack nodes + ports + SVG connectors + pan/zoom', evidence: 'data-stack-node/port/workspace', domeUi: 'src/ui/StackPanel.tsx', status: 'adapt', rule: 'Nodes render StackItem[]; connectors are derived (never stored); drag writes uid order only.' },
  { sketch: 'Tool slots (active/slot/html/audio/saved)', evidence: 'bundle activeTool/slotTool/htmlTool/audioTool', domeUi: 'src/core/registry.ts', status: 'covered', rule: 'Slots = registry categories; new tools via registerTool, core untouched.' },
  { sketch: 'Node params (sliders/selects/colors per tool)', evidence: 'Add-tool buttons ×6, bundle controls', domeUi: 'src/ui/FloatingPanel.tsx', status: 'covered', rule: 'New tool controls declare ControlDef; panel renders generically.' },
  // --- Export / misc ---
  { sketch: 'Display & Export + Save Project + Templates + Browse tools', evidence: 'footer/menu buttons', domeUi: 'src/ui/TopBar.tsx', status: 'adapt', rule: 'Export plan (sketchExport.ts) behind existing export entry; Save keeps schemaVersion 4 + migrations.' },
  { sketch: 'Tips carousel + dismiss ("New to Sketch? Start here")', evidence: 'tip buttons in DOM', domeUi: null, status: 'gap', rule: 'Static onboarding copy; localStorage-dismissed; never blocks canvas.' },
  { sketch: 'Theme dark/light via localStorage', evidence: 'theme script in head', domeUi: 'src/globals.css + theme state', status: 'covered', rule: 'Reuse theme tokens; no new variables.' },
  { sketch: 'Toast notifications (sonner)', evidence: 'data-sonner-toaster styles', domeUi: 'src/ui (toast infra)', status: 'covered', rule: 'Reuse toast; errors stay isolated per AGENTS §16.3.' },
] as const

export const UI_GAPS: readonly UiEntry[] = UI_INVENTORY.filter((u) => u.status === 'gap')

export const UI_COVERAGE = {
  total: UI_INVENTORY.length,
  covered: UI_INVENTORY.filter((u) => u.status === 'covered').length,
  adapt: UI_INVENTORY.filter((u) => u.status === 'adapt').length,
  gap: UI_GAPS.length,
} as const
