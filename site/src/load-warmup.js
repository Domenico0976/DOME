// This module is imported BEFORE React, ReactDOM, and App in main.jsx so its
// body executes first. Under ESM semantics, static imports are evaluated in
// dependency order before any module body runs — placing this import at line 2
// (after bootstrap-logging) guarantees startObserving/registerLoad/sealRegistrations
// fire before `import React` / `import ReactDOM` / `import App` begin evaluating.
//
// That matters because the `shaders` package is by far the heaviest dependency —
// a single barrel that its publisher marks side-effect-free but which still
// drags in every one of its ~180 shader definitions. Pulling it into the entry
// chunk meant nothing could paint until all of it had arrived. Both components
// below reach these modules through React.lazy, so Rollup emits one shared chunk
// and these imports are the very same request. Warming it up first lets the
// network fetch overlap with the entire React evaluation graph.
import { registerLoad, sealRegistrations, startObserving } from './load-progress.js'

function preloadImage(url) {
  return new Promise((resolve) => {
    const done = () => resolve()
    try {
      const img = new Image()
      img.onload = done
      img.onerror = done
      img.src = url
      if (img.decode) img.decode().then(done, done)
    } catch {
      done()
    }
    setTimeout(done, 5000)
  })
}

startObserving()
registerLoad(Promise.all([
  import('./webgl-water/HeroShaderStack.jsx'),
  import('./components/FocusCalloutShader.jsx'),
  preloadImage('/hero-day-opt.webp'),
]))
sealRegistrations()
