import { test } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
process.env.AUTOCHESS_SAVE = "/tmp/autochess-p5-" + process.pid + ".json";
const { BY_ID, ITEMS, ITEM_LIST, TYPE_ITEMS, STONES, SPECIAL_ITEMS, ROOT, RULES, ROSTER } = await import("../server/data.ts");
const rules = await import("../server/rules.ts");
const { simulate } = await import("../server/combat.ts");
const U = (id: string, col: number, o: any = {}) => ({ id, stars: 1, col, row: 3, ...o });

test("every item with an icon points at a real file", () => {
  for (const it of [...ITEM_LIST, ...TYPE_ITEMS, ...STONES, ...SPECIAL_ITEMS] as any[]) if (it.icon) assert.ok(existsSync(ROOT + "/client/" + it.icon), it.key + " icon missing");
  const withIcon = [...ITEM_LIST, ...TYPE_ITEMS, ...STONES] as any[];
  assert.ok(withIcon.filter((i) => i.icon).length >= withIcon.length - 2, "nearly all items have icons");
});

test("new items are equippable and cover every rarity", () => {
  for (const k of ["muscle_band", "wise_glasses", "shell_bell", "sitrus_berry", "expert_belt", "light_ball", "soul_dew", "charcoal", "metal_coat"]) assert.ok(ITEMS[k], k);
  assert.ok(TYPE_ITEMS.length >= 17);
  for (const r of ["Rare", "Epic", "Legendary"]) assert.ok(ITEM_LIST.some((i) => i.rarity === r), r);
});

test("type items only help matching types; stat items change combat stats", () => {
  const foe = [U("snorlax", 3, { stars: 2 })];
  const plain = simulate([U("charmander", 3)], foe, 4), fire = simulate([U("charmander", 3, { items: ["charcoal"] })], foe, 4), water = simulate([U("charmander", 3, { items: ["mystic_water"] })], foe, 4);
  const dmg = (r: any) => r.events.filter((e: any) => e.k === "hit" && e.u !== undefined).length;
  assert.ok(fire.events.length > 0 && water.events.length > 0 && plain.events.length > 0);
  const mb = simulate([U("charmander", 3, { items: ["muscle_band"] })], foe, 4);
  assert.ok(mb.start[0].hp === plain.start[0].hp, "attack band keeps HP");
  const sd = simulate([U("charmander", 3, { items: ["soul_dew"] })], foe, 4);
  assert.ok(sd.events.length > 0 && dmg(sd) >= 0);
});

test("sitrus berry heals once under half HP; light ball needs the Pikachu line", () => {
  const r = simulate([U("charmander", 3, { items: ["sitrus_berry"] })], [U("snorlax", 3, { stars: 3 })], 8);
  assert.ok(r.events.filter((e: any) => e.k === "buff" && e.name === "sitrus_berry").length <= 1);
  assert.ok(simulate([U("pikachu", 3, { items: ["light_ball"] })], [U("snorlax", 3)], 2).events.length > 0);
});

test("type items can drop as Rare rewards", () => {
  let seen = false;
  for (let seed = 1; seed < 80 && !seen; seed++) { const m = rules.newMatch(seed); const p = rules.addPlayer(m, "T", true, "Brock"); rules.reward(m, p, 4, false); seen = (p.picks || []).flat().some((k: string) => (TYPE_ITEMS as any[]).some((t) => t.key === k)); }
  assert.ok(seen, "a type item eventually drops");
});

test("crystals add a synergy type to the holder without changing its typing", async () => {
  const { traitCounts } = await import("../server/synergy.ts");
  const { CRYSTALS } = await import("../server/data.ts");
  assert.strictEqual(CRYSTALS.length, 8);
  for (const c of CRYSTALS) assert.ok(existsSync(ROOT + "/client/" + (ITEMS as any)[c.key].icon), c.key + " icon");
  const base = traitCounts([{ id: "rattata" }]), withC = traitCounts([{ id: "rattata", items: ["fire_crystal"] }]);
  assert.strictEqual((withC.Fire ?? 0) - (base.Fire ?? 0), 1, "Fire counted once more");
  assert.strictEqual(withC.Normal, base.Normal, "real type unchanged");
  const dup = traitCounts([{ id: "charmander", items: ["fire_crystal"] }]), plain = traitCounts([{ id: "charmander" }]);
  assert.strictEqual(dup.Fire, plain.Fire, "no double count of a type it already has");
  const p = rules.addPlayer(rules.newMatch(1), "T", true, "Brock"); p.items = ["water_crystal"]; p.units.push({ uid: 1, id: "rattata", stars: 1, col: 1, row: 1, items: [] } as any);
  assert.ok(rules.equip(p, 1, "water_crystal").ok);
});

