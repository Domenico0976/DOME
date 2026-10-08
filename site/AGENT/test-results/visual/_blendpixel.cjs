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
    const thumb = track.firstElementChild;
    const hr = thumb.getBoundingClientRect();
    const cx = Math.round(hr.left + hr.width / 2);
    const cy = Math.round(hr.top + hr.height - 20);
    const elAtLower = document.elementFromPoint(cx, cy);
    const shot = (x, y) => {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      return `${x},${y}`;
    };
    void shot;
    return {
      cx, cy,
      elAtLower: elAtLower ? `${elAtLower.tagName}.${elAtLower.className || ''}` : 'none',
      thumbH: Math.round(hr.height),
      scrollY: Math.round(window.scrollY),
      maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  console.log(JSON.stringify(r));
  const buf = await p.screenshot({ animations: 'disabled', timeout: 90000 });
  const { PNG } = require('pngjs');
  const fs = require('fs');
  fs.writeFileSync('AGENT/test-results/visual/blend-sample.png', buf);
  const png = PNG.sync.read(buf);
  const px = (x, y) => {
    const i = (y * png.width + x) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2]];
  };
  const t = px(r.cx, r.cy);
  const bgL = px(r.cx - 30, r.cy);
  const bgR = px(Math.min(png.width - 1, r.cx + 30), r.cy);
  console.log('thumb px: ' + JSON.stringify(t) + ' bgL: ' + JSON.stringify(bgL));
  await b.close();
})();
