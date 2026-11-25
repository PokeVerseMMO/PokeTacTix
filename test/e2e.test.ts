import { test } from "node:test";
import assert from "node:assert";
import { WebSocket } from "ws";
process.env.PREP_SECONDS = "1"; process.env.COMBAT_PAD_MS = "50"; process.env.FILL_SECONDS = "1"; process.env.SPEED = "20";
const { startServer } = await import("../server/server.ts");

function client(port: number, join: object) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const log: any[] = [];
  const api = { ws, log, state: null as any, over: null as any, combats: 0, send: (m: object) => ws.send(JSON.stringify(m)) };
  ws.on("open", () => api.send({ t: "join", ...join }));
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)); log.push(m.t);
    if (m.t === "state") {
      api.state = m;
      const s = m.you;
      if (m.phase === "Preparation" && !s.eliminated) {
        // greedy human: buy everything affordable, field units, ready up
        m.you.shop.forEach((id: string | null, slot: number) => { if (id) api.send({ t: "act", action: { a: "buy", slot } }); });
        const free = s.units.filter((u: any) => u.col === null);
        free.slice(0, Math.max(0, s.level - s.units.filter((u: any) => u.col !== null).length)).forEach((u: any, i: number) => {
          api.send({ t: "act", action: { a: "move", uid: u.uid, col: i % 7, row: 3 - Math.floor(i / 7) } });
        });
        api.send({ t: "act", action: { a: "ready" } });
      }
    }
    if (m.t === "combat") api.combats++;
    if (m.t === "over") api.over = m;
  });
  return api;
}
const until = async (f: () => boolean, ms = 60000) => { const end = Date.now() + ms; while (!f() && Date.now() < end) await new Promise((r) => setTimeout(r, 50)); return f(); };

test("solo match vs 7 bots runs to a finish", async () => {
  const srv = await startServer(0);
  const c = client(srv.port, { mode: "solo", name: "Tester", commander: "Blue", difficulty: "Beginner" });
  assert.ok(await until(() => c.over !== null, 90000), "match did not finish; log tail " + c.log.slice(-5));
  assert.ok(c.combats >= 3, "expected combats, got " + c.combats);
  assert.ok(c.over.standings.length === 8);
  assert.ok(c.over.placement >= 1 && c.over.placement <= 8);
  console.log("placement", c.over.placement, "rounds", c.state?.round, "combats", c.combats);
  c.ws.close(); srv.close();
});

test("two humans share a room and both finish", async () => {
  const srv = await startServer(0);
  const a = client(srv.port, { mode: "online", name: "A", commander: "Blue" });
  const b = client(srv.port, { mode: "online", name: "B", commander: "Brock" });
  assert.ok(await until(() => a.over !== null && b.over !== null, 90000), "online match did not finish");
  assert.notStrictEqual(a.over.placement, b.over.placement === a.over.placement && a.over.placement === 1 ? 1 : 0);
  console.log("A", a.over.placement, "B", b.over.placement, "humans in standings", a.over.standings.filter((s: any) => s.human).length);
  a.ws.close(); b.ws.close(); srv.close();
});
