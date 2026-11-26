// Procedural art: palettes, character styles, portraits and icons. Everything is generated in code (no copyrighted art).
export const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const HAIR = ["#f4f6ff", "#ffd35e", "#b57bff", "#e8483f", "#5ea8ff", "#ff8fc4", "#2b2438", "#7a4a2a", "#3fd0b5", "#ff9a3c", "#c8d4ff", "#9b5a3a"];
const HAIR_BY_ID = { gojo: "#f4f6ff", makima: "#d85a3a", kirito: "#26222e", levi: "#2c2a34", kaneki: "#eeeef2", yuji: "#e98fa5", nobara: "#c9703a", megumi: "#26242c", asuna: "#c9772e",
  mikasa: "#1e1b22", eren: "#4a3526", armin: "#f0d878", erwin: "#f2d36a", sinon: "#69b9d9", silica: "#7a4a2a", denji: "#f0c050", power: "#f6d9a0", touka: "#2b2a4a", reze: "#5a3a3a" };
const EYES = ["#4aa3ff", "#7bdc8a", "#ff6f91", "#b36bff", "#ffb23e", "#e8483f", "#3fd0b5"];
const ROLE_ACCENT = { Fighter: "#d8553f", Guardian: "#e0b84a", Caster: "#9a6bff", Support: "#ff8fc4", Ranger: "#5ec27a", Assassin: "#5a5a78" };

export function styleOf(id, d, factionRGB) {
  const h = hash(id), r = rng(h);
  const f = factionRGB || [200, 200, 200];
  return {
    hair: HAIR_BY_ID[id] || HAIR[h % HAIR.length], eye: EYES[(h >>> 4) % EYES.length], skin: "#ffe3cf",
    outfit: `rgb(${Math.round(f[0] * 0.55)},${Math.round(f[1] * 0.55)},${Math.round(f[2] * 0.55)})`, trim: ROLE_ACCENT[d?.role] || "#e0b84a",
    hairStyle: Math.floor(r() * 4), cape: r() < 0.55, ahoge: r() < 0.5, role: d?.role || "Fighter", boss: !!d?.boss, npc: !!d?.npc, scale: 1,
  };
}

