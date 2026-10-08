import { describe, test, expect } from 'vitest'
import type { ToolDef } from './types'
import { registerTool, resolveTool, getCatalog, DIRECTIVES } from './registry'

const def: ToolDef = {
  id: 'demo',
  kind: 'generative',
  version: '1.0.0',
  label: 'Demo',
  icon: '◆',
  category: 'Generative',
  defaultParams: {},
  controls: [],
  render() {},
}

describe('tool registry', () => {
  test('register + resolve + catalog', () => {
    registerTool(def)
    expect(resolveTool('demo')?.label).toBe('Demo')
    expect(getCatalog().Generative.some((t) => t.id === 'demo')).toBe(true)
    expect(DIRECTIVES.toolContractVersion).toBe('1.0.0')
  })

  test('resolveTool tolerates unknown / missing tool (graceful)', () => {
    expect(resolveTool('does-not-exist')).toBeUndefined()
  })

  test('compatible version resolution falls back on same major when exact is missing', () => {
    registerTool({ ...def, id: 'fb', version: '1.5.0' })
    expect(resolveTool('fb', '1.2.0')?.version).toBe('1.5.0')
    registerTool({ ...def, id: 'fb', version: '1.2.0' })
    expect(resolveTool('fb', '1.2.0')?.version).toBe('1.2.0')
  })
})
