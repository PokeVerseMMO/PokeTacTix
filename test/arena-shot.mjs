// Empty-battlefield capture at mockup size. Server must be up: PORT=8096 node server/server.ts
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const [w, h] = (process.env.SIZE || "1672x941").split("x").map(Number), q = process.env.Q || "High", out = process.env.OUT || "shots/arena-empty.png";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: w, height: h } }); const errs = [];
p.on("pageerror", (e) => errs.push(e.stack || String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.addInitScript((q) => { try { localStorage.setItem("quality", q); } catch {} }, q);
await p.goto(`http://localhost:${process.env.PORT||8096}/`); await p.waitForSelector(".cmd"); await p.click("#solo"); await p.waitForSelector("#shop .card:not(.empty)"); await p.waitForTimeout(Number(process.env.WAIT || 4000));
if (process.env.HIDE) await p.addStyleTag({ content: "#stage{display:none!important}" });
await p.mouse.move(w / 2, 4); await p.waitForTimeout(300); await p.screenshot({ path: out });
console.log("errors", errs.length, errs.slice(0, 3)); await b.close();
