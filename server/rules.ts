// Shop, economy, merging and board rules. Ported from the Roblox AutoChess `Game` module.
import { traitCounts } from "./synergy.ts";
import { BY_ID, ITEM_LIST, ITEMS, ROSTER, RULES, SPECIAL_ITEMS, STONES, SYNERGIES, GOGO, TYPE_ITEMS, CRYSTALS } from "./data.ts";

export interface Unit { uid: number; id: string; stars: number; col: number | null; row: number | null; items: string[]; blessing?: string }
export interface Player {
  seat: number; name: string; human: boolean; hp: number; gold: number; level: number; xp: number;
  units: Unit[]; shop: (string | null)[]; shopLocked: boolean; rerolled: boolean; commander: string;
  eliminated: boolean; ready: boolean; streak: number; lastResult: "win" | "loss" | null; items: string[]; placement?: number; connected: boolean; picks?: string[][]; bless?: { uid: number | null; options?: string[] }[]; blessGiven?: boolean;
  cmd?: { used: number; water?: number; love?: number; trap?: { col: number; row: number } }; cardExtra?: number; card?: { rarity: string; options: string[]; rerolls: number[] }; cardBuff?: { hp: number; ad: number }; cardsTaken?: string[]; perks?: Perks;
}
// Go Go / Pokémon Card perks (all optional, defaults are neutral)
export interface Perks { shield: number; fortune: number; fortuneLeft: number; hpRerolls: number; freeReroll: number; fastPromo: number; paydayLeft: number; paydayAmt: number; trustFund: boolean; festive: boolean; allyCall: boolean; merrier: boolean; interestCap: number; xpMul: number; shopMod: number[]; fountain: boolean }
export const pk = (p: Player): Perks => (p.perks ||= { shield: 0, fortune: 0, fortuneLeft: 0, hpRerolls: 0, freeReroll: 0, fastPromo: 0, paydayLeft: 0, paydayAmt: 0, trustFund: false, festive: false, allyCall: false, merrier: false, interestCap: 0, xpMul: 1, shopMod: [0, 0, 0, 0, 0], fountain: false });
// Commander shield soaks battle damage (Shield of Fortune first); returns the damage that gets through.
export function absorb(p: Player, dmg: number): number {
  const k = pk(p); let d = dmg;
  const f = Math.min(k.fortune, d); k.fortune -= f; d -= f;
  const s = Math.min(k.shield, d); k.shield -= s; d -= s;
  return d;
}
export interface Match {
  round: number; phase: "Preparation" | "Combat" | "Supply" | "Finished"; pool: Record<string, number>;
  players: Player[]; nextUid: number; rng: () => number; cardRarity?: Record<number, string>;
}
type Result = { ok: true } | { ok: false; error: string };
const ok = (): Result => ({ ok: true });
const fail = (error: string): Result => ({ ok: false, error });

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newMatch(seed = Date.now()): Match {
  const pool: Record<string, number> = {};
  for (const d of ROSTER) pool[d.id] = RULES.poolCopies[d.tier - 1];
  return { round: 0, phase: "Preparation", pool, players: [], nextUid: 0, rng: mulberry32(seed) };
}

export function addPlayer(m: Match, name: string, human: boolean, commander: string): Player {
  const p: Player = {
    seat: m.players.length, name, human, hp: RULES.startHealth, gold: RULES.startGold, level: RULES.economy.startLevel, xp: 0,
    units: [], shop: [], shopLocked: false, rerolled: false, commander, eliminated: false, ready: false,
    streak: 0, lastResult: null, connected: true, items: [],
  };
  m.players.push(p);
  return p;
}

export const deployed = (p: Player) => p.units.filter((u) => u.col !== null);
export const bench = (p: Player) => p.units.filter((u) => u.col === null);

export function releaseShop(m: Match, p: Player) {
  for (const id of p.shop) if (id) m.pool[id]++;
  p.shop = [];
}

