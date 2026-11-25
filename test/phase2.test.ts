import { test } from "node:test";
import assert from "node:assert";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-p2-" + process.pid + ".json";
const { BY_ID, SPECIES, ROSTER, STONES, RULES, TYPE_CHART } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const syn = await import("../server/synergy.ts");
const { simulate } = await import("../server/combat.ts");
const mk = () => { const m = rules.newMatch(5); const p = rules.addPlayer(m, "T", true, "Brock"); return { m, p }; };

test("database: every species has the required fields and valid types", () => {
  for (const s of SPECIES) {
    for (const k of ["id", "name", "generation", "types", "cost", "rarity", "hp", "attack", "spAttack", "defence", "spDefence", "speed", "range", "maxMana", "role", "ability", "evolutionFamily", "evolutionLine", "legendary", "model", "portrait"]) assert.ok(s[k] !== undefined, `${s.id}.${k}`);
    assert.ok(s.types.length >= 1 && s.types.length <= 2 && s.types.every((t: string) => TYPE_CHART.types.includes(t)), s.id + " types");
    assert.ok(s.cost >= 1 && s.cost <= 5);
  }
  assert.strictEqual(TYPE_CHART.types.length, 18);
});

test("shop never sells evolution-only forms", () => {
  assert.ok(ROSTER.every((d) => !d.evolutionOnly));
  const { m, p } = mk(); p.level = 10;
  for (let i = 0; i < 100; i++) { rules.rollShop(m, p); for (const id of p.shop) if (id) assert.ok(!BY_ID[id].evolutionOnly); }
});

test("type chart: real matchups and configurable multipliers", () => {
  const M = TYPE_CHART.multipliers;
  assert.strictEqual(syn.typeMultiplier(["Fire"], ["Grass"]), M.superEffective);
  assert.strictEqual(syn.typeMultiplier(["Water"], ["Fire"]), M.superEffective);
  assert.strictEqual(syn.typeMultiplier(["Fire"], ["Water"]), M.notVeryEffective);
  assert.strictEqual(syn.typeMultiplier(["Normal"], ["Ghost"]), M.immune);
  assert.strictEqual(syn.typeMultiplier(["Electric"], ["Ground"]), M.immune);
  assert.strictEqual(syn.typeMultiplier(["Normal"], ["Normal"]), 1);
  assert.strictEqual(syn.typeMultiplier(["Water"], ["Rock", "Ground"]), M.maxMultiplier, "double super effective is capped at 1.60");
  assert.strictEqual(syn.typeMultiplier(["Normal"], ["Ghost", "Steel"]), M.minMultiplier, "double resistance floors at 0.55");
  assert.strictEqual(syn.typeMultiplier(["Fire", "Flying"], ["Grass"]), M.superEffective, "dual attacker uses its best type");
  assert.strictEqual(syn.typeMultiplier(undefined, ["Fire"]), 1);
});

test("dual-type Pokémon contribute to both types; duplicates count once", () => {
  const c = syn.traitCounts([{ id: "gastly" }, { id: "gastly" }, { id: "bulbasaur" }, { id: "charmander" }]);
  assert.strictEqual(c.Ghost, 1); assert.strictEqual(c.Poison, 2); assert.strictEqual(c.Grass, 1); assert.strictEqual(c.Fire, 1);
  assert.strictEqual(c.Assassin, 1); assert.strictEqual(c.Support, 1);
});

test("synergy thresholds activate and stack: Fire 2/4/6/8, Fairy is team-wide", () => {
  assert.deepStrictEqual(RULES.synergies.Fire.thresholds, [2, 4, 6, 8]);
  assert.strictEqual(syn.tierOf("Fire", 1), 0); assert.strictEqual(syn.tierOf("Fire", 2), 1); assert.strictEqual(syn.tierOf("Fire", 5), 2); assert.strictEqual(syn.tierOf("Fire", 8), 4);
  assert.strictEqual(syn.typeBonuses({ Fire: 2 }, ["Fire"]).atkPct, 0.10);
  assert.strictEqual(syn.typeBonuses({ Fire: 4 }, ["Fire"]).atkPct, 0.20);
  assert.strictEqual(syn.typeBonuses({ Fire: 4 }, ["Water"]).atkPct, undefined, "non-Fire units get nothing");
  assert.ok((syn.typeBonuses({ Fairy: 2 }, ["Fire"]).healPower ?? 0) > 0, "Fairy buffs the whole team");
  const both = syn.typeBonuses({ Fire: 2, Dragon: 2 }, ["Fire", "Dragon"]); assert.ok(both.atkPct && both.dmgMul, "dual type receives both");
  assert.ok(Object.keys(RULES.synergies).length === 18, "all 18 types have a synergy definition");
});

