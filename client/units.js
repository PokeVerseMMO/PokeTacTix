const _uiTex = {};
export const uiTex = (name) => _uiTex[name] || (_uiTex[name] = Object.assign(new THREE.TextureLoader().load(`art/ui/${name}.png`), { colorSpace: THREE.SRGBColorSpace }));
// Chibi anime-style 3D characters (procedural), health/mana bars, stars, icons, and pooled effects.
import * as THREE from "./vendor/three.module.min.js";
import { iconSvg, rng, hash, shade, artPath } from "./art.js";

const texCache = new Map();
const mk = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
export function faceTexture(eye, ahoge) {
  const key = "face" + eye; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = 256; c.height = 160; const g = c.getContext("2d");
  for (const sx of [-1, 1]) {
    const ex = 128 + sx * 52, ey = 74, ew = 30, eh = 44;
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, ey, ew, eh, 0, 0, 7); g.fill();
    const ig = g.createLinearGradient(0, ey - eh, 0, ey + eh); ig.addColorStop(0, shade(eye, -0.5)); ig.addColorStop(0.5, eye); ig.addColorStop(1, shade(eye, 0.5));
    g.fillStyle = ig; g.beginPath(); g.ellipse(ex, ey + 3, ew * 0.82, eh * 0.95, 0, 0, 7); g.fill();
    g.fillStyle = "#1a1230"; g.beginPath(); g.ellipse(ex, ey + 5, ew * 0.38, eh * 0.52, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex - 8, ey - 14, 8, 11, 0, 0, 7); g.fill(); g.beginPath(); g.arc(ex + 9, ey + 17, 4.5, 0, 7); g.fill();
    g.strokeStyle = "#2a1830"; g.lineWidth = 6; g.beginPath(); g.ellipse(ex, ey, ew * 1.05, eh * 1.04, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  }
  g.fillStyle = "rgba(255,110,140,.35)"; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(128 + sx * 88, 124, 18, 9, 0, 0, 7); g.fill(); }
  g.strokeStyle = "#a0525a"; g.lineWidth = 4; g.beginPath(); g.arc(128, 128, 9, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  const t = mk(c); texCache.set(key, t); void ahoge; return t;
}
function shadowTexture() {
  if (texCache.has("shadow")) return texCache.get("shadow");
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(10,20,10,.65)"); gr.addColorStop(0.6, "rgba(10,20,10,.3)"); gr.addColorStop(1, "rgba(10,20,10,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); texCache.set("shadow", t); return t;
}
function starTexture() {
  if (texCache.has("star")) return texCache.get("star");
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 11 : 28; g.lineTo(32 + Math.cos(a) * rr, 34 + Math.sin(a) * rr); } g.closePath();
  const gr = g.createLinearGradient(0, 6, 0, 60); gr.addColorStop(0, "#fff3a0"); gr.addColorStop(1, "#ffb21e"); g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = "#8a5a10"; g.stroke();
  const t = mk(c); texCache.set("star", t); return t;
}
export function iconTexture(name, color) {
  const tp = artPath("types", name), key = "ico" + name + (tp ? "" : color); if (texCache.has(key)) return texCache.get(key);
  if (tp) { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); const img = new Image(); img.onload = () => { g.drawImage(img, 1, 1, 62, 62); t.needsUpdate = true; }; img.src = tp; return t; }
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t);
  g.fillStyle = "#14102a"; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = color; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.stroke();
  const img = new Image(); img.onload = () => { g.drawImage(img, 14, 14, 36, 36); t.needsUpdate = true; };
  img.src = "data:image/svg+xml;utf8," + encodeURIComponent(iconSvg(name, 36).replace("currentColor", color).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '));
  return t;
}
const matCache = new Map();
const std = (color, o = {}) => { const k = color + JSON.stringify(o); if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o })); return matCache.get(k); };
const geo = {
  sphere: new THREE.SphereGeometry(1, 20, 14), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 10), box: new THREE.BoxGeometry(1, 1, 1), capsule: new THREE.CapsuleGeometry(1, 1, 4, 8),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 18, Math.PI * 1.25),
  face: new THREE.SphereGeometry(0.43, 18, 12, Math.PI / 2 - 0.78, 1.56, 1.0, 0.95),
};
const add = (parent, g, mat, p = [0, 0, 0], s = [1, 1, 1], rot) => { const m = new THREE.Mesh(g, mat); m.position.set(...p); m.scale.set(...s); if (rot) m.rotation.set(...rot); parent.add(m); return m; };

