// Capture the collide beat (Podcast -> Force of Nature): wheel down the page, hurry the two earlier beats along,
// pause this one, step it by time.
// Usage: node tools/collide.mjs [label] [phone]    TIMES=0.4,1.2,... overrides the moments
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'temporary screenshots');
fs.mkdirSync(OUT, { recursive: true });
const label = process.argv[2] || 'collide', phone = process.argv[3] === 'phone';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ headless: 'new' });
const p = await b.newPage();
await p.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1440, height: 900 });
const bad = []; p.on('pageerror', (e) => bad.push('JS: ' + e.message));
await p.goto('http://localhost:3003/', { waitUntil: 'networkidle2' });
await p.waitForFunction(() => !document.getElementById('loader'), { timeout: 20000 });
await wait(1500);
await p.mouse.move(phone ? 195 : 720, 450);
let on = false;
for (let i = 0; i < 2500 && !on; i++) {
  await p.mouse.wheel({ deltaY: 100 }); await wait(30);
  on = await p.evaluate(() => {
    const L = window.__len || {};
    if (L.collide) { L.collide.pause(); return true; }
    if (L.beat && L.beat.isActive()) L.beat.timeScale(30);
    if (L.belief && L.belief.isActive()) L.belief.timeScale(30);
    return false;
  });
}
console.log('fired:', on);
if (on) {
  console.log('fon still below:', await p.evaluate(() => Math.round(document.getElementById('fon').getBoundingClientRect().top)));
  for (const t of (process.env.TIMES || '0.1,0.3,0.5,0.6,0.75,0.9,1.2,1.6,2.0,2.4,2.75').split(',')) {
    await p.evaluate((t) => { window.__len.collide.time(+t); }, t);
    await wait(350);
    await p.screenshot({ path: path.join(OUT, `${label}-t${t}.jpg`), type: 'jpeg', quality: 72 });
  }
  console.log('duration:', await p.evaluate(() => String(window.__len.collide.duration().toFixed(2))));
  await p.evaluate(() => { window.__len.collide.timeScale(6).play(); });
  await wait(2000);
  const end = await p.evaluate(() => ({ y: Math.round(scrollY), fonTop: Math.round(document.getElementById('fon').getBoundingClientRect().top), heading: document.querySelector('#fon h2').textContent, on: document.getElementById('collide').classList.contains('is-on'), vis: getComputedStyle(document.getElementById('collide')).visibility }));
  console.log('after:', JSON.stringify(end));
  await p.screenshot({ path: path.join(OUT, `${label}-after.jpg`), type: 'jpeg', quality: 72 });
  const y0 = end.y; for (let i = 0; i < 8; i++) { await p.mouse.wheel({ deltaY: 100 }); await wait(60); } await wait(600);
  console.log('scroll still works:', (await p.evaluate(() => Math.round(scrollY))) > y0);
}
console.log(bad.length ? bad.join('\n') : 'no JS errors');
await b.close();