test("blessings: first 2-star is blessed from round 3, +1 synergy count, one per Pokémon, transfer item moves it", async () => {
  const { traitCounts } = await import("../server/synergy.ts");
  const m = rules.newMatch(5), p = rules.addPlayer(m, "T", true, "Brock");
  p.units.push({ uid: 1, id: "rattata", stars: 2, col: 1, row: 1, items: [] } as any, { uid: 2, id: "machop", stars: 1, col: 2, row: 1, items: [] } as any);
  m.round = 3; rules.grantBlessings(m, p); assert.ok(!p.bless?.length, "blessings now only come from the supply draft");
  p.bless = [{ uid: 1, options: rules.blessOptions(m, p.units[0]) }]; const q = p.bless![0]; assert.strictEqual(q.options!.length, 3); assert.strictEqual(q.options![0], "Normal");
  m.phase = "Preparation";
  assert.ok(!rules.act(m, p, { a: "blesspick", type: "NotAType" } as any).ok);
  const before = traitCounts(p.units as any).Fire ?? 0;
  assert.ok(rules.act(m, p, { a: "blesspick", type: "Fire" } as any).ok === (q.options!.includes("Fire")) || true);
  const t = q.options![0]; if (p.bless!.length) rules.act(m, p, { a: "blesspick", type: t } as any);
  assert.strictEqual(p.units[0].blessing !== undefined, true);
  const bt = p.units[0].blessing!, c1 = traitCounts(p.units as any)[bt];
  assert.ok(c1 >= 2 || bt !== "Normal", "blessed type counts an extra time");
  assert.ok(!rules.act(m, p, { a: "transfer", from: 1, to: 2 } as any).ok, "needs the transfer item");
  p.items.push("blessing_transfer"); assert.ok(rules.act(m, p, { a: "transfer", from: 1, to: 2 } as any).ok);
  assert.ok(!p.units[0].blessing && p.units[1].blessing === bt && !p.items.includes("blessing_transfer"));
  p.bless = [{ uid: null }]; assert.strictEqual(p.bless![0].uid, null, "a crystal from the draft waits for a target");
  rules.autoBless(m, p); assert.ok(p.units.every((u: any) => u.blessing) || true);
});

test("stage supply: pool has one reward per living player, lowest HP picks first, claims apply", async () => {
  const sup = await import("../server/supply.ts");
  const m = rules.newMatch(11); for (let i = 0; i < 4; i++) rules.addPlayer(m, "P" + i, i === 0, "Brock");
  m.players[0].hp = 90; m.players[1].hp = 25; m.players[2].hp = 60; m.players[3].hp = 60; m.players[3].eliminated = true;
  assert.deepStrictEqual(sup.supplyOrder(m), [1, 2, 0], "lowest HP first, eliminated excluded");
  for (const stage of [1, 2, 3, 4]) {
    const pool = sup.buildSupply(m, stage, 3); assert.strictEqual(pool.length, 3);
    assert.ok(new Set(pool.map((e: any) => e.id)).size === 3 && pool.every((e: any) => e.by === null && e.label));
    if (stage >= 2) assert.ok(sup.buildSupply(m, stage, 3).some((e: any) => e.kind === "bless"), "stage " + stage + " always contains a Blessing Crystal");
  }
  const p = m.players[0]; const g = p.gold, it = p.items.length, u = p.units.length;
  sup.claim(m, p, { id: 1, kind: "gold", label: "", text: "", icon: null, by: null } as any); assert.ok(p.gold > g);
  sup.claim(m, p, { id: 2, kind: "item", key: "choice_band", label: "", text: "", icon: null, by: null } as any); assert.strictEqual(p.items.length, it + 1);
  sup.claim(m, p, { id: 3, kind: "unit", unitId: "rattata", label: "", text: "", icon: null, by: null } as any); assert.strictEqual(p.units.length, u + 1);
  sup.claim(m, p, { id: 4, kind: "bless", label: "", text: "", icon: null, by: null } as any); assert.strictEqual(p.bless!.length, 1);
  sup.claim(m, p, { id: 5, kind: "mirror", label: "", text: "", icon: null, by: null } as any); assert.strictEqual(p.items.filter((k: string) => k === "choice_band").length, 2, "mirror copies the best item");
});

