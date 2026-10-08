import * as THREE from 'three'

// Rasterises every row into ONE 2D canvas and hands back a single texture plus
// each row's slice, in both pixels and UV. One texture for N rows: the draw
// calls are per-row (they need individual depth and render order) but the
// raster cost and GPU memory are not.
//
// Rich text: each row may carry `segments` (see textRows.js parseInline) plus
// row-level overrides (fontFamily, fontWeight, color, align, ...). Segments
// win over the row, the row wins over the globals, so the second row can use
// a different font while the rest keeps --f-title. Rows without segments fall
// back to plain `row.text` and behave exactly like before.

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

// Fallback when there is no DOM (tests, SSR): mirrors :root in global.css.
const KNOWN_VARS = {
  '--f-title': "'Bricolage Grotesque', Georgia, 'Times New Roman', serif",
  '--f-text': "'Hedvig Letters Serif', Georgia, 'Times New Roman', serif",
  '--f-data': "'Darker Grotesque', 'Bricolage Grotesque', Georgia, serif",
  '--c-accent': '#083D2A',
  '--c-ink': '#111111',
  '--c-field': '#F5F1EA',
}

const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g

/** Resolve `var(--x, fallback)` against the live cascade; unknown vars keep fallback or raw. */
export function resolveCssValue(value) {
  if (!value || typeof value !== 'string' || !value.includes('var(')) return value
  const rootStyle =
    typeof document !== 'undefined' && document.documentElement
      ? getComputedStyle(document.documentElement)
      : null
  return value.replace(VAR_RE, (_, name, fallback) => {
    if (rootStyle) {
      const live = rootStyle.getPropertyValue(name).trim()
      if (live) return live
    }
    if (KNOWN_VARS[name]) return KNOWN_VARS[name]
    return (fallback || '').trim() || _
  })
}

export function fontForSegment({ fontWeight = 'normal', italic, bold, fontSize, fontFamily }) {
  const style = italic ? 'italic ' : ''
  const weight = bold ? '700' : fontWeight
  return `${style}${weight} ${fontSize}px ${resolveCssValue(fontFamily)}`
}

export function resolveSegmentColor(segment, baseColor, accentColor) {
  if (segment && segment.color) return resolveCssValue(segment.color)
  if (segment && segment.accent) return resolveCssValue(accentColor) || resolveCssValue(baseColor)
  return resolveCssValue(baseColor)
}

function rowSegments(row) {
  if (Array.isArray(row.segments) && row.segments.length) return row.segments
  return [{ text: row.text || '', bold: false, italic: false, underline: false, strike: false, color: null, accent: false, fontFamily: null, fontWeight: null, anim: false }]
}

function effectiveRow(row, globals) {
  return {
    fontFamily: row.fontFamily || globals.fontFamily,
    fontWeight: row.fontWeight || globals.fontWeight || 'normal',
    color: row.color || globals.color,
    accentColor: row.accentColor || globals.accentColor || globals.color,
    align: row.align || 'left',
    letterSpacing: row.letterSpacing || null,
    bold: row.bold === true,
    italic: row.italic === true,
  }
}

function segmentFont(seg, rowEff, fontSize) {
  return fontForSegment({
    fontWeight: seg.fontWeight || rowEff.fontWeight,
    italic: seg.italic || rowEff.italic,
    bold: seg.bold || rowEff.bold,
    fontSize,
    fontFamily: resolveCssValue(seg.fontFamily) || rowEff.fontFamily,
  })
}

