// Row configuration for the TEXT ENTRY GLASS text layer.
//
// `behind` decides where a row lives relative to the glass object:
//   true  -> rendered in the opaque pass, so the transmissive torus refracts it
//   false -> rendered in the transparent pass, painted over the object, crisp
//
// Everything downstream derives from rows.length, so adding a row here is the
// only edit needed to change how many lines exist.
//
// Rich text: `text` may contain a small allowlist of inline HTML tags. The
// WebGL atlas is rasterised with canvas 2D (no DOM), so tags are parsed into
// per-segment styles instead of innerHTML:
//
//   <b>, <strong>          -> bold
//   <i>                   -> italic
//   <em>                  -> italic + accent color (matches .hero__title .row--accent)
//   <u>                   -> underline
//   <s>, <del>, <strike>  -> strikethrough
//   <mark>, <accent>, <hl> -> accent color
//   <span style="...">     -> color / font-family / font-weight / font-style
//   <span class="accent-anim"> -> gradiente animato blu/rosa (vedi sotto)
//   <font face=".." color=".."> -> legacy alias of the above
//   <br>                  -> line break: splits ONE row into TWO rows (same `behind`)
//   everything else       -> stripped, inner text kept (e.g. <a>, <p>, <div>)
//
// Inline examples:
//   { text: 'I am a <em>UX|UI Designer</em>', behind: false }
//   { text: 'play with <b>bold <i>both</i></b>', behind: true }
//   { text: 'hello <span style="color:#ff0000">red</span>', behind: false }
//   { text: 'ciao <span class="accent-anim">Domenico</span>', behind: false }
//   -> il segmento accent-anim NON usa il fill piatto: l'atlas genera una mask
//   e lo shader lo riempie con la rampa colorata in scroll sinistra->destra
//   (palette in accentStripe(), specchio del CSS).
//   Il CSS .accent-anim in global.css fa la stessa cosa
//   per l'uso DOM (fallback); sulla texture WebGL il CSS da solo non avrebbe
//   effetto, serve la mask + shader.
//   { text: 'line one<br>line two', behind: true }  -> two rows
//
// Row-level overrides (the whole row, segments inherit unless they override):
//   {
//     text: 'I am Domenico and this',
//     behind: false,
//     fontFamily: 'var(--f-text)',   // qualsiasi stack CSS, var() risolta su canvas
//     fontWeight: '600',             // '400', '700', 'bold', ...
//     color: '#111111',              // base della riga (accent resta --c-accent)
//     accentColor: '#083D2A',        // opzionale, default globale
//     size: 0.85,                    // moltiplicatore dopo il fit (1 = default)
//     align: 'left',                 // 'left' | 'center' | 'right'
//     letterSpacing: '0.02em',       // best-effort (Chrome/Edge; altrove ignorato)
//     bold: false, italic: false,    // base per tutti i segmenti della riga
//   }

export const TEXT_ROWS = [
  { text: '<i>Helloooo,</i>', behind: true, size: 0.77 },
  { text: '<i>I am Domenico</i>,  <span class="accent-anim"> (づ> 3-)づ</span>', behind: false, size: 0.77 },
  { text: 'This is my <span class="accent-anim"><i>portfolio</i></span>, i hope you enjoy it!', behind: true, size: 0.99 },
  { text: 'I am a <span class="accent-anim"><i>UX|UI Designer</i></span> and <span class="accent-anim"><i>Service Designer</i></span>.', behind: true, size: 0.97 },
  { text: '<i>I like to play with <span class="accent-anim">things</span></i>', behind: true, size: 0.97 },
  { text: 'and find <span class="accent-anim">new ways</span> to solve problems', behind: true, size: 0.97 },

]

// Testo dedicato al mobile: righe piu corte e size maggiori per restare
// leggibile su viewport strette. Stessa voce, stesso numero di righe.
// TextEntryGlass sceglie questa lista quando isMobile (pattern CALLOUT_LINES_*).
export const TEXT_ROWS_MOBILE = [
  { text: '<i>Helloooo,</i>', behind: true, size: 0.65 },
  { text: '<i>I am Domenico</i>', behind: false, size: 0.70 },
  { text: 'This is my <span class="accent-anim"><i>portfolio</i></span>!', behind: true, size: 1.0 },
  { text: '<span class="accent-anim"><i>UX|UI</i> + </span> <span class="accent-anim"><i>Service Designer</i></span> .', behind: true, size: 1.0 },
  { text: '<i>I play with <span class="accent-anim">things</span></i>', behind: true, size: 1.0 },
  { text: '<span class="accent-anim">new ways</span>, no problems', behind: true, size: 1.0 },

]

