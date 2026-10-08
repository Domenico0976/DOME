const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'load', timeout: 30000 });
  const r = await p.evaluate(async () => {
    const m = await import('/src/webgl-water/HeroEdgeMask.js');
    const url = m.generateHeroEdgeMask({ width: 1440, height: 900 });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const rows = [];
    for (let ry = 0; ry < H; ry += 4) {
      let n = 0;
      for (let cx = 0; cx < W; cx += 2) if (d[(ry * W + cx) * 4 + 3] > 127) n++;
      rows.push([ry, +(n / (W / 2)).toFixed(2)]);
    }
    // connected-component size sample: mean opaque run length per sampled row (cell size proxy)
    const runs = [];
    for (let ry = 0; ry < H; ry += 8) {
      let run = 0;
      for (let cx = 0; cx < W; cx++) {
        if (d[(ry * W + cx) * 4 + 3] > 127) run++;
        else if (run > 0) { runs.push([ry, run]); run = 0; }
      }
      if (run > 0) runs.push([ry, run]);
    }
    const byRow = {};
    for (const [ry, len] of runs) { (byRow[ry] = byRow[ry] || []).push(len); }
    const mean = {};
    for (const k of Object.keys(byRow)) {
      const a = byRow[k];
      mean[k] = +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1);
    }
    return { w: W, h: H, density: rows, meanRun: mean };
  });
  console.log('SIZE ' + r.w + 'x' + r.h);
  console.log('DENSITY ' + JSON.stringify(r.density));
  console.log('MEANRUN ' + JSON.stringify(r.meanRun));
  await b.close();
})();
