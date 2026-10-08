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
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const wrap = document.querySelectorAll('.hero-shader-wrapper');
    const front = document.querySelector('.hero-ring-front');
    const canvases = Array.from(document.querySelectorAll('canvas')).map((c) => ({
      cls: c.className, w: c.width, h: c.height,
      parentCls: c.parentElement ? c.parentElement.className : null,
    }));
    return {
      canvasCount: canvases.length,
      wrapperCount: wrap.length,
      frontExists: !!front,
      frontInnerHTMLLen: front ? front.innerHTML.length : -1,
      frontHasCanvas: front ? !!front.querySelector('canvas') : false,
      frontChildren: front ? Array.from(front.children).map((c) => c.tagName + '.' + c.className) : [],
      canvases,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
