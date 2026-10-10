# COMPONENT.md — Global Component Design System

## 1. Convenzione token

Ogni componente usa variabili CSS con questa struttura:

```css
--<component>-<property>-<variant>-<state>
```

Esempi:

```css
--button-bg-primary-default
--button-bg-primary-hover
--input-border-focus
--panel-radius-lg
--layer-item-bg-selected
```

### Regole

- Usare `kebab-case`.
- Usare nomi semantici, non colori letterali.
- Ogni componente dichiara solo le variabili che usa.
- Ogni variabile può ereditare dai token globali.
- Ogni stato deve essere coperto: `default`, `hover`, `active`, `focus`, `disabled`, `selected`, `error`.
- Nessun componente deve contenere colori hardcoded.

---

## 2. Token globali

```css
:root {
  /* Surfaces */
  --surface-app: #0B0B0D;
  --surface-canvas: #111114;
  --surface-panel: #16161A;
  --surface-raised: #1C1C21;
  --surface-input: #101014;
  --surface-overlay: rgba(11, 11, 13, 0.72);

  /* Text */
  --text-primary: #F4F4F5;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --text-inverse: #0B0B0D;
  --text-disabled: #52525B;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.18);
  --border-focus: #6C8CFF;
  --border-selected: #6C8CFF;
  --border-danger: #F87171;

  /* Accent */
  --accent-primary: #6C8CFF;
  --accent-primary-hover: #85A0FF;
  --accent-primary-active: #5575E6;
  --accent-success: #34D399;
  --accent-warning: #FBBF24;
  --accent-danger: #F87171;
  --accent-audio: #A78BFA;

  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-full: 999px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Motion */
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);

  /* Shadows */
  --shadow-panel: 0 12px 32px rgba(0, 0, 0, 0.38);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.55);
}
```

---

## 3. App Shell

### 3.1 Struttura

```text
AppShell
├── TopBar
├── Sidebar
├── Workspace
│   ├── Canvas
│   └── FloatingLayer
├── Inspector
└── SoundBar
```

### 3.2 Token

```css
--app-shell-bg: var(--surface-app);
--app-shell-grid-columns: 240px 1fr 320px;
--app-shell-grid-rows: 48px 1fr 56px;
--app-shell-gap: 0px;
--app-shell-border: var(--border-subtle);
```

### 3.3 CSS

```css
.app-shell {
  display: grid;
  grid-template-columns: var(--app-shell-grid-columns);
  grid-template-rows: var(--app-shell-grid-rows);
  height: 100vh;
  background: var(--app-shell-bg);
  color: var(--text-primary);
  font-family: var(--font-ui);
}
```

---

## 4. Top Bar

### 4.1 Anatomia

```text
[Brand] [Project title] ............ [Preview] [Save] [Share] [Download] [Account]
```

### 4.2 Token

```css
--topbar-height: 48px;
--topbar-bg: var(--surface-panel);
--topbar-border-bottom: var(--border-subtle);
--topbar-padding-x: var(--space-3);
--topbar-gap: var(--space-2);
--topbar-title-color: var(--text-primary);
--topbar-title-size: 13px;
--topbar-title-weight: 600;
```

### 4.3 CSS

```css
.topbar {
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--topbar-padding-x);
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--topbar-border-bottom);
}

.topbar-title {
  color: var(--topbar-title-color);
  font-size: var(--topbar-title-size);
  font-weight: var(--topbar-title-weight);
}
```

---

## 5. Button

### 5.1 Varianti

`primary`, `secondary`, `ghost`, `danger`, `audio`

### 5.2 Dimensioni

`sm`, `md`, `lg`

### 5.3 Token

