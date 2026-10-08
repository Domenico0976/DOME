const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = [];
  p.on('response', async (r) => {
    try {
      const h = await r.headerValue('content-length').catch(() => null);
      reqs.push({ url: r.url().split('/').pop().split('?')[0], bytes: h ? +h : 0, status: r.status() });
    } catch { /* ignore */ }
  });
  const t0 = Date.now();
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 60000 }).catch(() => 'PRELOADER-STUCK');
  const gone = Date.now() - t0;
  await p.waitForTimeout(2000);
  reqs.sort((a, z) => z.bytes - a.bytes);
  const total = reqs.reduce((s, r) => s + r.bytes, 0);
  console.log(`preloader-gone ms=${gone} requests=${reqs.length} bytes=${total}`);
  console.log('TOP ' + JSON.stringify(reqs.slice(0, 12)));
  await p.screenshot({ path: 'AGENT/test-results/visual/hero-opt.png', animations: 'disabled', timeout: 90000 });
  console.log('shot ok');
  await b.close();
})();
