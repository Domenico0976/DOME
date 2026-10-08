import { useProjectStore } from '../state/projectStore'
import type { ProjectState } from '../core/types'
import { ThemeToggle } from './ThemeToggle'
import { Templates } from './Templates'
import { AuthModal } from './AuthModal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { HelpCircle, LifeBuoy, BookOpen, Video, Users } from 'lucide-react'

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
  const markSaved = useProjectStore((s) => s.markSaved)
  const save = () => {
    const state = useProjectStore.getState()
    localStorage.setItem('dome-project', JSON.stringify(state))
    markSaved()
  }
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
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

        <AuthModal />
        <ThemeToggle />
      </div>
    </header>
  )
}
