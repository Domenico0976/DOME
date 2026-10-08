// Text-under-shader engine: rasterise glyphs into a feathered coverage mask, clip each
// line to its own reveal window, and hand the result to a shader as an alpha texture.
//
// This is a MOVE, not a rewrite. The helpers below are byte-identical to what the
// component used inline; the component's own tests are the check that nothing shifted.
//
// Text decomposition is not here. The unit of the effect is the visual line box, produced
// by gl/text/lines.js, so a block that wraps to three lines is three masked entries and
// where the words break stays the browser's decision.
// The mask is a feathered white-on-transparent coverage of the glyphs, consumed
// as an alpha texture by the final stack node (FilmGrain) so the whole Undertones
// 4 composite is clipped to the glyph shape AFTER refraction â€” that keeps the
// FlutedGlass refraction continuous (per-layer masking broke it) and a feathered
// edge avoids the burned green cut fringes.
function clampi(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

// Per-line coverage cache. The glyph shapes are fixed for a given layout, so each
// line is rasterised and feathered ONCE into its own tight canvas. Rebuilds are
// then N drawImage calls plus a PNG encode â€” still the most expensive thing in the
// component, which is why rebuilds are coalesced and throttled.
//
// This is per-instance state, not module state: two callouts on one page used to
// overwrite each other's cache, and an unmount left the DOM references behind.
function createMaskState() {
  return {
    lineCache: [],
    lineEls: [],
    cacheKey: null,
    encodeSeq: 0,
    currentUrl: '',
    encoding: false,
    pendingEncode: false,
  }
}

// Pre-alloc: the feather runs over every cached line, and reallocating per call
// would be pure GC churn. Pure scratch, so it can stay at module scope.
let _blurTmp, _blurOut, _covBuf
let _blurSize = 0

// The mask has to become a URL for the vendor's ImageTexture, which only accepts
// one. toDataURL encodes PNG synchronously on the main thread â€” at this canvas size
// that is tens of milliseconds of blocked thread, several times per entrance, and
// it is the single biggest cause of the whole page hitching while the callout plays.
//
// toBlob moves the encode off the main thread in Chrome. It is async, so two things
// must hold: a stale encode must never overwrite a newer one (hence the sequence
// guard), and every superseded object URL must be revoked or the entrance leaks a
// blob per frame. `toDataURL` is only the fallback for a canvas without toBlob.
//
// One encode at a time. The sequence guard alone is not enough: it discards a
// superseded RESULT, but nothing stopped a second encode from starting while the
// first was still in flight, so a slow encode meant doing work that was then thrown
// away. A rebuild arriving mid-encode just marks the mask dirty and is picked up
// when the current one lands â€” the canvas still holds the newest composite, so
// re-encoding it is what we want anyway.
function encodeMask(state, canvas, onUrl) {
  if (state.encoding) {
    state.pendingEncode = true
    return
  }
  state.encoding = true
  const seq = ++state.encodeSeq
  const previous = state.currentUrl

  const commit = (url) => {
    // Superseded while we were encoding: a newer frame already won. Drop this one
    // and leave currentUrl alone â€” the newer frame owns it.
    if (seq !== state.encodeSeq) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      return false
    }
    if (!url || url === previous) return false
    state.currentUrl = url
    // Revoke the replaced URL, not sooner: ImageTexture may still be mid-decode on
    // it, and revoking early fails that load noisily.
    if (previous.startsWith('blob:')) URL.revokeObjectURL(previous)
    onUrl(url)
    return true
  }

  const settle = () => {
    state.encoding = false
    if (!state.pendingEncode) return
    state.pendingEncode = false
    encodeMask(state, canvas, onUrl)
  }

  if (typeof canvas.toBlob !== 'function') {
    commit(canvas.toDataURL('image/png'))
    settle()
    return
  }
  canvas.toBlob((blob) => {
    if (blob) commit(URL.createObjectURL(blob))
    settle()
  }, 'image/png')
}

function releaseMaskUrl(state) {
  if (state.currentUrl.startsWith('blob:')) URL.revokeObjectURL(state.currentUrl)
  state.currentUrl = ''
  state.encodeSeq++
}
// consumed as an alpha mask beneath a blur + chromatic-aberration stack, not a
// crisp glyph render. At devicePixelRatio 2 the encode costs 4x for no visible
// gain, and it runs synchronously during an animation. 1 is what a non-retina
// display shows anyway.
// The mask is a feathered glow stencil stretched by objectFit="fill" and consumed
// as an alpha mask beneath a blur + chromatic-aberration stack, not a crisp glyph
// render.
//
// It MUST stay at 1. The composite draws in CSS pixels (state x/y, winTop/winBottom
// and pad are all CSS px) into a canvas sized `w * MASK_DPR`; anything other than 1
// puts the canvas in a different coordinate space from the coordinates being drawn
// into it, and every glyph lands at the wrong place â€” 0.5 draws everything at twice
// its position, mostly off-canvas. Lowering this needs the composite transform
// scaled by dpr AND the per-line scratch clip scaled to match, not just this number.
const MASK_DPR = 1

