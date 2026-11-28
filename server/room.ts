// A match room: up to 8 seats, humans and bots, driven round by round.
import { buildSupply, botChoice, claim, supplyOrder, stageOf, STAGE_LEN, type SupplyEntry } from "./supply.ts";
import { BY_ID, ENEMIES, GOGO, RULES, TRANSFORM } from "./data.ts";
import { simulate, type CombatResult, type Slot } from "./combat.ts";
import { recordMatch, getProfile, rankInfo } from "./profiles.ts";
import {
  absorb, act, trapReward, addPlayer, pk, xpNeed, autoBless, autoCard, autoPick, botTurn, deployed, eliminate, encounterOf, isBossEncounter, isNpcRound, newMatch, prepare, recordResult, reward, rerollCost, traitCounts,
  type Action, type Match, type Player,
} from "./rules.ts";

export interface Conn { send(msg: unknown): void; close(): void }
const PREP_SECONDS = Number(process.env.PREP_SECONDS ?? 30);
const SUPPLY_TURN_SECONDS = Number(process.env.SUPPLY_TURN_SECONDS ?? 12);
const COMBAT_PAD_MS = Number(process.env.COMBAT_PAD_MS ?? 3000);
const ROMAN = ["", "I", "II", "III", "IV", "V"];
// base commander damage for losing a round (stage table from Config.Damage.table; later stages keep the last row)
export const roundDamage = (round: number) => { const t = RULES.damage.table, st = Math.min(5, stageOf(round)), i = ((Math.max(1, round) - 1) % STAGE_LEN); return (t[ROMAN[st]] ?? t.V)[Math.min(i, 5)]; };
const SPEED = Number(process.env.SPEED ?? 1); // test hook: >1 shortens waits
const BOSSES: { id: string; name: string; stars: number }[] = TRANSFORM.pve.bosses;
const CREEP_SETS: string[][] = TRANSFORM.pve.creepSets;

export class Room {
  id: string; match: Match; conns = new Map<number, Conn>(); started = false; finished = false;
  timer: ReturnType<typeof setTimeout> | null = null; prepEndsAt = 0; difficulty: "Beginner" | "Intermediate" | "Hard";
  placements = 0; fights = new Map<number, { you: 0 | 1; result: CombatResult; vs: string }>();
  onFinish?: () => void; log: string[] = []; ranked = false; npcMeta: { name: string; boss: boolean } | null = null; rewards = new Map<number, string>();

  constructor(id: string, difficulty: "Beginner" | "Intermediate" | "Hard" = "Intermediate", seed = Date.now()) {
    this.id = id; this.difficulty = difficulty; this.match = newMatch(seed);
  }

  get humans() { return this.match.players.filter((p) => p.human); }
  get open() { return !this.started && this.match.players.length < 8; }

  join(name: string, commander: string, conn: Conn): Player | null {
    if (!this.open) return null;
    const p = addPlayer(this.match, name, true, commander);
    this.conns.set(p.seat, conn);
    this.broadcastLobby();
    return p;
  }

  leave(seat: number) {
    this.conns.delete(seat);
    const p = this.match.players[seat];
    if (!p) return;
    p.connected = false;
    if (this.started) this.checkAllReady();
    else this.broadcastLobby();
  }