test("synergies change actual combat results", () => {
  const unit = (id: string, col: number) => ({ id, stars: 1, col, row: 3 });
  const base = simulate([unit("charmander", 3)], [unit("rattata", 3)], 11);
  const buffed = simulate([unit("charmander", 3), unit("vulpix", 2)], [unit("rattata", 3), unit("pidgey", 2)], 11);
  assert.notDeepStrictEqual(base.events.length, buffed.events.length);
});

test("type effectiveness changes damage dealt in combat (Fire vs Grass > Normal > Water)", () => {
  const ratio = (def: string) => {
    const r = simulate([{ id: "charmander", stars: 1, col: 3, row: 3 }], [{ id: def, stars: 1, col: 3, row: 3 }], 3);
    const e = r.events.find((x: any) => x.k === "dmg" && x.u === 1 && x.name === "physical" && !x.crit)!;
    assert.ok(e, "a normal hit happened vs " + def);
    return (e.v * (100 + BY_ID[def].armor)) / (100 * BY_ID.charmander.attack);
  };
  assert.ok(Math.abs(ratio("oddish") - 1.35) < 0.08, "Fire vs Grass/Poison ~1.35: " + ratio("oddish"));
  assert.ok(Math.abs(ratio("magikarp") - 0.8) < 0.08, "Fire vs Water ~0.80: " + ratio("magikarp"));
  assert.ok(Math.abs(ratio("rattata") - 1) < 0.08, "Fire vs Normal ~1.00: " + ratio("rattata"));
});

test("eevee branches with all eight stones; stars and items carry over", () => {
  assert.strictEqual(STONES.length, 8);
  const map = BY_ID.eevee.stoneEvolutions!; assert.strictEqual(Object.keys(map).length, 8);
  for (const [stone, target] of Object.entries(map)) {
    const { m, p } = mk(); void m;
    p.units.push({ uid: 1, id: "eevee", stars: 2, col: null, row: null, items: ["choice_band"] }); p.items.push(stone);
    assert.ok(rules.act(m, p, { a: "evolve", uid: 1, stone }).ok, stone);
    assert.strictEqual(p.units[0].id, target); assert.strictEqual(p.units[0].stars, 2); assert.deepStrictEqual(p.units[0].items, ["choice_band"]);
    assert.ok(!p.items.includes(stone), "stone is consumed");
  }
});

test("evolution is validated: wrong stone, missing stone, wrong species, bad unit", () => {
  const { m, p } = mk();
  p.units.push({ uid: 1, id: "eevee", stars: 1, col: null, row: null, items: [] }, { uid: 2, id: "charmander", stars: 1, col: null, row: null, items: [] });
  assert.ok(!rules.act(m, p, { a: "evolve", uid: 1, stone: "fire_stone" }).ok, "no stone owned");
  p.items.push("fire_stone");
  assert.ok(!rules.act(m, p, { a: "evolve", uid: 2, stone: "fire_stone" }).ok, "charmander has no stone evolution");
  assert.ok(!rules.act(m, p, { a: "evolve", uid: 9, stone: "fire_stone" }).ok, "unknown unit");
  assert.ok(!rules.act(m, p, { a: "evolve", uid: 1, stone: "bogus" }).ok, "bogus stone");
  assert.ok(!rules.act(m, p, { a: "equip", uid: 1, item: "fire_stone" }).ok, "stones cannot be equipped");
});

test("evolved Eevee returns to the Eevee pool when sold", () => {
  const { m, p } = mk(); rules.prepare(m); p.gold = 99;
  const before = m.pool.eevee;
  p.units.push({ uid: 7, id: "flareon", stars: 1, col: null, row: null, items: [] });
  rules.sell(m, p, 7); assert.strictEqual(m.pool.eevee, before + 1); assert.ok(Number.isFinite(m.pool.eevee));
});

test("evolution lines for star-ups: Charmander, Gastly, Dratini, Ralts", () => {
  assert.deepStrictEqual(BY_ID.charmander.evolutionLine, ["charmander", "charmeleon", "charizard"]);
  assert.deepStrictEqual(BY_ID.gastly.evolutionLine, ["gastly", "haunter", "gengar"]);
  assert.deepStrictEqual(BY_ID.dratini.evolutionLine, ["dratini", "dragonair", "dragonite"]);
  assert.deepStrictEqual(BY_ID.ralts.evolutionLine, ["ralts", "kirlia", "gardevoir"]);
});

test("3-star upgrade scales stats; Pokémon without chains still star up", () => {
  const solo = simulate([{ id: "snorlax", stars: 3, col: 3, row: 3 }], [{ id: "rattata", stars: 1, col: 3, row: 3 }], 4);
  assert.strictEqual(solo.winner, 0);
  const { p } = mk(); for (let i = 0; i < 3; i++) p.units.push({ uid: i + 1, id: "snorlax", stars: 1, col: null, row: null, items: [] });
  rules.merge(p); assert.strictEqual(p.units[0].stars, 2);
});
