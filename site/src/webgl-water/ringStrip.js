export const RING_PX = 440
export const STRIP_W = 2048
export const STRIP_H = 256
export const RING_TEXT = 'SOMEBODYWANT3D'
export const CYL_R = 190
export const CYL_H = 150
export const SCROLL = 0.06

export async function paintRingStrip(canvas) {
  try {
    await document.fonts.load('700 120px "Bricolage Grotesque"')
  } catch {
    // fall through: system sans fallback still draws the band
  }
  const W = STRIP_W
  const H = STRIP_H
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const fontPx = 120
  ctx.font = `700 ${fontPx}px "Bricolage Grotesque", sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const track = -0.06 * fontPx
  const unit = `${RING_TEXT} \u2022 `
  const unitW = ctx.measureText(unit).width + track * unit.length
  const reps = Math.max(1, Math.round(W / unitW))
  const str = unit.repeat(reps)
  const raw = [...str].map((ch) => ctx.measureText(ch).width + track)
  const total = raw.reduce((a, b) => a + b, 0)
  const k = W / total
  let cursor = 0
  ;[...str].forEach((ch, i) => {
    const adv = raw[i] * k
    ctx.fillText(ch, cursor + adv / 2, H / 2)
    cursor += adv
  })
}
