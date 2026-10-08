// @vitest-environment jsdom
// Contract for src/gl/text/lines.js — decomposing a text element into the visual lines the
// browser actually produced.
//
// jsdom has no layout engine: Range.getClientRects() returns an empty list for every range,
// so a real wrap cannot happen here. The harness below stubs the rects from a declared
// layout, which is deliberate — what is under test is the grouping logic (which characters
// belong to which line, and that the text's own breaks decide the split), not the browser's
// line breaker. The browser does the breaking; this only reads the answer.
//
// The behaviour that matters: the split point is NOT decided by this module. A mid-word
// break in the stubbed layout has to come back as a mid-word split, and a word-boundary
// break has to come back whole. If anything here hardcoded a word list, these would fail.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureVisualLines } from '../../src/gl/text/lines.js'

let layout = []

// One rect per character range, derived from a declared set of lines. Each line is
// { start, end, top, left, right, bottom } in text-node offsets.
const stubRects = (text, lines) => {
  const node = document.createTextNode(text)
  const host = document.createElement('div')
  host.appendChild(node)
  document.body.appendChild(host)

  // Assigned rather than spied: jsdom does not implement Range.getClientRects at all, so the
  // property is absent from the prototype and vi.spyOn has nothing to wrap.
  const original = Range.prototype.getClientRects
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    writable: true,
    value() {
      const out = []
      for (const line of lines) {
        const overlaps = this.startOffset < line.end && this.endOffset > line.start
        if (!overlaps) continue
        out.push({
          top: line.top,
          left: line.left,
          right: line.right,
          bottom: line.bottom,
          width: line.right - line.left,
          height: line.bottom - line.top,
        })
      }
      return out
    },
  })
  restore = () => {
    if (original) Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, writable: true, value: original })
    else delete Range.prototype.getClientRects
  }

  return { host, span: host }
}

const line = (start, end, top, left, right, height = 168) => ({
  start, end, top, left, right, bottom: top + height,
})

let restore = null

beforeEach(() => {
  layout = []
})

afterEach(() => {
  restore?.()
  restore = null
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('measureVisualLines', () => {
  it('returns a single entry when the text fits on one line', () => {
    const { span } = stubRects('Music', [line(0, 5, 100, 10, 300)])
    const out = measureVisualLines(span)

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ text: 'Music', x: 10, y: 100, w: 290 })
  })

  it('splits at the browser word boundary, not one of ours', () => {
    const { span } = stubRects('somebody say', [
      line(0, 8, 100, 0, 400),
      line(9, 12, 268, 0, 180),
    ])
    const out = measureVisualLines(span)

    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('somebody')
    expect(out[1].text).toBe('say')
  })

  it('reproduces a mid-word split when that is what the layout did', () => {
    // The whole point of the module: 140px type makes "Generative" wider than the screen,
    // and the browser breaks it wherever it likes. Hardcoding a word list would lose this.
    const { span } = stubRects('Generative', [
      line(0, 6, 100, 0, 335),
      line(6, 11, 268, 0, 300),
    ])
    const out = measureVisualLines(span)

    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('Genera')
    expect(out[1].text).toBe('tive')
  })

  it('handles three or more wrapped lines', () => {
    const { span } = stubRects('Generative', [
      line(0, 4, 100, 0, 200),
      line(4, 7, 268, 0, 200),
      line(7, 11, 436, 0, 250),
    ])
    const out = measureVisualLines(span)

    expect(out).toHaveLength(3)
    expect(out.map((l) => l.text)).toEqual(['Gene', 'rat', 'ive'])
  })

  it('orders lines by vertical position regardless of measurement order', () => {
    const { span } = stubRects('abc', [
      line(2, 3, 436, 0, 100),
      line(0, 2, 100, 0, 100),
    ])
    const out = measureVisualLines(span)

    expect(out.map((l) => l.y)).toEqual([100, 436])
  })

  it('carries the character offsets, so a caller can target one line', () => {
    const { span } = stubRects('Genera tive', [
      line(0, 6, 100, 0, 300),
      line(7, 11, 268, 0, 220),
    ])
    const out = measureVisualLines(span)

    expect(out[0]).toMatchObject({ start: 0, end: 6 })
    expect(out[1]).toMatchObject({ start: 7, end: 11 })
  })

  it('grows the box to the widest glyph on the line', () => {
    const { span } = stubRects('ab', [line(0, 2, 100, 12, 340)])
    const out = measureVisualLines(span)

    // Measured per character, so the widest single glyph is what a naive implementation
    // would report instead of the line's real extent.
    expect(out[0].x).toBe(12)
    expect(out[0].w).toBe(328)
  })

  it('returns nothing for an element with no text node', () => {
    expect(measureVisualLines(null)).toEqual([])
    const el = document.createElement('div')
    expect(measureVisualLines(el)).toEqual([])
  })

  it('returns nothing for empty text', () => {
    const { span } = stubRects('', [])
    expect(measureVisualLines(span)).toEqual([])
  })

  it('skips characters that report no rect, keeping the rest of the line', () => {
    // A collapsed range at a wrap point can report nothing. Dropping the whole line would
    // lose a word; only the characterless measurement should be skipped.
    const { span } = stubRects('ab cd', [line(0, 2, 100, 0, 120), line(3, 5, 268, 0, 120)])
    const out = measureVisualLines(span)

    expect(out).toHaveLength(2)
    expect(out[0].text).toBe('ab')
    expect(out[1].text).toBe('cd')
  })
})