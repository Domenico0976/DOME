const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => {
    const all = [...document.querySelectorAll('div')].filter(
      (d) => d.style && d.style.position === 'fixed' && d.style.zIndex === '40',
    );
    const nativeBar = window.innerWidth < document.documentElement.clientWidth + 1 ? 'hidden?' : 'present?';
    return {
      fixed40: all.length,
      op: all.map((d) => `${d.style.opacity}/${d.style.visibility}`),
      scrollH: document.documentElement.scrollHeight,
      innerW: window.innerWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
  console.log(JSON.stringify(info));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'AGENT/test-results/visual/scrollbar.png', animations: 'disabled', timeout: 90000 });
  console.log('shot ok');
  await b.close();
})();
