// 3D battlefield: renderer, fixed camera, hex tiles, unit visuals, picking and effects. No gameplay logic lives here.
import * as THREE from "./vendor/three.module.min.js";
import { buildArena, boardXZ, benchXZ, BENCH_TOP, COLS, ROWS, BENCH, R } from "./arena.js";
import { UnitVisual, Effects, uiTex } from "./units.js";
import { styleOf, artPath, ART } from "./art.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
const TRAINER_LOADER = new GLTFLoader(), MOTION_CACHE = new Map();
// Loads a fresh trainer model (own skeleton per instance) plus its stand/walk motions.
async function loadTrainer(id) {
  try {
    const base = `art/models/${id}/`, g = await TRAINER_LOADER.loadAsync(base + "model.glb");
    if (!MOTION_CACHE.has(id)) MOTION_CACHE.set(id, fetch(base + "anim.json").then((r) => r.json()).then((j) => j.motions).catch(() => ({})));
    const motions = await MOTION_CACHE.get(id), bones = {};
    g.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh) { o.castShadow = true; if (o.material && o.material.name && o.material.name.endsWith("_eye") && o.material.map) { o.material.map.wrapS = o.material.map.wrapT = THREE.RepeatWrapping; o.material.map.needsUpdate = true; } } });
    return { root: g.scene, motions, bones };
  } catch (e) { return null; }
}
// A walking trainer: a pivot group at the feet, the model offset inside it, stand/walk pose playback.
class Walker {
  constructor(scene, m, height = 1.7) {
    this.group = new THREE.Group(); const root = m.root; root.scale.setScalar(height / ((new THREE.Box3().setFromObject(root)).getSize(new THREE.Vector3()).y || 1));
    const bb = new THREE.Box3().setFromObject(root); root.position.set(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
    this.group.add(root); scene.add(this.group); this.scene = scene; this.motions = m.motions; this.bones = m.bones; this.t = 0; this.cur = "stand"; this.x = 0; this.y = 0; this.z = 0; this.yaw = 0;
  }
  place(x, y, z, yaw) { this.x = x; this.y = y; this.z = z; this.yaw = yaw; this.group.position.set(x, y, z); this.group.rotation.y = yaw; }
  pose(dt, walking) {
    const want = walking && this.motions.walk ? "walk" : "stand"; if (want !== this.cur) { this.cur = want; this.t = 0; }
    const mo = this.motions[this.cur]; if (!mo) return; this.t += dt; const i = Math.floor(this.t * 30) % mo.frames;
    for (const [name, k] of Object.entries(mo.bones)) { const b = this.bones[name]; if (!b) continue; if (k.q) b.quaternion.fromArray(k.q[Math.min(i, k.q.length - 1)]); if (k.t) b.position.fromArray(k.t[Math.min(i, k.t.length - 1)]); }
  }
  dispose() { this.scene.remove(this.group); }
}
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); };

const MARK = 2.15;
export const QUALITY = {
  Low: { shadows: false, shadowSize: 512, texSize: 512, grass: 450, flowers: 110, blossoms: 80, petals: 30, motes: 20, clouds: 9, dpr: 1, antialias: false },
  Medium: { shadows: true, shadowSize: 1024, texSize: 1024, grass: 1000, flowers: 180, blossoms: 150, petals: 60, motes: 40, clouds: 13, dpr: 1.5, antialias: true },
  High: { shadows: true, shadowSize: 2048, texSize: 1536, grass: 1900, flowers: 260, blossoms: 230, petals: 100, motes: 70, clouds: 17, dpr: 2, antialias: true },
};

