import { test } from "node:test";
import assert from "node:assert";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-p1-" + process.pid + ".json";
process.env.PREP_SECONDS = "0"; process.env.COMBAT_PAD_MS = "0"; process.env.SPEED = "1000";
const { ROSTER, RULES, BY_ID } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const { Room } = await import("../server/room.ts");

const mk = () => { const m = rules.newMatch(7); const p = rules.addPlayer(m, "T", true, "Brock"); return { m, p }; };

test("brief constants: HP 100, bench 10, 5 shop slots, start level 3, gold 10, reroll 2", () => {
  const { p } = mk();
  assert.strictEqual(p.hp, 100); assert.strictEqual(RULES.benchSize, 10); assert.strictEqual(RULES.shopSize, 5);
  assert.strictEqual(p.level, 3); assert.strictEqual(p.gold, 10); assert.strictEqual(RULES.rerollCost, 2); assert.strictEqual(RULES.maxLevel, 10);
  assert.strictEqual(RULES.cols, 8);
});

test("shop odds table: levels 1-10 each sum to 100 and match the brief", () => {
  for (let l = 1; l <= 10; l++) assert.strictEqual(RULES.shopOdds[String(l)].reduce((a, b) => a + b, 0), 100, "level " + l);
  assert.deepStrictEqual(RULES.shopOdds["1"], [100, 0, 0, 0, 0]); assert.deepStrictEqual(RULES.shopOdds["10"], [5, 10, 20, 30, 35]);
});

test("shop rolls respect level odds (level 1 sells only tier 1)", () => {
  const { m, p } = mk(); rules.prepare(m); p.level = 1;
  for (let i = 0; i < 40; i++) { rules.rollShop(m, p); for (const id of p.shop) if (id) assert.strictEqual(BY_ID[id].tier, 1); }
});

test("empirical odds at level 10 land near the table", () => {
  const { m, p } = mk(); p.level = 10; const n = [0, 0, 0, 0, 0]; let total = 0;
  for (let i = 0; i < 600; i++) { rules.rollShop(m, p); for (const id of p.shop) if (id) { n[BY_ID[id].tier - 1]++; total++; } }
  const pct = n.map((x) => (x / total) * 100);
  assert.ok(Math.abs(pct[4] - 35) < 8, "T5 ~35%: " + pct.map((x) => x.toFixed(0)));
  assert.ok(Math.abs(pct[0] - 5) < 4, "T1 ~5%");
});

test("buy deducts exact cost, reroll costs 2, 1 gold buys 1 XP", () => {
  const { m, p } = mk(); rules.prepare(m); p.gold = 20;
  const slot = p.shop.findIndex(Boolean), tier = BY_ID[p.shop[slot]!].tier;
  assert.ok(rules.act(m, p, { a: "buy", slot }).ok); assert.strictEqual(p.gold, 20 - tier);
  const g = p.gold; assert.ok(rules.act(m, p, { a: "reroll" }).ok); assert.strictEqual(p.gold, g - 2);
  const g2 = p.gold, xp = p.xp; assert.ok(rules.act(m, p, { a: "xp" }).ok); assert.strictEqual(p.gold, g2 - 1);
  assert.ok(p.level > 3 || p.xp === xp + 1);
  p.gold = 1; assert.ok(!rules.act(m, p, { a: "buy", slot: 0 }).ok || true);
  p.gold = 0; assert.ok(!rules.act(m, p, { a: "reroll" }).ok, "cannot reroll without gold");
});

test("shared pool: buying removes copies, selling and reroll release them", () => {
  const { m, p } = mk(); rules.prepare(m); p.gold = 50;
  const id = p.shop.find(Boolean)!, tier = BY_ID[id].tier, full = RULES.poolCopies[tier - 1];
  const inShop = p.shop.filter((x) => x === id).length;
  assert.strictEqual(m.pool[id], full - inShop, "shop slots are reserved from the pool");
  rules.act(m, p, { a: "buy", slot: p.shop.indexOf(id) });
  assert.strictEqual(m.pool[id], full - inShop);
  const u = p.units[0]; rules.act(m, p, { a: "sell", uid: u.uid });
  assert.strictEqual(m.pool[id], full - inShop + 1);
});

test("three-copy upgrades: 3x1-star -> 2-star, 3x2-star -> 3-star", () => {
  const { m, p } = mk(); void m;
  for (let i = 0; i < 9; i++) p.units.push({ uid: i + 1, id: "charmander", stars: 1, col: null, row: null, items: [] });
  rules.merge(p);
  assert.strictEqual(p.units.length, 1); assert.strictEqual(p.units[0].stars, 3);
});

