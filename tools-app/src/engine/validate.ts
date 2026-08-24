import { CycleError, DuplicateInputError, GraphModel } from './graph'
import type { ProjectFile } from './schema'
import type { NodeDef, PortAddress, PortType } from './types'
import { splitAddress } from './types'

export type ImportIssueCode =
  | 'unknown-node-type'
  | 'unknown-node'
  | 'unknown-port'
  | 'type-mismatch'
  | 'duplicate-input'
  | 'cycle'

export interface ImportIssue {
  code: ImportIssueCode
  message: string
}

export type BuildResult =
  | { ok: true; model: GraphModel }
  | { ok: false; issues: readonly ImportIssue[] }

const typedAddress = (nodeId: string, portName: string): PortAddress => `${nodeId}.${portName}`

export function validateAndBuild(
  file: ProjectFile,
  defs: ReadonlyMap<string, NodeDef>,
): BuildResult {
  const issues: ImportIssue[] = []
  const model = new GraphModel()

  for (const node of file.nodes) {
    if (!defs.has(node.type)) {
      issues.push({
        code: 'unknown-node-type',
        message: `Unknown node type: ${node.type} (${node.id})`,
      })
      continue
    }
    model.addNode({ ...node, params: { ...node.params } })
  }

  const portTypeAt = (
    nodeId: string,
    portName: string,
    direction: 'inputs' | 'outputs',
  ): PortType | null => {
    const node = file.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) return null
    const def = defs.get(node.type)
    if (!def) return null
    return def[direction].find((port) => port.name === portName)?.type ?? null
  }

  for (const connection of file.connections) {
    let fromNodeId: string
    let fromPort: string
    let toNodeId: string
    let toPort: string
    try {
      [fromNodeId, fromPort] = splitAddress(connection.from)
      ;[toNodeId, toPort] = splitAddress(connection.to)
    } catch {
      issues.push({
        code: 'unknown-port',
        message: `Invalid port address: ${connection.from} → ${connection.to}`,
      })
      continue
    }

    const endpointsKnown =
      file.nodes.some((candidate) => candidate.id === fromNodeId) &&
      file.nodes.some((candidate) => candidate.id === toNodeId)
    if (!endpointsKnown) {
      issues.push({
        code: 'unknown-node',
        message: `Unknown node: ${connection.from} → ${connection.to}`,
      })
      continue
    }

    const fromType = portTypeAt(fromNodeId, fromPort, 'outputs')
    if (!fromType) {
      issues.push({ code: 'unknown-port', message: `Unknown output port: ${connection.from}` })
      continue
    }
    const toType = portTypeAt(toNodeId, toPort, 'inputs')
    if (!toType) {
      issues.push({ code: 'unknown-port', message: `Unknown input port: ${connection.to}` })
      continue
    }
    if (fromType !== toType) {
      issues.push({
        code: 'type-mismatch',
        message: `Incompatible port types: ${connection.from} (${fromType}) → ${connection.to} (${toType})`,
      })
      continue
    }

    try {
      model.connect(typedAddress(fromNodeId, fromPort), typedAddress(toNodeId, toPort))
    } catch (error) {
      if (error instanceof DuplicateInputError) {
        issues.push({ code: 'duplicate-input', message: error.message })
      } else if (error instanceof CycleError) {
        issues.push({ code: 'cycle', message: error.message })
      } else {
        throw error
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, model }
}
