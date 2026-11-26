// Stage Supply draft: at the end of every six-round stage each living player takes ONE reward from a shared pool,
// lowest HP picks first (comeback mechanic). Pool contents depend on the stage that just ended.
import { BY_ID, CRYSTALS, ITEM_LIST, ROSTER, SPECIAL_ITEMS, STONES } from "./data.ts";
import { merge, type Match, type Player, bench } from "./rules.ts";
import { RULES } from "./data.ts";

export type SupplyKind = "unit" | "item" | "gold" | "bless" | "stone" | "mirror" | "special";
export interface SupplyEntry { id: number; kind: SupplyKind; key?: string; unitId?: string; label: string; text: string; icon: string | null; rarity?: string; by: number | null }
export const STAGE_LEN = Number(process.env.STAGE_LEN ?? 6); // env override only for tests
export const stageOf = (round: number) => Math.floor((Math.max(1, round) - 1) / STAGE_LEN) + 1;
const GOLD_REWARD = 8;
const rank: Record<string, number> = { Rare: 1, Epic: 2, Legendary: 3, Mega: 4 };

const pickFrom = <T,>(m: Match, a: T[]): T => a[Math.floor(m.rng() * a.length)];
function shuffle<T>(m: Match, a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(m.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function buildSupply(m: Match, stage: number, n: number): SupplyEntry[] {
  let nid = 0; const E = (e: Omit<SupplyEntry, "id" | "by">): SupplyEntry => ({ id: ++nid, by: null, ...e });
  const item = (r: string) => { const it: any = pickFrom(m, ITEM_LIST.filter((i) => i.rarity === r)); return E({ kind: "item", key: it.key, label: it.id, text: it.text, icon: it.icon ?? null, rarity: r }); };
  const recruit = (lo: number, hi: number, tag: string) => { const c = ROSTER.filter((u) => !u.evolutionOnly && u.tier >= lo && u.tier <= hi && (m.pool[u.poolId ?? u.id] ?? 0) > 0); const u = pickFrom(m, c.length ? c : ROSTER.filter((x) => !x.evolutionOnly)); return E({ kind: "unit", unitId: u.id, label: u.name, text: `${tag}: a ${u.tier}-cost Pokémon joins your bench.`, icon: null }); };
  const gold = () => E({ kind: "gold", label: `${GOLD_REWARD} Gold`, text: `Gain ${GOLD_REWARD} gold.`, icon: "art/ui/icons/gold.png" });
  const bless = (nth: string) => E({ kind: "bless", label: "Blessing Crystal", text: `${nth} Blessing: one Pokémon gains +1 synergy count of a type you choose.`, icon: "art/types/Fairy.png" });
  const stone = () => { const s: any = pickFrom(m, STONES); return E({ kind: "stone", key: s.key, label: s.id, text: s.text, icon: s.icon ?? null, rarity: s.rarity }); };
  const mirror = () => E({ kind: "mirror", label: "Mirror Device", text: "Copy your best piece of equipment (bag or equipped).", icon: "art/types/Psychic.png" });
  const mega = () => { const s: any = pickFrom(m, SPECIAL_ITEMS.filter((x: any) => x.key.startsWith("mega_"))); return E({ kind: "special", key: s.key, label: s.id, text: s.text, icon: s.icon ?? null, rarity: "Mega" }); };
  // listed by priority so a small lobby still sees the headline rewards
  const t: (() => SupplyEntry)[] =
    stage <= 1 ? [() => recruit(2, 3, "Recruit"), () => item("Rare"), () => recruit(1, 2, "Recruit"), () => item("Rare"), gold, () => item("Rare"), () => recruit(2, 3, "Recruit"), gold]
    : stage === 2 ? [() => bless("First"), () => item("Epic"), stone, () => item("Epic"), stone, () => item("Epic"), gold, () => recruit(3, 3, "Recruit")]
    : stage === 3 ? [() => bless("Second"), () => item("Legendary"), mirror, () => item("Legendary"), () => item("Epic"), mirror, () => item("Legendary"), () => item("Epic")]
    : [() => bless("Final"), mega, () => item("Legendary"), () => recruit(4, 5, "Rare recruit"), mega, () => item("Legendary"), () => recruit(4, 5, "Rare recruit"), () => item("Legendary")];
  return shuffle(m, t.slice(0, Math.max(2, n)).map((f) => f())).map((e, i) => ({ ...e, id: i + 1 }));
}

const SORT = (a: Player, b: Player) => a.hp - b.hp || a.seat - b.seat;
export const supplyOrder = (m: Match) => m.players.filter((p) => !p.eliminated).sort(SORT).map((p) => p.seat);

export function claim(m: Match, p: Player, e: SupplyEntry) {
  switch (e.kind) {
    case "unit": {
      const id = e.unitId!, d = BY_ID[id], pk = d.poolId ?? id;
      if (bench(p).length >= RULES.benchSize && p.units.filter((u) => u.id === id && u.stars === 1).length < 2) { p.gold += d.tier; break; }
      if ((m.pool[pk] ?? 0) > 0) m.pool[pk]--;
      p.units.push({ uid: ++m.nextUid, id, stars: 1, col: null, row: null, items: [] }); merge(p, m); break;
    }
    case "item": case "stone": case "special": p.items.push(e.key!); break;
    case "gold": p.gold += GOLD_REWARD; break;
    case "bless": (p.bless ||= []).push({ uid: null }); break;
    case "mirror": {
      const all = [...p.items, ...p.units.flatMap((u) => u.items)].filter((k) => ITEM_LIST.some((i) => i.key === k) || CRYSTALS.some((c) => c.key === k));
      const best = all.sort((a, b) => (rank[ITEM_LIST.find((i) => i.key === b)?.rarity ?? "Rare"] ?? 2) - (rank[ITEM_LIST.find((i) => i.key === a)?.rarity ?? "Rare"] ?? 2))[0];
      if (best) p.items.push(best); else p.gold += GOLD_REWARD; break;
    }
  }
}

// Bots grab the most valuable remaining reward.
export function botChoice(entries: SupplyEntry[]): SupplyEntry {
  const score = (e: SupplyEntry) => ({ bless: 9, special: 8, mirror: 5, unit: e.label && 4, stone: 3, gold: 1, item: 2 + (rank[e.rarity ?? "Rare"] ?? 1) } as any)[e.kind] ?? 1;
  return entries.filter((e) => e.by === null).sort((a, b) => score(b) - score(a))[0];
}
