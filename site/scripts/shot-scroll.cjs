const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  p.on('pageerror', e => errs.push('PAGE:' + String(e).slice(0, 160)));
  await p.goto('http://localhost:5173/', { waitUntil: 'load' });
  await p.waitForTimeout(16000);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  console.log('DOC-H:' + h);
  for (let i = 1; i <= 6; i++) {
    await p.evaluate(y => window.scrollTo(0, y), Math.round(h * i / 7));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `C:/Users/Utente/AppData/Local/Temp/opencode/scroll-${i}.png` });
  }
  console.log('ERR:' + JSON.stringify(errs.slice(0, 8)));
  await b.close();
})();
