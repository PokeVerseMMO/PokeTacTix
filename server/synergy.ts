// One synergy + type-effectiveness manager for the whole game. Everything is read from data/pokemon/*.json.
import { BY_ID, TYPE_CHART, SYNERGIES, ITEMS } from "./data.ts";

// Types a Crystal grants (does not change real typing, only synergy membership).
export const crystalTypes = (items: string[] | Set<string> | undefined): string[] => [...(items ?? [])].map((k) => (ITEMS as any)[k]?.crystal).filter(Boolean);

// Count each distinct species once; a dual-type Pokémon contributes to both of its types. Roles count too.
export function traitCounts(units: { id: string; items?: string[]; blessing?: string }[]) {
  const seen = new Set<string>(), counts: Record<string, number> = {};
  for (const u of units) {
    if (u.blessing) counts[u.blessing] = (counts[u.blessing] ?? 0) + 1; // Blessing: +1 even for a type it already has
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const d = BY_ID[u.id];
    const own = d.types ?? [d.faction];
    for (const t of new Set([...own, ...crystalTypes(u.items)])) counts[t] = (counts[t] ?? 0) + 1;
    counts[d.role] = (counts[d.role] ?? 0) + 1;
  }
  return counts;
}

export const tierOf = (type: string, n: number) => (SYNERGIES[type]?.thresholds ?? []).filter((t: number) => n >= t).length;

// Stat bonuses an individual unit receives from active type synergies. `team` bonuses (Fairy) reach every ally.
export function typeBonuses(counts: Record<string, number>, myTypes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, def] of Object.entries<any>(SYNERGIES)) {
    const tier = tierOf(type, counts[type] ?? 0);
    if (!tier || !(def.team || myTypes.includes(type))) continue;
    for (const [k, v] of Object.entries<number>(def.effects[tier - 1])) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

// Single-type matchup factor, then configurable multipliers and clamping for dual-type defenders.
function single(att: string, def: string): number {
  const m = TYPE_CHART.multipliers;
  if (TYPE_CHART.immune[att]?.includes(def)) return m.immune;
  if (TYPE_CHART.superEffective[att]?.includes(def)) return m.superEffective;
  if (TYPE_CHART.notVeryEffective[att]?.includes(def)) return m.notVeryEffective;
  return 1;
}
// Attackers use their best matching type (STAB-style); a dual-type defender multiplies both matchups, clamped to the configured range.
export function typeMultiplier(attTypes: string[] | undefined, defTypes: string[] | undefined): number {
  if (!attTypes?.length || !defTypes?.length) return 1;
  const m = TYPE_CHART.multipliers;
  let best = 0;
  for (const a of attTypes) best = Math.max(best, defTypes.reduce((p, d) => p * single(a, d), 1));
  return Math.min(m.maxMultiplier, Math.max(m.minMultiplier, best));
}
