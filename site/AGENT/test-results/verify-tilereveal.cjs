const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const outDir = path.resolve('AGENT/test-results/visual');
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(e.message));

  await page.goto('http://localhost:8152', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.project-row', { timeout: 15000 });

  // Expand the first project -> triggers initWebGL + reveal
  await page.click('.project-row', { force: true, timeout: 8000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('.gl-frame__canvas');
    return c && getComputedStyle(c).display !== 'none';
  }, { timeout: 15000 }).catch(() => console.log('WARN: canvas never became visible (fallback?)'));

  await page.waitForTimeout(3500); // let the reveal sweep play out

  const frame = await page.$('.gl-frame');
  let box = null;
  if (frame) {
    box = await frame.boundingBox();
    // Centre push
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    // Bottom-right corner (edge taper / fabric test)
    await page.mouse.move(box.x + box.width * 0.92, box.y + box.height * 0.92, { steps: 12 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, 'tilereveal-uv-edge-br.png') });
    // Top-left corner (other edge)
    await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.08, { steps: 12 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, 'tilereveal-uv-edge-tl.png') });
  }

  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2));
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2));
  console.log('CANVAS_BOX:', JSON.stringify(box));
  await browser.close();
})().catch(e => { console.error('SCRIPT_FAIL', e); process.exit(1); });
