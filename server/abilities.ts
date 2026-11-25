// Per-fighter ability scripts. Each receives a Ctx (implemented by the combat engine) and schedules effects.
// Numbers come from data/Balance.json (ABILITIES) so they match the original game's balance sheet.

export interface Ctx {
  u: any; t: number; S: number; ad: number; P: number; a: any; target: any | null; foes: any[]; friends: any[];
  at(delay: number, fn: () => void, chan?: boolean): void;
  status(tg: any, name: string, chance?: number): boolean;
  lock(sec: number): void;
  phys(tg: any, raw: number, o?: { area?: boolean; pen?: number; kind?: string }): number;
  mag(tg: any, raw: number, o?: { area?: boolean; kind?: string }): number;
  ring(center: any, r: number): any[];
  allyRing(center: any, r: number): any[];
  line(tg: any, len: number): any[];
  lineFrom(from: any, tg: any, len: number): any[];
  cone(tg: any, range: number, deg: number): any[];
  lowestFoe(maxDist?: number): any | null;
  farthestFoe(maxDist?: number, pool?: any[]): any | null;
  lowestAllies(n: number, maxDist?: number): any[];
  heal(tg: any, amt: number): void;
  shield(tg: any, amt: number, dur: number): void;
  mod(tg: any, k: Record<string, number>, dur: number): void;
  stun(tg: any, s: number): void;
  root(tg: any, s: number): void;
  silence(tg: any, s: number): void;
  cleanse(tg: any): void;
  dashAdj(tg: any): boolean;
  dashBehind(tg: any): boolean;
  reposition(tg: any, minD: number, maxD: number, hops: number): boolean;
  transform(o: { hp?: number; ad?: number; speed?: number; armor?: number; vamp?: number }): void;
  transformed: boolean;
  control(tg: any, secs: number, mult: number): void;
  adjacentFoes(tg: any): any[];
}

const nearestOf = (c: Ctx, from: any, list: any[], n: number) =>
  [...list].sort((x, y) => c.ring(from, 99).indexOf(x) - c.ring(from, 99).indexOf(y)).slice(0, n);

