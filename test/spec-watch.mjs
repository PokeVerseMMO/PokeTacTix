// Needs: PORT=8097 PREP_SECONDS=20 COMBAT_PAD_MS=40000 TEST_START_UNITS=pikachu,geodude
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) process.exitCode = 1; };
await p.goto("http://localhost:8097/"); await p.waitForSelector(".cmd", { state: "attached" }); await p.click("#solo");
await p.waitForSelector("#shop .card:not(.empty)", { timeout: 60000 }); await p.waitForTimeout(1500);
await p.evaluate(() => { __ui.state.you.units.forEach((u, i) => __ui.send({ a: "move", uid: u.uid, col: 2 + i, row: 3 })); });
await p.waitForFunction(() => __ui.state.phase === "Combat", null, { timeout: 90000 }); await p.waitForTimeout(1500);
const target = await p.evaluate(() => { const vs = __ui.combat && __ui.combat.m && __ui.combat.m.vs; return __ui.state.players.find((q) => q.seat !== __ui.state.seat && q.name !== vs && !q.eliminated).name; });
await p.evaluate((nm) => { [...document.querySelectorAll("#standings2 .pl.scoutable")].find((e) => e.textContent.includes(nm)).click(); }, target);
await p.waitForTimeout(4000);
const r = await p.evaluate(() => ({ keys: [...__scene.units.keys()], scout: document.body.classList.contains("scouting") }));
ok(r.scout, "scouting while in combat"); ok(r.keys.filter((k) => k.startsWith("c")).length >= 2, "watching another battle: " + r.keys.join(","));
await p.screenshot({ path: "shots/spec-watch.png" });
await p.keyboard.press("Escape"); await p.waitForTimeout(1500);
ok(!(await p.evaluate(() => document.body.classList.contains("scouting"))), "back to my own view");
ok(errs.length === 0, "no errors " + errs.join("|").slice(0, 300)); await b.close();