const ACCENT_CLASS_RE = /accent/i
const ANIM_CLASS_RE = /accent-anim/i
// <br>, <br/>, <br /> — case-insensitive.
const BR_SPLIT_RE = /<\s*br\s*\/?\s*>/i
const BR_GLOBAL_RE = /<\s*br\s*\/?\s*>/gi
// Matches one tag: <b>, </b>, <span style="...">, <br/>, ...
const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>/g
const COLOR_ATTR_RE = /color\s*=\s*["']?([^"'\s;>]+)["']?/i
const FACE_ATTR_RE = /face\s*=\s*["']([^"']+)["']/i
const CLASS_ATTR_RE = /class\s*=\s*["']([^"']*)["']/i
const STYLE_PROP_RE = /([\w-]+)\s*:\s*([^;]+)/g

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n)
      return Number.isFinite(c) ? String.fromCodePoint(c) : _
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const c = parseInt(h, 16)
      return Number.isFinite(c) ? String.fromCodePoint(c) : _
    })
}

function emptyStyle() {
  return {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    color: null,
    accent: false,
    fontFamily: null,
    fontWeight: null,
    anim: false,
  }
}

function styleKey(s) {
  return [
    s.bold ? 1 : 0,
    s.italic ? 1 : 0,
    s.underline ? 1 : 0,
    s.strike ? 1 : 0,
    s.color || '',
    s.accent ? 1 : 0,
    s.fontFamily || '',
    s.fontWeight || '',
    s.anim ? 1 : 0,
  ].join('|')
}

