import { test } from "node:test";
import assert from "node:assert";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-p4-" + process.pid + ".json";
const { BY_ID, ITEMS, TRANSFORM, SPECIAL_ITEMS } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const { simulate } = await import("../server/combat.ts");
const { Room } = await import("../server/room.ts");
const U = (id: string, col: number, o: any = {}) => ({ id, stars: 1, col, row: 3, ...o });
const ev = (r: any, k: string) => r.events.filter((e: any) => e.k === k);
const mk = () => { const m = rules.newMatch(9); const p = rules.addPlayer(m, "T", true, "Brock"); return { m, p }; };

test("mega stones exist for final forms, reference real species and sprites", () => {
  assert.ok(TRANSFORM.megaStones.length >= 20);
  for (const s of TRANSFORM.megaStones) { assert.ok(BY_ID[s.species], s.species); assert.ok(ITEMS[s.key]); const line = BY_ID[s.species].evolutionLine; assert.ok(line.length >= 1); }
});

test("Mega Evolution needs the final form: boosts stats and swaps the sprite", () => {
  const base = simulate([U("charmander", 3, { stars: 3 })], [U("snorlax", 3, { stars: 3 })], 5);
  const mega = simulate([U("charmander", 3, { stars: 3, items: ["mega_charizard"] })], [U("snorlax", 3, { stars: 3 })], 5);
  const st = mega.start.find((u: any) => u.side === 0)!;
  assert.strictEqual(st.art, "charizard_mega");
  assert.ok(st.hp > base.start.find((u: any) => u.side === 0)!.hp * 1.25, "mega has more HP");
  const early = simulate([U("charmander", 2, { items: ["mega_charizard"] })], [U("snorlax", 3, { stars: 3 })], 5);
  assert.strictEqual(early.start[0].art, undefined, "not final form -> no Mega");
  const wrong = simulate([U("gastly", 3, { stars: 3, items: ["mega_charizard"] })], [U("snorlax", 3)], 5);
  assert.strictEqual(wrong.start[0].art, undefined, "stone only fits its own species");
});

test("only one Mega per team", () => {
  const r = simulate([U("charmander", 3, { stars: 3, items: ["mega_charizard"] }), U("squirtle", 2, { stars: 3, items: ["mega_blastoise"] })], [U("snorlax", 3, { stars: 3 })], 5);
  assert.strictEqual(r.start.filter((u: any) => u.side === 0 && u.art).length, 1);
});

test("Dynamax Band: Gigantamax species grows for 10 seconds then reverts", () => {
  const r = simulate([U("snorlax", 3, { stars: 3, items: ["dynamax_band"] })], [U("rayquaza", 3, { stars: 2 })], 6);
  const f = ev(r, "form").filter((e: any) => e.name === "gmax");
  assert.ok(f.length >= 1 && f[0].art === "snorlax_gmax" && Math.abs(f[0].t - TRANSFORM.rules.gmaxStart) < 0.3, JSON.stringify(f));
  if (r.duration > TRANSFORM.rules.gmaxStart + TRANSFORM.rules.gmaxDuration + 0.5) assert.strictEqual(f[1].art, null);
  const none = simulate([U("rattata", 3, { items: ["dynamax_band"] })], [U("rayquaza", 3, { stars: 2 })], 6);
  assert.strictEqual(ev(none, "form").length, 0, "non-Gmax species cannot Dynamax");
});

test("PvE: wild Pokémon creep rounds and legendary bosses (npc/boss flags, scaled)", () => {
  const room: any = new Room("t", 1);
  const creeps = room.npcLineup(4), boss1 = room.npcLineup(8), boss2 = room.npcLineup(16);
  assert.ok(creeps.length >= 1 && creeps.every((s: any) => BY_ID[s.id] && s.npc && !s.boss));
  assert.ok(boss1[0].boss && BY_ID[boss1[0].id]); assert.strictEqual(boss2[0].id, "mewtwo");
  const r = simulate([U("charmander", 3, { stars: 3 })], boss2, 3);
  assert.ok(r.start.find((u: any) => u.side === 1)!.boss, "boss flag reaches the client");
  assert.ok(BY_ID[boss2[0].id].legendary);
  room.finished = true;
});

test("boss win drops a transformation item; creeps do not", () => {
  const { m, p } = mk();
  rules.reward(m, p, 4, true); assert.ok(!p.items.some((k) => ITEMS[k]?.rarity === "Mega"));
  p.items = []; rules.reward(m, p, 8, true); assert.strictEqual(p.items.filter((k) => ITEMS[k]?.rarity === "Mega").length, 1);
  assert.ok(SPECIAL_ITEMS.length > 20);
});

test("Legendary limit still enforced (1 deployed)", () => {
  const { m, p } = mk(); p.level = 6;
  const a = { uid: 91, id: "mewtwo", stars: 1, col: null, row: null, items: [] }, b = { uid: 92, id: "rayquaza", stars: 1, col: null, row: null, items: [] };
  p.units.push(a as any, b as any);
  assert.ok(rules.act(m, p, { a: "move", uid: 91, col: 0, row: 0 } as any).ok);
  assert.ok(!rules.act(m, p, { a: "move", uid: 92, col: 1, row: 0 } as any).ok);
});
