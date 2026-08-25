import { create } from 'zustand'
import type { AudioBinding, Automation, ProjectState, StackItem } from '../core/types'
import { migrateProject } from '../core/schema'
import { resolveTool } from '../core/registry'

let counter = 0
function makeUid(): string {
  counter += 1
  return `n_${Date.now().toString(36)}_${counter}`
}

export interface ProjectStore extends ProjectState {
  selectTool: (uid: string | null) => void
  addTool: (toolId: string, version?: string) => void
  removeTool: (uid: string) => void
  moveTool: (uid: string, dir: 'up' | 'down') => void
  toggleSwitch: (uid: string) => void
  updateParam: (uid: string, param: string, value: number | string) => void
  addAudioBinding: (uid: string, binding: AudioBinding) => void
  removeAudioBinding: (uid: string, param: string) => void
  addAutomation: (uid: string, automation: Automation) => void
  setBpm: (bpm: number) => void
  setAspect: (aspect: ProjectState['canvas']['aspect']) => void
  setQuality: (quality: ProjectState['canvas']['quality']) => void
  setTheme: (theme: 'dark' | 'light') => void
  setPlaying: (playing: boolean) => void
  setTime: (timeSec: number) => void
  markSaved: () => void
  loadProject: (raw: unknown) => void
  reset: () => void
}

function patchItem(stack: StackItem[], uid: string, fn: (item: StackItem) => StackItem): StackItem[] {
  return stack.map((item) => (item.uid === uid ? fn(item) : item))
}

export const useProjectStore = create<ProjectStore>((set) => ({
  ...migrateProject({ stack: [] }),

  selectTool: (uid) => set({ selectedUid: uid }),

  addTool: (toolId, version) =>
    set((s) => {
      const def = resolveTool(toolId, version)
      if (!def) return {}
      const item: StackItem = {
        uid: makeUid(),
        toolId: def.id,
        toolVersion: def.version,
        params: { ...def.defaultParams },
        audio: [],
        automations: [],
        hidden: false,
      }
      const idx = s.selectedUid ? s.stack.findIndex((i) => i.uid === s.selectedUid) : -1
      const stack = [...s.stack]
      if (idx >= 0) stack.splice(idx + 1, 0, item)
      else stack.push(item)
      return { stack, selectedUid: item.uid, unsaved: true }
    }),

  removeTool: (uid) =>
    set((s) => ({
      stack: s.stack.filter((i) => i.uid !== uid),
      selectedUid: s.selectedUid === uid ? null : s.selectedUid,
      unsaved: true,
    })),

  moveTool: (uid, dir) =>
    set((s) => {
      const idx = s.stack.findIndex((i) => i.uid === uid)
      if (idx < 0) return {}
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= s.stack.length) return {}
      const stack = [...s.stack]
      ;[stack[idx], stack[target]] = [stack[target], stack[idx]]
      return { stack, unsaved: true }
    }),

  toggleSwitch: (uid) =>
    set((s) => ({ stack: patchItem(s.stack, uid, (i) => ({ ...i, hidden: !i.hidden })), unsaved: true })),

  updateParam: (uid, param, value) =>
    set((s) => ({
      stack: patchItem(s.stack, uid, (i) => ({ ...i, params: { ...i.params, [param]: value } })),
      unsaved: true,
    })),

  addAudioBinding: (uid, binding) =>
    set((s) => ({
      stack: patchItem(s.stack, uid, (i) => ({
        ...i,
        audio: [...i.audio.filter((b) => b.param !== binding.param), binding],
      })),
      unsaved: true,
    })),

  removeAudioBinding: (uid, param) =>
    set((s) => ({
      stack: patchItem(s.stack, uid, (i) => ({ ...i, audio: i.audio.filter((b) => b.param !== param) })),
      unsaved: true,
    })),

  addAutomation: (uid, automation) =>
    set((s) => ({
      stack: patchItem(s.stack, uid, (i) => ({
        ...i,
        automations: [...i.automations.filter((a) => a.param !== automation.param), automation],
      })),
      unsaved: true,
    })),

  setBpm: (bpm) => set((s) => ({ timeline: { ...s.timeline, bpm }, unsaved: true })),
  setAspect: (aspect) => set((s) => ({ canvas: { ...s.canvas, aspect }, unsaved: true })),
  setQuality: (quality) => set((s) => ({ canvas: { ...s.canvas, quality }, unsaved: true })),
  setTheme: (theme) => set({ theme, unsaved: true }),
  setPlaying: (playing) => set((s) => ({ timeline: { ...s.timeline, playing } })),
  setTime: (timeSec) => set((s) => ({ timeline: { ...s.timeline, timeSec } })),
  markSaved: () => set({ unsaved: false }),
  loadProject: (raw) => set({ ...migrateProject(raw), unsaved: false }),
  reset: () => set({ ...migrateProject({ stack: [] }), unsaved: false }),
}))
