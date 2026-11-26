// Needs: PORT=8097 PREP_SECONDS=60 TEST_START_UNITS=pikachu,geodude
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) process.exitCode = 1; };
await p.goto("http://localhost:8097/"); await p.waitForSelector(".cmd", { state: "attached" }); await p.click("#solo");
await p.waitForSelector("#shop .card:not(.empty)", { timeout: 60000 });
// advance to a PvP round: ready up until the next opponent is a player
for (let i = 0; i < 4; i++) { if (await p.evaluate(() => __ui.state.opponent != null)) break; await p.evaluate(() => __ui.send({ a: "ready" })); await p.waitForFunction((r) => __ui.state.phase === "Preparation" && __ui.state.round > r, await p.evaluate(() => __ui.state.round), { timeout: 90000 }).catch(() => {}); await p.waitForTimeout(800); }
const st = await p.evaluate(() => ({ r: __ui.state.round, o: __ui.state.opponent, n: __ui.state.players.length }));
ok(st.o != null, "opponent known in preparation: " + JSON.stringify(st));
await p.waitForTimeout(4000);
ok(await p.evaluate(() => [...__scene.remote.keys()].some((k) => k.startsWith("opp"))), "opponent commander shown");
await p.screenshot({ path: "shots/opp-view.png" });
ok(errs.length === 0, "no errors " + errs.join("|").slice(0, 300)); await b.close();