function parseStyleAttr(attrs) {
  const out = {}
  if (!attrs) return out
  STYLE_PROP_RE.lastIndex = 0
  let m
  while ((m = STYLE_PROP_RE.exec(attrs)) !== null) {
    const prop = m[1].toLowerCase()
    const val = m[2].trim().replace(/["']+$/g, '')
    if (!val) continue
    if (prop === 'color') out.color = val
    else if (prop === 'font-family' || prop === 'font') out.fontFamily = val
    else if (prop === 'font-weight') out.fontWeight = val
    else if (prop === 'font-style') out.fontStyle = val.toLowerCase()
  }
  return out
}

function extractColor(attrs) {
  const fromAttr = attrs.match(COLOR_ATTR_RE)
  if (fromAttr) return fromAttr[1].trim()
  const styled = parseStyleAttr(attrs)
  return styled.color || null
}

function hasAccentClass(attrs) {
  const m = attrs.match(CLASS_ATTR_RE)
  return m ? ACCENT_CLASS_RE.test(m[1]) : false
}

function hasAnimClass(attrs) {
  const m = attrs.match(CLASS_ATTR_RE)
  return m ? ANIM_CLASS_RE.test(m[1]) : false
}

function applyInlineStyle(next, attrs) {
  const styled = parseStyleAttr(attrs)
  if (styled.color) next.color = styled.color
  if (styled.fontFamily) next.fontFamily = styled.fontFamily
  if (styled.fontWeight) next.fontWeight = styled.fontWeight
  if (styled.fontStyle) {
    if (styled.fontStyle.includes('italic') || styled.fontStyle.includes('oblique')) next.italic = true
    else if (styled.fontStyle.includes('normal')) next.italic = false
  }
  if (hasAccentClass(attrs)) next.accent = true
  if (hasAnimClass(attrs)) next.anim = true
  const face = attrs.match(FACE_ATTR_RE)
  if (face && !next.fontFamily) next.fontFamily = face[1].trim()
}

/**
 * Parse a fragment WITHOUT <br> into styled segments.
 * Unknown tags are stripped (inner text kept). Malformed HTML never throws:
 * stray closers are ignored, unclosed openers apply until the end.
 */
export function parseInline(html) {
  const source = typeof html === 'string' ? html : ''
  const stack = [emptyStyle()]
  const tagNameStack = []
  const segments = []
  let lastIndex = 0

  function pushText(chunk) {
    if (!chunk) return
    const text = decodeEntities(chunk)
    if (!text) return
    const top = stack[stack.length - 1]
    const prev = segments[segments.length - 1]
    if (prev && styleKey(prev) === styleKey(top)) {
      prev.text += text
    } else {
      segments.push({ text, ...top })
    }
  }

  TAG_RE.lastIndex = 0
  let m
  while ((m = TAG_RE.exec(source)) !== null) {
    pushText(source.slice(lastIndex, m.index))
    lastIndex = TAG_RE.lastIndex

    const isClose = m[1] === '/'
    const name = m[2].toLowerCase()
    const attrs = m[3] || ''

    if (name === 'br') {
      // No <br> expected here (caller splits first), but tolerate it as a space.
      pushText(' ')
      continue
    }

    if (isClose) {
      // Pop until the matching opener; stray closers are ignored.
      const idx = tagNameStack.lastIndexOf(name)
      if (idx === -1) continue
      const pops = tagNameStack.length - idx
      for (let i = 0; i < pops; i++) {
        tagNameStack.pop()
        stack.pop()
      }
      continue
    }

    const base = stack[stack.length - 1]
    const next = { ...base }
    let recognised = true
    switch (name) {
      case 'b':
      case 'strong':
        next.bold = true
        break
      case 'i':
        next.italic = true
        break
      case 'em':
        // Site convention: em = italic + accent (see .hero__title .row--accent).
        next.italic = true
        next.accent = true
        break
      case 'u':
        next.underline = true
        break
      case 's':
      case 'strike':
      case 'del':
        next.strike = true
        break
      case 'mark':
      case 'accent':
      case 'hl':
        next.accent = true
        break
      case 'span':
      case 'font':
      case 'a':
        applyInlineStyle(next, attrs)
        // <a> keeps its text, href is deliberately ignored (no navigation in a texture).
        break
      default:
        recognised = false
        break
    }
    if (!recognised) continue
    // No-op wrapper — skip stacking it so </span> later does not pop real styles.
    if ((name === 'span' || name === 'font' || name === 'a') && styleKey(next) === styleKey(base)) {
      continue
    }
    stack.push(next)
    tagNameStack.push(name)
  }
  pushText(source.slice(lastIndex))

  // Trim only the outer edges so inner spacing ("a <b>b</b> c") survives.
  if (segments.length) {
    segments[0].text = segments[0].text.replace(/^\s+/, '')
    segments[segments.length - 1].text = segments[segments.length - 1].text.replace(/\s+$/, '')
  }
  return segments.filter((s) => s.text)
}

/** Plain-text version of an html fragment (entities decoded, tags stripped). */
export function stripHtml(html) {
  return parseInline(html).map((s) => s.text).join('')
}

function pickRowOptions(row) {
  const opts = {}
  if (row.fontFamily && typeof row.fontFamily === 'string' && row.fontFamily.trim()) {
    opts.fontFamily = row.fontFamily.trim()
  }
  const weight = row.fontWeight ?? row.weight
  if (weight != null && String(weight).trim()) opts.fontWeight = String(weight).trim()
  const color = row.color ?? row.colour
  if (color && typeof color === 'string' && color.trim()) opts.color = color.trim()
  if (row.accentColor && typeof row.accentColor === 'string' && row.accentColor.trim()) {
    opts.accentColor = row.accentColor.trim()
  }
  const sizeRaw = row.size ?? row.scale ?? row.sizeScale
  if (sizeRaw != null) {
    const size = Number(sizeRaw)
    if (Number.isFinite(size) && size > 0) opts.size = Math.min(Math.max(size, 0.2), 3)
  }
  if (row.align && typeof row.align === 'string') {
    const a = row.align.trim().toLowerCase()
    if (a === 'center' || a === 'middle') opts.align = 'center'
    else if (a === 'right' || a === 'end') opts.align = 'right'
    else if (a === 'left' || a === 'start') opts.align = 'left'
  }
  if (row.letterSpacing != null && String(row.letterSpacing).trim()) {
    opts.letterSpacing = String(row.letterSpacing).trim()
  }
  if (row.bold === true) opts.bold = true
  if (row.italic === true) opts.italic = true
  return opts
}

function buildRow(htmlPart, behind, rowOpts) {
  const html = htmlPart.trim()
  if (!html) return null
  const segments = parseInline(html)
  const text = segments.map((s) => s.text).join('')
  if (!text.trim()) return null
  return { text, html, behind, segments, ...rowOpts }
}

export function normalizeRows(input) {
  if (!Array.isArray(input)) return []

  const rows = []
  for (const row of input) {
    if (!row || typeof row.text !== 'string') continue
    const raw = row.text.trim()
    if (!raw) continue
    // <br> inside one entry becomes N rows sharing the same `behind` + options.
    const hasBr = BR_GLOBAL_RE.test(raw)
    BR_GLOBAL_RE.lastIndex = 0
    const behind = row.behind === true
    const rowOpts = pickRowOptions(row)
    if (!hasBr && !/<[a-zA-Z]/.test(raw)) {
      rows.push({ text: raw, html: raw, behind, segments: [{ text: raw, ...emptyStyle() }], ...rowOpts })
      continue
    }
    const parts = raw.split(BR_SPLIT_RE)
    // No <br>: single part, parsed for inline tags.
    // With <br>: one row per non-empty part.
    for (const part of parts) {
      const built = buildRow(part, behind, rowOpts)
      if (built) rows.push(built)
    }
  }
  return rows
}
