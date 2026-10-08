// One context-loss policy for every WebGL surface on the page.
//
// The inventory that motivated this: seven `new THREE.WebGLRenderer(...)` call sites
// (hero-glass/engine.js, preloader/scene.js, MobileSectionCanvas.jsx, FeaturedGallery.jsx,
// SelectedProjects.jsx, ArchiveHoverCanvas.jsx, plus FocusCalloutShader's shaders/react
// surface) and exactly ONE `webglcontextlost` listener, in MobileCanvas.jsx. Mobile browsers
// cap live contexts (roughly 8-16 in Chrome, lower on Safari) and reclaim the oldest past
// that cap, so most of those surfaces were unprotected.
//
// `setupWebGLContextSafety` was already an export in MobileCanvas.jsx, which is why this
// module is small: the primitive existed, it was just filed under one consumer instead of
// the shared layer.
//
// `preventDefault()` on `lost` is mandatory, not cosmetic. Without it the browser does not
// fire `restored` at all, so the recovery path below could never run.

const registered = new WeakMap()

const handleLost = (event) => {
  // Required for `restored` to ever fire. Omitting it silently makes recovery impossible.
  event.preventDefault()
  registered.get(event.currentTarget)?.onLost?.(event)
}

const handleRestored = (event) => {
  registered.get(event.currentTarget)?.onRestored?.(event)
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onLost?: (e: Event) => void, onRestored?: (e: Event) => void }} [handlers]
 * @returns {() => void} unregister
 */
export function registerWebGLContext(canvas, handlers = {}) {
  if (!canvas || typeof canvas.addEventListener !== 'function') return () => {}
  registered.set(canvas, { onLost: handlers.onLost, onRestored: handlers.onRestored })
  canvas.addEventListener('webglcontextlost', handleLost)
  canvas.addEventListener('webglcontextrestored', handleRestored)

  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost)
    canvas.removeEventListener('webglcontextrestored', handleRestored)
    registered.delete(canvas)
  }
}