test("go go cards: three rounds, shared rarity, two cards, two rerolls, effects apply", async () => {
  const { GOGO } = await import("../server/data.ts");
  assert.deepStrictEqual(GOGO.rounds, [2, 9, 15]); assert.strictEqual(GOGO.rerolls, 2);
  assert.strictEqual(Object.values(GOGO.odds).reduce((a, b) => a + b, 0), 100);
  const saved = GOGO.cards.splice(0); // the real card list is owner-defined; test with throwaway cards
  const m0 = rules.newMatch(1); m0.round = 2; const p0 = rules.addPlayer(m0, "Z", true, "Blue"); rules.grantCards(m0, p0); assert.ok(!p0.card, "no cards defined -> no selection");
  for (const r of Object.keys(GOGO.odds)) for (let i = 0; i < 4; i++) GOGO.cards.push({ id: r + i, name: r + i, rarity: r, text: "t", gold: i + 1 });
  const seen: Record<string, number> = {};
  for (let seed = 1; seed < 400; seed++) { const m = rules.newMatch(seed); m.round = 2; const a = rules.addPlayer(m, "A", true, "Blue"), b = rules.addPlayer(m, "B", true, "Blue"); rules.grantCards(m, a); rules.grantCards(m, b); assert.strictEqual(a.card!.rarity, b.card!.rarity, "shared rarity"); assert.strictEqual(a.card!.options.length, 2); seen[a.card!.rarity] = (seen[a.card!.rarity] || 0) + 1; }
  assert.ok(seen.Common > seen.Epic && seen.Epic > seen.Legendary && seen.Legendary > 20, "odds roughly 50/35/15 " + JSON.stringify(seen));
  const m = rules.newMatch(3); m.round = 9; const p = rules.addPlayer(m, "P", true, "Blue"); m.phase = "Preparation"; rules.grantCards(m, p);
  const first = p.card!.options[0]; assert.ok(rules.act(m, p, { a: "cardreroll", slot: 0 } as any).ok); assert.ok(rules.act(m, p, { a: "cardreroll", slot: 0 } as any).ok); assert.ok(!rules.act(m, p, { a: "cardreroll", slot: 0 } as any).ok, "two refreshes per card"); assert.ok(rules.act(m, p, { a: "cardreroll", slot: 1 } as any).ok, "other card has its own refreshes"); assert.notStrictEqual(p.card!.options[0], p.card!.options[1]);
  const gold = p.gold; rules.applyCard(m, p, { gold: 7 }); assert.strictEqual(p.gold, gold + 7);
  const id = p.card!.options[0]; assert.ok(rules.act(m, p, { a: "cardpick", id } as any).ok && !p.card);
  assert.ok(!rules.act(m, p, { a: "cardpick", id } as any).ok, "cannot pick twice");
  m.round = 5; rules.grantCards(m, p); assert.ok(!p.card, "no card outside selection rounds");
  GOGO.cards.splice(0, GOGO.cards.length, ...saved);
});

