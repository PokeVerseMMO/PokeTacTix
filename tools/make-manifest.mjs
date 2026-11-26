// node tools/make-manifest.mjs <dir> -> writes <dir>/version.json listing every file with its sha1
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs"; import { join } from "node:path"; import { createHash } from "node:crypto";
const dir = process.argv[2], files = {};
const walk = (d, base) => { for (const f of readdirSync(d)) { const p = join(d, f), rel = base ? base + "/" + f : f; if (statSync(p).isDirectory()) walk(p, rel); else if (!["main.cjs", "package.json", "version.json"].includes(rel)) files[rel] = createHash("sha1").update(readFileSync(p)).digest("hex"); } };
walk(dir, "");
const version = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
writeFileSync(join(dir, "version.json"), JSON.stringify({ version, files }));
console.log(`manifest: ${Object.keys(files).length} files, version ${version}`);
