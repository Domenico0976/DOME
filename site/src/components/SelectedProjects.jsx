import React, { Suspense, lazy, useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'
import { useArchiveCursor } from '../hooks/useArchiveCursor'
import { useCursorGate } from '../hooks/useCursorGate'
import { measureVisualLines } from '../gl/text/lines.js'
import { useMatrixRain } from '../hooks/useMatrixRain'
import { TABLET_BREAKPOINT } from '../constants/breakpoints'
import { shouldEnableSectionWebGL } from '../utils/webglPolicy'
import { projects } from './selectedProjects/projectsData'
import { vertexShader, fragmentShader } from '../shaders/tileReveal'

// Re-exported so MobileSectionCanvas keeps importing the effect from this file
// (the module lives in src/shaders/tileReveal.js; this is a facade only).
export { vertexShader, fragmentShader }

// Split with the hero into the chunk that carries the `shaders` package. The
// callout's own DOM lines are rendered below regardless, so Suspense falling back
// to null just means the mask has not arrived yet — the same state the effect is
// in before its entrance anyway.
const FocusCalloutShader = lazy(() => import('./FocusCalloutShader.jsx'))

gsap.registerPlugin(ScrollTrigger)

// ponytail: scroll landing ease — slow start (easeInOut body, not too slow),
// then a slight overshoot past the target that settles back, always smooth.
// p(0)=0, p(1)=1 so Lenis lands exactly on target after the settle.
const scrollSettleEase = (t) => {
  const base = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  const tail = t <= 0.7 ? 0 : 0.03 * Math.sin(((t - 0.7) / 0.3) * Math.PI)
  return base + tail
}

// One cell size for BOTH the DOM tile grid and the 2D pixel buffer. They used to be
// unrelated: the grid was a fixed 12x5 of CSS grid tracks while the buffer stepped in
// 7px cells, so the tiles were never the thing the buffer had sampled and the block
// effect read as much coarser than the glyphs underneath it. Shared, a DOM tile is
// exactly one buffer cell.
//
// 5px against a 70px title is roughly a fourteenth of the cap height, which is the usual
// scale for a pixel treatment: coarser and the thin strokes of a 70px glyph break into
// disconnected blocks with holes between them. buildDOM emits a tile only for the cells
// that carry ink, which is what keeps the count affordable — measured at 420 tiles for a
// 360px-wide title, out of 1368 cells.
const GRID_CELL = 22

// How far a drawn block spills past its own cell, in CSS px, on every side. Source rect AND
// destination widen by the same amount, so the scale stays exactly 1:1.
//
// ZERO, and that is measured rather than timid. Dilation cannot deliver "connected but not
// bolder": the block samples the ink of its neighbours' strokes, so an 8px stroke drawn at
// bleed 1 comes out 10px — measured at +17% ink against the DOM text, which is precisely the
// "glyphs look thicker" report — and it dissolved the pixel structure into one flat mass. The
// source rect must land on whole device pixels anyway, so on a 1x display even 0.5 rounds up
// to a full pixel and changes nothing: there is no value here that is both sub-pixel and
// non-shimmering on every screen.
//
// The merge the effect needs is NOT dilation. Displaced blocks already stretch into each
// other while the cursor moves, because the spring pulls on both neighbours. Static fusion
// without added weight needs a blur plus an alpha threshold, which snaps the soft edge back
// to where it started instead of pushing it out. That is a larger change and is deliberately
// not here.
const CELL_BLEED = 0.25

// Alpha above which a rasterised cell counts as carrying ink, and therefore worth a
// DOM tile. Mirrors the threshold startWebGL uses on its own coverage mask.
const GRID_INK_ALPHA = 0

// Total wall-clock the tile blotch-fade takes to travel from the centre outwards,
// whatever the tile count. GSAP's `each` is per tile, so this has to be divided by the
// tile count or a denser grid stretches the fade instead of speeding it up.
const TILE_FADE_SPAN = 0.2

// Callout entrance: every line's text starts at a random offset and travels to its
// own natural position, clipped the whole way by the box of its own line. Desktop
// keeps the four two-word lines; mobile swaps in the three-word phrase split one
// word per row. The DOM text is never painted — FocusCalloutShader replays the
// same offsets into the mask, so the shader is what you see slide in.
const CALLOUT_LINES_DESKTOP = ['somebody say ', 'it\'s just music', 'but what if could ', 'be different thinghs?']
const CALLOUT_LINES_MOBILE = ['Music', 'Are', 'Genera','tive']

// Exported so the entrance tests assert against the values themselves instead of
// copied literals, which went stale the first time any of these was tuned in the
// editor and left the suite red on a change that was perfectly valid.

// Offset between consecutive lines, in seconds. The entrance is started by scroll but
// played by the clock (see the ScrollTrigger below), so this is a real time gap: the
// cascade is guaranteed rather than left to however fast the visitor happens to be
// scrolling.
export const CALLOUT_REVEAL_STEP = 0.29
// How long one line takes to arrive. NOT independent of STEP: the last line starts
// three steps in, so a travel shorter than that stagger would have the last lines
// begin after the first has already landed, and the block reads as a queue instead of
// four words arriving together. A test pins that ordering — the two must be tuned
// together.
export const CALLOUT_REVEAL_DURATION = 1.4
// The scroll position that starts the entrance. It says WHEN the lines begin and
// nothing else — the animation is not scrubbed, so scrolling on after this does not
// drive it, and scrolling back up cannot rewind it.
export const CALLOUT_REVEAL_START = 'top 82%'
// How far outside its own box a line starts, as a multiple of its own size. A range
// whose ends are equal is a fixed offset, not a random one; the lines then differ only
// by direction, which is what the alternating side is for.
export const CALLOUT_REVEAL_TRAVEL_X = [0.015, 0.015]
export const CALLOUT_REVEAL_TRAVEL_Y = [0.0, 0.09]

const ExternalSvg = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M3 9L9 3M5 3h4v4" strokeLinecap="round" strokeLinejoin="round"></path>
  </svg>
)

