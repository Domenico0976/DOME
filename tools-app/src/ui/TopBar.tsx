import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import type { ProjectState } from '../core/types'
import { ThemeToggle } from './ThemeToggle'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { HelpCircle, LifeBuoy, BookOpen, Video, Users, Archive } from 'lucide-react'

const QUALITY_LABELS: Record<ProjectState['canvas']['quality'], string> = {
  low: 'Low · 360p',
  med: 'Medium · 720p',
  high: 'High · 1080p',
  '4k': 'Ultra 4K',
}

const QUALITIES: ProjectState['canvas']['quality'][] = ['low', 'med', 'high', '4k']

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
      className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 h-[48px]"
      role="banner"
    >
      <Select
        value={quality}
        onValueChange={(v) => setQuality(v as ProjectState['canvas']['quality'])}
      >
        <SelectTrigger className="w-[160px]" aria-label="Preview quality">
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

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => e.preventDefault()}>
          <HelpCircle className="h-4 w-4" />
          Tips
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <LifeBuoy className="h-4 w-4" />
              Support
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Help &amp; resources</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <BookOpen className="h-4 w-4" />
              Guides
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Video className="h-4 w-4" />
              Video tutorials
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Users className="h-4 w-4" />
              Community
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Templates />

        <Button
          variant={unsaved ? 'default' : 'secondary'}
          size="sm"
          aria-label="Save project"
          onClick={save}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 12a2 2 0 0 1 4 0" />
          </svg>
          {unsaved ? 'Unsaved changes' : 'Save Project'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          aria-label={quarantined.length > 0 ? `Quarantined items (${quarantined.length})` : 'Quarantined items'}
          onClick={reviewQuarantine}
          className="relative"
        >
          <Archive className="h-4 w-4" />
          {quarantined.length > 0 && (
            <Badge variant="warning" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px]">
              {quarantined.length}
            </Badge>
          )}
        </Button>

        <AuthModal />
        <ThemeToggle />
      </div>
      <QuarantinePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </header>
  )
}