export function rollShop(m: Match, p: Player) {
  releaseShop(m, p);
  const base = RULES.shopOdds[String(p.level)] ?? RULES.shopOdds["3"], mod = pk(p).shopMod;
  const odds = base.map((v: number, i: number) => Math.max(0, v + (mod[i] ?? 0))); // card perks shift odds (percentage points)
  for (let slot = 0; slot < RULES.shopSize; slot++) {
    let roll = Math.floor(m.rng() * 100) + 1, tier = 1;
    for (let t = 0; t < odds.length; t++) { roll -= odds[t]; if (roll <= 0) { tier = t + 1; break; } }
    const candidates = ROSTER.filter((d) => d.tier === tier && m.pool[d.id] > 0);
    const total = candidates.reduce((s, d) => s + m.pool[d.id], 0);
    if (total === 0) { p.shop[slot] = null; continue; }
    let pick = Math.floor(m.rng() * total) + 1;
    for (const d of candidates) { pick -= m.pool[d.id]; if (pick <= 0) { p.shop[slot] = d.id; m.pool[d.id]--; break; } }
  }
}

// Ally's Call: a star-up grants one random Pokémon that shares at least one type with the upgraded unit.
function grantAlly(m: Match, p: Player, u: Unit) {
  const mine = BY_ID[u.id].types ?? [BY_ID[u.id].faction];
  const c = ROSTER.filter((d) => !d.evolutionOnly && d.id !== u.id && (m.pool[d.poolId ?? d.id] ?? 0) > 0 && (d.types ?? [d.faction]).some((t) => mine.includes(t)));
  if (!c.length || bench(p).length >= RULES.benchSize) return; const d = c[Math.floor(m.rng() * c.length)];
  m.pool[d.poolId ?? d.id]--; p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
}

// Three identical units of the same star level become one unit of the next level; repeats (1->2->3).
export function merge(p: Player, m?: Match) {
  let again = true;
  while (again) {
    again = false;
    for (const candidate of p.units) {
      if (candidate.stars >= 3) continue;
      const matches = p.units.filter((u) => u.id === candidate.id && u.stars === candidate.stars);
      if (matches.length < 3) continue;
      matches.sort((a, b) => Number(b.col !== null) - Number(a.col !== null)); // keep a deployed copy in place
      const keep = matches[0];
      for (const gone of matches.slice(1, 3)) { keep.blessing ||= gone.blessing; p.units.splice(p.units.indexOf(gone), 1); for (const it of gone.items) keep.items.length < 3 && !keep.items.includes(it) ? keep.items.push(it) : p.items.push(it); }
      keep.stars++; if (m && pk(p).allyCall) grantAlly(m, p, keep);
      again = true;
      break;
    }
  }
}

export function buy(m: Match, p: Player, slot: number): Result {
  const id = p.shop[slot];
  if (!id) return fail("That shop slot is empty.");
  const d = BY_ID[id];
  if (p.gold < d.tier && !(pk(p).fastPromo > 0)) return fail("Not enough gold.");
  if (bench(p).length >= RULES.benchSize) {
    const copies = p.units.filter((u) => u.id === id && u.stars === 1).length;
    if (copies < 2) return fail("Your bench is full.");
  }
  const fast = pk(p).fastPromo > 0; if (fast) pk(p).fastPromo--;
  if (!fast) p.gold -= d.tier; p.shop[slot] = null;
  p.units.push({ uid: ++m.nextUid, id, stars: fast ? 2 : 1, col: null, row: null, items: [] });
  merge(p, m);
  return ok();
}

export function sell(m: Match, p: Player, uid: number): Result {
  const i = p.units.findIndex((u) => u.uid === uid);
  if (i < 0) return fail("Select a fighter first.");
  const u = p.units[i], copies = 3 ** (u.stars - 1);
  p.items.push(...u.items);
  m.pool[BY_ID[u.id].poolId ?? u.id] += copies;
  p.gold += BY_ID[u.id].tier * copies;
  p.units.splice(i, 1);
  return ok();
}

export const validCell = (col: number, row: number) =>
  Number.isInteger(col) && Number.isInteger(row) && col >= 0 && col < RULES.cols && row >= 0 && row < RULES.rows / 2;

export function move(p: Player, uid: number, col: number | null, row: number | null): Result {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a fighter first.");
  if (col === null || row === null) {
    if (u.col !== null && bench(p).length >= RULES.benchSize) return fail("Your bench is full.");
    u.col = null; u.row = null; return ok();
  }
  if (!validCell(col, row)) return fail("Place fighters on your half of the board.");
  const other = p.units.find((v) => v.col === col && v.row === row);
  if (other === u) return ok();
  if (!other && u.col === null && deployed(p).length >= p.level) return fail("Your army is at capacity. Buy XP to expand it.");
  if (u.col === null && BY_ID[u.id].legendary) {
    const lim = RULES.economy.maxLegendaryDeployed;
    if (deployed(p).filter((v) => v !== u && BY_ID[v.id].legendary).length >= lim) return fail("Only " + lim + " Legendary Pokémon may be deployed.");
  }
  if (other) { other.col = u.col; other.row = u.row; }
  u.col = col; u.row = row;
  return ok();
}

