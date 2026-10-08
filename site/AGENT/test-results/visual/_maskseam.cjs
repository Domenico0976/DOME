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
    const W = c.width, H = c.height, cell = 8;
    const rep = [];
    for (const col of [10, 30, 45, 60, 80]) {
      const px = col * cell + 4;
      let firstT = -1;
      for (let y = 0; y < H; y++) {
        if (d[(y * W + px) * 4 + 3] < 128) { firstT = y; break; }
      }
      let band = '';
      for (let y = Math.max(0, firstT - 6); y < Math.min(H, firstT + 14); y++) {
        band += d[(y * W + px) * 4 + 3] > 127 ? '#' : '.';
      }
      rep.push('col' + col + ' firstT=' + firstT + ' [' + band + ']');
    }
    return rep.join('\n');
  });
  console.log(out);
  await b.close();
})();
