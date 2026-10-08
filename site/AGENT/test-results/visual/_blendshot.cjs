const { chromium } = require('playwright');
const fs = require('fs');
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
    const track = thumb.parentElement;
    const hr = thumb.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    return {
      cx: Math.round(hr.left + hr.width / 2),
      top: Math.round(hr.top),
      h: Math.round(hr.height),
      trackTop: Math.round(tr.top),
      trackH: Math.round(tr.height),
      trackZ: track.style.zIndex || '(none)',
      thumbZ: thumb.style.zIndex || '(none)',
    };
  });
  fs.writeFileSync('AGENT/test-results/visual/_coords.json', JSON.stringify(r));
  await p.screenshot({ path: 'AGENT/test-results/visual/_blendshot.png', animations: 'disabled', timeout: 90000 });
  console.log('saved ' + JSON.stringify(r));
  await b.close();
})();