```css
/* Base */
--button-height-sm: 28px;
--button-height-md: 32px;
--button-height-lg: 40px;
--button-padding-x-sm: 8px;
--button-padding-x-md: 12px;
--button-padding-x-lg: 16px;
--button-radius: var(--radius-sm);
--button-font-size: 13px;
--button-font-weight: 500;
--button-gap: var(--space-2);

/* Primary */
--button-bg-primary-default: var(--accent-primary);
--button-bg-primary-hover: var(--accent-primary-hover);
--button-bg-primary-active: var(--accent-primary-active);
--button-text-primary-default: var(--text-inverse);

/* Secondary */
--button-bg-secondary-default: transparent;
--button-bg-secondary-hover: rgba(255, 255, 255, 0.06);
--button-bg-secondary-active: rgba(255, 255, 255, 0.10);
--button-border-secondary-default: var(--border-default);
--button-text-secondary-default: var(--text-primary);

/* Ghost */
--button-bg-ghost-default: transparent;
--button-bg-ghost-hover: rgba(255, 255, 255, 0.06);
--button-text-ghost-default: var(--text-secondary);

/* Danger */
--button-bg-danger-default: transparent;
--button-border-danger-default: rgba(248, 113, 113, 0.45);
--button-text-danger-default: var(--accent-danger);

/* Audio */
--button-bg-audio-default: rgba(167, 139, 250, 0.14);
--button-border-audio-default: rgba(167, 139, 250, 0.45);
--button-text-audio-default: var(--accent-audio);

/* States */
--button-opacity-disabled: 0.45;
--button-focus-ring: 2px solid var(--border-focus);
```

### 5.4 CSS

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--button-gap);
  height: var(--button-height-md);
  padding: 0 var(--button-padding-x-md);
  border-radius: var(--button-radius);
  font-size: var(--button-font-size);
  font-weight: var(--button-font-weight);
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}

.button--primary {
  background: var(--button-bg-primary-default);
  color: var(--button-text-primary-default);
}

.button--primary:hover {
  background: var(--button-bg-primary-hover);
}

.button--secondary {
  background: var(--button-bg-secondary-default);
  border: 1px solid var(--button-border-secondary-default);
  color: var(--button-text-secondary-default);
}

.button--audio {
  background: var(--button-bg-audio-default);
  border: 1px solid var(--button-border-audio-default);
  color: var(--button-text-audio-default);
}

.button:disabled {
  opacity: var(--button-opacity-disabled);
  cursor: not-allowed;
}

.button:focus-visible {
  outline: var(--button-focus-ring);
  outline-offset: 2px;
}
```

---

## 6. Icon Button

### 6.1 Token

```css
--icon-button-size-sm: 28px;
--icon-button-size-md: 32px;
--icon-button-size-lg: 36px;
--icon-button-radius: var(--radius-sm);
--icon-button-bg-default: transparent;
--icon-button-bg-hover: rgba(255, 255, 255, 0.06);
--icon-button-bg-active: rgba(255, 255, 255, 0.10);
--icon-button-color-default: var(--text-secondary);
--icon-button-color-hover: var(--text-primary);
--icon-button-color-active: var(--accent-primary);
--icon-button-color-disabled: var(--text-disabled);
```

### 6.2 CSS

```css
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-button-size-md);
  height: var(--icon-button-size-md);
  border-radius: var(--icon-button-radius);
  background: var(--icon-button-bg-default);
  color: var(--icon-button-color-default);
}

.icon-button:hover {
  background: var(--icon-button-bg-hover);
  color: var(--icon-button-color-hover);
}

