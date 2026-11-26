// Desktop shell: checks the "updates" branch of the GitHub repo for a newer game bundle (server + client + data),
// downloads only the files that changed, then starts the game server inside the app and opens the client.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const REPO = process.env.POKETACTIX_REPO || "PokeVerseMMO/poketactix", BRANCH = process.env.POKETACTIX_BRANCH || "updates";
const RAW = process.env.POKETACTIX_RAW || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const bundled = __dirname;
const sha1 = (file) => crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
const token = () => { // private repo: a read-only token in update-token.txt (next to the exe, or in the user data folder) or POKETACTIX_TOKEN
  if (process.env.POKETACTIX_TOKEN) return process.env.POKETACTIX_TOKEN.trim();
  for (const f of [path.join(path.dirname(process.execPath), "update-token.txt"), path.join(app.getPath("userData"), "update-token.txt")]) { try { return fs.readFileSync(f, "utf8").trim(); } catch {} }
  return "";
};
async function get(rel, ms) {
  const t = token(), res = await fetch(RAW + rel.split("/").map(encodeURIComponent).join("/") + "?t=" + Date.now(), { headers: t ? { Authorization: `token ${t}` } : {}, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status} ${rel}`);
  return res;
}
function status(win, text) { try { win.setTitle("PokéTactix — " + text); win.loadURL("data:text/html," + encodeURIComponent(`<body style="margin:0;background:#160e2c;color:#e8e0ff;font:600 20px Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">${text}</body>`)); } catch {} }

// Returns the folder the game should run from (a full, up-to-date copy in the user data folder, or the bundled one).
async function resolveRoot(win) {
  const cur = path.join(app.getPath("userData"), "game");
  const local = (rel) => { const p = path.join(cur, rel); return fs.existsSync(p) ? p : null; };
  let manifest;
  try { manifest = await (await get("version.json", 6000)).json(); } catch (e) { console.log("update check skipped:", e.message); const hint = /^40[134]/.test(e.message) ? "Update check failed (" + e.message.split(" ")[0] + "): put a read-only GitHub token in update-token.txt next to PokeTactix.exe, or make the repo public." : "Update check failed: " + e.message; status(win, hint); await new Promise((r) => setTimeout(r, 4500)); return fs.existsSync(path.join(cur, "server.cjs")) ? cur : bundled; }
  if (!manifest.files) return bundled;
  const have = (rel) => { const p = local(rel) || (fs.existsSync(path.join(bundled, rel)) ? path.join(bundled, rel) : null); return p ? sha1(p) : null; };
  const need = Object.entries(manifest.files).filter(([rel, h]) => have(rel) !== h);
  if (!need.length && fs.existsSync(path.join(cur, "server.cjs"))) return cur;
  if (!need.length) return bundled;
  if (!fs.existsSync(path.join(cur, "server.cjs"))) { status(win, "Preparing update…"); fs.cpSync(bundled, cur, { recursive: true }); }
  let n = 0;
  for (const [rel, h] of need) {
    status(win, `Updating… ${++n} / ${need.length}`);
    const dest = path.join(cur, rel); fs.mkdirSync(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(await (await get(rel, 60000)).arrayBuffer());
    if (crypto.createHash("sha1").update(buf).digest("hex") !== h) throw new Error("checksum mismatch " + rel);
    fs.writeFileSync(dest + ".part", buf); fs.renameSync(dest + ".part", dest);
  }
  const keep = new Set(Object.keys(manifest.files)); // drop files that no longer exist in the game
  const walk = (d, base) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const rel = base ? base + "/" + f.name : f.name; if (f.isDirectory()) walk(path.join(d, f.name), rel); else if (!keep.has(rel) && !["main.cjs", "package.json"].includes(rel)) fs.rmSync(path.join(d, f.name), { force: true }); } };
  try { walk(cur, ""); } catch {}
  fs.writeFileSync(path.join(cur, "version.json"), JSON.stringify(manifest));
  return cur;
}

let server;
async function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1280, height: 720, minWidth: 960, minHeight: 540, backgroundColor: "#160e2c", title: "PokéTactix", autoHideMenuBar: true });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  status(win, "Checking for updates…");
  let root = bundled;
  try { root = await resolveRoot(win); } catch (e) { console.log("update failed:", e.message); root = fs.existsSync(path.join(app.getPath("userData"), "game", "server.cjs")) ? path.join(app.getPath("userData"), "game") : bundled; }
  process.env.AUTOCHESS_ROOT = root; process.env.AUTOCHESS_RUN = "0";
  let ver = ""; try { ver = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version || ""; } catch {}
  try { server = await require(path.join(root, "server.cjs")).startServer(0); } catch (e) { if (root !== bundled) { process.env.AUTOCHESS_ROOT = bundled; server = await require(path.join(bundled, "server.cjs")).startServer(0); } else throw e; }
  win.setTitle("PokéTactix" + (ver ? " · build " + ver : ""));
  win.loadURL(`http://localhost:${server.port}/`);
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { try { server && server.close(); } catch {} app.quit(); });
module.exports.resolveRoot = resolveRoot;
