// Global test setup: jsdom does not provide matchMedia by default.
// GSAP/ScrollTrigger accesses it at import time, and useIsMobile() detects the
// mobile breakpoint through it, so the polyfill has to really evaluate the
// query. A stub that always answers false makes every breakpoint test lie.
//
// The `typeof window` check is not redundant: `typeof window.matchMedia` throws
// ReferenceError under `environment: 'node'`, because typeof only guards a bare
// undeclared identifier, not a property access on a missing object. The pure
// source-scanning tests (tests/structure) run in node and need this to no-op.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  const registry = new Set()

  const evaluate = (query) => {
    // Motion is allowed by default. Without this branch the `max`/`min` regexes below
    // match nothing and the fallthrough reported `prefers-reduced-motion: reduce` as
    // TRUE for every test, so every component guarding on it silently took the
    // reduced-motion branch while its test believed it exercised the animated one.
    // Tests that want reduced motion stub it explicitly.
    if (/prefers-reduced-motion\s*:\s*reduce/.test(query)) return false
    const w = window.innerWidth
    const max = /\(\s*max-width\s*:\s*(\d+)px\s*\)/.exec(query)
    const min = /\(\s*min-width\s*:\s*(\d+)px\s*\)/.exec(query)
    if (max && w > Number(max[1])) return false
    if (min && w < Number(min[1])) return false
    return true
  }

  const drop = (fn) => {
    for (const entry of registry) {
      if (entry.fn === fn) registry.delete(entry)
    }
  }

  window.matchMedia = (query) => ({
    media: query,
    onchange: null,
    get matches() { return evaluate(query) },
    addEventListener: (_type, fn) => registry.add({ query, fn }),
    removeEventListener: (_type, fn) => drop(fn),
    addListener: (fn) => registry.add({ query, fn }),
    removeListener: (fn) => drop(fn),
    dispatchEvent: () => false,
  })

  window.addEventListener('resize', () => {
    for (const { query, fn } of registry) fn({ matches: evaluate(query), media: query })
  })
}
