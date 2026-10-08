const { chromium } = require('playwright');
const fs = require('fs');
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
    const probe = document.createElement('div');
    probe.id = 'blend-probe';
    probe.style.cssText =
      'position:fixed;left:1400px;top:400px;width:30px;height:30px;background:#fff;' +
      'mix-blend-mode:difference;z-index:99999;pointer-events:none;';
    document.body.appendChild(probe);
    const elAt = document.elementFromPoint(1415, 415);
    const chain = [];
    let n = thumb;
    while (n && n !== document.documentElement) {
      const cs = window.getComputedStyle(n);
      chain.push(
        `${n.tagName}[iso=${cs.isolation} filt=${cs.filter} tf=${cs.transform} op=${cs.opacity} blend=${cs.mixBlendMode} contain=${cs.contain} mask=${cs.maskImage.slice(0, 12)} clip=${cs.clipPath.slice(0, 10)} persp=${cs.perspective}]`,
      );
      n = n.parentElement;
    }
    const csRoot = window.getComputedStyle(document.documentElement);
    chain.push(`HTML[iso=${csRoot.isolation} filt=${csRoot.filter} tf=${csRoot.transform} op=${csRoot.opacity}]`);
    return {
      elAt: elAt ? `${elAt.tagName}#${elAt.id}.${elAt.className || ''}` : 'none',
      chain,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await p.screenshot({ path: 'AGENT/test-results/visual/_blendprobe.png', animations: 'disabled', timeout: 90000 });
  fs.writeFileSync(
    'AGENT/test-results/visual/_coords2.json',
    JSON.stringify({ probe: { x: 1415, y: 415 } }),
  );
  console.log('shot ok');
  await b.close();
})();
