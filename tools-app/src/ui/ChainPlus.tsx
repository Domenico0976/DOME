import { NODE_METADATA, loadRegistryEntry } from '../nodes'
import { addNodeCommand, connectCommand } from '../engine/graph'
import type { GraphNode } from '../engine/graph'
import { CompositeCommand } from '../engine/history'
import { useToolStore } from '../state/store'
import { useIsMobileViewport } from '../hooks/useMediaQuery'

// Canonical guided chain: each block knows the logical next block.
// Unknown types and the final output block return null.
const CHAIN_NEXT: Readonly<Record<string, string>> = {
  'input.audio-file': 'analyser.audio',
  'analyser.audio': 'map.gain-offset',
  'map.gain-offset': 'render.canvas',
}

export function getNextLogicalNode(currentNodeType: string): string | null {
  return CHAIN_NEXT[currentNodeType] ?? null
}

const NODE_SEED_PARAMS: Record<string, Record<string, number>> = {
  'source.lfo-noise': { mode: 0, rateHz: 1, phase: 0 },
  'map.gain-offset': { gain: 1, offset: 0 },
  'render.canvas': { mode: 0 },
}

function chainPlusAlwaysEnabled(): boolean {
  try {
    return window.localStorage.getItem('dome.chain-plus-always') === '1'
  } catch {
    return false
  }
}

// Shared quick-add used by Palette, the mobile "Create block" sheet and chains.
export async function addNodeByType(type: string): Promise<string> {
  const entry = await loadRegistryEntry(type)
  const snapshot = useToolStore.getState()
  snapshot.registerEntry(type, entry)

  const count = snapshot.model.nodes().length
  const id = crypto.randomUUID()
  const x = 60 + (count % 4) * 230
  const y = 40 + Math.floor(count / 4) * 150

  snapshot.execute(
    addNodeCommand(snapshot.model, {
      id,
      type,
      params: { ...(NODE_SEED_PARAMS[type] ?? {}) },
      x,
      y,
    }),
  )
  snapshot.select(id)
  return id
}

// Creates the logical next node offset from sourceNodeId and auto-connects the
// primary output → primary input as a single undoable composite command.
// Connecting a brand-new node can never duplicate an input or form a cycle:
// the new node has no incoming connections and no outgoing edges yet.
export async function createChainedNode(sourceNodeId: string): Promise<string | null> {
  const snapshot = useToolStore.getState()
  const source = snapshot.model.getNode(sourceNodeId)
  if (source === undefined) return null

  const nextType = getNextLogicalNode(source.type)
  if (nextType === null) return null

  const entry = await loadRegistryEntry(nextType)
  snapshot.registerEntry(nextType, entry)

  const id = crypto.randomUUID()
  const x = (source.x ?? 60) + 250
  const y = source.y ?? 40
  const newNode: GraphNode = {
    id,
    type: nextType,
    params: { ...(NODE_SEED_PARAMS[nextType] ?? {}) },
    x,
    y,
  }

  const composite = new CompositeCommand(`add chained ${nextType}`)
  composite.add(addNodeCommand(snapshot.model, newNode))

  const sourceDef = snapshot.registry.get(source.type)?.def
  const outPort = sourceDef?.outputs[0]?.name
  const inPort = entry.def.inputs[0]?.name
  if (outPort !== undefined && inPort !== undefined) {
    composite.add(connectCommand(snapshot.model, `${sourceNodeId}.${outPort}`, `${id}.${inPort}`))
  }

  snapshot.execute(composite)
  snapshot.select(id)
  return id
}

// Creates the first node of a chain from a palette type, then walks the whole
// canonical chain forward (e.g. Sound Block → Sound Reader → Reaction → Canvas).
export async function createChainedSequence(startType: string): Promise<void> {
  let currentId: string | null = await addNodeByType(startType)
  while (currentId !== null) {
    currentId = await createChainedNode(currentId)
  }
}

interface ChainPlusButtonProps {
  nodeId: string
  nodeType: string
  onAddNode: (type: string) => void
  alwaysShow?: boolean
}

export function ChainPlusButton({ nodeId, nodeType, onAddNode, alwaysShow = false }: ChainPlusButtonProps) {
  const isMobile = useIsMobileViewport()
  if (!isMobile && !alwaysShow && !chainPlusAlwaysEnabled()) return null

  const nextType = getNextLogicalNode(nodeType)
  if (nextType === null) return null

  const nextLabel = NODE_METADATA.find((meta) => meta.type === nextType)?.label ?? nextType
  return (
    <button
      type="button"
      className="chain-plus-button"
      title={`Add ${nextLabel} and connect it`}
      data-source-node-id={nodeId}
      onClick={() => onAddNode(nextType)}
    >
      <span aria-hidden="true">＋</span> Add {nextLabel}
    </button>
  )
}
