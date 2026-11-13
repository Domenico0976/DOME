// Always-on UI click sound: one preloaded Audio per variant, and a fresh
// random roll on every click anywhere on the page.
//
// The variants live in public/ (copied as-is by Vite), which import.meta.glob
// cannot see without also emitting a second, hashed copy of every file into
// the build — so the list is explicit. Adding a variant = one line here.
//
// Each URL goes through import.meta.env.BASE_URL (which is './' because vite
// sets base: './') because the site is served both from the domain root and
// from GitHub Pages under /DOME/ — a hardcoded '/assets/...' path would 404
// there. The path resolves relative to index.html's own location in both
// cases.
//
// Playback always starts inside the user's click gesture, which is exactly
// what browsers require: there is no permission prompt for HTML audio, only a
// block on playback that starts before any gesture. play() rejections are
// swallowed so a rare policy edge case never throws into the page.
export const CLICK_SOUNDS = [
  'click-ui-1.mp3',
  'click-ui-2.mp3',
  'click-ui-3.wav',
  'click-ui-4.wav',
  'click-ui-5.wav',
  'click-ui-6.wav',
]

export function initClickSound({ target = document, AudioCtor = Audio, random = Math.random } = {}) {
  const audios = CLICK_SOUNDS.map((name) => {
    const audio = new AudioCtor(import.meta.env.BASE_URL + 'assets/audio/' + name)
    audio.volume = 0.45
    audio.preload = 'auto'
    return audio
  })

  let lastIndex = -1
  const onClick = () => {
    let index = Math.floor(random() * audios.length)
    // Never the same variant twice in a row when there is a choice: a plain
    // roll repeats often enough that the repeat reads as a bug, not as chance.
    if (audios.length > 1 && index === lastIndex) index = (index + 1) % audios.length
    lastIndex = index
    const audio = audios[index]
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  target.addEventListener('click', onClick, true)
  return () => target.removeEventListener('click', onClick, true)
}