export class UnitVisual {
  constructor(key, id, def, style, fx, sprite) {
    this.key = key; this.sprite = sprite || null; this.id = id; this.def = def; this.style = style; this.fx = fx;
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.phase = (hash(id + key) % 628) / 100; this.tx = this.x = 0; this.tz = this.z = 0; this.ty = this.y = 0; this.yaw = 0; this.tilt = 0;
    this.anim = { kind: null, t: 0 }; this.pop = 0; this.dead = false; this.deathT = 0; this.flash = 0; this.hp = 1; this.mana = 0; this.stars = 0; this.items = [];
    this.baseScale = style.boss ? 2.1 : style.npc ? 1.45 : 1.3; this.hits = []; this.selected = false;
    this.mats = [];
    if (this.sprite) this.buildSprite(); else if (style.npc) this.buildMonster(); else this.buildChibi();
    // contact shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.03; this.shadow.scale.setScalar(this.baseScale); this.root.add(this.shadow);
    // selection ring
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: uiTex("effects/selection"), transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05; this.root.add(this.ring);
    // bars / stars / icons (sprites, drawn on top)
    const top = this.sprite ? this.spriteH + 0.15 : (style.npc ? 2.1 : 2.15) * this.baseScale * (style.boss ? 0.9 : 1);
    this.ui = new THREE.Group(); this.ui.position.y = top; this.root.add(this.ui);
    const spr = (color, w, h, y, z = 0) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, transparent: true })); s.scale.set(w, h, 1); s.position.set(0, y, z); s.renderOrder = 20; this.ui.add(s); return s; };
    this.barBg = spr(0x0b0820, 1.18, 0.2, 0); this.hpBar = spr(0x58e070, 1.08, 0.12, 0, 0.001); this.hpBar.renderOrder = 21; this.hpBar.center.set(0, 0.5); this.hpBar.position.x = -0.54;
    this.manaBg = spr(0x0b0820, 1.18, 0.12, -0.17); this.manaBar = spr(0x4aa8ff, 1.08, 0.065, -0.17, 0.001); this.manaBar.renderOrder = 21; this.manaBar.center.set(0, 0.5); this.manaBar.position.x = -0.54;
    this.starGroup = new THREE.Group(); this.starGroup.position.y = 0.3; this.ui.add(this.starGroup);
    this.pips = new THREE.Group(); this.pips.position.set(-0.7, 0, 0); this.ui.add(this.pips);
    if (!style.npc) {
      this.icons = new THREE.Group(); this.icons.position.set(0, 0.12, 0.62); this.root.add(this.icons);
      for (const [i, nm] of [[-1, def?.role], [1, def?.faction]]) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(nm, i < 0 ? "#ffd66b" : "#9fe0ff"), transparent: true, depthTest: false })); s.scale.set(0.42, 0.42, 1); s.position.set(i * 0.3, 0, 0); s.renderOrder = 19; this.icons.add(s);
      }
    }
    this.root.scale.setScalar(1);
    this.setStars(1);
  }

  buildSprite() {
    // painted cut-out: a camera-facing sprite anchored at the character's feet
    const t0 = this.sprite, am = t0.userData?.anim, t = am ? this.ownTex(t0) : t0, aspect = am ? am.cw / am.ch : (t.image?.width || 1) / (t.image?.height || 1);
    this.spriteH = this.style.boss ? 5.2 : this.style.npc ? 3.8 : 3.3; this.baseScale = 1;
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, alphaTest: 0.04, depthWrite: false });
    this.spr = new THREE.Sprite(m); this.spr.center.set(0.5, 0.04); this.spr.scale.set(this.spriteH * aspect, this.spriteH, 1); this.spr.renderOrder = 5; this.body.add(this.spr);
    this.sprMat = m; this.srcTex = t0; this.texCache = new Map([[t0, t]]);
  }
  // animated sheets are cloned per unit (shared GPU image) so every Pokémon plays its own frame offset
  ownTex(src) { const t = src.clone(); t.userData = { anim: src.userData.anim }; t.colorSpace = src.colorSpace; t.needsUpdate = true; return t; }
  setSprite(src) {
    if (!this.sprMat || src === this.srcTex) return; this.srcTex = src;
    let t = this.texCache.get(src); if (!t) { t = src.userData?.anim ? this.ownTex(src) : src; this.texCache.set(src, t); }
    this.sprMat.map = t; this.sprMat.needsUpdate = true;
  }
  startEvolve(want) {
    this.evo = { t: 0, swapped: false, want }; const c = this.worldPos(1.4);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; this.fx.missile(i % 2 ? "ebMega001" : "ebMega003", new THREE.Vector3(c.x + Math.cos(a) * 2.6, c.y + 0.8 + Math.sin(i * 2) * 0.6, c.z + Math.sin(a) * 1.8), c, { size: 0.5, dur: 0.9, delay: i * 0.05, add: true, tint: 0x9fe0ff }); }
    this.fx.stamp("ebMega006", c, { size: 0.8, grow: 3, dur: 1.0, add: true, tint: 0x9fe0ff }); this.onEvolve?.(this);
  }
  tickSprite(time) {
    const t = this.sprMat?.map, a = t?.userData?.anim; if (!a) return;
    const f = Math.floor((time + this.phase * 0.7) * a.fps) % a.n, r = Math.floor(f / a.cols), c = f % a.cols;
    t.offset.set(c / a.cols, 1 - (r + 1) / a.rows);
  }
  buildChibi() {
    const st = this.style, B = this.body, skin = std(st.skin, { roughness: 0.6 }), hair = std(st.hair, { roughness: 0.55 }), outfit = std(st.outfit), trim = std(st.trim, { metalness: 0.3, roughness: 0.4 });
    this.mats = [hair, outfit];
    // legs
    this.legL = add(B, geo.capsule, std("#2a2540"), [-0.14, 0.28, 0], [0.085, 0.2, 0.085]); this.legR = add(B, geo.capsule, std("#2a2540"), [0.14, 0.28, 0], [0.085, 0.2, 0.085]);
    add(B, geo.sphere, trim, [-0.14, 0.07, 0.04], [0.12, 0.07, 0.17]); add(B, geo.sphere, trim, [0.14, 0.07, 0.04], [0.12, 0.07, 0.17]);
    // torso + skirt/coat
    const longCoat = ["Fighter", "Guardian", "Assassin"].includes(st.role);
    this.torso = add(B, geo.cyl, outfit, [0, 0.74, 0], [0.24, 0.3, 0.2]); this.torso.scale.set(0.24, 0.3, 0.2);
    add(B, geo.cone, outfit, [0, 0.47, 0], [longCoat ? 0.34 : 0.4, 0.34, longCoat ? 0.3 : 0.38], [Math.PI, 0, 0]);
    add(B, geo.cyl, trim, [0, 0.6, 0], [0.265, 0.05, 0.215]);               // belt
    add(B, geo.box, trim, [0, 0.82, 0.19], [0.16, 0.2, 0.03]);              // chest plate / ribbon
    if (st.cape) { const cape = add(B, geo.box, std(shade(st.trim, -0.3), { side: THREE.DoubleSide }), [0, 0.7, -0.24], [0.5, 0.62, 0.03], [0.12, 0, 0]); cape.userData.cape = true; this.cape = cape; }
    // arms
    this.armL = new THREE.Group(); this.armL.position.set(-0.3, 0.9, 0); this.armR = new THREE.Group(); this.armR.position.set(0.3, 0.9, 0); B.add(this.armL, this.armR);
    for (const a of [this.armL, this.armR]) { add(a, geo.capsule, outfit, [0, -0.16, 0], [0.075, 0.12, 0.075]); add(a, geo.sphere, skin, [0, -0.36, 0], [0.085, 0.085, 0.085]); }
    // head
    this.head = new THREE.Group(); this.head.position.y = 1.32; B.add(this.head);
    add(this.head, geo.sphere, skin, [0, 0, 0], [0.43, 0.41, 0.41]);
    const face = new THREE.Mesh(geo.face, new THREE.MeshBasicMaterial({ map: faceTexture(st.eye), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); face.scale.set(1, 1, 1); face.position.set(0, -0.03, 0.01); this.head.add(face);
    // hair: cap + back mass + bangs
    const cap = add(this.head, new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, [0, 0.03, -0.01], [0.475, 0.47, 0.465], [-0.18, 0, 0]);
    const back = add(this.head, geo.sphere, hair, [0, -0.05, -0.12], [0.45, st.hairStyle % 2 ? 0.62 : 0.46, 0.34]);
    for (let i = -2; i <= 2; i++) add(this.head, geo.cone, hair, [i * 0.145, 0.26 - Math.abs(i) * 0.02, 0.35], [0.1, 0.26, 0.08], [Math.PI * 0.97, 0, i * 0.18]);
    for (const sx of [-1, 1]) { add(this.head, geo.cone, hair, [sx * 0.4, -0.12, 0.1], [0.09, 0.36, 0.09], [Math.PI, 0, sx * 0.1]); if (st.hairStyle >= 2) add(this.head, geo.capsule, hair, [sx * 0.5, -0.38, -0.05], [0.1, 0.3, 0.1], [0, 0, sx * 0.12]); }
    if (st.ahoge) add(this.head, geo.cone, hair, [0.02, 0.56, 0.05], [0.05, 0.3, 0.05], [0.4, 0, 0.5]);
    add(this.head, geo.sphere, trim, [0.33, 0.28, 0.1], [0.09, 0.09, 0.05]);
    void cap; void back;
    // weapon / gear by role
    const gold = std("#e6c25a", { metalness: 0.6, roughness: 0.3 }), steel = std("#d6e2f0", { metalness: 0.7, roughness: 0.25 }), glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(st.trim).lerp(new THREE.Color("#ffffff"), 0.35) });
    this.weapon = new THREE.Group(); this.weapon.position.set(0, -0.36, 0.06); this.armR.add(this.weapon);
    const W = this.weapon;
    switch (st.role) {
      case "Fighter": add(W, geo.box, steel, [0, 0.42, 0], [0.07, 0.9, 0.02]); add(W, geo.box, gold, [0, -0.02, 0], [0.26, 0.05, 0.06]); W.rotation.x = -0.4; break;
      case "Guardian": add(W, geo.box, steel, [0, 0.3, 0], [0.06, 0.6, 0.02]); add(W, geo.box, gold, [0, -0.02, 0], [0.22, 0.05, 0.05]); W.rotation.x = -0.3;
        { const sh = add(this.armL, geo.cyl, trim, [-0.05, -0.34, 0.12], [0.3, 0.04, 0.3], [Math.PI / 2, 0, 0]); add(sh, geo.sphere, gold, [0, 0.6, 0], [0.3, 0.5, 0.3]); } break;
      case "Caster": case "Support": add(W, geo.cyl, std("#8a5a3a"), [0, 0.5, 0], [0.025, 1.1, 0.025]); add(W, geo.sphere, glow, [0, 1.12, 0], [0.13, 0.13, 0.13]); add(W, geo.torus, gold, [0, 1.12, 0], [0.2, 0.2, 0.2]); this.orb = W.children[1]; W.rotation.x = -0.1; break;
      case "Ranger": add(W, geo.torus, std("#8a5a3a"), [0, 0.3, 0], [0.55, 0.55, 0.55], [0, 0, Math.PI * 0.375]); add(W, geo.cyl, steel, [0, 0.3, 0], [0.006, 0.95, 0.006]); W.rotation.x = -0.2; break;
      case "Assassin": add(W, geo.box, steel, [0, 0.2, 0], [0.05, 0.42, 0.015]); add(W, geo.box, trim, [0, -0.02, 0], [0.12, 0.04, 0.04]); W.rotation.x = -0.9;
        { const d2 = add(this.armL, geo.box, steel, [0, -0.5, 0.1], [0.05, 0.4, 0.015], [-0.9, 0, 0]); void d2; } break;
    }
  }
  buildMonster() {
    const B = this.body, id = this.id, col = id === "frenzy_boar" ? "#8a4a30" : id === "lizardman_lord" ? "#4a8a50" : id === "kobold_sentinel" ? "#4a5a8a" : id === "illfang" ? "#a8362f" : id === "gleam_eyes" ? "#5a2a78" : "#d8d4c4";
    const m = std(col, { roughness: 0.8 }), dark = std(shade(col, -0.45)), bone = std("#e8dcb6"), eye = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    this.mats = [m];
    add(B, geo.sphere, m, [0, 0.8, 0], [0.62, 0.7, 0.55]);
    add(B, geo.sphere, m, [0, 1.5, 0.05], [0.5, 0.45, 0.46]);
    add(B, geo.sphere, eye, [-0.17, 1.55, 0.4], [0.09, 0.07, 0.05]); add(B, geo.sphere, eye, [0.17, 1.55, 0.4], [0.09, 0.07, 0.05]);
    add(B, geo.box, std("#2a0a0a"), [0, 1.34, 0.42], [0.3, 0.09, 0.05]);
    for (const sx of [-1, 1]) { add(B, geo.cone, bone, [sx * 0.34, 1.9, 0], [0.12, 0.5, 0.12], [0, 0, -sx * 0.5]); add(B, geo.sphere, dark, [sx * 0.62, 0.9, 0.05], [0.2, 0.55, 0.2]); add(B, geo.capsule, dark, [sx * 0.28, 0.22, 0], [0.18, 0.3, 0.18]); }
    if (id === "illfang" || id === "lizardman_lord") add(B, geo.box, std("#aab"), [0.75, 0.9, 0.2], [0.12, 1.3, 0.04], [0, 0, 0.3]);
    if (id === "skull_reaper") add(B, geo.torus, std("#cfd"), [0.7, 1.2, 0.0], [0.8, 0.8, 0.8], [0, 0, 1.5]);
    this.armR = new THREE.Group(); this.armL = new THREE.Group(); this.head = new THREE.Group(); B.add(this.head);
  }

  setStars(n, animate = true) {
    if (n === this.stars) return; const up = this.stars && n > this.stars; this.stars = n;
    for (const c of [...this.starGroup.children]) this.starGroup.remove(c);
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), depthTest: false, transparent: true })); s.scale.set(0.3, 0.3, 1); s.position.set((i - (n - 1) / 2) * 0.28, 0, 0); s.renderOrder = 21; this.starGroup.add(s); }
    if (up && animate) { this.fx.burst(this.worldPos(1.2), 0xffe066, 26, 2.4); this.fx.ring(this.worldPos(0.1), 0xffe066, 2.4); this.pop = 0.0001; this.flash = 0.6; }
  }
  setItems(list) {
    const key = list.join(","); if (key === this._itemKey) return; this._itemKey = key;
    for (const c of [...this.pips.children]) this.pips.remove(c);
    list.forEach((it, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: it.color, depthTest: false })); s.scale.set(0.16, 0.16, 1); s.position.set(i * 0.19, -0.3, 0); s.renderOrder = 22; this.pips.add(s); });
  }
  worldPos(h = 0) { return new THREE.Vector3(this.x, this.y + h, this.z); }
  place(x, z, y, instant) { this.tx = x; this.tz = z; this.ty = y; if (instant || this.pop === 0 && this.x === 0 && this.z === 0 && this.root.parent && !this._placed) { this.x = x; this.z = z; this.y = y; } this._placed = true; }
  setBars(hp, mana, showMana) { this.hp = hp; this.mana = mana; this.manaBar.visible = this.manaBg.visible = showMana; }
  play(kind, dx = 0, dz = 0) {
    if (kind === "die") { this.dead = true; this.deathT = 0; this.fx.burst(this.worldPos(0.9), 0xffffff, 14, 2); return; }
    if (kind === "hit") { this.flash = 1; if (!this.anim.kind) this.anim = { kind: "hit", t: 0, dx, dz }; return; }
    this.anim = { kind, t: 0, dx, dz };
    if (kind === "cast") { this.fx.ring(this.worldPos(0.1), this.style.npc ? 0xff5a4a : new THREE.Color(this.style.trim).getHex(), 2.2); this.fx.burst(this.worldPos(1.3), new THREE.Color(this.style.trim).getHex(), 18, 2); }
  }
  update(dt, t, camQuat) {
    this.tickSprite(t);
    const k = Math.min(1, dt * 11), px = this.x, pz = this.z;
    this.x += (this.tx - this.x) * k; this.z += (this.tz - this.z) * k; this.y += (this.ty - this.y) * Math.min(1, dt * 14);
    const speed = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-4), moving = speed > 0.8;
    const ph = t * (moving ? 14 : 3) + this.phase;
    let sq = 1, shake = 0; let by = Math.abs(Math.sin(ph)) * (moving ? 0.12 : 0.025) , lunge = 0, armSwing = 0, sc = 1;
    if (this.anim.kind) {
      this.anim.t += dt; const a = this.anim, d = a.kind === "atk" ? 0.34 : a.kind === "hit" ? 0.22 : 0.7, p = Math.min(1, a.t / d);
      if (a.kind === "atk") { const f = Math.sin(Math.min(1, p * 1.4) * Math.PI); lunge = f * 0.42; armSwing = -f * 2.0; sq = p < 0.3 ? 1 - 0.14 * Math.sin(p / 0.3 * Math.PI / 2) : 1 + 0.16 * Math.sin((p - 0.3) / 0.7 * Math.PI); }
      else if (a.kind === "hit") { lunge = -Math.sin(Math.min(1, p * 1.3) * Math.PI) * 0.26; sq = 1 - Math.sin(p * Math.PI) * 0.1; shake = Math.sin(p * 40) * (1 - p) * 0.05; }
      else if (a.kind === "cast") { sc = 1 + Math.sin(p * Math.PI) * 0.12; by += Math.sin(p * Math.PI) * 0.35; armSwing = -2.4 * Math.sin(Math.min(1, p * 1.6) * Math.PI); }
      if (p >= 1) this.anim.kind = null;
    }
    const a = this.anim; const len = a.kind ? Math.hypot(a.dx, a.dz) || 1 : 1;
    const dirOn = a.kind === "atk" || a.kind === "hit", ox = dirOn ? (a.dx / len) * lunge + shake : 0, oz = dirOn ? (a.dz / len) * lunge : 0;
    if (this.pop > 0 || this.pop === 0.0001) { this.pop = (this.pop || 0.0001) + dt; const p = Math.min(1, this.pop / 0.38); sc *= p >= 1 ? 1 : 1 + Math.sin(p * Math.PI) * 0.25 - (1 - p) * (1 - p) * 0.6; if (p >= 1) this.pop = 0; }
    if (this.dead) { this.deathT += dt; const p = Math.min(1, this.deathT / 0.55); this.body.rotation.x = -p * 1.4; sc *= 1 - p * 0.85; by -= p * 0.3; this.ui.visible = false; if (this.icons) this.icons.visible = false; this.shadow.material.opacity = 1 - p; if (p >= 1) this.root.visible = false; }
    else this.body.rotation.x = moving ? 0.1 : 0;
    // face the enemy a little, mostly the camera
    const want = moving ? Math.max(-0.7, Math.min(0.7, (this.tx - px) * 0.9)) : (a.kind === "atk" ? Math.max(-0.7, Math.min(0.7, a.dx * 0.5)) : 0);
    const goal = this.away ? Math.PI - want : want; this.yaw += (goal - this.yaw) * Math.min(1, dt * 8); this.body.rotation.y = this.yaw;
    if (this.spr && !this._aspectOk && !this.sprite.userData?.anim && this.sprite.image && this.sprite.image.width) { this._aspectOk = true; this.spr.scale.set(this.spriteH * this.sprite.image.width / this.sprite.image.height, this.spriteH, 1); }
    if (this.spr) { const dir = Math.abs(this.tx - px) > 0.003 ? Math.sign(this.tx - px) : (a.kind === "atk" ? Math.sign(a.dx) : 0); if (dir) this.flipTo = dir; this.spr.scale.x = Math.abs(this.spr.scale.x) * (this.flipTo || 1) * (this.spriteFlip || 1); }
    this.body.position.y = by; this.giant = (this.giant ?? 1) + ((this.giantT ?? 1) - (this.giant ?? 1)) * Math.min(1, dt * 5); { const k = this.baseScale * sc * this.giant; this.body.scale.set(k / Math.sqrt(sq), k * sq, k); }
    this.root.position.set(this.x + ox, this.y, this.z + oz);
    if (this.armR) this.armR.rotation.x = armSwing + (moving ? Math.sin(ph) * 0.5 : Math.sin(ph) * 0.04);
    if (this.armL) this.armL.rotation.x = moving ? -Math.sin(ph) * 0.5 : -Math.sin(ph) * 0.04;
    if (this.legL) { this.legL.rotation.x = moving ? Math.sin(ph) * 0.6 : 0; this.legR.rotation.x = moving ? -Math.sin(ph) * 0.6 : 0; }
    if (this.cape) this.cape.rotation.x = 0.12 + (moving ? 0.35 : Math.sin(t * 2 + this.phase) * 0.04);
    if (this.head) { this.head.rotation.z = Math.sin(t * 1.4 + this.phase) * 0.03; }
    if (this.orb) this.orb.scale.setScalar(0.13 * (1 + Math.sin(t * 4 + this.phase) * 0.12) * 1);
    // hit flash
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); for (const m of this.mats) m.emissive.setScalar(this.flash * 0.6); if (this.sprMat) this.sprMat.color.setScalar(1 + this.flash * 1.2); }
    else if (this._hadFlash) { for (const m of this.mats) m.emissive.setScalar(0); if (this.sprMat) this.sprMat.color.setScalar(1); }
    this._hadFlash = this.flash > 0;
    if (this.evo && this.sprMat) { // evolution: sprite whites out, swaps to the new form at the peak, then settles
      const e = this.evo; e.t += dt; const T = e.t, b = T < 1.1 ? 1 + 7 * (T / 1.1) ** 2 : Math.max(1, 8 - (T - 1.1) * 14);
      if (!e.swapped && T >= 1.1) { e.swapped = true; if (e.want) this.setSprite(e.want); const c = this.worldPos(1.4); this.fx.burst(c, 0xffffff, 34, 3.5); this.fx.ring(this.worldPos(0.1), 0x9fe0ff, 3.2); this.fx.stamp("ebMegaImpact", c, { size: 6, dur: 0.4, add: true, tint: 0xbfeaff }); this.pop = 0.0001; }
      this.sprMat.color.setScalar(b); if (T > 1.7) { this.evo = null; this.sprMat.color.setScalar(1); }
    }
    // ui
    this.hpBar.scale.x = Math.max(0.001, 1.08 * this.hp); this.hpBar.material.color.set(this.hp > 0.5 ? 0x58e070 : this.hp > 0.25 ? 0xe8c84a : 0xff5a4a);
    this.manaBar.scale.x = Math.max(0.001, 1.08 * this.mana);
    this.ring.material.opacity += ((this.selected ? 0.95 : 0) - this.ring.material.opacity) * Math.min(1, dt * 12);
    if (this.selected) this.ring.scale.setScalar(1 + Math.sin(performance.now() / 260) * 0.05);
    void camQuat;
  }
  dispose() { this.root.parent && this.root.parent.remove(this.root); }
}

