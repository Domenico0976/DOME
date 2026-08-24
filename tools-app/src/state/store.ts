import { create } from 'zustand'
import type { Command } from '../engine/history'
import { HistoryStack } from '../engine/history'
import { GraphModel } from '../engine/graph'
import { GraphEngine } from '../engine/engine'
import type { RegistryEntry } from '../engine/engine'
import { parseProject, serializeProject } from '../engine/schema'
import type { ProjectFile } from '../engine/schema'
import type { NodeDef } from '../engine/types'
import { validateAndBuild } from '../engine/validate'
import { downloadBlob, stamp } from '../render/export'

const AUTOSAVE_KEY = 'dome.autosave.v1'
const APP_VERSION = '0.1.0'

const model = new GraphModel()
const registry = new Map<string, RegistryEntry>()
const engine = new GraphEngine(model, registry)
const history = new HistoryStack()

interface ToolState {
  readonly model: GraphModel
  readonly engine: GraphEngine
  readonly registry: ReadonlyMap<string, RegistryEntry>
  selectedNodeId: string | null
  tick: number
  autosaveCandidate: string | null
  importStatus: string | null
  registerEntry(type: string, entry: RegistryEntry): void
  select(nodeId: string | null): void
  execute(command: Command): void
  undo(): void
  redo(): void
  saveProjectFile(): void
  buildProjectFile(): ProjectFile
  importProjectRaw(raw: unknown): { ok: true } | { ok: false; message: string }
  prepareAutosaveCandidate(): void
  acceptAutosaveCandidate(): void
  dismissAutosaveCandidate(): void
  setImportStatus(message: string | null): void
}

export const useToolStore = create<ToolState>()((set, get) => ({
  model,
  engine,
  registry,
  selectedNodeId: null,
  tick: 0,
  autosaveCandidate: null,
  importStatus: null,

  registerEntry(type: string, entry: RegistryEntry): void {
    if (!registry.has(type)) registry.set(type, entry)
  },

  select(nodeId: string | null): void {
    set({ selectedNodeId: nodeId })
  },

  execute(command: Command): void {
    command.execute()
    history.push(command)
    set({ tick: Date.now() })
  },

  undo(): void {
    if (history.undo() !== undefined) set({ tick: Date.now() })
  },

  redo(): void {
    if (history.redo() !== undefined) set({ tick: Date.now() })
  },

  buildProjectFile(): ProjectFile {
    return serializeProject(model, APP_VERSION)
  },

  saveProjectFile(): void {
    const blob = new Blob([JSON.stringify(serializeProject(model, APP_VERSION), null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `dome-project-${stamp()}.json`)
  },

  importProjectRaw(raw: unknown): { ok: true } | { ok: false; message: string } {
    const parsed = parseProject(raw)
    if (!parsed.ok) {
      return { ok: false, message: parsed.errors.join(' · ') || 'Invalid project file' }
    }

    const defs = new Map<string, NodeDef>()
    for (const [type, entry] of registry) defs.set(type, entry.def)

    const built = validateAndBuild(parsed.value, defs)
    if (!built.ok) {
      return { ok: false, message: built.issues.map((issue) => issue.message).join(' · ') }
    }

    model.loadSnapshot(built.model.nodes(), built.model.connections())
    engine.reset()
    history.clear()
    set({ selectedNodeId: null, autosaveCandidate: null, tick: Date.now() })
    return { ok: true }
  },

  prepareAutosaveCandidate(): void {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      if (saved !== null) set({ autosaveCandidate: saved })
    } catch (error) {
      console.debug('[tools] localStorage unavailable', error)
    }
  },

  acceptAutosaveCandidate(): void {
    const candidate = get().autosaveCandidate
    if (candidate === null) return
    try {
      const result = get().importProjectRaw(JSON.parse(candidate) as unknown)
      if (!result.ok) {
        set({ importStatus: result.message })
        return
      }
      try {
        localStorage.removeItem(AUTOSAVE_KEY)
      } catch (error) {
        console.debug('[tools] autosave cleanup failed', error)
      }
      set({ autosaveCandidate: null })
    } catch (error) {
      console.debug('[tools] corrupted autosave', error)
      set({ importStatus: 'Saved session was corrupted' })
    }
  },

  dismissAutosaveCandidate(): void {
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
    } catch (error) {
      console.debug('[tools] autosave cleanup failed', error)
    }
    set({ autosaveCandidate: null })
  },

  setImportStatus(message: string | null): void {
    set({ importStatus: message })
  },
}))
