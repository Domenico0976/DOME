// Click ripple: spawns dome-curs.svg at the cursor on every click.
// Keeps the svg's own SMIL animation (grow 0->1.11->0 = appear then
// disappear) and only recolours the stroke to solid black; plays once.
const SVG_URL = () => import.meta.env.BASE_URL + 'assets/favicon/dome-curs.svg'
const SIZE = 80

let markup = null
let loading = false
function loadMarkup() {
  if (markup || loading) return
  loading = true
  fetch(SVG_URL())
    .then((r) => r.text())
    .then((t) => { markup = t.replace(/#bcbcbc/g, '#000000').replace(/repeatCount="indefinite"/g, 'repeatCount="1"') })
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

    document.body.appendChild(svg)

    window.setTimeout(() => { svg.remove() }, 950)
  }

  target.addEventListener('click', onClick, true)
  return () => target.removeEventListener('click', onClick, true)
}