// Pooled sparkles/rings so effects never allocate during combat.
export class Effects {
  constructor(scene) {
    this.scene = scene; this.parts = []; this.rings = []; this.max = 220;
    const tex = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c; })());
    for (let i = 0; i < this.max; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.visible = false; s.userData = { life: 0, max: 1, v: new THREE.Vector3() }; scene.add(s); this.parts.push(s); }
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData = { life: 0, max: 0.5, size: 2 }; scene.add(m); this.rings.push(m); }
    this.cursor = 0; this.ringCursor = 0;
  }
  burst(pos, color, n = 12, speed = 2) {
    for (let i = 0; i < n; i++) {
      const s = this.parts[this.cursor++ % this.max], u = s.userData; s.visible = true; s.position.copy(pos); s.material.color.set(color);
      const a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.2; u.v.set(Math.cos(a) * speed * (0.4 + Math.random()), e * speed + 0.8, Math.sin(a) * speed * (0.4 + Math.random())); u.life = u.max = 0.45 + Math.random() * 0.35; s.scale.setScalar(0.14 + Math.random() * 0.14);
    }
  }
  // Pokémon Showdown 2D move sprites (art/fx): travelling missiles and fading stamps
  fxTex(name) {
    this._ft ??= new Map(); if (this._ft.has(name)) return this._ft.get(name);
    const t = new THREE.TextureLoader().load("art/fx/" + name + ".png", (x) => { x.colorSpace = THREE.SRGBColorSpace; this._fa.set(name, x.image.width / x.image.height); }); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    this._ft.set(name, t); (this._fa ??= new Map()).set(name, 1); return t;
  }
  fxSprite(name, pos, o = {}) {
    this._pool ??= []; this._pc ??= 0;
    let s = this._pool[this._pc++ % 40]; if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); s.renderOrder = 30; this.scene.add(s); this._pool[(this._pc - 1) % 40] = s; }
    s.material.map = this.fxTex(name); s.material.needsUpdate = true; s.material.opacity = 1; s.material.rotation = o.rot ?? 0; s.material.color.set(o.tint ?? 0xffffff); s.visible = true; s.position.copy(pos);
    s.userData = { name, from: pos.clone(), to: o.to ? o.to.clone() : null, t: -(o.delay ?? 0), dur: o.dur ?? 0.4, size: o.size ?? 1, grow: o.grow ?? 0, spin: o.spin ?? 0, arc: o.arc ?? 0, fade: o.fade ?? true, add: !!o.add };
    s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending; s.scale.set(0.0001, 0.0001, 1);
  }
  missile(name, from, to, o = {}) { this.fxSprite(name, from, { ...o, to }); }
  stamp(name, pos, o = {}) { this.fxSprite(name, pos, o); }
  tickSprites(dt) {
    for (const s of this._pool ?? []) if (s?.visible) {
      const u = s.userData; u.t += dt; if (u.t < 0) { s.scale.set(0.0001, 0.0001, 1); continue; } const p = Math.min(1, u.t / u.dur);
      if (u.to) { s.position.lerpVectors(u.from, u.to, p); s.position.y += Math.sin(p * Math.PI) * u.arc; }
      const a = this._fa?.get(u.name) ?? 1, k = u.size * (1 + u.grow * p) * (u.to ? 1 : (p < 0.2 ? p / 0.2 : 1));
      s.scale.set(k * Math.min(a, 1.6), k / Math.max(a, 0.6), 1); s.material.rotation += u.spin * dt;
      s.material.opacity = u.fade && (!u.to ? p > 0.5 : p > 0.85) ? Math.max(0, 1 - (p - (u.to ? 0.85 : 0.5)) / (u.to ? 0.15 : 0.5)) : 1;
      if (p >= 1) s.visible = false;
    }
  }
  ring(pos, color, size = 2) { const m = this.rings[this.ringCursor++ % this.rings.length]; m.visible = true; m.position.set(pos.x, 0.08 + pos.y * 0, pos.z); m.material.color.set(color); m.userData.life = m.userData.max = 0.5; m.userData.size = size; }
  update(dt) {
    this.tickSprites(dt);
    for (const s of this.parts) if (s.visible) { const u = s.userData; u.life -= dt; if (u.life <= 0) { s.visible = false; continue; } s.position.addScaledVector(u.v, dt); u.v.y -= dt * 3; s.material.opacity = u.life / u.max; }
    for (const m of this.rings) if (m.visible) { const u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; continue; } const p = 1 - u.life / u.max; m.scale.setScalar(0.3 + p * u.size); m.material.opacity = (1 - p) * 0.9; }
  }
}
