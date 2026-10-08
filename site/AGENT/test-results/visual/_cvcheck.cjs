const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const snap = (label) => p.evaluate((lab) => {
    const hero = document.querySelector('.hero-region');
    const r = hero.getBoundingClientRect();
    return `${lab}: scrollH=${document.documentElement.scrollHeight} heroH=${Math.round(r.height)} heroTop=${Math.round(r.top)}`;
  }, label);
  console.log(await snap('top'));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(2500);
  console.log(await snap('away'));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(2500);
  console.log(await snap('back'));
  await p.screenshot({ path: 'AGENT/test-results/visual/hero-back.png', animations: 'disabled', timeout: 90000 });
  console.log('shot ok');
  await b.close();
})();
