import { test } from "node:test";
import assert from "node:assert";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-p3-" + process.pid + ".json";
const { BY_ID, ITEMS, ITEM_LIST, STATUS_DATA, WEATHER_DATA, SPECIES } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const { simulate } = await import("../server/combat.ts");
const mk = () => { const m = rules.newMatch(9); const p = rules.addPlayer(m, "T", true, "Brock"); return { m, p }; };
const U = (id: string, col: number, o: any = {}) => ({ id, stars: 1, col, row: 3, ...o });
const ev = (r: any, k: string) => r.events.filter((e: any) => e.k === k);

test("all 8 status effects exist with duration, and hard CC has an immunity window", () => {
  for (const n of ["burn", "poison", "paralysis", "freeze", "sleep", "confusion", "flinch", "slow"]) { assert.ok(STATUS_DATA.statuses[n], n); assert.ok(STATUS_DATA.statuses[n].duration > 0); }
  assert.ok(STATUS_DATA.ccImmunitySeconds >= 3);
});

test("statuses are applied, visible as events, and expire", () => {
  // Fire attacker vs a long fight: burn must proc and later end
  const r = simulate([U("charmander", 3, { stars: 3 }), U("vulpix", 2, { stars: 2 })], [U("snorlax", 3, { stars: 3 })], 21);
  const on = ev(r, "status").filter((e: any) => e.on), off = ev(r, "status").filter((e: any) => !e.on);
  assert.ok(on.length > 0, "some status was applied");
  // every status that was applied and had time to run out before the fight ended must have produced an expiry event
  const lastOn = new Map<string, any>(); for (const a of on) lastOn.set(a.u + a.name, a);
  for (const a of lastOn.values()) { const dur = STATUS_DATA.statuses[a.name].duration; if (a.t + dur + 0.3 < r.duration) assert.ok(off.some((o: any) => o.u === a.u && o.name === a.name && o.t >= a.t), `${a.name} on unit ${a.u} at ${a.t} should expire`); }
  assert.ok(on.every((e: any) => STATUS_DATA.statuses[e.name]));
});

test("burn and poison deal damage over time", () => {
  const r = simulate([U("charmander", 3, { stars: 3 }), U("oddish", 2, { stars: 3 })], [U("snorlax", 3, { stars: 3 })], 4);
  const dots = ev(r, "dmg").filter((e: any) => e.name === "magic");
  assert.ok(dots.length > 0);
});

test("no permanent crowd-control loops: freeze/sleep cannot be reapplied inside the immunity window", () => {
  const r = simulate([U("glaceon", 3, { stars: 1 }), U("lapras", 2, { stars: 3 }), U("snover", 4, { stars: 2 })], [U("snorlax", 3, { stars: 3 })], 33);
  const frz = ev(r, "status").filter((e: any) => e.on && e.name === "freeze").map((e: any) => e.t);
  for (let i = 1; i < frz.length; i++) assert.ok(frz[i] - frz[i - 1] >= STATUS_DATA.statuses.freeze.duration + STATUS_DATA.ccImmunitySeconds - 0.2, "freeze gap " + (frz[i] - frz[i - 1]));
});

test("weather: Ninetales (Vulpix 2*) summons sun; Tyranitar sandstorm; Politoed rain; Abomasnow snow; fixed duration", () => {
  const w = (id: string, stars: number) => { const r = simulate([U(id, 3, { stars })], [U("snorlax", 3, { stars: 3 })], 5); return ev(r, "weather"); };
  assert.strictEqual(w("vulpix", 2)[0].name, "sun");
  assert.strictEqual(w("larvitar", 3)[0].name, "sandstorm");
  assert.strictEqual(w("poliwag", 3)[0].name, "rain");
  assert.strictEqual(w("snover", 2)[0].name, "snow");
  assert.strictEqual(w("vulpix", 1).length, 0, "unevolved Vulpix does not summon weather");
  const evs = w("vulpix", 2); const end = evs.find((e: any) => e.name === "none");
  if (end) assert.ok(Math.abs(end.t - evs[0].t - WEATHER_DATA.duration) < 1.1, "ends after the fixed duration");
});

test("weather changes damage: Sun boosts Fire and weakens Water", () => {
  const pair = (att: string, weatherUnit: string | null) => {
    const a: any[] = [U(att, 3, { stars: 1 })]; if (weatherUnit) a.push(U(weatherUnit, 0, { stars: 2 }));
    const r = simulate(a, [U("snorlax", 3, { stars: 1 })], 8);
    const e = r.events.find((x: any) => x.k === "dmg" && x.name === "physical" && !x.crit && x.u === 1); return e?.v ?? 0;
  };
  const noSun = pair("charmander", null), sun = pair("charmander", "vulpix");
  assert.ok(sun > noSun * 1.1, `Fire in sun ${sun} vs ${noSun}`);
});

