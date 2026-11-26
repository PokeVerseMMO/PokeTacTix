import { STAGE_LEN } from "./supply.ts";
// HTTP (serves the client) + WebSocket matchmaking and game traffic.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { CLIENT_ROSTER, ENEMIES, ITEM_LIST, TYPE_ITEMS, CRYSTALS, TRANSFER_ITEMS, SPECIAL_ITEMS, STONES, RULES, ROOT, GOGO } from "./data.ts";
import { Room } from "./room.ts";
import { getProfile, rankInfo } from "./profiles.ts";

const root = ROOT;
const MIME: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ogg": "audio/ogg" };
const FILL_SECONDS = Number(process.env.FILL_SECONDS ?? 15);

export function startServer(port = Number(process.env.PORT ?? 8080)) {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let path = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    if (path === "/data.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ abilityIcons: (() => { try { return readdirSync(join(ROOT, "client/art/ui/abilities")).map((f) => f.replace(/\.png$/, "")); } catch { return []; } })(), roster: CLIENT_ROSTER, items: [...ITEM_LIST, ...TYPE_ITEMS, ...CRYSTALS, ...TRANSFER_ITEMS, ...STONES, ...SPECIAL_ITEMS], synergies: RULES.synergies, enemies: Object.values(ENEMIES).map((u: any) => ({ id: u.id, name: u.name, faction: u.faction, role: u.role, tier: u.tier, health: u.health, attack: u.attack, range: u.range, ability: u.ability, description: u.description, armor: u.armor, mr: u.mr, speed: u.speed, crit: u.crit, maxMana: u.maxMana, startMana: u.startMana, npc: true, boss: u.enemyClass === "boss" })), rules: { gogoNames: GOGO.rarityNames, gogoRounds: GOGO.rounds, npcInterval: RULES.npcInterval, dmgTable: RULES.damage.table, stageLen: STAGE_LEN, xpBuyGold: RULES.economy.xpBuyGold, xpBuyAmount: RULES.economy.xpBuyAmount, factions: RULES.factions, cols: RULES.cols, factionNames: RULES.factionNames, factionColors: RULES.factionColors, traitDescriptions: RULES.traitDescriptions, commanders: RULES.commanders, maxLevel: RULES.maxLevel, shopSize: RULES.shopSize, benchSize: RULES.benchSize } }));
      return;
    }
    if (path === "/api/art") {
      const out: string[] = [];
      const walk = async (dir: string, rel: string) => {
        let entries: import("node:fs").Dirent[] = [];
        try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) e.isDirectory() ? await walk(join(dir, e.name), rel + e.name + "/") : /\.(png|webp|jpg|jpeg)$/i.test(e.name) && out.push(rel + e.name);
      };
      await walk(join(root, "client", "art"), "");
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ files: out }));
      return;
    }
    if (path === "/api/profile") {
      const name = String(url.searchParams.get("name") ?? "").slice(0, 20);
      const p = name ? getProfile(name) : null;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(p ? { name: p.name, matches: p.matches, wins: p.wins, best: p.best, ...rankInfo(p.rp) } : {}));
      return;
    }
    const file = normalize(join(root, "client", path));
    if (!file.startsWith(join(root, "client"))) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch { res.writeHead(404); res.end("not found"); }
  });

  const wss = new WebSocketServer({ server: http });
  const rooms = new Set<Room>();
  let waiting: Room | null = null, waitTimer: ReturnType<typeof setTimeout> | null = null, nextId = 1;

  const makeRoom = (ranked = false) => {
    const room = new Room(`room-${nextId++}`);
    room.ranked = ranked;
    rooms.add(room);
    room.onFinish = () => setTimeout(() => rooms.delete(room), 60_000);
    return room;
  };
  const startWaiting = () => {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    if (waiting) { const r = waiting; waiting = null; r.start(); }
  };

  wss.on("connection", (ws: WebSocket) => {
    let room: Room | null = null, me: any = null;
    const conn = { send: (m: unknown) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); }, close: () => ws.close() };
    ws.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (msg.t === "join" && !room) {
        const name = String(msg.name ?? "Player").slice(0, 20) || "Player";
        const commander = RULES.commanders.some((c) => c.id === msg.commander) ? msg.commander : "Blue";
        if (msg.mode === "solo") {
          room = makeRoom();
          const p = room.join(name, commander, conn);
          me = p;
          room.difficulty = ["Beginner", "Intermediate", "Hard"].includes(msg.difficulty) ? msg.difficulty : "Intermediate";
          room.start();
        } else {
          if (!waiting || !waiting.open) { waiting = makeRoom(true); }
          room = waiting;
          const p = room.join(name, commander, conn);
          me = p;
          if (room.match.players.length >= 8) startWaiting();
          else if (!waitTimer) waitTimer = setTimeout(startWaiting, FILL_SECONDS * 1000);
        }
      } else if (msg.t === "avatar" && room && room.started && me) {
        room.setAvatar(room.match.players.indexOf(me), msg);
      } else if (msg.t === "act" && room && room.started) {
        room.handle(room.match.players.indexOf(me), msg.action);
      }
    });
    ws.on("close", () => { if (room && me) room.leave(room.match.players.indexOf(me)); });
  });

  return new Promise<{ port: number; close(): void }>((resolve) => {
    http.listen(port, () => {
      const addr = http.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      resolve({ port: actual, close() { wss.close(); http.close(); } });
    });
  });
}

if (process.env.AUTOCHESS_RUN !== "0" && process.argv[1] && /server\.(ts|cjs)$/.test(process.argv[1])) {
  startServer().then((s) => console.log(`Anime AutoChess server on http://localhost:${s.port}`));
}