export function equip(p: Player, uid: number, item: string): Result {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a fighter first.");
  const bagIdx = p.items.indexOf(item);
  if (bagIdx < 0) return fail("You do not own that equipment.");
  if (!ITEMS[item] || (ITEMS[item] as any).transfer) return fail("That item cannot be equipped.");
  if (u.items.length >= 3) return fail("A fighter can carry up to 3 pieces of equipment.");
  if (u.items.includes(item)) return fail("That fighter already carries this equipment.");
  p.items.splice(bagIdx, 1); u.items.push(item); return ok();
}
// Branching evolution: an Evolution Stone turns a compatible species (Eevee) into one of its listed forms. Stars and items carry over.
export function evolve(p: Player, uid: number, stone: string): Result {
  const u = p.units.find((x) => x.uid === uid);
  if (!u) return fail("Select a Pokémon first.");
  const target = BY_ID[u.id].stoneEvolutions?.[stone];
  if (!target) return fail("That stone does not work on this Pokémon.");
  const i = p.items.indexOf(stone);
  if (i < 0) return fail("You do not own that stone.");
  p.items.splice(i, 1); u.id = target; return ok();
}
export function unequip(p: Player, uid: number, index: number): Result {
  const u = p.units.find((x) => x.uid === uid);
  if (!u || !Number.isInteger(index) || index < 0 || index >= u.items.length) return fail("Nothing to remove.");
  p.items.push(...u.items.splice(index, 1)); return ok();
}

// NPC rounds: every Nth round the whole lobby fights creeps (odd encounters) or a boss (even encounters).
export const isNpcRound = (round: number) => round > 0 && round % RULES.npcInterval === 0;
export const encounterOf = (round: number) => Math.floor(round / RULES.npcInterval);
export const isBossEncounter = (round: number) => encounterOf(round) % 2 === 0;

// Shared rarity schedule avoids an early random Legendary deciding a match.
export function reward(m: Match, p: Player, round: number, won: boolean): string {
  const enc = encounterOf(round);
  const count = won ? Math.ceil(enc / 2) + (enc % 2 === 0 ? 2 : 0) : 1;
  const rarity = !won ? "Rare" : enc === 1 ? "Rare" : enc === 2 ? "Epic" : enc % 2 === 0 ? "Legendary" : "Epic";
  const choices = ITEM_LIST.filter((i) => i.rarity === rarity);
  let first = "";
  const pool = rarity === "Rare" ? [...choices, ...TYPE_ITEMS] : rarity === "Epic" ? [...choices, ...CRYSTALS] : choices;
  const roll = () => (rarity === "Rare" && m.rng() < 0.3 ? TYPE_ITEMS[Math.floor(m.rng() * TYPE_ITEMS.length)] : rarity === "Epic" && m.rng() < 0.35 ? CRYSTALS[Math.floor(m.rng() * CRYSTALS.length)] : choices[Math.floor(m.rng() * choices.length)]);
  for (let i = 0; i < count; i++) {
    if (p.human) { // humans pick 1 of 3 distinct options per reward, then it goes straight to the bag
      const opts: string[] = []; for (let t = 0; t < 40 && opts.length < Math.min(3, pool.length); t++) { const it = roll(); if (!opts.includes(it.key)) opts.push(it.key); }
      (p.picks ||= []).push(opts); first ||= "choose";
    } else { const it = roll(); p.items.push(it.key); first ||= it.id; }
  }
  if (won && enc % 2 === 0) { const sp = SPECIAL_ITEMS[Math.floor(m.rng() * SPECIAL_ITEMS.length)]; p.items.push(sp.key); first ||= sp.id; } // boss drop: Mega Stone / Dynamax Band / Tera Orb
  if (won && enc >= 6 && enc % 2 === 0) p.items.push("blessing_transfer"); // late-game boss drop
  if (won) for (let i = 0; i < RULES.economy.stonePerNpcWin; i++) p.items.push(STONES[Math.floor(m.rng() * STONES.length)].key);
  if (p.human) return count === 1 ? "choose 1 of 3 equipment" : `choose ${count} equipment (1 of 3 each)`;
  return count === 1 ? first + (won ? "" : " (consolation)") : `${count} equipment (${rarity})`;
}

