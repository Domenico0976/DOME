const { chromium } = require('playwright');

const VIEWS = [
  { w: 375, h: 812, name: 'mobile' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 1440, h: 900, name: 'desktop' },
];
const OUT = 'AGENT/test-results/visual';
const URL = 'http://localhost:8151';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      let preloaderGone = false;
      try {
        await page.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 });
        preloaderGone = true;
      } catch (e) { preloaderGone = false; }
      await page.waitForTimeout(1800);
      const info = await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        return {
          canvasCount: canvases.length,
          heroCanvas: canvases.some(c => (c.width > 100 && c.height > 100)),
        };
      });
      await page.screenshot({ path: `${OUT}/hero-ring-${v.name}-${v.w}.png`, fullPage: false });
      console.log(`[${v.name} ${v.w}] preloaderGone=${preloaderGone} canvasCount=${info.canvasCount} heroCanvas=${info.heroCanvas} errors=${errors.length}`);
      if (errors.length) console.log('   ERRORS:', JSON.stringify(errors.slice(0, 5)));
    } catch (e) {
      console.log(`[${v.name} ${v.w}] FATAL: ${e.message}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log('DONE');
})();
