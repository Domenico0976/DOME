import { useEffect, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { Button } from '../components/ui/button'
import { Gauge, X } from 'lucide-react'

const QUALITY_ORDER: Array<'low' | 'med' | 'high' | '4k'> = ['low', 'med', 'high', '4k']

export function PerfBanner() {
  const perf = useProjectStore((s) => s.perf)
  const quality = useProjectStore((s) => s.canvas.quality)
  const setQuality = useProjectStore((s) => s.setQuality)
  const setPerf = useProjectStore((s) => s.setPerf)

  const [dismissedSession, setDismissedSession] = useState(false)

  // Reset the per-session dismiss if the perf level recovers.
  useEffect(() => {
    if (perf.level === 'ok') setDismissedSession(false)
  }, [perf.level])

  const lowerResolution = () => {
    const idx = QUALITY_ORDER.indexOf(quality)
    if (idx > 0) setQuality(QUALITY_ORDER[idx - 1])
  }

  const dismiss = () => {
    setDismissedSession(true)
    setPerf({ level: 'ok', reason: null })
  }

  if (perf.level !== 'degraded' || dismissedSession) return null

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-border bg-warning/10 px-4 py-2 text-[13px]"
      role="status"
      aria-live="polite"
      data-testid="perf-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Gauge className="h-4 w-4 text-warning shrink-0" />
        <span className="text-foreground">
          Performance limited — preview quality reduced to maintain realtime playback.
        </span>
        {perf.reason && <span className="text-muted-foreground hidden sm:inline">({perf.reason})</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="secondary" size="sm" onClick={lowerResolution} className="h-7 px-2 text-[12px]">
          Lower resolution
        </Button>
        <Button variant="ghost" size="sm" onClick={dismiss} className="h-7 px-2 text-[12px]">
          <X className="h-3 w-3" />
          Dismiss for session
        </Button>
      </div>
    </div>
  )
}