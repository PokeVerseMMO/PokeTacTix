import { addPlayer, newMatch, prepare, botTurn, deployed, act } from "../server/rules.ts";
import { simulate } from "../server/combat.ts";
const m = newMatch(42);
const a = addPlayer(m, "A", false, "Blue"), b = addPlayer(m, "B", false, "Brock");
prepare(m);
for (let r = 0; r < 8; r++) {
  botTurn(m, a, "Hard"); botTurn(m, b, "Beginner");
  const slots = (p: typeof a) => deployed(p).map((u) => ({ id: u.id, stars: u.stars, col: u.col!, row: u.row! }));
  const res = simulate(slots(a), slots(b), 100 + r);
  console.log(`round ${m.round}: A fielded ${deployed(a).length} B ${deployed(b).length} -> winner ${res.winner} survivors ${res.survivors} t=${res.duration}s events=${res.events.length} gold A=${a.gold} B=${b.gold}`);
  prepare(m);
}
