// Turn a text element into the VISUAL lines the browser actually produced.
//
// Why this module exists. The mask/reveal pipeline used one entry per DOM element
// (`.focus-callout__text-line`, one per entry of the callout's line array) and assumed each
// of those was a single line of glyphs. That assumption breaks the moment the text wraps:
// the element spans two or three line boxes, the mask rasterised one block, and the line
// boxes the raster did not cover showed up as blank gaps while the oversized line was
// clipped by the canvas. Hardcoding the break in the line array avoids that, but it means
// we decide where words split — the text stops being able to say.
//
// Measuring the real line boxes removes both problems. The browser already knows how the
// text should break for its available width, including any mid-word split; we read that
// answer instead of predicting it, and the unit of the effect becomes the thing the layout
// engine already produced.
//
// The mapping from characters to line boxes is what makes it work. A Range over a text node
// reports one rect per line box, but not which characters are on which. So the characters
// are walked individually — one collapsed-range measurement per character — and grouped by
// the line each one landed on. That is O(chars) rect reads, and it only runs on a cache
// rebuild, never per frame. `requestWrapText` is what feeds it: without it the browser is
// free to break mid-word for us.

const EPSILON = 1

/**
 * @param {HTMLElement} el element whose text should be decomposed
 * @returns {{ text: string, x: number, y: number, w: number, h: number }[]} one entry per
 *   visual line box, in document order. Empty when the element has no text node.
 */
export function measureVisualLines(el) {
  if (!el) return []
  const node = el.firstChild
  if (!node || node.nodeType !== 3) return []

  const text = node.data
  const range = document.createRange()
  const line = text.length
  if (!line) return []

  // Environments without a layout engine do not implement this at all — it is absent from
  // Range.prototype, not merely returning an empty list. Probing for the function rather
  // than calling it is what keeps the caller on its whole-span fallback instead of throwing.
  if (typeof range.getClientRects !== 'function') return []

  // Group character indices by the line box they render into. Keyed on the rounded top of
  // the char's rect: sub-pixel jitter between two glyphs on the same line is not a line
  // change, but a real wrap moves the top by more than a pixel.
  const groups = new Map()

  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const rects = range.getClientRects()
    const rect = rects.length ? rects[0] : null
    // Whitespace at a wrap point can report no rect at all; skip it rather than dropping a
    // character index that a later glyph would key on.
    if (!rect || rect.width === 0 && rect.height === 0) continue
    const key = Math.round(rect.top / EPSILON)
    let group = groups.get(key)
    if (!group) {
      group = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, start: i, end: i }
      groups.set(key, group)
    }
    group.start = Math.min(group.start, i)
    group.end = Math.max(group.end, i + 1)
    if (rect.top < group.top) group.top = rect.top
    if (rect.left < group.left) group.left = rect.left
    if (rect.right > group.right) group.right = rect.right
    if (rect.bottom > group.bottom) group.bottom = rect.bottom
  }

  return [...groups.values()]
    .sort((a, b) => a.top - b.top)
    .map((g) => ({
      text: text.slice(g.start, g.end),
      x: g.left,
      y: g.top,
      w: g.right - g.left,
      h: g.bottom - g.top,
      start: g.start,
      end: g.end,
    }))
}