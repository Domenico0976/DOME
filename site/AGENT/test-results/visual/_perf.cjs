const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const phase = (label, ms) => p.evaluate(async (args) => {
    const [lab, dur] = args;
    const tasks = [];
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) tasks.push(Math.round(e.duration));
    });
    obs.observe({ entryTypes: ['longtask'] });
    let frames = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const loop = () => {
        frames += 1;
        if (performance.now() - t0 < dur) requestAnimationFrame(loop);
        else res();
      };
      requestAnimationFrame(loop);
    });
    const dt = (performance.now() - t0) / 1000;
    obs.disconnect();
    const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1;
    return `${lab}: fps=${(frames / dt).toFixed(1)} longtasks=${tasks.length} total=${tasks.reduce((a, x) => a + x, 0)}ms max=${tasks.length ? Math.max(...tasks) : 0}ms heapMB=${heap}`;
  }, [label, ms]);
  console.log(await phase('A-hero-visible', 8000));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(3000);
  console.log(await phase('B-away', 8000));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(3000);
  console.log(await phase('C-back', 8000));
  await b.close();
})();
