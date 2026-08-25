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

describe('schema v2 effects', () => {
  test('adds effects: [] to legacy stack items', () => {
    const legacy = { stack: [{ uid: 'a', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false }] }
    const p = migrateProject(legacy)
    expect(p.schemaVersion).toBe(2)
    expect(p.stack[0].effects).toEqual([])
  })
  test('preserves existing effects and applies registered tool migrations', () => {
    const eff = [{ uid: 'e1', type: 'glow', enabled: true, params: {} }]
    const p = migrateProject({ stack: [{ uid: 'a', toolId: 'solidColor', toolVersion: '1.0.0', params: {}, audio: [], automations: [], hidden: false, effects: eff }] })
    expect(p.stack[0].effects).toEqual(eff)
  })
})
