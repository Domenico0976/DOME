const { chromium } = require('playwright')

const URL = 'http://localhost:8152'

;(async () => {
  const browser = await chromium.launch({
    args: [
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors = []
  const pageErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto(URL, { waitUntil: 'domcontentloaded' })

  // Expand a project so the WebGL tile-reveal frames mount.
  await page.waitForSelector('.project-row', { timeout: 15000 })
  await page.click('.project-row', { force: true })

  await page.waitForSelector('.gl-frame__canvas', { state: 'visible', timeout: 15000 })
  // Let the reveal settle.
  await page.waitForTimeout(2500)
  // Move the pointer so the graded push engages.
  await page.mouse.move(700, 450)
  await page.waitForTimeout(400)

  const img = page.locator('.project-expanded__img').first()
  await img.waitFor({ state: 'attached', timeout: 10000 })

  const info = await img.evaluate((el) => {
    const cs = getComputedStyle(el)
    const canvas = el.parentElement?.querySelector('.gl-frame__canvas')
    const ccs = canvas ? getComputedStyle(canvas) : null
    const cb = canvas ? canvas.getBoundingClientRect() : null
    const ib = el.getBoundingClientRect()
    return {
      tag: el.tagName,
      opacity: cs.opacity,
      mixBlendMode: cs.mixBlendMode,
      display: cs.display,
      visibility: cs.visibility,
      imgBox: { x: Math.round(ib.x), y: Math.round(ib.y), w: Math.round(ib.width), h: Math.round(ib.height) },
      canvasDisplay: ccs ? ccs.display : null,
      canvasBox: cb ? { x: Math.round(cb.x), y: Math.round(cb.y), w: Math.round(cb.width), h: Math.round(cb.height) } : null,
    }
  })

  await page.screenshot({ path: require('path').join(__dirname, 'visual', 'blend-check.png'), fullPage: false })

  console.log(JSON.stringify({ info, consoleErrors, pageErrors }, null, 2))

  await browser.close()
})().catch((e) => { console.error('SCRIPT_ERROR', e); process.exit(1) })
