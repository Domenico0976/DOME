const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const fps = (ms) => p.evaluate(async (dur) => {
    const t0 = performance.now();
    let frames = 0;
    await new Promise((res) => {
      const loop = () => {
        frames += 1;
        if (performance.now() - t0 < dur) requestAnimationFrame(loop);
        else res();
      };
      requestAnimationFrame(loop);
    });
    return +(((performance.now() - t0), frames / ((performance.now() - t0) / 1000)).toFixed(1));
  }, ms);
  console.log('with-mask fps=' + await fps(6000));
  await p.evaluate(() => {
    const el = document.querySelector('.hero-region');
    el.style.webkitMaskImage = 'none';
    el.style.maskImage = 'none';
  });
  await p.waitForTimeout(1000);
  console.log('no-mask fps=' + await fps(6000));
  await b.close();
})();
