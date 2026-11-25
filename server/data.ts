import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = process.env.AUTOCHESS_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(ROOT, "data");
const load = (name: string) => JSON.parse(readFileSync(join(dir, name + ".json"), "utf8"));

export interface UnitDef {
  id: string; name: string; faction: string; role: string; tier: number;
  health: number; attack: number; armor: number; mr: number; speed: number; range: number;
  startMana: number; maxMana: number; crit: number; critDamage: number;
  ability: string; description: string; kind: string; npc?: boolean;
  types?: string[]; family?: string; evolutionOnly?: boolean; weather?: string | null; poolId?: string; evolutionLine?: string[]; stoneEvolutions?: Record<string, string>; legendary?: boolean; spAttack?: number; generation?: number;
}

const speciesRaw = load("pokemon/species");
export const TYPE_CHART = load("pokemon/types");
export const STATUS_DATA = load("pokemon/status");
export const WEATHER_DATA = load("pokemon/weather");
export const SYNERGIES: Record<string, any> = load("pokemon/synergies").types;
export const CONFIG = load("Config");
export const BALANCE = load("Balance");
const enemyRaw = load("EnemyData");
// Central Pokémon database -> combat/shop definitions. The primary type is the "faction" until the Phase 2 synergy manager.
export const SPECIES: any[] = speciesRaw.species;
export const ROSTER_ALL: UnitDef[] = SPECIES.map((s) => ({
  id: s.id, name: s.name, faction: s.types[0], role: s.role, tier: s.cost, health: s.hp, attack: s.attack, armor: s.defence, mr: s.spDefence,
  speed: s.speed, range: s.range, startMana: s.startMana, maxMana: s.maxMana, crit: s.crit, critDamage: s.critDamage, ability: s.ability,
  description: s.description, kind: s.kind, types: s.types, family: s.evolutionFamily, legendary: s.legendary, spAttack: s.spAttack, generation: s.generation, weather: s.weather, evolutionOnly: s.evolutionOnly, poolId: s.poolId, evolutionLine: s.evolutionLine, stoneEvolutions: s.stoneEvolutions,
}));
// Shop units exclude evolution-only forms (Eevee's branches); BY_ID/ROSTER_ALL still resolve them.
export const ROSTER: UnitDef[] = ROSTER_ALL.filter((u) => !u.evolutionOnly);
export const ENEMIES: Record<string, UnitDef & { enemyClass: "creep" | "boss"; coefficient: number; stun: number }> = enemyRaw.ById;
export const BOSS_DATA: Record<string, any> = load("BossData").ById;
export const TRANSFORM = load("pokemon/transformations");
export const SPECIAL_ITEMS: any[] = [
  ...TRANSFORM.megaStones.map((m: any) => ({ key: m.key, faction: "Mega", id: m.name, text: "Holder Mega Evolves in battle (final-form " + m.species + " line only): +30% HP, +25% attack, +15 defence. One per team.", rarity: "Mega", species: m.species, form: m.form })),
  { key: TRANSFORM.dynamaxBand.key, faction: "Dynamax", id: TRANSFORM.dynamaxBand.name, text: TRANSFORM.dynamaxBand.text, rarity: "Mega" },
];
export const RANKS = load("RankData");
// Shop units only live in ROSTER; BY_ID also resolves NPC enemies for combat.
export const BY_ID: Record<string, UnitDef> = { ...ENEMIES, ...Object.fromEntries(ROSTER_ALL.map((u) => [u.id, u])) };
export const ITEMS: Record<string, { key: string; faction: string; id: string; text: string; rarity: string; attack?: number; speed?: number; power?: number; crit?: number; health?: number; armor?: number; mr?: number; healPower?: number }> = CONFIG.ItemsByKey;
for (const it of SPECIAL_ITEMS) (ITEMS as any)[it.key] = it;
export const ITEM_LIST: typeof ITEMS[string][] = CONFIG.Items;
export const STONES: { key: string; id: string; text: string; rarity: string; stone: true }[] = CONFIG.Stones;
export const CLIENT_ROSTER = ROSTER_ALL.map((u) => ({
  evolutionLine: u.evolutionLine, stoneEvolutions: u.stoneEvolutions, evolutionOnly: u.evolutionOnly,
  id: u.id, name: u.name, faction: u.faction, role: u.role, tier: u.tier,
  types: u.types, legendary: u.legendary, family: u.family, health: u.health, attack: u.attack, range: u.range, ability: u.ability, description: u.description,
  armor: u.armor, mr: u.mr, speed: u.speed, crit: u.crit, maxMana: u.maxMana, startMana: u.startMana,
}));

export const RULES = {
  shopSize: CONFIG.ShopSize as number,
  benchSize: CONFIG.BenchSize as number,
  maxLevel: CONFIG.MaxCapacity as number,
  cols: CONFIG.Columns as number,
  rows: 8,
  startGold: CONFIG.StartingGold as number,
  startHealth: CONFIG.StartingHealth as number,
  rerollCost: CONFIG.RerollCost as number,
  shopOdds: CONFIG.ShopOdds as Record<string, number[]>,
  xpToLevel: CONFIG.XPToLevel as Record<string, number>,
  poolCopies: CONFIG.PoolCopies as number[],
  starScale: BALANCE.StarScale as number,
  maxAttackSpeed: BALANCE.MaxAttackSpeed as number,
  manaPerAttack: BALANCE.ManaPerAttack as number,
  damageManaCap: BALANCE.DamageManaCap as number,
  combatSeconds: ((CONFIG.CombatTicks as number) * (CONFIG.CombatStepSeconds as number)),
  factionNames: CONFIG.FactionNames as Record<string, string>,
  factionColors: CONFIG.FactionColors as Record<string, number[]>,
  traitDescriptions: CONFIG.TraitDescriptions as Record<string, string>,
  commanders: CONFIG.Commanders as { id: string; text: string }[],
  factions: CONFIG.Factions as string[],
  npcInterval: CONFIG.NPCRoundInterval as number,
  enemyBalance: CONFIG.EnemyBalance as any,
  economy: CONFIG.Economy as { baseIncome: number; winBonus: number; lossBonus: number; interestPer: number; interestMax: number; xpPerRound: number; xpBuyGold: number; xpBuyAmount: number; streaks: number[][]; startLevel: number; maxLegendaryDeployed: number; stonePerNpcWin: number },
  synergies: SYNERGIES,
  damage: CONFIG.Damage as { base: number; perSurvivor: number; roundDivisor: number; ghostMultiplier: number },
};
export const ABILITIES: Record<string, any> = { ...BALANCE.Abilities, ...Object.fromEntries(SPECIES.map((s) => [s.id, s.abilityParams])) };
