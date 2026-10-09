export const BANDS_LENGTH = 64

export type PortType = 'number' | 'bands'

export interface Bands {
  readonly data: Float32Array
}

export type Signal = number | Bands

export interface PortDef {
  readonly name: string
  readonly type: PortType
  readonly defaultValue: Signal
}

export interface NodeDef {
  readonly type: string
  readonly label: string
  readonly inputs: readonly PortDef[]
  readonly outputs: readonly PortDef[]
}

export type PortAddress = `${string}.${string}`

export function splitAddress(address: string): readonly [string, string] {
  const cut = address.lastIndexOf('.')
  if (cut <= 0 || cut === address.length - 1) throw new Error(`Invalid port address: ${address}`)
  return [address.slice(0, cut), address.slice(cut + 1)]
}