export class Scene3D {
  constructor(canvas, qualityName = "High") {
    this.canvas = canvas; this.qname = QUALITY[qualityName] ? qualityName : "High"; const q = QUALITY[this.qname];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    this.renderer.shadowMap.enabled = q.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 400);
    this.arena = buildArena(this.scene, q);
    this.fx = new Effects(this.scene);
    this.units = new Map(); this.clock = new THREE.Clock(); this.t = 0;
    this.hover = null; this.dragging = false; this.showGrid = true; this.nums = []; this.numCursor = 0;
    this.ray = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.buildTiles(); this.resize(); this.commanderVisual = null;
    this.shakeT = 0;
  }
  setNumberContainer(el) {
    this.numEl = el; for (let i = 0; i < 48; i++) { const d = document.createElement("div"); d.className = "dmg"; d.style.display = "none"; el.appendChild(d); this.nums.push({ el: d, life: 0, pos: new THREE.Vector3(), vy: 0 }); }
  }
  buildTiles() {
    this.tiles = [];
    const hex = new THREE.Shape(); for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); const x = Math.cos(a) * (R * 0.96), y = Math.sin(a) * (R * 0.96); i ? hex.lineTo(x, y) : hex.moveTo(x, y); } hex.closePath();
    const fillGeo = new THREE.ShapeGeometry(hex); fillGeo.rotateX(-Math.PI / 2);
    const pts = hex.getPoints().map((p) => new THREE.Vector3(p.x, 0, -p.y)); const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.tileGroup = new THREE.Group(); this.scene.add(this.tileGroup);
    const markGeo = new THREE.PlaneGeometry(MARK, MARK); markGeo.rotateX(-Math.PI / 2); // hex art: stroke spans 198x229 of 256 px => 2.15 world units makes it coincide with the tile outline (R*0.96)
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const { x, z } = boardXZ(col, row);
      const fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, depthWrite: false })); fill.position.set(x, 0.035, z);
      const line = new THREE.LineLoop(lineGeo, new THREE.LineBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.35, depthWrite: false })); line.position.set(x, 0.045, z);
      const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ map: uiTex("effects/valid"), transparent: true, opacity: 0, depthWrite: false })); mark.position.set(x, 0.06, z);
      this.tileGroup.add(fill, line, mark); this.tiles.push({ col, row, fill, line, mark });
    }
    this.benchHi = []; for (let i = 0; i < BENCH; i++) {
      const p = benchXZ(i); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.35), new THREE.MeshBasicMaterial({ color: 0x9fffd0, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, BENCH_TOP + 0.08, p.z); this.scene.add(m); this.benchHi.push(m);
    }
  }
  setGrid({ mode, hoverCell, hoverBench, flip }) { // mode: 'prep' | 'drag' | 'combat'
    this.tileGroup.visible = mode !== "combat";
    for (const t of this.tiles) {
      const mine = t.row < 4, hov = hoverCell && hoverCell.col === t.col && hoverCell.row === t.row;
      t.line.visible = mode === "drag" ? mine : mine || mode === "prep"; t.line.material.opacity = mine ? (mode === "drag" ? 0.9 : 0.5) : 0.12;
      t.fill.material.color.set(mine ? 0x8affc0 : 0xff6b6b);
      t.fill.material.opacity = mode === "drag" && mine ? (hov ? 0.5 : 0.18) : hov && mode === "prep" && mine ? 0.22 : 0;
      if (mode === "drag" && hov && !mine) { t.fill.material.opacity = 0.35; }
      const mk = t.mark.material; mk.map = uiTex(mode === "drag" ? (mine ? "effects/valid" : "effects/invalid") : "effects/hover");
      mk.opacity = mode === "drag" ? (mine ? (hov ? 1 : 0.5) : hov ? 1 : 0) : mode === "prep" && mine && hov ? 0.9 : 0;
      t.fill.material.opacity = 0; t.line.visible = t.line.visible && mk.opacity < 0.3;
    }
    this.benchHi.forEach((m, i) => { m.visible = mode !== "combat"; m.material.opacity = mode === "drag" ? (hoverBench === i ? 0.4 : 0.12) : 0; });
    void flip;
  }
  worldOf(cell, flip) { // cell: {col,row} board | {bench:i}
    if (cell.bench !== undefined) { const p = benchXZ(cell.bench); return { x: p.x, z: p.z, y: BENCH_TOP + 0.03 }; }
    let { col, row } = cell; if (flip) { col = COLS - 1 - col; row = ROWS - 1 - row; }
    const p = boardXZ(col, row); return { x: p.x, z: p.z, y: 0.02 };
  }
  // ---- unit sync ----
  // list: [{key,id,def,fcolor,stars,items:[{color}],cell|world,hp,mana,showMana,selected,flip,instant}]
  sync(list) {
    const seen = new Set();
    for (const u of list) {
      seen.add(u.key);
      let v = this.units.get(u.key);
      if (!v) { v = new UnitVisual(u.key, u.id, u.def, styleOf(u.id, u.def, u.fcolor), this.fx, this.spriteFor(u.art ?? u.id)); this.units.set(u.key, v); this.scene.add(v.root); v.pop = 0.0001; const w = u.world || this.worldOf(u.cell, u.flip); v.place(w.x, w.z, w.y, true); if (u.noPop) v.pop = 0; if (u.spawnFx) this.fx.burst(v.worldPos(0.8), 0xfff0a0, 14, 1.8); }
      v.away = !!u.mine;
      {
        const artKey = u.art ?? u.id, want = this.spriteFor(artKey, v.away);
        if (v.artKey === undefined) v.artKey = artKey;
        if (v.artKey !== artKey) { const evolving = !u.noEvo && !!want && v.sprMat; v.artKey = artKey; if (evolving) { v.cryKey = u.art; v.onEvolve = this.onEvolve; v.startEvolve(want); } else if (want) v.setSprite(want); }
        else if (want) { if (v.evo) v.evo.want = want; else v.setSprite(want); }
      }
      v.stars = v.stars || 0; v.setStars(u.stars);
      const w = u.world || this.worldOf(u.cell, u.flip); v.place(w.x, w.z, w.y, !!u.instant);
      if (u.lift) v.ty = w.y + 1.0;
      v.setBars(u.hp ?? 1, u.mana ?? 0, !!u.showMana); v.setItems(u.items || []); v.selected = !!u.selected;
      v.root.visible = !u.hidden && !(v.dead && v.deathT > 0.6);
    }
    for (const [k, v] of this.units) if (!seen.has(k)) { v.dispose(); this.units.delete(k); }
  }
  spriteFor(id, back = false) { // own units show the back sprite (they face the enemy); animated sheets (art/anim) when available, else the static art
    const key = back ? id + "_back" : id, A = ART.anim || {}, ak = A[key] ? key : A[id] ? id : null;
    this._sprites ??= new Map();
    if (ak) {
      if (this._sprites.has("a:" + ak)) return this._sprites.get("a:" + ak);
      const t = new THREE.TextureLoader().load((ART.base || "") + "/art/anim/" + ak + ".png", (tex) => { tex.colorSpace = THREE.SRGBColorSpace; });
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.userData.anim = A[ak];
      t.repeat.set(1 / A[ak].cols, 1 / A[ak].rows); this._sprites.set("a:" + ak, t); return t;
    }
    const url = artPath("sprites", key) || artPath("sprites", id); if (!url) return null;
    id = artPath("sprites", key) ? key : id;
    if (this._sprites.has(id)) return this._sprites.get(id);
    const t = new THREE.TextureLoader().load(url, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this._sprites.set(id, t);
    return t;
  }
  clearUnits() { for (const v of this.units.values()) v.dispose(); this.units.clear(); }
  fxEvent(kind, key, tgKey, data = {}) {
    const v = this.units.get(key), tg = tgKey !== undefined ? this.units.get(tgKey) : null;
    if (kind === "atk" && v && tg) { v.play("atk", tg.x - v.x, tg.z - v.z); this.moveFx(v, tg, false); }
    else if (kind === "cast" && v) { v.play("cast", tg ? tg.x - v.x : 0, tg ? tg.z - v.z : 0); if (tg) this.moveFx(v, tg, true); if (data.name) this.number(v.worldPos(3.0), data.name, "cast"); }
    else if (kind === "dmg" && tg) { tg.play("hit", v ? tg.x - v.x : 0, v ? tg.z - v.z : 0); tg.flash = Math.max(tg.flash || 0, data.crit ? 1 : 0.6); this.fx.burst(tg.worldPos(1.0), data.magic ? 0x9fd0ff : 0xffffff, data.crit ? 14 : 5, data.crit ? 3 : 1.6); this.number(tg.worldPos(2.3), String(data.v), data.crit ? "crit" : data.magic ? "magic" : "phys"); }
    else if (kind === "heal" && tg) { this.fx.burst(tg.worldPos(1.0), 0x7dffa8, 8, 1.2); this.number(tg.worldPos(2.3), "+" + data.v, "heal"); }
    else if (kind === "shield" && tg) { this.fx.ring(tg.worldPos(0.2), 0x9fd8ff, 1.6); }
    else if (kind === "die" && v) v.play("die");
    else if (kind === "status" && v) { const C = { burn: 0xff7a3a, poison: 0xb05cff, paralysis: 0xffe14a, freeze: 0x8fe8ff, sleep: 0x9aa4ff, confusion: 0xff8ad8, flinch: 0xffffff, slow: 0x8ab0ff }; if (data.on) { this.fx.burst(v.worldPos(1.2), C[data.name] ?? 0xffffff, 10, 1.4); this.number(v.worldPos(2.8), data.name.toUpperCase(), "cast"); } }
    else if (kind === "mega" && v) {
      const c = v.worldPos(1.4), n = 14;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, r = 3.2; this.fx.missile(i % 2 ? "ebMega001" : "ebMega003", new THREE.Vector3(c.x + Math.cos(a) * r, c.y + 0.2 + Math.sin(i) * 0.8, c.z + Math.sin(a) * r * 0.6), c, { size: 0.55, dur: 0.55, delay: i * 0.02, add: true, spin: 0 }); }
      this.fx.stamp("ebMega006", c, { size: 1, grow: 3, dur: 0.6, delay: 0.4, add: true }); this.fx.stamp("ebMegaImpact", c, { size: 7, dur: 0.45, delay: 0.5, add: true });
      this.fx.burst(c, 0xffffff, 30, 3.5); this.fx.ring(v.worldPos(0.1), 0xff9bf0, 3.4); this.shake(0.12); this.number(v.worldPos(3.2), "MEGA EVOLUTION!", "crit");
    }
    else if (kind === "gmax" && v) {
      const c = v.worldPos(1.6);
      if (data.on) {
        v.giantT = 1.5; this.fx.stamp("ebMegaImpact", c, { size: 9, dur: 0.6, add: true, tint: 0xff2a55 }); this.fx.stamp("ebMega006", c, { size: 1, grow: 6, dur: 0.8, add: true, tint: 0xff4d6d });
        for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; this.fx.missile("ebMega003", c, new THREE.Vector3(c.x + Math.cos(a) * 3.6, c.y + 1 + Math.sin(i * 2) * 1.2, c.z + Math.sin(a) * 2.4), { size: 0.6, dur: 0.5, add: true, tint: 0xff3b6b }); }
        this.fx.burst(c, 0xff2a55, 40, 4.5); this.fx.ring(v.worldPos(0.1), 0xff2a55, 4.5); this.shake(0.3); this.number(v.worldPos(4.6), "GIGANTAMAX!", "crit");
      } else { v.giantT = 1; this.fx.burst(c, 0xff7a9a, 22, 3); this.fx.ring(v.worldPos(0.1), 0xff7a9a, 2.5); }
    }
    else if (kind === "weather") this.setWeatherFx(data.name);
    else if (kind === "buff" && v) this.fx.burst(v.worldPos(1.0), data.name === "control" ? 0xff6bd6 : 0xffd66b, 16, 2);
  }
  setWeatherFx(name) {
    const T = { sun: "rgba(255,170,40,.16)", rain: "rgba(60,110,200,.20)", sandstorm: "rgba(190,150,70,.22)", snow: "rgba(210,235,255,.18)" };
    let el = document.getElementById("weatherTint");
    if (!el) { el = document.createElement("div"); el.id = "weatherTint"; el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4;transition:background .6s;font:700 14px system-ui;color:#fff;text-shadow:0 1px 3px #000;text-align:center;padding-top:64px"; document.body.appendChild(el); }
    const on = name && name !== "none"; el.style.background = on ? T[name] ?? "transparent" : "transparent"; el.textContent = on ? "Weather: " + name.toUpperCase() : "";
  }
  // Showdown-style move art by the attacker's type (art/fx): ranged units fire a missile, melee units stamp a slash/fist on the target
  moveFx(v, tg, big) {
    const T = { Fire: ["fireball", "flareball"], Electric: ["electroball", "lightning"], Water: ["waterwisp", "waterwisp"], Grass: ["leaf1", "petal"], Ice: ["iceball", "icicle"], Poison: ["poisonwisp", "poisonwisp"], Ghost: ["shadowball", "shadowball"], Dark: ["shadowball", "stare"], Psychic: ["mistball", "mistball"], Fairy: ["shine", "rainbow"], Dragon: ["bluefireball", "flareball"], Rock: ["rock1", "rock2"], Ground: ["mudwisp", "rock2"], Steel: ["greenmetal1", "sword"], Fighting: ["fist", "foot"], Flying: ["feather", "feather"], Bug: ["web", "leaf2"], Normal: ["impact", "impact"] };
    const ty = v.def?.types?.[0] ?? v.def?.faction ?? "Normal", pair = T[ty] ?? T.Normal, melee = (v.def?.range ?? 1) <= 1;
    const a = v.worldPos(1.5), b = tg.worldPos(1.3); this._alt = !this._alt;
    if (big) { // ability cast: bigger payload plus an impact stamp at the target
      if (melee) this.fx.stamp(pair[1], b, { size: 1.8, dur: 0.5, grow: 0.4, spin: 0 }); else this.fx.missile(pair[1], a, b, { size: 1.3, dur: 0.32, arc: 0.6, spin: 4 });
      this.fx.stamp(pair[0], b, { size: 1.5, dur: 0.45, grow: 0.5, delay: melee ? 0 : 0.3, add: ty !== "Normal" });
      return;
    }
    if (melee) { const m = { Fighting: "fist", Normal: this._alt ? "rightslash" : "leftslash", Bug: "sword", Steel: "sword", Flying: "feather", Dragon: "leftclaw", Dark: "leftclaw", Ground: "fist", Rock: "fist" }[ty]; this.fx.stamp(m ?? (this._alt ? "leftslash" : "rightslash"), b, { size: 1.5, dur: 0.28, grow: 0.3 }); }
    else this.fx.missile(pair[0], a, b, { size: 0.95, dur: 0.22, arc: 0.35, spin: pair[0] === "feather" ? 0 : 5 });
  }
  number(pos, text, cls) {
    if (!this.nums.length) return; const n = this.nums[this.numCursor++ % this.nums.length];
    n.el.textContent = text; n.el.className = "dmg " + cls; n.el.style.display = "block"; n.life = 0.9; n.pos.copy(pos); n.pos.x += (Math.random() - 0.5) * 0.6; n.vy = 1.4;
  }
  shake(amount = 0.15) { this.shakeT = amount; }
  // ---- camera / resize ----
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // keep the whole battlefield + bench framed on any aspect ratio
    const base = 29.5, need = 16 / 9; this.camera.fov = w / h >= need ? base : (Math.atan(Math.tan((base * Math.PI) / 360) * need / (w / h)) * 360) / Math.PI;
    this.camera.position.set(0.4, 13.4, 29.4); this.camera.lookAt(0.4, 0.2, 0.9); this.camera.setViewOffset(w, h, 0, h * 0.02, w, h); this.camera.updateProjectionMatrix(); this.basePos = this.camera.position.clone();
  }
  // ---- picking ----
  ndc(cx, cy) { const r = this.canvas.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
  groundPoint(cx, cy, y = 0) {
    this.ray.setFromCamera(this.ndc(cx, cy), this.camera); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(pl, out) ? out : null;
  }
  pickCell(cx, cy, flip) {
    const p = this.groundPoint(cx, cy, 0.02); if (!p) return null; let best = null, bd = R * 0.98;
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const c = this.worldOf({ col, row }, flip), d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = { col, row }; }
    }
    return best;
  }
  // commander-skill markers: [{key, cell:{col,row}|{bench:i}, color}] rings drawn under heroes / on the trap cell
  setMarks(list) {
    this.marks ||= new Map(); const want = new Set(list.map((m) => m.key));
    for (const [k, m] of this.marks) if (!want.has(k)) { this.scene.remove(m); this.marks.delete(k); }
    for (const it of list) {
      let m = this.marks.get(it.key);
      if (!m) { m = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.9, depthWrite: false })); m.rotation.x = Math.PI / 2; this.scene.add(m); this.marks.set(it.key, m); }
      m.material.color.set(it.color); const w = this.worldOf(it.cell, false); m.position.set(w.x, w.y + 0.08, w.z); m.userData.pulse = it.key.startsWith("trap");
    }
  }
  pickBench(cx, cy) {
    const p = this.groundPoint(cx, cy, BENCH_TOP); if (!p) return null;
    for (let i = 0; i < BENCH; i++) { const b = benchXZ(i); if (Math.abs(p.x - b.x) < 0.8 && Math.abs(p.z - b.z) < 0.78) return i; }
    return null;
  }
  pickUnit(cx, cy, maxPx = 46) {
    const r = this.canvas.getBoundingClientRect(); let best = null, bd = maxPx * (r.width / 1280);
    const v3 = new THREE.Vector3();
    for (const v of this.units.values()) {
      if (!v.root.visible || v.dead) continue;
      v3.set(v.x, v.y + 0.9 * v.baseScale, v.z).project(this.camera);
      const sx = r.left + (v3.x * 0.5 + 0.5) * r.width, sy = r.top + (-v3.y * 0.5 + 0.5) * r.height, d = Math.hypot(sx - cx, sy - cy);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  cellScreen(cell, lift = 0.9) { const w = this.worldOf(cell, false); return this.screenOf(new THREE.Vector3(w.x, w.y + lift, w.z)); } // used by UI tests
  screenOf(v3) { const r = this.canvas.getBoundingClientRect(), p = v3.clone().project(this.camera); return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height }; }
  // ---- commander on the podium ----
  setCommander(id, def, fcolor) {
    if (this.commanderId === id) return; this.commanderId = id;
    if (this.commanderVisual) { this.commanderVisual.dispose(); this.commanderVisual = null; }
    const keep = this.me ? { x: this.me.x, z: this.me.z, yaw: this.me.yaw } : null;
    if (this.me) { this.me.dispose(); this.me = null; }
    loadTrainer(id).then((m) => { // the real 3D trainer walks the island; fall back to a flat sprite figure if the model can't load
      if (this.commanderId !== id) return;
      if (!m) { const v = new UnitVisual("commander", id, def, styleOf(id, def, fcolor), this.fx, this.spriteFor(id)); v.ui.visible = false; if (v.icons) v.icons.visible = false; v.shadow.visible = false; v.place(this.arena.podium.position.x, this.arena.podium.position.z, 0.95, true); this.scene.add(v.root); this.commanderVisual = v; return; }
      const pp = this.arena.podium.position; this.me = new Walker(this.scene, m); this.meV = { vy: 0, lift: 0, mv: false };
      const st = keep || { x: pp.x, z: pp.z, yaw: 1.25 }; this.me.place(st.x, this.groundY(st.x, st.z), st.z, st.yaw);
    });
  }
  // ---- walking trainers (local player + visitors) ----
  // opponent's podium (mirror of mine, far corner) shown while their commander is on display
  showOppPodium(on) {
    if (!this.oppPod) { this.oppPod = this.arena.podium.clone(true); const P = this.arena.podium.position; this.oppPod.position.set(-P.x, P.y, -P.z); this.oppPod.rotation.y = Math.PI; this.scene.add(this.oppPod); }
    this.oppPod.visible = !!on;
  }
  groundY(x, z) { const P = this.arena.podium.position, d = Math.hypot(x - P.x, z - P.z); const base = this.arena.terrainY ? this.arena.terrainY(x, z) : 0; if (d < 1.9) return 0.95; if (d < 2.8) return base + (0.95 - base) * (1 - (d - 1.9) / 0.9); return base; }
  clampWalk(x, z) { const cx = -0.2, cz = 0.6, rx = 11.4, rz = 9.4, nx = (x - cx) / rx, nz = (z - cz) / rz, r = Math.hypot(nx, nz); return r > 1 ? { x: cx + nx / r * rx, z: cz + nz / r * rz } : { x, z }; }
  setInput(ix, iz, jump) { this.input = { ix, iz, jump }; }
  localPose() { const w = this.me; return w ? { x: w.x, y: w.y, z: w.z, yaw: w.yaw, mv: !!this.meV.mv } : null; }
  teleportLocal(x, z, yaw) { if (this.me) { this.meV.vy = 0; this.meV.lift = 0; this.me.place(x, this.groundY(x, z), z, yaw ?? this.me.yaw); } }
  setRemote(list) { // [{key, cmd, x, z, y, yaw, mv}] trainers visible on the island being viewed
    this.remote ||= new Map(); const want = new Set(list.map((r) => r.key));
    for (const [k, w] of this.remote) if (!want.has(k)) { if (w.walker) w.walker.dispose(); this.remote.delete(k); }
    for (const r of list) {
      let w = this.remote.get(r.key); if (w && w.cmd !== r.cmd) { if (w.walker) w.walker.dispose(); this.remote.delete(r.key); w = null; }
      if (!w) { w = { cmd: r.cmd, walker: null, loading: true, tgt: r }; this.remote.set(r.key, w); loadTrainer(r.cmd).then((m) => { if (this.remote.get(r.key) !== w || !m) return; w.walker = new Walker(this.scene, m); w.loading = false; w.walker.place(w.tgt.x, w.tgt.y, w.tgt.z, w.tgt.yaw); }); }
      w.tgt = r;
    }
  }
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()); this.t += dt;
    this.arena.update(this.t, dt); this.fx.update(dt);
    for (const v of this.units.values()) v.update(dt, this.t);
    if (this.commanderVisual) this.commanderVisual.update(dt, this.t);
    if (this.me) { // local trainer: walk with the joystick/keys, jump with space
      const w = this.me, V = this.meV, inp = this.input || { ix: 0, iz: 0, jump: false }, len = Math.hypot(inp.ix, inp.iz), sp = 4.4;
      let moving = false;
      if (len > 0.08) { const k = Math.min(1, len) / len; const c = this.clampWalk(w.x + inp.ix * k * sp * dt, w.z + inp.iz * k * sp * dt); w.x = c.x; w.z = c.z; w.yaw = angLerp(w.yaw, Math.atan2(inp.ix, inp.iz), dt * 12); moving = true; }
      if (inp.jump && V.lift <= 0.001 && V.vy === 0) V.vy = 6.4;
      V.vy -= 18 * dt; V.lift += V.vy * dt; if (V.lift <= 0) { V.lift = 0; V.vy = 0; }
      V.mv = moving; w.y = this.groundY(w.x, w.z) + V.lift; w.group.position.set(w.x, w.y, w.z); w.group.rotation.y = w.yaw; w.pose(dt, moving && V.lift < 0.05);
    }
    if (this.remote) for (const r of this.remote.values()) { const w = r.walker; if (!w) continue; const t = r.tgt, k = Math.min(1, dt * 10); w.x += (t.x - w.x) * k; w.z += (t.z - w.z) * k; w.y += (t.y - w.y) * k; w.yaw = angLerp(w.yaw, t.yaw, dt * 12); w.group.position.set(w.x, w.y, w.z); w.group.rotation.y = w.yaw; w.pose(dt, !!t.mv); }
    // billboard-ish: sprites handle themselves; damage numbers follow world points
    for (const n of this.nums) if (n.life > 0) {
      n.life -= dt; n.pos.y += n.vy * dt; n.vy *= 0.96;
      if (n.life <= 0) { n.el.style.display = "none"; continue; }
      const s = this.screenOf(n.pos), r = this.canvas.getBoundingClientRect();
      n.el.style.transform = `translate(${s.x - r.left}px,${s.y - r.top}px) translate(-50%,-50%)`; n.el.style.opacity = Math.min(1, n.life * 2.2);
    }
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeT; this.camera.position.set(this.basePos.x + (Math.random() - 0.5) * a, this.basePos.y + (Math.random() - 0.5) * a, this.basePos.z); } else if (this.basePos) this.camera.position.copy(this.basePos);
    this.camera.lookAt(0.2, 0, 1.0);
    this.renderer.render(this.scene, this.camera);
    return dt;
  }
}
