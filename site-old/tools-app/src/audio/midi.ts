type Cb = (cc: number, value: number) => void

let ccCb: Cb | null = null
let learnResolve: ((cc: number) => void) | null = null

export async function connectMidi(): Promise<boolean> {
  const nav = navigator as unknown as { requestMIDIAccess?: () => Promise<unknown> }
  if (typeof navigator === 'undefined' || !nav.requestMIDIAccess) return false
  try {
    const result = await nav.requestMIDIAccess()
    const inputs = (
      result as {
        inputs?: Map<unknown, { onmidimessage: ((e: { data?: Uint8Array }) => void) | null }>
      }
    ).inputs
    inputs?.forEach((input) => {
      input.onmidimessage = (e) => {
        const d = e.data
        if (!d || d.length < 3) return
        const status = d[0]
        const cc = d[1]
        const value = d[2]
        if ((status & 0xf0) === 0xb0) {
          if (learnResolve) {
            const r = learnResolve
            learnResolve = null
            r(cc)
          } else if (ccCb) {
            ccCb(cc, value)
          }
        }
      }
    })
    return true
  } catch {
    return false
  }
}

export function onMidiCc(cb: Cb | null): void {
  ccCb = cb
}

export function learnNextCc(): Promise<number> {
  return new Promise((resolve) => {
    learnResolve = resolve
  })
}
