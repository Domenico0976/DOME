import { useProjectStore } from '../state/projectStore'
import type { ProjectState } from '../core/types'
import { ThemeToggle } from './ThemeToggle'
import { Templates } from './Templates'

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
    <header className="top-bar">
      <select
        aria-label="Preview quality"
        value={quality}
        onChange={(e) => setQuality(e.target.value as ProjectState['canvas']['quality'])}
      >
        {QUALITIES.map((q) => (
          <option key={q} value={q}>
            {q === '4k' ? 'Ultra 4K' : q}
          </option>
        ))}
      </select>
      <a href="#" onClick={(e) => e.preventDefault()}>
        Tips
      </a>
      <a href="#" onClick={(e) => e.preventDefault()}>
        Support
      </a>
      <Templates />
      <button className="save-project" aria-label="Save project" onClick={save}>
        {unsaved ? 'Unsaved changes' : 'Save Project'}
      </button>
      <ThemeToggle />
    </header>
  )
}
