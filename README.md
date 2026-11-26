# PokéTactix (PC)

Standalone PC version of the Roblox auto-battler. 43 fighters, 5 factions, role traits, 8-player matches.

## Play (Windows)
1. Unzip `AnimeAutoChess-win64.zip`, run `AnimeAutoChess/AnimeAutoChess.exe`.
2. **Play vs Bots** works immediately (the game server runs inside the app).
3. **Find Online Match**: type a server address (e.g. `ws://1.2.3.4:8080`) in the Server box first.

Windows may warn "unknown publisher" — the app is unsigned. Choose More info -> Run anyway.

## Host a multiplayer server
Unzip `AnimeAutoChess-server.zip` on any machine with Node 20+ and run `run-server.bat`
(or `PORT=8080 node server.cjs`). Open TCP port 8080. Players put `ws://<your-ip>:8080` in the Server box.
Rooms fill to 8 players; empty seats become bots after 15 s.

## Controls
Click shop cards to buy - drag units from bench to your half of the board - drag to SELL to sell -
`D` reroll, `F` buy XP, `Enter` ready. Three identical fighters merge into a higher star.

## Develop
`npm install` - `npm run server` (http://localhost:8080) - `npm test` (end-to-end: bot match + 2-human match) - `./build.sh`.
Game data lives in `data/*.json` (extracted from the Roblox place). Rules: `server/rules.ts`, combat: `server/combat.ts`.

## Game features
Equipment (25 items, bag, up to 3 per fighter; drops from creep and boss rounds), PvE rounds every 4th round (creeps / bosses
Illfang, Gleam Eyes, Skull Reaper), unique ability scripts for all 43 fighters, commander passives (Gojo, Makima, Kirito,
Levi, Kaneki), ranks (RP by placement, ranked in online matches only, first 5 ranked matches loss-protected) and saved
profiles in `~/.anime-autochess/profiles.json` (keyed by name, no passwords: ranks are not tamper-proof).

Simplifications: Inverted Spear of Heaven is stats-only; Illfang's front-arc guard is approximate; Gleam Eyes' ground fire
is simplified; Pokemon/bonus rounds, shop/cosmetics, Monthly Pass, 3D models and art are not ported (fighters are initials tokens).

## Visuals (3D client)
The battle screen is a real Three.js scene (floating island, cherry tree, waterfalls, clouds, bench stones, hex tiles with
mouse raycasting, drag highlights, unit animations, pooled effects) with a mockup-style HUD. Characters, portraits and
avatars are placeholders generated in code. To get the painted look, drop your own art into `client/art/` (see
`client/art/README.md`, check progress with `node tools/check-art.mjs`). Graphics: Settings > Low / Medium / High.
Regression test: start a server with `PORT=8096 PREP_SECONDS=60 TEST_START_ITEMS=cloud,odm node server/server.ts`, then `node test/ui3d.mjs`.

## Live updates
The Windows app checks the `updates` branch of this repo every time it starts and downloads only the changed files (server, client, data), so you install the zip once.
- Publish a new version: `tools/publish-update.sh` (builds the bundle and force-pushes the `updates` branch).
- Private repo: put a read-only fine-grained token (Contents: read) in `update-token.txt` next to `PokeTactix.exe`. Not needed if the repo is public.
- `electron/main.cjs` itself is part of the zip; changing it needs a new `./build.sh` zip.
