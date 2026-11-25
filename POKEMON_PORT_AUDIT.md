# Pokémon Auto Chess port – audit and plan

## 1. Existing architecture (3.4k lines, nothing rewritten yet)
- `server/` (Node 22 TS, authoritative): `server.ts` (HTTP+WebSocket, rooms), `room.ts` (8 seats, bots fill empty seats, round loop, pairing, ghost fights, resolve/damage), `rules.ts` (match state, shop, pool, buy/sell/merge/move/equip, XP, rewards, bots), `combat.ts` (deterministic seeded sim, hex distance, mana, crits, events), `abilities.ts` (per-fighter abilities), `data.ts` (loads JSON), `profiles.ts`.
- `data/*.json`: `Roster.json` (43 fighters), `Config.json` (economy, shop odds, XP, pool copies, traits), `Balance.json`, `ClassSynergies.json`, enemy/boss/equipment data.
- `client/` (Three.js r170 + HTML HUD): `scene.js`, `units.js`, `arena.js`, `scenery.js`, `client.js`, `art.js`, `style.css`, `index.html`. Electron packaging via `build.sh`.
- Tests: `test/e2e.test.ts`, `features.test.ts` (9 pass), Playwright UI flows.

## 2. Reusable as is
8-seat matches with bots, round loop, random pairing, odd-player ghost fights (no damage to the ghost), shared recruitment pool (buy removes / sell returns), level-based shop odds, 3-copy merge (1→2→3 star), reroll/lock, XP buy, items on units, class/faction trait counting, PvE rounds and bosses, deterministic seeded combat with mana + crits, server-side validation of every action, 3D arena/HUD, quality presets, test hooks.

## 3. Gaps against the Pokémon brief
| Brief | Today |
|---|---|
| 8×8 board | 7 cols × 8 rows hex; mirror is `6-col,7-row` in several places |
| Start level 1, deploy = level | Start level 3, cap table in Config |
| HP 100 / bench 10 | HP 80 / bench 9 |
| Shop odds table | Present for lv3–10 only; lv1–2 rows missing and values differ |
| XP: +2/round, 4 gold = 4 XP | Different curve (`XPToLevel`) – needs confirming |
| Economy (interest, streak, win/loss bonus) | `reward()` exists; values differ, must be made fully configurable |
| Stats: HP/Atk/SpA/Def/SpD/Speed | HP/Atk/Armor/MR/Speed – need SpA and a physical/special split |
| 18 types, dual types, effectiveness chart | Not present (2-axis faction + role traits) |
| Evolution families, Eevee branching, stones | Not present (only star merge) |
| Weather, status effects (8) | Not present as systems (some ad-hoc effects in abilities) |
| Held items (3 per unit, named items) | Item system exists; item list and 3-slot cap need checking/replacing |
| Legendary rule, Mega/Primal/Gmax/Tera | Not present |
| Pokémon database (1025 species) | Not present; 43 anime fighters only |
| Pokémon models/portraits | Not present; no art in repo |
| Debug tools for odds/combat/synergy | Partial (`test/simulate.ts`, `fair.ts`) |

## 4. Risks and dependencies
1. **Species data (biggest).** Generations 1–9 = ~1025 species with stats, types, evolutions. It must come from a data file you supply or a public dataset (the workspace cannot reach arbitrary sites; I can ingest a file you attach). I will not invent stats.
2. **Abilities at that scale.** Hand-coding 1025 abilities is not feasible; plan is an archetype ability system (data-driven templates: single-target burst, cone, AoE, heal, shield, summon…) with hand-written signatures only for featured Pokémon.
3. **Art.** No Pokémon models or portraits are included; they are copyrighted and I won't generate or copy them. The client already falls back to procedural bodies and generated portraits, so the game is playable, with your own art dropped in `client/art/`.
4. **IP.** A commercial release of Pokémon content is the owner's legal risk, not something code can fix. Fine for a private/fan prototype.
5. **Performance.** 160 deployed units: sim is server-side and deterministic; client must instance/pool effects. Needs profiling after Phase 1.
6. **Rewrite risk.** The board change (7→8 columns) touches combat, scene placement, arena platform and hex marks.

## 5. Proposed structure (additive, anime ruleset stays working)
```
data/pokemon/
  species.json      # central DB (id, name, gen, types, cost, stats, range, mana, role, ability, family, megas, forms, legendary, art refs)
  evolutions.json   # families, branching (Eevee), stone/requirement rules
  types.json        # 18-type chart + configurable multipliers (1.35 / 0.80 / 0.65, caps 1.60 / 0.55)
  synergies.json    # type thresholds and effects
  items.json  weather.json  status.json  economy.json  pve.json
server/
  ruleset.ts        # selects anime | pokemon rule/config bundle (no duplicate managers)
  synergy.ts        # one synergy manager used by both rulesets
  status.ts weather.ts evolution.ts   # new, called from combat/rules
  debug.ts          # shop-odds, combat, synergy CLI tools
client/ ui + art load via the existing art manifest
```
Existing `rules.ts`, `room.ts`, `combat.ts` are extended, not duplicated.

## 6. Phases
- **Phase 1 – foundation:** ruleset switch; 8×8 board; level 1 start with deploy = level; HP 100, bench 10; shop odds + economy values from config; XP +2/round; shared pool across 8 players; bots; ghost battles; basic role AI; tests for purchases, pool, bench/deploy at level 10, 8-player match to a winner.
- **Phase 2 – database and synergies:** species DB loader, evolution families + Eevee stones, 18-type synergy manager, effectiveness multipliers, dual types, 3-star rules.
- **Phase 3:** archetype abilities, held items (3 slots), weather, 8 status effects with visuals.
- **Phase 4:** Legendary limit, PvE encounters/bosses, Mega first then Primal/Gmax/Tera, ranked.
- Each phase ends with passing logic tests (not just UI) and a build.

## 7. Open decisions
1. Species data source/scope for Phase 1 (supply a file, or start with a small hand-picked set and grow).
2. Keep anime fighters selectable as a second ruleset, or replace.
3. Confirm 8×8 hex vs square grid.
