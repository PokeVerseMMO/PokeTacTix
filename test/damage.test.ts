import { test } from "node:test"; import assert from "node:assert";
import { Room, roundDamage } from "../server/room.ts";
import { addPlayer, pk } from "../server/rules.ts";
test("table", () => {
  const r = (s: number, i: number) => roundDamage((s - 1) * 6 + i);
  assert.equal(r(1,2),3); assert.equal(r(2,1),5); assert.equal(r(2,4),5); assert.equal(r(2,5),6); assert.equal(r(3,3),7); assert.equal(r(3,4),11);
  assert.equal(r(4,3),13); assert.equal(r(4,4),14); assert.equal(r(5,5),15); assert.equal(r(7,2),15);
});

test("duel banners report shield-adjusted damage for paired trainers and ghost fights", () => {
  const room = new Room("duel", "Beginner", 19);
  const match = room.match;
  const a = addPlayer(match, "Player", true, "Blue");
  const b = addPlayer(match, "Rival", false, "Misty");
  const c = addPlayer(match, "Ghost challenger", false, "Brock");
  const round = 1;
  match.round = round;
  a.units.push({ uid: match.nextUid++, id: "pikachu", stars: 3, col: 3, row: 3, items: [] });
  pk(b).fortune = 1;
  pk(b).shield = 1;
  room.plan = [[a, b, false], [c, b, true]];
  room.planRound = round;
  room.combat();
  if (room.timer) clearTimeout(room.timer);

  const paired = room.fights.get(a.seat)!, mirrored = room.fights.get(b.seat)!, ghost = room.fights.get(c.seat)!;
  assert.equal(paired.result.winner, 0);
  assert.equal(ghost.result.winner, -1);
  assert.equal(mirrored.you, 1);
  assert.deepEqual(mirrored.duel, paired.duel);
  assert.equal(paired.duel![1].commander, "Misty");
  assert.equal(paired.duel![1].loss, roundDamage(round) + 3 - 2);
  assert.equal(ghost.duel![1].ghost, true);
  assert.equal(ghost.duel![1].loss, 0);
  assert.equal(pk(b).fortune, 1);
  assert.equal(pk(b).shield, 1);

  room.nextRound = () => {};
  room.resolve([
    { a, b, res: paired.result, ghost: false },
    { a: c, b, res: ghost.result, ghost: true },
  ]);
  assert.equal(b.hp, paired.duel![1].hp - paired.duel![1].loss);
  assert.equal(c.hp, ghost.duel![0].hp - ghost.duel![0].loss);
  assert.equal(pk(b).fortune, 0);
  assert.equal(pk(b).shield, 0);
});
