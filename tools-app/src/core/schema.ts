import type { ProjectState, StackItem } from './types'

export const SCHEMA_VERSION = 2

export const TOOL_PARAM_MIGRATIONS: Record<
  string,
  (params: Record<string, number | string>) => Record<string, number | string>
> = {}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

TOOL_PARAM_MIGRATIONS.ferrofluid = (p) => ({
  attractors: Number(p.blobs ?? 5),
  speed: Number(p.intensity ?? 1),
  accent: hslToHex(Number(p.hue ?? 280), 80, 55),
})

let orphanCounter = 0
function normalizeItem(raw: Partial<StackItem>): StackItem {
  orphanCounter += 1
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : `m_${Date.now().toString(36)}_${orphanCounter}`,
    toolId: typeof raw.toolId === 'string' ? raw.toolId : 'solidColor',
    toolVersion: typeof raw.toolVersion === 'string' ? raw.toolVersion : '1.0.0',
    params: raw.params && typeof raw.params === 'object' ? { ...raw.params } : {},
    audio: Array.isArray(raw.audio) ? raw.audio : [],
    automations: Array.isArray(raw.automations) ? raw.automations : [],
    hidden: Boolean(raw.hidden),
    effects: Array.isArray(raw.effects) ? raw.effects : [],
  }
}

// migrateProject normalizes any stored project blob into the current shape and
// applies registered per-tool parameter migrations for legacy major versions.
export function migrateProject(input: unknown): ProjectState {
  const raw = (input ?? {}) as Partial<ProjectState>
  const stack: StackItem[] = Array.isArray(raw.stack) ? raw.stack.map(normalizeItem) : []
  return {
    schemaVersion: SCHEMA_VERSION,
    stack: stack.map((item) => {
      const migrate = TOOL_PARAM_MIGRATIONS[item.toolId]
      if (migrate && item.toolVersion.startsWith('1.')) {
        return { ...item, toolVersion: '2.0.0', params: migrate(item.params) }
      }
      return item
    }),
    selectedUid: raw.selectedUid ?? null,
    timeline: {
      durationSec: raw.timeline?.durationSec ?? 60,
      bpm: raw.timeline?.bpm ?? 120,
      playing: raw.timeline?.playing ?? false,
      timeSec: raw.timeline?.timeSec ?? 0,
    },
    audio: {
      enabled: raw.audio?.enabled ?? false,
      source: raw.audio?.source ?? null,
      fileName: raw.audio?.fileName,
      midi: {
        enabled: raw.audio?.midi?.enabled ?? false,
        bindings: Array.isArray(raw.audio?.midi?.bindings) ? raw.audio?.midi?.bindings : [],
      },
    },
    canvas: {
      aspect: raw.canvas?.aspect ?? '1:1',
      quality: raw.canvas?.quality ?? 'high',
    },
    theme: raw.theme ?? 'dark',
    unsaved: raw.unsaved ?? false,
  }
}
