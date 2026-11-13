// Click ripple: spawns dome-curs.svg at the cursor on every click.
// Stroke is white with mix-blend-mode: difference so it reads as white on
// dark backgrounds and black on light backgrounds.
const SVG_URL = () => import.meta.env.BASE_URL + 'assets/favicon/dome-curs.svg'
const SIZE = 80

let markup = null
let loading = false
function loadMarkup() {
  if (markup || loading) return
  loading = true
  fetch(SVG_URL())
    .then((r) => r.text())
    .then((t) => { markup = t.replace(/#bcbcbc/g, '#ffffff').replace(/repeatCount="indefinite"/g, 'repeatCount="1"') })
    .catch(() => { markup = null })
    .finally(() => { loading = false })
}

export function initClickCursor({ target = document } = {}) {
  loadMarkup()

  const onClick = (e) => {
    if (!markup) { loadMarkup(); return }

    const holder = document.createElement('div')
    holder.innerHTML = markup.trim()
    const svg = holder.querySelector('svg')
    if (!svg) return

    svg.setAttribute('width', String(SIZE))
    svg.setAttribute('height', String(SIZE))
    svg.style.position = 'fixed'
    svg.style.left = (e.clientX - SIZE / 2) + 'px'
    svg.style.top = (e.clientY - SIZE / 2) + 'px'
    svg.style.pointerEvents = 'none'
    svg.style.zIndex = '9999'
    svg.style.mixBlendMode = 'difference'

    document.body.appendChild(svg)

    window.setTimeout(() => { svg.remove() }, 950)
  }

  target.addEventListener('click', onClick, true)
  return () => target.removeEventListener('click', onClick, true)
}
