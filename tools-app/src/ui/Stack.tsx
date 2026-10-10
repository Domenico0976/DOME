import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool, getCatalog } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { Catalog } from './Catalog'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../components/ui/tooltip'
import { SwitchCamera, EyeOff, X, Plus, ArrowUp, ArrowDown, Grip, Music, Sliders } from 'lucide-react'
import { cn } from '../lib/utils'
import { ScrollArea } from '../components/ui/scroll-area'

interface LayerBadgesProps {
  index: number
  item: { audio?: { param: string; source: string }[]; effects?: { enabled: boolean }[]; hidden: boolean }
}

/** Layer-stack badges — spec §2: always-visible `#N`, `♪N` (tooltip per binding),
 *  `fN` (enabled count), Hidden as Badge. No badge rendered for zero counts. */
export function LayerBadges({ index, item }: LayerBadgesProps) {
  const audioCount = item.audio?.length ?? 0
  const effects = item.effects ?? []
  const enabledEffects = effects.filter((e) => e.enabled).length

  const audioTooltip =
    audioCount > 0
      ? item.audio!.map((b) => `${b.param} → ${b.source}`).join('\n')
      : undefined

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="outline" className="text-[10px] font-semibold tabular-nums px-1.5 py-0">
          #{index}
        </Badge>
        {audioCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex"
                data-testid="audio-badge"
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold tabular-nums px-1.5 py-0 cursor-help"
                >
                  <Music className="h-3 w-3 mr-0.5" />♪{audioCount}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] whitespace-pre-line">
              {audioTooltip}
            </TooltipContent>
          </Tooltip>
        )}
        {enabledEffects > 0 && (
          <Badge
            variant="secondary"
            className="text-[10px] font-semibold tabular-nums px-1.5 py-0"
            data-testid="effects-badge"
          >
            <Sliders className="h-3 w-3 mr-0.5" />f{enabledEffects}
          </Badge>
        )}
        {item.hidden && <Badge variant="warning">Hidden</Badge>}
      </div>
    </TooltipProvider>
  )
}

export function Stack() {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const selectTool = useProjectStore((s) => s.selectTool)
  const toggleSwitch = useProjectStore((s) => s.toggleSwitch)
  const removeTool = useProjectStore((s) => s.removeTool)
  const moveTool = useProjectStore((s) => s.moveTool)
  const switchTool = useProjectStore((s) => s.switchTool)
  const [addAbove, setAddAbove] = useState<string | null>(null)
  const [switchUid, setSwitchUid] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  return (
    <ScrollArea className="flex-1 max-h-[50vh] rounded-md border border-border bg-surface">
      <div className="flex flex-col gap-1 p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stack</span>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Add tool to stack"
            data-catalog-trigger
            onClick={(e) => {
              e.stopPropagation()
              setShowCatalog((v) => !v)
              setAddAbove(null)
              setSwitchUid(null)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Empty state */}
        {stack.length === 0 && (
          <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
            Add a tool with + to begin
          </div>
        )}

        {/* Nodes */}
        {stack.map((it) => {
          const def = resolveTool(it.toolId, it.toolVersion)
          const isSelected = selectedUid === it.uid
          const sameKind = def ? getCatalog()[def.category].filter((t) => t.id !== it.toolId) : []
          return (
            <div
              key={it.uid}
              className={cn(
                'group relative rounded-md border px-2 py-1.5 cursor-pointer transition-colors',
                isSelected ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
                it.hidden && 'opacity-60',
              )}
              onClick={() => {
                selectTool(it.uid)
                setAddAbove(null)
                setSwitchUid(null)
              }}
            >
              {/* Grip handle for reorder */}
              <div
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Drag to reorder"
                role="button"
                tabIndex={0}
              >
                <Grip className="h-3 w-3 text-muted-foreground" />
              </div>

              {/* Row content */}
              <div className="flex items-center gap-2 ml-6">
                {/* Layer-stack badges (always visible) */}
                <LayerBadges index={stack.findIndex((i) => i.uid === it.uid)} item={it} />
                {/* Icon + label */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
                  <span className="truncate font-medium text-[13px]">{def?.label ?? it.toolId}</span>
                </div>

                {/* Action cluster (always visible with minimum opacity) */}
                <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Switch tool"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSwitchUid(it.uid)
                    setAddAbove(null)
                  }}
                >
                  <SwitchCamera className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Move up"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveTool(it.uid, 'up')
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Move down"
                  onClick={(e) => {
                    e.stopPropagation()
                    moveTool(it.uid, 'down')
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Hide node"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSwitch(it.uid)
                  }}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:text-danger"
                  aria-label="Remove node"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTool(it.uid)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Add tool above"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddAbove(it.uid)
                    setSwitchUid(null)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Inline Catalog panel */}
            {addAbove === it.uid && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <Catalog anchorUid={it.uid} onClose={() => setAddAbove(null)} />
              </div>
            )}

            {/* Switch picker panel */}
            {switchUid === it.uid && (
              <div
                className="mt-2 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {sameKind.length === 0 && (
                  <span className="block rounded-sm px-2 py-1 text-[13px] text-muted-foreground">
                    No alternatives
                  </span>
                )}
                {sameKind.map((t) => (
                  <button
                    key={t.id}
                    className="block w-full rounded-sm px-2 py-1 text-left text-[13px] hover:bg-surface-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      switchTool(it.uid, t.id)
                      setSwitchUid(null)
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Global catalog toggle */}
      {showCatalog && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <Catalog anchorUid={null} onClose={() => setShowCatalog(false)} />
        </div>
      )}
    </div>
    </ScrollArea>
  )
}
