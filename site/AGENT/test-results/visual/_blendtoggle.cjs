const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const coords = await p.evaluate(() => {
    const track = [...document.querySelectorAll('div')].find(
      (d) => d.style && d.style.position === 'fixed' && d.style.zIndex === '40',
    );
    const thumb = track.firstElementChild;
    const hr = thumb.getBoundingClientRect();
    thumb.id = 'sb-thumb-probe';
    return { cx: Math.round(hr.left + hr.width / 2), y: Math.round(hr.top + hr.height - 10) };
  });
  fs.writeFileSync('AGENT/test-results/visual/_coords3.json', JSON.stringify(coords));
  await p.screenshot({ path: 'AGENT/test-results/visual/_with.png', animations: 'disabled', timeout: 90000 });
  await p.evaluate(() => {
    document.getElementById('sb-thumb-probe').style.display = 'none';
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'AGENT/test-results/visual/_without.png', animations: 'disabled', timeout: 90000 });
  console.log('done ' + JSON.stringify(coords));
  await b.close();
})();
