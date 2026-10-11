import { create } from 'zustand'
import type { AudioBinding, Automation, EffectType, MidiBinding, ProjectState, StackItem, PerfLevel, ComponentGroup, ComponentScope } from '../core/types'
import { migrateProject } from '../core/schema'
import { resolveTool } from '../core/registry'
import { disposeFerrofluidSim, pruneFerrofluidSims } from '../tools/generative/ferrofluid'

let counter = 0
function makeUid(): string {
  counter += 1
  return `n_${Date.now().toString(36)}_${counter}`
}

function makeQuarantineId(): string {
  counter += 1
  return `q_${Date.now().toString(36)}_${counter}`
}

export interface ProjectStore extends ProjectState {
  past: StackItem[][]
  future: StackItem[][]
  selectTool: (uid: string | null) => void
  addTool: (toolId: string, version?: string) => void
  removeTool: (uid: string) => void
  moveTool: (uid: string, dir: 'up' | 'down') => void
  moveToolTo: (uid: string, toIndex: number) => void
  toggleSwitch: (uid: string) => void
  switchTool: (uid: string, newToolId: string) => void
  updateParam: (uid: string, param: string, value: number | string | string[]) => void
  addAudioBinding: (uid: string, binding: AudioBinding) => void
  removeAudioBinding: (uid: string, param: string) => void
  setBindingMuted: (id: string, muted: boolean) => void
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
  setAudioSource: (source: ProjectState['audio']['source']) => void
  setAudioFileName: (fileName: string | undefined) => void
  setAudioEnabled: (enabled: boolean) => void
  setVolume: (volume: number) => void
  setAudioPanelOpen: (open: boolean) => void
  setDuration: (durationSec: number) => void
  markSaved: () => void
  loadProject: (raw: unknown) => void
  reset: () => void
  undo: () => void
  redo: () => void
  restoreBinding: (id: string) => void
  deleteBinding: (id: string) => void
  setPerf: (perf: { level: PerfLevel; reason: string | null }) => void
  setComponent: (uid: string, patch: Partial<ComponentGroup>) => void
  applyComponentToRange: (uid: string, patch: Partial<ComponentGroup>, scope: ComponentScope) => void
}