export const ABILITY_FNS: Record<string, (c: Ctx) => void> = {
  yuji(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.4, () => c.phys(tg, c.ad * a.ad));
    c.at(0.4 + a.delay, () => { if (tg.alive) c.mag(tg, (a.base2 * c.S + a.ad2 * c.ad) * c.P); });
    c.lock(1);
  },
  nobara(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.5, () => { c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P); tg.nobMark = { until: c.t + 0.5 + a.duration, left: 3, v: a.mark * c.S * c.P }; });
  },
  megumi(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.4, () => c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P));
    c.at(0.8, () => { c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P); c.mod(tg, { armorPct: -a.shred, mrPct: -a.shred }, a.shredDuration); });
    c.lock(1);
  },
  yuta(c) {
    const a = c.a, low = c.lowestAllies(1)[0]; const tg = c.target;
    c.at(0.4, () => { if (low) { c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower); c.shield(low, a.shield * c.S * c.u.healPower, 4); } });
    c.at(0.8, () => { if (tg && tg.alive) c.mag(tg, c.ad * a.ad2 * c.P); });
    c.lock(1);
  },
  gojo(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(a.windup, () => {
      const hits = c.line(tg, 9);
      hits.forEach((v, i) => c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P * Math.max(0.55, 1 - 0.15 * i), { kind: "ability" }));
    });
    c.lock(a.windup + 0.4);
  },
  kobeni(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.dashAdj(tg); c.mod(c.u, { dr: 0.2 }, 1);
    for (let i = 0; i < 3; i++) c.at(0.2 + i * 0.2, () => { if (tg.alive) c.phys(tg, c.ad * a.ad / 3); });
    c.lock(0.8);
  },
  aki(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.5, () => {
      const raw = (a.base * c.S + a.ad * c.ad) * c.P;
      c.mag(tg, raw); c.stun(tg, a.stun);
      for (const v of c.adjacentFoes(tg)) c.mag(v, raw * 0.4, { area: true });
    });
    c.lock(0.9);
  },
  power(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    c.at(0.5, () => { c.phys(tg, c.ad * a.ad); for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.6, { area: true }); });
    c.lock(0.9);
  },
  denji(c) {
    const a = c.a;
    if (!c.transformed) { c.transform({ hp: a.hp, speed: a.speed }); c.lock(0.8); return; }
    const tg = c.target; if (!tg) return;
    c.at(0.5, () => { c.phys(tg, c.ad * a.ad * 1.25); c.mod(tg, { heal: -0.3 }, 4); });
    c.lock(0.9);
  },
  makima(c) {
    const a = c.a;
    c.at(a.windup, () => {
      const pool = c.foes.filter((v) => !v.boss && !(v.immuneUntil > c.t));
      const victim = c.foes.length > 1 ? pool.sort((x, y) => y.ad - x.ad)[0] : null;
      if (victim) c.control(victim, a.controlSeconds, a.controlBasicMultiplier);
      else { const tg = c.target; if (tg) { c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P); c.mod(tg, { ad: -a.fallbackWeak }, a.fallbackDuration); } }
    });
    c.lock(a.windup + 0.4);
  },
  silica(c) {
    const a = c.a, low = c.lowestAllies(1)[0]; if (!low) return;
    c.at(0.4, () => { c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower); c.mod(low, { armor: a.defense, mr: a.defense }, 4); });
  },
  lisbeth(c) {
    const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    const adj = c.allyRing(c.u, 1).filter((v) => v !== c.u).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, 2);
    for (const v of adj) c.shield(v, v.maxHp * a.shield * 0.5, 4);
    c.lock(0.6);
  },
  sinon(c) {
    const a = c.a, far = c.farthestFoe(4) ?? c.target; if (!far) return;
    c.at(a.windup, () => {
      c.line(far, 9).slice(0, 3).forEach((v, i) => c.phys(v, c.ad * a.ad * (i === 0 ? 1 : 0.6), { pen: a.penetration }));
    });
    c.lock(a.windup + 0.4);
  },
  asuna(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.dashAdj(tg); c.at(0.3, () => c.phys(tg, c.ad * a.ad)); c.mod(c.u, { speed: a.speed }, 3); c.lock(0.7);
  },
  kirito(c) {
    const a = c.a; let tg: any = c.target; if (!tg) return;
    for (let i = 0; i < 8; i++) c.at(0.2 * (i + 1), () => {
      if (tg && !tg.alive) tg = c.adjacentFoes(tg)[0]?.alive ? c.adjacentFoes(tg)[0] : c.foes.find((v: any) => v.alive) ?? null;
      if (tg && tg.alive) c.phys(tg, (c.ad * a.ad) / 8);
    }, true);
    c.lock(a.duration + 0.2);
  },
  reiner(c) {
    const a = c.a;
    if (!c.transformed) { c.transform({ hp: a.hp, armor: a.armor }); c.lock(0.8); return; }
    c.shield(c.u, c.u.maxHp * a.shield, 4);
    const tg = c.target; if (tg) c.at(0.4, () => c.phys(tg, c.ad * a.ad * 1.25));
    c.lock(0.8);
  },
  armin(c) {
    const a = c.a, tg = c.target; const dmg = (a.base * c.S + a.ad * c.ad) * c.P;
    if (!c.transformed) {
      c.at(a.windup, () => {
        c.transform({});
        for (const v of c.ring(c.u, a.transformRadius)) { c.mag(v, dmg * a.firstDamage * 1.25, { area: true }); c.mod(v, { speed: -a.slow }, 3); }
      });
      c.lock(a.windup + 0.4); return;
    }
    if (!tg) return;
    c.at(a.windup, () => { for (const v of c.ring(tg, 1)) { c.mag(v, dmg * 1.25, { area: true }); c.mod(v, { speed: -a.slow }, 3); } });
    c.lock(a.windup + 0.4);
  },
  mikasa(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    const others = c.adjacentFoes(tg).slice(0, 2);
    c.dashBehind(tg);
    c.at(0.3, () => { c.phys(tg, c.ad * a.ad); for (const v of others) c.phys(v, c.ad * a.ad * 0.5, { area: true }); });
    c.mod(c.u, { speed: a.speed }, 3); c.lock(0.7);
  },
  levi(c) {
    const a = c.a, tg = c.lowestFoe(3) ?? c.target; if (!tg) return;
    c.dashAdj(tg); c.mod(c.u, { dr: 0.3 }, a.duration);
    for (let i = 0; i < 6; i++) c.at(0.2 * (i + 1), () => {
      let v = tg; if (!v.alive) v = c.adjacentFoes(tg)[0] ?? c.foes.find((x: any) => x.alive);
      if (v && v.alive) c.phys(v, (c.ad * a.ad) / 6);
    }, true);
    c.lock(a.duration + 0.2);
  },
  eren(c) {
    const a = c.a;
    if (!c.transformed) { c.transform({ hp: a.hp, ad: a.attack }); c.lock(0.8); return; }
    const tg = c.target; if (!tg) return;
    c.at(0.5, () => { for (const v of c.cone(tg, 2, 60)) { c.phys(v, c.ad * a.ad * 1.25, { area: true }); c.stun(v, a.stun); } });
    c.lock(0.9);
  },
  amon(c) {
    const a = c.a, tg = c.target;
    c.shield(c.u, c.u.maxHp * a.shield, 4); c.mod(c.u, { armor: a.armor }, 4);
    if (tg) c.at(0.4, () => c.phys(tg, c.ad * a.ad));
    c.lock(0.8);
  },
  arima(c) {
    const a = c.a, tg = c.target; const lance = c.u.castCount % 2 === 0; c.u.castCount++;
    if (lance) {
      if (!tg) return;
      c.at(0.5, () => {
        c.phys(tg, c.ad * a.ad);
        const behind = c.line(tg, 3).filter((v) => v !== tg)[0]; if (behind) c.phys(behind, c.ad * a.ad * 0.5, { area: true });
      });
    } else {
      c.shield(c.u, a.shield * c.S * c.u.healPower, 4); c.u.counter = { until: c.t + 4, ad: a.ad2 };
    }
    c.lock(0.9);
  },
  touka(c) {
    const a = c.a;
    const near = c.foes.filter((v: any) => c.ring(c.u, 3).includes(v)).sort((x: any, y: any) => dist(c.u, x) - dist(c.u, y)).slice(0, 3);
    if (!near.length) { if (c.target) near.push(c.target); else return; }
    const per = (a.base * c.S + a.ad * c.ad) * c.P;
    for (let i = 0; i < 5; i++) { const v = near[i % near.length]; c.at(0.3 + i * 0.1, () => { if (v.alive) c.mag(v, per); }); }
    c.lock(1);
  },
  juuzou(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    for (let i = 0; i < 4; i++) c.at(0.2 * (i + 1), () => {
      if (!tg.alive) return;
      if (i === 0) c.mod(tg, { armorPct: -a.shred }, 4);
      c.phys(tg, (c.ad * a.ad) / 4);
    }, true);
    c.lock(a.duration + 0.2);
  },
  kaneki(c) {
    const a = c.a;
    if (!c.transformed) { c.transform({ hp: a.hp, vamp: a.vamp }); c.lock(0.8); return; }
    const tg = c.target; if (!tg) return;
    c.at(0.5, () => { for (const v of c.cone(tg, 2, 60)) c.phys(v, c.ad * a.ad * 1.25, { area: true }); c.heal(c.u, c.u.maxHp * a.heal); });
    c.lock(0.9);
  },
  panda(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.shield(c.u, c.u.maxHp * a.shield, a.buffDuration); c.mod(c.u, { dr: a.reduction }, a.buffDuration);
    c.at(a.impact, () => { c.phys(tg, c.ad * a.ad); for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * a.splash, { area: true }); });
    c.lock(a.duration);
  },
  nanami(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    const marked = !!tg.nanMark;
    c.at(a.impact, () => {
      if (marked) { c.phys(tg, c.ad * a.repeatAd); c.stun(tg, a.stun); }
      else { c.phys(tg, c.ad * a.ad); tg.nanMark = true; }
    });
    c.lock(marked ? a.repeatDuration : a.duration);
  },
  shoko(c) {
    const a = c.a, low = c.lowestAllies(1)[0]; if (!low) return;
    c.at(a.impact, () => { c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower); c.cleanse(low); c.mod(low, { dr: a.reduction }, a.buffDuration); });
    c.lock(a.duration);
  },
  katana_man(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    const others = c.adjacentFoes(tg).slice(0, a.maxSecondary);
    c.at(a.impact, () => { c.dashBehind(tg); c.phys(tg, c.ad * a.ad); for (const v of others) c.phys(v, c.ad * a.ad * a.splash, { area: true }); });
    c.lock(a.duration);
  },
  reze(c) {
    const a = c.a, per = (a.base * c.S + a.ad * c.ad) * c.P * 1.25;
    if (!c.transformed) {
      c.at(a.impact, () => { c.transform({}); for (const v of c.ring(c.u, 1)) c.mag(v, ((a.base * c.S + a.ad * c.ad) * c.P) * 1.25, { area: true }); });
      c.lock(a.duration); return;
    }
    let tg: any = c.target; if (!tg) return;
    for (const cue of a.cues) c.at(cue, () => {
      if (tg && !tg.alive) tg = c.foes.find((v: any) => v.alive && dist(c.u, v) <= c.u.range) ?? null;
      if (!tg) return;
      c.mag(tg, per); for (const v of c.adjacentFoes(tg)) c.mag(v, per * a.splash, { area: true });
    });
    c.lock(a.duration);
  },
  himeno(c) {
    const a = c.a, tg = c.target, low = c.lowestAllies(1)[0];
    c.at(a.impact, () => {
      if (tg && tg.alive) { c.stun(tg, a.stun); c.mod(tg, { ad: -a.attackReduction }, a.buffDuration); }
      if (low) c.shield(low, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, 4);
    });
    c.lock(a.duration);
  },
  akane(c) {
    const a = c.a;
    const inRange = c.foes.filter((v: any) => dist(c.u, v) <= 3);
    const tg = inRange.sort((x: any, y: any) => y.mana / (y.maxMana || 1) - x.mana / (x.maxMana || 1))[0] ?? c.target; if (!tg) return;
    c.at(a.impact, () => { c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P); c.silence(tg, a.silence); });
    c.lock(a.duration);
  },
  heathcliff(c) {
    const a = c.a;
    c.at(a.impact, () => {
      c.shield(c.u, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, a.effectDuration);
      for (const v of c.allyRing(c.u, 1)) if (v !== c.u) c.mod(v, { dr: a.reduction }, a.effectDuration);
    });
    c.lock(a.duration);
  },
  yuuki(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    a.cues.slice(0, 10).forEach((cue: number) => c.at(cue, () => { if (tg.alive) c.phys(tg, c.ad * a.strikeAd); }, true));
    c.at(a.cues[10], () => { if (tg.alive) c.phys(tg, c.ad * a.finisherAd * (1 + a.missingHealthScale * (1 - tg.hp / tg.maxHp))); }, true);
    c.lock(a.duration);
  },
  leafa(c) {
    const a = c.a;
    c.at(a.impact, () => {
      for (const v of c.lowestAllies(a.maxAllies, 3)) { c.heal(v, (a.healBase * c.S + a.healAd * c.ad) * c.u.healPower); c.mod(v, { speed: a.attackSpeedBonus }, a.effectDuration); }
    });
    c.lock(a.duration);
  },
  eugeo(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.at(a.release, () => { for (const v of c.line(tg, a.length)) { c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P, { area: true }); c.root(v, a.root); } });
    c.lock(a.duration);
  },
  kenny(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.reposition(tg, a.preferredTargetDistance[0], a.preferredTargetDistance[1], a.repositionRange);
    for (const cue of a.cues) c.at(cue, () => { if (tg.alive) c.phys(tg, c.ad * a.ad); });
    c.lock(a.duration);
  },
  sasha(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.u.focus = { tg, until: c.t + a.effectDuration, count: 0, third: a.thirdAd };
    c.lock(a.duration);
  },
  erwin(c) {
    const a = c.a;
    c.at(a.impact, () => { for (const v of c.allyRing(c.u, a.radius)) c.mod(v, { ad: a.attackBonus, speed: a.attackSpeedBonus }, a.effectDuration); });
    c.lock(a.duration);
  },
  ayato(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    c.reposition(tg, 2, c.u.range, a.repositionRange);
    for (const cue of a.cues) c.at(cue, () => { if (tg.alive) c.phys(tg, c.ad * a.ad); });
    c.mod(c.u, { speed: a.attackSpeedBonus }, a.effectDuration); c.lock(a.duration);
  },
  yoshimura(c) {
    const tg = c.target; if (!tg) return; const a = c.a; const cell = { col: tg.col, row: tg.row };
    c.at(a.release, () => {
      for (const v of c.foes) {
        const d = dist(cell, v); if (d > a.radius) continue;
        c.phys(v, (a.base * c.S + a.ad * c.ad) * (d === 0 ? 1 : a.splash), { area: d > 0 });
      }
    });
    c.lock(a.duration);
  },
  hinami(c) {
    const a = c.a;
    c.at(a.impact, () => {
      for (const v of c.lowestAllies(a.maxAllies, 3)) {
        c.shield(v, (a.shieldBase * c.S + a.shieldAd * c.ad) * c.u.healPower, a.effectDuration);
        for (const e of c.ring(v, 1)) c.mod(e, { speed: -a.attackSpeedReduction }, a.effectDuration);
      }
    });
    c.lock(a.duration);
  },
  tatara(c) {
    const tg = c.target; if (!tg) return; const a = c.a;
    const dir = { col: tg.col, row: tg.row }; // locked at cast start
    a.cues.forEach((cue: number) => c.at(cue, () => {
      for (const v of c.cone(dir, a.length, a.halfAngleDegrees)) c.mag(v, (a.base * c.S + a.ad * c.ad) * c.P, { area: true });
    }, true));
    c.lock(a.duration);
  },
  // ---- PvE creeps and bosses ----
  kobold_sentinel(c) { const tg = c.target; if (!tg) return; c.at(0.4, () => { c.phys(tg, c.ad * 2); c.stun(tg, 0.5); }); c.lock(0.8); },
  frenzy_boar(c) { const tg = c.target; if (!tg) return; c.at(0.4, () => c.phys(tg, c.ad * 2)); c.lock(0.8); },
  lizardman_lord(c) { const tg = c.target; if (!tg) return; c.at(0.4, () => { for (const v of c.ring(tg, 1)) c.phys(v, c.ad * 1.6, { area: true }); }); c.lock(0.8); },
  illfang(c) {
    const tg = c.target; if (!tg) return;
    c.at(1, () => { c.phys(tg, c.ad * 1.6); c.stun(tg, 0.6); for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * 1.6 * 0.8, { area: true }); }, true);
    c.lock(1.3);
  },
  gleam_eyes(c) {
    const tg = c.target; if (!tg) return;
    const dir = { col: tg.col, row: tg.row };
    c.at(1, () => { for (const v of c.cone(dir, 2, 60)) c.phys(v, c.ad * 1.7, { area: true }); }, true);
    c.lock(1.3);
  },
  skull_reaper(c) {
    const lone = c.foes.filter((v: any) => !c.adjacentFoes(v).length);
    const pool = lone.length ? lone : c.foes;
    const tg = c.farthestFoe(99, pool); if (!tg) return;
    if (c.u.stormPhase && c.u.castCount++ % 2 === 1) {
      for (let i = 0; i < 4; i++) c.at(0.5 * (i + 1), () => {
        for (const v of [...c.foes].filter((x: any) => x.alive).sort((x: any, y: any) => dist(c.u, x) - dist(c.u, y)).slice(0, 3)) c.phys(v, c.ad * 0.35, { area: true });
      }, true);
      c.lock(2.2); return;
    }
    c.at(0.6, () => { c.dashAdj(tg); c.phys(tg, c.ad * 1.5); }, true);
    c.lock(1);
  },
};

