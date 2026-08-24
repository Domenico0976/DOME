import { z } from 'zod'
import type { GraphModel } from './graph'
import type { PortAddress } from './types'

const portAddressSchema = z.custom<PortAddress>(
  (value) => typeof value === 'string' && value.includes('.'),
  { message: "Expected a port address in the 'node.port' form" },
)

const paramValueSchema = z.union([
  z.number(),
  z.object({ $patch: z.object({ from: portAddressSchema }) }),
])

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  params: z.record(paramValueSchema).default({}),
})

const connectionSchema = z.object({
  id: z.string().min(1),
  from: portAddressSchema,
  to: portAddressSchema,
})

const projectSchema = z.object({
  formatVersion: z.literal(1),
  appVersion: z.string(),
  nodes: z.array(nodeSchema),
  connections: z.array(connectionSchema),
})

export type ProjectFile = z.infer<typeof projectSchema>

export type ParseResult =
  | { ok: true; value: ProjectFile }
  | { ok: false; errors: readonly string[] }

export function parseProject(raw: unknown): ParseResult {
  const result = projectSchema.safeParse(raw)
  if (result.success) return { ok: true, value: result.data }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`,
    ),
  }
}

export function serializeProject(model: GraphModel, appVersion: string): ProjectFile {
  return {
    formatVersion: 1,
    appVersion,
    nodes: model.nodes().map((node) => ({
      id: node.id,
      type: node.type,
      ...(node.x !== undefined ? { x: node.x } : {}),
      ...(node.y !== undefined ? { y: node.y } : {}),
      params: node.params,
    })),
    connections: model.connections().map((connection) => ({
      id: connection.id,
      from: connection.from,
      to: connection.to,
    })),
  }
}