function defaultComponent(item: StackItem): ComponentGroup {
  return {
    opacity: item.opacity ?? 1,
    blendMode: item.blendMode ?? 'source-over',
    hidden: item.hidden ?? false,
    scope: 'self',
  }
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
          component: { opacity: 1, blendMode: 'source-over', hidden: false, scope: 'self' },
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

    moveToolTo: (uid, toIndex) =>
      set((s) => {
        const from = s.stack.findIndex((i) => i.uid === uid)
        if (from < 0) return {}
        const without = s.stack.filter((i) => i.uid !== uid)
        const clamped = Math.max(0, Math.min(toIndex, without.length))
        if (clamped === from) return {}
        const stack = [...without]
        stack.splice(clamped, 0, s.stack[from])
        return { stack, unsaved: true }
      }),

    toggleSwitch: (uid) =>
      set((s) => ({ stack: patchItem(s.stack, uid, (i) => ({ ...i, hidden: !i.hidden, component: { ...defaultComponent(i), hidden: !i.hidden } })), unsaved: true })),

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
          if (param === '_blendMode') return { ...i, blendMode: String(value), component: { ...defaultComponent(i), blendMode: String(value) } }
          if (param === '_opacity') return { ...i, opacity: Number(value), component: { ...defaultComponent(i), opacity: Number(value) } }
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

    setBindingMuted: (id, muted) =>
      set((s) => {
        const current = s.audio.disabledAudioBindings ?? []
        return {
          audio: {
            ...s.audio,
            disabledAudioBindings: muted
              ? [...new Set([...current, id])]
              : current.filter((x) => x !== id),
          },
          unsaved: true,
        }
      }),

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
      set((s) => {
        const item = s.stack.find((i) => i.uid === uid)
        const moved: AudioBinding[] = []
        const kept: AudioBinding[] = []
        for (const b of item?.audio ?? []) {
          if (b.param.startsWith(`${effectUid}.`)) moved.push(b)
          else kept.push(b)
        }
        const quarantined = moved.map((b) => ({
          id: makeQuarantineId(),
          binding: b,
          fromUid: uid,
          effectUid,
          reason: 'Effect removed',
          createdAt: new Date().toISOString(),
        }))
        return {
          stack: patchItem(s.stack, uid, (i) => ({ ...i, effects: (i.effects ?? []).filter((e) => e.uid !== effectUid), audio: kept })),
          quarantined: [...s.quarantined, ...quarantined],
          unsaved: true,
        }
      }),

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

    setBpm: (bpm) => set((s) => ({ timeline: { ...s.timeline, bpm: Math.max(20, Math.min(300, Number(bpm) || 120)) }, unsaved: true })),
    setAspect: (aspect) => set((s) => ({ canvas: { ...s.canvas, aspect }, unsaved: true })),
    setQuality: (quality) => set((s) => ({ canvas: { ...s.canvas, quality }, unsaved: true })),
    setTheme: (theme) => set({ theme, unsaved: true }),
    setPlaying: (playing) => set((s) => ({ timeline: { ...s.timeline, playing } })),
    setTime: (timeSec) => set((s) => ({ timeline: { ...s.timeline, timeSec } })),
    setAudioSource: (source) => set((s) => ({ audio: { ...s.audio, source } })),
    setAudioFileName: (fileName) => set((s) => ({ audio: { ...s.audio, fileName } })),
    setAudioEnabled: (enabled) => set((s) => ({ audio: { ...s.audio, enabled } })),
    setVolume: (volume) => set((s) => ({ audio: { ...s.audio, volume: Math.max(0, Math.min(1, Number(volume) || 0)) } })),
    setAudioPanelOpen: (open) => set((s) => ({ audio: { ...s.audio, panelOpen: open } })),
    setDuration: (durationSec) =>
      set((s) => ({ timeline: { ...s.timeline, durationSec: Math.max(0, Number(durationSec) || 0) } })),
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

    restoreBinding: (id) =>
      set((s) => {
        const entry = s.quarantined.find((q) => q.id === id)
        if (!entry) return {}
        const item = s.stack.find((i) => i.uid === entry.fromUid)
        if (!item) return {} // target item gone — keep quarantined
        const effectStillThere = entry.effectUid
          ? (item.effects ?? []).some((e) => e.uid === entry.effectUid)
          : true
        if (!effectStillThere) return {} // effect gone — keep quarantined
        const already = item.audio.some((b) => b.param === entry.binding.param)
        return {
          stack: patchItem(s.stack, entry.fromUid, (i) => ({
            ...i,
            audio: already ? i.audio : [...i.audio, entry.binding],
          })),
          quarantined: s.quarantined.filter((q) => q.id !== id),
          unsaved: true,
        }
      }),

    deleteBinding: (id) =>
      set((s) => ({
        quarantined: s.quarantined.filter((q) => q.id !== id),
        unsaved: true,
      })),

    setPerf: (perf) => setOriginal({ perf }),

    setComponent: (uid, patch) =>
      set((s) => ({
        stack: patchItem(s.stack, uid, (i) => {
          const component = { ...defaultComponent(i), ...patch }
          return { ...i, component, opacity: component.opacity, blendMode: component.blendMode, hidden: component.hidden }
        }),
        unsaved: true,
      })),

    applyComponentToRange: (uid, patch, scope) =>
      set((s) => {
        const idx = s.stack.findIndex((i) => i.uid === uid)
        if (idx < 0) return {}
        const targets: number[] = []
        if (scope === 'self') {
          targets.push(idx)
        } else if (scope === 'above') {
          for (let i = 0; i <= idx; i++) targets.push(i)
        } else {
          for (let i = idx; i < s.stack.length; i++) targets.push(i)
        }
        const stack = s.stack.map((item, i) => {
          if (!targets.includes(i)) return item
          const component = { ...defaultComponent(item), ...patch }
          return { ...item, component, opacity: component.opacity, blendMode: component.blendMode, hidden: component.hidden }
        })
        return { stack, unsaved: true }
      }),
  }
})
