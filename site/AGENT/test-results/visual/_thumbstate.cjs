const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const thumb = [...document.querySelectorAll('div')].find(
      (d) => d.style && d.style.mixBlendMode === 'difference',
    );
    if (!thumb) return { found: false };
    const hr = thumb.getBoundingClientRect();
    const cx = hr.left + hr.width / 2;
    const cy = hr.top + hr.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const cs = window.getComputedStyle(thumb);
    const csT = window.getComputedStyle(thumb.parentElement);
    const chain = [];
    let n = thumb.parentElement;
    while (n && n !== document.body) {
      const c = window.getComputedStyle(n);
      chain.push(
        `${n.tagName}.${n.id || ''} disp=${c.display} vis=${c.visibility} op=${c.opacity} pos=${c.position} z=${c.zIndex} ov=${c.overflow.slice(0, 8)} clip=${c.clipPath.slice(0, 8)} cv=${c.contentVisibility}`,
      );
      n = n.parentElement;
    }
    return {
      found: true,
      rect: { x: Math.round(hr.x), y: Math.round(hr.y), w: Math.round(hr.width), h: Math.round(hr.height) },
      hit: hit ? `${hit.tagName}.${hit.id || hit.className || ''}` : 'none',
      self: `disp=${cs.display} vis=${cs.visibility} op=${cs.opacity} w=${cs.width} h=${cs.height} blend=${cs.mixBlendMode} tf=${cs.transform.slice(0, 30)}`,
      chain,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
