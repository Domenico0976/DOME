const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  const r = await p.evaluate(async () => {
    const tasks = [];
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const attr = (e.attribution || []).map((a) => `${a.name || ''}@${(a.containerSrc || '').slice(-40)}`).join('|');
        tasks.push(`${Math.round(e.duration)}ms [${attr.slice(0, 160)}]`);
      }
    });
    obs.observe({ entryTypes: ['longtask'] });
    await new Promise((res) => setTimeout(res, 20000));
    obs.disconnect();
    tasks.sort((a, c) => parseInt(c) - parseInt(a));
    return tasks.slice(0, 12);
  });
  console.log(r.join('\n'));
  await b.close();
})();