// Pokémon Blessing: +1 synergy count for one chosen type. Options: its original types, then a random extra synergy.
export function blessOptions(m: Match, u: Unit): string[] {
  const own = [...(BY_ID[u.id].types ?? [BY_ID[u.id].faction])], all = Object.keys(SYNERGIES);
  const opts = own.slice(0, 2);
  for (let t = 0; t < 60 && opts.length < 3; t++) { const c = all[Math.floor(m.rng() * all.length)]; if (!opts.includes(c)) opts.push(c); }
  return opts;
}
const BLESS_FIRST_ROUND = 3, BLESS_MILESTONES: number[] = []; // Blessing Crystals now come from the stage Supply draft (stages II-IV)
export function grantBlessings(m: Match, p: Player) {
  if (false as boolean && !p.blessGiven && m.round >= BLESS_FIRST_ROUND) { const u = p.units.find((x) => x.stars >= 2 && !x.blessing); if (u) { p.blessGiven = true; (p.bless ||= []).push({ uid: u.uid, options: blessOptions(m, u) }); } }
  if (BLESS_MILESTONES.includes(m.round)) (p.bless ||= []).push({ uid: null });
}
export function autoBless(m: Match, p: Player) { // bots and unanswered prompts resolve automatically
  while (p.bless?.length) {
    const q = p.bless[0]; let u = q.uid !== null ? p.units.find((x) => x.uid === q.uid) : undefined;
    if (!u) u = [...p.units].sort((a, b) => b.stars - a.stars || Number(b.col !== null) - Number(a.col !== null)).find((x) => !x.blessing);
    p.bless.shift(); if (!u || u.blessing) continue; u.blessing = (q.options && q.uid === u.uid ? q.options : blessOptions(m, u))[0];
  }
}
// Go Go Cards: three selections per match; the rarity is rolled once per selection round and shared by every player.
export function drawCards(m: Match, rarity: string, avoid: string[] = []): string[] {
  const pool = GOGO.cards.filter((c) => c.rarity === rarity), weighted = pool.flatMap((c) => Array(c.weight ?? 1).fill(c)), fresh = pool.filter((c) => !avoid.includes(c.id)), src = fresh.length >= 2 ? fresh : pool;
  const out: string[] = [], bag = src === fresh ? weighted.filter((c) => !avoid.includes(c.id)) : weighted; while (out.length < Math.min(2, src.length)) { const c = bag[Math.floor(m.rng() * bag.length)]; if (!out.includes(c.id)) out.push(c.id); }
  return out;
}
export function grantCards(m: Match, p: Player) {
  if (!GOGO.rounds.includes(m.round)) return;
  if (!GOGO.cards.length) return; // no cards defined yet
  const r = ((m.cardRarity ||= {})[m.round] ??= (() => { let x = m.rng() * 100; for (const [k, w] of Object.entries(GOGO.odds)) { if ((x -= w) < 0) return k; } return "Common"; })());
  const options = drawCards(m, r); if (options.length) p.card = { rarity: r, options, rerolls: options.map(() => GOGO.rerolls) };
  if (p.commander === "Brock" && m.round === 9) p.cardExtra = 1;
}
export function applyCard(m: Match, p: Player, c: any) {
  if (c.id) (p.cardsTaken ||= []).push(c.id);
  const fx = c.fx ?? c, k = pk(p);
  if (fx.gold) p.gold += fx.gold;
  if (fx.xp) addXp(p, fx.xp);
  if (fx.shield) k.shield += fx.shield;
  if (fx.fortune) { k.fortune += fx.fortune; k.fortuneLeft = fx.fortuneRounds ?? 5; }
  if (fx.hpRerolls) k.hpRerolls += fx.hpRerolls;
  if (fx.freeReroll) k.freeReroll = Math.min(1, k.freeReroll + fx.freeReroll);
  if (fx.fastPromo) k.fastPromo += fx.fastPromo;
  if (fx.paydayRounds) { k.paydayLeft += fx.paydayRounds; k.paydayAmt = fx.paydayAmt ?? 7; }
  if (fx.trustFund) { k.trustFund = true; const g = ({ 8: 8, 9: 16, 10: 25 } as Record<number, number>)[p.level]; if (g && p.level >= 8) p.gold += g; }
  if (fx.festive) k.festive = true;
  if (fx.allyCall) k.allyCall = true;
  if (fx.merrier) k.merrier = true;
  if (fx.fountain) k.fountain = true;
  if (fx.interestCap) k.interestCap = Math.max(k.interestCap, fx.interestCap);
  if (fx.xpDiscount) k.xpMul *= 1 - fx.xpDiscount;
  if (fx.shopMod) k.shopMod = k.shopMod.map((v, i) => v + (fx.shopMod[i] ?? 0));
}
// The More, the Merrier: after a battle gain 1 gold per active synergy (types and roles).
export function activeSynergies(p: Player): number {
  const counts = traitCounts(deployed(p)); let n = 0;
  for (const [t, c] of Object.entries(counts)) { const th: number[] = SYNERGIES[t]?.thresholds ?? [2, 4, 6]; if (c >= th[0]) n++; }
  return n;
}
export function autoCard(m: Match, p: Player) {
  for (let g = 0; g < 3 && p.card; g++) { const c = p.card, id = c.options[0]; applyCard(m, p, GOGO.cards.find((x) => x.id === id)); afterCard(m, p, c.rarity, c.options); delete p.card; if (p.cardExtra) { p.cardExtra--; nextCard(m, p, c.rarity, [id]); } }
  if (!p.human) autoBless(m, p);
}
// Brock - Stone Choice: two Go Go Card picks in Round II-3 (round 9) and bonus Commander EXP by card quality (Purple 16, Blue 26)
const BROCK_ROUND = 9;
function afterCard(m: Match, p: Player, rarity: string, _o: string[]) { if (p.commander === "Brock" && m.round === BROCK_ROUND) addXp(p, rarity === "Epic" ? 16 : rarity === "Common" ? 26 : 0); }
function nextCard(m: Match, p: Player, rarity: string, avoid: string[]) { const options = drawCards(m, rarity, avoid); if (options.length) p.card = { rarity, options, rerolls: options.map(() => GOGO.rerolls) }; }
// Blue - Copy Trap: reward after the fight (copy of the trapped enemy hero, or 1 gold when nothing was copied)
export function trapReward(m: Match, p: Player, hitId: string | undefined) {
  if (p.commander !== "Blue" || !p.cmd?.trap) return;
  if (hitId && BY_ID[hitId]) { if (bench(p).length < RULES.benchSize) { const base = BY_ID[hitId].evolutionLine?.[0] ?? hitId; const d = BY_ID[base] ?? BY_ID[hitId]; if ((m.pool[d.poolId ?? d.id] ?? 0) > 0) m.pool[d.poolId ?? d.id]--; p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] }); merge(p, m); } p.gold += 1; } else p.gold += 1;
}
// Sabrina - Power of Chaos / Misty - Water Shield / Joy - Love's Protection / Blue - Copy Trap placement
function cmdSkill(m: Match, p: Player, a: { uid?: number; col?: number; row?: number }): Result {
  const c = (p.cmd ||= { used: 0 }), u = a.uid !== undefined ? p.units.find((x) => x.uid === a.uid) : undefined;
  switch (p.commander) {
    case "Sabrina": {
      if (m.round < 2) return fail("Power of Chaos unlocks after Stage I-2.");
      if (c.used >= 1) return fail("Power of Chaos has no uses left.");
      if (!u) return fail("Select a Hero."); if (u.blessing) return fail("Choose a Hero without a Blessing.");
      const opts = blessOptions(m, u); u.blessing = opts[Math.floor(m.rng() * opts.length)]; c.used++;
      const t = u.blessing, odds = RULES.shopOdds[String(p.level)] ?? RULES.shopOdds["3"], has = (d: any) => [...(d.types ?? [d.faction]), d.role, d.faction].includes(t);
      for (let n = 0; n < 2 && bench(p).length < RULES.benchSize; n++) {
        let roll = Math.floor(m.rng() * 100) + 1, tier = 1; for (let i = 0; i < odds.length; i++) { roll -= odds[i]; if (roll <= 0) { tier = i + 1; break; } }
        let cand = ROSTER.filter((d) => !d.evolutionOnly && d.tier === tier && has(d) && (m.pool[d.poolId ?? d.id] ?? 0) > 0);
        if (!cand.length) cand = ROSTER.filter((d) => !d.evolutionOnly && has(d) && (m.pool[d.poolId ?? d.id] ?? 0) > 0);
        if (!cand.length) break; const d = cand[Math.floor(m.rng() * cand.length)];
        m.pool[d.poolId ?? d.id]--; p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] });
      }
      p.gold += 2; merge(p, m); return ok();
    }
    case "Misty": if (!u) return fail("Select a Hero."); c.water = u.uid; return ok();
    case "Joy": if (!u) return fail("Select an ally to protect."); c.love = u.uid; return ok();
    case "Blue": if (a.col === undefined || a.row === undefined || !validCell(a.col, a.row)) return fail("Place the trap on your half of the board."); c.trap = { col: a.col, row: a.row }; return ok();
    default: return fail("Brock's skill is used in the Go Go Card stage.");
  }
}
export function autoPick(p: Player) { while (p.picks && p.picks.length) { const o = p.picks.shift()!; p.items.push(o[0]); } }

