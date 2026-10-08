// Frame capture for the preloader tile wave. Complements preloader-check.mjs,
// which only asserts the state machine.
//
// Page screenshots take ~1s each here, far too slow to sample a multi-second
// animation: the frames all land after the preloader is gone. Instead we read
// the WebGL canvas from inside the page with toDataURL (milliseconds) on every
// animation frame, tagging each grab with elapsed time and the live counter so
// every frame can be tied to a phase.
//
// Build first, then: node tests/preloader/preloader-visual.mjs

import { chromium } from 'patchright'
import { spawn } from 'node:child_process'
import { rmSync, mkdirSync, writeFileSync } from 'node:fs'

const PORT = 4183
const URL = `http://localhost:${PORT}/`
const OUT = 'tests/preloader/frames'
const RECORD_MS = 11000

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'pipe',
})
await new Promise((r) => setTimeout(r, 3500))

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(URL, { waitUntil: 'domcontentloaded' })

await page.evaluate((recordMs) => {
  window.__frames = []
  const canvas = document.querySelector('canvas.preloader__gl')
  const t0 = performance.now()
  const tick = () => {
    const t = performance.now() - t0
    if (canvas) {
      window.__frames.push({
        t: Math.round(t),
        counter: document.querySelector('.preloader__sr')?.textContent || '',
        png: canvas.toDataURL('image/png'),
      })
    }
    if (t < recordMs) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}, RECORD_MS)

await new Promise((r) => setTimeout(r, RECORD_MS + 1200))
const frames = await page.evaluate(() => window.__frames)
await page.screenshot({ path: `${OUT}/zz-final-page.png` })
await browser.close()
preview.kill()

const kept = []
let last = -999
for (const f of frames) {
  if (f.t - last < 150) continue
  last = f.t
  kept.push(f)
}

for (const f of kept) {
  const name = `${OUT}/t${String(f.t).padStart(5, '0')}-c${f.counter || 'none'}.png`
  writeFileSync(name, Buffer.from(f.png.split(',')[1], 'base64'))
}

console.log('FRAMES_RECORDED', frames.length)
console.log('FRAMES_WRITTEN', kept.length)
console.log('FIRST', kept[0] ? `t=${kept[0].t} counter=${kept[0].counter}` : 'none')
const lastF = kept[kept.length - 1]
console.log('LAST', lastF ? `t=${lastF.t} counter=${lastF.counter}` : 'none')
const at100 = kept.find((f) => f.counter === '100')
console.log('REACHED_100_AT', at100 ? at100.t : 'never')
process.exit(0)
