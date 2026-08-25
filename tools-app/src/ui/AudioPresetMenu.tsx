import { useState, useEffect, useRef, useMemo } from 'react'
import { getCatalog } from '../core/registry'
import type { AudioPreset, ToolDef } from '../core/types'
import { cn } from '../lib/utils'

interface AudioPresetMenuProps {
  open: boolean
  anchorEl: HTMLElement | null
  onSelect: (preset: { toolId: string; param: string; reactTo: AudioPreset['reactTo'] }) => void
  onClose: () => void
}

const AUDIO_SOURCES: AudioPreset['reactTo'][] = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm']

export function AudioPresetMenu({ open, anchorEl, onSelect, onClose }: AudioPresetMenuProps) {
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null)
  const [selectedParam, setSelectedParam] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const tools = useMemo(() => {
    const catalog = getCatalog()
    return [...catalog.Inputs, ...catalog.Generative, ...catalog.Filters]
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedTool(null)
      setSelectedParam(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      const target = e.target
      if (!(target instanceof Node)) return
      if (!menuRef.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open, onClose])

  if (!open || !anchorEl) return null

  const rect = anchorEl.getBoundingClientRect()

  const handleSelectSource = (source: AudioPreset['reactTo']) => {
    if (!selectedTool || !selectedParam) return
    onSelect({
      toolId: selectedTool.id,
      param: selectedParam,
      reactTo: source,
    })
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 flex rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
      style={{
        top: rect.bottom + 4,
        left: rect.left,
        maxHeight: '400px',
      }}
    >
      {/* Column 1: Tools */}
      <div className="w-[160px] flex flex-col border-r border-border">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
          Tools
        </div>
        <div className="flex-1 overflow-y-auto">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className={cn(
                'w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2',
                selectedTool?.id === tool.id && 'bg-surface-2',
              )}
              onClick={() => {
                setSelectedTool(tool)
                setSelectedParam(null)
              }}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column 2: Parameters */}
      <div className="w-[160px] flex flex-col border-r border-border">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
          Parameters
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedTool ? (
            selectedTool.controls.length > 0 ? (
              selectedTool.controls.map((control) => (
                <button
                  key={control.param}
                  className={cn(
                    'w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2',
                    selectedParam === control.param && 'bg-surface-2',
                  )}
                  onClick={() => setSelectedParam(control.param)}
                >
                  {control.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-[13px] text-muted-foreground">No parameters</div>
            )
          ) : (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">Select a tool</div>
          )}
        </div>
      </div>

      {/* Column 3: Audio Sources */}
      <div className="w-[140px] flex flex-col">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
          React To
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedParam ? (
            AUDIO_SOURCES.map((source) => (
              <button
                key={source}
                className="w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-2 capitalize"
                onClick={() => handleSelectSource(source)}
              >
                {source}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[13px] text-muted-foreground">Select a parameter</div>
          )}
        </div>
      </div>
    </div>
  )
}
