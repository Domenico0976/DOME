import { useEffect, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { ToolIcon } from './toolIcon'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

interface PresetMegaMenuProps {
  onPick: (itemUid: string, param: string) => void
  onClose: () => void
}

export function PresetMegaMenu({ onPick, onClose }: PresetMegaMenuProps) {
  const stack = useProjectStore((s) => s.stack)
  const selectedUid = useProjectStore((s) => s.selectedUid)
  const [hoveredUid, setHoveredUid] = useState<string | null>(selectedUid ?? stack[0]?.uid ?? null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const hovered = stack.find((i) => i.uid === hoveredUid) ?? null
  const hoveredDef = hovered ? resolveTool(hovered.toolId, hovered.toolVersion) : null
  const hoveredControls = (hoveredDef?.controls ?? []).filter((c) => c.kind === 'slider')

  return (
    <>
      <button
        type="button"
        aria-label="Close scene presets"
        onClick={onClose}
        className="fixed inset-0 z-[54] cursor-default bg-transparent"
      />
      <div
        role="dialog"
        aria-label="Scene presets"
        aria-modal="false"
        className="fixed bottom-[148px] left-4 z-[55] flex h-[52vh] max-h-[70vh] w-[560px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border bg-popover shadow-xl"
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-[13px] font-semibold">New preset</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close scene presets" autoFocus onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-1/2 min-w-0 flex-col border-r border-border">
            <span className="shrink-0 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Scene · {stack.length}
            </span>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {stack.length === 0 && (
                <span className="px-2 py-1 text-[12px] text-muted-foreground">Empty scene — add a tool first.</span>
              )}
              {stack.map((item, index) => {
                const def = resolveTool(item.toolId, item.toolVersion)
                const active = hoveredUid === item.uid
                return (
                  <button
                    key={item.uid}
                    type="button"
                    aria-pressed={active}
                    onMouseEnter={() => setHoveredUid(item.uid)}
                    onFocus={() => setHoveredUid(item.uid)}
                    onClick={() => setHoveredUid(item.uid)}
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
                    )}
                  >
                    <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{def?.label ?? item.toolId}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                      #{index}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex w-1/2 min-w-0 flex-col">
            <span className="shrink-0 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              {hovered ? `Settings · ${hoveredDef?.label ?? hovered.toolId}` : 'Settings'}
            </span>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {!hovered && <span className="px-2 py-1 text-[12px] text-muted-foreground">Hover a scene element.</span>}
              {hoveredControls.map((c) => (
                <button
                  key={c.param}
                  type="button"
                  onClick={() => onPick(hovered!.uid, c.param)}
                  aria-label={`Modulate ${c.label} on ${hoveredDef?.label ?? hovered!.toolId}`}
                  className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-[12px] font-medium">{c.label}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {c.min ?? ''}–{c.max ?? ''}
                  </span>
                </button>
              ))}
              {hovered && hoveredControls.length === 0 && (
                <span className="px-2 py-1 text-[12px] text-muted-foreground">No slider settings on this element.</span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border px-4 py-2">
          <span className="text-[11px] text-muted-foreground">
            Hover a scene element, pick a setting — the creator opens prefilled.
          </span>
        </div>
      </div>
    </>
  )
}
