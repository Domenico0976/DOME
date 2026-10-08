export interface BandRange {
  readonly start: number
  readonly end: number
}

export interface BandRanges {
  readonly bass: BandRange
  readonly mid: BandRange
  readonly treble: BandRange
}

export interface BandsSnapshot {
  readonly bass: number
  readonly mid: number
  readonly treble: number
  readonly level: number
}

export function computeBandRanges(sampleRate: number, frequencyBinCount: number): BandRanges {
  const hzPerBin = sampleRate / (frequencyBinCount * 2)
  const startAt = (hz: number): number => Math.min(Math.ceil(hz / hzPerBin), frequencyBinCount)
  const endAfter = (hz: number): number => Math.min(Math.floor(hz / hzPerBin) + 1, frequencyBinCount)
  return {
    bass: { start: startAt(20), end: endAfter(250) },
    mid: { start: startAt(250), end: endAfter(2000) },
    treble: { start: startAt(2000), end: endAfter(16000) },
  }
}

export function averageRange(bytes: Uint8Array, range: BandRange): number {
  const count = range.end - range.start
  if (count <= 0) return 0
  let sum = 0
  for (let index = range.start; index < range.end; index += 1) sum += bytes[index]
  return sum / count / 255
}

export function readBandsFrom(bytes: Uint8Array, ranges: BandRanges): BandsSnapshot {
  return {
    bass: averageRange(bytes, ranges.bass),
    mid: averageRange(bytes, ranges.mid),
    treble: averageRange(bytes, ranges.treble),
    level: averageRange(bytes, { start: 0, end: bytes.length }),
  }
}

export function downsampleToBands(bytes: Uint8Array, out: Float32Array): Float32Array {
  const sourceLength = bytes.length
  const bandCount = out.length
  for (let band = 0; band < bandCount; band += 1) {
    const start = Math.floor((band * sourceLength) / bandCount)
    const rawEnd = Math.floor(((band + 1) * sourceLength) / bandCount)
    const end = Math.max(start + 1, rawEnd)
    let sum = 0
    for (let index = start; index < end; index += 1) sum += bytes[index]
    out[band] = sum / (end - start) / 255
  }
  return out
}
