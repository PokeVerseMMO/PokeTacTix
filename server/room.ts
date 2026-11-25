// A match room: up to 8 seats, humans and bots, driven round by round.
import { BY_ID, ENEMIES, RULES, TRANSFORM } from "./data.ts";
import { simulate, type CombatResult, type Slot } from "./combat.ts";
import { recordMatch, getProfile, rankInfo } from "./profiles.ts";
import {
  act, addPlayer, botTurn, deployed, eliminate, encounterOf, isBossEncounter, isNpcRound, newMatch, prepare, recordResult, reward, rerollCost, traitCounts,
  type Action, type Match, type Player,
} from "./rules.ts";

export interface Conn { send(msg: unknown): void; close(): void }
const PREP_SECONDS = Number(process.env.PREP_SECONDS ?? 30);
const COMBAT_PAD_MS = Number(process.env.COMBAT_PAD_MS ?? 3000);
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
    if (process.env.TEST_START_ITEMS) for (const p of this.match.players) if (p.human) p.items.push(...process.env.TEST_START_ITEMS.split(","));
    this.nextRound();
  }

  nextRound() {
    const m = this.match;
    prepare(m);
    this.npcMeta = null;
    if (isNpcRound(m.round)) {
      const enc = encounterOf(m.round);
      this.npcMeta = isBossEncounter(m.round)
        ? { name: BOSSES[(enc / 2 - 1) % BOSSES.length].name, boss: true }
        : { name: "Wild Pokémon", boss: false };
    }
    for (const p of m.players) if (!p.eliminated && (!p.human || !p.connected)) botTurn(m, p, this.difficulty);
    this.prepEndsAt = Date.now() + (PREP_SECONDS * 1000) / SPEED;
    this.pushAll();
    this.timer = setTimeout(() => this.combat(), (PREP_SECONDS * 1000) / SPEED);
  }

  handle(seat: number, action: Action) {
    const m = this.match, p = m.players[seat];
    if (!p || !this.started) return;
    const res = act(m, p, action);
    this.push(seat, res.ok ? "" : res.error);
    if (res.ok && action.a === "ready") this.checkAllReady();
  }

  checkAllReady() {
    const humans = this.humans.filter((p) => p.connected && !p.eliminated);
    if (humans.length && humans.every((p) => p.ready) && this.match.phase === "Preparation") {
      if (this.timer) clearTimeout(this.timer);
      this.combat();
    }
  }

  combat() {
    const m = this.match;
    if (m.phase !== "Preparation") return;
    m.phase = "Combat";
    for (const p of m.players) if (p.human && p.connected && !p.eliminated) {
      /* human boards stay as arranged */
    }
    const alive = m.players.filter((p) => !p.eliminated);
    if (isNpcRound(m.round)) return this.npcCombat(alive);
    const order = [...alive].sort(() => m.rng() - 0.5);
    const pairs: [Player, Player, boolean][] = [];
    while (order.length >= 2) pairs.push([order.shift()!, order.shift()!, false]);
    if (order.length === 1) {
      const solo = order[0];
      const ghost = alive.filter((p) => p !== solo)[Math.floor(m.rng() * (alive.length - 1))];
      pairs.push([solo, ghost, true]); // ghost fight: no damage dealt to the ghost
    }
    this.fights.clear();
    let longest = 0;
    const slots = (p: Player) => this.slotsOf(p);
    const results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[] = [];
    for (const [a, b, ghost] of pairs) {
      const res = simulate(slots(a), slots(b), Math.floor(m.rng() * 1e9), { commanders: [a.commander, b.commander] });
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
    return deployed(p).map((u) => ({ id: u.id, stars: u.stars, col: u.col!, row: u.row!, items: [...u.items] }));
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
    this.fights.clear();
    this.rewards.clear();
    let longest = 0;
    const lineup = this.npcLineup(m.round);
    const results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[] = [];
    for (const p of alive) {
      const res = simulate(this.slotsOf(p), lineup, Math.floor(m.rng() * 1e9), { commanders: [p.commander, undefined] });
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
      if (a.commander === "Joy") a.gold += 1;
      recordResult(a, won);
    }
    this.nextRound();
  }

  resolve(results: { a: Player; b: Player; res: CombatResult; ghost: boolean }[]) {
    const m = this.match;
    const dead: Player[] = [];
    for (const { a, b, res, ghost } of results) {
      if (res.winner === -1) continue;
      const loser = res.winner === 0 ? b : a, winner = res.winner === 0 ? a : b;
      if (!(ghost && winner === b)) recordResult(winner, true);
      if (!(ghost && loser === b)) recordResult(loser, false);
      if (ghost && loser === b) continue;
      const survivors = res.survivors[res.winner];
      const D = RULES.damage, dmg = D.base + survivors * D.perSurvivor + Math.floor(m.round / D.roundDivisor);
      loser.hp -= ghost ? Math.max(1, Math.round(dmg * D.ghostMultiplier)) : dmg;
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

  snapshot(seat: number, message = "") {
    const m = this.match, p = m.players[seat];
    const counts = traitCounts(deployed(p));
    const need = RULES.xpToLevel[String(p.level)] ?? 0;
    return {
      t: "state", round: m.round, phase: m.phase,
      timeLeft: m.phase === "Preparation" ? Math.max(0, Math.round((this.prepEndsAt - Date.now()) * SPEED / 1000)) : 0,
      message, seat, npc: this.npcMeta, ranked: this.ranked,
      you: {
        name: p.name, hp: p.hp, gold: p.gold, level: p.level, xp: p.xp, xpNeed: need, commander: p.commander,
        units: p.units, shop: p.shop, shopLocked: p.shopLocked, rerollCost: rerollCost(p), ready: p.ready,
        traits: counts, eliminated: p.eliminated, placement: p.placement ?? null,
        items: p.items, reward: this.rewards.get(seat) ?? "",
      },
      players: m.players.map((q) => ({ seat: q.seat, name: q.name, hp: Math.max(0, q.hp), eliminated: q.eliminated, level: q.level, commander: q.commander, human: q.human, rank: q.human ? rankInfo(getProfile(q.name).rp).label : "" })),
    };
  }

  push(seat: number, message = "") {
    const c = this.conns.get(seat);
    if (c) c.send(this.snapshot(seat, message));
  }
  pushAll() { for (const seat of this.conns.keys()) this.push(seat); }
}

export { BY_ID };
