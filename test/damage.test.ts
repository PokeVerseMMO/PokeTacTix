import { test } from "node:test"; import assert from "node:assert";
import { roundDamage } from "/home/claude/anime-autochess-pc/server/room.ts";
test("table", () => {
  const r = (s: number, i: number) => roundDamage((s - 1) * 6 + i);
  assert.equal(r(1,2),3); assert.equal(r(2,1),5); assert.equal(r(2,4),5); assert.equal(r(2,5),6); assert.equal(r(3,3),7); assert.equal(r(3,4),11);
  assert.equal(r(4,3),13); assert.equal(r(4,4),14); assert.equal(r(5,5),15); assert.equal(r(7,2),15);
});
