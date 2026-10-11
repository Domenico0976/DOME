import { Slider } from '../components/ui/slider'
import type { AudioBinding } from '../core/types'

const DRIVERS: Array<AudioBinding['source']> = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm']

interface PresetSettingsFieldsProps {
  driver: AudioBinding['source']
  setDriver: (d: AudioBinding['source']) => void
  amount: number
  setAmount: (v: number) => void
}

export function PresetSettingsFields({ driver, setDriver, amount, setAmount }: PresetSettingsFieldsProps) {
  return (
    <>
      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground">
        React to
        <select
          aria-label="Audio driver"
          value={driver}
          onChange={(e) => setDriver(e.target.value as AudioBinding['source'])}
          className="mt-1 h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
        >
          {DRIVERS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sensitivity</span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
            {Math.round(amount * 100)}%
          </span>
        </div>
        <Slider
          aria-label="Sensitivity"
          min={0}
          max={2}
          step={0.05}
          value={[amount]}
          onValueChange={([v]) => setAmount(v)}
        />
      </div>
    </>
  )
}
