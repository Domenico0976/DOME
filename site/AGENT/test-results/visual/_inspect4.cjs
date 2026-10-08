const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8152';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('requestfailed', (r) => logs.push('[reqfail] ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText)));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  try { await page.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 }); } catch (e) {}
  await page.waitForTimeout(3000);
  const dom = await page.evaluate(() => {
    const section = document.querySelector('.hero-region--split');
    return {
      sectionHTMLlen: section ? section.innerHTML.length : -1,
      wrapperCount: document.querySelectorAll('.hero-shader-wrapper').length,
      frontExists: !!document.querySelector('.hero-ring-front'),
      canvasInSection: section ? section.querySelectorAll('canvas').length : -1,
    };
  });
  console.log('DOM:', JSON.stringify(dom));
  console.log('--- console/network logs ---');
  console.log(logs.join('\n'));
  await browser.close();
})();
