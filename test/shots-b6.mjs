// Responsive check: captures prep + inspector at several sizes and verifies HUD blocks stay on screen and don't overlap.
// Needs server: PORT=8096 PREP_SECONDS=90 TEST_START_GOLD=150 TEST_START_ITEMS=cloud,odm
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const URL = process.env.URL || "http://localhost:8096/";
const sizes = (process.env.SIZES || "1280x720,1920x1080,2560x1440,3440x1440").split(",").map((s) => s.split("x").map(Number));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [];
for (const [w, h] of sizes) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("pageerror", (e) => errs.push(e.stack || String(e)));
  await p.goto(URL); await p.waitForSelector(".cmd"); await p.waitForTimeout(1000);
  await p.click("#solo"); await p.waitForSelector("#shop .card:not(.empty)"); await p.waitForTimeout(1500);
  for (let i = 1; i <= 4; i++) { await p.evaluate((i) => document.querySelector(`#shop .card:nth-child(${i})`)?.click(), i); await p.waitForTimeout(150); }
  await p.evaluate(() => { const y = __ui.state.you; y.traits = { JJK: 4, Support: 2, Caster: 3, AOT: 1, TG: 2, Fighter: 6, Guardian: 1, SAO: 1 }; __ui.refresh(); });
  const pos = await p.evaluate(() => __ui.cell({ bench: 0 })); await p.mouse.click(pos.x, pos.y); await p.waitForTimeout(700);
  await p.mouse.move(w / 2, h * 0.3); await p.waitForTimeout(300);
  await p.screenshot({ path: `shots/b6-${w}x${h}-layout.png` });
  const r = await p.evaluate(() => {
    const ids = ["topBar", "topRight", "synergies", "standings2", "inspector", "trayLeft", "shopWrap", "trayRight"];
    const R = Object.fromEntries(ids.map((id) => { const e = document.getElementById(id).getBoundingClientRect(); return [id, [e.left, e.top, e.right, e.bottom].map(Math.round)]; }));
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const bad = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (hit(R[ids[i]], R[ids[j]])) bad.push(ids[i] + "×" + ids[j]);
    const off = ids.filter((id) => R[id][0] < 0 || R[id][1] < 0 || R[id][2] > innerWidth + 1 || R[id][3] > innerHeight + 1);
    return { bad, off, insp: document.getElementById("inspector").className };
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await p.close();
}
console.log("errors", errs.length, errs.slice(0, 2)); await b.close();
