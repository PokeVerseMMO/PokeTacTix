// Deterministic auto-battle simulation on the 7x8 hex board. Produces a replay event log for clients.
import { TRANSFORM, ABILITIES, BY_ID, ITEMS, RULES, STATUS_DATA, WEATHER_DATA } from "./data.ts";
import { mulberry32 } from "./rules.ts";
import { tierOf, traitCounts, typeBonuses, typeMultiplier } from "./synergy.ts";
import { ABILITY_FNS, ARCHETYPES, type Ctx } from "./abilities.ts";

export interface Slot { id: string; stars: number; col: number; row: number; items?: string[]; hpMul?: number; adMul?: number; npc?: boolean; boss?: boolean }
export interface CombatEvent { t: number; k: string; u: number; tg?: number; v?: number; col?: number; row?: number; crit?: boolean; name?: string; x?: number; art?: string | null }
export interface CombatResult {
  winner: 0 | 1 | -1; survivors: [number, number]; duration: number;
  start: { uid: number; id: string; side: number; stars: number; col: number; row: number; hp: number; items: string[]; mana: number; maxMana: number; art?: string; npc?: boolean; boss?: boolean }[];
  events: CombatEvent[]; traits: [Record<string, number>, Record<string, number>];
}
export interface SimOptions { commanders?: [string | undefined, string | undefined] }

interface Mod { until: number; k: Record<string, number> }
interface Bleed { src: any; until: number; dps: number; tag: string }

