import { cn } from '../lib/utils'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { ScrollArea } from '../components/ui/scroll-area'
import { useProjectStore } from '../state/projectStore'
import { Archive, Trash2, RefreshCw, FileX } from 'lucide-react'

export interface QuarantineEntry {
  id: string
  binding: {
    param: string
    source: string
    curve: 'linear' | 'invert'
    amount: number
  }
  fromUid: string
  effectUid: string | null
  reason: string
  createdAt: string
}

interface QuarantinePanelProps {
  open: boolean
  onClose: () => void
}

export function QuarantinePanel({ open, onClose }: QuarantinePanelProps) {
  const quarantined = useProjectStore((s) => s.quarantined ?? [])
  const restoreBinding = useProjectStore((s) => s.restoreBinding)
  const deleteBinding = useProjectStore((s) => s.deleteBinding)

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-50 flex h-full w-[340px] max-w-[calc(100vw-2rem)] flex-col border-l border-border bg-surface shadow-2xl',
      )}
      data-testid="quarantine-panel"
      role="dialog"
      aria-label="Quarantined bindings"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold">Quarantined items</span>
          <Badge variant="warning" className="text-[11px]">
            {quarantined.length}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quarantine panel"
          className="grid h-6 w-6 place-items-center rounded-md hover:bg-surface-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {quarantined.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <FileX className="h-8 w-8 text-muted-foreground/60" />
            <span className="text-[13px] text-muted-foreground">No quarantined items</span>
            <span className="text-[11px] text-muted-foreground/70">
              Removed effects or layers move their audio bindings here — never deleted silently.
            </span>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 p-3">
              {quarantined.map((q) => (
                <div
                  key={q.id}
                  className="rounded-md border border-border bg-surface-2/60 p-3"
                  data-testid="quarantine-entry"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-foreground truncate">
                      {q.binding.source} → {q.effectUid ? `${q.fromUid}.${q.effectUid}` : q.fromUid}
                    </span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {q.reason}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground truncate">
                    param: {q.binding.param} · amount {q.binding.amount}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => restoreBinding(q.id)}
                      className="h-7 px-2 text-[12px]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteBinding(q.id)}
                      className="h-7 px-2 text-[12px]"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}