import { test } from "node:test";
import assert from "node:assert";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-test-profiles-" + process.pid + ".json";
const { ROSTER, ITEMS, ITEM_LIST } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const { simulate } = await import("../server/combat.ts");
const { Room } = await import("../server/room.ts");
const prof = await import("../server/profiles.ts");

function player(commander = "Blue") {
  const m = rules.newMatch(1);
  const p = rules.addPlayer(m, "T", true, commander);
  return { m, p };
}

test("equip / unequip rules", () => {
  const { m, p } = player();
  p.units.push({ uid: 1, id: "charmander", stars: 1, col: null, row: null, items: [] });
  p.items.push("choice_band", "choice_band", "leftovers", "scope_lens", "quick_claw");
  assert.ok(rules.act(m, p, { a: "equip", uid: 1, item: "choice_band" }).ok);
  assert.ok(!rules.act(m, p, { a: "equip", uid: 1, item: "choice_band" }).ok, "no duplicate item on one fighter");
  assert.ok(rules.act(m, p, { a: "equip", uid: 1, item: "leftovers" }).ok);
  assert.ok(rules.act(m, p, { a: "equip", uid: 1, item: "scope_lens" }).ok);
  assert.ok(!rules.act(m, p, { a: "equip", uid: 1, item: "quick_claw" }).ok, "max 3 items");
  assert.ok(!rules.act(m, p, { a: "equip", uid: 1, item: "bogus_item" }).ok, "cannot equip what you do not own");
  assert.ok(rules.act(m, p, { a: "unequip", uid: 1, index: 0 }).ok);
  assert.strictEqual(p.units[0].items.length, 2);
  rules.sell(m, p, 1);
  assert.strictEqual(p.items.length, 5, "selling returns equipment to the bag");
});

test("reward schedule follows the original rules", () => {
  const { m, p } = player();
  rules.reward(m, p, 4, true); assert.deepStrictEqual(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").map((k) => ITEMS[k].rarity), ["Rare"]);
  p.items = []; rules.reward(m, p, 8, true); assert.strictEqual(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").length, 3); assert.ok(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").every((k) => ITEMS[k].rarity === "Epic"));
  p.items = []; rules.reward(m, p, 12, true); assert.strictEqual(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").length, 2); assert.ok(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").every((k) => ITEMS[k].rarity === "Epic"));
  p.items = []; rules.reward(m, p, 16, true); assert.strictEqual(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").length, 4); assert.ok(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").every((k) => ITEMS[k].rarity === "Legendary"));
  p.items = []; rules.reward(m, p, 16, false); assert.strictEqual(p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega").length, 1); assert.strictEqual(ITEMS[p.items.filter((k) => ITEMS[k] && ITEMS[k].rarity !== "Mega")[0]].rarity, "Rare");
  assert.ok(rules.isNpcRound(4) && !rules.isNpcRound(5) && !rules.isBossEncounter(4) && rules.isBossEncounter(8));
});

test("every fighter, every item and all bosses simulate without errors", () => {
  let n = 0;
  for (const d of ROSTER) for (const item of ITEM_LIST) {
    const r = simulate([{ id: d.id, stars: 2, col: 3, row: 3, items: [item.key] }, { id: "rattata", stars: 1, col: 2, row: 3, items: [item.key] }],
      [{ id: "geodude", stars: 2, col: 3, row: 3 }, { id: "machop", stars: 1, col: 2, row: 3 }], n++);
    assert.ok(r.events.every((e) => !Number.isNaN(e.v ?? 0)), `NaN in ${d.id}/${item.key}`);
  }
  for (const boss of ["illfang", "gleam_eyes", "skull_reaper", "kobold_sentinel", "frenzy_boar", "lizardman_lord"]) {
    const r = simulate(ROSTER.slice(0, 5).map((d, i) => ({ id: d.id, stars: 1, col: i, row: 3 })), [{ id: boss, stars: 1, col: 3, row: 3, npc: true, hpMul: 3, adMul: 2 }], 9);
    assert.ok(r.events.some((e) => e.k === "cast"), boss + " should cast");
  }
});

test("items change combat outcomes", () => {
  const team = (items: string[]) => [{ id: "charmander", stars: 1, col: 3, row: 3, items }];
  const foe = [{ id: "geodude", stars: 1, col: 3, row: 3 }];
  const bare = simulate(team([]), foe, 5), geared = simulate(team(["choice_band", "scope_lens", "life_orb"]), foe, 5);
  assert.ok(geared.duration < bare.duration || geared.winner === 0, "geared fighter should do better");
});

test("commander passives hook into combat", () => {
  const side = [{ id: "squirtle", stars: 1, col: 2, row: 3 }, { id: "pikachu", stars: 1, col: 5, row: 3 }];
  const foe = [{ id: "geodude", stars: 2, col: 3, row: 3 }];
  const plain = simulate(side, foe, 3), kirito = simulate(side, foe, 3, { commanders: ["Misty", undefined] }), levi = simulate(side, foe, 3, { commanders: ["Brock", undefined] });
  assert.notDeepStrictEqual(plain.events, kirito.events);
  assert.notDeepStrictEqual(plain.events, levi.events);
});

test("Joy earns a gold bonus and NPC rounds hand out equipment", async () => {
  process.env.PREP_SECONDS = "0";
  const room = new Room("t", "Beginner", 11);
  const got: any[] = [];
  room.join("Ana", "Joy", { send: (m: any) => got.push(m), close() {} });
  room.start();
  const p = room.match.players[0];
  room.match.round = 3; room.match.phase = "Preparation";
  if (room.timer) clearTimeout(room.timer);
  p.units.push({ uid: 99, id: "charmander", stars: 2, col: 3, row: 3, items: [] }, { uid: 98, id: "vulpix", stars: 2, col: 2, row: 3, items: [] });
  const before = p.gold; room.nextRound(); // round 4 -> creeps
  assert.ok(room.npcMeta && !room.npcMeta.boss);
  if (room.timer) clearTimeout(room.timer);
  room.combat();
  if (room.timer) clearTimeout(room.timer);
  assert.ok(got.some((m) => m.t === "combat" && m.npc), "creep fight was sent");
  const goldBefore = p.gold;
  room.timer && clearTimeout(room.timer);
  (room as any).resolveNpc([...room.fights].map(([seat, f]) => ({ a: room.match.players[seat], res: f.result })));
  if (room.timer) clearTimeout(room.timer);
  assert.ok(p.items.length >= 1, "player received equipment");
  void before; void goldBefore;
  assert.ok(room.rewards.get(0)?.length, "reward message recorded");
  assert.ok(p.gold >= goldBefore + 1, "Joy bonus gold");
});

test("ranks and persisted profiles", () => {
  prof.resetProfileCache();
  assert.strictEqual(prof.recordMatch("Rita", 8, true).delta, 0, "first matches are loss protected");
  for (let i = 0; i < 5; i++) prof.recordMatch("Rita", 1, true);
  const r = prof.recordMatch("Rita", 1, true);
  assert.strictEqual(r.profile.rp, 45 * 6);
  assert.strictEqual(prof.recordMatch("Pat", 1, false).delta, 0, "practice matches do not change RP");
  assert.strictEqual(prof.rankInfo(0).label, "Bronze III");
  assert.strictEqual(prof.rankInfo(600).tier, "Silver");
  assert.strictEqual(prof.rankInfo(4300).label, "Mythic");
  prof.resetProfileCache();
  assert.strictEqual(prof.getProfile("rita").rp, 270, "reloaded from disk");
});
