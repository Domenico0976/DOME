// One IntersectionObserver for the whole page instead of one per section.
//
// The reason it matters is not elegance. Every section that owns a WebGL surface wants the
// same thing: stop rendering when it is off screen, because an offscreen renderer still
// costs a draw call per frame and, on mobile, still holds GPU memory that another context
// may need. Before this, each section allocated its own observer and computed its own
// margin — `useInView` used `240px 0px`, and the margin is a guess that differs per
// consumer. One observer with one margin keeps them consistent and gives the page a single
// place to see everything that is currently rendering.
//
// Subscribers get the initial state synchronously. A component that mounts already in view
// would otherwise spend one frame rendering before the first callback arrives, which on a
// fast scroll is long enough to flash.

const subscribers = new Map()

let observer = null

const MARGIN = '80px 0px'

const readIsInView = (el) => {
  const r = el.getBoundingClientRect()
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight || 0
  return r.bottom > -80 && r.top < vh + 80
}

const ensureObserver = () => {
  if (observer || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        const set = subscribers.get(record.target)
        if (!set) continue
        for (const sub of set) sub(record.isIntersecting)
      }
    },
    { rootMargin: MARGIN }
  )
}

const teardown = () => {
  if (!observer) return
  observer.disconnect()
  observer = null
}

/**
 * @param {Element} el
 * @param {(isInView: boolean) => void} cb invoked immediately with the current state, then
 *   on every intersection change
 * @returns {() => void} unsubscribe
 */
export function subscribeInView(el, cb) {
  if (!el || typeof cb !== 'function') return () => {}

  let set = subscribers.get(el)
  if (!set) {
    set = new Set()
    subscribers.set(el, set)
  }
  set.add(cb)

  ensureObserver()
  cb(readIsInView(el))
  observer?.observe(el)

  return () => {
    const current = subscribers.get(el)
    if (!current) return
    current.delete(cb)
    observer?.unobserve(el)
    if (current.size === 0) {
      subscribers.delete(el)
      if (subscribers.size === 0) teardown()
    }
  }
}

export function inViewSubscriberCount() {
  let n = 0
  for (const set of subscribers.values()) n += set.size
  return n
}

export function inViewObserverCount() {
  return observer ? 1 : 0
}