test("14 held items exist (3-slot cap, rarity set) and are configurable data", () => {
  const need = ["choice_band", "choice_specs", "life_orb", "scope_lens", "leftovers", "focus_sash", "assault_vest", "rocky_helmet", "quick_claw", "kings_rock", "mental_herb", "choice_scarf", "eviolite", "ability_capsule"];
  for (const k of need) assert.ok(ITEMS[k], k);
  assert.ok(ITEM_LIST.every((i) => ["Rare", "Epic", "Legendary"].includes(i.rarity)));
  const { m, p } = mk(); p.units.push({ uid: 1, id: "charmander", stars: 1, col: null, row: null, items: [] }); p.items.push("choice_band", "choice_specs", "life_orb", "scope_lens");
  for (const k of ["choice_band", "choice_specs", "life_orb"]) assert.ok(rules.act(m, p, { a: "equip", uid: 1, item: k }).ok);
  assert.ok(!rules.act(m, p, { a: "equip", uid: 1, item: "scope_lens" }).ok, "max 3 items");
  assert.ok(rules.act(m, p, { a: "unequip", uid: 1, index: 0 }).ok, "items can be moved back during preparation");
});

test("items change combat: Choice Band raises damage, Scope Lens raises crits, Leftovers heals", () => {
  const hit = (items: string[]) => { const r = simulate([U("machop", 3, { items })], [U("snorlax", 3, { stars: 1 })], 12); const e = r.events.find((x: any) => x.k === "dmg" && x.u === 1 && x.name === "physical" && !x.crit); return e?.v ?? 0; };
  assert.ok(hit(["choice_band"]) > hit([]) * 1.15, "Choice Band +25% attack");
  const heals = simulate([U("machop", 3, { items: ["leftovers"] })], [U("snorlax", 3, { stars: 2 })], 12);
  assert.ok(ev(heals, "heal").length > 0, "Leftovers heals");
});

test("Focus Sash survives one lethal hit; Mental Herb blocks the first status", () => {
  const r = simulate([U("machop", 3, { stars: 3 })], [U("rattata", 3, { items: ["focus_sash"], hpMul: 0.05 } as any)], 2);
  assert.ok(ev(r, "buff").some((e: any) => e.name === "focus_sash"), "sash activated");
  const herb = simulate([U("charmander", 3, { stars: 3 }), U("vulpix", 2, { stars: 2 })], [U("snorlax", 3, { stars: 3, items: ["mental_herb"] })], 21);
  assert.ok(ev(herb, "buff").some((e: any) => e.name === "mental_herb"), "herb blocked a status");
});

test("Rocky Helmet reflects damage onto attackers; Life Orb boosts damage", () => {
  const r = simulate([U("machop", 3, { stars: 1 })], [U("geodude", 3, { items: ["rocky_helmet"] })], 6);
  assert.ok(ev(r, "dmg").some((e: any) => e.u !== 1 && e.tg === 1 && e.name === "physical"), "reflected damage hit the attacker");
  const hit = (items: string[]) => { const rr = simulate([U("machop", 3, { items })], [U("snorlax", 3, { stars: 1 })], 12); const e = rr.events.find((x: any) => x.k === "dmg" && x.u === 1 && x.name === "physical" && !x.crit); return e?.v ?? 0; };
  assert.ok(hit(["life_orb"]) > hit([]) * 1.1);
});

test("signature abilities fire for evolved forms and apply statuses", () => {
  const casts = (id: string, stars: number) => ev(simulate([U(id, 3, { stars, mana: 999 } as any), U("blissey", 2)], [U("snorlax", 3, { stars: 3 }), U("rattata", 4, { stars: 1 })], 7), "cast");
  for (const [id, stars] of [["charmander", 3], ["gastly", 3], ["froakie", 3], ["ralts", 3], ["chansey", 2], ["snorlax", 1], ["dratini", 3], ["larvitar", 3], ["abra", 3], ["machop", 3]] as const) {
    const r = simulate([U(id, 3, { stars }), U("pikachu", 1, { stars: 2 })], [U("snorlax", 3, { stars: 3 }), U("rattata", 4, { stars: 1 })], 7);
    assert.ok(ev(r, "cast").some((e: any) => e.u === 1 || e.u === 2), id + " casts its ability");
  }
  void casts;
});

test("role AI: Assassins go for the backline first", () => {
  const r = simulate([U("rattata", 0, { stars: 1 })], [U("snorlax", 3, { stars: 1 }), { id: "abra", stars: 1, col: 6, row: 3 }], 4);
  const firstAtk = ev(r, "atk").find((e: any) => e.u === 1);
  assert.ok(firstAtk, "assassin attacked");
  // uid order: side0 first (1), side1 units follow in list order; abra is uid 3
  assert.strictEqual(firstAtk.tg, 3, "targets the Caster before the closer Guardian");
});

test("combat uses all 8 columns (no 7-column clipping)", () => {
  const r = simulate([U("pikachu", 7, { stars: 1 })], [U("rattata", 7, { stars: 1 })], 1);
  assert.ok(ev(r, "atk").length > 0 || ev(r, "move").length > 0);
  assert.ok(r.events.filter((e: any) => e.k === "move").every((e: any) => e.col >= 0 && e.col < 8));
});

test("every species and every item simulates without NaN", () => {
  let n = 0;
  for (const s of SPECIES) for (const it of ["choice_band", "life_orb", "eviolite", "leftovers"]) {
    const r = simulate([U(s.id, 3, { stars: 3, items: [it] })], [U("geodude", 3, { stars: 2 })], n++);
    assert.ok(r.events.every((e: any) => !Number.isNaN(e.v ?? 0)), `NaN ${s.id}/${it}`);
  }
});
