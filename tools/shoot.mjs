// Capture leoespinoel.com from localhost with this repo's own Puppeteer.
// Usage: node tools/shoot.mjs intro|scroll|phone [label]
//   intro  -> the loader stepped to fixed moments (timeline paused and set by time), 1440x900
//   scroll -> viewport frames down the whole page after the intro, 1440x900
//   phone  -> viewport frames down the whole page at 390x844
// Output: ./temporary screenshots/NNN-<mode>-<label>-*.jpg . Page errors and failed requests are printed.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL || 'http://localhost:3003/';
const mode = process.argv[2] || 'scroll';
const label = process.argv[3] || '';
const OUT = path.join(ROOT, 'temporary screenshots');
fs.mkdirSync(OUT, { recursive: true });
const index = String(fs.readdirSync(OUT).map((f) => parseInt(f.slice(0, 3), 10)).filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0) + 1).padStart(3, '0');
const name = (s) => path.join(OUT, `${index}-${mode}${label ? '-' + label : ''}-${s}.jpg`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
const phone = mode === 'phone';
await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
const bad = [];
page.on('pageerror', (e) => bad.push('JS: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
await page.goto(mode === 'intro' ? URL + '?hold=1' : URL, { waitUntil: 'networkidle2' });

if (mode === 'intro') {
  await page.waitForFunction(() => !!(window.__len && window.__len.intro), { timeout: 15000 }); // a boolean: returning the timeline itself hangs Puppeteer
  await page.evaluate(() => { window.__len.intro.pause(); });
  for (const t of (process.env.TIMES || '0.6,1.2,1.9,2.6,3.0,3.3,3.5,3.9,4.4,5.0').split(',')) {
    await page.evaluate((t) => { window.__len.intro.time(+t); }, t);
    await wait(900); // tweens started by callbacks inside the timeline run in real time
    await page.screenshot({ path: name('t' + t), type: 'jpeg', quality: 72 });
  }
} else {
  // let the intro finish, then walk the page one viewport-fraction at a time
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 }).catch(() => bad.push('loader never finished'));
  await wait(1800);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = phone ? 844 : 900, step = Math.round(vh * (phone ? .9 : .75));
  console.log('page height', total);
  let i = 0;
  for (let y = 0; y < total - vh + step; y += step) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await wait(phone ? 700 : 1100);
    await page.screenshot({ path: name(String(i).padStart(2, '0') + '-y' + y), type: 'jpeg', quality: 70 });
    i++;
    if (i > 40) break;
  }
}
console.log(bad.length ? 'problems:\n  ' + bad.join('\n  ') : 'no page errors, no failed requests');
await browser.close();
