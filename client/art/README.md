# Dropping in painted art

The game draws placeholder characters and portraits in code. Put real art in this folder and it is picked up
automatically on the next launch (no code changes). Any file you leave out keeps its placeholder.
Formats: PNG (recommended, needs transparency for sprites), WebP or JPG for opaque images.

| Folder | File name | What it is | Suggested size |
|---|---|---|---|
| `sprites/` | `<id>.png` | Full-body character cut-out, transparent background, feet at the bottom edge, facing the camera (slightly to the right is fine; the game mirrors it when the unit walks left) | 512 x 768 |
| `portraits/` | `<id>.png` | Bust/face illustration for shop cards and the inspector | 440 x 520 |
| `trainers/` | `<commander id in lowercase>_head.png` | Square commander portrait for the standings and commander picker | 256 x 256 |
| `environment/` | `ground.png` | Top-down painted texture of the island surface (grass with a stone battlefield in the middle). Covers 23 x 19.5 world units, so use ~2:1 landscape, e.g. 2048 x 1740 | 2048 x 1740 |
| `environment/` | `sky.png` | Painted sky (clouds, blue gradient) wrapped on the background dome | 2048 x 1024 |

## Exact filenames

Every name below is lower-case, with underscores where shown. Extension can be `.png` (best), `.webp` or `.jpg`.
For each fighter you need up to three files (all optional, any you skip keep the code-drawn placeholder):

- `client/art/sprites/<id>.png`   - 512 x 768, transparent background, full body, feet on the bottom edge
- `client/art/portraits/<id>.png` - 440 x 520, bust/face for shop card and inspector
- (commanders only) the same sprite is shown on the podium

Keep the image proportions as stated (2:3 for sprites, about 5:6 for portraits). Sprites are scaled to a fixed
height in game, so a wider image just makes a wider character.

### Fighters (43)

| # | id (file name) | Display name | Faction | Role | Tier |
|---|---|---|---|---|---|
| 1 | `amon` | Koutaro Amon | TG | Guardian | 1 |
| 2 | `kobeni` | Kobeni Higashiyama | CSM | Assassin | 1 |
| 3 | `reiner` | Reiner Braun | AOT | Guardian | 1 |
| 4 | `silica` | Silica | SAO | Support | 1 |
| 5 | `yuji` | Yuji Itadori | JJK | Fighter | 1 |
| 6 | `aki` | Aki Hayakawa | CSM | Fighter | 2 |
| 7 | `arima` | Kisho Arima | TG | Ranger | 2 |
| 8 | `armin` | Armin Arlert | AOT | Caster | 2 |
| 9 | `leafa` | Leafa | SAO | Support | 2 |
| 10 | `lisbeth` | Lisbeth | SAO | Guardian | 2 |
| 11 | `nobara` | Nobara Kugisaki | JJK | Ranger | 2 |
| 12 | `panda` | Panda | JJK | Guardian | 2 |
| 13 | `sasha` | Sasha Blouse | AOT | Ranger | 2 |
| 14 | `shoko` | Shoko Ieiri | JJK | Support | 2 |
| 15 | `akane` | Akane Sawatari | CSM | Caster | 3 |
| 16 | `ayato` | Ayato Kirishima | TG | Ranger | 3 |
| 17 | `himeno` | Himeno | CSM | Support | 3 |
| 18 | `hinami` | Hinami Fueguchi | TG | Support | 3 |
| 19 | `katana_man` | Katana Man | CSM | Assassin | 3 |
| 20 | `kenny` | Kenny Ackerman | AOT | Assassin | 3 |
| 21 | `megumi` | Megumi Fushiguro | JJK | Caster | 3 |
| 22 | `mikasa` | Mikasa Ackerman | AOT | Fighter | 3 |
| 23 | `nanami` | Kento Nanami | JJK | Assassin | 3 |
| 24 | `power` | Power | CSM | Guardian | 3 |
| 25 | `sinon` | Sinon | SAO | Ranger | 3 |
| 26 | `touka` | Touka Kirishima | TG | Assassin | 3 |
| 27 | `asuna` | Asuna | SAO | Assassin | 4 |
| 28 | `denji` | Denji | CSM | Fighter | 4 |
| 29 | `erwin` | Erwin Smith | AOT | Support | 4 |
| 30 | `eugeo` | Eugeo | SAO | Caster | 4 |
| 31 | `heathcliff` | Heathcliff | SAO | Guardian | 4 |
| 32 | `juuzou` | Juuzou Suzuya | TG | Fighter | 4 |
| 33 | `levi` | Levi Ackerman | AOT | Assassin | 4 |
| 34 | `reze` | Reze | CSM | Ranger | 4 |
| 35 | `tatara` | Tatara | TG | Caster | 4 |
| 36 | `yoshimura` | Yoshimura | TG | Ranger | 4 |
| 37 | `yuta` | Yuta Okkotsu | JJK | Support | 4 |
| 38 | `yuuki` | Yuuki | SAO | Assassin | 4 |
| 39 | `eren` | Eren Yeager | AOT | Guardian | 5 |
| 40 | `gojo` | Satoru Gojo | JJK | Caster | 5 |
| 41 | `kaneki` | Ken Kaneki | TG | Fighter | 5 |
| 42 | `kirito` | Kirito | SAO | Fighter | 5 |
| 43 | `makima` | Makima | CSM | Caster | 5 |

Commanders (also fighters, same ids, shown on the podium): `gojo`, `makima`, `kirito`, `levi`, `kaneki`.

### Creeps and bosses (6)

| id | Name | Type |
|---|---|---|
| `kobold_sentinel` | Ruin Kobold Sentinel | creep |
| `frenzy_boar` | Frenzy Boar | creep |
| `lizardman_lord` | Lizardman Lord | creep |
| `illfang` | Illfang the Kobold Lord | boss |
| `gleam_eyes` | The Gleam Eyes | boss |
| `skull_reaper` | The Skull Reaper | boss |

Sprites: creeps are drawn ~3 world units tall and bosses ~4.2, so give them 768 x 768 or larger canvases.

### Commander portraits and podium models

- The standings and commander picker resolve portraits from `trainers/<id>_head.png` using the
  commander ID in `data/Config.json`, converted to lowercase. The standings show initials if the
  portrait is absent. Both human and bot seats use the same rule.
- Put an existing skinned model at `models/<id>/model.glb`. The lobby and battle client use the
  same asset. Keep the model upright and include all textures. The battle client scales the model
  and aligns its feet to the podium.
- The current loaders use `models/<id>/anim.json` with `motions.stand` and `motions.walk` tracks.
  See the Blue model directory for the track structure. Stand loops in both the lobby and battle;
  walk plays on the battlefield when the player moves.

### Island
- `client/art/environment/ground.png` - 2048 x 1740, top-down painted grass with a stone battlefield in the middle
- `client/art/environment/sky.png` - 2048 x 1024, painted sky

Check progress any time with `node tools/check-art.mjs`. Use only art you own or are licensed to use.
