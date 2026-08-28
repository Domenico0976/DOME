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

describe('legacy ferrofluid migration', () => {
  test('legacy ferrofluid migrates to 2.0.0 params', () => {
    const p = migrateProject({
      stack: [{ uid: 'f', toolId: 'ferrofluid', toolVersion: '1.0.0', params: { blobs: 7, intensity: 2, hue: 280 }, audio: [], automations: [], hidden: false }],
    })
    expect(p.stack[0].toolVersion).toBe('2.0.0')
    expect(p.stack[0].params.attractors).toBe(7)
    expect(p.stack[0].params.speed).toBe(2)
    expect(p.stack[0].params.accent).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('legacy flowfield migration', () => {
  test('legacy flowfield migrates to particles mode flow', () => {
    const p = migrateProject({
      stack: [{ uid: 'ffl', toolId: 'flowfield', toolVersion: '1.0.0', params: { density: 14, hue: 90 }, audio: [], automations: [], hidden: false }],
    })
    expect(p.stack[0].toolId).toBe('particles')
    expect(p.stack[0].toolVersion).toBe('3.0.0')
    expect(p.stack[0].params.mode).toBe('flow')
    expect(p.stack[0].params.density).toBe(14)
    expect(p.stack[0].params.color).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('legacy tunnel migration', () => {
  test('legacy tunnel migrates to 2.0.0 params', () => {
    const p = migrateProject({
      stack: [{ uid: 'tnl', toolId: 'tunnel', toolVersion: '1.0.0', params: { rings: 30, speed: 0.8, hue: 300 }, audio: [], automations: [], hidden: false }],
    })
    expect(p.stack[0].toolVersion).toBe('2.0.0')
    expect(p.stack[0].params.rings).toBe(30)
    expect(p.stack[0].params.speed).toBe(0.8)
    expect(p.stack[0].params.hue).toBe(300)
    expect(p.stack[0].params.shape).toBe('circle')
  })
})