// Minimum gap between mask rebuilds. Each one costs a canvas composite, a PNG
// encode, a React render and an ImageTexture reload, so the entrance cannot be
// redrawn at 60fps. ~30/s is the practical ceiling here; the extra 33ms costs very
// little on an ease-out that settles in a few seconds, and the alternative (every
// tick) starves GSAP and the other shaders sharing the thread.
const MASK_MIN_INTERVAL_MS = 33

const FEATHER_PX = 2

// Dilated low-alpha halo added under the crisp glyph (see cacheLine). Exists
// because the lines are deliberately set tighter than the ink, so glyphs cross
// each other and each one needs its own outline to stay legible. 0 disables it.
const STROKE_ALPHA = 0.4

// Separable box blur (radius r) â€” feathers the glyph alpha so the GPU cut is
// soft instead of a hard 1px boundary that burns green at the edges.
function boxBlur1d(src, w, h, r) {
  const n = w * h
  if (n > _blurSize) {
    _blurSize = n
    _blurTmp = new Float32Array(n)
    _blurOut = new Float32Array(n)
    _covBuf = new Float32Array(n)
  }
  const tmp = _blurTmp
  const out = _blurOut
  const norm = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * w + clampi(x, 0, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * norm
      acc += src[y * w + clampi(x + r + 1, 0, w - 1)] - src[y * w + clampi(x - r, 0, w - 1)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clampi(y, 0, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm
      acc += tmp[clampi(y + r + 1, 0, h - 1) * w + x] - tmp[clampi(y - r, 0, h - 1) * w + x]
    }
  }
  return out
}

// Rasterise one line's glyphs into a tight canvas and feather them. Runs only
// when the layout changes (resize / font load) â€” nothing about the callout is
// animated, so this never runs during a scroll.
function cacheLine(entry, dpr) {
  const { w, h } = entry
  if (!entry.canvas) entry.canvas = document.createElement('canvas')
  const ctx = entry.canvas.getContext('2d')
  if (!ctx) return

  // Measured before sizing, not after: textBaseline 'top' anchors the EM box,
  // but entry.h is the top of the line box, and half-leading puts the em box
  // ABOVE that whenever line-height is tighter than the content area. Off the
  // real font rather than assumed, or the mask text sits a few px off the DOM
  // text. A negative shift also needs matching headroom, or the ascenders get
  // cropped off the raster.
  ctx.font = entry.font
  const metrics = ctx.measureText(entry.text)
  const content =
    typeof metrics.fontBoundingBoxAscent === 'number' && typeof metrics.fontBoundingBoxDescent === 'number'
      ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
      : h
  const shift = (h - content) / 2
  const pad = FEATHER_PX + 1 + Math.ceil(Math.max(0, -shift))

  const cw = Math.max(1, Math.ceil(w * dpr) + pad * 2)
  const ch = Math.max(1, Math.ceil(h * dpr) + pad * 2)
  if (entry.canvas.width !== cw || entry.canvas.height !== ch) {
    entry.canvas.width = cw
    entry.canvas.height = ch
  }
  // Sizing a canvas resets its 2D context, so the font has to be set again.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cw, ch)
  ctx.font = entry.font
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) ctx.letterSpacing = entry.letterSpacing
  // White on transparent: the ALPHA is the coverage, so the feather survives into
  // the mask. Thresholding luminance instead made it binary, which is how an
  // earlier fade-on version ended up contributing nothing below ~0.5 opacity.
  ctx.fillStyle = '#FFF'
  ctx.fillText(entry.text, pad, pad + shift)

  const img = ctx.getImageData(0, 0, cw, ch)
  const N = cw * ch
  if (N > _blurSize) {
    _blurSize = N
    _blurTmp = new Float32Array(N)
    _blurOut = new Float32Array(N)
    _covBuf = new Float32Array(N)
  }
  const cov = _covBuf
  for (let i = 0; i < N; i++) cov[i] = img.data[i * 4 + 3] / 255
  const blurred = boxBlur1d(cov, cw, ch, FEATHER_PX)
  for (let i = 0; i < N; i++) {
    img.data[i * 4] = 255
    img.data[i * 4 + 1] = 255
    img.data[i * 4 + 2] = 255
    // Core plus a dilated low-alpha halo. At line-height 0.66 the lines overlap on
    // purpose, and this is what keeps a glyph readable where it crosses another:
    // each one carries its own outline instead of merging into a blob.
    const a = cov[i] + blurred[i] * STROKE_ALPHA
    img.data[i * 4 + 3] = Math.round(a <= 0 ? 0 : a >= 1 ? 255 : a * 255)
  }
  ctx.putImageData(img, 0, 0)
  entry.pad = pad / dpr
  // Where the ink sits inside this raster, in raster-local px. The clip window is
  // derived from these once the entry has a FINAL position â€” see the cache build.
  entry.inkTop = pad + shift
  entry.inkBottom = pad + shift + content
  // Per-line scratch: the reveal moves the glyphs and clips them to the line's own
  // window, and a shared canvas has no per-line alpha, so each line is composited
  // alone here and only then blitted into the main mask. This is also what keeps
  // a line from ever clipping its neighbour: the window only ever touches the
  // pixels of the line that owns it.
  if (!entry.scratch) entry.scratch = document.createElement('canvas')
  entry.scratch.width = cw
  entry.scratch.height = ch
}

