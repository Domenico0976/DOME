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
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const out = {};
    // all element classNames containing 'hero'
    out.heroEls = Array.from(document.querySelectorAll('[class*="hero"]')).map((e) => e.tagName + '.' + e.className).slice(0, 30);
    // walk up from the top hero canvas
    const top = document.querySelector('.gl-canvas--top');
    out.topCanvasFound = !!top;
    if (top) {
      const chain = [];
      let n = top.parentElement;
      while (n && chain.length < 8) { chain.push(n.tagName + (n.className ? '.' + n.className : '')); n = n.parentElement; }
      out.topCanvasAncestors = chain;
    }
    // any element with className containing 'shader'
    out.shaderEls = Array.from(document.querySelectorAll('[class*="shader"]')).map((e) => e.tagName + '.' + e.className).slice(0, 20);
    out.bodyChildCount = document.body.children.length;
    out.bodyFirstChildren = Array.from(document.body.children).map((e) => e.tagName + (e.className ? '.' + e.className : '')).slice(0, 12);
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('ERRORS:', JSON.stringify(errors.slice(0, 10)));
  await browser.close();
})();