// odd-r offset hex distance (matches the Roblox board).
export function hexDistance(a: { col: number; row: number }, b: { col: number; row: number }) {
  const aq = a.col - Math.floor(a.row / 2), bq = b.col - Math.floor(b.row / 2);
  const dq = aq - bq, dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
export const mirror = (col: number, row: number) => ({ col: RULES.cols - 1 - col, row: RULES.rows - 1 - row });
const cx = (p: { col: number; row: number }) => p.col + (p.row % 2 ? 0.5 : 0);
const cy = (p: { col: number; row: number }) => p.row * 0.866;

const idx = (n: number) => (n >= 4 ? 1 : n >= 2 ? 0 : -1);
const pick = (arr: number[], i: number) => (i < 0 ? 0 : arr[i]);

export function simulate(a: Slot[], b: Slot[], seed: number, opts: SimOptions = {}): CombatResult {
  const rng = mulberry32(seed);
  const events: CombatEvent[] = [];
  const units: any[] = [];
  let uid = 0, t = 0;
  const sides: Slot[][] = [a, b];
  const traits = [0, 1].map((s) => (sides[s].some((x) => x.npc) ? {} : traitCounts(sides[s]))) as [Record<string, number>, Record<string, number>];
  const pending: { at: number; fn: () => void; owner?: any; gen?: number }[] = [];

  const megaUsed = [false, false], gmaxUsed = [false, false];
  for (const side of [0, 1] as const) {
    const tc = traits[side];
    const T = (name: string) => idx(tc[name] ?? 0);
    const cmd = opts.commanders?.[side];
    for (const s of sides[side]) {
      const d = BY_ID[s.id];
      const scale = RULES.starScale ** (s.stars - 1);
      const pos = side === 0 ? { col: s.col, row: s.row } : mirror(s.col, s.row);
      const u: any = {
        uid: ++uid, id: s.id, side, cside: side, stars: s.stars, col: pos.col, row: pos.row,
        hp: d.health * scale * (s.hpMul ?? 1), maxHp: d.health * scale * (s.hpMul ?? 1), ad: d.attack * scale * (s.adMul ?? 1),
        armor: d.armor, mr: d.mr, speed: d.speed, range: d.range, mana: d.startMana, maxMana: d.maxMana, crit: d.crit, critDmg: d.critDamage,
        power: 1, healPower: 1, attackAt: 0.2 + rng() * 0.3, moveAt: 0, lockUntil: 0, rootUntil: 0, silenceUntil: 0, hits: 0, casts: 0, castCount: 0,
        lifesteal: 0, pen: 0, dmgBonus: 0, missingAd: 0, saoStep: 0, saoCap: 0, saoBonus: 0, jjkStep: 0, vamp: 0, areaVampDiv: 1,
        shield: 0, shieldUntil: 0, mods: [] as Mod[], bleeds: [] as Bleed[], gen: 0, dmgMana: [] as { t: number; v: number }[],
        alive: true, role: d.role, faction: d.faction, boss: !!s.boss || (d as any).enemyClass === "boss", npc: !!s.npc,
        items: new Set<string>(s.items ?? []), transformed: false, itemHits: 0, cd: {} as Record<string, number>, used: {} as Record<string, boolean>,
        kiritoStep: 0, immuneUntil: 0, mind: 0, antiHealUntil: 0,
      };
      if (d.role === "Fighter") u.ad *= 1 + pick([0.12, 0.24], T("Fighter"));
      if (d.role === "Caster") u.power += pick([0.15, 0.3], T("Caster"));
      if (d.role === "Assassin") { u.crit += pick([0.1, 0.2], T("Assassin")); u.critDmg += pick([0.1, 0.2], T("Assassin")); }
      if (d.role === "Support") u.healPower += pick([0.2, 0.3], T("Support"));
      if (d.role === "Ranger") { u.speed *= 1 + pick([0.1, 0.2], T("Ranger")); u.pen = pick([0.1, 0.2], T("Ranger")); }
      if (d.role === "Guardian") { const g = pick([15, 30], T("Guardian")); u.armor += g; u.mr += g; }
      if (d.faction === "AOT") u.dmgBonus = pick([0.12, 0.24], T("AOT"));
      if (d.faction === "CSM") u.missingAd = pick([0.2, 0.4], T("CSM"));
      if (d.faction === "TG") u.lifesteal = pick([0.08, 0.16], T("TG"));
      if (d.faction === "SAO") { u.saoStep = pick([0.03, 0.05], T("SAO")); u.saoCap = pick([0.18, 0.35], T("SAO")); }
      if (d.faction === "JJK") u.jjkStep = pick([0.06, 0.12], T("JJK"));
      // equipment stats
      let hpPct = 0, adPct = 0, spd = 0;
      for (const key of u.items) {
        const it = ITEMS[key]; if (!it) continue;
        adPct += it.attack ?? 0; spd += it.speed ?? 0; u.power += it.power ?? 0; u.crit += it.crit ?? 0;
        hpPct += it.health ?? 0; u.armor += it.armor ?? 0; u.mr += it.mr ?? 0; u.healPower += it.healPower ?? 0;
      }
      for (const key of u.items) { const it: any = ITEMS[key]; if (!it) continue; u.critDmg += it.critDmg ?? 0; u.itemDmg = (u.itemDmg ?? 0) + (it.dmgMul ?? 0); u.mana = Math.min(u.maxMana, u.mana + (it.startMana ?? 0)); }
      u.regen = u.items.has("leftovers") ? 0.015 : 0; u.sash = u.items.has("focus_sash"); u.rocky = u.items.has("rocky_helmet"); u.claw = u.items.has("quick_claw"); u.kings = u.items.has("kings_rock"); u.herb = u.items.has("mental_herb"); u.lifeOrb = u.items.has("life_orb");
      { const line = d.evolutionLine ?? [u.id]; if (u.items.has("eviolite") && s.stars < line.length) { u.armor += 30; u.mr += 30; } }
      u.ad *= 1 + adPct; u.speed *= 1 + spd; u.maxHp *= 1 + hpPct; u.hp = u.maxHp;
      // type synergies (data/pokemon/synergies.json)
      u.types = d.types ?? []; u.dmgMul = 1 + (u.itemDmg ?? 0); u.synTier = Object.fromEntries((d.types ?? []).map((ty: string) => [ty, s.npc ? 0 : tierOf(ty, tc[ty] ?? 0)]));
      if (!s.npc) {
        const b = typeBonuses(tc, u.types);
        u.ad *= 1 + (b.atkPct ?? 0); u.maxHp *= 1 + (b.hpPct ?? 0); u.hp = u.maxHp; u.speed *= 1 + (b.speedPct ?? 0);
        u.armor += b.armor ?? 0; u.mr += b.mr ?? 0; u.crit += b.crit ?? 0; u.critDmg += b.critDmg ?? 0; u.power += b.power ?? 0;
        u.lifesteal += b.lifesteal ?? 0; u.pen += b.pen ?? 0; u.healPower += b.healPower ?? 0; u.dmgMul += b.dmgMul ?? 0;
        u.mana = Math.min(u.maxMana, u.mana + (b.startMana ?? 0));
        if (b.shield) { u.shield = u.maxHp * b.shield; u.shieldUntil = 9999; }
      }
      { // Phase 4 transformations (data/pokemon/transformations.json); one Mega / Dynamax per team
        const R = TRANSFORM.rules, line = d.evolutionLine ?? [u.id];
        for (const key of u.items) {
          const it: any = ITEMS[key];
          if (it?.form && it.species === u.id && s.stars >= line.length && !megaUsed[side]) {
            megaUsed[side] = true; u.mega = it.form; u.maxHp *= R.megaHp; u.hp = u.maxHp; u.ad *= R.megaAttack; u.armor += R.megaDefense; u.mr += R.megaDefense;
          }
        }
        if (u.items.has("dynamax_band") && TRANSFORM.gmax[u.id] && !gmaxUsed[side]) { gmaxUsed[side] = true; u.gmax = TRANSFORM.gmax[u.id]; }
      }
      if (u.items.has("soul")) u.itemPen = 0.25;
      if (u.items.has("blood")) u.bloodVamp = 0.12;
      if (u.items.has("liberator")) u.cd.liberator = 0;
      if (u.items.has("simple_domain")) u.cd.domain = 0;
      if (u.items.has("thunder")) u.cd.thunder = 6;
      if (u.items.has("signal")) u.cd.signal = 8;
      if (u.items.has("devil_blood")) { u.cd.devil = 6; u.devilUses = 0; }
      if (d.id === "illfang") u.guard = true;
      if (d.id === "gleam_eyes") u.cd.aura = 3;
      units.push(u);
    }
    // commander passives
    const mine = units.filter((u) => u.side === side && !u.npc);
    if (cmd === "Misty" && mine.length) { const best = mine.reduce((x, y) => (y.ad > x.ad ? y : x)); best.kiritoStep = 0.03; }
    if (cmd === "Brock") for (const u of mine) if (!mine.some((v) => v !== u && hexDistance(u, v) === 1)) u.mods.push({ until: Infinity, k: { speed: 0.1 } });
    if (cmd === "Sabrina") for (const u of mine) u.kanekiHeal = true;
  }
  const start = units.map((u) => ({ uid: u.uid, id: u.id, side: u.side, stars: u.stars, col: u.col, row: u.row, hp: u.maxHp, items: [...u.items], mana: Math.round(u.mana), maxMana: u.maxMana, art: u.mega, npc: u.npc || undefined, boss: u.boss || undefined }));

  const alive = (side: number) => units.filter((u) => u.alive && u.side === side);
  const foesOf = (u: any) => units.filter((v) => v.alive && v.cside !== u.cside);
  const friendsOf = (u: any) => units.filter((v) => v.alive && v.cside === u.cside);
  const occupied = (col: number, row: number, ignore?: any) => units.some((v) => v.alive && v !== ignore && v.col === col && v.row === row);
  const inBounds = (col: number, row: number) => col >= 0 && col < RULES.cols && row >= 0 && row < RULES.rows;
  const modSum = (u: any, key: string) => { let s = 0; for (const m of u.mods) if (m.until > t && m.k[key]) s += m.k[key]; return s; };
  const drOf = (u: any) => { let f = 1; for (const m of u.mods) if (m.until > t && m.k.dr) f *= 1 - m.k.dr; return f; };
  const armorOf = (u: any) => (u.armor + modSum(u, "armor")) * (1 + modSum(u, "armorPct") + weatherDefBonus(u, "armorPct"));
  const mrOf = (u: any) => (u.mr + modSum(u, "mr")) * (1 + modSum(u, "mrPct") + weatherDefBonus(u, "mrPct"));
  const speedOf = (u: any) => {
    const sao = u.saoStep ? Math.min(u.saoCap, u.hits * u.saoStep) : 0;
    const kir = u.kiritoStep ? Math.min(0.24, u.hits * u.kiritoStep) : 0;
    return Math.min(RULES.maxAttackSpeed, Math.max(0.25, u.speed * (1 + sao + kir + modSum(u, "speed"))));
  };
  const adOf = (u: any) => u.ad * Math.max(0.1, 1 + u.missingAd * (1 - u.hp / u.maxHp) + modSum(u, "ad"));
  const highestHp = (u: any) => friendsOf(u).reduce<any>((best, v) => (!best || v.maxHp > best.maxHp ? v : best), null);
  const emitMana = (u: any) => { const v = Math.round(u.mana); if (u.manaSent !== v) { u.manaSent = v; events.push({ t, k: "mana", u: u.uid, v }); } };
  const addMana = (u: any, amount: number) => { u.mana = Math.min(u.maxMana, u.mana + amount); emitMana(u); };
  const later = (delay: number, fn: () => void, owner?: any, chan = false) => pending.push({ at: t + delay, fn, owner, gen: chan && owner ? owner.gen : undefined });
  const hpPct = (u: any) => u.hp / u.maxHp;

  function nearest(u: any, list: any[]) {
    let best: any = null, bd = Infinity;
    for (const v of list) {
      const d = hexDistance(u, v);
      if (d < bd || (d === bd && best && v.uid < best.uid)) { best = v; bd = d; }
    }
    return best;
  }

  // Role AI: Assassins hunt the enemy backline (casters / rangers / support) first; everyone else fights the nearest foe.
  function pickTarget(u: any, foes: any[]) {
    if (u.role === "Assassin") { const back = foes.filter((v) => v.role === "Caster" || v.role === "Ranger" || v.role === "Support"); if (back.length) return nearest(u, back); }
    return nearest(u, foes);
  }
  function heal(src: any, tgt: any, amt: number) {
    if (!tgt.alive) return;
    let v = amt;
    if (modSum(tgt, "heal")) v *= 1 + modSum(tgt, "heal");
    v = Math.min(tgt.maxHp - tgt.hp, Math.max(0, v));
    if (v <= 0) return;
    tgt.hp += v; events.push({ t, k: "heal", u: src.uid, tg: tgt.uid, v: Math.round(v) });
  }
  function healOver(src: any, tgt: any, total: number, secs: number) {
    const n = Math.max(1, Math.round(secs));
    for (let i = 1; i <= n; i++) later(i, () => heal(src, tgt, total / n));
  }
  function shield(src: any, tgt: any, amt: number, dur: number) {
    if (!tgt.alive || amt <= 0) return;
    tgt.shield = tgt.shieldUntil > t ? tgt.shield + amt : amt; tgt.shieldUntil = Math.max(tgt.shieldUntil, t + dur);
    events.push({ t, k: "shield", u: src.uid, tg: tgt.uid, v: Math.round(amt) });
  }
  function addMod(tgt: any, k: Record<string, number>, dur: number) {
    // refresh an identical modifier instead of stacking it
    const key = JSON.stringify(k);
    const same = tgt.mods.find((m: any) => m.key === key);
    if (same) same.until = Math.max(same.until, t + dur); else tgt.mods.push({ until: t + dur, k, key });
    if (tgt.mods.length > 40) tgt.mods = tgt.mods.filter((m: any) => m.until > t);
  }
  function stun(tgt: any, s: number) {
    if (!tgt.alive || s <= 0) return;
    if (tgt.items.has("curing") && !tgt.used.curing) { tgt.used.curing = true; tgt.bleeds = []; return; }
    tgt.lockUntil = Math.max(tgt.lockUntil, t + s); tgt.gen++;
  }
  function applyBleed(src: any, tgt: any, dps: number, secs: number, tag: string, cap: number) {
    const mine = tgt.bleeds.filter((b: Bleed) => b.tag === tag);
    if (mine.length >= cap) { mine.sort((x: Bleed, y: Bleed) => x.until - y.until)[0].until = t + secs; }
    else tgt.bleeds.push({ src, until: t + secs, dps, tag });
  }

  // ---------- weather ----------
  let weather: { name: string; until: number } | null = null;
  const evoOf = (u: any) => { const l = BY_ID[u.id]?.evolutionLine ?? [u.id]; return l[Math.min(u.stars - 1, l.length - 1)]; };
  const formOf = (u: any) => { if (u.mega) return u.mega; const l = BY_ID[u.id]?.evolutionLine ?? [u.id]; return l[Math.min(u.stars - 1, l.length - 1)]; };
  function setWeather(name: string) {
    weather = { name, until: t + WEATHER_DATA.duration };
    events.push({ t, k: "weather", name, v: WEATHER_DATA.duration });
    later(WEATHER_DATA.duration, () => { if (weather && weather.until <= t + 1e-6) { weather = null; events.push({ t, k: "weather", name: "none" }); } });
  }
  const weatherDef = () => (weather ? WEATHER_DATA.weather[weather.name] : null);
  const weatherDefBonus = (u: any, key: "armorPct" | "mrPct") => { const w = weatherDef(); return w?.def && u.types?.some((x: string) => w.def.types.includes(x)) ? w.def[key] : 0; };
  const weatherDmgMul = (src: any) => {
    const w = weatherDef(); if (!w || !src.types) return 1; let m = 1;
    for (const ty of src.types) { if (w.boost?.[ty]) m *= w.boost[ty]; if (w.nerf?.[ty]) m *= w.nerf[ty]; }
    return m;
  };

  // ---------- status effects (data/pokemon/status.json) ----------
  const ST = STATUS_DATA.statuses as Record<string, any>;
  function clearStatus(tgt: any, name: string) { if (tgt.status?.[name]) { delete tgt.status[name]; events.push({ t, k: "status", u: tgt.uid, name, on: false }); } }
  function applyStatus(src: any, tgt: any, name: string, chance = 1): boolean {
    const def = ST[name]; if (!def || !tgt.alive || rng() >= Math.min(1, chance)) return false;
    if (tgt.boss && def.hardCc) return false;
    if (tgt.herb && !tgt.herbUsed) { tgt.herbUsed = true; events.push({ t, k: "buff", u: tgt.uid, name: "mental_herb" }); return false; }
    if (def.hardCc && (tgt.ccImmuneUntil ?? 0) > t) return false;
    tgt.status ??= {};
    const cur = tgt.status[name], dur = def.duration;
    if (cur && def.stack === "stack") { cur.stacks = Math.min(def.maxStacks ?? 1, cur.stacks + 1); cur.until = t + dur; cur.src = src; }
    else if (cur) cur.until = Math.max(cur.until, t + dur);
    else { tgt.status[name] = { until: t + dur, stacks: 1, src }; }
    events.push({ t, k: "status", u: tgt.uid, name, on: true, v: tgt.status[name].stacks });
    if (def.hardCc) { stun(tgt, dur); tgt.ccImmuneUntil = t + dur + STATUS_DATA.ccImmunitySeconds; }
    if (def.speed) addMod(tgt, { speed: def.speed }, dur);
    later(dur + 0.05, () => { const c = tgt.status?.[name]; if (c && c.until <= t + 1e-6) clearStatus(tgt, name); });
    return true;
  }
  // percent-HP damage over time from burn / poison, once per second
  function statusTick(u: any) {
    if (!u.status) return;
    for (const [name, c] of Object.entries<any>(u.status)) {
      if (c.until <= t - 1e-6) { clearStatus(u, name); continue; }
      const def = ST[name]; if (def.dotPct) deal(c.src ?? u, u, u.maxHp * def.dotPct * (c.stacks ?? 1), "magic", "dot", { pen: 1 });
    }
  }
  const hasStatus = (u: any, name: string) => !!u.status?.[name] && u.status[name].until > t;
  // type-based proc chance on basic attacks; scaled up by that type's synergy tier
  function onHitStatus(src: any, tgt: any) {
    const ty = (src.types ?? []).find((x: string) => STATUS_DATA.onHit[x]); if (!ty) return;
    const [name, base] = STATUS_DATA.onHit[ty], tier = src.synTier?.[ty] ?? 0;
    applyStatus(src, tgt, name, base * (1 + STATUS_DATA.synergyScale * tier));
  }

  function deal(src: any, tgt: any, raw: number, type: "physical" | "magic", kind: "basic" | "ability" | "item" | "dot", o: { crit?: boolean; area?: boolean; pen?: number } = {}) {
    if (!tgt.alive || raw <= 0) return 0;
    let defense = type === "physical" ? armorOf(tgt) : mrOf(tgt);
    if (defense > 0) {
      if (kind === "basic") defense *= 1 - Math.min(0.9, (src.pen ?? 0) + (src.itemPen ?? 0));
      if (o.pen) defense *= 1 - o.pen;
    }
    let dmg = raw * (100 / (100 + Math.max(-50, defense)));
    const direct = kind === "basic" || kind === "ability";
    if (direct) {
      dmg *= (src.dmgMul ?? 1) * typeMultiplier(src.types, tgt.types) * weatherDmgMul(src);
      if (tgt.status?.sleep && ST.sleep.wakeOnDamage && hasStatus(tgt, "sleep")) { tgt.lockUntil = t; clearStatus(tgt, "sleep"); }
      if (src.dmgBonus && tgt === highestHp(tgt)) dmg *= 1 + src.dmgBonus;
      if (src.id === "nanami" && tgt.nanMark) dmg *= 1.3;
      if (tgt.guard) {
        const toSrc = { x: cx(src) - cx(tgt), y: cy(src) - cy(tgt) };
        const foe = nearest(tgt, foesOf(tgt)); const f = foe ? { x: cx(foe) - cx(tgt), y: cy(foe) - cy(tgt) } : null;
        if (f) {
          const l1 = Math.hypot(toSrc.x, toSrc.y) || 1, l2 = Math.hypot(f.x, f.y) || 1;
          if ((toSrc.x * f.x + toSrc.y * f.y) / (l1 * l2) >= 0.5) dmg *= 0.75;
        }
      }
      dmg *= drOf(tgt);
      if (kind === "ability" && tgt.items.has("simple_domain") && tgt.cd.domain <= t) { dmg *= 0.7; tgt.cd.domain = t + 6; }
      if (kind === "basic") {
        if (tgt.items.has("liberator") && tgt.cd.liberator <= t) { dmg *= 0.6; tgt.cd.liberator = t + 4; }
        if (o.crit && tgt.items.has("koukaku")) { const cd = src.critDmg; dmg *= (1 + (cd - 1) * 0.5) / cd; }
      }
    }
    if (tgt.shieldUntil > t && tgt.shield > 0) { const absorbed = Math.min(dmg, tgt.shield); tgt.shield -= absorbed; dmg -= absorbed; }
    let actual = Math.min(tgt.hp, dmg);
    if (actual >= tgt.hp - 1e-6 && tgt.sash && !tgt.sashUsed && tgt.hp >= tgt.maxHp - 1e-6 && tgt.hp > 1) { tgt.sashUsed = true; actual = tgt.hp - 1; events.push({ t, k: "buff", u: tgt.uid, name: "focus_sash" }); }
    if (actual >= tgt.hp - 1e-6 && tgt.items.has("pochita") && !tgt.used.pochita && tgt.hp > 1) {
      tgt.used.pochita = true; actual = tgt.hp - 1;
      shield(tgt, tgt, tgt.maxHp * 0.15, 2); healOver(tgt, tgt, tgt.maxHp * 0.1, 2);
    }
    tgt.hp -= actual;
    events.push({ t, k: "dmg", u: src.uid, tg: tgt.uid, v: Math.round(actual), crit: !!o.crit, name: type });
    tgt.dmgMana = tgt.dmgMana.filter((m: any) => t - m.t < 1);
    const used = tgt.dmgMana.reduce((s: number, m: any) => s + m.v, 0);
    const gain = Math.max(0, Math.min(RULES.damageManaCap - used, (actual / tgt.maxHp) * 100));
    tgt.dmgMana.push({ t, v: gain }); addMana(tgt, gain);
    if (direct && actual > 0) {
      const div = o.area ? 3 : 1;
      if (src.lifeOrb && src.alive) { src.hp = Math.max(1, src.hp - src.maxHp * 0.02); }
      if (tgt.rocky && kind === "basic" && src.alive && src !== tgt) deal(tgt, src, actual * 0.12, "physical", "item", { pen: 1 });
      if (src.lifesteal && kind === "basic") heal(src, src, actual * src.lifesteal * src.healPower);
      if (src.bloodVamp) heal(src, src, actual * (o.area ? 0.04 : src.bloodVamp));
      if (src.vamp) heal(src, src, actual * src.vamp / div);
    }
    if (tgt.hp <= 0.0001) {
      tgt.alive = false; tgt.hp = 0; events.push({ t, k: "die", u: tgt.uid });
    } else {
      const frac = hpPct(tgt);
      if (tgt.items.has("ixa") && !tgt.used.ixa && frac < 0.35) { tgt.used.ixa = true; shield(tgt, tgt, tgt.maxHp * 0.2, 4); tgt.counter = { until: t + 4, ad: 1 }; }
      if (tgt.items.has("arata") && !tgt.used.arata && frac < 0.5) { tgt.used.arata = true; addMod(tgt, { dr: 0.15 }, 4); }
      for (const h of friendsOf(tgt)) {
        if (h.items.has("healing_crystal") && !h.used.crystal && frac < 0.5 && hexDistance(h, tgt) <= 2) {
          h.used.crystal = true;
          const low = friendsOf(h).filter((v) => hpPct(v) < 1 || v === h).sort((x, y) => hpPct(x) - hpPct(y))[0];
          if (low) healOver(h, low, low.maxHp * 0.15, 3);
          break;
        }
      }
      if (tgt.kanekiHeal && !tgt.used.kaneki && frac < 0.3) { tgt.used.kaneki = true; healOver(tgt, tgt, tgt.maxHp * 0.15, 3); }
    }
    return actual;
  }

  // ---------------- movement helpers ----------------
  const neighbours = (p: { col: number; row: number }) => {
    const out: { col: number; row: number }[] = [];
    for (let row = p.row - 1; row <= p.row + 1; row++) for (let col = p.col - 1; col <= p.col + 1; col++)
      if (inBounds(col, row) && hexDistance(p, { col, row }) === 1) out.push({ col, row });
    return out;
  };
  const teleport = (u: any, col: number, row: number) => { u.col = col; u.row = row; events.push({ t, k: "move", u: u.uid, col, row, x: 1 }); };
  function stepToward(u: any, goal: { col: number; row: number }, steps: number) {
    for (let i = 0; i < steps; i++) {
      const here = hexDistance(u, goal);
      const next = neighbours(u).filter((c) => !occupied(c.col, c.row, u) && hexDistance(c, goal) < here).sort((p, q) => hexDistance(p, goal) - hexDistance(q, goal))[0];
      if (!next) break;
      teleport(u, next.col, next.row);
    }
  }
  function dashAdj(u: any, tg: any) {
    if (hexDistance(u, tg) <= 1) return true;
    const cell = neighbours(tg).filter((c) => !occupied(c.col, c.row, u)).sort((p, q) => hexDistance(p, u) - hexDistance(q, u))[0];
    if (!cell) return false; teleport(u, cell.col, cell.row); return true;
  }
  function dashBehind(u: any, tg: any) {
    const dx = cx(tg) - cx(u), dy = cy(tg) - cy(u), len = Math.hypot(dx, dy) || 1;
    const cell = neighbours(tg).filter((c) => !occupied(c.col, c.row, u))
      .sort((p, q) => ((cx(q) - cx(tg)) * dx + (cy(q) - cy(tg)) * dy) / len - ((cx(p) - cx(tg)) * dx + (cy(p) - cy(tg)) * dy) / len)[0];
    if (!cell || ((cx(cell) - cx(tg)) * dx + (cy(cell) - cy(tg)) * dy) / len <= 0) return false;
    teleport(u, cell.col, cell.row); return true;
  }
  function reposition(u: any, tg: any, minD: number, maxD: number, hops: number) {
    let best: { col: number; row: number } | null = null, bs = -Infinity;
    for (let row = 0; row < RULES.rows; row++) for (let col = 0; col < RULES.cols; col++) {
      if (occupied(col, row, u) || hexDistance(u, { col, row }) > Math.max(1, hops)) continue;
      const d = hexDistance({ col, row }, tg);
      if (d < minD || d > maxD) continue;
      const foes = foesOf(u).filter((v) => v !== tg && hexDistance(v, { col, row }) <= 1).length;
      const score = -foes * 3 - Math.abs(d - (minD + maxD) / 2);
      if (score > bs) { bs = score; best = { col, row }; }
    }
    if (best) { teleport(u, best.col, best.row); return true; } return false;
  }
  function lineFrom(from: any, tg: any, len: number, side: "foe" | "friend", viewer: any) {
    const dx = cx(tg) - cx(from), dy = cy(tg) - cy(from), l = Math.hypot(dx, dy) || 1;
    const list = side === "foe" ? foesOf(viewer) : friendsOf(viewer);
    return list.map((v) => {
      const px = cx(v) - cx(from), py = cy(v) - cy(from);
      const along = (px * dx + py * dy) / l, perp = Math.abs(px * dy - py * dx) / l;
      return { v, along, perp };
    }).filter((e) => e.along > 0.01 && e.along <= len + 0.01 && e.perp <= 0.62).sort((p, q) => p.along - q.along).map((e) => e.v);
  }

  // ---------------- abilities ----------------
  function makeCtx(u: any): Ctx {
    const a = ABILITIES[u.id] ?? {};
    const S = RULES.starScale ** (u.stars - 1);
    const foes = foesOf(u), friends = friendsOf(u);
    const target = nearest(u, foes);
    const c: Ctx = {
      u, t, S, ad: adOf(u), P: u.power, a, target, foes, friends,
      at: (delay, fn, chan) => later(delay, fn, u, !!chan),
      status: (tg, name, chance = 1) => applyStatus(u, tg, name, chance),
      lock: (sec) => { u.lockUntil = Math.max(u.lockUntil, t + sec); lockSec = Math.max(lockSec, sec); },
      phys: (tg, raw, o = {}) => deal(u, tg, raw, "physical", "ability", o),
      mag: (tg, raw, o = {}) => deal(u, tg, raw, "magic", "ability", o),
      ring: (center, r) => foesOf(u).filter((v) => hexDistance(center, v) <= r),
      allyRing: (center, r) => friendsOf(u).filter((v) => hexDistance(center, v) <= r),
      adjacentFoes: (tg) => foesOf(u).filter((v) => v !== tg && hexDistance(tg, v) === 1),
      line: (tg, len) => lineFrom(u, tg, len, "foe", u),
      lineFrom: (from, tg, len) => lineFrom(from, tg, len, "foe", u),
      cone: (tg, range, deg) => {
        const dx = cx(tg) - cx(u), dy = cy(tg) - cy(u), l = Math.hypot(dx, dy) || 1;
        return foesOf(u).filter((v) => {
          if (hexDistance(u, v) > range) return false;
          const px = cx(v) - cx(u), py = cy(v) - cy(u), pl = Math.hypot(px, py) || 1;
          return Math.acos(Math.max(-1, Math.min(1, (px * dx + py * dy) / (l * pl)))) <= (deg * Math.PI) / 180 + 1e-6;
        });
      },
      lowestFoe: (maxDist = 99) => foesOf(u).filter((v) => hexDistance(u, v) <= maxDist).sort((x, y) => hpPct(x) - hpPct(y))[0] ?? null,
      farthestFoe: (maxDist = 99, pool) => (pool ?? foesOf(u)).filter((v: any) => hexDistance(u, v) <= maxDist).sort((x: any, y: any) => hexDistance(u, y) - hexDistance(u, x))[0] ?? null,
      lowestAllies: (n, maxDist = 99) => friendsOf(u).filter((v) => hexDistance(u, v) <= maxDist).sort((x, y) => hpPct(x) - hpPct(y)).slice(0, n),
      heal: (tg, amt) => heal(u, tg, amt),
      shield: (tg, amt, dur) => shield(u, tg, amt, dur),
      mod: (tg, k, dur) => addMod(tg, k, dur),
      stun: (tg, s) => stun(tg, s),
      root: (tg, s) => { tg.rootUntil = Math.max(tg.rootUntil, t + s); },
      silence: (tg, s) => { tg.silenceUntil = Math.max(tg.silenceUntil, t + s); },
      cleanse: (tg) => { tg.bleeds = []; tg.mods = tg.mods.filter((m: any) => !Object.values(m.k).some((x: any) => x < 0)); },
      dashAdj: (tg) => dashAdj(u, tg), dashBehind: (tg) => dashBehind(u, tg),
      reposition: (tg, mn, mx, hops) => reposition(u, tg, mn, mx, hops),
      transform: (o) => {
        u.transformed = true;
        if (o.hp) { const add = u.maxHp * o.hp; u.maxHp += add; u.hp += add; }
        const k: Record<string, number> = {};
        if (o.ad) k.ad = o.ad; if (o.speed) k.speed = o.speed; if (o.armor) k.armor = o.armor;
        if (Object.keys(k).length) u.mods.push({ until: Infinity, k, key: "tf" });
        if (o.vamp) u.vamp = o.vamp;
        events.push({ t, k: "buff", u: u.uid, name: "transform" });
      },
      transformed: u.transformed,
      control: (tg, secs, mult) => {
        tg.cside = u.cside; tg.ctrlMult = mult * u.power; tg.attackAt = Math.max(tg.attackAt, t + 0.2);
        events.push({ t, k: "buff", u: tg.uid, name: "control" });
        later(secs, () => { tg.cside = tg.side; tg.ctrlMult = 0; tg.immuneUntil = t + 5; });
      },
    };
    return c;
  }
  let lockSec = 0;

  function cast(u: any) {
    const d = BY_ID[u.id];
    u.mana = 0; emitMana(u); u.casts++; lockSec = 0;
    const c = makeCtx(u);
    if (u.jjkStep && u.casts <= 5) u.power += u.jjkStep;
    events.push({ t, k: "cast", u: u.uid, tg: c.target?.uid, name: d.ability });
    const form = formOf(u), wk = BY_ID[u.id]?.weather;
    if (wk && u.stars >= (d.evolutionLine?.length ?? 1)) setWeather(wk);
    const fn = ABILITY_FNS[form] ?? ABILITY_FNS[evoOf(u)] ?? ABILITY_FNS[u.id] ?? ARCHETYPES[d.kind];
    if (fn) fn(c);
    else if (c.target) { // fallback burst
      const tg = c.target, a = c.a;
      later(0.6, () => { deal(u, tg, ((a.base ?? 100) * c.S + (a.ad ?? 1.5) * c.ad) * u.power, "magic", "ability"); stun(tg, 0.5); }, u);
    }
    if (!lockSec) c.lock(0.8);
    const gen = u.gen;
    later(lockSec, () => { if (u.alive && u.gen === gen) afterCast(u); }, u);
  }

  function afterCast(u: any) {
    const foes = foesOf(u); if (!foes.length) return;
    if (u.items.has("odm") && !u.used.odm) {
      u.used.odm = true;
      const far = foes.sort((x, y) => hexDistance(u, y) - hexDistance(u, x))[0];
      stepToward(u, far, 4);
    } else if (u.items.has("katana") && !u.used.katana) {
      u.used.katana = true;
      const tg = nearest(u, foes); stepToward(u, tg, 2);
      if (tg && hexDistance(u, tg) <= u.range) deal(u, tg, adOf(u), "physical", "item");
    }
    if (u.items.has("narukami") && (u.cd.narukami ?? 0) <= t) {
      u.cd.narukami = t + 6;
      const tg = nearest(u, foes);
      if (tg) lineFrom(u, tg, 6, "foe", u).slice(0, 3).forEach((v, i) => deal(u, v, adOf(u) * 0.8 * u.power * 0.75 ** i, "magic", "item"));
    }
    if (u.items.has("rika") && (u.cd.rika ?? 0) <= t) {
      u.cd.rika = t + 6;
      const low = friendsOf(u).filter((v) => hexDistance(u, v) <= 2).sort((x, y) => hpPct(x) - hpPct(y))[0];
      if (low) shield(u, low, low.maxHp * 0.1, 4);
    }
  }

  function onBasicHit(u: any, tg: any, crit: boolean) {
    u.itemHits++;
    const ad = adOf(u);
    if (u.items.has("cloud") && u.itemHits % 3 === 0) deal(u, tg, ad * 0.4, "physical", "item");
    if (u.items.has("repulser") && u.itemHits % 5 === 0) lineFrom(u, tg, 4, "foe", u).slice(0, 3).forEach((v) => deal(u, v, ad * 0.8, "physical", "item"));
    if (u.items.has("excalibur") && u.itemHits % 4 === 0) foesOf(u).filter((v) => v !== tg && hexDistance(v, tg) === 1).slice(0, 2).forEach((v) => deal(u, v, ad * 0.6, "physical", "item", { area: true }));
    if (u.items.has("chainsaw")) applyBleed(u, tg, ad * 0.15, 3, "chainsaw", 3);
    if (u.items.has("captain") && crit && (u.cd.captain ?? 0) <= t) { u.cd.captain = t + 4; for (let i = 0; i < 2; i++) deal(u, tg, ad * 0.25, "physical", "item"); }
    if (u.items.has("rinkaku")) {
      if ((u.cd.rinkaku ?? 0) <= t) {
        u.rinkakuCount = (u.rinkakuCount ?? 0) + 1;
        if (u.rinkakuCount >= 4) { u.rinkakuCount = 0; u.cd.rinkaku = t + 3; for (let i = 0; i < 2; i++) deal(u, tg, ad * 0.2, "physical", "item"); heal(u, u, u.maxHp * 0.03); }
      }
    }
    if (u.id === "skull_reaper") applyBleed(u, tg, ad * 0.1, 3, "reaper", 2);
    if (tg.counter && tg.counter.until > t && hexDistance(tg, u) <= 2 && tg.alive) {
      const k = tg.counter; tg.counter = null; deal(tg, u, adOf(tg) * k.ad, "physical", "item");
    }
  }

  function basicAttack(u: any, tg: any) {
    u.attackAt = t + 1 / speedOf(u);
    if (hasStatus(u, "confusion") && rng() < ST.confusion.selfChance) { const mates = friendsOf(u).filter((v) => v !== u); tg = mates.length ? mates[Math.floor(rng() * mates.length)] : u; }
    const isCrit = rng() < Math.min(1, u.crit);
    let dmg = adOf(u) * (isCrit ? u.critDmg : 1);
    if (u.focus && u.focus.until > t) {
      if (u.focus.tg !== tg) u.focus = null;
      else if (++u.focus.count === 3) { dmg = adOf(u) * u.focus.third; u.focus = null; }
    }
    if (u.ctrlMult && u.cside !== u.side) dmg *= u.ctrlMult;
    u.hits++; addMana(u, RULES.manaPerAttack);
    events.push({ t, k: "atk", u: u.uid, tg: tg.uid });
    deal(u, tg, dmg, "physical", "basic", { crit: isCrit });
    if (tg.nobMark && tg.nobMark.until > t && tg.nobMark.left > 0 && tg.alive) { tg.nobMark.left--; deal(u, tg, tg.nobMark.v, "magic", "item"); }
    if (tg.alive || true) onBasicHit(u, tg, isCrit);
    if (tg.alive && tg.cside !== u.cside) { onHitStatus(u, tg); if (u.kings && rng() < 0.12) applyStatus(u, tg, "flinch", 1); }
    if (u.claw && rng() < 0.15) u.attackAt = t;
  }

  function periodic(u: any) {
    const foes = foesOf(u);
    if (u.cd.thunder !== undefined && t >= u.cd.thunder) {
      u.cd.thunder += 6;
      const tg = nearest(u, foes);
      if (tg && hexDistance(u, tg) <= u.range + 1) for (const v of foes) if (hexDistance(v, tg) <= 1) deal(u, v, adOf(u), "physical", "item", { area: v !== tg });
    }
    if (u.cd.signal !== undefined && t >= u.cd.signal) {
      u.cd.signal += 8;
      friendsOf(u).filter((v) => v !== u && hexDistance(u, v) <= 2 && v.mana < v.maxMana && !(v.sigAt > t)).sort((x, y) => hexDistance(u, x) - hexDistance(u, y)).slice(0, 2)
        .forEach((v) => { addMana(v, 20); v.sigAt = t + 8; });
    }
    if (u.cd.devil !== undefined && t >= u.cd.devil && u.devilUses < 3) {
      u.cd.devil += 6;
      const low = friendsOf(u).filter((v) => hexDistance(u, v) <= 2 && hpPct(v) < 1).sort((x, y) => hpPct(x) - hpPct(y))[0];
      if (low) { u.devilUses++; heal(u, low, low.maxHp * 0.06); }
    }
    if (u.id === "gleam_eyes") {
      if (t >= u.cd.aura) { u.cd.aura += 3; for (const v of foes) if (hexDistance(u, v) <= 1) deal(u, v, adOf(u) * 0.15, "magic", "item", { area: true }); }
      if (u.phase && t >= (u.cd.fire ?? 0)) { u.cd.fire = t + 1; for (const v of foes) if (u.fireHexes?.some((h: any) => h.col === v.col && h.row === v.row)) deal(u, v, adOf(u) * 0.2, "magic", "item", { area: true }); }
    }
    // boss phase at 40% HP
    if (u.boss && !u.phase && hpPct(u) <= 0.4) {
      u.phase = true;
      if (u.id === "illfang") { u.guard = false; u.mods.push({ until: Infinity, k: { speed: 0.4 }, key: "phase" }); }
      if (u.id === "skull_reaper") u.stormPhase = true;
      events.push({ t, k: "buff", u: u.uid, name: "phase" });
    }
  }

  for (const u of units) { const w = BY_ID[u.id]?.weather; if (w && u.stars >= (BY_ID[u.id].evolutionLine?.length ?? 1) && !weather) setWeather(w); }
  const limit = RULES.combatSeconds;
  for (const u of units) {
    if (u.mega) events.push({ t: 0.5, k: "form", u: u.uid, art: u.mega, name: "mega", v: u.maxHp });
    if (u.gmax) {
      const R = TRANSFORM.rules;
      later(R.gmaxStart, () => {
        if (!u.alive) return; const extra = u.maxHp * (R.gmaxHp - 1); u.maxHp += extra; u.hp += extra; u.ad *= R.gmaxAttack; u.gmaxOn = true;
        events.push({ t, k: "form", u: u.uid, art: u.gmax, name: "gmax", v: u.maxHp, x: 1 });
      });
      later(R.gmaxStart + R.gmaxDuration, () => {
        if (!u.alive || !u.gmaxOn) return; u.gmaxOn = false; u.ad /= R.gmaxAttack; u.maxHp /= R.gmaxHp; u.hp = Math.min(u.hp, u.maxHp);
        events.push({ t, k: "form", u: u.uid, art: u.mega ?? null, name: "gmax", v: u.maxHp });
      });
    }
  }
  while (t < limit && alive(0).length > 0 && alive(1).length > 0) {
    t = Math.round((t + 0.1) * 10) / 10;
    pending.sort((x, y) => x.at - y.at);
    while (pending.length && pending[0].at <= t + 1e-9) {
      const p = pending.shift()!;
      if (p.owner && !p.owner.alive) continue;
      if (p.gen !== undefined && p.owner && p.owner.gen !== p.gen) continue;
      p.fn();
    }
    if (Math.abs(t - Math.round(t)) < 1e-9) { // bleed ticks once a second
      for (const u of units) if (u.alive) { statusTick(u); if (u.regen && u.hp < u.maxHp) heal(u, u, u.maxHp * u.regen); }
      { const w = weatherDef(); if (w?.chipPct) for (const u of units) if (u.alive && !u.types?.some((x: string) => w.chipImmune.includes(x))) deal(u, u, u.maxHp * w.chipPct, "magic", "dot", { pen: 1 }); }
      for (const u of units) if (u.alive && u.bleeds.length) {
        u.bleeds = u.bleeds.filter((b: Bleed) => b.until > t - 1e-9);
        for (const b of u.bleeds) deal(b.src, u, b.dps, "physical", "dot");
      }
    }
    for (const u of units) if (u.alive) periodic(u);
    for (const u of units) {
      if (!u.alive || u.lockUntil > t + 1e-9) continue;
      const foes = foesOf(u);
      const target = pickTarget(u, foes);
      if (!target) break;
      if (u.mana >= u.maxMana && u.maxMana > 0 && u.silenceUntil <= t) { cast(u); continue; }
      const dist = hexDistance(u, target);
      if (dist <= u.range) {
        if (u.attackAt <= t + 1e-9) {
          if (hasStatus(u, "paralysis") && rng() < ST.paralysis.skipChance) u.attackAt = t + 0.4; else basicAttack(u, target);
        }
      } else if (u.moveAt <= t + 1e-9 && u.rootUntil <= t) {
        const queue: { col: number; row: number; first?: { col: number; row: number } }[] = [{ col: u.col, row: u.row }];
        const seen = new Set<number>([u.row * RULES.cols + u.col]);
        let step: { col: number; row: number } | null = null;
        for (let i = 0; i < queue.length && !step; i++) {
          const p = queue[i];
          if (p.first && hexDistance(p, target) <= u.range) { step = p.first; break; }
          for (const n of neighbours(p)) {
            const key = n.row * RULES.cols + n.col;
            if (seen.has(key) || occupied(n.col, n.row, u)) continue;
            seen.add(key); queue.push({ ...n, first: p.first ?? n });
          }
        }
        if (step) { u.col = step.col; u.row = step.row; u.moveAt = t + 0.45; events.push({ t, k: "move", u: u.uid, col: u.col, row: u.row }); }
        else u.moveAt = t + 0.2;
      }
    }
  }
  while (pending.length && pending[0].at <= t + 0.9) {
    pending.sort((x, y) => x.at - y.at);
    const p = pending.shift()!;
    if (p.owner && !p.owner.alive) continue;
    p.fn();
  }

  const s0 = alive(0), s1 = alive(1);
  let winner: 0 | 1 | -1 = -1;
  if (s0.length && !s1.length) winner = 0;
  else if (s1.length && !s0.length) winner = 1;
  else if (s0.length && s1.length) {
    const r0 = s0.reduce((s, u) => s + u.hp, 0) / units.filter((u) => u.side === 0).reduce((s, u) => s + u.maxHp, 0);
    const r1 = s1.reduce((s, u) => s + u.hp, 0) / units.filter((u) => u.side === 1).reduce((s, u) => s + u.maxHp, 0);
    winner = r0 > r1 ? 0 : r1 > r0 ? 1 : -1;
  }
  return { winner, survivors: [s0.length, s1.length], duration: t, start, events, traits };
}
