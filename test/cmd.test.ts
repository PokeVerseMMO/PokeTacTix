import { test } from "node:test"; import assert from "node:assert";
import { newMatch, addPlayer, prepare, act, trapReward, bench } from "../server/rules.ts";
import { simulate } from "../server/combat.ts";
const mk = (cmd: string) => { const m = newMatch(7); const p = addPlayer(m, "P", true, cmd); addPlayer(m, "Q", false, "Blue"); prepare(m); return { m, p }; };
const give = (m: any, p: any, id: string, col: number | null = null, row: number | null = null) => { const u = { uid: ++m.nextUid, id, stars: 1, col, row, items: [] as string[] }; p.units.push(u); return u; };
test("Sabrina Power of Chaos", () => {
  const { m, p } = mk("Sabrina"); const u = give(m, p, "pikachu"); p.gold = 0;
  m.round = 1; assert.equal(act(m, p, { a: "cmd", uid: u.uid }).ok, false);
  m.round = 2; const pool0 = Object.values(m.pool).reduce((a: number, b: any) => a + b, 0); const r = act(m, p, { a: "cmd", uid: u.uid }); assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(u.blessing); assert.equal(pool0 - (Object.values(m.pool) as number[]).reduce((a, b) => a + b, 0), 2); assert.equal(p.gold, 2); // 2 heroes taken from the pool (they may merge into a star-up)
  assert.equal(act(m, p, { a: "cmd", uid: give(m, p, "pikachu").uid }).ok, false); // only 1 use
});
test("Misty / Joy select a hero; Blue places a trap", () => {
  for (const c of ["Misty", "Joy"]) { const { m, p } = mk(c); const u = give(m, p, "pikachu", 1, 3); assert.equal(act(m, p, { a: "cmd", uid: u.uid }).ok, true); assert.equal(p.cmd![c === "Misty" ? "water" : "love"], u.uid); }
  const { m, p } = mk("Blue"); assert.equal(act(m, p, { a: "cmd", col: 2, row: 99 }).ok, false); assert.equal(act(m, p, { a: "cmd", col: 2, row: 3 }).ok, true); assert.deepEqual(p.cmd!.trap, { col: 2, row: 3 });
  const g = p.gold; trapReward(m, p, undefined); assert.equal(p.gold, g + 1); const n = p.units.length; trapReward(m, p, "pikachu"); assert.equal(p.gold, g + 2); assert.equal(p.units.length, n + 1);
});
test("combat: water shield, love energy, trap", () => {
  const A = [{ id: "pikachu", stars: 1, col: 2, row: 3, water: true, love: true }], B = [{ id: "squirtle", stars: 1, col: 2, row: 3 }];
  const r = simulate(A as any, B as any, 5, { commanders: ["Misty", undefined], stage: 2 });
  assert.ok(r.events.some((e: any) => e.k === "shield" || e.k === "cast"), "shield or love event");
  assert.ok(r.events.some((e: any) => e.k === "cast" && e.name === "love_energy"));
});
test("buy / sell / lock / reroll work during combat, other actions do not", () => {
  const { m, p } = mk("Blue"); m.phase = "Combat"; p.gold = 50;
  assert.equal(act(m, p, { a: "reroll" }).ok, true);
  const n = p.units.length; assert.equal(act(m, p, { a: "buy", slot: p.shop.findIndex(Boolean) }).ok, true); assert.equal(p.units.length, n + 1);
  assert.equal(act(m, p, { a: "sell", uid: p.units[p.units.length - 1].uid }).ok, true);
  assert.equal(act(m, p, { a: "lock" }).ok, true); assert.equal(p.shopLocked, true);
  assert.equal(act(m, p, { a: "ready" }).ok, false);
});
