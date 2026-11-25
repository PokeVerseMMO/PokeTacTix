// Shop, economy, merging and board rules. Ported from the Roblox AutoChess `Game` module.
import { BY_ID, ITEM_LIST, ITEMS, ROSTER, RULES, SPECIAL_ITEMS, STONES } from "./data.ts";

export interface Unit { uid: number; id: string; stars: number; col: number | null; row: number | null; items: string[] }
export interface Player {
  seat: number; name: string; human: boolean; hp: number; gold: number; level: number; xp: number;
  units: Unit[]; shop: (string | null)[]; shopLocked: boolean; rerolled: boolean; commander: string;
  eliminated: boolean; ready: boolean; streak: number; lastResult: "win" | "loss" | null; items: string[]; placement?: number; connected: boolean;
}
export interface Match {
  round: number; phase: "Preparation" | "Combat" | "Finished"; pool: Record<string, number>;
  players: Player[]; nextUid: number; rng: () => number;
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
  const odds = RULES.shopOdds[String(p.level)] ?? RULES.shopOdds["3"];
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

// Three identical units of the same star level become one unit of the next level; repeats (1->2->3).
export function merge(p: Player) {
  let again = true;
  while (again) {
    again = false;
    for (const candidate of p.units) {
      if (candidate.stars >= 3) continue;
      const matches = p.units.filter((u) => u.id === candidate.id && u.stars === candidate.stars);
      if (matches.length < 3) continue;
      matches.sort((a, b) => Number(b.col !== null) - Number(a.col !== null)); // keep a deployed copy in place
      const keep = matches[0];
      for (const gone of matches.slice(1, 3)) { p.units.splice(p.units.indexOf(gone), 1); for (const it of gone.items) keep.items.length < 3 && !keep.items.includes(it) ? keep.items.push(it) : p.items.push(it); }
      keep.stars++;
      again = true;
      break;
    }
  }
}

export function buy(m: Match, p: Player, slot: number): Result {
  const id = p.shop[slot];
  if (!id) return fail("That shop slot is empty.");
  const d = BY_ID[id];
  if (p.gold < d.tier) return fail("Not enough gold.");
  if (bench(p).length >= RULES.benchSize) {
    const copies = p.units.filter((u) => u.id === id && u.stars === 1).length;
    if (copies < 2) return fail("Your bench is full.");
  }
  p.gold -= d.tier; p.shop[slot] = null;
  p.units.push({ uid: ++m.nextUid, id, stars: 1, col: null, row: null, items: [] });
  merge(p);
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
  if (!ITEMS[item]) return fail("That item cannot be equipped.");
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
  for (let i = 0; i < count; i++) { const it = choices[Math.floor(m.rng() * choices.length)]; p.items.push(it.key); first ||= it.id; }
  if (won && enc % 2 === 0) { const sp = SPECIAL_ITEMS[Math.floor(m.rng() * SPECIAL_ITEMS.length)]; p.items.push(sp.key); first ||= sp.id; } // boss drop: Mega Stone / Dynamax Band / Tera Orb
  if (won) for (let i = 0; i < RULES.economy.stonePerNpcWin; i++) p.items.push(STONES[Math.floor(m.rng() * STONES.length)].key);
  return count === 1 ? first + (won ? "" : " (consolation)") : `${count} equipment (${rarity})`;
}

export function addXp(p: Player, amount: number) {
  p.xp += amount;
  while (p.level < RULES.maxLevel && p.xp >= RULES.xpToLevel[String(p.level)]) {
    p.xp -= RULES.xpToLevel[String(p.level)]; p.level++;
  }
  if (p.level === RULES.maxLevel) p.xp = 0;
}

export function rerollCost(p: Player) { return p.commander === "Blue" && !p.rerolled ? 1 : RULES.rerollCost; }

export type Action =
  | { a: "buy"; slot: number } | { a: "sell"; uid: number } | { a: "move"; uid: number; col: number | null; row: number | null }
  | { a: "equip"; uid: number; item: string } | { a: "unequip"; uid: number; index: number }
  | { a: "reroll" } | { a: "xp" } | { a: "evolve"; uid: number; stone: string } | { a: "lock" } | { a: "ready" };

export function act(m: Match, p: Player, action: Action): Result {
  if (m.phase !== "Preparation" || p.eliminated) return fail("You can only act during preparation.");
  switch (action.a) {
    case "buy": return Number.isInteger(action.slot) ? buy(m, p, action.slot) : fail("Bad slot.");
    case "sell": return sell(m, p, action.uid);
    case "move": return move(p, action.uid, action.col, action.row);
    case "equip": return equip(p, action.uid, action.item);
    case "unequip": return unequip(p, action.uid, action.index);
    case "lock": p.shopLocked = !p.shopLocked; return ok();
    case "ready": p.ready = true; return ok();
    case "evolve": return evolve(p, action.uid, action.stone);
    case "reroll": {
      if (p.shopLocked) return fail("Unlock the shop before refreshing.");
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
export function income(p: Player): number {
  const e = RULES.economy, n = Math.abs(p.streak);
  const streak = e.streaks.reduce((b, [lo, hi, g]) => (n >= lo && n <= hi ? g : b), 0);
  const result = p.lastResult === "win" ? e.winBonus : p.lastResult === "loss" ? e.lossBonus : 0;
  return e.baseIncome + result + Math.min(e.interestMax, Math.floor(p.gold / e.interestPer)) + streak;
}
export function recordResult(p: Player, won: boolean) {
  p.lastResult = won ? "win" : "loss";
  p.streak = won ? (p.streak > 0 ? p.streak + 1 : 1) : (p.streak < 0 ? p.streak - 1 : -1);
}

export function prepare(m: Match) {
  m.round++; m.phase = "Preparation";
  for (const p of m.players) {
    p.ready = false;
    if (p.eliminated) continue;
    if (m.round > 1) { p.gold += income(p); addXp(p, RULES.economy.xpPerRound); }
    p.rerolled = false;
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
