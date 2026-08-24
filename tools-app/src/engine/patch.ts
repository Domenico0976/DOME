import type { PortAddress } from './types'

export interface PatchSpec {
  readonly $patch: { readonly from: PortAddress }
}

export type ParamValue = number | PatchSpec

export function isPatchSpec(value: unknown): value is PatchSpec {
  if (typeof value !== 'object' || value === null) return false
  const patch = (value as Record<string, unknown>)['$patch']
  if (typeof patch !== 'object' || patch === null) return false
  return typeof (patch as Record<string, unknown>)['from'] === 'string'
}

export function resolveParams(
  specs: Readonly<Record<string, ParamValue>>,
  pullNumber: (address: PortAddress) => number,
): Record<string, number> {
  const resolved: Record<string, number> = {}
  for (const [key, spec] of Object.entries(specs)) {
    resolved[key] = typeof spec === 'number' ? spec : pullNumber(spec.$patch.from)
  }
  return resolved
}
