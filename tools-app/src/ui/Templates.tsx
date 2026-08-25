import { useProjectStore } from '../state/projectStore'

const TEMPLATES: { name: string; stack: unknown[] }[] = [
  { name: 'Blank', stack: [] },
  {
    name: 'Particles',
    stack: [
      { toolId: 'particles', toolVersion: '1.0.0', params: { density: 160 }, audio: [], automations: [], hidden: false },
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
    <details className="templates">
      <summary>Templates</summary>
      <div className="template-list">
        {TEMPLATES.map((t) => (
          <button key={t.name} className="template-item" onClick={() => loadProject({ stack: t.stack })}>
            {t.name}
          </button>
        ))}
      </div>
    </details>
  )
}