// Composite the cached lines into the hidden mask canvas and encode it.
//
// Each state carries the line's LIVE position (`x`, `y`, read from the moving span)
// and its FINAL ink window (`winTop`/`winBottom`, in mask px, measured once at
// cache time). The glyphs are drawn at the live position and clipped to the final
// window, which is exactly "the characters move, the line's box is where they end
// up": while a line is still offset you only see the part of it that has crossed
// into its own box, and at rest it fills the box exactly.
//
// Clipping happens on the per-line scratch, so a window can only ever touch its own
// line's pixels â€” the lines overlap on purpose and must never clip each other.
//
// This is the performance ceiling of the effect: every new URL pushes a fresh image
// through ImageTexture, and the encode is proportional to the mask area. The area is
// held down by MASK_DPR, so what is left to protect is the CALL RATE â€” see
// MASK_MIN_INTERVAL_MS and the rebuild handle.
function compositeLinesUrl(state, target, width, height, states, onUrl) {
  if (target.width !== width || target.height !== height) {
    target.width = width
    target.height = height
  }
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.globalAlpha = 1
  // 'lighter' so overlapping feathered edges accumulate rather than the last
  // line winning, which would drop a line sitting on top of its neighbour.
  ctx.globalCompositeOperation = 'lighter'
  for (const s of states) {
    if (!s.canvas) continue
    const reveal = Math.max(0, Math.min(1, s.reveal))
    if (reveal <= 0.002) continue
    const dx = Math.round(s.x - s.pad)
    const dy = Math.round(s.y - s.pad)
    const winTop = Math.round(s.winTop)
    const winBottom = Math.round(s.winBottom)
    ctx.globalAlpha = reveal
    // Compared in the SPAN's coordinate space, where restX/restY were stored. dx/dy
    // are raster-space draw positions and sit a `pad` away, so testing one against
    // the other never matched and this fast path was dead code.
    const atRest = Math.abs(s.x - s.restX) < 0.5 && Math.abs(s.y - s.restY) < 0.5
    if (atRest) {
      // At rest the window contains the whole raster, so skip the scratch
      // entirely â€” this is the common case once the entrance has played out.
      ctx.drawImage(s.canvas, dx, dy)
      ctx.globalAlpha = 1
      continue
    }
    const sc = s.scratch
    const sctx = sc && sc.getContext('2d')
    if (!sctx) {
      ctx.globalAlpha = 1
      continue
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.globalCompositeOperation = 'source-over'
    sctx.clearRect(0, 0, sc.width, sc.height)
    sctx.drawImage(s.canvas, 0, 0)
    sctx.globalCompositeOperation = 'destination-in'
    sctx.fillStyle = '#FFF'
    sctx.fillRect(0, winTop - dy, sc.width, Math.max(0, winBottom - winTop))
    sctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(sc, dx, dy)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  encodeMask(state, target, onUrl)
}

// The reveal channel. GSAP tweens --reveal on the line (0 hidden -> 1 shown) and
// the mask multiplies that line's coverage by it. The BASE is 0 in CSS, not here:
// a line must be unable to appear before its entrance has positioned it, and that
// guarantee has to survive any effect ordering. Reading a custom property through
// getComputedStyle is a resolve, not a layout flush, so it is cheap enough to run
// every frame. Missing/blank falls back to 1 so a line is never stranded invisible
// if the stylesheet fails to load.
function readReveal(line) {
  const raw = parseFloat(getComputedStyle(line).getPropertyValue('--reveal'))
  return Number.isFinite(raw) ? raw : 1
}


// The mask is a pure function of the layout and of the entrance state, so it is
// rebuilt on layout changes and on entrance ticks â€” and at no other time. It used
// to be rebuilt from a requestAnimationFrame loop that polled the DOM forever,
// which meant a settled callout kept reading layout every frame and, worse, rebuilt
// the mask twice for every scroll discontinuity because the change-detection
// signature mixed a live span rect with a container rect captured in an earlier
// frame. `ref` exposes `rebuild()` so whoever owns the entrance can drive it from
// the tween it is already running; see the timeline in SelectedProjects.
// `ref` is a prop, not a second positional argument: React passes function
// components exactly one argument, and since 19 the ref rides in props.

// Only what a mounting component reaches for. Everything else in the pipeline — clampi,
// encodeMask, boxBlur1d, the blur buffers — stays private: a second call site has no reason
// to reach past the surface.
//
// cacheLine is exported because the cache BUILD lives in the component, not here: deciding
// what a "line" is (see gl/text/lines.js) is a layout question, and this module is about what
// to do with one once it exists. MASK_DPR is exported for the same reason — the dpr a line is
// rasterised at has to match the dpr the container was measured at.
export {
  createMaskState,
  releaseMaskUrl,
  compositeLinesUrl,
  readReveal,
  cacheLine,
  MASK_DPR,
  MASK_MIN_INTERVAL_MS,
}