  broadcastLobby() {
    for (const [seat, c] of this.conns) {
      c.send({ t: "lobby", players: this.match.players.map((p) => ({ name: p.name, commander: p.commander })), you: seat });
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    // drop anyone who left the lobby, then renumber seats and connections
    const stay = this.match.players.filter((p) => p.connected);
    const oldConns = new Map(this.conns);
    this.conns.clear();
    const old = this.match.players;
    this.match.players = [];
    for (const p of stay) { const seat = old.indexOf(p); p.seat = this.match.players.length; this.match.players.push(p); const c = oldConns.get(seat); if (c) this.conns.set(p.seat, c); }
    // fill empty seats with bots
    let n = 0;
    while (this.match.players.length < 8) {
      n++;
      addPlayer(this.match, `Rival ${n}`, false, RULES.commanders[(n - 1) % RULES.commanders.length].id);
    }
    if (process.env.TEST_START_GOLD) for (const p of this.match.players) if (p.human) p.gold += Number(process.env.TEST_START_GOLD);
    if (process.env.TEST_START_UNITS) for (const p of this.match.players) if (p.human) for (const spec of process.env.TEST_START_UNITS.split(",")) { const [id, st] = spec.split(":"); p.units.push({ uid: this.match.nextUid++, id, stars: Number(st || 1), col: null, row: null, items: [] }); }
    if (process.env.TEST_START_BLESS) for (const p of this.match.players) if (p.human) { p.bless = [{ uid: null }]; p.items.push("blessing_transfer"); }
    if (process.env.TEST_START_ITEMS) for (const p of this.match.players) if (p.human) p.items.push(...process.env.TEST_START_ITEMS.split(","));
    this.nextRound();
  }

  supply: { stage: number; entries: SupplyEntry[]; order: number[]; idx: number; endsAt: number } | null = null;
  // After the last round of a stage, a Supply draft happens before the next Preparation.
  nextRound() {
    const m = this.match;
    if (m.round > 0 && m.round % STAGE_LEN === 0 && m.players.filter((p) => !p.eliminated).length >= 2) return this.startSupply();
    this.beginPrep();
  }
  startSupply() {
    const m = this.match; m.phase = "Supply";
    const order = supplyOrder(m);
    this.supply = { stage: stageOf(m.round), entries: buildSupply(m, stageOf(m.round), order.length), order, idx: 0, endsAt: 0 };
    this.supplyTurn();
  }
  supplyTurn() {
    const m = this.match, S = this.supply!;
    if (this.timer) clearTimeout(this.timer);
    while (S.idx < S.order.length) {
      const p = m.players[S.order[S.idx]];
      if (!p.human || !p.connected) { this.supplyTake(p, botChoice(S.entries)); S.idx++; continue; }
      S.endsAt = Date.now() + (SUPPLY_TURN_SECONDS * 1000) / SPEED;
      this.pushAll();
      this.timer = setTimeout(() => { const q = m.players[S.order[S.idx]]; this.supplyTake(q, botChoice(S.entries)); S.idx++; this.supplyTurn(); }, (SUPPLY_TURN_SECONDS * 1000) / SPEED);
      return;
    }
    this.supply = null; this.beginPrep();
  }
  supplyTake(p: Player, e: SupplyEntry | undefined) {
    if (!e) return; e.by = p.seat; claim(this.match, p, e);
    if (!p.human || !p.connected) autoBless(this.match, p);
  }
  beginPrep() {
    const m = this.match;
    prepare(m);
    this.npcMeta = null;
    if (isNpcRound(m.round)) {
      const enc = encounterOf(m.round);
      this.npcMeta = isBossEncounter(m.round)
        ? { name: BOSSES[(enc / 2 - 1) % BOSSES.length].name, boss: true }
        : { name: "Wild Pokémon", boss: false };
    }
    this.plan = null; if (!isNpcRound(m.round)) { this.plan = this.makePlan(m.players.filter((p) => !p.eliminated)); this.planRound = m.round; }
    for (const p of m.players) if (!p.eliminated && (!p.human || !p.connected)) botTurn(m, p, this.difficulty);
    this.prepEndsAt = Date.now() + (PREP_SECONDS * 1000) / SPEED;
    this.pushAll();
    this.timer = setTimeout(() => this.combat(), (PREP_SECONDS * 1000) / SPEED);
  }

  handle(seat: number, action: Action) {
    const m = this.match, p = m.players[seat];
    if (!p || !this.started) return;
    if ((action as any).a === "supplypick") {
      const S = this.supply, e = S?.entries.find((x) => x.id === (action as any).id);
      if (m.phase !== "Supply" || !S || S.order[S.idx] !== seat || !e || e.by !== null) return this.push(seat, "Not your turn to choose.");
      this.supplyTake(p, e); S.idx++; this.supplyTurn(); return;
    }
    const res = act(m, p, action);
    const shopPurchase = action.a === "buy" ? { slot: action.slot, ok: res.ok } : undefined;
    this.push(seat, res.ok ? "" : res.error, shopPurchase);
    if (res.ok && action.a === "ready") this.checkAllReady();
  }

  // Scouting an opponent during battle: send them the fight that player is in, from that player's point of view.
  combatAt = 0;
  watch(seat: number, target: number) {
    const m = this.match, f = this.fights.get(target);
    if (m.phase !== "Combat" || !f || !this.conns.get(seat)) return;
    this.conns.get(seat)!.send({ t: "combat", you: f.you, vs: f.vs, round: m.round, npc: f.vs === this.npcMeta?.name || undefined, spectate: target, elapsed: (Date.now() - this.combatAt) / 1000, ...f.result });
  }

  checkAllReady() {
    const humans = this.humans.filter((p) => p.connected && !p.eliminated);
    if (humans.length && humans.every((p) => p.ready) && this.match.phase === "Preparation") {
      if (this.timer) clearTimeout(this.timer);
      this.combat();
    }
  }

  // Who fights whom is decided when preparation starts so every player can see their next opponent.
  plan: [Player, Player, boolean][] | null = null; planRound = 0;
  makePlan(alive: Player[]): [Player, Player, boolean][] {
    const m = this.match, order = [...alive].sort(() => m.rng() - 0.5), pairs: [Player, Player, boolean][] = [];
    while (order.length >= 2) pairs.push([order.shift()!, order.shift()!, false]);
    if (order.length === 1) {
      const solo = order[0];
      const ghost = alive.filter((p) => p !== solo)[Math.floor(m.rng() * (alive.length - 1))];
      pairs.push([solo, ghost, true]); // ghost fight: no damage dealt to the ghost
    }
    return pairs;
  }
  opponentOf(seat: number): number | null {
    if (!this.plan || this.planRound !== this.match.round) return null;
    for (const [a, b, ghost] of this.plan) { if (a.seat === seat) return b.seat; if (!ghost && b.seat === seat) return a.seat; }
    return null;
  }

  combat() {
    const m = this.match;
    if (m.phase !== "Preparation") return;
    m.phase = "Combat";
    for (const p of m.players) { autoCard(m, p); autoPick(p); autoBless(m, p); } // any reward not chosen in time is taken automatically
    for (const p of m.players) if (p.human && p.connected && !p.eliminated) {
      /* human boards stay as arranged */
    }
    const alive = m.players.filter((p) => !p.eliminated);
    if (isNpcRound(m.round)) return this.npcCombat(alive);
    const pairs = this.plan && this.planRound === m.round ? this.plan.filter(([a, b]) => !a.eliminated && !b.eliminated) : this.makePlan(alive);
    this.fights.clear(); this.combatAt = Date.now();
    let longest = 0;
    const slots = (p: Player) => this.slotsOf(p);
    const results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[] = [];
    for (const [a, b, ghost] of pairs) {
      const res = simulate(slots(a), slots(b), Math.floor(m.rng() * 1e9), { commanders: [a.commander, b.commander], trap: [a.cmd?.trap, b.cmd?.trap], stage: stageOf(m.round) });
      results.push({ a, b, res, ghost });
      longest = Math.max(longest, res.duration);
      this.fights.set(a.seat, { you: 0, result: res, vs: b.name });
      if (!ghost) this.fights.set(b.seat, { you: 1, result: res, vs: a.name });
    }
    for (const [seat, f] of this.fights) {
      this.conns.get(seat)?.send({ t: "combat", you: f.you, vs: f.vs, round: m.round, ...f.result });
    }
    this.pushAll();
    const waitMs = ((longest + 1) * 1000 + COMBAT_PAD_MS) / SPEED;
    this.timer = setTimeout(() => this.resolve(results), waitMs);
  }

  slotsOf(p: Player): Slot[] {
    return deployed(p).map((u) => ({ id: u.id, stars: u.stars, col: u.col!, row: u.row!, items: [...u.items], blessing: u.blessing, water: p.cmd?.water === u.uid || undefined, love: p.cmd?.love === u.uid || undefined, hpMul: 1 + (p.cardBuff?.hp ?? 0), adMul: 1 + (p.cardBuff?.ad ?? 0) }));
  }

  npcLineup(round: number): Slot[] {
    const enc = encounterOf(round), eb = RULES.enemyBalance;
    if (isBossEncounter(round)) {
      const n = enc / 2 - 1;
      const B = BOSSES[n % BOSSES.length];
      return [{ id: B.id, stars: B.stars, col: 3, row: 3, npc: true, boss: true,
        hpMul: eb.BossHealth.base + eb.BossHealth.perBoss * n, adMul: eb.BossAttack.base + eb.BossAttack.perBoss * n }];
    }
    const set = CREEP_SETS[((enc - 1) / 2) % CREEP_SETS.length | 0];
    return [2, 3, 4].slice(0, eb.CreepCount).map((col, i) => ({
      id: set[i % set.length], stars: enc >= 5 ? 2 : 1, col, row: 3, npc: true,
      hpMul: eb.CreepHealth.base + eb.CreepHealth.perRound * round, adMul: eb.CreepAttack.base + eb.CreepAttack.perRound * round,
    }));
  }

  npcCombat(alive: Player[]) {
    const m = this.match;
    this.fights.clear(); this.combatAt = Date.now();
    this.rewards.clear();
    let longest = 0;
    const lineup = this.npcLineup(m.round);
    const results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[] = [];
    for (const p of alive) {
      const res = simulate(this.slotsOf(p), lineup, Math.floor(m.rng() * 1e9), { commanders: [p.commander, undefined], trap: [p.cmd?.trap, undefined], stage: stageOf(m.round) });
      results.push({ a: p, b: p, res, ghost: true });
      longest = Math.max(longest, res.duration);
      this.fights.set(p.seat, { you: 0, result: res, vs: this.npcMeta!.name });
    }
    for (const [seat, f] of this.fights) this.conns.get(seat)?.send({ t: "combat", you: 0, vs: f.vs, round: m.round, npc: true, ...f.result });
    this.pushAll();
    this.timer = setTimeout(() => this.resolveNpc(results), ((longest + 1) * 1000 + COMBAT_PAD_MS) / SPEED);
  }

  resolveNpc(results: { a: Player; res: CombatResult }[]) {
    const m = this.match;
    for (const { a, res } of results) {
      const won = res.winner === 0;
      const text = reward(m, a, m.round, won);
      this.rewards.set(a.seat, (won ? "Victory! Reward: " : "Defeated. ") + text);
      trapReward(m, a, res.trapHit?.[0]);
      recordResult(a, won);
    }
    this.nextRound();
  }

  resolve(results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[]) {
    const m = this.match;
    const dead: Player[] = [];
    for (const { a, b, res, ghost } of results) {
      trapReward(m, a, res.trapHit?.[0]); if (!ghost) trapReward(m, b, res.trapHit?.[1]);
      const D = RULES.damage, base = roundDamage(m.round);
      if (res.winner === -1) { // draw: both commanders take the round's base damage + the other side's surviving stars
        for (const [pl, foe] of [[a, 1], [b, 0]] as [Player, number][]) {
          if (ghost && pl === b) continue;
          const dm = base + res.stars[foe];
          pl.hp -= absorb(pl, ghost ? Math.max(1, Math.round(dm * D.ghostMultiplier)) : dm);
          if (pl.hp <= 0 && !dead.includes(pl)) dead.push(pl);
        }
        continue;
      }
      const loser = res.winner === 0 ? b : a, winner = res.winner === 0 ? a : b;
      if (!(ghost && winner === b)) recordResult(winner, true);
      if (!(ghost && loser === b)) recordResult(loser, false);
      if (ghost && loser === b) continue;
      const dmg = base + res.stars[res.winner]; // base by round + star levels of every surviving enemy unit
      loser.hp -= absorb(loser, ghost ? Math.max(1, Math.round(dmg * D.ghostMultiplier)) : dmg); // Commander shield soaks damage first
      if (loser.hp <= 0) dead.push(loser);
    }
    // placement: those dying together share the order by remaining board strength (lowest first)
    dead.sort((x, y) => x.hp - y.hp);
    for (const p of dead) {
      p.placement = m.players.filter((q) => !q.eliminated).length;
      eliminate(m, p);
    }
    const left = m.players.filter((p) => !p.eliminated);
    if (left.length <= 1 || (this.humans.length > 0 && this.humans.every((p) => p.eliminated || !p.connected))) {
      if (left[0]) left[0].placement = 1;
      this.finish();
      return;
    }
    this.nextRound();
  }

  finish() {
    this.finished = true; this.match.phase = "Finished";
    if (this.timer) clearTimeout(this.timer);
    const standings = [...this.match.players]
      .map((p) => ({ name: p.name, placement: p.placement ?? 99, human: p.human, commander: p.commander }))
      .sort((a, b) => a.placement - b.placement);
    for (const [seat, c] of this.conns) {
      const me = this.match.players[seat];
      let rank: any = null;
      if (me && me.human) {
        const r = recordMatch(me.name, me.placement ?? 8, this.ranked);
        rank = { delta: r.delta, ranked: this.ranked, ...r.rank, matches: r.profile.matches, wins: r.profile.wins, best: r.profile.best };
      }
      c.send({ t: "over", placement: me?.placement ?? 8, standings, rank });
    }
    this.onFinish?.();
  }

  snapshot(seat: number, message = "", shopPurchase?: { slot: number; ok: boolean }) {
    const m = this.match, p = m.players[seat];
    const counts = traitCounts(deployed(p));
    const need = xpNeed(p);
    const endsAt = m.phase === "Preparation" ? this.prepEndsAt : m.phase === "Supply" ? this.supply?.endsAt : undefined;
    const phaseClock = endsAt ? {
      endsAt,
      remaining: Math.max(0, (endsAt - Date.now()) * SPEED / 1000),
      duration: m.phase === "Preparation" ? PREP_SECONDS : SUPPLY_TURN_SECONDS,
      rate: SPEED,
    } : null;
    return {
      t: "state", round: m.round, phase: m.phase,
      timeLeft: Math.round(phaseClock?.remaining ?? 0), phaseClock,
      supply: m.phase === "Supply" && this.supply ? { stage: this.supply.stage, entries: this.supply.entries, order: this.supply.order, turn: this.supply.order[this.supply.idx] ?? null } : null,
      message, shopPurchase, seat, npc: this.npcMeta, opponent: this.opponentOf(seat), ranked: this.ranked, pool: this.poolInfo(p),
      you: {
        name: p.name, hp: p.hp, gold: p.gold, level: p.level, xp: p.xp, xpNeed: need, commander: p.commander, cmd: p.cmd ?? { used: 0 },
        units: p.units, shop: p.shop, shopLocked: p.shopLocked, rerollCost: rerollCost(p), fastPromotions: pk(p).fastPromo, ready: p.ready,
        traits: counts, eliminated: p.eliminated, placement: p.placement ?? null,
        items: p.items, card: p.card ? { rarity: p.card.rarity, rerolls: p.card.rerolls, options: p.card.options.map((id) => GOGO.cards.find((c) => c.id === id)) } : null, cardBuff: p.cardBuff ?? null, cardsTaken: (p.cardsTaken ?? []).map((id) => GOGO.cards.find((c) => c.id === id)).filter(Boolean), bless: p.bless?.[0] ? { uid: p.bless[0].uid, options: p.bless[0].options ?? null, left: p.bless.length } : null, picks: p.picks?.[0] ?? null, picksLeft: p.picks?.length ?? 0, reward: this.rewards.get(seat) ?? "",
      },
      players: m.players.map((q) => ({ seat: q.seat, name: q.name, hp: Math.max(0, q.hp), shield: Math.round(pk(q).shield + pk(q).fortune), board: q.units.map((u) => ({ uid: u.uid, id: u.id, stars: u.stars, col: u.col, row: u.row, items: u.items, blessing: u.blessing })), traits: traitCounts(deployed(q)), eliminated: q.eliminated, level: q.level, commander: q.commander, human: q.human, rank: q.human ? rankInfo(getProfile(q.name).rp).label : "" })),
    };
  }

  // Trainer avatars: positions are relayed so visitors scouting an island can be seen by its owner (and other scouts).
  avatars = new Map<number, { island: number; x: number; y: number; z: number; yaw: number; mv: number }>(); avatarTimer: ReturnType<typeof setTimeout> | null = null;
  setAvatar(seat: number, d: any) {
    const n = (v: any, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0);
    const island = Number.isInteger(d.island) && d.island >= 0 && d.island < this.match.players.length ? d.island : seat;
    this.avatars.set(seat, { island, x: n(d.x, -30, 30), y: n(d.y, -2, 8), z: n(d.z, -30, 30), yaw: n(d.yaw, -7, 7), mv: d.mv ? 1 : 0 });
    if (!this.avatarTimer) this.avatarTimer = setTimeout(() => { this.avatarTimer = null; const list = [...this.avatars].map(([seat, a]) => ({ seat, ...a })); for (const c of this.conns.values()) c.send({ t: "avatars", list }); }, 80);
  }

  // Shared hero pool visibility: copies still available, total copies, and copies currently owned by all players.
  poolInfo(me: Player) {
    const m = this.match, owned: Record<string, number> = {}, out: Record<string, [number, number, number]> = {};
    for (const q of m.players) for (const u of q.units) { const k = BY_ID[u.id].poolId ?? u.id; owned[k] = (owned[k] ?? 0) + 3 ** (u.stars - 1); }
    for (const id of new Set([...me.shop, ...Object.keys(m.pool)])) { if (!id) continue; const d = BY_ID[id]; if (!d) continue; const total = RULES.poolCopies[d.tier - 1] ?? 0, mine = me.shop.filter((x) => x === id).length; out[id] = [(m.pool[id] ?? 0) + mine, total, owned[id] ?? 0]; }
    return out;
  }

  push(seat: number, message = "", shopPurchase?: { slot: number; ok: boolean }) {
    const c = this.conns.get(seat);
    if (c) c.send(this.snapshot(seat, message, shopPurchase));
  }
  pushAll() { for (const seat of this.conns.keys()) this.push(seat); }
}

export { BY_ID };