// ---------- portraits (bust illustrations drawn on canvas) ----------
const cache = new Map();
export function portrait(id, d, factionRGB, w = 220, h = 260) {
  const key = id + w + "x" + h; if (cache.has(key)) return cache.get(key);
  const st = styleOf(id, d, factionRGB), r = rng(hash(id) ^ 77);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  const f = factionRGB || [120, 120, 200];
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, `rgb(${f[0] * .5 | 0},${f[1] * .5 | 0},${f[2] * .5 | 0})`); bg.addColorStop(1, "#120a2a"); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`; g.beginPath(); g.arc(r() * w, r() * h * 0.7, 2 + r() * 12, 0, 7); g.fill(); }
  const gl = g.createRadialGradient(w * .5, h * .42, 5, w * .5, h * .42, w * .7); gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gl; g.fillRect(0, 0, w, h);
  if (d?.npc) return drawMonsterPortrait(g, c, key, w, h, st);
  const cx = w / 2, headY = h * 0.45, hr = w * 0.27;
  // back hair
  g.fillStyle = shade(st.hair, -0.25);
  g.beginPath(); g.ellipse(cx, headY + hr * 0.2, hr * 1.35, hr * (st.hairStyle % 2 ? 2.0 : 1.35), 0, 0, 7); g.fill();
  // shoulders / outfit
  const og = g.createLinearGradient(0, h * .72, 0, h); og.addColorStop(0, shade(st.outfit, 0.15)); og.addColorStop(1, shade(st.outfit, -0.3));
  g.fillStyle = og; g.beginPath(); g.moveTo(cx - w * .5, h); g.quadraticCurveTo(cx - w * .42, h * .74, cx, h * .72); g.quadraticCurveTo(cx + w * .42, h * .74, cx + w * .5, h); g.fill();
  g.fillStyle = st.trim; g.beginPath(); g.moveTo(cx - 28, h * .73); g.lineTo(cx, h * .84); g.lineTo(cx + 28, h * .73); g.lineTo(cx + 16, h * .72); g.lineTo(cx, h * .78); g.lineTo(cx - 16, h * .72); g.fill();
  // neck + face
  g.fillStyle = shade(st.skin, -0.06); g.fillRect(cx - hr * .28, headY + hr * .7, hr * .56, hr * .6);
  g.fillStyle = st.skin; g.beginPath(); g.ellipse(cx, headY, hr * 0.92, hr * 1.02, 0, 0, 7); g.fill();
  g.fillStyle = "rgba(255,120,140,.28)"; g.beginPath(); g.ellipse(cx - hr * .55, headY + hr * .35, hr * .2, hr * .11, 0, 0, 7); g.ellipse(cx + hr * .55, headY + hr * .35, hr * .2, hr * .11, 0, 0, 7); g.fill();
  // eyes
  for (const sx of [-1, 1]) {
    const ex = cx + sx * hr * 0.42, ey = headY + hr * 0.08, ew = hr * 0.27, eh = hr * 0.38;
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, 7); g.fill();
    const ig = g.createLinearGradient(0, ey - eh, 0, ey + eh); ig.addColorStop(0, shade(st.eye, -0.4)); ig.addColorStop(0.55, st.eye); ig.addColorStop(1, shade(st.eye, 0.4));
    g.fillStyle = ig; g.beginPath(); g.ellipse(ex, ey + eh * .05, ew * .78, eh * .92, 0, 0, 7); g.fill();
    g.fillStyle = "#14102a"; g.beginPath(); g.ellipse(ex, ey + eh * .08, ew * .36, eh * .5, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex - ew * .3, ey - eh * .35, ew * .22, eh * .2, 0, 0, 7); g.fill(); g.beginPath(); g.arc(ex + ew * .25, ey + eh * .4, ew * .1, 0, 7); g.fill();
    g.strokeStyle = "#2a1a30"; g.lineWidth = 3.5; g.beginPath(); g.ellipse(ex, ey, ew * 1.02, eh * 1.02, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  }
  g.strokeStyle = "#a0525a"; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, headY + hr * .62, hr * .14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // front hair
  g.fillStyle = st.hair;
  g.beginPath(); g.moveTo(cx - hr * 1.02, headY + hr * .1); g.quadraticCurveTo(cx - hr * 1.1, headY - hr * 1.3, cx, headY - hr * 1.18); g.quadraticCurveTo(cx + hr * 1.1, headY - hr * 1.3, cx + hr * 1.02, headY + hr * .1);
  g.quadraticCurveTo(cx + hr * .75, headY - hr * .3, cx + hr * .45, headY - hr * .55); g.quadraticCurveTo(cx + hr * .2, headY - hr * .1, cx + hr * .05, headY - hr * .55);
  g.quadraticCurveTo(cx - hr * .15, headY - hr * .05, cx - hr * .38, headY - hr * .55); g.quadraticCurveTo(cx - hr * .75, headY - hr * .2, cx - hr * 1.02, headY + hr * .1); g.fill();
  g.strokeStyle = shade(st.hair, 0.35); g.lineWidth = 3; g.beginPath(); g.moveTo(cx - hr * .6, headY - hr * .95); g.quadraticCurveTo(cx - hr * .2, headY - hr * 1.15, cx + hr * .3, headY - hr * 1.0); g.stroke();
  if (st.ahoge) { g.strokeStyle = st.hair; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, headY - hr * 1.15); g.quadraticCurveTo(cx - 14, headY - hr * 1.6, cx + 8, headY - hr * 1.65); g.stroke(); }
  const vg = g.createLinearGradient(0, h * .6, 0, h); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = vg; g.fillRect(0, h * .6, w, h * .4);
  const url = c.toDataURL(); cache.set(key, url); return url;
}
function drawMonsterPortrait(g, c, key, w, h, st) {
  g.fillStyle = "#2a0f18"; g.beginPath(); g.ellipse(w / 2, h * .55, w * .36, h * .32, 0, 0, 7); g.fill();
  g.fillStyle = "#e8d9b0"; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + sx * w * .22, h * .32); g.lineTo(w / 2 + sx * w * .36, h * .1); g.lineTo(w / 2 + sx * w * .3, h * .38); g.fill(); }
  g.fillStyle = "#ff3a3a"; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + sx * w * .13, h * .5, 14, 9, sx * .3, 0, 7); g.fill(); }
  g.fillStyle = "#fff"; for (let i = -2; i <= 2; i++) g.fillRect(w / 2 + i * 14 - 5, h * .66, 9, 16);
  const url = c.toDataURL(); cache.set(key, url); return url;
}
export function shade(hex, amt) {
  let c = hex.startsWith("rgb") ? hex.match(/\d+/g).map(Number) : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  c = c.map((v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------- icons (inline SVG) ----------
const P = { stroke: "currentColor", fill: "none", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" };
const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(" ");
const ROLE_SVG = {
  Fighter: `<path d="M5 19 L16 8 M14 6 L18 10 M13 11 L8 16 M16 8 L19 5 L20 4 L19 9" ${attrs(P)}/>`,
  Guardian: `<path d="M12 3 L19 6 V12 C19 17 15.5 20 12 21.5 C8.5 20 5 17 5 12 V6 Z" ${attrs(P)}/><path d="M12 7 V17 M8.5 11 H15.5" ${attrs(P)}/>`,
  Caster: `<path d="M12 3 L14 9 L20 9.5 L15.5 13.5 L17 19.5 L12 16 L7 19.5 L8.5 13.5 L4 9.5 L10 9 Z" ${attrs(P)}/>`,
  Support: `<path d="M12 20 C4 14 4 7.5 8.5 6.5 C10.5 6 12 7.5 12 9 C12 7.5 13.5 6 15.5 6.5 C20 7.5 20 14 12 20 Z" ${attrs(P)}/>`,
  Ranger: `<path d="M6 4 C15 6 15 18 6 20 M6 4 V20 M6 12 H20 M17 9 L20 12 L17 15" ${attrs(P)}/>`,
  Assassin: `<path d="M5 5 L19 19 M19 5 L5 19 M5 5 L8 5 M19 5 L16 5" ${attrs(P)}/>`,
};
const FAC_SVG = {
  JJK: `<path d="M12 3 C7 8 7 14 12 21 C17 14 17 8 12 3 Z M12 8 V15" ${attrs(P)}/>`,
  CSM: `<path d="M4 12 H9 L11 7 L13 17 L15 12 H20 M7 6 L9 9 M17 6 L15 9" ${attrs(P)}/>`,
  SAO: `<path d="M12 3 L20 12 L12 21 L4 12 Z M12 8 L16 12 L12 16 L8 12 Z" ${attrs(P)}/>`,
  AOT: `<path d="M5 20 L12 4 L19 20 M8 14 H16" ${attrs(P)}/>`,
  TG: `<circle cx="12" cy="12" r="8" ${attrs(P)}/><path d="M12 4 V20 M6 9 L18 15" ${attrs(P)}/>`,
};
export const iconSvg = (name, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ROLE_SVG[name] || FAC_SVG[name] || `<circle cx="12" cy="12" r="8" ${attrs(P)}/>`}</svg>`;

