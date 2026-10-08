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
    const hr = thumb.getBoundingClientRect();
    const cx = hr.left + hr.width / 2;
    const cy = hr.top + hr.height / 2;
    const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => {
      const cs = window.getComputedStyle(el);
      return `${el.tagName}.${(el.className && el.className.baseVal === undefined ? el.className : '') || el.id || ''} pe=${cs.pointerEvents} pos=${cs.position} z=${cs.zIndex} op=${cs.opacity} vis=${cs.visibility}`;
    });
    const cs = window.getComputedStyle(thumb);
    return {
      cx: Math.round(cx), cy: Math.round(cy),
      thumbPE: cs.pointerEvents,
      thumbOpacity: cs.opacity,
      thumbVis: cs.visibility,
      stack,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
