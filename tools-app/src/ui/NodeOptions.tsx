import { useState } from 'react'
import { ChevronDown, ChevronUp, Layers, Trash2 } from 'lucide-react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { ScrollArea } from '../components/ui/scroll-area'
import { Separator } from '../components/ui/separator'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import type { ControlDef, ComponentScope, StackItem } from '../core/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { NodeOptionsEffects } from './NodeOptionsEffects'
import { ValuePill } from './ValuePill'
import { cn } from '../lib/utils'

export const BLEND_MODES = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Darken', value: 'darken' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Plus darker', value: 'multiply' },
  { label: 'Color burn', value: 'color-burn' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Screen', value: 'screen' },
  { label: 'Plus lighter', value: 'lighter' },
  { label: 'Color dodge', value: 'color-dodge' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Soft light', value: 'soft-light' },
  { label: 'Hard light', value: 'hard-light' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' },
  { label: 'Saturation', value: 'saturation' },
  { label: 'Color', value: 'color' },
  { label: 'Luminosity', value: 'luminosity' },
] as const

// Scope fan-out options — see modal spec §1 (2026-10-09-tools-app-modal-system).
// `scope` is a component-group field and does NOT touch the renderer (opt-in helper).
const SCOPE_OPTIONS: { value: ComponentScope; label: string }[] = [
  { value: 'self', label: 'Questo elemento' },
  { value: 'above', label: 'Sopra+questo' },
  { value: 'below', label: 'Questo+sotto' },
]

function ScopeControl({
  value,
  onChange,
}: {
  value: ComponentScope
  onChange: (v: ComponentScope) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Component scope"
      className="inline-flex w-full items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5"
    >
      {SCOPE_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 h-7 rounded-sm px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2',
              active
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:bg-surface-2/60 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function NodeOptions({ item }: { item: StackItem }) {
  const updateParam = useProjectStore((s) => s.updateParam)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const setComponent = useProjectStore((s) => s.setComponent)
  const removeAutomation = useProjectStore((s) => s.removeAutomation)
  const def = resolveTool(item.toolId, item.toolVersion)

  if (!def) return <div className="node-options">Unknown tool</div>

  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState('controls')

  // Single source of truth for the UI lives in the Component group; loose fields
  // remain the rendering backing-store (read by stackEngine) for backwards compat.
  const opacity = item.component?.opacity ?? item.opacity ?? 1
  const blendMode = item.component?.blendMode ?? item.blendMode ?? 'source-over'
  const hidden = item.component?.hidden ?? item.hidden ?? false
  const scope = item.component?.scope ?? 'self'
  const blendLabel = BLEND_MODES.find((m) => m.value === blendMode)?.label ?? blendMode

  // Layer-stack identity header — index 0 = front, display #N zero-based
  // (matching the #N badges already rendered by Stack / FloatingStack), total M = stack length.
  const stack = useProjectStore((s) => s.stack)
  const index = stack.findIndex((i) => i.uid === item.uid)
  const total = stack.length
  const subtitle = `Elemento · #${index} di ${total}`

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="grid h-7 w-7 place-items-center rounded-sm bg-surface-2">
          <ToolIcon name={String(def.icon)} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-tight truncate" title={def.label}>
            {def.label}
          </h3>
          <p
            className="text-[11px] text-muted-foreground leading-tight truncate"
            title={subtitle}
          >
            {subtitle}
          </p>
        </div>
        {hidden && <Badge variant="warning">Hidden</Badge>}
      </div>

      {/* Component section — dedicated modal section above the tabs (single source of truth) */}
      <div className="border-b border-border px-4 py-3 shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-[13px] font-semibold text-foreground">Component</h4>
        </div>

        {/* Blend mode — label-only, live value in trigger (select) + ValuePill */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="component-blend-mode" className="text-[12px] font-medium text-muted-foreground">
              Blend mode
            </label>
            <ValuePill value={blendLabel} unit="" />
          </div>
          <select
            id="component-blend-mode"
            value={blendMode}
            onChange={(e) => updateParam(item.uid, '_blendMode', e.target.value)}
            className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[11px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Blend mode"
          >
            {BLEND_MODES.map((m) => (
              <option key={m.label} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Opacity — slider + ValuePill (mono live) + scope segmented control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="component-opacity" title="Range 0–1" className="text-[12px] font-medium text-muted-foreground">
              Opacity
            </label>
            <ValuePill value={opacity} unit="" />
          </div>
          <input
            id="component-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => updateParam(item.uid, '_opacity', Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))] cursor-pointer h-1 appearance-auto"
            aria-valuetext={`Opacity: ${opacity}`}
          />
          <ScopeControl
            value={scope}
            onChange={(v) => setComponent(item.uid, { scope: v })}
          />
        </div>

        {/* Hidden toggle — checkbox-styled (avoids duplicate role="switch" with the effect toggle) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium text-muted-foreground">Hidden</span>
          <div className="flex items-center gap-2">
            {hidden && <Badge variant="warning">Hidden</Badge>}
            <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {hidden ? 'On' : 'Off'}
            </span>
            <button
              type="button"
              role="checkbox"
              aria-checked={hidden}
              aria-label="Hidden"
              onClick={() => toggleSwitch(item.uid)}
              className={cn(
                'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                hidden ? 'bg-primary' : 'bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                  hidden ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        {collapsed ? (
          <div className="mx-4 shrink-0 self-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(false)}
              aria-label="Expand tabs"
              aria-expanded={false}
            >
              {tab === 'controls' ? 'Controls' : `Effects (${item.effects?.length ?? 0})`}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="mx-4 flex shrink-0 items-center gap-1 self-start">
            <TabsList>
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="effects">Effects (${item.effects?.length ?? 0})</TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse tabs"
              aria-expanded={true}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {tab === 'controls' && (
        <TabsContent value="controls" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full">
        <div className="space-y-5 p-4">
          {def.controls
            .filter((c: ControlDef) => !c.modes || c.modes.includes(String(item.params.mode ?? '')))
            .map((c: ControlDef) => (
              <div key={c.param} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={c.param}
                    title={c.min !== undefined && c.max !== undefined ? `Range ${c.min}–${c.max}` : undefined}
                    className="truncate text-[12px] font-medium text-muted-foreground"
                  >
                    {c.label}
                  </label>
                  <ValuePill value={Number(item.params[c.param] ?? 0)} className="mr-2" />
                </div>

                {/* Native control */}
                {c.kind === 'slider' && (
                  <input
                    id={c.param}
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={Number(item.params[c.param] ?? 0)}
                    onChange={(e) => updateParam(item.uid, c.param, Number(e.target.value))}
                    className="w-full accent-[hsl(var(--primary))] cursor-pointer h-1 appearance-auto"
                    aria-valuetext={`${c.label}: ${Number(item.params[c.param] ?? 0)}`}
                  />
                )}
                {c.kind === 'select' && (
                  <select
                    id={c.param}
                    value={String(item.params[c.param] ?? '')}
                    onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {(c.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
                {c.kind === 'color' && (
                  <input
                    id={c.param}
                    type="color"
                    value={String(item.params[c.param] ?? '#000000')}
                    onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                    className="h-9 w-full cursor-pointer p-1"
                  />
                )}
                {c.kind === 'text' && (
                  <input
                    id={c.param}
                    type="text"
                    value={String(item.params[c.param] ?? '')}
                    onChange={(e) => updateParam(item.uid, c.param, e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
            ))}

          {/* Automations section */}
          {item.automations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Automations
                </h4>
                {item.automations.map((a) => (
                  <div key={a.param} className="flex items-center gap-2">
                    <span className="text-[12px]">{a.param}</span>
                    <Badge variant="outline">{a.keyframes.length} keys</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger hover:text-danger"
                      aria-label={`Remove automation ${a.param}`}
                      onClick={() => removeAutomation(item.uid, a.param)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
          </ScrollArea>
        </TabsContent>)}

        {tab === 'effects' && (
        <TabsContent value="effects" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
          <NodeOptionsEffects item={item} />
        </TabsContent>)}
      </Tabs>
    </div>
  )
}
