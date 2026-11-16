// The console banner: the site's own GIF, printed once per page load.
//
// One log, no interval, no `console.clear()`: the console stays usable for
// whoever opens it, and the GIF plays on its own inside the console element.
//
// How it works: the GIF is fetched, turned into a data URL and used as the
// `background-image` of a single `%c` styled element. The console's `url()` only
// accepts the `data:` scheme, so the file has to travel inside the style.
//
//   console.log('%c ', 'background-image:url("data:image/gif;base64,…"); …')
//
// The box is sized with `padding`, never with `width`/`height`: on the element
// the console styles, width/height are ignored and the box collapses to
// nothing, so the log was there and the picture was not.

const GIF_URL = () => import.meta.env.BASE_URL + 'assets/console/dome-console.gif'

// Half of the GIF's own box (520 × 280): the padding is the whole size of the
// console element, since the text inside it takes no room.
const PADDING = '70px 130px'

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** The style for a given data URL: the GIF, no background of its own. */
export function consoleGifStyle(dataUrl) {
  return [
    `background-image:url("${dataUrl}")`,
    'background-size:contain',
    'background-repeat:no-repeat',
    'background-position:left center',
    'font-size:0',
    'line-height:0',
    `padding:${PADDING}`,
  ].join(';')
}

/**
 * The two credit lines, in the SAME log entry as the gif, one under the other.
 * A newline inside a console message breaks the line (the console renders
 * messages with pre-wrap), which is the console's version of a <br>.
 */
export const BANNER_TEXT =
  '\n✦ SOMEBODYWANT3D ✦\n UX/UI Designer & Frontend Developer\n🌐 https://github.com/Domenico0976/DOME'

// The gif's own green is rgb(11, 91, 28); the credit lines are set in white, as
// they read best next to the gif.
export const BANNER_TEXT_COLOR = '#ffffff'

/** The style for the text half of the banner: no background of its own. */
export function consoleBannerTextStyle() {
  return [
    `color:${BANNER_TEXT_COLOR}`,
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace',
    'font-size:12px',
    'line-height:1.7',
    'letter-spacing:0.04em',
    'padding:4px 6px',
  ].join(';')
}

// Print the banner without a source link next to it.
//
// Chrome adds a "consoleGif.js:81" link to every message that comes from a
// script, and the user does not want the banner to carry a reference to the
// file that produced it. A message logged from a script WITHOUT a URL has no
// link: `new Function` creates one, and calling it from a timer leaves the
// anonymous function as the only frame in the stack (a timer callback has no
// caller frame), so there is no file Chrome could point at.
//
// The fallback matters: a Content-Security-Policy without 'unsafe-eval' refuses
// `new Function`, and that must not take the banner (or the page) down.
let printWithoutSource = null
try {
  const runner = new Function(
    'console',
    'args',
    'setTimeout(function () { console.log.apply(console, args) }, 0)',
  )
  printWithoutSource = (message, ...styles) => runner(console, [message, ...styles])
} catch {
  printWithoutSource = (message, ...styles) => console.log(message, ...styles)
}

/**
 * Print the GIF in the console. Resolves true when the banner is on screen.
 * Never throws: a missing file must not break the page.
 */
export async function printConsoleGif({ url = GIF_URL(), fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null)
  if (!doFetch) return false
  try {
    const res = await doFetch(url)
    if (!res || !res.ok) return false
    const blob = await res.blob()
    const dataUrl = await blobToDataUrl(blob)
    // One log: the gif in the first %c, the two credit lines in the second.
    printWithoutSource('%c %c' + BANNER_TEXT, consoleGifStyle(dataUrl), consoleBannerTextStyle())
    return true
  } catch (err) {
    console.warn('[console] could not print the console gif', err)
    return false
  }
}

/** Kept for the API: prints the banner again. */
export function startAscii(options) {
  return printConsoleGif(options)
}

/** Nothing to stop: the GIF plays inside the console element. */
export function stopAscii() {
  return false
}

/** Same as start: the banner can always be printed again. */
export function toggleAscii(options) {
  return printConsoleGif(options)
}

/** Nothing runs in JS. */
export function isAsciiRunning() {
  return false
}
