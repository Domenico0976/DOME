const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => {
    const thumb = [...document.querySelectorAll('div')].find(
      (d) => d.style && d.style.mixBlendMode === 'difference',
    );
    const hr = thumb.getBoundingClientRect();
    thumb.id = 'sb-t';
    return { y: Math.round(hr.top + hr.height / 2) };
  });
  await p.screenshot({ path: 'AGENT/test-results/visual/_rowA.png', animations: 'disabled', timeout: 90000 });
  await p.evaluate(() => {
    document.getElementById('sb-t').style.display = 'none';
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: 'AGENT/test-results/visual/_rowB.png', animations: 'disabled', timeout: 90000 });
  fs.writeFileSync('AGENT/test-results/visual/_coords4.json', JSON.stringify(info));
  console.log('done ' + JSON.stringify(info));
  await b.close();
})();
