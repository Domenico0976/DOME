// One resize policy for every WebGL surface on the page.
//
// The bug this exists to fix: `.text-entry` is sized `height: 100dvh` (global.css), and
// `dvh` is the DYNAMIC viewport unit — it deliberately tracks the mobile browser UI, so
// every scroll that collapses or expands the URL bar changes the element's height. A
// ResizeObserver on that element therefore fired repeatedly mid-scroll, and each firing
// reallocated the WebGL drawing buffer. Reallocating a backing store while the page is
// scrolling is what produced the scattering: the buffer and the visible surface are briefly
// different sizes, and the compositor shows the mismatch.
//
// The discriminator is the project's own documented finding, from useVisualViewport.js:
// `window.innerHeight` keeps its LAYOUT value while `visualViewport.height` follows the
// browser UI. So a height change on an element while the layout viewport height held still
// came from the browser chrome, not from the document, and reallocating for it is wrong.
//
// Two further rules, both about volume rather than correctness:
//   - events coalesce onto one animation frame, so a burst of resize events costs one
//     reallocation instead of one each;
//   - a width change or an orientation flip always propagates, because those genuinely
//     invalidate the drawing buffer and there is no safe way to keep the old one.
//
// Baselines are per-entry, not module-level. With several surfaces registered the sizes
// differ, so a shared "last size" would compare each element against whichever one happened
// to flush first and swallow real resizes.

const entries = new Set()

let frame = null

const readSize = (el) => ({
  width: el.clientWidth,
  height: el.clientHeight,
  dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
})

const flush = () => {
  frame = null
  const layoutHeight = typeof window === 'undefined' ? 0 : window.innerHeight

  for (const entry of entries) {
    const el = entry.el
    if (!el || !el.isConnected) continue

    const { width, height, dpr } = readSize(el)
    if (!width || !height) continue

    // A flip swaps the two axes; a browser-UI change never does.
    const flipped = entry.lastWidth !== width && entry.lastHeight !== height
      && entry.lastWidth === height && entry.lastHeight === width

    const widthMoved = width !== entry.lastWidth
    const heightMoved = height !== entry.lastHeight
    const layoutMoved = layoutHeight !== entry.layoutHeight

    if (!flipped && !widthMoved && !heightMoved) {
      // Nothing about this element moved. Without this the fall-through below would
      // deliver a redundant resize to every other registered surface on the page.
      continue
    }

    if (!flipped && !widthMoved && !layoutMoved && heightMoved && !entry.allowHeight) {
      // Height moved, the layout viewport did not: the browser chrome moved. Skip, and do
      // NOT update lastHeight — the next real resize must still compare against the height
      // the surface was actually allocated at.
      continue
    }

    entry.lastWidth = width
    entry.lastHeight = height
    entry.layoutHeight = layoutHeight
    entry.cb({ width, height, dpr, orientation: flipped })
  }
}

const schedule = () => {
  if (frame !== null) return
  frame = requestAnimationFrame(flush)
}

let listening = false

const onViewportChange = () => schedule()

const start = () => {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('resize', onViewportChange, { passive: true })
  window.addEventListener('orientationchange', onViewportChange, { passive: true })
  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener('resize', onViewportChange, { passive: true })
    vv.addEventListener('scroll', onViewportChange, { passive: true })
  }
}

const stop = () => {
  if (!listening || typeof window === 'undefined') return
  listening = false
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('orientationchange', onViewportChange)
  const vv = window.visualViewport
  if (vv) {
    vv.removeEventListener('resize', onViewportChange)
    vv.removeEventListener('scroll', onViewportChange)
  }
  if (frame !== null) {
    cancelAnimationFrame(frame)
    frame = null
  }
}

/**
 * @param {Element} el element whose box drives the surface
 * @param {(size: {width:number,height:number,dpr:number,orientation:boolean}) => void} cb
 * @param {{ allowHeight?: boolean }} [options] allowHeight opts out of the browser-UI height
 *   filter, for surfaces that genuinely track the visual viewport.
 * @returns {() => void} unregister
 */
export function registerResize(el, cb, options = {}) {
  const layoutHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  const { width, height, dpr } = readSize(el)
  const entry = {
    el,
    cb,
    allowHeight: options.allowHeight === true,
    lastWidth: width,
    lastHeight: height,
    layoutHeight,
  }
  entries.add(entry)
  start()

  cb({ width, height, dpr, orientation: false })

  return () => {
    entries.delete(entry)
    if (entries.size === 0) stop()
  }
}

export function resizeSubscriberCount() {
  return entries.size
}