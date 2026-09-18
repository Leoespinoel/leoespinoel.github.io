// Capture the Colyn quote beat: wheel down out of About me until it fires, pause it, step it by time.
// Usage: node tools/beat.mjs [label] [phone]    TIMES=0.4,1.2,... overrides the moments
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'temporary screenshots');
fs.mkdirSync(OUT, { recursive: true });
const label = process.argv[2] || 'beat', phone = process.argv[3] === 'phone';
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
for (let i = 0; i < 400 && !on; i++) {
  await p.mouse.wheel({ deltaY: 100 }); await wait(45);
  on = await p.evaluate(() => { const t = window.__len && window.__len.beat; if (t) { t.pause(); return true; } return false; }); // a boolean, never the timeline
}
console.log('fired:', on);
if (on) {
  for (const t of (process.env.TIMES || '0.5,1.3,1.9,2.3,2.7,3.2,4.0,4.4').split(',')) {
    await p.evaluate((t) => { window.__len.beat.time(+t); }, t);
    await wait(350);
    await p.screenshot({ path: path.join(OUT, `${label}-t${t}.jpg`), type: 'jpeg', quality: 72 });
  }
  console.log('duration:', await p.evaluate(() => String(window.__len.beat.duration().toFixed(2))));
  // let it finish and check the page is usable again
  await p.evaluate(() => { window.__len.beat.timeScale(6).play(); });
  await wait(1500);
  const end = await p.evaluate(() => ({ y: Math.round(scrollY), musicTop: Math.round(document.getElementById('music').getBoundingClientRect().top), on: document.getElementById('beat').classList.contains('is-on'), vis: getComputedStyle(document.getElementById('beat')).visibility }));
  console.log('after:', JSON.stringify(end));
  await p.screenshot({ path: path.join(OUT, `${label}-after.jpg`), type: 'jpeg', quality: 72 });
  const y0 = end.y; for (let i = 0; i < 8; i++) { await p.mouse.wheel({ deltaY: 100 }); await wait(60); } await wait(600);
  console.log('scroll still works:', (await p.evaluate(() => Math.round(scrollY))) > y0);
}
console.log(bad.length ? bad.join('\n') : 'no JS errors');
await b.close();
