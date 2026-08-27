import { useProjectStore } from '../state/projectStore'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '../components/ui/dialog'
import { LayoutTemplate } from 'lucide-react'

const TEMPLATES: { name: string; stack: unknown[] }[] = [
  { name: 'Blank', stack: [] },
  {
    name: 'Particles',
    stack: [
      { toolId: 'particles', toolVersion: '3.0.0', params: { density: 160 }, audio: [], automations: [], hidden: false },
    ],
  },
  {
    name: 'Image + Halftone',
    stack: [
      { toolId: 'imageVideo', toolVersion: '1.0.0', params: { src: '', mode: 'cover' }, audio: [], automations: [], hidden: false },
      { toolId: 'halftone', toolVersion: '1.0.0', params: { dot: 6 }, audio: [], automations: [], hidden: false },
    ],
  },
]

export function Templates() {
  const loadProject = useProjectStore((s) => s.loadProject)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent max-w-md>
        <DialogHeader>
          <DialogTitle>Templates</DialogTitle>
          <DialogDescription>Start from a preset stack.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {TEMPLATES.map((t) => (
            <DialogClose asChild key={t.name}>
              <Button variant="secondary" className="w-full justify-start" onClick={() => loadProject({ stack: t.stack })}>
                {t.name}
              </Button>
            </DialogClose>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
