import './bootstrap-logging.js'
import './load-warmup.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initClickSound } from './sound/clickSound.js'
import { initClickCursor } from './clickEffect/clickCursor.js'
import './styles/global.css'

// Always-on click sound: once at module scope, outside React's lifecycle, so
// it exists on every page and survives StrictMode double-mounts.
initClickSound()
initClickCursor()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
