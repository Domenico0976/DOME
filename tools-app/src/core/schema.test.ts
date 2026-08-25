import { describe, test, expect } from 'vitest'
import { SCHEMA_VERSION, migrateProject } from './schema'

describe('project schema', () => {
  test('migrateProject fills defaults for minimal input', () => {
    const p = migrateProject({ stack: [] })
    expect(p.schemaVersion).toBe(SCHEMA_VERSION)
    expect(p.canvas.aspect).toBe('1:1')
    expect(p.timeline.bpm).toBe(120)
  })

  test('migrateProject tolerates null/garbage input', () => {
    const p = migrateProject(null)
    expect(p.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Array.isArray(p.stack)).toBe(true)
  })
})
