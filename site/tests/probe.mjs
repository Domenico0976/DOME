// Short throwaway probe: capture ONLY console + pageerror (both come from the
// main world, so the isolated-world problem does not apply).
// node tests/probe.mjs
import { chromium } from 'patchright'
import { spawn } from 'node:child_process'

const PORT = 4193
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'pipe',
})
await new Promise((r) => setTimeout(r, 3000))

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const seen = []
page.on('pageerror', (e) => seen.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  const t = m.text()
  if (/glass|preloader|shape|SVG|Room|PMREM/i.test(t)) {
    seen.push(m.type() + ': ' + t.slice(0, 220))
  }
})
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 5000))
console.log('CONSOLE', JSON.stringify(seen.slice(0, 14), null, 1))
await browser.close()
preview.kill()
process.exit(0)
