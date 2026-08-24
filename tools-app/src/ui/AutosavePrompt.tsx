interface AutosavePromptProps {
  onRestore(): void
  onDiscard(): void
}

export function AutosavePrompt({ onRestore, onDiscard }: AutosavePromptProps) {
  return (
    <div className="autosave-prompt" role="dialog" aria-label="Restored session">
      <p>We kept your last session safe.</p>
      <div className="autosave-actions">
        <button type="button" onClick={onRestore}>
          Restore
        </button>
        <button type="button" onClick={onDiscard}>
          Start fresh
        </button>
      </div>
    </div>
  )
}
