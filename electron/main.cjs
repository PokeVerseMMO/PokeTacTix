// Desktop shell: starts the game server inside the app (for Play vs Bots) and opens the client.
const { app, BrowserWindow, Menu } = require("electron");
const path = require("node:path");
process.env.AUTOCHESS_ROOT = path.join(__dirname);
process.env.AUTOCHESS_RUN = "0";
const { startServer } = require("./server.cjs");

let server;
async function createWindow() {
  server = await startServer(0);
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({ width: 1280, height: 720, minWidth: 960, minHeight: 540, backgroundColor: "#160e2c", title: "PokéTactix", autoHideMenuBar: true });
  win.loadURL(`http://localhost:${server.port}/`);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { try { server && server.close(); } catch {} app.quit(); });
