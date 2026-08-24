import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react'
import type { Connection, Edge, EdgeChange, Node, NodeChange, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { connectCommand, disconnectCommand, moveNodeCommand, removeNodeCommand } from '../engine/graph'
import type { PortAddress } from '../engine/types'
import { splitAddress } from '../engine/types'
import { useToolStore } from '../state/store'
import { NODE_METADATA } from '../nodes'
import { useIsMobileViewport } from '../hooks/useMediaQuery'
import { addNodeByType, createChainedNode } from './ChainPlus'
import { ChainPlusButton } from './ChainPlus'
import { BottomSheet } from './BottomSheet'
import { Inspector } from './Inspector'
import { GenericNodeView } from './nodes/GenericNodeView'

const nodeTypes: NodeTypes = { generic: GenericNodeView }

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_TOLERANCE_PX = 12
const DRAG_TAP_GUARD_MS = 250

export function NodeCanvas() {
  const model = useToolStore((state) => state.model)
  const registry = useToolStore((state) => state.registry)
  const tick = useToolStore((state) => state.tick)
  const select = useToolStore((state) => state.select)
  const execute = useToolStore((state) => state.execute)
  const selectedNodeId = useToolStore((state) => state.selectedNodeId)
  const isMobile = useIsMobileViewport()

  const [rfNodes, setRfNodes] = useState<Node[]>([])
  const [rfEdges, setRfEdges] = useState<Edge[]>([])
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [nodeSheetOpen, setNodeSheetOpen] = useState(false)

  const longPressTimerRef = useRef<number | null>(null)
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)
  const lastDragStopAtRef = useRef(0)

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressOriginRef.current = null
  }, [])

  useEffect(() => cancelLongPress, [cancelLongPress])

  const handlePanePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isMobile) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.classList.contains('react-flow__pane')) return
      longPressOriginRef.current = { x: event.clientX, y: event.clientY }
      cancelLongPress()
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null
        longPressOriginRef.current = null
        select(null)
        setCreateSheetOpen(true)
      }, LONG_PRESS_MS)
    },
    [cancelLongPress, isMobile, select],
  )

  const handlePanePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = longPressOriginRef.current
      if (origin === null) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress()
    },
    [cancelLongPress],
  )

  useEffect(() => {
    setRfNodes(
      model.nodes().map((node) => {
        const def = registry.get(node.type)?.def
        return {
          id: node.id,
          type: 'generic',
          position: { x: node.x ?? 0, y: node.y ?? 0 },
          data: {
            label: def?.label ?? node.type,
            inputPorts: def?.inputs.map((port) => port.name) ?? [],
            outputPorts: def?.outputs.map((port) => port.name) ?? [],
          },
        }
      }),
    )
    setRfEdges(
      model.connections().map((connection) => {
        const [sourceId, sourceHandle] = splitAddress(connection.from)
        const [targetId, targetHandle] = splitAddress(connection.to)
        return {
          id: connection.id,
          source: sourceId,
          sourceHandle,
          target: targetId,
          targetHandle,
        }
      }),
    )
  }, [model, registry, tick])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((current) => applyNodeChanges(changes, current))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === null || connection.target === null) return
      if (connection.source === connection.target) return
      const from: PortAddress = `${connection.source}.${connection.sourceHandle ?? 'out'}`
      const to: PortAddress = `${connection.target}.${connection.targetHandle ?? 'in'}`
      try {
        execute(connectCommand(model, from, to))
      } catch (error) {
        console.debug('Connection rejected:', error)
      }
    },
    [execute, model],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        if (!model.hasNode(node.id)) continue
        execute(removeNodeCommand(model, node.id))
      }
    },
    [execute, model],
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        if (!model.getConnection(edge.id)) continue
        execute(disconnectCommand(model, edge.id))
      }
    },
    [execute, model],
  )

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node) => {
      lastDragStopAtRef.current = Date.now()
      execute(moveNodeCommand(model, node.id, node.position.x, node.position.y))
    },
    [execute, model],
  )

  const sheetNodeType = selectedNodeId === null ? undefined : model.getNode(selectedNodeId)?.type
  const sheetTitle =
    sheetNodeType === undefined
      ? 'Block settings'
      : (registry.get(sheetNodeType)?.def.label ?? 'Block settings')

  return (
    <>
      <div
        className="canvas-flow"
        onPointerDown={handlePanePointerDown}
        onPointerMove={handlePanePointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_event, node) => {
            select(node.id)
            if (isMobile && Date.now() - lastDragStopAtRef.current > DRAG_TAP_GUARD_MS) {
              setNodeSheetOpen(true)
            }
          }}
          onPaneClick={() => select(null)}
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
        >
          <Background gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <BottomSheet
        isOpen={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="Create block"
        size="medium"
      >
        <div className="sheet-node-list">
          {NODE_METADATA.map((meta) => (
            <button
              key={meta.type}
              type="button"
              className="palette-button"
              title={meta.description}
              onClick={() => {
                void addNodeByType(meta.type)
                setCreateSheetOpen(false)
              }}
            >
              + {meta.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={nodeSheetOpen && selectedNodeId !== null}
        onClose={() => setNodeSheetOpen(false)}
        title={sheetTitle}
        size="large"
      >
        <div className="sheet-inspector">
          <Inspector />
          <SheetChainActions onAfterAdd={() => setNodeSheetOpen(false)} />
        </div>
      </BottomSheet>
    </>
  )
}

interface SheetChainActionsProps {
  onAfterAdd: () => void
}

function SheetChainActions({ onAfterAdd }: SheetChainActionsProps) {
  const selectedNodeId = useToolStore((state) => state.selectedNodeId)
  const model = useToolStore((state) => state.model)
  const node = selectedNodeId === null ? undefined : model.getNode(selectedNodeId)
  if (selectedNodeId === null || node === undefined) return null
  return (
    <div className="chain-plus-row">
      <ChainPlusButton
        nodeId={selectedNodeId}
        nodeType={node.type}
        onAddNode={() => {
          void createChainedNode(selectedNodeId)
          onAfterAdd()
        }}
      />
    </div>
  )
}
