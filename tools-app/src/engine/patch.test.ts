import { describe, expect, it } from 'vitest'
import type { PortAddress } from './types'
import { isPatchSpec, resolveParams } from './patch'

describe('isPatchSpec', () => {
  it('riconosce_un_binding_patch', () => {
    expect(isPatchSpec({ $patch: { from: 'a.out' } })).toBe(true)
  })

  it('rejects_number_and_malformed_object', () => {
    expect(isPatchSpec(3)).toBe(false)
    expect(isPatchSpec({ $patch: {} })).toBe(false)
    expect(isPatchSpec(null)).toBe(false)
  })
})

describe('resolveParams', () => {
  it('passa_through_i_parametri_numerici', () => {
    const resolved = resolveParams({ gain: 2 }, () => 0)
    expect(resolved).toEqual({ gain: 2 })
  })

  it('risolve_il_binding_dalla_porta_sorgente', () => {
    const pulled: PortAddress[] = []
    const resolved = resolveParams(
      { gain: { $patch: { from: 'a.out' } }, bias: 0.1 },
      (address) => {
        pulled.push(address)
        return 0.8
      },
    )
    expect(pulled).toEqual(['a.out'])
    expect(resolved).toEqual({ gain: 0.8, bias: 0.1 })
  })
})
