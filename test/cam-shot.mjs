import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto("http://localhost:8097/"); await p.waitForSelector(".cmd", { state: "attached" }); await p.click("#solo");
await p.waitForSelector("#shop .card:not(.empty)", { timeout: 60000 }); await p.waitForTimeout(1500);
for (let i = 1; i <= 3; i++) { await p.evaluate((i) => document.querySelector(`#shop .card:nth-child(${i}):not(.empty)`)?.click(), i); await p.waitForTimeout(200); }
await p.keyboard.press("c"); for (let i = 1; i < 2; i++) { await p.waitForTimeout(1200); await p.screenshot({ path: `shots/cam${i}.png` }); await p.keyboard.press("c"); }
console.log("idx", await p.evaluate(() => __scene.camIndex)); await b.close();
