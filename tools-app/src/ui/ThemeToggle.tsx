import { useProjectStore } from '../state/projectStore'

export function ThemeToggle() {
  const theme = useProjectStore((s) => s.theme)
  const setTheme = useProjectStore((s) => s.setTheme)
  return (
    <button
      className="theme-toggle"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
