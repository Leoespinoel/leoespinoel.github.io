// Check the hero aurora. Usage: node tools/aurora.mjs frames|hero|phone|page
//   page   -> the aurora alone as the page draws it (pictures, portrait and type hidden), every 2s, as aurora-page-N.jpg;
//             then: python tools/aurora-motion.py aurora-page-   measures whether the visitor actually sees it move
//   frames -> the raw clip at fixed times (also writes assets/aurora/aurora.jpg, the poster, from t=0)
//   hero   -> the hero at 1440x900 after the intro, at a few real-time moments incl. across the loop crossfade
//   phone  -> the same at 390x844
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL || 'http://localhost:3003/';
const mode = process.argv[2] || 'hero';
const OUT = path.join(ROOT, 'temporary screenshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const bad = [];
page.on('pageerror', (e) => bad.push('JS: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

if (mode === 'frames') {
  await page.setViewport({ width: 1344, height: 576 });
  // the clip goes in as a blob: the local server has no Range support, and without it a seek silently stays at 0
  await page.goto(URL + 'credits.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const blob = await (await fetch('assets/aurora/aurora.mp4')).blob();
    document.body.innerHTML = '<video id="v" muted style="position:fixed;inset:0;z-index:99999;display:block;width:1344px;height:576px;background:#000"></video>';
    document.getElementById('v').src = URL.createObjectURL(blob);
  });
  await page.waitForFunction(() => document.getElementById('v').readyState >= 2, { timeout: 30000 });
  const dur = await page.evaluate(() => document.getElementById('v').duration);
  console.log('duration', dur);
  for (const t of [0, 1, 2, 4, 6, dur - .1]) {
    await page.evaluate((t) => new Promise((res) => { const v = document.getElementById('v'); v.addEventListener('seeked', res, { once: true }); v.currentTime = t; }), t);
    await wait(150);
    console.log('asked', t.toFixed(2), 'got', await page.evaluate(() => document.getElementById('v').currentTime.toFixed(2)));
    await page.screenshot({ path: path.join(OUT, `aurora-frame-${t.toFixed(1)}.jpg`), type: 'jpeg', quality: 80 });
    if (t === 0) await page.screenshot({ path: path.join(ROOT, 'assets/aurora/aurora.jpg'), type: 'jpeg', quality: 72 });
  }
} else if (mode === 'page') {
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 }).catch(() => bad.push('loader never finished'));
  await page.addStyleTag({ content: '.hero > *:not(#aurora), #chrome, .rail, .cursor { visibility: hidden !important; }' });
  await wait(3200); // the fade-in has to finish or every frame differs for the wrong reason
  const t0 = Date.now();
  for (const s of [0, 2, 4, 6, 8, 10]) {
    await wait(Math.max(0, t0 + s * 1000 - Date.now()));
    await page.screenshot({ path: path.join(OUT, `aurora-page-${s.toFixed(1)}.jpg`), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1440, height: 700 } });
  }
} else {
  const phone = mode === 'phone';
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 }).catch(() => bad.push('loader never finished'));
  const state = () => page.evaluate(() => [...document.querySelectorAll('#aurora video')].map((v) => ({ t: +v.currentTime.toFixed(2), paused: v.paused, o: +getComputedStyle(v).opacity })));
  const t0 = Date.now(); // the loader has just gone
  for (const s of (process.env.TIMES || '2.5,5,7,8,10,16,17.5').split(',').map(Number)) {
    await wait(Math.max(0, t0 + s * 1000 - Date.now()));
    console.log(s + 's', JSON.stringify(await state()));
    await page.screenshot({ path: path.join(OUT, `aurora-${mode}-${s}s.jpg`), type: 'jpeg', quality: 78 });
  }
  await page.evaluate(() => window.scrollTo(0, innerHeight * 2)); await wait(900);
  console.log('off screen', JSON.stringify(await state()));
}
console.log(bad.length ? 'problems:\n  ' + bad.join('\n  ') : 'no page errors, no failed requests');
await browser.close();
