const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.type() + ': ' + m.text().slice(0, 120)); });
  await p.goto('http://[::1]:8151/', { waitUntil: 'load', timeout: 30000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const hero = document.querySelector('.hero-region');
    const r = hero ? hero.getBoundingClientRect() : null;
    return {
      canvasCount: canvases.length,
      sizes: canvases.map((c) => [c.width, c.height]),
      heroTop: r ? Math.round(r.top) : null,
      webgl: (() => { try { const t = document.createElement('canvas'); return !!t.getContext('webgl2'); } catch { return false; } })(),
    };
  });
  console.log('INFO ' + JSON.stringify(info));
  console.log('LOGS ' + JSON.stringify(logs.slice(0, 8)));
  await p.screenshot({ path: 'AGENT/test-results/visual/hero-ring-band.png' });
  await b.close();
})();
