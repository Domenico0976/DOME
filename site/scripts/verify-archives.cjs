// scripts/verify-archives.cjs
const { chromium } = require('patchright')
const { spawn } = require('child_process')
const net = require('net')

const PORT = 4188
const URL = `http://127.0.0.1:${PORT}/`

function waitPort(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tryOnce = () => {
      const s = net.connect(PORT, '127.0.0.1')
      s.on('connect', () => { s.destroy(); resolve() })
      s.on('error', () => {
        s.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error('server timeout'))
        else setTimeout(tryOnce, 400)
      })
    }
    tryOnce()
  })
}

// Self-contained high-frequency stand-in image (checkerboard) so the
// velocity-scaled WebGL distortion is verifiable offline.
function makeTestPng() {
  const zlib = require('zlib')
  const W = 128, H = 128
  const raw = Buffer.alloc(H * (1 + W * 4))
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0
    for (let x = 0; x < W; x++) {
      const o = y * (1 + W * 4) + 1 + x * 4
      const cell = (Math.floor(x / 16) + Math.floor(y / 16)) % 2
      raw[o] = cell ? 235 : 25
      raw[o + 1] = cell ? 210 : 45
      raw[o + 2] = (x + y) % 32 < 16 ? 70 : 140
      raw[o + 3] = 255
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const table = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cd = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cd)); return Buffer.concat([len, cd, crc]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
  const idat = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function sampleGL(page) {
  return page.evaluate(() => {
    const gl = document.querySelector('.archive-hover-canvas__gl')
    if (!gl) return null
    const ctx = gl.getContext('webgl2') || gl.getContext('webgl')
    if (!ctx) return null
    const w = gl.width, h = gl.height, N = 16, out = []
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = Math.floor((i + 0.5) / N * w), y = Math.floor((j + 0.5) / N * h)
      const px = new Uint8Array(4)
      ctx.readPixels(x, y, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px)
      out.push(px[0], px[1], px[2], px[3])
    }
    return out
  })
}
function frameDiff(a, b) {
  if (!a || !b) return null
  let c = 0, s = 0
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    if (d > 12) { c++; s += d }
  }
  return { changed: c, avg: +(s / (c || 1)).toFixed(1) }
}

;(async () => {
  const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' })
  let browser
  const checks = {}
  try {
    await waitPort()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    // Offline test env can't reach picsum.photos; serve a local high-frequency
    // stand-in so the velocity-scaled WebGL distortion is actually exercised.
    const testPng = makeTestPng()
    await page.route(/picsum\.photos/, (route) => {
      route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: testPng })
    })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const rows = await page.evaluate(() => {
      const td = document.querySelector('.archives-table tbody td')
      const th = document.querySelector('.archives-table tbody th')
      if (!td) return null
      const tcs = getComputedStyle(td)
      const thcs = th ? getComputedStyle(th) : tcs
      return {
        padTop: parseFloat(tcs.paddingTop),
        padBottom: parseFloat(tcs.paddingBottom),
        vAlign: tcs.verticalAlign,
        thAlign: thcs.verticalAlign,
      }
    })
    checks.rowPadding = !!(rows && rows.padTop >= 30 && rows.padBottom >= 30)
    checks.rowVerticalAlign = !!(rows && rows.vAlign === 'middle' && (!rows.thAlign || rows.thAlign === 'middle'))

    const row = page.locator('.archives-table tbody tr').last()
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {})
    await page.waitForTimeout(500)
    const box = await row.boundingBox()
    const tx = box.x + box.width / 2, ty = box.y + box.height / 2
    await page.mouse.move(tx - 20, ty, { steps: 3 })
    await page.mouse.move(tx, ty, { steps: 4 })
    await page.waitForTimeout(1500)

    checks.canvasWidth340 = await page.evaluate(() => {
      const pc = document.querySelector('.pendulum-canvas')
      return !!pc && getComputedStyle(pc).width === '340px'
    })

    checks.canvasInViewport = await page.evaluate(() => {
      const pc = document.querySelector('.pendulum-canvas')
      if (!pc) return false
      const r = pc.getBoundingClientRect()
      return r.left >= -1 && r.top >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1
    })

    const idle = await sampleGL(page)
    await page.mouse.move(tx, ty, { steps: 30 })
    await page.mouse.move(tx + 5, ty, { steps: 30 })
    await page.waitForTimeout(300)
    const slowTheta = await page.evaluate(() => {
      const pc = document.querySelector('.pendulum-canvas')
      const m = pc && pc.style.transform.match(/rotate\(([-\d.]+)rad\)/)
      return m ? parseFloat(m[1]) : null
    })
    checks.slowThetaNearZero = slowTheta !== null && Math.abs(slowTheta) < 0.05
    const slowFrame = await sampleGL(page)
    checks.slowFrameSameAsIdle = !!(idle && slowFrame && frameDiff(idle, slowFrame).changed < 3)

    // ---- FAST movement: drive the pendulum, then sample across the decaying
    //      swing (no further input) so we catch the high-distortion phase and
    //      confirm the effect persists while the pendulum is still moving. ----
    for (let k = 0; k < 6; k++) {
      await page.mouse.move(tx - 80, ty, { steps: 2 })
      await page.mouse.move(tx + 80, ty, { steps: 2 })
    }
    let maxFastChanged = 0
    let maxFastTheta = 0
    for (let s = 0; s < 20; s++) {
      const f = await sampleGL(page)
      const d = frameDiff(idle, f)
      if (d) maxFastChanged = Math.max(maxFastChanged, d.changed)
      const th = await page.evaluate(() => {
        const pc = document.querySelector('.pendulum-canvas')
        const m = pc && pc.style.transform.match(/rotate\(([-\d.]+)rad\)/)
        return m ? parseFloat(m[1]) : null
      })
      if (th !== null) maxFastTheta = Math.max(maxFastTheta, Math.abs(th))
      await page.waitForTimeout(25)
    }
    checks.fastThetaLarge = maxFastTheta > 0.1
    checks.fastFrameDiffers = maxFastChanged > 5

    checks.errors = errors.length
    checks.pass = Object.entries(checks).filter(([k]) => k !== 'errors').every(([, v]) => v === true) && errors.length === 0
    console.log(JSON.stringify(checks, null, 2))
  } catch (e) {
    console.log('HARNESS ERROR', e.message)
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
  }
})()
