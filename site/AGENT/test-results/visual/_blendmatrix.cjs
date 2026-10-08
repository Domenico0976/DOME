const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://[::1]:8151/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('preloader'), { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    const mk = (id, parent, css) => {
      const d = document.createElement('div');
      d.id = id;
      d.style.cssText = css;
      parent.appendChild(d);
      return d;
    };
    const body = document.body;
    mk('pa', body, 'position:fixed;left:100px;top:400px;width:30px;height:30px;background:#fff;mix-blend-mode:difference;z-index:99999;');
    const wrapB = mk('wb', body, 'position:fixed;left:200px;top:400px;width:30px;height:30px;z-index:40;');
    mk('pb', wrapB, 'position:absolute;left:0;top:0;width:30px;height:30px;background:#fff;mix-blend-mode:difference;');
    mk('pc', body, 'position:fixed;left:300px;top:400px;width:30px;height:30px;background:#fff;mix-blend-mode:difference;transform:translateY(10px);');
    mk('pd', body, 'position:fixed;left:400px;top:400px;width:30px;height:30px;background:#fff;mix-blend-mode:difference;border-radius:999px;');
  });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'AGENT/test-results/visual/_matrix.png', animations: 'disabled', timeout: 90000 });
  console.log('shot ok');
  await b.close();
})();
