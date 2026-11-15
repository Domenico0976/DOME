import './bootstrap-logging.js'
import './load-warmup.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initClickSound } from './sound/clickSound.js'
import { bootWaterSound } from './sound/waterBoot.js'
import { initClickCursor } from './clickEffect/clickCursor.js'
import './styles/global.css'

// Always-on click sound: once at module scope, outside React's lifecycle, so
// it exists on every page and survives StrictMode double-mounts.
initClickSound()
// The hero water engine, armed here so the very first gesture of the page (the
// preloader's "click to enter", ~0.5s) can unlock the AudioContext. React mounts
// later than that, and a mouse move is not a user activation: the missed click
// used to leave the water silent until an unrelated later click.
bootWaterSound()
initClickCursor()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
