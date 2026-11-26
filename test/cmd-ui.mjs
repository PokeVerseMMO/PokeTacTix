// Needs server: PORT=8097 PREP_SECONDS=120 TEST_START_UNITS=pikachu,geodude
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) process.exitCode = 1; };
for (const [idx, name] of (process.env.ONLY ? [[2, "Misty"]] : [[0, "Blue"], [2, "Misty"], [4, "Sabrina"]])) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("http://localhost:8097/"); await p.waitForSelector(".cmd", { state: "attached" }); await p.evaluate((i) => document.querySelectorAll(".cmd")[i].click(), idx);
  await p.click("#solo"); await p.waitForSelector("#shop .card:not(.empty)", { timeout: 60000 }); await p.waitForTimeout(1500);
  ok((await p.evaluate(() => __ui.state.you.commander)) === name, "commander " + name);
  await p.click("#cmdSkill"); await p.waitForTimeout(300);
  const txt = await p.textContent("#cmdDetails"); ok(txt.length > 40, name + " details: " + txt.slice(0, 90));
  if (name === "Blue") {
    await p.click("#cmdDetails .cact"); const c = await p.evaluate(() => __ui.cell({ col: 3, row: 2 }, 0.0)); await p.mouse.click(c.x, c.y); await p.waitForFunction(() => __ui.state.you.cmd && __ui.state.you.cmd.trap, null, { timeout: 15000 }).catch(() => {});
    ok(await p.evaluate(() => !!__ui.state.you.cmd.trap), "trap placed " + JSON.stringify(await p.evaluate(() => __ui.state.you.cmd.trap)));
    ok(await p.evaluate(() => __scene.marks && __scene.marks.has("trap")), "trap marker in scene");
    await p.screenshot({ path: "shots/cmd-blue.png" });
  }
  if (name === "Misty") {
    await p.click("#cmdDetails .cact"); const u = await p.evaluate(() => { const x = __ui.state.you.units[0]; return __ui.cell(x.col === null ? { bench: 0 } : { col: x.col, row: x.row }, 0.9); }); await p.mouse.click(u.x, u.y); await p.waitForFunction(() => __ui.state.you.cmd && __ui.state.you.cmd.water !== undefined, null, { timeout: 15000 }).catch(() => {});
    ok(await p.evaluate(() => __ui.state.you.cmd.water !== undefined), "water shield hero selected");
    await p.screenshot({ path: "shots/cmd-misty.png" });
  }
  if (name === "Sabrina") ok(await p.evaluate(() => document.querySelector("#cmdDetails .cact").disabled), "Sabrina locked in round 1");
  ok(errs.length === 0, name + " no errors " + errs.join("|").slice(0, 200)); await p.close();
}
await b.close();
