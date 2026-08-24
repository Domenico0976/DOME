import { useState } from 'react'
import { isPatchSpec } from '../engine/patch'
import type { ParamValue } from '../engine/patch'
import type { PortAddress } from '../engine/types'
import { useToolStore } from '../state/store'
import { ChainPlusButton, createChainedNode } from './ChainPlus'
import { NodePreview } from './NodePreview'

interface SourceOption {
  address: PortAddress
  label: string
}

export function Inspector() {
  const selectedNodeId = useToolStore((state) => state.selectedNodeId)
  const execute = useToolStore((state) => state.execute)
  const model = useToolStore((state) => state.model)
  const registry = useToolStore((state) => state.registry)
  // Preview starts open on mobile (≤900px), closed on desktop.
  const [previewOpen, setPreviewOpen] = useState(() =>
    window.matchMedia('(max-width: 900px)').matches,
  )

  const node = selectedNodeId === null ? undefined : model.getNode(selectedNodeId)
  const def = node === undefined ? undefined : registry.get(node.type)?.def

  if (node === undefined) {
    return <div className="inspector-body">Select a block to edit its settings</div>
  }
  if (def === undefined) {
    return <div className="inspector-body">Loading block…</div>
  }

  const sources: SourceOption[] = model
    .nodes()
    .filter((other) => other.id !== node.id)
    .flatMap((other) => {
      const otherDef = registry.get(other.type)?.def
      return (otherDef?.outputs ?? []).map((port) => ({
        address: `${other.id}.${port.name}` as PortAddress,
        label: `${other.id.slice(0, 6)} · ${port.name}`,
      }))
    })

  const setParam = (key: string, value: ParamValue): void => {
    const previous: ParamValue = node.params[key]
    execute({
      label: `set ${key}`,
      execute: () => {
        node.params[key] = value
      },
      undo: () => {
        node.params[key] = previous
      },
    })
  }

  return (
    <div className="inspector-body">
      <div className="inspector-node">{def.label}</div>

      <div className="chain-plus-row">
        <ChainPlusButton
          nodeId={node.id}
          nodeType={node.type}
          onAddNode={() => {
            void createChainedNode(node.id)
          }}
        />
      </div>

      {Object.entries(node.params).map(([key, value]) => (
        <div key={key} className="param-row">
          <label className="param-key" htmlFor={`param-${node.id}-${key}`}>
            {key}
          </label>
          {typeof value === 'number' ? (
            <input
              id={`param-${node.id}-${key}`}
              type="number"
              step="0.01"
              value={value}
              onChange={(event) => setParam(key, Number(event.target.value) || 0)}
            />
          ) : null}
          <select
            aria-label={`Audio control for ${key}`}
            className="audio-control"
            value={isPatchSpec(value) ? value.$patch.from : ''}
            onChange={(event) => {
              const requested = event.target.value
              if (requested === '') {
                setParam(key, 0)
                return
              }
              const match = sources.find((option) => option.address === requested)
              if (match !== undefined) setParam(key, { $patch: { from: match.address } })
            }}
          >
            <option value="">Audio Control: off</option>
            {sources.map((option) => (
              <option key={option.address} value={option.address}>
                {option.label}
              </option>
            ))}
          </select>
          {isPatchSpec(value) ? <span className="driven-by">⚡ driven by {value.$patch.from}</span> : null}
        </div>
      ))}

      <section className="preview-section">
        <button
          type="button"
          className="preview-toggle"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}
        >
          <span>Preview</span>
          <span aria-hidden="true">{previewOpen ? '▾' : '▸'}</span>
        </button>
        {previewOpen ? <NodePreview nodeId={node.id} nodeType={node.type} /> : null}
      </section>

      <div className="ports-info">
        IN: {def.inputs.map((port) => port.name).join(', ') || '—'} · OUT:{' '}
        {def.outputs.map((port) => port.name).join(', ') || '—'}
      </div>
    </div>
  )
}
