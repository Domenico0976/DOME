import { useEffect } from 'react'
import { useToolStore } from '../state/store'

export function ImportControls() {
  const importStatus = useToolStore((state) => state.importStatus)
  const setImportStatus = useToolStore((state) => state.setImportStatus)

  useEffect(() => {
    if (importStatus === null) return
    const timer = setTimeout(() => setImportStatus(null), 6000)
    return () => clearTimeout(timer)
  }, [importStatus, setImportStatus])

  const handleFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const result = useToolStore.getState().importProjectRaw(JSON.parse(text) as unknown)
      if (!result.ok) useToolStore.getState().setImportStatus(result.message)
    } catch {
      useToolStore.getState().setImportStatus('That file could not be read')
    }
  }

  return (
    <div className="import-controls">
      <label className="import-button">
        Import project
        <input
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file !== undefined) void handleFile(file)
          }}
        />
      </label>
      {importStatus !== null ? <div className="import-status">{importStatus}</div> : null}
    </div>
  )
}