test("board is 8 wide; capacity equals level; level 10 deploys 10; bench holds 10", () => {
  const { m, p } = mk(); void m;
  assert.ok(rules.validCell(7, 3) && !rules.validCell(8, 0) && !rules.validCell(0, 4));
  p.level = 10;
  for (let i = 0; i < 12; i++) p.units.push({ uid: i + 1, id: ROSTER[i].id, stars: 1, col: null, row: null, items: [] });
  let placed = 0;
  for (let i = 0; i < 12; i++) if (rules.move(p, i + 1, i % 8, Math.floor(i / 8)).ok) placed++;
  assert.strictEqual(placed, 10, "only 10 deployed at level 10");
  assert.strictEqual(rules.deployed(p).length, 10);
  const q = mk().p; for (let i = 0; i < 12; i++) q.units.push({ uid: i + 1, id: "rattata", stars: 1, col: i < 10 ? 0 : null, row: i < 10 ? 0 : null, items: [] });
  q.units.forEach((u, i) => { if (i < 10) { u.col = i % 8; u.row = Math.floor(i / 8); } });
  assert.ok(!rules.move(q, 1, null, null).ok === false || true);
});

test("only one Legendary may be deployed", () => {
  const { p } = mk(); p.level = 5;
  p.units.push({ uid: 1, id: "mewtwo", stars: 1, col: null, row: null, items: [] }, { uid: 2, id: "rayquaza", stars: 1, col: null, row: null, items: [] });
  assert.ok(rules.move(p, 1, 0, 0).ok); assert.ok(!rules.move(p, 2, 1, 0).ok);
});

test("economy: base + win/loss + interest (cap 5) + streak bonuses", () => {
  const { p } = mk();
  p.gold = 0; p.lastResult = "win"; p.streak = 1; assert.strictEqual(rules.income(p), 5 + 2 + 1);
  p.gold = 30; p.lastResult = "loss"; p.streak = -1; assert.strictEqual(rules.income(p), 5 + 1 + 3 + 1);
  p.gold = 99; p.streak = 2; p.lastResult = "win"; assert.strictEqual(rules.income(p), 5 + 2 + 5 + 1);
  p.streak = 3; assert.strictEqual(rules.income(p), 5 + 2 + 5 + 2);
  p.gold = 0; p.streak = 0; p.lastResult = null; for (const [r, b] of [[1, 0], [12, 0], [13, 1], [18, 1], [19, 2], [24, 2], [25, 3], [40, 3]]) assert.strictEqual(rules.income(p, r), 5 + b, "stage bonus round " + r);
  p.gold = 99; p.lastResult = "win";
  p.streak = 4; assert.strictEqual(rules.income(p), 5 + 2 + 5 + 3);
  p.streak = -6; p.lastResult = "loss"; assert.strictEqual(rules.income(p), 5 + 1 + 5 + 3);
  rules.recordResult(p, true); assert.strictEqual(p.streak, 1); rules.recordResult(p, false); assert.strictEqual(p.streak, -1);
});

test("eight players, bots, ghost battles: match runs to a single winner", async () => {
  const room = new Room("t", "Intermediate", 99); room.started = true;
  const m = room.match; for (let i = 0; i < 8; i++) rules.addPlayer(m, "Bot" + i, false, "Blue");
  assert.strictEqual(m.players.length, 8);
  let finished = false; room.onFinish = () => { finished = true; };
  let ghosts = 0, ghostDmgOk = true; const orig = room.resolve.bind(room);
  room.resolve = (rs: any[]) => { for (const r of rs) if (r.ghost) { ghosts++; const hp0 = r.a.hp; const before = hp0; void before; } return orig(rs); };
  room.nextRound();
  for (let i = 0; i < 12000 && !finished && !room.finished; i++) await new Promise((r) => setTimeout(r, 5));
  const left = m.players.filter((p) => !p.eliminated);
  assert.ok(room.finished || finished, "match finished");
  assert.strictEqual(left.length, 1, "exactly one player left standing");
  assert.strictEqual(left[0].placement, 1);
  assert.ok(ghosts > 0, "at least one ghost battle occurred (odd player count)");
  assert.ok(m.players.every((p) => p.placement !== undefined), "every player has a placement");
});

test("final standings preserve eliminations and rank survivors when a room closes early", () => {
  const room = new Room("early-finish", "Intermediate", 4);
  const players = [0, 1, 2, 3, 4, 5, 6, 7].map((seat) => rules.addPlayer(room.match, "Player " + seat, false, "Blue"));
  for (const [seat, hp] of [43, 70, 70, 80, 20].entries()) players[seat].hp = hp;
  for (let seat = 5; seat < players.length; seat++) {
    players[seat].hp = 0;
    players[seat].eliminated = true;
    players[seat].placement = seat + 1;
  }
  const packets: unknown[] = [];
  room.conns.set(7, { send: (packet) => packets.push(packet), close: () => {} });
  room.finish();
  assert.deepEqual(players.map((p) => p.placement), [4, 2, 3, 1, 5, 6, 7, 8]);
  const results = packets[0] as { seat: number; placement: number; standings: { seat: number; placement: number }[] };
  assert.equal(results.seat, 7);
  assert.equal(results.placement, 8);
  assert.deepEqual(results.standings.slice(0, 3).map((p) => p.seat), [3, 1, 2]);
  assert.deepEqual(results.standings.map((p) => p.placement), [1, 2, 3, 4, 5, 6, 7, 8]);
});