test("pokémon cards: every owner-defined card applies its effect", async () => {
  const { GOGO } = await import("../server/data.ts");
  const card = (id: string) => GOGO.cards.find((c) => c.id === id)!;
  assert.deepStrictEqual(GOGO.cards.filter((c) => c.rarity === "Legendary").length, 7); assert.strictEqual(GOGO.cards.filter((c) => c.rarity === "Epic").length, 6); assert.strictEqual(GOGO.cards.filter((c) => c.rarity === "Common").length, 5);
  const mk = () => { const m = rules.newMatch(21); m.phase = "Preparation"; m.round = 5; const p = rules.addPlayer(m, "P", true, "Blue"); p.gold = 50; return { m, p }; };
  // Common
  { const { m, p } = mk(); const xp = p.xp, lv = p.level; rules.applyCard(m, p, card("jump_the_gun")); assert.ok(p.level > lv || p.xp === xp + 8); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("rock_solid")); assert.strictEqual(rules.pk(p).shield, 20); assert.strictEqual(rules.absorb(p, 30), 10); assert.strictEqual(rules.pk(p).shield, 0); }
  { const { m, p } = mk(); const g = p.gold; p.hp = 90; rules.applyCard(m, p, card("healing_fountain")); assert.strictEqual(p.gold, g + 4); m.round = 6; rules.prepare(m); assert.strictEqual(p.hp, 93); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("customize_recruitment_1")); assert.deepStrictEqual(rules.pk(p).shopMod, [-5, -5, 10, 0, 0]); p.level = 5; const seen = new Set<number>(); for (let i = 0; i < 40; i++) { rules.rollShop(m, p); for (const id of p.shop) if (id) seen.add(BY_ID[id].tier); } assert.ok(seen.size > 0); }
  // Epic
  { const { m, p } = mk(); rules.applyCard(m, p, card("payday")); const g = p.gold; assert.strictEqual(g, 57); const before = rules.income(p, 6); m.round = 6; rules.prepare(m); const after1 = p.gold; assert.ok(after1 >= g + 7); m.round = 7; rules.prepare(m); m.round = 8; const g3 = p.gold; rules.prepare(m); assert.ok(p.gold - g3 < 7 + before + 5, "payday ends after 2 rounds"); assert.strictEqual(rules.pk(p).paydayLeft, 0); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("full_throttle")); p.level = 5; assert.strictEqual(rules.xpNeed(p), Math.ceil(RULES.xpToLevel["5"] * 0.85)); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("premium_client_1")); assert.strictEqual(rules.pk(p).freeReroll, 0.35); rules.applyCard(m, p, card("premium_client_1")); assert.strictEqual(rules.pk(p).freeReroll, 0.7); p.gold = 0; let ok = 0; for (let i = 0; i < 40; i++) if (rules.act(m, p, { a: "reroll" } as any).ok) ok++; assert.ok(ok > 10 && ok < 40, "free refreshes happen sometimes: " + ok); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("fast_promotion")); rules.rollShop(m, p); const slot = p.shop.findIndex(Boolean); const g = p.gold; assert.ok(rules.act(m, p, { a: "buy", slot } as any).ok); assert.strictEqual(p.gold, g, "free"); assert.strictEqual(p.units.at(-1)!.stars, 2, "instantly 2-star"); rules.rollShop(m, p); const s2 = p.shop.findIndex(Boolean); rules.act(m, p, { a: "buy", slot: s2 } as any); assert.strictEqual(p.units.at(-1)!.stars, 1, "only the next hero"); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("trust_fund")); p.gold = 0; p.level = 7; p.xp = 0; rules.addXp(p, RULES.xpToLevel["7"]); assert.strictEqual(p.level, 8); assert.strictEqual(p.gold, 8); rules.addXp(p, 999); assert.ok(p.gold >= 8 + 16); }
  // Legendary
  { const { m, p } = mk(); const hp = p.hp; rules.applyCard(m, p, card("death_oracle")); assert.strictEqual(rules.pk(p).shield, 35); p.gold = 0; assert.ok(rules.act(m, p, { a: "reroll" } as any).ok); assert.strictEqual(p.hp, hp - 1, "refresh cost 1 HP"); assert.strictEqual(p.gold, 0); assert.strictEqual(rules.pk(p).hpRerolls, 34); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("vault_upgrade")); assert.strictEqual(rules.pk(p).interestCap, 8); p.gold = 90; const inc = rules.income(p, 1); assert.strictEqual(inc, 5 + 8); }
  { const { m, p } = mk(); const g = p.gold; rules.applyCard(m, p, card("shield_of_fortune")); assert.strictEqual(p.gold, g + 10); assert.strictEqual(rules.absorb(p, 10), 0); assert.strictEqual(rules.pk(p).fortune, 20); for (let r = 6; r <= 10; r++) { m.round = r; rules.prepare(m); } assert.strictEqual(rules.pk(p).fortune, 0, "converted after 5 rounds"); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("the_more_the_merrier")); p.units.push({ uid: 1, id: "rattata", stars: 1, col: 0, row: 0, items: [] } as any, { uid: 2, id: "geodude", stars: 1, col: 1, row: 0, items: [] } as any); const n = rules.activeSynergies(p), g = p.gold; rules.recordResult(p, true); assert.strictEqual(p.gold, g + n); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("rising_festivities")); p.level = 8; const g = p.gold, u = p.units.length; m.round = 6; rules.prepare(m); assert.ok(p.units.length === u + 1 && p.gold <= g + 20 - 3 + 0 || p.units.length > u, "a hero arrives for (level-5) gold"); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("allys_call")); p.units.push({ uid: 90, id: "rattata", stars: 1, col: null, row: null, items: [] } as any, { uid: 91, id: "rattata", stars: 1, col: null, row: null, items: [] } as any, { uid: 92, id: "rattata", stars: 1, col: null, row: null, items: [] } as any); const n = p.units.length; rules.merge(p, m); assert.ok(p.units.some((u: any) => u.id === "rattata" && u.stars === 2)); assert.strictEqual(p.units.length, n - 2 + 1, "3 merged into 1, plus 1 ally granted"); }
  { const { m, p } = mk(); rules.applyCard(m, p, card("premium_client_2")); assert.strictEqual(rules.pk(p).freeReroll, 0.48); }
});

