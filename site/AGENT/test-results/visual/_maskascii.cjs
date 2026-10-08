const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'load', timeout: 30000 });
  const out = await p.evaluate(async () => {
    const m = await import('/src/webgl-water/HeroEdgeMask.js');
    const url = m.generateHeroEdgeMask({ width: 1440, height: 900 });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, cell = 8;
    const rows = [];
    for (let ry = 40; ry < 52; ry++) {
      let line = '';
      for (let cx = 5; cx < 65; cx++) {
        const px = cx * cell + 4, py = ry * cell + 4;
        line += d[(py * W + px) * 4 + 3] > 127 ? '#' : '.';
      }
      rows.push(ry + ':' + line);
    }
    return rows.join('\n');
  });
  console.log(out);
  await b.close();
})();