export const xpNeed = (p: Player) => Math.max(1, Math.ceil((RULES.xpToLevel[String(p.level)] ?? 0) * pk(p).xpMul));
export function addXp(p: Player, amount: number) {
  p.xp += amount;
  while (p.level < RULES.maxLevel && p.xp >= xpNeed(p)) {
    p.xp -= xpNeed(p); p.level++;
    if (pk(p).trustFund) { const g = ({ 8: 8, 9: 16, 10: 25 } as Record<number, number>)[p.level]; if (g) p.gold += g; } // Trust Fund
  }
  if (p.level === RULES.maxLevel) p.xp = 0;
}

export function rerollCost(p: Player) { return RULES.rerollCost; }

export type Action =
  | { a: "buy"; slot: number } | { a: "sell"; uid: number } | { a: "move"; uid: number; col: number | null; row: number | null }
  | { a: "equip"; uid: number; item: string } | { a: "unequip"; uid: number; index: number }
  | { a: "reroll" } | { a: "xp" } | { a: "evolve"; uid: number; stone: string } | { a: "lock" } | { a: "ready" } | { a: "pick"; item: string } | { a: "cardpick"; id: string } | { a: "cardreroll"; slot: number } | { a: "bless"; uid: number } | { a: "cmd"; uid?: number; col?: number; row?: number } | { a: "blesspick"; type: string } | { a: "transfer"; from: number; to: number };

