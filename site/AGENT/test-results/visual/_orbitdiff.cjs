const zlib = require('zlib');

function decodePNG(buf) {
  // minimal PNG decoder: 8-bit, color type 2 (RGB) or 6 (RGBA)
  let p = 8;
  let width = 0, height = 0, colorType = 0, bitDepth = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth + ' unsupported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : (() => { throw new Error('colorType ' + colorType); })();
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)];
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[row + x];
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= channels && y > 0) ? out[(y - 1) * stride + x - channels] : 0;
      let val;
      if (ft === 0) val = v; else if (ft === 1) val = v + a; else if (ft === 2) val = v + b;
      else if (ft === 3) val = v + ((a + b) >> 1); else if (ft === 4) val = v + paeth(a, b, c); else throw new Error('filter ' + ft);
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

const { chromium } = require('playwright');
const URL = 'http://localhost:8151';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 }); } catch (e) {}
  await page.waitForTimeout(1600); // let fade-in finish
  const handle = await page.evaluateHandle(() => {
    const cs = [...document.querySelectorAll('canvas')].filter(c => c.width > 100 && c.height > 100);
    cs.sort((a, b) => b.width * b.height - a.width * a.height); return cs[0];
  });
  const el = handle.asElement();
  if (!el) { console.log('NO_CANVAS'); await browser.close(); return; }
  const s0 = await el.screenshot();
  await page.waitForTimeout(800); // ring should move (speed 0.8) with no mouse input
  const s1 = await el.screenshot();
  const a = decodePNG(s0), b = decodePNG(s1);
  const w = a.width, h = a.height, ch = a.channels;
  let changed = 0, sumx = 0, sumy = 0; const TH = 18;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w * ch + x * ch;
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > TH) { changed++; sumx += x; sumy += y; }
  }
  const total = w * h;
  console.log(`canvas ${w}x${h} ch=${ch}`);
  console.log(`changedPixels=${changed} ratio=${(changed / total * 100).toFixed(3)}% centroid=(${(sumx / Math.max(1, changed)).toFixed(0)},${(sumy / Math.max(1, changed)).toFixed(0)})`);
  console.log(changed > total * 0.002 ? 'ORBIT_MOTION_DETECTED' : 'MOTION_TOO_SMALL/STATIC');
  await browser.close();
})();
