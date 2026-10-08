const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap">');
  await p.evaluate(async () => {
    await document.fonts.load('700 30px "Bricolage Grotesque"');
    await document.fonts.ready;
  });
  const r = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const out = {};
    for (const fs of [30, 44, 46, 48]) {
      c.font = '700 ' + fs + 'px "Bricolage Grotesque"';
      try { c.letterSpacing = (-0.037 * fs).toFixed(2) + 'px'; } catch (e) {}
      out['single' + fs] = Math.round(c.measureText('SOMEBODYWANT3D').width);
    }
    c.font = '700 30px "Bricolage Grotesque"';
    try { c.letterSpacing = '-1.11px'; } catch (e) {}
    out.rep30 = Math.round(c.measureText('SOMEBODYWANT3D \u2022 SOMEBODYWANT3D').width);
    out.rep24 = (() => {
      c.font = '700 24px "Bricolage Grotesque"';
      try { c.letterSpacing = '-0.89px'; } catch (e) {}
      return Math.round(c.measureText('SOMEBODYWANT3D \u2022 SOMEBODYWANT3D').width);
    })();
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
