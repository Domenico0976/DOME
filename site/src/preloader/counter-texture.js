// Counter texture — the "000"->"100" digits drawn on a 2D canvas at GRID
// resolution (1 texel = 1 tile, sampled NEAREST in the shader) so the digits
// read as chunky, grid-aligned pixels (the "Retro Bitrate" look).
//
// The bitmap math (formatCounter / computeDigitTiles) is pure and unit-tested
// in tests/preloader.test.js — no canvas needed there.

// 3x5 minimal bitmap font (1 = ink).
const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
}

export function formatCounter(value) {
  const n = Math.max(0, Math.min(100, Math.round(value)))
  return String(n).padStart(3, '0')
}

// The digit bitmap only changes when the rounded display changes. Re-uploading
// the texture on frames where it is identical was the counter's frame cost.
export function shouldRedraw(lastValue, nextValue) {
  return formatCounter(lastValue) !== formatCounter(nextValue)
}

// Returns a Uint8Array(gridW*gridH): 1 = ink tile. Digits are placed huge in
// the bottom-right. Pure: safe to call in jsdom without a canvas.
export function computeDigitTiles(value, gridW, gridH) {
  const cells = new Uint8Array(gridW * gridH)
  if (gridW <= 0 || gridH <= 0) return cells

  const str = formatCounter(value)
  const S = 2 // scale: each font pixel = S x S tiles
  const dw = 3 * S
  const dh = 5 * S
  const gap = 1
  const margin = 2
  const totalW = str.length * dw + (str.length - 1) * gap
  const x0 = gridW - totalW - margin
  const y0 = gridH - dh - margin

  for (let i = 0; i < str.length; i++) {
    const glyph = FONT[str[i]] || FONT['0']
    const digitX0 = x0 + i * (dw + gap)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] !== '1') continue
        const px = digitX0 + c * S
        const py = y0 + r * S
        for (let yy = 0; yy < S; yy++) {
          for (let xx = 0; xx < S; xx++) {
            const x = px + xx
            const y = py + yy
            if (x < 0 || x >= gridW || y < 0 || y >= gridH) continue
            cells[y * gridW + x] = 1
          }
        }
      }
    }
  }
  return cells
}

export function createCounterTexture() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let gridW = 1
  let gridH = 1
  let lastValue = 0

  function redraw() {
    ctx.clearRect(0, 0, gridW, gridH)
    const cells = computeDigitTiles(lastValue, gridW, gridH)
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) {
        const x = i % gridW
        const y = (i / gridW) | 0
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  return {
    canvas,
    get gridW() {
      return gridW
    },
    get gridH() {
      return gridH
    },
    resize(w, h) {
      gridW = Math.max(1, w | 0)
      gridH = Math.max(1, h | 0)
      canvas.width = gridW
      canvas.height = gridH
      redraw()
    },
    update(value) {
      if (!shouldRedraw(lastValue, value)) return false
      lastValue = value
      redraw()
      return true
    },
  }
}
