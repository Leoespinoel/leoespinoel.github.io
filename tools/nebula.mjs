// Check the newsletter nebula. Usage: node tools/nebula.mjs frames|page|news|phone   (SRC=path/to/clip.mp4 for frames)
//   frames -> the raw clip at fixed times as nebula-frame-N.jpg (LABEL=... changes the prefix)
//   page   -> the nebula alone as the page draws it (type and form hidden), every 2s, as nebula-page-N.jpg
//   news   -> the newsletter section at 1440x900 at a few real-time moments incl. across the loop crossfade
//   phone  -> the same at 390x844
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.URL || 'http://localhost:3003/';
const mode = process.argv[2] || 'news';
const OUT = path.join(ROOT, 'temporary screenshots');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const bad = [];
page.on('pageerror', (e) => bad.push('JS: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

if (mode === 'frames') {
  const src = process.env.SRC || 'assets/nebula/nebula.mp4', label = process.env.LABEL || 'nebula-frame';
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(URL + 'credits.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (src) => {
    const blob = await (await fetch(src)).blob();
    document.body.innerHTML = '<video id="v" muted style="position:fixed;inset:0;z-index:99999;display:block;width:1280px;height:720px;background:#000"></video>';
    document.getElementById('v').src = URL.createObjectURL(blob);
  }, src);
  await page.waitForFunction(() => document.getElementById('v').readyState >= 2, { timeout: 30000 });
  const dur = await page.evaluate(() => document.getElementById('v').duration);
  console.log('duration', dur);
  for (const t of [0, 1, 2, 4, 6, dur - .1]) {
    await page.evaluate((t) => new Promise((res) => { const v = document.getElementById('v'); v.addEventListener('seeked', res, { once: true }); v.currentTime = t; }), t);
    await wait(150);
    await page.screenshot({ path: path.join(OUT, `${label}-${t.toFixed(1)}.jpg`), type: 'jpeg', quality: 80 });
  }
} else {
  const phone = mode === 'phone';
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 }).catch(() => bad.push('loader never finished'));
  await wait(800);
  // the site's own Newsletter link: a menu jump is the one route that skips both timed beats on the way down
  await page.evaluate(() => document.querySelector('.menu__foot a[href="#newsletter"]').click());
  if (mode === 'page') await page.addStyleTag({ content: '.news > *:not(#nebula), #chrome, .rail, .cursor, .beat { visibility: hidden !important; }' });
  await wait(3200);
  console.log('section top:', await page.evaluate(() => Math.round(document.getElementById('newsletter').getBoundingClientRect().top)));
  const state = () => page.evaluate(() => [...document.querySelectorAll('#nebula video')].map((v) => ({ t: +v.currentTime.toFixed(2), paused: v.paused, o: +getComputedStyle(v).opacity })));
  const t0 = Date.now();
  for (const s of (process.env.TIMES || (mode === 'page' ? '0,2,4,6,8,10' : '0,3,5.5,7,10')).split(',').map(Number)) {
    await wait(Math.max(0, t0 + s * 1000 - Date.now()));
    console.log(s + 's', JSON.stringify(await state()));
    await page.screenshot({ path: path.join(OUT, `nebula-${mode}-${s.toFixed(1)}.jpg`), type: 'jpeg', quality: 80 });
  }
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(900);
  console.log('off screen', JSON.stringify(await state()));
}
console.log(bad.length ? 'problems:\n  ' + bad.join('\n  ') : 'no page errors, no failed requests');
await browser.close();
