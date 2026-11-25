// Persistent player profiles and ranked points (RP). Profiles are keyed by display name: there are no accounts,
// so anyone can use any name. Good enough for friends/LAN play; do not treat ranks as tamper-proof.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { RANKS } from "./data.ts";

export interface Profile { name: string; rp: number; matches: number; rankedMatches: number; wins: number; top4: number; best: number; peak: number }
const file = () => process.env.AUTOCHESS_SAVE ?? join(homedir(), ".anime-autochess", "profiles.json");
let cache: Record<string, Profile> | null = null;

function load() {
  if (cache) return cache;
  try { cache = existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : {}; } catch { cache = {}; }
  return cache!;
}
function save() {
  try {
    mkdirSync(dirname(file()), { recursive: true });
    const tmp = file() + ".tmp";
    writeFileSync(tmp, JSON.stringify(cache, null, 1)); renameSync(tmp, file());
  } catch (e) { console.warn("could not save profiles:", (e as Error).message); }
}
export const resetProfileCache = () => { cache = null; };

export function getProfile(name: string): Profile {
  const all = load(), key = name.toLowerCase();
  return (all[key] ??= { name, rp: 0, matches: 0, rankedMatches: 0, wins: 0, top4: 0, best: 8, peak: 0 });
}

export function rankInfo(rp: number) {
  const tiers = RANKS.Tiers as { min: number; name: string; color: number[]; title: string; divisions: boolean; animated?: boolean }[];
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (rp >= tiers[k].min) i = k;
  const tier = tiers[i], next = tiers[i + 1];
  let division = 0;
  if (tier.divisions) division = 3 - Math.min(2, Math.floor((rp - tier.min) / (RANKS.DivisionSize as number)));
  const numerals = ["", "I", "II", "III"];
  return {
    tier: tier.name, division, label: tier.divisions ? `${tier.name} ${numerals[division]}` : tier.name, title: tier.title,
    color: tier.color, rp, nextAt: next ? next.min : null,
  };
}

// Records a finished match. Only ranked (online) matches move RP; the first few ranked matches are loss-protected.
export function recordMatch(name: string, placement: number, ranked: boolean) {
  const p = getProfile(name);
  p.matches++;
  if (placement === 1) p.wins++;
  if (placement <= 4) p.top4++;
  p.best = Math.min(p.best, placement);
  let delta = 0;
  if (ranked) {
    delta = (RANKS.Placement as number[])[Math.min(7, Math.max(0, placement - 1))];
    if (delta < 0) delta = p.rankedMatches < (RANKS.ProtectedMatches as number) ? 0 : Math.max(delta, -(RANKS.MaxLoss as number));
    p.rankedMatches++;
    p.rp = Math.max(0, p.rp + delta);
    p.peak = Math.max(p.peak, p.rp);
  }
  save();
  return { delta, profile: p, rank: rankInfo(p.rp) };
}
