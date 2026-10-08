import { create } from 'zustand'
import type { AudioBinding, Automation, EffectType, MidiBinding, ProjectState, StackItem } from '../core/types'
import { migrateProject } from '../core/schema'
import { resolveTool } from '../core/registry'
import { disposeFerrofluidSim, pruneFerrofluidSims } from '../tools/generative/ferrofluid'

let counter = 0
function makeUid(): string {
  counter += 1
  return `n_${Date.now().toString(36)}_${counter}`
}

export interface ProjectStore extends ProjectState {
  past: StackItem[][]
  future: StackItem[][]
  selectTool: (uid: string | null) => void
  addTool: (toolId: string, version?: string) => void
  removeTool: (uid: string) => void
  moveTool: (uid: string, dir: 'up' | 'down') => void
  toggleSwitch: (uid: string) => void
  switchTool: (uid: string, newToolId: string) => void
  updateParam: (uid: string, param: string, value: number | string | string[]) => void
  addAudioBinding: (uid: string, binding: AudioBinding) => void
  removeAudioBinding: (uid: string, param: string) => void
  addAutomation: (uid: string, automation: Automation) => void
  removeAutomation: (uid: string, param: string) => void
  addEffect: (uid: string, type: EffectType) => void
  removeEffect: (uid: string, effectUid: string) => void
  setEffectParam: (uid: string, effectUid: string, param: string, value: number) => void
  toggleEffect: (uid: string, effectUid: string) => void
  enableMidi: () => void
  bindMidi: (uid: string, param: string, cc: number) => void
  removeMidi: (uid: string, param: string) => void
  setBpm: (bpm: number) => void
  setAspect: (aspect: ProjectState['canvas']['aspect']) => void
  setQuality: (quality: ProjectState['canvas']['quality']) => void
  setTheme: (theme: 'dark' | 'light') => void
  setPlaying: (playing: boolean) => void
  setTime: (timeSec: number) => void
  markSaved: () => void
  loadProject: (raw: unknown) => void
  reset: () => void
  undo: () => void
  redo: () => void
}

function patchItem(stack: StackItem[], uid: string, fn: (item: StackItem) => StackItem): StackItem[] {
  return stack.map((item) => (item.uid === uid ? fn(item) : item))
}

export const useProjectStore = create<ProjectStore>((setOriginal, get) => {
  const set: typeof setOriginal = (partial, replace) => {
    const before = get().stack
    setOriginal(partial, replace)
    const after = get().stack
    if (after !== before) {
      setOriginal((s) => ({ past: [...s.past, before].slice(-50), future: [] }))
    }
  }

  return {
    ...migrateProject({ stack: [] }),
    past: [],
    future: [],

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
        if (idx >= 0) stack.splice(idx, 0, item)
        else stack.push(item)
        return { stack, selectedUid: item.uid, unsaved: true }
      }),

    removeTool: (uid) =>
      set((s) => {
        disposeFerrofluidSim(uid)
        return {
          stack: s.stack.filter((i) => i.uid !== uid),
          selectedUid: s.selectedUid === uid ? null : s.selectedUid,
          unsaved: true,
        }
      }),

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

    switchTool: (uid, newToolId) =>
      set((s) => {
        const def = resolveTool(newToolId)
        if (!def) return {}
        return {
          stack: patchItem(s.stack, uid, (i) => ({
            ...i,
            toolId: def.id,
            toolVersion: def.version,
            params: { ...def.defaultParams },
          })),
          unsaved: true,
        }
      }),

    updateParam: (uid, param, value) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => {
          if (param === '_blendMode') return { ...i, blendMode: String(value) }
          if (param === '_opacity') return { ...i, opacity: Number(value) }
          return { ...i, params: { ...i.params, [param]: value } }
        }),
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

    removeAutomation: (uid, param) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({ ...i, automations: i.automations.filter((a) => a.param !== param) })),
        unsaved: true,
      })),

    addEffect: (uid, type) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: [...(i.effects ?? []), { uid: makeUid(), type, enabled: true, params: {} }],
        })),
        unsaved: true,
      })),

    removeEffect: (uid, effectUid) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({ ...i, effects: (i.effects ?? []).filter((e) => e.uid !== effectUid) })),
        unsaved: true,
      })),

    setEffectParam: (uid, effectUid, param, value) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: (i.effects ?? []).map((e) => (e.uid === effectUid ? { ...e, params: { ...e.params, [param]: value } } : e)),
        })),
        unsaved: true,
      })),

    toggleEffect: (uid, effectUid) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => ({
          ...i,
          effects: (i.effects ?? []).map((e) => (e.uid === effectUid ? { ...e, enabled: !e.enabled } : e)),
        })),
        unsaved: true,
      })),

    enableMidi: () => set((s) => ({ audio: { ...s.audio, midi: { ...s.audio.midi, enabled: true } } })),

    bindMidi: (uid, param, cc) =>
      set((s) => {
        const bindings = s.audio.midi.bindings.filter((b) => !(b.uid === uid && b.param === param))
        const next: MidiBinding = { uid, param, cc }
        return { audio: { ...s.audio, midi: { enabled: true, bindings: [...bindings, next] } }, unsaved: true }
      }),

    removeMidi: (uid, param) =>
      set((s) => ({
        audio: {
          ...s.audio,
          midi: { ...s.audio.midi, bindings: s.audio.midi.bindings.filter((b) => !(b.uid === uid && b.param === param)) },
        },
        unsaved: true,
      })),

    setBpm: (bpm) => set((s) => ({ timeline: { ...s.timeline, bpm }, unsaved: true })),
    setAspect: (aspect) => set((s) => ({ canvas: { ...s.canvas, aspect }, unsaved: true })),
    setQuality: (quality) => set((s) => ({ canvas: { ...s.canvas, quality }, unsaved: true })),
    setTheme: (theme) => set({ theme, unsaved: true }),
    setPlaying: (playing) => set((s) => ({ timeline: { ...s.timeline, playing } })),
    setTime: (timeSec) => set((s) => ({ timeline: { ...s.timeline, timeSec } })),
    markSaved: () => set({ unsaved: false }),
    loadProject: (raw) => setOriginal({ ...migrateProject(raw), past: [], future: [], unsaved: false }),
    reset: () => {
      pruneFerrofluidSims(new Set())
      return setOriginal({ ...migrateProject({ stack: [] }), past: [], future: [], unsaved: false })
    },

    undo: () =>
      setOriginal((s) => {
        if (s.past.length === 0) return {}
        const prev = s.past[s.past.length - 1]
        pruneFerrofluidSims(new Set(prev.map((i) => i.uid)))
        const selectedUid = prev.some((i) => i.uid === s.selectedUid) ? s.selectedUid : null
        return {
          stack: prev,
          past: s.past.slice(0, -1),
          future: [s.stack, ...s.future].slice(0, 50),
          selectedUid,
          unsaved: true,
        }
      }),

    redo: () =>
      setOriginal((s) => {
        if (s.future.length === 0) return {}
        const next = s.future[0]
        pruneFerrofluidSims(new Set(next.map((i) => i.uid)))
        return {
          stack: next,
          past: [...s.past, s.stack].slice(-50),
          future: s.future.slice(1),
          unsaved: true,
        }
      }),
  }
})