const ProjectRow = ({ project, onProjectClick, onProjectTap, isExpanded }) => {
  const { isTouch: gateIsTouch, isAwake, parked } = useCursorGate()
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= TABLET_BREAKPOINT
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT}px)`)
    const on = () => setIsCompact(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const rowRef = useRef(null)
  const nameRef = useRef(null)
  const tlRef = useRef(null)
  const animDoneRef = useRef(true)
  const heightRef = useRef(0)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef(null)
  const webglRafRef = useRef(null)
  // The hover pixel pass uses one 2D context per row. Creating a fresh WebGL
  // context on every hover eventually exhausts Chrome's context budget.
  const glRef = useRef(null)
  const pixelCtxRef = useRef(null)
  const pixelSourceRef = useRef(null)
  const cvsRef = useRef(null)
  const originalRef = useRef(null)
  const cloneRef = useRef(null)
  const charRefsRef = useRef([])
  const ctxRef = useRef(null)
  const pointerHandlersRef = useRef(null)
  // Controller for the running pixel pass (release / finishNow) — see startWebGL.
  const pixelPassRef = useRef(null)
  // True once a pixel pass has run at least once; wrapper re-entries then
  // re-engage the layer instantly instead of replaying the full wave.
  const everRanRef = useRef(false)
  // Live proxy array of the running pass — handleLeave reverses these to
  // send the pixel clone back up through the clip window.
  const proxiesRef = useRef(null)
  // True while the pointer is inside the row: wrapper-level enter events only
  // resume/re-engage the layer when the row hover is already in progress.
  const insideRowRef = useRef(false)
  // Background pixelation: a drifting grid of dark cells drawn over the
  // half-moon light so the glow reads as quantised pixels. One 2D context per
  const bloomRef = useMatrixRain({ rowRef, isCompact, isExpanded })

  const getFontStyle = () => {
    const el = nameRef.current
    if (!el) return `400 ${heightRef.current}px var(--f-title)`
    const cs = getComputedStyle(el)
    return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  }

  // Rest state: only the original is visible; clone is pre-clipped for the
  // next run (it hides via clip-path, never via opacity during the reveal).
  const resetTextState = () => {
    const el = nameRef.current
    if (!el) return
    const orig = el.querySelector('.pr-name__original')
    const clone = el.querySelector('.pr-name__clone')
    if (orig) gsap.set(orig, { opacity: 1, y: 0, clipPath: 'inset(0 0 0 0)' })
    if (clone) gsap.set(clone, { opacity: 1, y: 0, clipPath: 'inset(0 0 0 0)' })
    gsap.set(el.querySelectorAll('.pr-name__original .pr-char'), {
      opacity: 1, y: 0
    })
    gsap.set(el.querySelectorAll('.pr-name__clone .pr-char'), {
      opacity: 0, y: -heightRef.current
    })
  }

  const restoreText = () => {
    const el = nameRef.current
    if (!el) return
    resetTextState()
    const track = el.querySelector('.pr-name__track')
    if (track) gsap.set(track, { y: 0 })
    const grid = el.querySelector('.pr-name__grid')
    if (grid) gsap.set(grid, { opacity: 0 })
    const cvs = el.querySelector('.pr-name__canvas')
    if (cvs) gsap.set(cvs, { opacity: 0 })
    void el.offsetHeight
  }

  // One DOM tile per GRID_CELL cell that actually carries ink, and nothing for the empty
  // majority of the bounding box. The tiles outlive the hover and the tiles' grid is not
  // rebuilt on the next one, so their count compounds across every row the visitor has
  // touched: culling is what keeps GRID_CELL small enough to afford. Runs once per row.
  const buildTileGrid = (grid, original) => {
    const wrapRect = grid.getBoundingClientRect()
    const w = Math.round(wrapRect.width)
    const h = Math.round(wrapRect.height)
    if (w <= 0 || h <= 0) return
    const cols = Math.max(1, Math.ceil(w / GRID_CELL))
    const rows = Math.max(1, Math.ceil(h / GRID_CELL))
    grid.style.gridTemplateColumns = `repeat(${cols}, ${GRID_CELL}px)`
    grid.style.gridTemplateRows = `repeat(${rows}, ${GRID_CELL}px)`

    const spans = Array.from(original.querySelectorAll('.pr-char'))
    if (!spans.length) return
    const cs = getComputedStyle(original)
    const fontSize = parseFloat(cs.fontSize) || 40

    // Rasterised at 1px per CSS px on purpose: the only question here is "does this cell
    // carry ink", so a device-scale buffer would cost memory and buy nothing.
    const raster = document.createElement('canvas')
    raster.width = w
    raster.height = h
    const rctx = raster.getContext('2d', { willReadFrequently: true })
    if (!rctx) return
    rctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    rctx.textBaseline = 'alphabetic'
    const metrics = rctx.measureText('Hg')
    const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.8
    const descent = metrics.fontBoundingBoxDescent || fontSize * 0.2

    const firstRect = spans[0].getBoundingClientRect()
    // Centre the ink band in the glyphs' own line box, which is where CSS puts it, rather
    // than in the wrapper's box: the two only coincide while the leading happens to line
    // up, and that is the whole reason the glyph mask used to sit off the baseline.
    const baselineY = (firstRect.top - wrapRect.top)
      + (firstRect.height - (ascent + descent)) / 2 + ascent
    for (const span of spans) {
      const r = span.getBoundingClientRect()
      rctx.fillText(span.textContent, r.left - wrapRect.left, baselineY)
    }
    const data = rctx.getImageData(0, 0, w, h).data

    for (let ry = 0; ry < rows; ry++) {
      const y0 = ry * GRID_CELL
      const yEnd = Math.min(y0 + GRID_CELL, h)
      for (let rx = 0; rx < cols; rx++) {
        const x0 = rx * GRID_CELL
        const xEnd = Math.min(x0 + GRID_CELL, w)
        let inked = false
        for (let y = y0; y < yEnd && !inked; y++) {
          for (let x = x0; x < xEnd; x++) {
            if (data[(y * w + x) * 4 + 3] > GRID_INK_ALPHA) { inked = true; break }
          }
        }
        if (!inked) continue
        const tile = document.createElement('div')
        tile.className = 'pr-name__tile'
        grid.appendChild(tile)
      }
    }
  }

  const buildDOM = () => {
    const el = nameRef.current
    if (!el) return

    // The CSS owns this box. --pr-title-leading is >= the font's ascent+descent, so the
    // h3 is already tall enough for its glyphs before any of this runs and the measured
    // height is the same one it had before hover. Deriving a height from canvas font
    // metrics and pinning it inline is what used to make the title jump on first hover.
    const boxHeight = el.getBoundingClientRect().height || 40
    heightRef.current = boxHeight

    const prevWrapper = el.querySelector('.pr-name__wrapper')
    if (prevWrapper) prevWrapper.remove()

    const buildChars = (parent, text) => {
      const chars = []
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span')
        span.className = 'pr-char'
        span.style.cssText = 'display:inline-block;'
        span.textContent = text[i] === ' ' ? '\u00A0' : text[i]
        parent.appendChild(span)
        chars.push(span)
      }
      return chars
    }

    // Measure the text width BEFORE replacing the content: the h3 spans the
    // whole grid column, so sizing overlays from el's rect stretched the tile
    // grid / canvas full-width (root cause of the stretched grid bug).
    const measurer = document.createElement('span')
    measurer.className = 'pr-name__width-measure'
    measurer.style.cssText =
      'position:absolute;visibility:hidden;white-space:nowrap;display:inline-block;line-height:normal;'
    el.appendChild(measurer)
    buildChars(measurer, project.name)
    const textW = Math.ceil(measurer.getBoundingClientRect().width)
    const hoverBufferRight = 12
    measurer.remove()
    void el.offsetHeight

    const wrapper = document.createElement('span')
    wrapper.className = 'pr-name__wrapper'
    wrapper.style.cssText =
      `display:inline-block;overflow:hidden;position:relative;vertical-align:top;width:${textW + hoverBufferRight}px;`

    const track = document.createElement('span')
    track.className = 'pr-name__track'
    track.style.cssText = 'display:block;overflow:hidden;height:inherit;position:relative;z-index:5;'

    const original = document.createElement('span')
    original.className = 'pr-name__original'
    original.style.cssText = 'display:block;line-height:inherit;'
    charRefsRef.current = buildChars(original, project.name)
    track.appendChild(original)

    const clone = document.createElement('span')
    clone.className = 'pr-name__clone'
    clone.style.cssText = 'display:block;line-height:inherit;position:absolute;top:0;left:0;width:100%;'
    buildChars(clone, project.name)
    track.appendChild(clone)

    wrapper.appendChild(track)

    const grid = document.createElement('div')
    grid.className = 'pr-name__grid'
    // Emptied here on purpose: sizing it needs the wrapper's real box, and the wrapper
    // is not in the document yet. buildTileGrid fills it right after the append.
    wrapper.appendChild(grid)

    const cvs = document.createElement('canvas')
    cvs.className = 'pr-name__canvas'
    cvs.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;opacity:0;z-index:6;'
    wrapper.appendChild(cvs)
    cvsRef.current = cvs

    el.textContent = ''
    el.appendChild(wrapper)

    buildTileGrid(grid, original)

    const wrapW = Math.round(wrapper.getBoundingClientRect().width)
    cvs.width = wrapW * 2
    cvs.height = heightRef.current * 2

    originalRef.current = original
    cloneRef.current = clone
  }

  const initPixelCanvas = () => {
    const cvs = cvsRef.current
    const el = nameRef.current
    const wrapper = cvs?.parentElement
    if (!cvs || !el || !wrapper) return null

    const width = Math.max(1, Math.round(cvs.clientWidth || wrapper.clientWidth || 1))
    const height = Math.max(1, Math.round(cvs.clientHeight || wrapper.clientHeight || heightRef.current || 1))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cvs.width = Math.round(width * dpr)
    cvs.height = Math.round(height * dpr)

    const ctx = cvs.getContext('2d', { alpha: true })
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    const source = document.createElement('canvas')
    source.width = cvs.width
    source.height = cvs.height
    const sourceCtx = source.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!sourceCtx) return null
    sourceCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    sourceCtx.imageSmoothingEnabled = false
    sourceCtx.font = getFontStyle()
    sourceCtx.textBaseline = 'alphabetic'

    // Baseline from real font metrics so the canvas glyphs land exactly on the
    // DOM line; X positions come from the live char spans, so the negative
    // letter-spacing and the per-char layout match 1:1.
    const cs = getComputedStyle(el)
    const fontSize = parseFloat(cs.fontSize) || 40
    const metrics = sourceCtx.measureText('Hg')
    const ascent = metrics.fontBoundingBoxAscent || fontSize * 0.8
    const descent = metrics.fontBoundingBoxDescent || fontSize * 0.2
    // Baseline from the wrapper's own measured box rather than a cached heightRef: the two
    // only agree while nothing has resized the title, and when they disagree every glyph
    // is drawn off the line and the text reads as broken.
    const baselineY = (height - (ascent + descent)) / 2 + ascent
    const ink = cs.color || '#111111'

    const wrapRect = wrapper.getBoundingClientRect()
    const charEls = wrapper.querySelectorAll('.pr-name__original .pr-char')
    const glyphs = charEls.length
      ? Array.from(charEls).map((span) => {
          const r = span.getBoundingClientRect()
          return { x: r.left - wrapRect.left, text: span.textContent }
        })
      : [{ x: 0, text: project.name }]

    // Redraws the clone glyphs into the scratch source at per-char Y offsets:
    // `offsets` is a number (uniform), an array (one y per char) or null.
    const renderSource = (offsets) => {
      sourceCtx.clearRect(0, 0, width, height)
      sourceCtx.globalCompositeOperation = 'source-over'
      sourceCtx.fillStyle = '#fff'
      glyphs.forEach((g, i) => {
        const off = offsets == null ? 0 : (typeof offsets === 'number' ? offsets : (offsets[i] || 0))
        sourceCtx.fillText(g.text, g.x, baselineY + off)
      })
      // Tint the glyph mask with the live title colour: the canvas sits
      // directly over the DOM text with no blend mode and no colour shift.
      sourceCtx.globalCompositeOperation = 'source-in'
      sourceCtx.fillStyle = ink
      sourceCtx.fillRect(0, 0, width, height)
      sourceCtx.globalCompositeOperation = 'source-over'
    }

    renderSource(null)

    pixelCtxRef.current = ctx
    pixelSourceRef.current = source
    return { ctx, source, sourceCtx, width, height, dpr, renderSource }
  }

  
  const startWebGL = (swapEndMs = 1000, proxies = null, baseSpans = []) => {
    const cvs = cvsRef.current
    const el = nameRef.current
    if (!cvs || !el) return

    const surface = initPixelCanvas()
    if (!surface) return
    const { ctx, source, sourceCtx, width, height, dpr, renderSource } = surface
    // The same constant buildDOM used for the DOM grid, so one tile is one buffer cell.
    const cell = GRID_CELL
    const cols = Math.ceil(width / cell)
    const rows = Math.ceil(height / cell)

    const offX = new Float32Array(cols * rows)
    const offY = new Float32Array(cols * rows)
    const velX = new Float32Array(cols * rows)
    const velY = new Float32Array(cols * rows)
    // Coverage = union of the glyph cells across the whole descent, so no
    // tile flickers while the characters travel through the window.
    const covered = new Uint8Array(cols * rows)
    const travel = heightRef.current || height
    const SAMPLES = 5
    for (let s = 0; s < SAMPLES; s++) {
      renderSource(-(travel * s) / (SAMPLES - 1))
      const data = sourceCtx.getImageData(0, 0, source.width, source.height).data
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let hit = false
          const x = c * cell
          const y = r * cell
          // Every pixel of the cell, not every other one. Step 2 meant a stroke thinner than the
          // sample pitch could fall entirely between probes and the cell was never drawn —
          // that is what broke the glyph into separate pieces. Step 1 is 25 probes instead of
          // 9, costs nothing (this runs once per pass, not per frame) and makes `covered`
          // exact, so no cell has to be drawn speculatively to patch a missed one.
          for (let sy = 0; sy < cell && !hit; sy++) {
            for (let sx = 0; sx < cell; sx++) {
              const px = Math.min(source.width - 1, Math.round((x + sx) * dpr))
              const py = Math.min(source.height - 1, Math.round((y + sy) * dpr))
              if (data[(py * source.width + px) * 4 + 3] > GRID_INK_ALPHA) { hit = true; break }
            }
          }
          if (hit) covered[r * cols + c] = 1
        }
      }
    }
    renderSource(proxies ? proxies.map((p) => p.y) : null)

    const STIFF = 0.16
    const DAMP = 0.78
    const RADIUS = 120
    const FORCE = 9
    let released = false
    everRanRef.current = true

    // The layer fades in immediately: the tiles are the clone from frame zero.
    gsap.to(cvs, { opacity: 1, duration: 0.3, delay: 0.08, ease: 'power2.out', overwrite: 'auto' })

    const finish = (restore = true) => {
      pixelPassRef.current = null
      if (tlRef.current) { tlRef.current.kill(); tlRef.current = null }
      if (webglRafRef.current) { cancelAnimationFrame(webglRafRef.current); webglRafRef.current = null }
      stopWebGL()
      if (restore) restoreText()
      const wrapper = el.querySelector('.pr-name__wrapper')
      if (wrapper) {
        wrapper.style.filter = ''
        wrapper.classList.remove('is-pixelating')
      }
      animDoneRef.current = true
    }

    const controller = {
      isReleased: () => released,
      // Pointer left the canvas but the row is still hovered: springs carry
      // the tiles (and the text they compose) back home and the layer stays
      // alive for the next pass of the cursor.
      release: () => { released = true },
      // Row hover ended: handleLeave runs the reverse exchange, then calls
      // finishNow() to stop the pass and restore the base text.
      resume: () => {
        if (pixelPassRef.current !== controller) return
        released = false
      },
      finishNow: (restore = true) => {
        if (pixelPassRef.current !== controller) return
        gsap.killTweensOf(cvs)
        cvs.style.opacity = '0'
        finish(restore)
      }
    }
    pixelPassRef.current = controller

    const tick = () => {
      webglRafRef.current = requestAnimationFrame(tick)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // The tiles inherit the clone's animated position every frame.
    renderSource(proxies ? proxies.map((p) => p.y) : null)


      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          if (!covered[i]) continue
          const x = c * cell
          const y = r * cell
          // Light force that follows the pointer: tiles near the cursor are
          // pushed away from it; everywhere else the spring target is home.
          let tx = 0
          let ty = 0
          if (!released) {
            const dx = x + cell * 0.5 - mx
            const dy = y + cell * 0.5 - my
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < RADIUS && dist > 0.001) {
              const f = 1 - dist / RADIUS
              const push = f * f * FORCE
              tx = (dx / dist) * push
              ty = (dy / dist) * push
            }
          }
          // Spring integration: fluid, organic pursuit and return.
          velX[i] = (velX[i] + (tx - offX[i]) * STIFF) * DAMP
          velY[i] = (velY[i] + (ty - offY[i]) * STIFF) * DAMP
          offX[i] += velX[i]
          offY[i] += velY[i]

          // Bleed is counted in DEVICE pixels and the destination offset is derived back from it,
          // so source and destination still grow by the same number and the scale stays 1:1.
          // A fractional source rect would make drawImage round, and the block edge shimmers.
          const bpx = Math.round(CELL_BLEED * dpr)
          const bcss = bpx / dpr
          // Clamped at 0 because the first row and column have no source to the left or
          // above; without it drawImage would sample outside the buffer.
          const sx = Math.max(0, Math.round(x * dpr) - bpx)
          const sy = Math.max(0, Math.round(y * dpr) - bpx)
          const sw = Math.min(Math.round(cell * dpr) + bpx * 2, source.width - sx)
          const sh = Math.min(Math.round(cell * dpr) + bpx * 2, source.height - sy)
          if (sw <= 0 || sh <= 0) continue
          ctx.drawImage(source, sx, sy, sw, sh,
            x + offX[i] - bcss, y + offY[i] - bcss, sw / dpr, sh / dpr)
        }
      }
    }
    webglRafRef.current = requestAnimationFrame(tick)
  }

  const stopWebGL = () => {
    pixelPassRef.current = null
    if (webglRafRef.current) {
      cancelAnimationFrame(webglRafRef.current)
      webglRafRef.current = null
    }
    const cvs = cvsRef.current
    if (cvs) {
      cvs.style.opacity = '0'
      const ctx = pixelCtxRef.current
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, cvs.width, cvs.height)
      }
    }
    pixelCtxRef.current = null
    pixelSourceRef.current = null
    if (glRef.current?.gl) {
      try { glRef.current.gl.deleteTexture(glRef.current.tex) } catch {}
      try { glRef.current.gl.deleteProgram(glRef.current.prog) } catch {}
      glRef.current.gl = null
    }
    glRef.current = null
  }

  const handleEnter = (e) => {
    // On touch a tap fires mouseenter, and this runs a full pixel pass plus a
    // displacement timeline. Gate on the touch cursor actually being held, so a
    // bare finger only scrolls. Without this the effect fires on every tap — on
    // phones too, which is why it was never caught as tablet-specific.
    if (gateIsTouch && !isAwake.current) return
    insideRowRef.current = true
    const currentPass = pixelPassRef.current
    if (currentPass) {
      // A leave still in progress (tiles springing home) is finished cleanly
      // first. An already-running wave ignores duplicate mouseenters: swapping
      // the DOM nodes under the pointer re-fires mouseenter and would loop
      // the whole sequence otherwise.
      if (currentPass.isReleased()) currentPass.finishNow()
      else return
    }
    if (!animDoneRef.current) return
    animDoneRef.current = false

    if (tlRef.current) {
      tlRef.current.kill()
      tlRef.current = null
    }
    // clean up any previous run's pass/RAF
    stopDisplacement()
    stopWebGL()

    // Reuse the built DOM after the first hover: rebuilding swaps nodes under
    // the pointer, which re-fires mouseenter and loops the sequence.
    let freshBuild = false
    const el0 = nameRef.current
    if (el0 && el0.querySelector('.pr-name__wrapper')) {
      heightRef.current = el0.getBoundingClientRect().height || heightRef.current
    } else {
      buildDOM()
      freshBuild = true
    }
    const el = nameRef.current
    if (!el) return

    const wrapper = el.querySelector('.pr-name__wrapper')
    const track = wrapper?.querySelector('.pr-name__track')
    const grid = wrapper?.querySelector('.pr-name__grid')
    const tiles = grid ? Array.from(grid.querySelectorAll('.pr-name__tile')) : []
    const cvs = wrapper?.querySelector('.pr-name__canvas')

    if (!wrapper || !track) return

    const original = el.querySelector('.pr-name__original')
    const clone = el.querySelector('.pr-name__clone')
    const charSpans = Array.from(clone?.querySelectorAll('.pr-char') || [])
    const baseSpans = Array.from(original?.querySelectorAll('.pr-char') || [])

    if (freshBuild) {
      resetTextState()
    } else {
      // Reused DOM: never snap the base characters back to rest — an
      // interrupted leave may be mid-reverse, and the wave's .to() tweens
      // continue from wherever the glyphs currently are.
      gsap.set(baseSpans, { opacity: 1 })
    }

    // Timing constants first: the pixel pass is created synchronously so the
    // tiles own the clone from the very first frame of the wave.
    const pairDuration = 0.48
    const pairStep = 0.05
    const sequenceStart = 0.08
    const travel = heightRef.current
    const sequenceEnd = sequenceStart + Math.max(0, baseSpans.length - 1) * pairStep + pairDuration
    const proxies = baseSpans.map(() => ({ y: -travel }))
    proxiesRef.current = proxies
    // Initialize the pointer relative to the wrapper so the first WebGL tick
    // does not treat (0,0) as the cursor. If no valid source is available the
    // sentinel stays in place and nothing is displaced until the first real
    // position arrives.
    const wr = wrapper.getBoundingClientRect()
    if (gateIsTouch) {
      // The parked cursor is the source of truth here. An event's coordinates are
      // wherever the finger happened to be when it fired, and a parked cursor
      // produces no event at all — so the event-only branch received nothing.
      const p = parked.current
      mouseRef.current.x = p.x - wr.left
      mouseRef.current.y = p.y - wr.top
    } else if (e) {
      mouseRef.current.x = e.clientX - wr.left
      mouseRef.current.y = e.clientY - wr.top
    }
    startWebGL(sequenceEnd * 1000, proxies, baseSpans)
    const passActive = !!pixelPassRef.current

    const tl = gsap.timeline({
      // Trailing tweens (60-tile stagger) outlive the visual swap, so the
      // completion work runs from a positioned call below, not from here.
      onComplete: () => { tlRef.current = null }
    })

    ctxRef.current?.add(tl)

    // One character at a time: the base glyph travels down and out of the
    // window while its matching clone falls from above into the exact same
    // slot. There is no rotation and no horizontal motion: only Y + stagger.
    gsap.set(track, { y: 0 })
    wrapper.classList.add('is-pixelating')

    baseSpans.forEach((baseChar, index) => {
      const at = sequenceStart + index * pairStep

      // power3.inOut: gentle launch for the base glyph, gentle landing for the
      // clone — one shared ease keeps the pair locked together. With the pixel
      // pass running, the clone is drawn by the tiles (proxy Y), never by the
      // DOM, so the WebGL effect rides the incoming text the whole time.
      tl.to(baseChar, {
        y: travel,
        duration: pairDuration,
        ease: 'power3.inOut'
      }, at)
      if (passActive) {
        tl.fromTo(proxies[index],
          { y: -travel },
          { y: 0, duration: pairDuration, ease: 'power3.inOut' },
          at
        )
      } else {
        // Fallback if the 2D surface is unavailable: plain DOM clone.
        const cloneChar = charSpans[index]
        if (cloneChar) {
          tl.fromTo(cloneChar,
            { y: -travel, opacity: 0 },
            { y: 0, opacity: 1, duration: pairDuration, ease: 'power3.inOut' },
            at
          )
        }
      }
    })

    // The title track and wrapper are the hard clipping window. No character,
    // pixel block or canvas fragment can appear above or below this line.
    tl.to(track, { y: 0, duration: 0.2, ease: 'power2.out' }, sequenceStart)

    // 4) tile grid: appears on hover, blotch-fades with random stagger
    tl.to(grid, { opacity: 1, duration: 0.25, ease: 'power2.out' }, 0)

    tl.call(() => startDisplacement(), [], 0)

    // ponytail: tiles fade at 0.5s (allow mouse displacement first), not 0.4
    // `each` is divided by the tile count, not left at a fixed 0.035: the stagger is
    // per tile, so a denser grid would stretch the same fade from 2.1s to seven seconds
    // and the blotch would never finish inside the hover.
    const tileStagger = tiles.length > 1
      ? Math.min(0.035, TILE_FADE_SPAN / (tiles.length - 1))
      : 0
    tl.to(tiles, {
      opacity: 0.22,
      duration: 0.5,
      ease: 'power2.out',
      stagger: { each: tileStagger, from: 'center' }
    }, 0.58)
    tl.set(grid, { opacity: 0.22 }, sequenceEnd + 0.02)



    if (wrapper) {
      gsap.set(wrapper, { filter: 'grayscale(0.3)' })
      tl.to(wrapper, { filter: 'grayscale(0)', duration: 1.2, ease: 'power2.inOut' }, 0.2)
    }

    // The visual swap is complete: the tile canvas owns the title while the
    // pointer stays in the row. Runs right after the last pair settles — not
    // at timeline end, which the tile stagger outlives.
    tl.call(() => {
      gsap.set(cvs || [], { opacity: 1 })
      gsap.set(grid || [], { opacity: 0.22 })
      gsap.set(wrapper, { filter: 'grayscale(0)' })
      gsap.set(baseSpans, { opacity: 0, y: heightRef.current })
      // The DOM clone only becomes visible if the pixel pass failed to start.
      gsap.set(charSpans, { opacity: pixelPassRef.current ? 0 : 1, y: 0 })
      wrapper.classList.add('is-pixelating')
      animDoneRef.current = true
    }, [], sequenceEnd + 0.02)

    tlRef.current = tl
  }

  const handleLeave = () => {
    insideRowRef.current = false
    if (tlRef.current) {
      tlRef.current.kill()
      tlRef.current = null
    }
    stopDisplacement()
    const el = nameRef.current
    const pass = pixelPassRef.current
    if (!pass) {
      restoreText()
      const wrapper = el?.querySelector('.pr-name__wrapper')
      if (wrapper) {
        wrapper.style.filter = ''
        wrapper.classList.remove('is-pixelating')
      }
      animDoneRef.current = true
      return
    }
    // Reverse exchange: the pixel clone climbs back up through the clip
    // window while the base characters return into the line — quick and
    // staggered, same motion language as the wave, with no fade-pop. The
    // pass keeps rendering until the reverse completes.
    pass.release()
    animDoneRef.current = false
    const travel = heightRef.current
    const proxies = proxiesRef.current
    const baseSpans = Array.from(el?.querySelectorAll('.pr-name__original .pr-char') || [])
    const grid = el?.querySelector('.pr-name__grid')
    const wrapper = el?.querySelector('.pr-name__wrapper')
    if (wrapper) {
      gsap.to(wrapper, { filter: 'grayscale(0)', duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
    }
    const revEnd = 0.45 + Math.max(0, baseSpans.length - 1) * 0.02
    const revTl = gsap.timeline({
      onComplete: () => { if (pixelPassRef.current === pass) pass.finishNow() }
    })
    if (proxies) {
      proxies.forEach((p, i) => {
        revTl.to(p, { y: -travel, duration: 0.45, ease: 'power3.inOut' }, i * 0.02)
      })
    }
    baseSpans.forEach((b, i) => {
      revTl.to(b, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.inOut' }, i * 0.02)
    })
    if (grid) {
      revTl.to(grid, { opacity: 0, duration: 0.3, ease: 'power2.in' }, Math.max(0, revEnd - 0.3))
    }
    const cvs = el?.querySelector('.pr-name__canvas')
    if (cvs) {
      revTl.to(cvs, { opacity: 0, duration: 0.18, ease: 'power2.in' }, Math.max(0, revEnd - 0.15))
    }
    tlRef.current = revTl
  }

  const attachPointerHandlers = (target) => {
    if (pointerHandlersRef.current) {
      target.removeEventListener('pointermove', pointerHandlersRef.current.move)
      target.removeEventListener('pointerenter', pointerHandlersRef.current.enter)
      target.removeEventListener('pointerleave', pointerHandlersRef.current.leave)
    }

    const setPos = (e) => {
      const r = target.getBoundingClientRect()
      if (gateIsTouch) {
        // Same reason as the wave seed: on touch the parked cursor is the position,
        // and the event only says where the finger was when it happened to fire.
        const p = parked.current
        mouseRef.current.x = p.x - r.left
        mouseRef.current.y = p.y - r.top
        return
      }
      mouseRef.current.x = e.clientX - r.left
      mouseRef.current.y = e.clientY - r.top
    }
    const move = setPos
    const enter = (e) => {
      setPos(e)
      // A fresh row entry starts the wave through the row's own handler; only
      // re-entries while the row stays hovered resume/re-engage the layer.
      if (!insideRowRef.current) return
      const pass = pixelPassRef.current
      if (pass) { pass.resume(); return }
      // Re-entering the text after a completed pass re-engages the tile layer
      // instantly (no wave replay) while the row is still hovered.
      if (everRanRef.current && animDoneRef.current) startWebGL(0)
    }
    const leave = () => {
      mouseRef.current.x = -1000
      mouseRef.current.y = -1000
      // Exiting the canvas always sends the tiles (and the text they compose)
      // back to the initial position.
      pixelPassRef.current?.release()
    }
    target.addEventListener('pointermove', move, { passive: true })
    target.addEventListener('pointerenter', enter, { passive: true })
    target.addEventListener('pointerleave', leave, { passive: true })
    pointerHandlersRef.current = { move, enter, leave }
  }

  const detachPointerHandlers = (target) => {
    if (!pointerHandlersRef.current) return
    target.removeEventListener('pointermove', pointerHandlersRef.current.move)
    target.removeEventListener('pointerenter', pointerHandlersRef.current.enter)
    target.removeEventListener('pointerleave', pointerHandlersRef.current.leave)
    pointerHandlersRef.current = null
  }

  const startDisplacement = () => {
    const el = nameRef.current
    if (!el) return
    const wrapper = el.querySelector('.pr-name__wrapper')
    const tiles = wrapper ? Array.from(wrapper.querySelectorAll('.pr-name__tile')) : []
    if (!tiles.length) return

    attachPointerHandlers(wrapper)

    const qtX = tiles.map((t) => gsap.quickTo(t, 'x', { duration: 0.3, ease: 'power2.out' }))
    const qtY = tiles.map((t) => gsap.quickTo(t, 'y', { duration: 0.3, ease: 'power2.out' }))

    // Read each tile's home centre ONCE, with offsetLeft/offsetTop rather than
    // getBoundingClientRect. Two reasons, both about the 420 tiles this loop drives:
    // rect is a layout read per tile per frame, and it also folds in the very transforms
    // this loop applies — so the force was being computed from each tile's ALREADY
    // displaced position, feeding the displacement back into itself. offsetLeft/offsetTop
    // are layout-only, and their offsetParent is the wrapper, which is the same space
    // mouseRef is already measured in.
    const centres = tiles.map((t) => ({
      x: t.offsetLeft + t.offsetWidth / 2,
      y: t.offsetTop + t.offsetHeight / 2,
    }))

    const loop = () => {
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      centres.forEach((c, i) => {
        const dx = c.x - mx
        const dy = c.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 120
        if (dist < maxDist && dist > 0) {
          const force = (1 - dist / maxDist) * 6
          qtX[i]((dx / dist) * force)
          qtY[i]((dy / dist) * force)
        } else {
          qtX[i](0)
          qtY[i](0)
        }
      })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const stopDisplacement = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const el = nameRef.current
    if (el) {
      const wrapper = el.querySelector('.pr-name__wrapper')
      detachPointerHandlers(wrapper)
      const tiles = Array.from(el.querySelectorAll('.pr-name__tile'))
      tiles.forEach((t) => {
        gsap.to(t, { x: 0, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' })
      })
    }
  }

  useEffect(() => {
    ctxRef.current = gsap.context(() => {})
    return () => {
      if (tlRef.current) {
        tlRef.current.kill()
        tlRef.current = null
      }
      stopDisplacement()
      if (pixelPassRef.current) pixelPassRef.current.finishNow()
      stopWebGL()
      restoreText()
      if (ctxRef.current) {
        ctxRef.current.revert()
        ctxRef.current = null
      }
    }
  }, [])

  return (
    <article
      ref={rowRef}
      className="project-row"
      onClick={() => onProjectClick(project)}
      aria-expanded={isExpanded ? 'true' : 'false'}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <canvas ref={bloomRef} className="pr-matrix-rain" aria-hidden="true" />
      <span className="pr-year">{project.year}</span>
      <div className="pr-body">
        <h3 className="pr-name" ref={nameRef}>{project.name}</h3>
        <p className="pr-meta">
          {project.meta.map((item, i) => (
            <React.Fragment key={i}>
              <span>{item}</span>
              {i < project.meta.length - 1 && (
                <span className="dot" aria-hidden="true">/</span>
              )}
            </React.Fragment>
          ))}
        </p>
      </div>
      {project.link ? (
        <a
          className="pr-link"
          href={project.link.href}
          rel="noopener"
          target="_blank"
          aria-label={project.link.label}
          onClick={(e) => e.stopPropagation()}
        >
          Visit <ExternalSvg />
        </a>
      ) : (
        <span className="pr-link" aria-label={project.linkLabel}>
          {project.linkText}
        </span>
      )}
    </article>
  )
}

const ProjectExpanded = ({ project, isOpen, switchFromRef, panelElsRef }) => {
  const { isTouch, closeCanvas, canvasState, cursorRef } = useArchiveCursor()
  // Same reason as the gallery's loop below: the AWAKE flag, not the drag flag.
  // isCursorActive is cleared on pointerup, so a parked cursor would drop the hover
  // the moment the finger lifted — the opposite of what a parked cursor is for.
  const { isAwake } = useCursorGate()
  const expandedRef = useRef(null)
  const innerRef = useRef(null)
  const gridRef = useRef(null)
  const prevProject = useRef(null)
  const isAnimating = useRef(false)
  // Stato dell'aggancio vista (punto 2): anchor documento + scroll visti all'ultimo frame.
  const viewHookRef = useRef({ raf: 0, timer: 0, anchorDoc: 0, scrollY: 0 })
  const glItemsRef = useRef([])
  const glRafRef = useRef(0)
  const glDisposedRef = useRef(false)
  const mountedRef = useRef(false)
  // Registra il nodo per il gate di switch: chi si apre aspetta il collasso
  // di chi si chiude (ResizeObserver su height < 1).
  useEffect(() => {
    if (!panelElsRef) return
    if (project?.name) panelElsRef.current[project.name] = expandedRef.current
  }, [project, panelElsRef])
  // Close canvas when the expanded panel is closed on a touch device.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (!isOpen && isTouch) {
      closeCanvas()
    }
  }, [isOpen, isTouch, closeCanvas])

  // ponytail: masked line-rise for the description. DOM-move split on top-level
  // <br> only — nodes are MOVED into mask divs, never serialized, so spans,
  // spacing and <br><br> paragraph gaps survive byte-identical. html is
  // re-applied first to wipe any previous split (React skips same-string
  // writes afterwards, so this never fights the renderer).
  const revealTextLines = (inner, html) => {
    const textEl = inner.querySelector('.project-expanded__text')
    if (!textEl || !html) return
    textEl.innerHTML = html
    textEl.dataset.origHtml = html
    const wrap = (nodes) => {
      if (!nodes.some(n => n.nodeName !== '#text' || n.textContent.trim() !== '')) return nodes
      const line = document.createElement('div')
      line.className = 'project-expanded__text-line'
      const inn = document.createElement('div')
      inn.className = 'project-expanded__text-line-inner'
      nodes.forEach(n => inn.appendChild(n))
      line.appendChild(inn)
      return [line]
    }
    const out = []
    let cur = []
    ;[...textEl.childNodes].forEach(n => {
      if (n.nodeName === 'BR') { out.push(...wrap(cur)); cur = []; out.push(n) }
      else cur.push(n)
    })
    out.push(...wrap(cur))
    textEl.append(...out)
    const inners = Array.from(textEl.querySelectorAll('.project-expanded__text-line-inner'))
    if (!inners.length) return
    // ponytail: the text waits for the expansion (0.5s) before creating itself
    // from zero — delay here, not on the dead title tween below.
    gsap.fromTo(inners, { yPercent: 110 }, { yPercent: 0, duration: 1.0, ease: 'power3.out', stagger: 0.08, delay: 0.6, clearProps: 'transform' })
  }
  const initWebGL = () => {
    if (glDisposedRef.current) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const grid = gridRef.current
      if (grid) {
        Array.from(grid.querySelectorAll('.gl-frame')).forEach(f => f.classList.add('gl-frame--fallback'))
      }
      return
    }

    const grid = gridRef.current
    if (!grid) return

    const frames = Array.from(grid.querySelectorAll('.gl-frame'))
    if (!frames.length) return

    const loader = new THREE.TextureLoader()
    let loadedCount = 0
    let failedCount = 0

    const tryStartLoop = () => {
      loadedCount++
      if (loadedCount + failedCount >= frames.length && !glRafRef.current) {
        startRenderLoop()
      }
    }

    frames.forEach((elFrame) => {
      if (glDisposedRef.current) return
      const mediaEl = elFrame.querySelector('img, video')
      const canvas = elFrame.querySelector('canvas')
      if (!mediaEl || !canvas) { tryStartLoop(); return }
      // Creation effect: the still starts hidden and fades in underneath the
      // tile-reveal canvas, driven by the uReveal tween below. failStatic
      // restores it at full strength on any WebGL/texture failure path.
      mediaEl.style.opacity = '0'
      const failStatic = () => { canvas.style.display = 'none'; mediaEl.style.opacity = '1'; tryStartLoop() }

      const isVideo = mediaEl.tagName === 'VIDEO'

      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        renderer.setClearColor(0x000000, 0)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.setSize(Math.max(1, canvas.offsetWidth || 1), Math.max(1, canvas.offsetHeight || 1))
      } catch (e) {
        failStatic()
        return
      }

      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
      camera.position.z = 1
      const scene = new THREE.Scene()

      const onTextureReady = (tex) => {
        if (glDisposedRef.current) { renderer.dispose(); return }
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        const mediaW = isVideo ? (mediaEl.videoWidth || 1920) : (tex.image?.width || 1920)
        const mediaH = isVideo ? (mediaEl.videoHeight || 1080) : (tex.image?.height || 1080)
        const imgAspect = mediaW / mediaH
        const frameRect = elFrame.getBoundingClientRect()

        // Aspect-corrected tile grid: ~60px cells, adjusted for plane aspect
        const cellSize = 60
        const cols = Math.max(4, Math.round(frameRect.width / cellSize))
        const rows = Math.max(4, Math.round(frameRect.height / cellSize))

        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uTex: { value: tex },
            uTime: { value: 0 },
            uHover: { value: 0 },
            uReveal: { value: 0 },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
            uGrid: { value: new THREE.Vector2(cols, rows) },
            uSeed: { value: Math.random() * 100.0 },
            uPlaneAspect: { value: frameRect.width > 0 && frameRect.height > 0 ? frameRect.width / frameRect.height : 1 },
            uImgAspect: { value: imgAspect }
          },
          vertexShader, fragmentShader, transparent: true
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
        scene.add(mesh)

        const item = { frame: elFrame, canvas, renderer, camera, scene, mesh, mat, targetHover: 0, mx: 0.5, my: 0.5, tex, isVideo, mediaEl }
        glItemsRef.current.push(item)
        elFrame.classList.add('is-ready')
        if (frameRect.width > 0 && frameRect.height > 0) {
          renderer.setSize(frameRect.width, frameRect.height)
        }

        const idx = glItemsRef.current.length - 1
        const proxy = { value: 0 }
        item.revealTween = gsap.to(proxy, {
          value: 1,
          duration: 1.6,
          delay: idx * 0.15,
          ease: 'power1.inOut',
          // ponytail: canvas appears only once the reveal has actually started —
          // the uReveal=0 zero-state is never painted, so no fixed faint ghost.
          onUpdate: () => { mat.uniforms.uReveal.value = proxy.value; mediaEl.style.opacity = proxy.value; if (proxy.value > 0) canvas.style.display = 'block' }
        })

        elFrame.addEventListener('pointermove', (e) => {
          const r = elFrame.getBoundingClientRect()
          item.targetHover = 1
          item.mx = (e.clientX - r.left) / r.width
          item.my = 1 - (e.clientY - r.top) / r.height
        })
        elFrame.addEventListener('pointerleave', () => { item.targetHover = 0 })
        tryStartLoop()
      }

      if (isVideo) {
        const onCanPlay = () => {
          mediaEl.removeEventListener('canplay', onCanPlay)
          mediaEl.play().catch(() => {})
          const tex = new THREE.VideoTexture(mediaEl)
          onTextureReady(tex)
        }
        if (mediaEl.readyState >= 2) {
          onCanPlay()
        } else {
          mediaEl.addEventListener('canplay', onCanPlay, { once: true })
          mediaEl.addEventListener('error', () => { failStatic() }, { once: true })
          mediaEl.load()
        }
      } else {
        const src = (mediaEl.currentSrc && mediaEl.currentSrc !== '') ? mediaEl.currentSrc : mediaEl.src
        if (!src) { failStatic(); return }

        if (mediaEl.complete && mediaEl.naturalWidth > 0) {
          loader.load(src, onTextureReady, undefined, () => { failStatic() })
        } else {
          mediaEl.addEventListener('load', () => {
            const s = (mediaEl.currentSrc && mediaEl.currentSrc !== '') ? mediaEl.currentSrc : mediaEl.src
            loader.load(s, onTextureReady, undefined, () => { failStatic() })
          }, { once: true })
          mediaEl.addEventListener('error', () => { failStatic() }, { once: true })
          setTimeout(() => { if (!mediaEl.complete) { failStatic() } }, 5000)
        }
      }
    })
  }

  const startRenderLoop = () => {
    const startTime = performance.now()
    const tick = () => {
      if (glDisposedRef.current) return
      const t = (performance.now() - startTime) / 1000
      for (const it of glItemsRef.current) {
        const u = it.mat.uniforms
        u.uTime.value = t
        if (isTouch) {
          const r = it.frame.getBoundingClientRect()
          const active = isAwake.current
            && cursorRef.current.x >= r.left
            && cursorRef.current.x <= r.right
            && cursorRef.current.y >= r.top
            && cursorRef.current.y <= r.bottom
          if (active) {
            it.targetHover = 1
            it.mx = (cursorRef.current.x - r.left) / Math.max(1, r.width)
            it.my = 1 - (cursorRef.current.y - r.top) / Math.max(1, r.height)
          } else {
            it.targetHover = 0
          }
        }
        u.uHover.value += (it.targetHover - u.uHover.value) * 0.065
        u.uMouse.value.x += (it.mx - u.uMouse.value.x) * 0.1
        u.uMouse.value.y += (it.my - u.uMouse.value.y) * 0.1
        const r = it.frame.getBoundingClientRect()
        u.uPlaneAspect.value = r.width > 0 && r.height > 0 ? r.width / r.height : 1
        if (it.isVideo) it.tex.needsUpdate = true
        it.renderer.render(it.scene, it.camera)
      }
      glRafRef.current = requestAnimationFrame(tick)
    }
    glRafRef.current = requestAnimationFrame(tick)
  }

  const disposeWebGL = () => {
    glDisposedRef.current = true
    if (glRafRef.current) { cancelAnimationFrame(glRafRef.current); glRafRef.current = 0 }
    for (const it of glItemsRef.current) {
      try {
        if (it.isVideo && it.mediaEl) { it.mediaEl.pause() }
        it.renderer.dispose()
        it.scene.traverse(o => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach(m => m.dispose())
          }
        })
        it.canvas.style.display = ''
        it.frame.classList.remove('is-ready')
        it.mediaEl.style.opacity = ''
        it.revealTween?.kill()
      } catch (e) { }
    }
    glItemsRef.current = []
  }

  useEffect(() => {
    if (!expandedRef.current || !innerRef.current) return
    const el = expandedRef.current
    const inner = innerRef.current
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const enableWebGL = shouldEnableSectionWebGL({
      isTouch,
      reduceMotion: prefersReducedMotion,
    })

    // Aggancio vista NON negoziabile: al click la vista si aggancia subito
    // alla riga e resta lì contro ogni cambio di altezza pagina. Logica:
    // 1) scroll immediato sulla riga; 2) watcher che compensa SOLO i drift
    // da layout (resize/font/immagini), mai lo scroll utente o dei tween
    // (Lenis isScrolling / scrollY mosso = rebase, non correzione).
    const headerBottom = () => {
      const h = document.querySelector('.site-header')
      return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0
    }
    const releaseViewHook = () => {
      const st = viewHookRef.current
      cancelAnimationFrame(st.raf)
      clearTimeout(st.timer)
      st.raf = 0
      window.removeEventListener('wheel', onUserDrive)
      window.removeEventListener('touchmove', onUserDrive)
    }
    const onUserDrive = () => releaseViewHook()
    const hookView = (anchorEl, holdMs = 1800) => {
      if (!anchorEl || !anchorEl.isConnected) return
      releaseViewHook()
      const st = viewHookRef.current
      // Ancora: tutto l'article in scena a 18px dal bordo inferiore dell'header.
      const targetY = headerBottom() + 18
      st.anchorDoc = anchorEl.getBoundingClientRect().top + window.scrollY
      st.scrollY = window.scrollY
      const dest = Math.max(0, st.anchorDoc - targetY)
      const l = window.__lenis
      if (l && typeof l.scrollTo === 'function') l.scrollTo(dest, { duration: 0.55, easing: scrollSettleEase })
      else window.scrollTo({ top: dest, behavior: 'smooth' })
      window.addEventListener('wheel', onUserDrive, { passive: true })
      window.addEventListener('touchmove', onUserDrive, { passive: true })
      const step = () => {
        st.raf = requestAnimationFrame(step)
        if (!anchorEl.isConnected) { releaseViewHook(); return }
        const sy = window.scrollY
        const rowDoc = anchorEl.getBoundingClientRect().top + sy
        const lenisActive = !!(l && l.isScrolling)
        if (lenisActive || sy !== st.scrollY) {
          st.anchorDoc = rowDoc
          st.scrollY = sy
          return
        }
        const drift = rowDoc - st.anchorDoc
        // Mai salti istantanei: rincorsa morbida ri-mirata ogni frame dalla
        // posizione corrente = follow fluido. Il nativo (senza Lenis) scatta
        // solo oltre 8px e solo a layout fermo (niente tween in corso).
        if (Math.abs(drift) > 2 && l && typeof l.scrollTo === 'function') {
        const fixed = Math.max(0, sy + drift)
        l.scrollTo(fixed, { duration: 0.3, easing: scrollSettleEase })
            st.anchorDoc = rowDoc
            st.scrollY = fixed
          } else if (!l && Math.abs(drift) > 8) {
            const fixed = Math.max(0, sy + drift)
            window.scrollTo(0, fixed)
            st.anchorDoc = rowDoc
            st.scrollY = fixed
          }
      }
      st.raf = requestAnimationFrame(step)
      st.timer = setTimeout(releaseViewHook, holdMs)
    }

    if (isOpen) {
      const startOpen = () => {
      prevProject.current = project
      hookView(el.previousElementSibling ?? el)
      glDisposedRef.current = false
      // Creation from zero: hide stills before the entrance starts so the
      // tile-reveal + synced fade-in below are the first thing ever seen.
      // Skipped when no WebGL reveal will run (stills must stay visible).
      if (!prefersReducedMotion && enableWebGL && gridRef.current) {
        gridRef.current.querySelectorAll('.project-expanded__img').forEach((m) => { m.style.opacity = '0' })
      }
      // ponytail: the whole inner stays invisible during the entrance — the
      // text reveal + tile creation below generate everything from zero.
      // visibility:hidden keeps layout so fullHeight still measures true.
      inner.style.visibility = 'hidden'

      if (prefersReducedMotion) {
        el.style.height = 'auto'
        el.style.opacity = '1'
        inner.style.visibility = ''
        const textEl = inner.querySelector('.project-expanded__text')
        if (textEl) textEl.innerHTML = project?.description ?? ''
        if (enableWebGL) initWebGL()
        return
      }

      // ponytail: split + start the text reveal now (while hidden) so the
      // measured height already includes the text — no post-expand jump — and
      // React never manages this node's children (no dangerouslySetInnerHTML),
      // so the split DOM survives the close render and can reverse cleanly.
      revealTextLines(inner, project?.description)

      // Altezza piena fissata subito: niente salto async a fine entrance.
      el.style.height = inner.offsetHeight + 'px'

      // Unica ancora di scroll: l'article (riga), a entrance finita, 18px sotto
      // l'header. Misurato post-layout, la vista segue l'item che si apre.
      const scrollToPanel = () => {
        const headerEl = document.querySelector('.site-header')
        const h = headerEl ? Math.max(0, headerEl.getBoundingClientRect().bottom) : 0
        const row = el.previousElementSibling ?? el
        const delta = row.getBoundingClientRect().top - h - 18
        if (Math.abs(delta) <= 2) return
        const l = window.__lenis
        if (l && typeof l.scrollTo === 'function') l.scrollTo(window.scrollY + delta, { duration: 0.9, easing: scrollSettleEase })
        else window.scrollTo({ top: Math.max(0, window.scrollY + delta), behavior: 'smooth' })
      }

      isAnimating.current = true
      gsap.fromTo(el,
        { yPercent: 110, opacity: 0},
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
          onComplete: () => {
            // Re-misura (font/WebGL risolti) ma resta px fisso: mai 'auto' a caldo.
            el.style.height = inner.offsetHeight + 'px'
            isAnimating.current = false
            inner.style.visibility = ''
            if (enableWebGL) initWebGL()
            scrollToPanel()
          }
        }
      )

      const title = inner.querySelector('.project-expanded__title')
      if (title) {
        const chars = title.textContent.split('')
        title.innerHTML = chars.map(c => c === ' ' ? '\u00a0' : `<span>${c}</span>`).join('')
        gsap.fromTo(Array.from(title.querySelectorAll('span')),
          { opacity: 0, x: -20, y: 110, delay: 0.5 },
          { opacity: 1, x: 0, y: 0, duration: 0.4, ease: 'power2.in', stagger: 0.08 }
        )
      }

      } // fine startOpen

      // Switch: aspetta il collasso del pannello in chiusura, poi apri.
      // Niente overlap open-vs-close; il reverse del vecchio finisce prima.
      const pending = switchFromRef?.current
      if (pending && pending !== project) {
        const closingEl = panelElsRef?.current?.[pending.name]
        if (closingEl && closingEl.isConnected && closingEl.offsetHeight > 1) {
          // Fase 1: segui il div chiudente mentre collassa; fase 2 (al collasso)
          // hook sul div entrante + startOpen. Il focus e sempre su chi si apre.
          hookView(closingEl.previousElementSibling ?? closingEl)
          const ro = new ResizeObserver(() => {
            if (!closingEl.isConnected || closingEl.offsetHeight < 1) {
              ro.disconnect()
              if (switchFromRef.current === pending) switchFromRef.current = null
              startOpen()
            }
          })
          ro.observe(closingEl)
          return () => ro.disconnect()
        }
      }
      if (switchFromRef) switchFromRef.current = null
      startOpen()
    } else {
      const textEl = inner.querySelector('.project-expanded__text')
      const inners = textEl ? Array.from(textEl.querySelectorAll('.project-expanded__text-line-inner')) : []

      if (prefersReducedMotion || !el.style.height || (el.style.height === 'auto' && el.offsetHeight === 0)) {
        disposeWebGL()
        inner.style.visibility = ''
        // ponytail: restore base text — wipes split wrappers + tween styles so
        // the closed panel always keeps its authored formatting and spacing.
        if (textEl?.dataset.origHtml) {
          if (inners.length) gsap.killTweensOf(inners)
          textEl.innerHTML = textEl.dataset.origHtml
          delete textEl.dataset.origHtml
        }
        el.style.height = '0'
        el.style.opacity = '0'
        return
      }

      // ponytail: immediate reverse-out — text sinks + tiles un-reveal TOGETHER,
      // then the container collapses. Mirrors the entrance instead of fading away.
      // The split DOM survives the close render (no dangerouslySetInnerHTML), so
      // `inners` is populated and the line rise plays backward.
      isAnimating.current = true
      hookView(el.previousElementSibling ?? el, 1400)
      gsap.killTweensOf(el)
      if (inners.length) gsap.killTweensOf(inners)
      if (!inners.length) {
        // ponytail: no split lines (empty text) — skip straight to collapse.
        disposeWebGL()
        el.style.height = '0'
        el.style.opacity = '0'
        isAnimating.current = false
        return
      }

      gsap.set(inner, { scale: 1 })
      const closeDelay = 0.7 + 0.07 * Math.max(0, inners.length - 1) + 0.05
      gsap.to(inners, {
        yPercent: 110,
        duration: 0.7,
        ease: 'power3.in',
        stagger: { each: 0.07, from: 'end' },
        overwrite: 'auto',
      })
      glItemsRef.current.forEach((it, idx) => {
        if (it.revealTween) it.revealTween.kill()
        const rp = { v: it.mat.uniforms.uReveal.value }
        gsap.to(rp, {
          v: 0,
          duration: 0.7,
          delay: idx * 0.07,
          ease: 'power3.inOut',
          overwrite: 'auto',
          onUpdate: () => { it.mat.uniforms.uReveal.value = rp.v; it.mediaEl.style.opacity = rp.v },
        })
      })

      const currentHeight = el.offsetHeight
      el.style.height = currentHeight + 'px'
      el.offsetHeight
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.35,
        ease: 'power3.in',
        delay: closeDelay,
        onComplete: () => {
          isAnimating.current = false
          disposeWebGL()
          inner.style.visibility = ''
          if (textEl?.dataset.origHtml) {
            textEl.innerHTML = textEl.dataset.origHtml
            delete textEl.dataset.origHtml
          }
        },
      })
    }
  }, [project, isOpen, isTouch])

  useEffect(() => () => {
    disposeWebGL()
    const st = viewHookRef.current
    cancelAnimationFrame(st.raf)
    clearTimeout(st.timer)
  }, [])

  const displayProject = isOpen ? project : prevProject.current
  // item.src already starts with "/", so the naive concat produced a double
  // slash. Absolute path matches the pattern Archives.jsx already uses.
  const assetUrl = (p) => `/assets/images/SoundReact/${p.replace(/^\//, '')}`

  return (
    <div className="project-expanded" ref={expandedRef} role="region" aria-label={`Dettaglio: ${displayProject?.name}`} style={{ height: 0, opacity: 0, overflow: 'hidden' }}>
      <div className="project-expanded__inner" ref={innerRef}>
        <div className="project-expanded__content">
          {/* Text content is populated imperatively by revealTextLines() so React
              never re-renders/clears it — required for the close reverse animation
              to find the split lines. Authored locally in projectsData.js, trusted. */}
          <div className="project-expanded__text" />
        </div>
        <div className="project-expanded__grid" ref={gridRef}>
          {displayProject?.images.map((item) => (
            <span className="gl-frame" key={item.src}>
              <canvas className="gl-frame__canvas" aria-hidden="true"></canvas>
              {item.type === 'video' ? (
                <video
                  src={assetUrl(item.src)}
                  className="project-expanded__img"
                  muted loop playsInline preload="auto"
                />
              ) : (
                <img
                  src={assetUrl(item.src)}
                  alt={item.alt}
                  className="project-expanded__img"
                  loading="lazy"
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SelectedProjects() {
  const sectionRef = useRef(null)
  const calloutShaderRef = useRef(null)
  const [expandedProject, setExpandedProject] = useState(null)
  // Gate di switch: chi si chiude + registro nodi per l'attesa del collasso.
  const switchFromRef = useRef(null)
  const panelElsRef = useRef({})
  const { isMobile } = useArchiveCursor()
  // One source for both the shader's `lines` and the DOM: FocusCalloutShader
  // pairs DOM line i to raster i, so the two must never be able to drift.
  // Mobile: testo corto dedicato; tablet e desk condividono quello desktop.
  const calloutLines = isMobile ? CALLOUT_LINES_MOBILE : CALLOUT_LINES_DESKTOP

  const handleProjectClick = (project) => {
    if (expandedProject === project) {
      switchFromRef.current = null
      setExpandedProject(null)
    } else {
      if (expandedProject) switchFromRef.current = expandedProject
      setExpandedProject(project)
    }
  }

  // Misura reale del testo callout: padding-block derivato dall'overflow
  // effettivo (glifi oltre la line-box 0.66em), mai da tabelle hardcoded.
  // Re-fit su font load, resize e cambio righe (mobile/desktop); la mask
  // si ricostruisce da sola via ResizeObserver del container.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const callout = section.querySelector('.focus-callout')
    if (!callout) return
    let disposed = false
    const fit = () => {
      if (disposed) return
      const overflow = callout.scrollHeight - callout.clientHeight
      if (overflow > 2) {
        const cs = getComputedStyle(callout)
        const cur = parseFloat(cs.paddingBlockStart) || 0
        const add = Math.min(overflow / 2, callout.clientWidth * 0.1)
        callout.style.paddingBlock = `${cur + add}px`
      }
    }
    fit()
    const raf = requestAnimationFrame(fit)
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => { if (!disposed) fit() }).catch(() => {})
    }
    const onResize = () => fit()
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [calloutLines])

  useEffect(() => {
    // Element, not the ref object: see the note in Archives.jsx. GSAP reads
    // scope.current at call time and a ref is nulled on unmount.
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      const rows = sectionRef.current?.querySelectorAll('.project-row')
      const callout = sectionRef.current?.querySelector('.focus-callout--shader')
      const heading = sectionRef.current?.querySelector('.section-head')

      if (heading) {
        gsap.fromTo(heading,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
            scrollTrigger: { trigger: heading, start: 'top 85%', once: true } }
        )
        gsap.to(heading, {
          y: -20,
          ease: 'none',
          scrollTrigger: { trigger: heading, start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true }
        })
      }

      rows?.forEach((row, i) => {
        gsap.fromTo(row,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.7, delay: i * 0.08, ease: 'power2.out',
            scrollTrigger: { trigger: row, start: 'top 88%', once: true } }
        )
        gsap.to(row, {
          y: -15,
          ease: 'none',
          scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true }
        })
      })

      if (callout) {
        // The entrance. `gsap.from` (not fromTo) is deliberate: the tween ends on
        // the element's own layout position, so the last frame is exact by
        // construction rather than by a hand-written matching end value. The mask
        // reads these same live offsets, so the shader slides in lockstep and is
        // clipped to each line's own box on the way.
        //
        // Under reduced motion no GL runs and .focus-callout--reduced restores the
        // ink, so no timeline is built at all: the lines sit in their natural
        // position and nothing waits on a tween that never plays.
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const spans = Array.from(callout.querySelectorAll('.focus-callout__text'))
        if (!reduceMotion && spans.length) {
          const tl = gsap.timeline({
            defaults: { ease: 'power4.inOut' },
            // Scroll says WHEN and nothing else. It started out scrubbed, which tied
            // the lines to the scroll position: scrolling on dragged the entrance to
            // its end, and the visitor had to keep scrolling to finish it. `once`
            // makes this a one-shot trigger instead, so the entrance plays itself on
            // the clock from the moment it is reached and nothing after — or before —
            // it touches the lines.
            scrollTrigger: { trigger: callout, start: CALLOUT_REVEAL_START, once: true },
            // The shader's mask is rebuilt from this tween's own ticks, so the mask
            // and the DOM can never disagree about where a line is. It used to be
            // rebuilt by a requestAnimationFrame loop inside FocusCalloutShader that
            // polled the DOM forever and mistook every scroll for movement; driving
            // it from here means the work happens only while the entrance plays.
            onUpdate: () => calloutShaderRef.current?.rebuild(),
            // Forced: the throttle must not swallow the tick that settles the
            // callout, or the last line can be left part-revealed.
            onComplete: () => calloutShaderRef.current?.rebuild(true),
          })
          const between = (range) => range[0] + Math.random() * (range[1] - range[0])
          spans.forEach((span, i) => {
            const line = span.parentElement
            const r = span.getBoundingClientRect()
            // The travel is a fraction of the TEXT, not of the box. The span is now the
            // full column width (see .focus-callout__text in global.css) so that wrapping
            // changes height only, which means its own rect would scale the slide by the
            // column and throw a wrapped word much further than an unwrapped one. Measured
            // from the widest visual line box instead, so the gesture is the same either way.
            const lineWidths = measureVisualLines(span)
            const textWidth = lineWidths.length
              ? Math.max(...lineWidths.map((l) => l.w))
              : r.width
            // Alternate the side line by line so the entrance reads as a back-and-
            // forth, then randomise the distance and the vertical direction so no
            // two lines take the same path.
            const side = i % 2 === 0 ? 1 : -1
            const x = side * between(CALLOUT_REVEAL_TRAVEL_X) * textWidth
            const y = (Math.random() < 0.5 ? -1 : 1) * between(CALLOUT_REVEAL_TRAVEL_Y) * r.height
            // All lines start from the same instant bar one stagger: the entrance
            // is one gesture, and the ripple is what tells you the block is a
            // sequence of words rather than a single one.
            const at = i * CALLOUT_REVEAL_STEP
            // The slide. `from`, not fromTo: the tween ends on the element's own
            // layout position, so the last frame is exact by construction instead of
            // by a hand-written end value that has to track the CSS.
            tl.from(
              span,
              { x, y, duration: CALLOUT_REVEAL_DURATION, ease: 'power4.inOut' },
              at
            )
            // The reveal gate, in parallel. --reveal is 0 in the stylesheet, so the
            // mask contributes nothing for this line until here lifts it. The slide
            // alone cannot guarantee that: a line whose offset happens to be small
            // would sit partly inside its own box while still "outside", and be
            // visible before the entrance has placed it. This makes invisibility a
            // property of the base state rather than of the geometry.
            if (line) {
              tl.fromTo(
                line,
                { '--reveal': 0 },
                { '--reveal': 1, duration: CALLOUT_REVEAL_DURATION, ease: 'power4.inOut' },
                at
              )
            }
          })
        }
      }
    }, section)

    return () => {
      ctx.revert()
    }
    // isMobile: the callout swaps 4 lines for 3, and ctx.revert() rebuilds every
    // ScrollTrigger above — including the callout's entrance — against the new
    // layout and the new line count.
  }, [isMobile])

  return (
    <section ref={sectionRef} className="selected-region">
      <div className="container">
        <div className="section-head">
          <h2>Music React</h2>
          <span className="count">3 Works</span>
        </div>

        <div className="projects-list">
          {projects.map((project) => (
            <React.Fragment key={project.name}>
              <ProjectRow project={project} onProjectClick={handleProjectClick} isExpanded={expandedProject === project} />
              <ProjectExpanded project={project} isOpen={expandedProject === project} switchFromRef={switchFromRef} panelElsRef={panelElsRef} />
            </React.Fragment>
          ))}
        </div>

        <div className="focus-callout focus-callout--shader">
          <Suspense fallback={null}>
            <FocusCalloutShader ref={calloutShaderRef} lines={calloutLines} />
          </Suspense>
          <div className="focus-callout__text-wrapper">
            {calloutLines.map((text) => (
              <div key={text} className="focus-callout__text-line">
                <span className="focus-callout__text">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
