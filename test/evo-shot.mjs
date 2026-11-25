// Evolution + stone UI check. Server: TEST_START_UNITS=charmander:2,charmander:3,eevee:1,gastly:3 TEST_START_ITEMS=fire_stone,water_stone
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const port = process.env.PORT || 8096;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1672, height: 941 } }); const errs = [];
p.on("pageerror", (e) => errs.push(e.stack || String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.addInitScript(() => { try { localStorage.setItem("quality", "Low"); } catch {} });
await p.goto(`http://localhost:${port}/`); await p.waitForSelector(".cmd"); await p.click("#solo"); await p.waitForSelector("#shop .card:not(.empty)"); await p.waitForTimeout(1500);
const act = (a) => p.evaluate((a) => __ui.send(a), a);
const units = await p.evaluate(() => __ui.state.you.units.map((u) => ({ uid: u.uid, id: u.id, stars: u.stars })));
console.log("units", JSON.stringify(units));
await p.evaluate(() => { __ui.send({ a: "xp" }); __ui.send({ a: "xp" }); __ui.send({ a: "xp" }); }); await p.waitForTimeout(400);
const cells = [[1, 3], [2, 3], [3, 3], [4, 3]]; let k = 0;
for (const u of units.slice(0, 4)) { await act({ a: "move", uid: u.uid, col: cells[k][0], row: cells[k][1] }); k++; await p.waitForTimeout(150); }
await p.waitForTimeout(800);
const evoUid = units.find((u) => u.id === "eevee").uid;
await act({ a: "evolve", uid: evoUid, stone: "water_stone" }); await p.waitForTimeout(800);
console.log("after evolve", JSON.stringify(await p.evaluate(() => __ui.state.you.units.map((u) => [u.id, u.stars, u.col]))));
console.log("stones left", JSON.stringify(await p.evaluate(() => __ui.state.you.items)));
await p.mouse.move(836, 4); await p.screenshot({ path: "shots/evo-board.png" });
// inspector on the evolved eevee
const c = await p.evaluate((uid) => { const u = __ui.state.you.units.find((x) => x.uid === uid); return __ui.cell({ col: u.col, row: u.row }, 0.9); }, evoUid);
await p.mouse.click(c.x, c.y); await p.waitForTimeout(700); await p.screenshot({ path: "shots/evo-inspector.png" });
console.log("errors", errs.filter((e) => !/404/.test(e)).length, errs.slice(0, 3));
await b.close();
