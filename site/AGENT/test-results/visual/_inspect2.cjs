const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8152';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 }); } catch (e) {}
  // poll up to 10s for the lazy HeroShaderStack + front ring to mount
  let appeared = -1;
  for (let i = 0; i < 20; i++) {
    const has = await page.evaluate(() => !!document.querySelector('.hero-ring-front'));
    if (has) { appeared = i * 500; break; }
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const wrappers = document.querySelectorAll('.hero-shader-wrapper');
    const front = document.querySelector('.hero-ring-front');
    const canvases = Array.from(document.querySelectorAll('canvas')).map((c) => c.className);
    // hero region subtree
    const region = document.querySelector('.hero-region--split') || document.querySelector('.hero');
    return {
      wrapperCount: wrappers.length,
      wrapperClasses: Array.from(wrappers).map((w) => w.className),
      frontExists: !!front,
      frontChildren: front ? Array.from(front.children).map((c) => c.tagName + '.' + c.className) : [],
      frontCanvas: front ? (front.querySelector('canvas') ? front.querySelector('canvas').className : null) : null,
      canvasCount: canvases.length,
      canvasClasses: canvases,
      regionHTMLlen: region ? region.innerHTML.length : -1,
    };
  });
  console.log('frontRingAppearedAfterMs:', appeared);
  console.log(JSON.stringify(info, null, 2));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
