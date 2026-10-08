const zlib = require('zlib');
function decodePNG(buf) {
  let p = 8, width = 0, height = 0, colorType = 0, bitDepth = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : (() => { throw new Error('ct'); })();
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const ft = raw[y * (stride + 1)]; const row = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[row + x]; const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0; const c = (x >= channels && y > 0) ? out[(y - 1) * stride + x - channels] : 0;
      let val; if (ft === 0) val = v; else if (ft === 1) val = v + a; else if (ft === 2) val = v + b; else if (ft === 3) val = v + ((a + b) >> 1); else if (ft === 4) val = v + paeth(a, b, c); else throw new Error('f' + ft);
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, channels, data: out };
}
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8151';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.waitForFunction(() => !document.getElementById('preloader'), { timeout: 25000 }); } catch (e) {}
  await page.waitForTimeout(1600);
  const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
  const s0 = await page.screenshot();
  await page.waitForTimeout(800);
  const s1 = await page.screenshot();
  const a = decodePNG(s0), b = decodePNG(s1);
  const w = a.width, h = a.height, ch = a.channels;
  // bottom band of the ring (y 230..400 in hero px, near centre x)
  const x0 = Math.floor(w * 0.35), x1 = Math.floor(w * 0.65);
  let whiteBottom = 0, nonWhiteLum = [], whiteTop = 0;
  for (let y = 230; y < 402; y++) for (let x = x0; x < x1; x++) {
    const i = y * w * ch + x * ch; const lum = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3;
    if (a.data[i] > 200 && a.data[i + 1] > 200 && a.data[i + 2] > 200) whiteBottom++;
    else if (lum < 200) nonWhiteLum.push(lum);
  }
  for (let y = 20; y < 200; y++) for (let x = x0; x < x1; x++) {
    const i = y * w * ch + x * ch; if (a.data[i] > 200 && a.data[i + 1] > 200 && a.data[i + 2] > 200) whiteTop++;
  }
  const nw = nonWhiteLum.length || 1;
  const meanNW = nonWhiteLum.reduce((s, v) => s + v, 0) / nw;
  const stdevNW = Math.sqrt(nonWhiteLum.reduce((s, v) => s + (v - meanNW) ** 2, 0) / nw);
  // orbit motion
  let changed = 0; const TH = 18;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w * ch + x * ch; const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    if (d > TH) changed++;
  }
  console.log(`canvasCount=${canvasCount} errors=${errors.length}`);
  if (errors.length) console.log('ERRORS:', JSON.stringify(errors.slice(0, 6)));
  console.log(`whiteBottomBand=${whiteBottom} whiteTop=${whiteTop} nonWhiteMean=${meanNW.toFixed(1)} nonWhiteStdev=${stdevNW.toFixed(1)} (front-canvas transparency: high stdev => transparent/ok, ~0 => opaque black)`);
  console.log(`orbitChangedPixels=${changed} ratio=${(changed / (w * h) * 100).toFixed(3)}% ${changed > w * h * 0.002 ? 'ORBIT_OK' : 'STATIC'}`);
  await browser.close();
})();
