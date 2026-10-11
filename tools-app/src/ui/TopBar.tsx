import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import type { ProjectState } from '../core/types'
import { Templates } from './Templates'
import { AuthModal } from './AuthModal'
import { useToast } from './Toast'
import { QuarantinePanel } from './QuarantinePanel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Sparkles, Archive } from 'lucide-react'

const QUALITY_LABELS: Record<ProjectState['canvas']['quality'], string> = {
  low: 'Low · 360p',
  med: 'Medium · 720p',
  high: 'High · 1080p',
  '4k': 'Ultra 4K',
}

const QUALITIES: ProjectState['canvas']['quality'][] = ['low', 'med', 'high', '4k']

const CLUSTER =
  'pointer-events-auto flex items-center gap-2 rounded-[8px] border border-border bg-surface-panel px-2 py-1'

export function TopBar() {
  const quality = useProjectStore((s) => s.canvas.quality)
  const setQuality = useProjectStore((s) => s.setQuality)
  const unsaved = useProjectStore((s) => s.unsaved)
  const quarantined = useProjectStore((s) => s.quarantined ?? [])
  const markSaved = useProjectStore((s) => s.markSaved)
  const { toast } = useToast()
  const [panelOpen, setPanelOpen] = useState(false)

  const save = () => {
    const state = useProjectStore.getState()
    localStorage.setItem('dome-project', JSON.stringify(state))
    markSaved()
    toast('Project saved', { kind: 'success' })
  }

  const reviewQuarantine = () => {
    setPanelOpen(true)
    if (quarantined.length > 0) {
      toast(`${quarantined.length} quarantined binding${quarantined.length === 1 ? '' : 's'} need review`, {
        kind: 'warning',
        actions: [{ label: 'Review', onClick: () => setPanelOpen(true) }],
      })
    }
  }

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-[var(--z-global-chrome)] flex items-start justify-between gap-3 px-5 py-2"
      role="banner"
    >
      <div className={CLUSTER}>
        <Sparkles className="h-[18px] w-[18px] text-primary" aria-hidden />
        <Select
          value={quality}
          onValueChange={(v) => setQuality(v as ProjectState['canvas']['quality'])}
        >
          <SelectTrigger
            className="h-8 w-[168px] border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Preview quality"
          >
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            {QUALITIES.map((q) => (
              <SelectItem key={q} value={q}>
                {QUALITY_LABELS[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Templates />
      </div>

      <div className={CLUSTER}>
        <Button
          variant={unsaved ? 'default' : 'outline'}
          size="sm"
          className="h-8 rounded-[8px] text-[13px]"
          aria-label="Save project"
          onClick={save}
        >
          {unsaved ? 'Unsaved changes' : 'Save Project'}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-[8px]"
          aria-label={
            quarantined.length > 0
              ? `Quarantined items (${quarantined.length})`
              : 'Quarantined items'
          }
          onClick={reviewQuarantine}
        >
          <Archive className="h-4 w-4" />
          {quarantined.length > 0 && (
            <Badge variant="warning" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px]">
              {quarantined.length}
            </Badge>
          )}
        </Button>

        <AuthModal />
      </div>
      <QuarantinePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </header>
  )
}