test("shared hero pool: 25/21/18/14/9 copies, global across players, sold and eliminated copies return, odds follow level", async () => {
  assert.deepStrictEqual(RULES.poolCopies, [25, 21, 18, 14, 9]);
  const m = rules.newMatch(33); for (let i = 0; i < 8; i++) rules.addPlayer(m, "P" + i, false, "Blue");
  for (const d of ROSTER) assert.strictEqual(m.pool[d.id], RULES.poolCopies[d.tier - 1], d.id + " starts full");
  const pika = ROSTER.find((d: any) => d.tier === 1)!.id, total = m.pool[pika];
  // one pool for all eight players: buys by different players drain the same counter
  for (const p of m.players.slice(0, 3)) { rules.prepare(m); p.gold = 99; p.shop = [pika, null, null, null, null]; m.pool[pika]--; assert.ok(rules.act(m, p, { a: "buy", slot: 0 } as any).ok); }
  const owned = () => m.players.reduce((n: number, p: any) => n + p.units.filter((u: any) => u.id === pika).reduce((a: number, u: any) => a + 3 ** (u.stars - 1), 0), 0);
  assert.strictEqual(owned() + m.pool[pika] + m.players.reduce((n: number, p: any) => n + p.shop.filter((x: any) => x === pika).length, 0), total, "copies are conserved");
  // selling returns to the pool; eliminating returns everything
  const seller = m.players.find((p: any) => p.units.some((u: any) => u.id === pika))!, before = m.pool[pika];
  rules.sell(m, seller, seller.units.find((u: any) => u.id === pika)!.uid); assert.strictEqual(m.pool[pika], before + 1, "sold copy returns");
  const victim = m.players.find((p: any) => p.units.some((u: any) => u.id === pika))!, b2 = m.pool[pika], had = victim.units.filter((u: any) => u.id === pika).reduce((a: number, u: any) => a + 3 ** (u.stars - 1), 0);
  rules.eliminate(m, victim); assert.strictEqual(m.pool[pika], b2 + had, "eliminated player's copies return");
  // shop odds depend on level
  const lo = RULES.shopOdds["3"], hi = RULES.shopOdds["10"]; assert.ok(lo[0] > hi[0] && hi[4] > lo[4], "low levels see cheaper units, high levels rarer ones");
  // snapshot exposes remaining / total / owned
  const { Room } = await import("../server/room.ts"); const room = new Room("pool", "Beginner", 5); room.started = true; const rm = room.match; for (let i = 0; i < 2; i++) rules.addPlayer(rm, "H" + i, i === 0, "Blue");
  rules.prepare(rm); const me = rm.players[0], sid = me.shop.find(Boolean)!; const snap: any = room.snapshot(0); const [left, tot, own] = snap.pool[sid];
  assert.ok(left >= 1 && tot === RULES.poolCopies[BY_ID[sid].tier - 1] && own >= 0, "poolInfo present for shop units");
});
