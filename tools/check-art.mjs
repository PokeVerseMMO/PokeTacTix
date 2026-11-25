// Lists fighters that still use placeholder art. Usage: node tools/check-art.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = JSON.parse(readFileSync(join(root, "data/Roster.json"), "utf8")).List.map((u) => u.id);
const has = (kind, id) => ["png", "webp", "jpg", "jpeg"].some((e) => existsSync(join(root, "client/art", kind, `${id}.${e}`)));
let missS = 0, missP = 0;
for (const id of ids) { const s = has("sprites", id), p = has("portraits", id); if (!s) missS++; if (!p) missP++; if (!s || !p) console.log(id.padEnd(16), s ? "" : "no sprite", p ? "" : "no portrait"); }
console.log(`\n${ids.length} ids: ${ids.length - missS} sprites, ${ids.length - missP} portraits; ${missS} / ${missP} still placeholders`);
