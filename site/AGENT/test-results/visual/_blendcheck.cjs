const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const track = [...document.querySelectorAll('div')].find(
      (d) => d.style && d.style.position === 'fixed' && d.style.zIndex === '40',
    );
    if (!track) return { found: false };
    const thumb = track.firstElementChild;
    const tr = track.getBoundingClientRect();
    const hr = thumb.getBoundingClientRect();
    const cx = hr.left + hr.width / 2;
    const cy = hr.top + hr.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    const stack = [];
    let el = topEl;
    for (let i = 0; i < 4 && el; i++) {
      const cs = window.getComputedStyle(el);
      stack.push(`${el.tagName}.${(el.className && el.className.baseVal !== undefined ? '' : el.className) || ''} z=${cs.zIndex} blend=${cs.mixBlendMode} op=${cs.opacity} pos=${cs.position}`);
      el = el.parentElement;
    }
    const chain = [];
    let n = topEl;
    while (n && n !== document.body) {
      const cs = window.getComputedStyle(n);
      chain.push(`${n.tagName}[iso=${cs.isolation} filt=${cs.filter} tf=${cs.transform} op=${cs.opacity} blend=${cs.mixBlendMode}]`);
      n = n.parentElement;
    }
    return {
      found: true,
      trackTop: Math.round(tr.top),
      trackH: Math.round(tr.height),
      thumbTop: Math.round(hr.top),
      thumbH: Math.round(hr.height),
      thumbBlend: window.getComputedStyle(thumb).mixBlendMode,
      topEl: topEl ? topEl.tagName : 'none',
      stack,
      chain,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