export function act(m: Match, p: Player, action: Action): Result {
  // Buying, selling, refreshing the shop, buying XP and locking work at any time (even mid-battle); everything else is preparation-only
  const LIVE_ACTIONS = ["buy", "sell", "reroll", "xp", "lock"];
  if (p.eliminated || m.phase === "Finished") return fail("You can't act right now.");
  if (m.phase !== "Preparation" && !LIVE_ACTIONS.includes(action.a)) return fail("You can only do that during preparation.");
  switch (action.a) {
    case "buy": return Number.isInteger(action.slot) ? buy(m, p, action.slot) : fail("Bad slot.");
    case "sell": return sell(m, p, action.uid);
    case "move": return move(p, action.uid, action.col, action.row);
    case "equip": return equip(p, action.uid, action.item);
    case "unequip": return unequip(p, action.uid, action.index);
    case "cardpick": { const c = p.card; if (!c || !c.options.includes(action.id)) return fail("No card to choose."); applyCard(m, p, GOGO.cards.find((x) => x.id === action.id)); afterCard(m, p, c.rarity, c.options); delete p.card; if (p.cardExtra) { p.cardExtra--; nextCard(m, p, c.rarity, [action.id]); } return ok(); }
    case "cmd": return cmdSkill(m, p, action);
    case "cardreroll": { const c = p.card, i = action.slot; if (!c || !(i >= 0 && i < c.options.length)) return fail("No card to refresh."); if (!(c.rerolls[i] > 0)) return fail("No refreshes left on that card."); c.rerolls[i]--; const pool = GOGO.cards.filter((x) => x.rarity === c.rarity && !c.options.includes(x.id)); if (pool.length) c.options[i] = pool[Math.floor(m.rng() * pool.length)].id; return ok(); }
    case "bless": { const q = p.bless?.[0]; if (!q || q.uid !== null) return fail("Nothing to bless."); const u = p.units.find((x) => x.uid === action.uid); if (!u || u.blessing) return fail("Choose a Pokémon without a Blessing."); q.uid = u.uid; q.options = blessOptions(m, u); return ok(); }
    case "blesspick": { const q = p.bless?.[0], u = q && p.units.find((x) => x.uid === q.uid); if (!q || !u || !q.options?.includes(action.type)) return fail("Nothing to choose."); u.blessing = action.type; p.bless!.shift(); return ok(); }
    case "transfer": { const a = p.units.find((x) => x.uid === action.from), b = p.units.find((x) => x.uid === action.to), i = p.items.indexOf("blessing_transfer"); if (i < 0) return fail("You need a Blessing Transfer."); if (!a?.blessing || !b || b.blessing || a === b) return fail("Pick a blessed Pokémon and an unblessed target."); b.blessing = a.blessing; delete a.blessing; p.items.splice(i, 1); return ok(); }
    case "pick": { const o = p.picks?.[0]; if (!o || !o.includes(action.item)) return fail("Nothing to pick."); p.items.push(action.item); p.picks!.shift(); return ok(); }
    case "lock": p.shopLocked = !p.shopLocked; return ok();
    case "ready": p.ready = true; return ok();
    case "evolve": return evolve(p, action.uid, action.stone);
    case "reroll": {
      if (p.shopLocked) return fail("Unlock the shop before refreshing.");
      const k = pk(p), free = k.freeReroll > 0 && m.rng() < k.freeReroll; // Premium Client: chance the refresh is free
      if (free) { p.rerolled = true; rollShop(m, p); return ok(); }
      if (k.hpRerolls > 0) { if (p.hp <= 1) return fail("Not enough HP."); k.hpRerolls--; p.hp -= 1; p.rerolled = true; rollShop(m, p); return ok(); } // Death Oracle
      const cost = rerollCost(p);
      if (p.gold < cost) return fail("Not enough gold.");
      p.gold -= cost; p.rerolled = true; rollShop(m, p); return ok();
    }
    case "xp":
      if (p.level === RULES.maxLevel) return fail("Maximum capacity reached.");
      if (p.gold < RULES.economy.xpBuyGold) return fail(`You need ${RULES.economy.xpBuyGold} gold.`);
      p.gold -= RULES.economy.xpBuyGold; addXp(p, RULES.economy.xpBuyAmount); return ok();
  }
  return fail("Unknown action.");
}