export function measureRowWidth(row, { fontFamily, fontWeight = 'normal', color, accentColor, ctx }) {
  const rowEff = effectiveRow(row, { fontFamily, fontWeight, color, accentColor })
  const segments = rowSegments(row)
  const prevSpacing = (() => {
    try {
      return ctx.letterSpacing
    } catch {
      return undefined
    }
  })()
  try {
    if (rowEff.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = rowEff.letterSpacing
  } catch {
    // letterSpacing unsupported — measuring without it is the correct fallback.
  }
  let width = 0
  for (const seg of segments) {
    ctx.font = segmentFont(seg, rowEff, row.fontSize)
    width += ctx.measureText(seg.text).width
  }
  try {
    if (prevSpacing !== undefined && 'letterSpacing' in ctx) ctx.letterSpacing = prevSpacing
  } catch {
    // ignore restore failure
  }
  // Italic/bold glyphs paint past their advance width (the classic case is a
  // trailing italic 's'), so the advance sum alone clips ink at the slice
  // edge. Include the real ink overhang and the fit + slice grow with it.
  const ov = rowOverflow(row, { fontFamily, fontWeight, color, accentColor, ctx })
  return width + ov.left + ov.right
}

// Ink overhang past the advance box, in CSS px at the row's own fontSize.
// `left` is how far ink starts before the pen origin (rare, e.g. italic
// swashes); `right` is how far the last glyph paints past its advance
// (e.g. the trailing 's' of an italic word). Zero when the browser does not
// expose actualBoundingBox — then behavior is exactly as before.
export function rowOverflow(row, { fontFamily, fontWeight = 'normal', color, accentColor, ctx }) {
  const none = { left: 0, right: 0 }
  if (!ctx || typeof ctx.measureText !== 'function') return none
  const rowEff = effectiveRow(row, { fontFamily, fontWeight, color, accentColor })
  const segments = rowSegments(row)
  if (!segments.length) return none
  let prevSpacing
  try {
    prevSpacing = ctx.letterSpacing
  } catch {
    prevSpacing = undefined
  }
  try {
    if (rowEff.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = rowEff.letterSpacing
  } catch {
    // letterSpacing unsupported — measuring without it is the correct fallback.
  }
  let left = 0
  let right = 0
  try {
    ctx.font = segmentFont(segments[0], rowEff, row.fontSize)
    const first = ctx.measureText(segments[0].text)
    if (typeof first.actualBoundingBoxLeft === 'number') {
      left = Math.max(0, -first.actualBoundingBoxLeft)
    }
    const lastSeg = segments[segments.length - 1]
    ctx.font = segmentFont(lastSeg, rowEff, row.fontSize)
    const last = ctx.measureText(lastSeg.text)
    if (typeof last.actualBoundingBoxRight === 'number') {
      right = Math.max(0, last.actualBoundingBoxRight - last.width)
    }
  } catch {
    // keep zero overflows
  }
  try {
    if (prevSpacing !== undefined && 'letterSpacing' in ctx) ctx.letterSpacing = prevSpacing
  } catch {
    // ignore restore failure
  }
  return { left, right }
}

export function buildTextAtlas({
  rows,
  fontFamily,
  fontWeight = 'normal',
  color,
  accentColor = null,
  lineHeight,
  pad,
  dpr = 1,
}) {
  const empty = {
    canvas: createCanvas(1, 1),
    texture: null,
    animCanvas: createCanvas(1, 1),
    animTexture: null,
    slices: [],
    width: 0,
    height: 0,
  }
  if (!rows.length) return empty

  const probe = createCanvas(1, 1).getContext('2d')
  const globals = { fontFamily, fontWeight, color, accentColor }

  const metrics = rows.map((row) => ({
    width: measureRowWidth(row, { ...globals, ctx: probe }),
    height: row.fontSize * lineHeight,
    // Room before the pen origin for ink that starts left of it; the draw
    // cursor begins here so swashes never paint outside the canvas.
    left: rowOverflow(row, { ...globals, ctx: probe }).left,
  }))

  const contentWidth = Math.max(...metrics.map((m) => m.width))
  const atlasWidth = contentWidth + pad * 2
  const atlasHeight = metrics.reduce((sum, m) => sum + m.height + pad * 2, 0)

  const canvas = createCanvas(atlasWidth * dpr, atlasHeight * dpr)
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'alphabetic'

  // Mask for '.accent-anim' segments: one gray level per segment on
  // transparent, same layout as the color atlas. The gray value is the segment's
  // ID (1-255, wrap): the fragment shader derives a per-span phase + speed
  // from it, so sibling spans drift out of sync instead of marching in step.
  // Empty areas stay transparent black, and the shader only reads the mask
  // where its alpha is above threshold.

  const animCanvas = createCanvas(atlasWidth * dpr, atlasHeight * dpr)
  const animCtx = animCanvas.getContext('2d')
  animCtx.scale(dpr, dpr)
  animCtx.textBaseline = 'alphabetic'

  const slices = []
  let cursorY = 0
  let animId = 0

  rows.forEach((row, i) => {
    const rowEff = effectiveRow(row, globals)
    const { width, height } = metrics[i]
    const alignFactor = rowEff.align === 'center' ? 0.5 : rowEff.align === 'right' ? 1 : 0
    const x = pad + (contentWidth - width) * alignFactor
    const y = cursorY + pad

    // alphabetic baseline sits one descent above the box bottom
    const baseline = y + height - row.fontSize * 0.2
    try {
      if (rowEff.letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = rowEff.letterSpacing
    } catch {
      // unsupported — draw without tracking.
    }
    let cursorX = x + (metrics[i].left || 0)
    const rowSegs = rowSegments(row)
    // Pre-measure once so color + mask stay pixel-aligned.
    const segWidths = rowSegs.map((seg) => {
      ctx.font = segmentFont(seg, rowEff, row.fontSize)
      return ctx.measureText(seg.text).width
    })
    rowSegs.forEach((seg, si) => {
      const font = segmentFont(seg, rowEff, row.fontSize)
      // Animated glyphs are recolored in-shader; white keeps the atlas neutral.
      const fill = seg.anim ? '#FFFFFF' : resolveSegmentColor(seg, rowEff.color, rowEff.accentColor)
      ctx.font = font
      ctx.fillStyle = fill
      ctx.fillText(seg.text, cursorX, baseline)
      const segWidth = segWidths[si]
      const x1 = cursorX + segWidth
      let animFill = null
      if (seg.anim) {
        // 1-based: 0 stays reserved for "no segment" (transparent black).
        const aid = ((animId++ % 255) + 1)
        animFill = `rgb(${aid},${aid},${aid})`
        animCtx.font = font
        animCtx.fillStyle = animFill
        animCtx.fillText(seg.text, cursorX, baseline)
      }
      if (seg.underline) {
        const uy = baseline + row.fontSize * 0.08
        ctx.strokeStyle = fill
        ctx.lineWidth = Math.max(1, row.fontSize * 0.055)
        ctx.beginPath()
        ctx.moveTo(cursorX, uy)
        ctx.lineTo(x1, uy)
        ctx.stroke()
        if (seg.anim) {
          animCtx.strokeStyle = animFill
          animCtx.lineWidth = Math.max(1, row.fontSize * 0.055)
          animCtx.beginPath()
          animCtx.moveTo(cursorX, uy)
          animCtx.lineTo(x1, uy)
          animCtx.stroke()
        }
      }
      if (seg.strike) {
        const sy = baseline - row.fontSize * 0.28
        ctx.strokeStyle = fill
        ctx.lineWidth = Math.max(1, row.fontSize * 0.05)
        ctx.beginPath()
        ctx.moveTo(cursorX, sy)
        ctx.lineTo(x1, sy)
        ctx.stroke()
        if (seg.anim) {
          animCtx.strokeStyle = animFill
          animCtx.lineWidth = Math.max(1, row.fontSize * 0.05)
          animCtx.beginPath()
          animCtx.moveTo(cursorX, sy)
          animCtx.lineTo(x1, sy)
          animCtx.stroke()
        }
      }
      cursorX = x1
    })
    try {
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    } catch {
      // ignore
    }

    slices.push({
      index: i,
      behind: row.behind,
      fontSize: row.fontSize,
      rect: { x, y, width, height },
      // flipY is off, so v = 0 is the canvas TOP. A plane's top edge carries
      // uv.y = 1, so the row's top (v0) has to land on uv.y = 1 or the glyphs
      // render upside down.
      uv: {
        u0: x / atlasWidth,
        u1: (x + width) / atlasWidth,
        v0: y / atlasHeight,
        v1: (y + height) / atlasHeight,
      },
    })

    cursorY += height + pad * 2
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.flipY = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  const animTexture = new THREE.CanvasTexture(animCanvas)
  animTexture.flipY = false
  animTexture.minFilter = THREE.LinearFilter
  animTexture.magFilter = THREE.LinearFilter
  animTexture.generateMipmaps = false
  animTexture.needsUpdate = true

  return { canvas, texture, animCanvas, animTexture, slices, width: atlasWidth, height: atlasHeight }
}

export function disposeAtlas(atlas) {
  if (!atlas) return
  if (atlas.texture) atlas.texture.dispose()
  if (atlas.animTexture) atlas.animTexture.dispose()
}
