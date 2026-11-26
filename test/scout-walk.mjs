// Needs: PORT=8097 PREP_SECONDS=120 FILL_SECONDS=3 (server running). Two humans; A scouts B and walks there; B must see A.
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const URL = process.env.URL || "http://localhost:8097/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
const mk = async () => { const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.errs = []; p.on("pageerror", (e) => p.errs.push(String(e))); await p.goto(URL); await p.waitForSelector(".cmd", { state: "attached", timeout: 90000 }); await p.waitForTimeout(800); return p; };
const A = await mk(), B = await mk();
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) process.exitCode = 1; };
await Promise.all([A.click("#online"), B.click("#online")]);
await Promise.all([A, B].map((p) => p.waitForSelector("#shop .card:not(.empty)", { timeout: 60000 })));
await A.waitForTimeout(2500);
const seatB = await B.evaluate(() => __ui.state.seat), seatA0 = await A.evaluate(() => __ui.state.seat); ok(seatB !== seatA0, "A and B are different seats of one match: " + seatA0 + "/" + seatB);
const remoteKeys = (p) => p.evaluate(() => [...(window.__scene.remote?.keys() ?? [])]);
const visitorPose = (p, k) => p.evaluate((k) => { const r = window.__scene.remote?.get(k); return r && r.tgt ? { x: r.tgt.x, z: r.tgt.z, y: r.tgt.y } : null; }, k);
ok(!(await remoteKeys(B)).some((k) => k.startsWith("p")), "B sees no visitors at first: " + JSON.stringify(await remoteKeys(B)));
// A scouts B by clicking B's row in the standings
const seatA = await A.evaluate(() => __ui.state.seat);
await A.evaluate((s) => { const rows = [...document.querySelectorAll("#standings2 .pl.scoutable")]; const names = __ui.state.players; const r = rows.find((e) => e.textContent.includes(names.find((q) => q.seat === s).name)); r.click(); }, seatB);
await A.waitForTimeout(700);
ok(await A.evaluate(() => document.body.classList.contains("scouting")), "A is in scouting mode");
await A.keyboard.down("d"); await A.waitForTimeout(1500); await A.keyboard.up("d");
await A.keyboard.down("Space"); await A.waitForTimeout(200); const jy = (await A.evaluate(() => __scene.localPose())).y; await A.keyboard.up("Space");
ok(jy > 1.0, "A jumps on B's island y=" + jy);
const ap = await A.evaluate(() => __scene.localPose());
await B.waitForTimeout(1200);
const key = "p" + seatA, keys = await remoteKeys(B);
ok(keys.includes(key), "B sees A's trainer on its island: " + JSON.stringify(keys));
const vp = await visitorPose(B, key);
ok(vp && Math.hypot(vp.x - ap.x, vp.z - ap.z) < 1.5, `visitor position matches A (${JSON.stringify(vp)} vs x=${ap.x.toFixed(2)} z=${ap.z.toFixed(2)})`);
await B.screenshot({ path: "shots/scout-visitor-B.png" });
// A returns
await A.keyboard.press("Escape"); await B.waitForTimeout(3000);
ok(!(await remoteKeys(B)).includes(key), "visitor gone from B after A returns: " + JSON.stringify(await remoteKeys(B)));
ok(!(await remoteKeys(A)).includes("p" + seatB) , "A back home sees no B visitor");
ok(A.errs.length + B.errs.length === 0, "no page errors " + [...A.errs, ...B.errs].join("|").slice(0, 300));
await b.close();
