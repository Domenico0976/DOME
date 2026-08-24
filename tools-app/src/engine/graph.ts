import type { Command } from './history'
import type { ParamValue } from './patch'
import type { PortAddress } from './types'
import { splitAddress } from './types'

export class CycleError extends Error {
  constructor() {
    super('Connection rejected: it would create a cycle in the graph')
    this.name = 'CycleError'
  }
}

export class DuplicateInputError extends Error {
  constructor(target: PortAddress) {
    super(`Input already connected: ${target}`)
    this.name = 'DuplicateInputError'
  }
}

export class MissingNodeError extends Error {
  constructor(id: string) {
    super(`Unknown node: ${id}`)
    this.name = 'MissingNodeError'
  }
}

export interface GraphNode {
  id: string
  type: string
  params: Record<string, ParamValue>
  x?: number
  y?: number
}

export interface Connection {
  id: string
  from: PortAddress
  to: PortAddress
}

export class GraphModel {
  private readonly nodesById = new Map<string, GraphNode>()
  private readonly connectionsById = new Map<string, Connection>()

  addNode(node: GraphNode): void {
    if (this.nodesById.has(node.id)) throw new Error(`Duplicate node: ${node.id}`)
    this.nodesById.set(node.id, node)
  }

  removeNode(id: string): void {
    if (!this.nodesById.has(id)) throw new MissingNodeError(id)
    this.nodesById.delete(id)
    for (const [connectionId, connection] of [...this.connectionsById]) {
      const [fromNodeId] = splitAddress(connection.from)
      const [toNodeId] = splitAddress(connection.to)
      if (fromNodeId === id || toNodeId === id) this.connectionsById.delete(connectionId)
    }
  }

  hasNode(id: string): boolean {
    return this.nodesById.has(id)
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodesById.get(id)
  }

  nodes(): readonly GraphNode[] {
    return [...this.nodesById.values()]
  }

  connect(from: PortAddress, to: PortAddress): Connection {
    const [fromNodeId] = splitAddress(from)
    const [toNodeId] = splitAddress(to)
    if (!this.nodesById.has(fromNodeId) || !this.nodesById.has(toNodeId)) {
      throw new MissingNodeError(`${from} → ${to}`)
    }
    if (this.incomingTo(to)) throw new DuplicateInputError(to)
    if (this.reaches(toNodeId, fromNodeId)) throw new CycleError()
    const connection: Connection = { id: crypto.randomUUID(), from, to }
    this.connectionsById.set(connection.id, connection)
    return connection
  }

  disconnect(connectionId: string): void {
    this.connectionsById.delete(connectionId)
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connectionsById.get(connectionId)
  }

  connections(): readonly Connection[] {
    return [...this.connectionsById.values()]
  }

  incomingTo(target: PortAddress): Connection | undefined {
    for (const connection of this.connectionsById.values()) {
      if (connection.to === target) return connection
    }
    return undefined
  }

  outgoingFrom(nodeId: string): readonly Connection[] {
    return this.connections().filter((connection) => splitAddress(connection.from)[0] === nodeId)
  }

  clear(): void {
    this.nodesById.clear()
    this.connectionsById.clear()
  }

  loadSnapshot(
    nodes: readonly GraphNode[],
    connections: readonly Connection[],
  ): void {
    this.clear()
    for (const node of nodes) this.nodesById.set(node.id, { ...node })
    for (const connection of connections) this.connectionsById.set(connection.id, { ...connection })
  }

  private reaches(startNodeId: string, targetNodeId: string): boolean {
    if (startNodeId === targetNodeId) return true
    const seen = new Set<string>([startNodeId])
    const stack = [startNodeId]
    while (stack.length > 0) {
      const current = stack.pop() as string
      for (const connection of this.connectionsById.values()) {
        const [fromNodeId] = splitAddress(connection.from)
        if (fromNodeId !== current) continue
        const [toNodeId] = splitAddress(connection.to)
        if (toNodeId === targetNodeId) return true
        if (!seen.has(toNodeId)) {
          seen.add(toNodeId)
          stack.push(toNodeId)
        }
      }
    }
    return false
  }
}

export const addNodeCommand = (model: GraphModel, node: GraphNode): Command => ({
  label: `add node ${node.type}`,
  execute: () => model.addNode(node),
  undo: () => model.removeNode(node.id),
})

export const removeNodeCommand = (model: GraphModel, id: string): Command => {
  let snapshot: { node: GraphNode; connections: readonly Connection[] } | null = null
  return {
    label: 'remove node',
    execute(): void {
      const node = model.getNode(id)
      if (!node) throw new MissingNodeError(id)
      snapshot = {
        node,
        connections: model.connections().filter((connection) => {
          const [fromNodeId] = splitAddress(connection.from)
          const [toNodeId] = splitAddress(connection.to)
          return fromNodeId === id || toNodeId === id
        }),
      }
      model.removeNode(id)
    },
    undo(): void {
      if (!snapshot) return
      model.addNode(snapshot.node)
      for (const connection of snapshot.connections) model.connect(connection.from, connection.to)
    },
  }
}

export const moveNodeCommand = (model: GraphModel, id: string, x: number, y: number): Command => {
  const node = model.getNode(id)
  if (!node) throw new MissingNodeError(id)
  const previousX = node.x
  const previousY = node.y
  return {
    label: 'move node',
    execute(): void {
      const target = model.getNode(id)
      if (!target) return
      target.x = x
      target.y = y
    },
    undo(): void {
      const target = model.getNode(id)
      if (!target) return
      target.x = previousX
      target.y = previousY
    },
  }
}

export const connectCommand = (model: GraphModel, from: PortAddress, to: PortAddress): Command => {
  let currentId = ''
  return {
    label: `connect ${from} → ${to}`,
    execute(): void {
      currentId = model.connect(from, to).id
    },
    undo(): void {
      if (currentId) model.disconnect(currentId)
    },
  }
}

export const disconnectCommand = (model: GraphModel, connectionId: string): Command => {
  let currentId = connectionId
  const original = model.getConnection(connectionId)
  if (!original) throw new Error(`Connection not found: ${connectionId}`)
  return {
    label: 'disconnect',
    execute(): void {
      model.disconnect(currentId)
    },
    undo(): void {
      currentId = model.connect(original.from, original.to).id
    },
  }
}