// Round income: base + win/loss bonus + interest + streak bonus. Every value lives in Config.Economy.
// Stages are six rounds long (I-1..I-6 = rounds 1-6): Stage III +1 base gold, Stage IV +2, Stage V onwards +3.
export const stageBonus = (round: number) => { const st = Math.floor((Math.max(1, round) - 1) / 6) + 1; return st >= 5 ? 3 : st === 4 ? 2 : st === 3 ? 1 : 0; };
export function income(p: Player, round = 1): number {
  const e = RULES.economy, n = Math.abs(p.streak);
  const streak = e.streaks.reduce((b, [lo, hi, g]) => (n >= lo && n <= hi ? g : b), 0);
  const result = p.lastResult === "win" ? e.winBonus : p.lastResult === "loss" ? e.lossBonus : 0;
  return e.baseIncome + stageBonus(round) + result + Math.min(Math.max(e.interestMax, pk(p).interestCap), Math.floor(p.gold / e.interestPer)) + streak;
}
export function recordResult(p: Player, won: boolean) {
  if (pk(p).merrier) p.gold += activeSynergies(p);
  p.lastResult = won ? "win" : "loss";
  p.streak = won ? (p.streak > 0 ? p.streak + 1 : 1) : (p.streak < 0 ? p.streak - 1 : -1);
}

