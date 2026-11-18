import './bootstrap-logging.js'
import './load-warmup.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initClickSound } from './sound/clickSound.js'
import { bootWaterSound } from './sound/waterBoot.js'
import { bootLenis } from './smooth/lenisBoot.js'
import { initClickCursor } from './clickEffect/clickCursor.js'
import { startAscii, stopAscii, toggleAscii } from './console/consoleGif.js'
import './styles/global.css'

// Always-on click sound: once at module scope, outside React's lifecycle, so
// it exists on every page and survives StrictMode double-mounts.
initClickSound()
// Smooth scroll: prima di React. Il preloader polla `window.__lenis` e lo
// ferma; se l'istanza nascesse in un effetto, nel frattempo lo scroll
// resterebbe nativo e il poll andrebbe a vuoto.
bootLenis()
// The hero water engine, armed here so the very first gesture of the page (the
// preloader's "click to enter", ~0.5s) can unlock the AudioContext. React mounts
// later than that, and a mouse move is not a user activation: the missed click
// used to leave the water silent until an unrelated later click.
bootWaterSound()
initClickCursor()

// Console banner: the site's GIF, printed once per load. No interval, no
// console.clear(): the console stays usable for whoever opens it.
if (typeof window !== 'undefined') {
  window.dome = {
    ...(window.dome || {}),
    ascii: { start: startAscii, stop: stopAscii, toggle: toggleAscii },
  }
  startAscii()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