// ---------- avatars for the standings ----------
export function avatar(name, size = 64) {
  const k = "av" + name + size; if (cache.has(k)) return cache.get(k);
  const r = rng(hash(name)), c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), s = size;
  const hue = Math.floor(r() * 360); g.fillStyle = `hsl(${hue},45%,30%)`; g.fillRect(0, 0, s, s);
  g.fillStyle = HAIR[Math.floor(r() * HAIR.length)]; g.beginPath(); g.ellipse(s / 2, s * .48, s * .38, s * .42, 0, 0, 7); g.fill();
  g.fillStyle = "#ffe3cf"; g.beginPath(); g.ellipse(s / 2, s * .55, s * .27, s * .3, 0, 0, 7); g.fill();
  g.fillStyle = EYES[Math.floor(r() * EYES.length)]; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(s / 2 + sx * s * .12, s * .55, s * .06, s * .09, 0, 0, 7); g.fill(); }
  g.fillStyle = "#fff"; for (const sx of [-1, 1]) g.fillRect(s / 2 + sx * s * .12 - 2, s * .5, 2.5, 2.5);
  g.fillStyle = HAIR[Math.floor(r() * HAIR.length)]; g.beginPath(); g.moveTo(s * .2, s * .5); g.quadraticCurveTo(s * .3, s * .12, s * .5, s * .15); g.quadraticCurveTo(s * .75, s * .12, s * .8, s * .5); g.quadraticCurveTo(s * .6, s * .3, s * .5, s * .38); g.quadraticCurveTo(s * .4, s * .3, s * .2, s * .5); g.fill();
  const url = c.toDataURL(); cache.set(k, url); return url;
}

// ---------- optional painted art dropped into client/art/ (see client/art/README.md) ----------
export const ART = { files: new Set(), textures: new Map() };
export async function loadArtManifest(base = "") {
  try { const r = await (await fetch(base + "/api/art", { cache: "no-store" })).json(); ART.files = new Set(r.files || []); } catch { ART.files = new Set(); }
  try { ART.anim = await (await fetch(base + "/art/anim/manifest.json")).json(); } catch { ART.anim = {}; }
  ART.base = base; return ART.files.size;
}
const EXT = ["png", "webp", "jpg", "jpeg"];
export function artPath(kind, id) { for (const e of EXT) { const f = `${kind}/${id}.${e}`; if (ART.files.has(f)) return (ART.base || "") + "/art/" + f; } return null; }
