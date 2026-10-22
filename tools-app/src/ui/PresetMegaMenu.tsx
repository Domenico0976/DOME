import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'
import { EFFECTS, EFFECT_CATEGORIES } from '../engine/effects'
import { ToolIcon } from './toolIcon'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

interface PresetMegaMenuProps {
  onPick: (itemUid: string, param: string) => void
  onClose: () => void
  initialState?: {
    hoveredLayerUid?: string | null
    hoveredEffectUid?: string | null
    scrollTops?: { [key: string]: number }
  }
  onHoverChange?: (state: {
    hoveredLayerUid: string | null
    hoveredEffectUid: string | null
  }) => void
  onSaveScroll?: (scrollTops: { [key: string]: number }) => void
}

const TOOL_SENTINEL = '__tool__'

export function PresetMegaMenu({
  onPick,
  onClose,
  initialState,
  onHoverChange,
  onSaveScroll,
}: PresetMegaMenuProps) {
  const stack = useProjectStore((s) => s.stack)
  const openerRef = useRef<HTMLElement | null>(null)
  const col1Ref = useRef<HTMLDivElement>(null)
  const col2Ref = useRef<HTMLDivElement>(null)
  const col3Ref = useRef<HTMLDivElement>(null)

  const [hoveredLayerUid, setHoveredLayerUid] = useState<string | null>(
    initialState?.hoveredLayerUid ?? stack[0]?.uid ?? null,
  )
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialState?.hoveredEffectUid && initialState.hoveredEffectUid !== TOOL_SENTINEL
      ? initialState.hoveredEffectUid
      : TOOL_SENTINEL,
  )
  const [focusedRow, setFocusedRow] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const setRowRef = useMemo(() => {
    const map = new Map<string, HTMLElement>()
    const fn = (key: string) => (el: HTMLElement | null) => {
      if (el) map.set(key, el)
      else map.delete(key)
    }
    fn.map = map
    return fn
  }, [])
  const focusRow = (key: string) => {
    setRowRef.map.get(key)?.focus()
  }

  const hovered = stack.find((i) => i.uid === hoveredLayerUid) ?? null
  const hoveredDef = hovered ? resolveTool(hovered.toolId, hovered.toolVersion) : null
  const boundParams = new Set((hovered?.audio ?? []).map((b) => b.param))

  const categoryRows = useMemo(() => {
    if (!hovered) return []
    const list: { key: string; label: string }[] = [
      { key: TOOL_SENTINEL, label: 'Tool params (no effect)' },
    ]
    const seen = new Set<string>()
    for (const e of hovered.effects ?? []) {
      const cat = EFFECT_CATEGORIES[e.type] ?? 'other'
      if (!seen.has(cat)) {
        seen.add(cat)
        list.push({ key: cat, label: cat })
      }
    }
    return list
  }, [hovered])

  const paramGroups = useMemo(() => {
    if (!hovered) return []
    if (selectedCategory === TOOL_SENTINEL) {
      const rows = (hoveredDef?.controls ?? [])
        .filter((c) => c.kind === 'slider')
        .map((c) => ({
          key: c.param,
          label: c.label,
          range: c.min != null && c.max != null ? `${c.min}–${c.max}` : '',
          hasBinding: boundParams.has(c.param),
        }))
      return rows.length > 0 ? [{ header: undefined, rows }] : []
    }
    const groups: Array<{ header: string | undefined; rows: Array<{ key: string; label: string; range: string; hasBinding: boolean }> }> = []
    const seenEffect = new Set<string>()
    for (const e of hovered.effects ?? []) {
      const cat = EFFECT_CATEGORIES[e.type] ?? 'other'
      if (cat !== selectedCategory) continue
      if (seenEffect.has(e.uid)) continue
      seenEffect.add(e.uid)
      const edef = EFFECTS[e.type]
      const rows = (edef?.controls ?? [])
        .filter((c) => c.kind === 'slider')
        .map((c) => ({
          key: `${e.uid}.${c.param}`,
          label: c.label,
          range: c.min != null && c.max != null ? `${c.min}–${c.max}` : '',
          hasBinding: boundParams.has(`${e.uid}.${c.param}`),
        }))
      if (rows.length > 0) {
        groups.push({ header: edef?.label ?? e.type, rows })
      }
    }
    return groups
  }, [hovered, selectedCategory, hoveredDef, boundParams])

  const focusOrder: string[] = useMemo(() => {
    const order: string[] = []
    for (const item of stack) {
      order.push(`layer:${item.uid}`)
      if (item.uid === hoveredLayerUid) {
        for (const cat of categoryRows) {
          order.push(`category:${cat.key}`)
          if (selectedCategory === cat.key) {
            for (const g of paramGroups) {
              for (const r of g.rows) order.push(`param:${r.key}`)
            }
          }
        }
      }
    }
    return order
  }, [stack, hoveredLayerUid, categoryRows, selectedCategory, paramGroups])

  const activeDescendant =
    focusedRow && focusOrder.includes(focusedRow)
      ? `pmrow-${focusedRow.replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : undefined

  const handleCommit = (key: string) => {
    if (!hovered) return
    onPick(hovered.uid, key)
    onClose()
  }

  const handleLayerHover = (uid: string) => {
    setHoveredLayerUid(uid)
    if (!stack.some((i) => i.uid === uid)) return
    const layer = stack.find((i) => i.uid === uid)!
    const cats = [TOOL_SENTINEL]
    for (const e of layer.effects ?? []) {
      cats.push(EFFECT_CATEGORIES[e.type] ?? 'other')
    }
    setSelectedCategory(cats[0])
  }

  const handleCategoryHover = (catKey: string) => {
    setSelectedCategory(catKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const idx = focusedRow ? focusOrder.indexOf(focusedRow) : -1
    const next =
      e.key === 'ArrowDown'
        ? focusOrder[Math.min(idx + 1, focusOrder.length - 1)]
        : focusOrder[Math.max(idx - 1, 0)]
    if (!next) return

    if (next.startsWith('layer:')) {
      handleLayerHover(next.slice(6))
      setFocusedRow(next)
      focusRow(next)
    } else if (next.startsWith('category:')) {
      const key = next.slice(9)
      handleCategoryHover(key)
      setFocusedRow(next)
      focusRow(next)
    } else if (next.startsWith('param:')) {
      setFocusedRow(next)
      focusRow(next)
    }
  }

  // Sync hoveredEffectUid for onHoverChange contract when selectedCategory changes
  useEffect(() => {
    const catKey = selectedCategory === TOOL_SENTINEL ? TOOL_SENTINEL : selectedCategory
    onHoverChange?.({ hoveredLayerUid, hoveredEffectUid: catKey })
  }, [hoveredLayerUid, selectedCategory, onHoverChange])

  // Keep focusedRow cleared when category changes or focused param no longer exists
  useEffect(() => {
    if (!focusedRow) return
    if (focusedRow.startsWith('param:')) {
      const key = focusedRow.slice(6)
      const hasParam = paramGroups.some((g) => g.rows.some((r) => r.key === key))
      if (!hasParam) setFocusedRow(null)
    }
    if (focusedRow.startsWith('category:')) {
      const key = focusedRow.slice(9)
      if (!categoryRows.some((c) => c.key === key)) setFocusedRow(null)
    }
  }, [focusedRow, selectedCategory, categoryRows, paramGroups])

  useEffect(() => {
    openerRef.current = (document.activeElement as HTMLElement) ?? null
    return () => {
      openerRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const tops = initialState?.scrollTops
    if (!tops) return
    if (tops['col1'] != null && col1Ref.current) col1Ref.current.scrollTop = tops['col1']
    if (tops['col2'] != null && col2Ref.current) col2Ref.current.scrollTop = tops['col2']
    if (tops['col3'] != null && col3Ref.current) col3Ref.current.scrollTop = tops['col3']
  }, [initialState?.scrollTops])

  useEffect(() => {
    return () => {
      onSaveScroll?.({
        col1: col1Ref.current?.scrollTop ?? 0,
        col2: col2Ref.current?.scrollTop ?? 0,
        col3: col3Ref.current?.scrollTop ?? 0,
      })
    }
  }, [onSaveScroll])

  if (stack.length === 0) {
    return (
      <>
        <button
          type="button"
          aria-label="Close scene presets"
          onClick={onClose}
          className="fixed inset-0 z-[54] cursor-default bg-transparent"
        />
        <div
          id="preset-cascade"
          data-testid="preset-cascade"
          role="dialog"
          aria-label="Scene presets"
          className="absolute bottom-full left-0 z-[55] mb-2 w-[min(720px,calc(100vw-32px))] rounded-[12px] border border-border bg-surface-panel p-4 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold">New preset</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close scene presets" autoFocus onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">Empty scene — add a tool first.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close scene presets"
        onClick={onClose}
        className="fixed inset-0 z-[54] cursor-default bg-transparent"
      />
      <div
        id="preset-cascade"
        data-testid="preset-cascade"
        ref={rootRef}
        role="dialog"
        aria-label="Scene presets"
        aria-modal="false"
        aria-activedescendant={activeDescendant}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="absolute bottom-full left-0 z-[55] mb-2 flex w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden max-h-[60vh] rounded-[12px] border border-border bg-surface-panel shadow-xl"
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-[13px] font-semibold">New preset</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close scene presets" autoFocus onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Col 1: Layers */}
          <div className="flex w-[200px] shrink-0 flex-col border-r border-border">
            <span className="shrink-0 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              Scene · {stack.length}
            </span>
            <div ref={col1Ref} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {stack.map((item, index) => {
                const def = resolveTool(item.toolId, item.toolVersion)
                const active = hoveredLayerUid === item.uid
                return (
                  <button
                    key={item.uid}
                    ref={setRowRef(`layer:${item.uid}`)}
                    id={`pmrow-layer_${item.uid}`}
                    type="button"
                    tabIndex={-1}
                    aria-pressed={active}
                    onMouseEnter={() => handleLayerHover(item.uid)}
                    onFocus={() => {
                      handleLayerHover(item.uid)
                      setFocusedRow(`layer:${item.uid}`)
                    }}
                    onClick={() => handleLayerHover(item.uid)}
                    className={cn(
                      'flex min-h-[32px] shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'border-primary bg-surface-2' : 'border-border bg-surface hover:bg-surface-2',
                    )}
                  >
                    <ToolIcon name={String(def?.icon ?? 'square')} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{def?.label ?? item.toolId}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                      #{index}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Col 2: Categories */}
          <div className="flex w-[200px] shrink-0 flex-col border-r border-border">
            <span className="shrink-0 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              {hovered ? `Settings · ${hoveredDef?.label ?? hovered.toolId}` : 'Settings'}
            </span>
            <div ref={col2Ref} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {!hovered && <span className="px-2 py-1 text-[12px] text-muted-foreground">Hover a scene element.</span>}
              {hovered && (
                <>
                  <button
                    ref={setRowRef('category:__tool__')}
                    id="pmrow-category___tool__"
                    type="button"
                    tabIndex={-1}
                    aria-pressed={selectedCategory === TOOL_SENTINEL}
                    onMouseEnter={() => handleCategoryHover(TOOL_SENTINEL)}
                    onFocus={() => {
                      handleCategoryHover(TOOL_SENTINEL)
                      setFocusedRow('category:__tool__')
                    }}
                    onClick={() => handleCategoryHover(TOOL_SENTINEL)}
                    aria-label="Select tool parameters"
                    className={cn(
                      'flex min-h-[32px] shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectedCategory === TOOL_SENTINEL && 'border-primary bg-surface-2',
                    )}
                  >
                    <span className="truncate text-[12px] font-medium">Tool params (no effect)</span>
                    {(() => {
                      const count = (hoveredDef?.controls ?? []).filter(
                        (c) => c.kind === 'slider' && boundParams.has(c.param),
                      ).length
                      return count > 0 ? (
                        <Badge variant="audio" className="h-4 min-w-4 px-1 text-[10px]">{count}</Badge>
                      ) : null
                    })()}
                  </button>
                  {categoryRows.filter((cat) => cat.key !== TOOL_SENTINEL).map((cat) => (
                    <button
                      key={cat.key}
                      ref={setRowRef(`category:${cat.key}`)}
                      id={`pmrow-category_${cat.key}`}
                      type="button"
                      tabIndex={-1}
                      aria-pressed={selectedCategory === cat.key}
                      onMouseEnter={() => handleCategoryHover(cat.key)}
                      onFocus={() => {
                        handleCategoryHover(cat.key)
                        setFocusedRow(`category:${cat.key}`)
                      }}
                      onClick={() => handleCategoryHover(cat.key)}
                      aria-label={`Select ${cat.label} category`}
                      className={cn(
                        'flex min-h-[32px] shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedCategory === cat.key && 'border-primary bg-surface-2',
                      )}
                    >
                      <span className="truncate text-[12px] font-medium">{cat.label}</span>
                      <span className="text-[10px] text-muted-foreground">{hovered.effects?.length?.toString() ?? '0'} effects</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Col 3: Params */}
          <div className="flex flex-1 flex-col">
            <span className="shrink-0 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              {selectedCategory === TOOL_SENTINEL
                ? hoveredDef
                  ? `${hoveredDef.label} · Params`
                  : 'Params'
                : `${categoryRows.find((c) => c.key === selectedCategory)?.label ?? selectedCategory} · Params`}
            </span>
            <div ref={col3Ref} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {!hovered && <span className="px-2 py-1 text-[12px] text-muted-foreground">Select an element first.</span>}
              {hovered && paramGroups.length === 0 && (
                <span className="px-2 py-1 text-[12px] text-muted-foreground">No controls available.</span>
              )}
              {paramGroups.map((g, gi) => (
                <div key={gi} className="flex flex-col gap-1">
                  {g.header && (
                    <div
                      data-testid={`effect-header-${gi}`}
                      className="px-2 pt-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      {g.header}
                    </div>
                  )}
                  {g.rows.map((r) => (
                    <button
                      key={r.key}
                      ref={setRowRef(`param:${r.key}`)}
                      id={`pmrow-param_${r.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleCommit(r.key)}
                      onFocus={() => setFocusedRow(`param:${r.key}`)}
                      aria-label={`Modulate ${r.label}`}
                      className={cn(
                        'flex min-h-[32px] shrink-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {r.hasBinding && (
                          <span className="text-[11px] text-[var(--soundbar-reactive-text)]" aria-hidden="true">♪</span>
                        )}
                        <span className="truncate text-[12px] font-medium">{r.label}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {r.range}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}