.icon-button[data-state="active"] {
  color: var(--icon-button-color-active);
}
```

---

## 7. Panel

### 7.1 Varianti

`sidebar`, `inspector`, `floating`, `modal`

### 7.2 Token

```css
--panel-bg: var(--surface-panel);
--panel-bg-raised: var(--surface-raised);
--panel-border: var(--border-subtle);
--panel-radius-md: var(--radius-md);
--panel-radius-lg: var(--radius-lg);
--panel-padding: var(--space-3);
--panel-header-height: 40px;
--panel-header-border: var(--border-subtle);
--panel-title-size: 13px;
--panel-title-weight: 600;
--panel-shadow: var(--shadow-panel);
--panel-backdrop: var(--surface-overlay);
```

### 7.3 CSS

```css
.panel {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-header {
  height: var(--panel-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--panel-padding);
  border-bottom: 1px solid var(--panel-header-border);
}

.panel-title {
  font-size: var(--panel-title-size);
  font-weight: var(--panel-title-weight);
  color: var(--text-primary);
}

.panel-body {
  flex: 1;
  overflow: auto;
  padding: var(--panel-padding);
}

.panel--floating {
  position: absolute;
  background: color-mix(in srgb, var(--panel-bg) 96%, transparent);
  border-radius: var(--panel-radius-lg);
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(16px);
}
```

---

## 8. Field

### 8.1 Anatomia

```text
Label
[Control] [Value]
Helper / Error
```

### 8.2 Token

```css
--field-label-size: 12px;
--field-label-weight: 500;
--field-label-color: var(--text-secondary);
--field-gap: var(--space-2);
--field-helper-size: 11px;
--field-helper-color: var(--text-muted);
--field-error-color: var(--accent-danger);
--field-control-height: 32px;
--field-control-radius: var(--radius-sm);
```

### 8.3 CSS

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--field-gap);
}

.field-label {
  font-size: var(--field-label-size);
  font-weight: var(--field-label-weight);
  color: var(--field-label-color);
}

.field-helper {
  font-size: var(--field-helper-size);
  color: var(--field-helper-color);
}

.field[data-invalid="true"] .field-helper {
  color: var(--field-error-color);
}
```

---

## 9. Input

### 9.1 Token

```css
--input-height: 32px;
--input-bg: var(--surface-input);
--input-bg-hover: #15151A;
--input-bg-focus: #121218;
--input-border: var(--border-default);
--input-border-hover: var(--border-strong);
--input-border-focus: var(--border-focus);
--input-border-error: var(--border-danger);
--input-radius: var(--radius-sm);
--input-text: var(--text-primary);
--input-placeholder: var(--text-muted);
--input-padding-x: 10px;
--input-font-size: 13px;
```

### 9.2 CSS

```css
.input {
  height: var(--input-height);
  width: 100%;
  padding: 0 var(--input-padding-x);
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--input-radius);
  color: var(--input-text);
  font-size: var(--input-font-size);
}

.input:hover {
  border-color: var(--input-border-hover);
}

.input:focus-visible {
  border-color: var(--input-border-focus);
  outline: none;
}

.input::placeholder {
  color: var(--input-placeholder);
}

.input[data-invalid="true"] {
  border-color: var(--input-border-error);
}
```

---

## 10. Number Input

### 10.1 Token

```css
--number-input-width: 72px;
--number-input-font: var(--font-mono);
--number-input-stepper-size: 18px;
--number-input-stepper-color: var(--text-muted);
--number-input-stepper-hover: var(--text-primary);
```

### 10.2 CSS

```css
.number-input {
  width: var(--number-input-width);
  font-family: var(--number-input-font);
  text-align: right;
}

.number-input-stepper {
  width: var(--number-input-stepper-size);
  height: var(--number-input-stepper-size);
  color: var(--number-input-stepper-color);
}

.number-input-stepper:hover {
  color: var(--number-input-stepper-hover);
}
```

---

## 11. Slider

### 11.1 Token

```css
--slider-height: 20px;
--slider-track-height: 4px;
--slider-track-bg: #2A2A33;
--slider-track-radius: var(--radius-full);
--slider-fill-bg: var(--accent-primary);
--slider-handle-size: 14px;
--slider-handle-bg: var(--text-primary);
--slider-handle-border: 2px solid var(--accent-primary);
--slider-value-font: var(--font-mono);
--slider-value-color: var(--text-primary);
```

### 11.2 CSS

```css
.slider {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--slider-height);
}

.slider-track {
  position: relative;
  flex: 1;
  height: var(--slider-track-height);
  background: var(--slider-track-bg);
  border-radius: var(--slider-track-radius);
}

.slider-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--slider-fill-bg);
  border-radius: inherit;
}

.slider-handle {
  width: var(--slider-handle-size);
  height: var(--slider-handle-size);
  background: var(--slider-handle-bg);
  border: var(--slider-handle-border);
  border-radius: var(--radius-full);
}

.slider-value {
  min-width: 44px;
  font-family: var(--slider-value-font);
  color: var(--slider-value-color);
  text-align: right;
}
```

---

## 12. Toggle / Switch

### 12.1 Token

```css
--switch-width: 36px;
--switch-height: 20px;
--switch-radius: var(--radius-full);
--switch-bg-off: #2A2A33;
--switch-bg-on: var(--accent-primary);
--switch-handle-size: 14px;
--switch-handle-bg: var(--text-primary);
--switch-handle-offset: 3px;
--switch-label-color: var(--text-secondary);
```

### 12.2 CSS

```css
.switch {
  width: var(--switch-width);
  height: var(--switch-height);
  border-radius: var(--switch-radius);
  background: var(--switch-bg-off);
  position: relative;
}

.switch[data-state="checked"] {
  background: var(--switch-bg-on);
}

.switch-handle {
  position: absolute;
  top: var(--switch-handle-offset);
  left: var(--switch-handle-offset);
  width: var(--switch-handle-size);
  height: var(--switch-handle-size);
  background: var(--switch-handle-bg);
  border-radius: var(--radius-full);
}

.switch[data-state="checked"] .switch-handle {
  transform: translateX(16px);
}
```

---

## 13. Select

### 13.1 Token

```css
--select-height: 32px;
--select-bg: var(--surface-input);
--select-border: var(--border-default);
--select-radius: var(--radius-sm);
--select-menu-bg: var(--surface-raised);
--select-menu-border: var(--border-strong);
--select-menu-radius: var(--radius-md);
--select-option-height: 32px;
--select-option-hover: rgba(255, 255, 255, 0.06);
--select-option-selected: rgba(108, 140, 255, 0.16);
```

### 13.2 CSS

```css
.select {
  height: var(--select-height);
  background: var(--select-bg);
  border: 1px solid var(--select-border);
  border-radius: var(--select-radius);
}

.select-menu {
  background: var(--select-menu-bg);
  border: 1px solid var(--select-menu-border);
  border-radius: var(--select-menu-radius);
  box-shadow: var(--shadow-panel);
}

.select-option {
  height: var(--select-option-height);
}

.select-option:hover {
  background: var(--select-option-hover);
}

.select-option[data-selected="true"] {
  background: var(--select-option-selected);
}
```

---

## 14. Color Picker

### 14.1 Token

```css
--color-swatch-size: 22px;
--color-swatch-radius: var(--radius-xs);
--color-swatch-border: var(--border-strong);
--color-picker-width: 240px;
--color-picker-bg: var(--surface-raised);
--color-picker-radius: var(--radius-md);
--color-picker-input-font: var(--font-mono);
```

### 14.2 CSS

```css
.color-swatch {
  width: var(--color-swatch-size);
  height: var(--color-swatch-size);
  border-radius: var(--color-swatch-radius);
  border: 1px solid var(--color-swatch-border);
}

.color-picker {
  width: var(--color-picker-width);
  background: var(--color-picker-bg);
  border-radius: var(--color-picker-radius);
  box-shadow: var(--shadow-panel);
}
```

---

## 15. Tabs

### 15.1 Token

```css
--tabs-height: 36px;
--tabs-gap: var(--space-1);
--tabs-bg: transparent;
--tabs-border-bottom: var(--border-subtle);
--tab-padding-x: var(--space-3);
--tab-radius: var(--radius-sm);
--tab-text: var(--text-secondary);
--tab-text-active: var(--text-primary);
--tab-bg-active: rgba(255, 255, 255, 0.06);
--tab-indicator: var(--accent-primary);
```

### 15.2 CSS

```css
.tabs {
  display: flex;
  align-items: center;
  gap: var(--tabs-gap);
  height: var(--tabs-height);
  border-bottom: 1px solid var(--tabs-border-bottom);
}

.tab {
  padding: 0 var(--tab-padding-x);
  height: 100%;
  border-radius: var(--tab-radius);
  color: var(--tab-text);
}

.tab[data-state="active"] {
  color: var(--tab-text-active);
  background: var(--tab-bg-active);
}
```

---

## 16. Layer Item

### 16.1 Anatomia

```text
[drag] [type icon] Layer name ........ [eye] [lock] [more]
```

### 16.2 Token

```css
--layer-item-height: 34px;
--layer-item-padding-x: var(--space-2);
--layer-item-gap: var(--space-2);
--layer-item-bg-default: transparent;
--layer-item-bg-hover: rgba(255, 255, 255, 0.04);
--layer-item-bg-selected: rgba(108, 140, 255, 0.12);
--layer-item-border-selected: var(--border-selected);
--layer-item-name-color: var(--text-primary);
--layer-item-name-color-muted: var(--text-secondary);
--layer-item-icon-color: var(--text-muted);
--layer-item-badge-audio: var(--accent-audio);
```

### 16.3 CSS

```css
.layer-item {
  display: flex;
  align-items: center;
  gap: var(--layer-item-gap);
  height: var(--layer-item-height);
  padding: 0 var(--layer-item-padding-x);
  border-radius: var(--radius-sm);
}

.layer-item:hover {
  background: var(--layer-item-bg-hover);
}

.layer-item[data-selected="true"] {
  background: var(--layer-item-bg-selected);
  border-left: 2px solid var(--layer-item-border-selected);
}

.layer-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--layer-item-name-color);
}
```

---

## 17. Effect Card

### 17.1 Anatomia

```text
[icon] Effect name .............. [toggle]
Parameter -------------------- value
[Reset] [Delete]
```

### 17.2 Token

```css
--effect-card-bg: var(--surface-raised);
--effect-card-border: var(--border-subtle);
--effect-card-radius: var(--radius-md);
--effect-card-padding: var(--space-3);
--effect-card-gap: var(--space-3);
--effect-card-title-size: 13px;
--effect-card-title-weight: 600;
--effect-card-disabled-opacity: 0.55;
--effect-card-mask-badge: var(--accent-primary);
```

### 17.3 CSS

```css
.effect-card {
  background: var(--effect-card-bg);
  border: 1px solid var(--effect-card-border);
  border-radius: var(--effect-card-radius);
  padding: var(--effect-card-padding);
  display: flex;
  flex-direction: column;
  gap: var(--effect-card-gap);
}

.effect-card[data-enabled="false"] {
  opacity: var(--effect-card-disabled-opacity);
}

.effect-card-title {
  font-size: var(--effect-card-title-size);
  font-weight: var(--effect-card-title-weight);
}

.effect-card-mask-badge {
  color: var(--effect-card-mask-badge);
  font-size: 11px;
}
```

La UI di Sketch espone il concetto di **Mask toggle** per applicare un effetto a un singolo layer; il componente deve quindi mostrare chiaramente quando l’effetto è limitato dal mask. [1]

---

## 18. Audio Binding Card

### 18.1 Anatomia

```text
[♪] Bass → Scale ............... [toggle]
Amount [────●────] 45%
[Edit] [Mute] [Remove]
```

### 18.2 Token

```css
--audio-binding-bg: rgba(167, 139, 250, 0.08);
--audio-binding-border: rgba(167, 139, 250, 0.24);
--audio-binding-radius: var(--radius-md);
--audio-binding-padding: var(--space-3);
--audio-binding-icon: var(--accent-audio);
--audio-binding-title: var(--text-primary);
--audio-binding-muted: var(--text-muted);
--audio-binding-active-dot: var(--accent-audio);
```

### 18.3 CSS

```css
.audio-binding {
  background: var(--audio-binding-bg);
  border: 1px solid var(--audio-binding-border);
  border-radius: var(--audio-binding-radius);
  padding: var(--audio-binding-padding);
}

.audio-binding-icon {
  color: var(--audio-binding-icon);
}

.audio-binding[data-state="active"]::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--audio-binding-active-dot);
}
```

---

## 19. Sound Bar

### 19.1 Anatomia

```text
TOP (44px):    [▶][⏹][Loop] [Load|Mic|MIDI] [BPM 115][Tap] [Vol ──●──] [Download ▾]
BOTTOM (92px): [waveform + timeline + status] [presets + creator + meters]
```

La voce Download apre un menu a gruppi: Export (PNG, Instagram, Spotify),
View (Fullscreen), Project (Reset). La TopBar globale resta separata: il
Download vive solo nella sound bar.

### 19.2 Token

```css
--soundbar-height: 136px;
--soundbar-top-row: 44px;
--soundbar-bottom-zone: 92px;
--soundbar-bg: var(--surface-panel);
--soundbar-border-top: var(--border-subtle);
--soundbar-padding-x: var(--space-3);
--soundbar-gap: var(--space-3);
--soundbar-waveform-bg: var(--surface-input);
--soundbar-waveform-fill: var(--accent-audio);
--soundbar-playhead: var(--text-primary);
--soundbar-bpm-font: var(--font-mono);
--soundbar-reactive-badge: var(--accent-audio);
```

### 19.3 CSS

```css
.soundbar {
  height: var(--soundbar-height);
  display: flex;
  flex-direction: column;
  background: var(--soundbar-bg);
  border-top: 1px solid var(--soundbar-border-top);
}

.soundbar-top {
  height: var(--soundbar-top-row);
  display: flex;
  align-items: center;
  gap: var(--soundbar-gap);
  padding: 0 var(--soundbar-padding-x);
}

.soundbar-bottom {
  height: var(--soundbar-bottom-zone);
  display: flex;
  gap: var(--soundbar-gap);
}

.soundbar-waveform {
  flex: 1;
  background: var(--soundbar-waveform-bg);
  border-radius: var(--radius-sm);
}

.soundbar-bpm {
  font-family: var(--soundbar-bpm-font);
  color: var(--text-primary);
}
```

---

## 20. Audio Meter

### 20.1 Token

```css
--audio-meter-height: 6px;
--audio-meter-bg: #2A2A33;
--audio-meter-fill-bass: #A78BFA;
--audio-meter-fill-mid: #6C8CFF;
--audio-meter-fill-high: #34D399;
--audio-meter-label-size: 11px;
--audio-meter-label-color: var(--text-muted);
```

### 20.2 CSS

```css
.audio-meter {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.audio-meter-track {
  height: var(--audio-meter-height);
  background: var(--audio-meter-bg);
  border-radius: var(--radius-full);
}

.audio-meter-fill[data-band="bass"] {
  background: var(--audio-meter-fill-bass);
}

.audio-meter-fill[data-band="mid"] {
  background: var(--audio-meter-fill-mid);
}

.audio-meter-fill[data-band="high"] {
  background: var(--audio-meter-fill-high);
}
```

---

## 21. Badge

### 21.1 Varianti

`default`, `success`, `warning`, `danger`, `audio`, `selected`

### 21.2 Token

```css
--badge-height: 20px;
--badge-padding-x: 8px;
--badge-radius: var(--radius-full);
--badge-font-size: 11px;
--badge-font-weight: 500;

--badge-bg-default: rgba(255, 255, 255, 0.08);
--badge-text-default: var(--text-secondary);

--badge-bg-success: rgba(52, 211, 153, 0.14);
--badge-text-success: var(--accent-success);

--badge-bg-warning: rgba(251, 191, 36, 0.14);
--badge-text-warning: var(--accent-warning);

--badge-bg-danger: rgba(248, 113, 113, 0.14);
--badge-text-danger: var(--accent-danger);

--badge-bg-audio: rgba(167, 139, 250, 0.14);
--badge-text-audio: var(--accent-audio);
```

### 21.3 CSS

```css
.badge {
  display: inline-flex;
  align-items: center;
  height: var(--badge-height);
  padding: 0 var(--badge-padding-x);
  border-radius: var(--badge-radius);
  font-size: var(--badge-font-size);
  font-weight: var(--badge-font-weight);
}

.badge--audio {
  background: var(--badge-bg-audio);
  color: var(--badge-text-audio);
}
```

---

## 22. Tooltip

### 22.1 Token

```css
--tooltip-bg: #1C1C21;
--tooltip-text: var(--text-primary);
--tooltip-radius: var(--radius-sm);
--tooltip-padding: 6px 8px;
--tooltip-font-size: 11px;
--tooltip-shadow: var(--shadow-panel);
--tooltip-delay: 300ms;
```

### 22.2 CSS

```css
.tooltip {
  background: var(--tooltip-bg);
  color: var(--tooltip-text);
  padding: var(--tooltip-padding);
  border-radius: var(--tooltip-radius);
  font-size: var(--tooltip-font-size);
  box-shadow: var(--tooltip-shadow);
}
```

---

## 23. Dropdown Menu

### 23.1 Token

```css
--menu-bg: var(--surface-raised);
--menu-border: var(--border-strong);
--menu-radius: var(--radius-md);
--menu-min-width: 180px;
--menu-item-height: 32px;
--menu-item-padding-x: var(--space-3);
--menu-item-hover: rgba(255, 255, 255, 0.06);
--menu-item-danger: var(--accent-danger);
--menu-separator: var(--border-subtle);
```

### 23.2 CSS

```css
.menu {
  min-width: var(--menu-min-width);
  background: var(--menu-bg);
  border: 1px solid var(--menu-border);
  border-radius: var(--menu-radius);
  box-shadow: var(--shadow-panel);
  padding: var(--space-1);
}

.menu-item {
  height: var(--menu-item-height);
  display: flex;
  align-items: center;
  padding: 0 var(--menu-item-padding-x);
  border-radius: var(--radius-sm);
}

.menu-item:hover {
  background: var(--menu-item-hover);
}

.menu-item--danger {
  color: var(--menu-item-danger);
}
```

---

## 24. Dialog / Modal

### 24.1 Token

```css
--dialog-overlay: rgba(0, 0, 0, 0.62);
--dialog-bg: var(--surface-raised);
--dialog-border: var(--border-strong);
--dialog-radius: var(--radius-lg);
--dialog-width-sm: 360px;
--dialog-width-md: 480px;
--dialog-width-lg: 640px;
--dialog-padding: var(--space-5);
--dialog-shadow: var(--shadow-modal);
--dialog-title-size: 16px;
--dialog-title-weight: 600;
```

### 24.2 CSS

```css
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: var(--dialog-overlay);
  display: grid;
  place-items: center;
}

.dialog {
  width: var(--dialog-width-md);
  background: var(--dialog-bg);
  border: 1px solid var(--dialog-border);
  border-radius: var(--dialog-radius);
  box-shadow: var(--dialog-shadow);
  padding: var(--dialog-padding);
}

.dialog-title {
  font-size: var(--dialog-title-size);
  font-weight: var(--dialog-title-weight);
}
```

---

## 25. Toast

### 25.1 Token

```css
--toast-bg: var(--surface-raised);
--toast-border: var(--border-strong);
--toast-radius: var(--radius-md);
--toast-padding: var(--space-3);
--toast-width: 320px;
--toast-shadow: var(--shadow-panel);
--toast-success: var(--accent-success);
--toast-warning: var(--accent-warning);
--toast-danger: var(--accent-danger);
```

### 25.2 CSS

```css
.toast {
  width: var(--toast-width);
  background: var(--toast-bg);
  border: 1px solid var(--toast-border);
  border-radius: var(--toast-radius);
  box-shadow: var(--toast-shadow);
  padding: var(--toast-padding);
}

.toast--success {
  border-left: 3px solid var(--toast-success);
}

.toast--danger {
  border-left: 3px solid var(--toast-danger);
}
```

---

## 26. Canvas

### 26.1 Token

```css
--canvas-bg: var(--surface-canvas);
--canvas-padding: var(--space-4);
--canvas-selection-border: var(--accent-primary);
--canvas-selection-width: 1.5px;
--canvas-handle-size: 8px;
--canvas-handle-bg: var(--text-primary);
--canvas-handle-border: var(--accent-primary);
--canvas-grid-color: rgba(255, 255, 255, 0.04);
--canvas-empty-text: var(--text-muted);
```

### 26.2 CSS

```css
.canvas {
  position: relative;
  flex: 1;
  background: var(--canvas-bg);
  overflow: hidden;
}

.canvas-selection {
  position: absolute;
  border: var(--canvas-selection-width) solid var(--canvas-selection-border);
}

.canvas-handle {
  width: var(--canvas-handle-size);
  height: var(--canvas-handle-size);
  background: var(--canvas-handle-bg);
  border: 1px solid var(--canvas-handle-border);
  border-radius: var(--radius-full);
}
```

---

## 27. Empty State

### 27.1 Token

```css
--empty-state-padding: var(--space-8);
--empty-state-title-size: 16px;
--empty-state-title-weight: 600;
--empty-state-description-size: 13px;
--empty-state-description-color: var(--text-secondary);
--empty-state-icon-size: 32px;
--empty-state-icon-color: var(--text-muted);
```

### 27.2 CSS

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--empty-state-padding);
  text-align: center;
}
```

---

## 28. Progress

### 28.1 Token

```css
--progress-height: 6px;
--progress-bg: #2A2A33;
--progress-fill: var(--accent-primary);
--progress-radius: var(--radius-full);
--progress-label-size: 11px;
--progress-label-color: var(--text-secondary);
```

### 28.2 CSS

```css
.progress {
  height: var(--progress-height);
  background: var(--progress-bg);
  border-radius: var(--progress-radius);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
}
```

---

## 29. Skeleton

### 29.1 Token

```css
--skeleton-bg: #1F1F26;
--skeleton-highlight: rgba(255, 255, 255, 0.06);
--skeleton-radius: var(--radius-sm);
--skeleton-animation-duration: 1.4s;
```

### 29.2 CSS

```css
.skeleton {
  background: var(--skeleton-bg);
  border-radius: var(--skeleton-radius);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--skeleton-highlight),
    transparent
  );
  animation: shimmer var(--skeleton-animation-duration) infinite;
}
```

---

## 30. Componenti obbligatori

Ogni componente globale deve implementare:

| Requisito | Dettaglio |
|---|---|
| Token propri | Nessun colore o spacing hardcoded |
| Stati | Default, hover, active, focus, disabled |
| Accessibilità | Label, role, focus ring, keyboard support |
| Varianti | Almeno una variante visiva se utile |
| Dimensioni | `sm`, `md`, `lg` dove sensato |
| Dark mode | Default |
| Responsive | Comportamento definito |
| Error state | Dove applicabile |
| Loading state | Dove applicabile |
| Empty state | Dove applicabile |

---

## 31. Allineamento con shadcn/ui

| Componente | Equivalente shadcn | Note |
|---|---|---|
| Button | `Button` | Aggiunta variante `audio` |
| Input | `Input` | Dark-first, mono per numeri |
| Select | `Select` | Menu scuro e compatto |
| Slider | `Slider` | Valore sempre visibile |
| Switch | `Switch` | Usato per effetti e binding |
| Tabs | `Tabs` | Presets / Bindings / Analyzer |
| Dialog | `Dialog` | Export, conferme, impostazioni |
| Dropdown | `DropdownMenu` | Azioni layer, progetto, account |
| Tooltip | `Tooltip` | Obbligatorio su icon button |
| Toast | `Toast` | Feedback non bloccante |
| Progress | `Progress` | Export e analisi audio |
| Skeleton | `Skeleton` | Caricamento asset e progetti |
| Badge | `Badge` | Stato audio, mask, errori |
| Card | `Card` | Effect card, project card |
| Separator | `Separator` | Bordi sottili nei pannelli |

---

## 32. Regole finali

1. Un componente non conosce il business logic.
2. Un componente espone varianti e stati.
3. Un componente usa solo token.
4. Un componente è accessibile di default.
5. Un componente supporta composizione.
6. Un componente ha stati vuoti, di caricamento ed errore.
7. Un componente è prevedibile in ogni contesto.
8. Un componente può essere sostituito senza rompere la UI.
9. Un componente è documentato con anatomia e token.
10. Ogni nuova funzionalità estende il sistema, non lo duplica.

---

## 33. Mappa famiglie modali

| Famiglia | Ambito | Componenti |
|---|---|---|
| global chrome | shell persistente, mai modale | AppShell, TopBar, Sidebar, SoundBar, Canvas, Toast viewport, PerfBanner |
| singular params | contenuto inspector guidato dal contesto | NodeOptions, Field, Input, NumberInput, Slider, Switch, Select, ColorPicker, Tabs, ValuePill, EffectCard, AudioBindingCard, LayerItem, NodeRow, Badge |
| floating | overlay con escape-to-close | FloatingPanel, FloatingStack, DropdownMenu, Popover, Tooltip, AudioPresetMenu, Catalog, QuarantinePanel |
| feedback | notifiche transienti o bloccanti | Dialog, Toast, EmptyState, Progress, Skeleton |

## 34. Componenti nuovi e distinzioni

- **NodeRow** (Stack/FloatingStack): riga nodo con badge `#N`, `♪N`, `fN`,
  Hidden come Badge, cluster sempre visibile. Distinto da **LayerItem**
  (§16: eye/lock/drag), non ancora costruito.
- **ValuePill**: `value/unit/decimals`, mono tabular, 46px, allineato a destra.
- **NumberInput**: 72px, mono, stepper ±, min/max/step, disabled.
- **Field**: label + controllo + slot valore + helper/error, `data-invalid`.
- **ColorPicker**: swatch 22px + hex + popover palette.
- **EmptyState / Progress**: vedi §27/§28 (implementati in `components/ui/`).
- **Badge**: varianti `audio` e `selected` implementate.
- **Dialog**: `max-w-lg` (512px) accettato al posto di md 480px.
- **DropdownMenu**: `min-w-[12rem]` (192px) per label di gruppo.