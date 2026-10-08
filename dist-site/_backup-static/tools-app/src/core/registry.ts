import { DIRECTIVES } from './directives'
import type { ToolDef } from './types'

export { DIRECTIVES }

const byId = new Map<string, Map<string, ToolDef>>()

function cmp(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

function compatibleVersion(versions: Map<string, ToolDef>, wanted: string): ToolDef | undefined {
  const exact = versions.get(wanted)
  if (exact) return exact
  // policy 'compatible': pick highest registered version on the same major line
  const wantedMajor = Number(wanted.split('.')[0])
  const candidates = [...versions.values()]
    .filter((d) => Number(d.version.split('.')[0]) === wantedMajor)
    .sort((a, b) => cmp(b.version, a.version))
  return candidates[0]
}

export function registerTool(def: ToolDef): void {
  let versions = byId.get(def.id)
  if (!versions) {
    versions = new Map()
    byId.set(def.id, versions)
  }
  versions.set(def.version, def)
}

export function resolveTool(id: string, version?: string): ToolDef | undefined {
  const versions = byId.get(id)
  if (!versions || versions.size === 0) return undefined
  const v = version ?? [...versions.keys()].sort((a, b) => cmp(b, a))[0]
  return compatibleVersion(versions, v)
}

export function getCatalog(): { Inputs: ToolDef[]; Generative: ToolDef[]; Filters: ToolDef[] } {
  const all = [...byId.values()].flatMap((m) => [...m.values()])
  return {
    Inputs: all.filter((t) => t.category === 'Inputs').sort((a, b) => a.label.localeCompare(b.label)),
    Generative: all.filter((t) => t.category === 'Generative').sort((a, b) => a.label.localeCompare(b.label)),
    Filters: all.filter((t) => t.category === 'Filters').sort((a, b) => a.label.localeCompare(b.label)),
  }
}
