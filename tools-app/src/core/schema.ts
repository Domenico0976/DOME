import type { ProjectState } from './types'

export const SCHEMA_VERSION = 1

/**
 * migrateProject normalizes any stored (possibly older / partial) project blob
 * into the current ProjectState shape. Old projects keep rendering because every
 * field has a safe default — this is what makes the universe "not closed to itself".
 */
export function migrateProject(input: unknown): ProjectState {
  const raw = (input ?? {}) as Partial<ProjectState>
  return {
    schemaVersion: SCHEMA_VERSION,
    stack: Array.isArray(raw.stack) ? raw.stack : [],
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
    },
    canvas: {
      aspect: raw.canvas?.aspect ?? '1:1',
      quality: raw.canvas?.quality ?? 'high',
    },
    theme: raw.theme ?? 'dark',
    unsaved: raw.unsaved ?? false,
  }
}
