import { NODE_METADATA } from '../nodes'
import { addNodeByType, createChainedSequence } from './ChainPlus'

export function Palette() {
  return (
    <div className="palette-list">
      {NODE_METADATA.map((meta) => (
        <div key={meta.type} className="palette-item">
          <button
            type="button"
            className="palette-button"
            title={meta.description}
            onClick={() => {
              void addNodeByType(meta.type)
            }}
          >
            + {meta.label}
          </button>
          <button
            type="button"
            className="palette-chain-badge"
            title={`Create a full chain starting from ${meta.label}`}
            aria-label={`Create a full chain starting from ${meta.label}`}
            onClick={() => {
              void createChainedSequence(meta.type)
            }}
          >
            +
          </button>
        </div>
      ))}
    </div>
  )
}
