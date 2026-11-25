// Full-state capture for Batch 6. Needs: PORT=8096 PREP_SECONDS=90 TEST_START_GOLD=150 TEST_START_ITEMS=cloud,odm
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const URL = process.env.URL || "http://localhost:8096/";
const [w, h] = (process.env.SIZE || "1280x720").split("x").map(Number); const tag = `${w}x${h}`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: w, height: h } });
const errs = []; p.on("pageerror", (e) => errs.push(e.stack || String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
const shot = (n) => p.screenshot({ path: `shots/b6-${tag}-${n}.png` });
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) process.exitCode = 1; };
const tc = (sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
await p.goto(URL); await p.waitForSelector(".cmd"); await p.waitForTimeout(1000);
await p.click("#solo"); await p.waitForSelector("#shop .card:not(.empty)"); await p.waitForTimeout(1500);
await shot("prep");
const icons = await p.evaluate(async () => { const ids = __ui.ids(); const r = await Promise.all(ids.map((id) => new Promise((res) => { const i = new Image(); i.onload = () => res([id, i.naturalWidth, i.naturalHeight]); i.onerror = () => res([id, 0, 0]); i.src = `art/ui/abilities/${id}.png`; }))); return r; });
ok(icons.length === 37, `roster has ${icons.length} species (ability art is not supplied yet; role icon fallback used)`);
await p.mouse.move(w / 2, h - 90); await p.hover("#shop .card:nth-child(2)"); await p.waitForTimeout(500); await shot("tooltip"); await p.mouse.move(w / 2, 200);
for (let i = 0; i < 3; i++) { await tc("#xp"); await p.waitForTimeout(100); }
for (let r = 0; r < 10; r++) {
  for (let i = 1; i <= 5; i++) { await tc(`#shop .card:nth-child(${i}):not(.empty):not(.poor)`); await p.waitForTimeout(120); }
  if ((await p.evaluate(() => __ui.state.you.units.length)) >= 9) break;
  await tc("#reroll"); await p.waitForTimeout(250);
}
await p.waitForTimeout(400);
// field up to level units by dragging from the bench to row 3,2.. cells
const fieldN = await p.evaluate(() => __ui.state.you.level);
let placed = 0;
for (let k = 0; k < 9 && placed < fieldN; k++) {
  const units = await p.evaluate(() => __ui.state.you.units.filter((u) => u.col === null).length);
  if (!units) break;
  const from = await p.evaluate(() => __ui.cell({ bench: 0 })), to = await p.evaluate(([c, r]) => __ui.cell({ col: c, row: r }, 0.0), [1 + placed, 2]);
  await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(to.x, to.y, { steps: 10 }); if (placed === 0) await shot("drag"); await p.mouse.up(); await p.waitForTimeout(350); placed++;
}
await p.mouse.move(w / 2, 60); await p.waitForTimeout(500);
const st = await p.evaluate(() => ({ f: document.getElementById("fielded").textContent, syn: document.querySelectorAll(".sc").length, act: document.querySelectorAll(".sc.active").length }));
console.log(st); ok(st.syn > 0, "synergy rows"); await shot("synergies");
await p.evaluate(() => { const y = __ui.state.you; y.traits = { JJK: 4, Support: 2, Caster: 3, AOT: 1, TG: 2, Fighter: 6, Guardian: 1, SAO: 1, CSM: 2, Ranger: 4 }; __ui.refresh(); });
await p.waitForTimeout(300); await shot("synergies-active");
// inspector
const c0 = await p.evaluate(() => { const u = __ui.state.you.units.find((x) => x.col !== null); return __ui.cell({ col: u.col, row: u.row }, 0.9); }); await p.mouse.click(c0.x, c0.y); await p.waitForTimeout(600);
ok(!(await p.getAttribute("#inspector", "class")).includes("closed"), "inspector opens");
await p.mouse.move(c0.x, c0.y + 10); ok(await p.isHidden("#tip"), "tooltip hidden while inspector open");
const box = await p.evaluate(() => { const r = document.getElementById("inspector").getBoundingClientRect(), t = document.getElementById("tray").children[1].getBoundingClientRect(); return { r: [r.left, r.top, r.right, r.bottom], shop: [t.left, t.top, t.right, t.bottom], W: innerWidth, H: innerHeight }; });
console.log(box); ok(box.r[3] < box.shop[1] && box.r[2] <= box.W && box.r[0] >= 0, "inspector clear of shop and on screen");
await shot("inspector");
await p.mouse.click(w / 2, 150); await p.waitForTimeout(300);
await tc("#ready");
await p.waitForFunction(() => __ui.combat, null, { timeout: 25000 }).catch(() => {}); await p.waitForTimeout(3500); await shot("combat");
await p.waitForTimeout(9000); await shot("combat2");
await p.waitForFunction(() => document.getElementById("banner").classList.contains("show") && /VICTORY|DEFEAT|DRAW/.test(document.getElementById("banner").textContent), null, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(500); await shot("result");
console.log("errors", errs.length, errs.slice(0, 2));
await b.close();
