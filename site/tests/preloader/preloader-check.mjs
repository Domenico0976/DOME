// Browser verification for the first-landing preloader (run `npm run build`
// first, then `node tests/preloader/preloader-check.mjs`).
//
// Gates: first load shows #preloader and counts to 100 then uncovers; reload in
// the same session is skipped via sessionStorage; reduced motion completes AND
// mounts no <canvas> at all. Plus the webgl-gate-audit probes: rAF FPS over 2s
// and renderer.info draw-call count.

import { chromium } from 'patchright'
import { spawn } from 'node:child_process'

const PORT = 4179
const URL = `http://localhost:${PORT}/`

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'pipe',
})
await new Promise((r) => setTimeout(r, 3500))

const fatalErrors = []
function attachLogs(page) {
  page.on('pageerror', (e) => fatalErrors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') fatalErrors.push('console.error: ' + m.text())
  })
}

async function waitFor(fn, timeout = 15000, every = 100) {
  const start = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ok = await fn()
    if (ok) return true
    if (Date.now() - start > timeout) return false
    await new Promise((r) => setTimeout(r, every))
  }
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })

// ---------- (1) First load: shows, counts to 100, then uncovers ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
attachLogs(page)
// domcontentloaded, not networkidle: the preloader is a ~6s transient and
// networkidle on a 3.4MB bundle can resolve after it is already gone, which
// would make the transient assertions below unobservable.
await page.goto(URL, { waitUntil: 'domcontentloaded' })

const presentInitially = await page.evaluate(() => !!document.getElementById('preloader'))
console.log('PRELOADER_PRESENT_INITIALLY', presentInitially)
if (!presentInitially) throw new Error('PRELOADER: #preloader missing on first load')

const perf = await page.evaluate(async () => {
  let frames = 0
  const t0 = performance.now()
  await new Promise((resolve) => {
    const loop = () => {
      frames++
      if (performance.now() - t0 < 2000) requestAnimationFrame(loop)
      else resolve()
    }
    requestAnimationFrame(loop)
  })
  const stats = window.__preloader?.getStats?.() || null
  return { fps: Math.round(frames / ((performance.now() - t0) / 1000)), stats }
})
console.log('PRELOADER_FPS', perf.fps)
console.log('PRELOADER_DRAW_CALLS', perf.stats ? perf.stats.calls : 'no-scene')
console.log('PRELOADER_TEXTURES', perf.stats ? perf.stats.textures : 'no-scene')
if (perf.stats && perf.stats.calls > 100) {
  throw new Error('PRELOADER: draw calls over budget: ' + perf.stats.calls)
}

const reached100 = await waitFor(async () => {
  const t = await page.evaluate(() => document.querySelector('.preloader__sr')?.textContent || '')
  return t === '100'
}, 12000)
console.log('COUNTER_REACHED_100', reached100)
if (!reached100) throw new Error('PRELOADER: counter never reached 100')

const uncovered = await waitFor(async () => {
  return await page.evaluate(() => !document.getElementById('preloader'))
}, 15000)
console.log('PRELOADER_UNCOVERED', uncovered)
if (!uncovered) throw new Error('PRELOADER: site never uncovered (reveal did not finish)')

// ---------- (2) Reload same session: skipped via sessionStorage ----------
await page.reload({ waitUntil: 'networkidle' })
const skipped = await page.evaluate(() => {
  const el = document.getElementById('preloader')
  if (!el) return true
  return getComputedStyle(el).display === 'none' || document.documentElement.classList.contains('no-preload')
})
console.log('PRELOADER_SKIPPED_ON_RELOAD', skipped)
if (!skipped) throw new Error('PRELOADER: not skipped on reload (sessionStorage gate failed)')
await page.close()

// ---------- (3) Reduced motion: completes, no canvas, no fatal errors ----------
const rmBrowser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const rmPage = await rmBrowser.newPage({ viewport: { width: 1440, height: 900 } })
attachLogs(rmPage)
const client = await rmPage.context().newCDPSession(rmPage)
await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await rmPage.goto(URL, { waitUntil: 'domcontentloaded' })
// the fallback gate is a DOM fact: under reduced motion there must be NO canvas
const rmHasCanvas = await rmPage.evaluate(() => !!document.querySelector('canvas'))
console.log('REDUCED_MOTION_HAS_CANVAS', rmHasCanvas)
if (rmHasCanvas) throw new Error('PRELOADER: reduced motion must not mount a canvas')
const rmDone = await waitFor(async () => {
  return await rmPage.evaluate(() => !document.getElementById('preloader'))
}, 15000)
console.log('REDUCED_MOTION_COMPLETED', rmDone)
if (!rmDone) throw new Error('PRELOADER: reduced-motion path did not finish')
await rmPage.close()
await rmBrowser.close()

// ---------- Fatal error scan ----------
const fatal = fatalErrors.filter((e) => !/GPU stall|ReadPixels|powerPreference|No available adapters|willReadFrequently|WebGL/i.test(e))
console.log('FATAL_ERRORS', JSON.stringify(fatal))
if (fatal.length) throw new Error('PAGE-ERRORS: ' + fatal[0])

await browser.close()
preview.kill()
process.exit(0)