function dist(a: { col: number; row: number }, b: { col: number; row: number }) {
  const aq = a.col - Math.floor(a.row / 2), bq = b.col - Math.floor(b.row / 2);
  const dq = aq - bq, dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
void nearestOf;

// Data-driven archetypes: any species without a hand-written script uses the template for its `kind`.
// Parameters come from the species' abilityParams (base, ad, radius, shield, dur, status, statusChance ...).
const fx = (c: Ctx, tg: any) => { if (c.a.status && tg) c.status(tg, c.a.status, c.a.statusChance ?? 0.5); };
export const ARCHETYPES: Record<string, (c: Ctx) => void> = {
  strike(c) { const tg = c.target; if (!tg) return; const a = c.a; c.at(0.3, () => { if (tg.alive) { c.phys(tg, (a.base * c.S * 0.5 + a.ad * c.ad) * c.P); fx(c, tg); } }); c.lock(0.8); },
  burst(c) { const tg = c.target; if (!tg) return; const a = c.a; c.at(0.5, () => { if (tg.alive) { c.mag(tg, (a.base * c.S + a.ad * c.ad) * c.P); fx(c, tg); } }); c.lock(0.8); },
  nova(c) { const tg = c.target; if (!tg) return; const a = c.a; c.at(0.5, () => { for (const v of c.ring(tg, a.radius)) { c.mag(v, (a.base * c.S * 0.7 + a.ad * c.ad * 0.8) * c.P, { area: true }); fx(c, v); } }); c.lock(1); },
  heal(c) { const a = c.a, low = c.lowestAllies(1)[0]; if (!low) return; c.at(0.4, () => { c.heal(low, (a.base * c.S + a.ad * c.ad) * c.u.healPower); c.cleanse(low); }); c.lock(0.8); },
  shield(c) { const tg = c.target, a = c.a; c.shield(c.u, c.u.maxHp * a.shield, a.dur); c.mod(c.u, { dr: a.reduction }, a.dur); if (tg) c.at(0.4, () => { if (tg.alive) { c.phys(tg, c.ad * a.ad * 0.8); fx(c, tg); } }); c.lock(0.8); },
};

// Hand-written signature abilities, keyed by the *form* shown on the board (Gastly at 3 stars is "gengar").
// They add role identity: Snorlax guards the line, Gengar hunts the weak, Greninja dives the backline, Gardevoir hits groups, Blissey heals, Charizard breathes fire.
Object.assign(ABILITY_FNS, {
  charizard(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.6, () => { for (const v of c.cone(tg, 3, 70)) { c.mag(v, (a.base * c.S * 0.9 + a.ad * c.ad) * c.P, { area: true }); c.status(v, "burn", 0.7); } }); c.lock(1.1); },
  gengar(c) { const tg = c.lowestFoe(); if (!tg) return; const a = c.a;
    c.at(0.5, () => { if (!tg.alive) return; const weak = tg.hp / tg.maxHp < 0.5 ? 1.3 : 1; c.mag(tg, (a.base * c.S * 1.3 + a.ad * c.ad * 1.2) * c.P * weak); c.status(tg, "confusion", 0.7); }); c.lock(0.9); },
  greninja(c) { const tg = c.farthestFoe(); if (!tg) return; const a = c.a; c.dashBehind(tg);
    c.at(0.3, () => { if (tg.alive) { c.phys(tg, c.ad * (a.ad + 0.5)); c.status(tg, "slow", 0.6); } }); c.lock(0.8); },
  gardevoir(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.5, () => { for (const v of c.ring(tg, 2)) { c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true }); c.status(v, "confusion", 0.4); } }); c.lock(1); },
  blissey(c) { const a = c.a; const low = c.lowestAllies(2); if (!low.length) return;
    c.at(0.4, () => { for (const v of low) { c.heal(v, (a.base * c.S * 1.4 + a.ad * c.ad) * c.u.healPower); c.cleanse(v); } }); c.lock(1); },
  snorlax(c) { const a = c.a, tg = c.target; c.shield(c.u, c.u.maxHp * 0.22, 4); c.mod(c.u, { dr: 0.2 }, 4);
    for (const v of c.allyRing(c.u, 1)) if (v !== c.u) c.shield(v, v.maxHp * 0.1, 3);
    if (tg) c.at(0.4, () => { for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.6, { area: true }); if (tg.alive) c.phys(tg, c.ad * a.ad); }); c.lock(1); },
  dragonite(c) { const tg = c.target; if (!tg) return; const a = c.a; c.dashAdj(tg); c.mod(c.u, { speed: 0.25, ad: 0.15 }, 4);
    c.at(0.3, () => { if (tg.alive) c.phys(tg, c.ad * (a.ad + 0.6)); }); c.lock(0.9); },
  tyranitar(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.4, () => { if (tg.alive) { c.phys(tg, c.ad * (a.ad + 0.4)); c.mod(tg, { armorPct: -0.25 }, 4); } for (const v of c.adjacentFoes(tg)) c.phys(v, c.ad * a.ad * 0.5, { area: true }); }); c.lock(1); },
  alakazam(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.4, () => { if (tg.alive) { c.mag(tg, (a.base * c.S * 1.2 + a.ad * c.ad) * c.P); c.status(tg, "confusion", 0.5); } }); // Psychic: ability damage + mana for the team
    for (const v of c.lowestAllies(2)) if (v !== c.u) v.mana = Math.min(v.maxMana, v.mana + 15); c.lock(0.9); },
  machamp(c) { const tg = c.target; if (!tg) return; const a = c.a;
    for (let i = 0; i < 4; i++) c.at(0.2 + i * 0.18, () => { if (tg.alive) c.phys(tg, c.ad * a.ad / 3); }); c.lock(1); },
  ninetales(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.5, () => { for (const v of c.ring(tg, 1.5)) { c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true }); c.status(v, "burn", 0.6); } }); c.lock(1); },
  politoed(c) { const a = c.a; c.at(0.4, () => { for (const v of c.allyRing(c.u, 3)) c.heal(v, (a.base * c.S * 0.5 + a.ad * c.ad * 0.4) * c.u.healPower); }); c.lock(0.9); },
  abomasnow(c) { const tg = c.target; if (!tg) return; const a = c.a;
    c.at(0.5, () => { for (const v of c.ring(tg, 1.5)) { c.mag(v, (a.base * c.S * 0.8 + a.ad * c.ad) * c.P, { area: true }); c.status(v, "freeze", 0.3); } }); c.lock(1); },
  lucario(c) { const tg = c.target; if (!tg) return; const a = c.a; c.at(0.35, () => { if (tg.alive) c.mag(tg, (a.base * c.S * 1.1 + a.ad * c.ad * 1.2) * c.P, { pen: 0.3 } as any); }); c.lock(0.8); },
  raichu(c) { const tg = c.target; if (!tg) return; const a = c.a; const chain = [tg, ...c.foes.filter((v: any) => v !== tg).sort((x: any, y: any) => Math.abs(x.col - tg.col) + Math.abs(x.row - tg.row) - (Math.abs(y.col - tg.col) + Math.abs(y.row - tg.row))).slice(0, 2)];
    chain.forEach((v: any, i: number) => c.at(0.3 + i * 0.2, () => { if (v.alive) { c.mag(v, (a.base * c.S * (1 - i * 0.2) + a.ad * c.ad) * c.P); c.status(v, "paralysis", 0.5); } })); c.lock(1); },
});
