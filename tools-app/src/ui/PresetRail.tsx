import { useMemo } from 'react'
import { useProjectStore } from '../state/projectStore'
import { Button } from '../components/ui/button'
import { useToast } from './Toast'
import { PresetSettingsFields } from './PresetSettingsFields'
import { PresetTable } from './PresetTable'
import { cn } from '../lib/utils'
import type { AudioBinding, StackItem } from '../core/types'

interface PresetRailProps {
  stack: StackItem[]
  selected: StackItem | null
  targetOptions: { key: string; label: string }[]
  driver: AudioBinding['source']
  setDriver: (d: AudioBinding['source']) => void
  targetParam: string
  setTargetParam: (v: string) => void
  amount: number
  setAmount: (v: number) => void
  creatorOpen: boolean
  setCreatorOpen: React.Dispatch<React.SetStateAction<boolean>>
  megaOpen: boolean
  onOpenMegaMenu: (focus?: { hoveredLayerUid?: string; hoveredEffectUid?: string }) => void
  onFocusParam?: (focus: string) => void
  className?: string
}

export function PresetRail({
  stack,
  selected,
  targetOptions,
  driver,
  setDriver,
  targetParam,
  setTargetParam,
  amount,
  setAmount,
  creatorOpen,
  setCreatorOpen,
  megaOpen,
  onOpenMegaMenu,
  onFocusParam,
  className,
}: PresetRailProps) {
  const addAudioBinding = useProjectStore((s) => s.addAudioBinding)
  const { toast } = useToast()

  const count = useMemo(() => stack.reduce((k, i) => k + i.audio.length, 0), [stack])

  return (
    <div className={cn('flex min-h-0 flex-col py-2', className)}>
      <div className="mb-1 flex items-center">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Presets · {count}
        </span>
      </div>
      {creatorOpen && (
        <div className="mb-1 space-y-2 rounded-md border border-border bg-surface p-2">
          {(() => {
            const key = targetParam || targetOptions[0]?.key
            const binding = key && selected ? selected.audio.find((b) => b.param === key) : undefined
            if (binding) {
              return (
                <button
                  type="button"
                  onClick={() => onFocusParam?.(key)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-left transition-colors hover:bg-surface-2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    React to: {binding.source} · Sens {Math.round(binding.amount * 100)}%
                  </span>
                </button>
              )
            }
            if (!selected || targetOptions.length === 0) {
              return (
                <div className="text-[11px] text-muted-foreground">
                  Select a layer to create an audio modulation.
                </div>
              )
            }
            return (
              <>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Target parameter
                  <select
                    aria-label="Target parameter"
                    value={targetParam || targetOptions[0].key}
                    onChange={(e) => setTargetParam(e.target.value)}
                    className="mt-1 h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
                  >
                    {targetOptions.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <PresetSettingsFields
                  driver={driver}
                  setDriver={setDriver}
                  amount={amount}
                  setAmount={setAmount}
                />
                {(() => {
                  const clashKey = targetParam || targetOptions[0]?.key
                  const clash = clashKey
                    ? selected.audio.find((b) => b.param === clashKey && b.source !== driver)
                    : undefined
                  return clash ? (
                    <p className="text-[11px] leading-tight text-warning" role="note">
                      Replaces existing {clash.source} → {clashKey} modulation.
                    </p>
                  ) : null
                })()}
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 w-full text-[11px]"
                  disabled={!selected}
                  onClick={() => {
                    const addKey = targetParam || targetOptions[0]?.key
                    if (!selected || !addKey) return
                    const existing = selected.audio.find((b) => b.param === addKey)
                    addAudioBinding(selected.uid, {
                      param: addKey,
                      source: driver,
                      curve: 'linear',
                      amount,
                    })
                    setCreatorOpen(false)
                    if (existing && existing.source !== driver) {
                      toast(
                        `Updated ${addKey}: ${existing.source} → ${driver} (one modulation per parameter)`,
                        { kind: 'warning' },
                      )
                    }
                  }}
                >
                  Add modulation
                </Button>
              </>
            )
          })()}
        </div>
      )}
      <PresetTable
        className="min-h-0 flex-1"
        stack={stack}
        megaOpen={megaOpen}
        onOpenMegaMenu={onOpenMegaMenu}
        onFocusParam={onFocusParam}
      />
    </div>
  )
}
