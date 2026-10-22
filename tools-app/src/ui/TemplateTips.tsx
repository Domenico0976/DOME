import { useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { AUDIO_RECIPES, type AudioRecipe } from '../audio/presets'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { ChevronDown, Music2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface TemplateTipsProps {
  selectedUid: string | null
  onPick?: (uid: string, param: string) => void
}

function RecipeCard({ recipe, itemUid, onPick }: { recipe: AudioRecipe; itemUid: string | null; onPick?: (uid: string, param: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const handleTry = () => {
    if (!itemUid) return
    for (const b of recipe.bindings) {
      const st = useProjectStore.getState()
      const item = st.stack.find((i) => i.uid === itemUid)
      if (!item) continue
      let eff = item.effects?.find((e) => e.type === b.effectType)
      if (!eff) {
        st.addEffect(itemUid, b.effectType)
        const next = useProjectStore.getState().stack.find((i) => i.uid === itemUid)
        eff = next?.effects?.filter((e) => e.type === b.effectType).pop()
      }
      if (!eff) continue
      st.addAudioBinding(itemUid, { param: `${eff.uid}.${b.param}`, source: b.source, curve: 'linear', amount: b.amount })
      if (onPick) onPick(itemUid, `${eff.uid}.${b.param}`)
    }
  }

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--soundbar-reactive-text)]">♪</span>
          <span className="text-[12px] font-semibold">{recipe.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse tip' : 'Expand tip'}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </Button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-[11px] leading-snug text-foreground">{recipe.whatItDoes}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{recipe.consequence}</p>
          <p className="text-[11px] leading-snug text-warning">{recipe.risk}</p>
          {itemUid && (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-full text-[11px]"
              onClick={handleTry}
            >
              Try this
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TemplateTips({ selectedUid, onPick }: TemplateTipsProps) {
  const [open, setOpen] = useState(false)
  const selected = useProjectStore((s) => (selectedUid ? s.stack.find((i) => i.uid === selectedUid) ?? null : null))

  if (!selected) return null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium">Templates</span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {AUDIO_RECIPES.length}
          </Badge>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2">
          {AUDIO_RECIPES.map((r) => (
            <RecipeCard key={r.id} recipe={r} itemUid={selectedUid} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  )
}