// Per-round card perks: Payday, Healing Fountain, Shield of Fortune countdown, Rising Festivities.
function roundPerks(m: Match, p: Player) {
  const k = pk(p);
  if (k.paydayLeft > 0) { k.paydayLeft--; p.gold += k.paydayAmt; }
  if (k.fountain) p.hp = Math.min(RULES.startHealth, p.hp + 3);
  if (k.fortune > 0 && k.fortuneLeft > 0 && --k.fortuneLeft === 0) { p.gold += k.fortune; k.fortune = 0; }
  if (k.festive) {
    const cost = Math.max(1, p.level - 5), pool = ROSTER.filter((d) => !d.evolutionOnly && (m.pool[d.poolId ?? d.id] ?? 0) > 0);
    if (p.gold >= cost && pool.length && bench(p).length < RULES.benchSize) { const d = pool[Math.floor(m.rng() * pool.length)]; p.gold -= cost; m.pool[d.poolId ?? d.id]--; p.units.push({ uid: ++m.nextUid, id: d.id, stars: 1, col: null, row: null, items: [] }); merge(p, m); }
  }
}
export function prepare(m: Match) {
  m.round++; m.phase = "Preparation";
  for (const p of m.players) {
    p.ready = false;
    if (p.eliminated) continue;
    if (m.round > 1) { p.gold += income(p, m.round); addXp(p, RULES.economy.xpPerRound); }
    p.rerolled = false; if (m.round > 1) roundPerks(m, p); grantBlessings(m, p); grantCards(m, p); if (!p.human) { autoCard(m, p); autoBless(m, p); }
    if (!(p.shopLocked && p.shop.some(Boolean))) rollShop(m, p);
  }
}

export function eliminate(m: Match, p: Player) {
  if (p.eliminated) return;
  p.eliminated = true; p.hp = 0; p.shopLocked = false;
  releaseShop(m, p);
  for (const u of p.units) m.pool[BY_ID[u.id].poolId ?? u.id] += 3 ** (u.stars - 1);
  p.units = []; p.items = [];
}

// Simple AI: buys by tier/faction/merge value, fields the strongest units frontline-first.
export function botTurn(m: Match, p: Player, difficulty: "Beginner" | "Intermediate" | "Hard" = "Intermediate") {
  const advanced = difficulty !== "Beginner";
  { // commander skills for bots
    const best = [...p.units].sort((x, y) => y.stars - x.stars || Number(y.col !== null) - Number(x.col !== null))[0];
    if (p.commander === "Sabrina" && m.round >= 2 && !(p.cmd?.used)) { const u = p.units.find((x) => !x.blessing); if (u) cmdSkill(m, p, { uid: u.uid }); }
    else if ((p.commander === "Misty" || p.commander === "Joy") && best) cmdSkill(m, p, { uid: best.uid });
    else if (p.commander === "Blue" && !p.cmd?.trap) cmdSkill(m, p, { col: Math.floor(m.rng() * RULES.cols), row: Math.floor(m.rng() * RULES.rows / 2) });
  }
  const attempts = difficulty === "Hard" ? 4 : 2;
  const faction = RULES.factions[p.seat % RULES.factions.length];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const slots = [0, 1, 2, 3, 4];
    if (advanced) {
      const score = (slot: number) => {
        const d = p.shop[slot] ? BY_ID[p.shop[slot]!] : null;
        if (!d) return -1;
        let s = d.tier + (d.faction === faction ? 4 : 0);
        for (const u of p.units) if (u.id === d.id && u.stars < 3) s += 5;
        return s;
      };
      slots.sort((a, b) => score(b) - score(a));
    }
    for (const slot of slots) if (bench(p).length < 5) buy(m, p, slot);
    if (p.gold >= 6 && attempt < attempts) act(m, p, { a: "reroll" });
  }
  if (p.gold >= 6 && p.level < RULES.maxLevel) act(m, p, { a: "xp" });
  const sorted = [...p.units].sort((a, b) => BY_ID[b.id].tier * 2 + b.stars * 5 - (BY_ID[a.id].tier * 2 + a.stars * 5));
  for (const u of p.units) { u.col = null; u.row = null; }
  const taken = new Set<number>();
  sorted.slice(0, p.level).forEach((u) => {
    const front = BY_ID[u.id].range === 1;
    for (let off = 0; off < 4 && u.col === null; off++) {
      const row = front ? 3 - off : off;
      for (let col = 0; col < RULES.cols; col++) {
        if (!taken.has(row * RULES.cols + col)) { taken.add(row * RULES.cols + col); u.col = col; u.row = row; break; }
      }
    }
  });
  while (bench(p).length > RULES.benchSize) sell(m, p, bench(p)[bench(p).length - 1].uid);
  for (const u of deployed(p)) for (let i = p.items.length - 1; i >= 0; i--) if (u.items.length < 3 && !u.items.includes(p.items[i])) u.items.push(p.items.splice(i, 1)[0]);
}

// Active trait counts (unique fighters by id on the board), e.g. {JJK:3, Caster:2}.
export { traitCounts } from "./synergy.ts";
