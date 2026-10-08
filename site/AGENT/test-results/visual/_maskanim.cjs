const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const r = await p.evaluate(async () => {
    const m = await import('/src/webgl-water/HeroEdgeMask.js');
    const t0 = performance.now();
    const a = m.generateHeroEdgeMask({ width: 1440, height: 900, frame: 0 });
    const t1 = performance.now();
    const b2 = m.generateHeroEdgeMask({ width: 1440, height: 900, frame: 0 });
    const c = m.generateHeroEdgeMask({ width: 1440, height: 900, frame: 7 });
    const d = m.generateHeroEdgeMask({ width: 1440, height: 900, frame: 40 });
    const t2 = performance.now();
    return {
      regenMs: +(t1 - t0).toFixed(1),
      det: a === b2,
      moves: a !== c,
      loopClosed: a === d,
      len: a.length,
    };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
