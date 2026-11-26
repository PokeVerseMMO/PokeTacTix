// Procedural 3D scenery kit for the floating-island arena. Everything here is geometry (displaced / carved / lathed meshes with
// vertex colours and small painted canvas textures) - nothing is painted onto the ground. No gameplay logic lives here.
// NOTE: these are original procedural stand-ins; they are not sculpted/hand-textured DCC assets (see the report for the exact
// glTF models that would raise the quality further).
import * as THREE from "./vendor/three.module.min.js";
import { rng } from "./art.js";

export const WIND = { value: 0 }; // shared time uniform for every swaying material

// ---------- small utilities ----------
export function noise2(seed = 1) {
  const r = rng(seed), n = 64, g = Array.from({ length: n * n }, () => r());
  const at = (x, y) => g[((y % n) + n) % n * n + ((x % n) + n) % n];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}
// 3D value noise built from two 2D lookups (cheap, continuous across a mesh)
export function noise3(seed = 1) {
  const a = noise2(seed), b = noise2(seed + 17);
  return (x, y, z) => (a(x + z * 0.7, y + z * 0.3) + b(y - z * 0.5 + 9, x + z * 0.9 + 4)) * 0.5;
}
export const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
export const canvasTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// merge BufferGeometries (attributes position/normal/uv/color) into one non-indexed geometry
export function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const attrs = ["position", "normal", "uv", "color"], out = new THREE.BufferGeometry();
  for (const a of attrs) {
    const has = parts.every((p) => p.attributes[a]); if (!has && a !== "color" && a !== "uv") continue; if (!has) continue;
    const size = parts[0].attributes[a].itemSize, total = parts.reduce((s, p) => s + p.attributes[a].count, 0), arr = new Float32Array(total * size); let o = 0;
    for (const p of parts) { arr.set(p.attributes[a].array, o); o += p.attributes[a].array.length; }
    out.setAttribute(a, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
export function paint(geo, fn) { // fn(x,y,z,nx,ny,nz) -> THREE.Color
  const p = geo.attributes.position, nrm = geo.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); return geo;
}

// ---------- wind (vertex sway injected into standard materials) ----------
export function windify(mat, { amp = 1, height = 1 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uSwayH = { value: height };
    sh.vertexShader = "uniform float uWind;uniform float uAmp;uniform float uSwayH;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
vec3 ip = vec3(0.0);
#endif
float sh_ = (uSwayH < 0.0 ? max(0.0, 0.9 - position.y) : max(0.0, position.y)) * abs(uSwayH);
transformed.x += sin(uWind * 1.6 + ip.x * 0.55 + ip.z * 0.35 + position.y * 1.7) * 0.11 * sh_ * uAmp;
transformed.z += cos(uWind * 1.25 + ip.z * 0.5 + ip.x * 0.28 + position.y * 1.3) * 0.075 * sh_ * uAmp;`);
  };
  mat.customProgramCacheKey = () => "wind" + amp + "_" + height;
  return mat;
}

// ---------- rocks: chiselled icospheres (planar cuts + noise), moss on up-facing facets ----------
let rockMapCache = null;
export function rockMap() {
  if (rockMapCache) return rockMapCache;
  const c = canvas(256, 256), g = c.getContext("2d"), n = noise2(5), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const o = (y * 256 + x) * 4, f = n(x / 20, y / 20) * 0.55 + n(x / 6, y / 6) * 0.3 + n(x / 2.2, y / 2.2) * 0.15, st = Math.sin(y * 0.16 + n(x / 40, y / 40) * 7) * 0.06;
    const v = 200 + (f - 0.5) * 100 + st * 80, crack = Math.abs(n(x / 9 + 30, y / 9) - 0.5) < 0.018 ? -42 : 0;
    img.data[o] = v + crack + 4; img.data[o + 1] = v + crack; img.data[o + 2] = v + crack - 10; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (rockMapCache = t);
}
export function rockGeometry(seed, detail = 2, { moss = 0.7, rock = 0xb9b2a4, tall = 1 } = {}) {
  const r = rng(seed), n = noise3(seed), geo = new THREE.IcosahedronGeometry(1, detail).toNonIndexed(), p = geo.attributes.position;
  const planes = Array.from({ length: 5 }, () => { const v = new THREE.Vector3(r() - 0.5, (r() - 0.35) * 0.9, r() - 0.5).normalize(); return { v, d: 0.55 + r() * 0.3 }; });
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    for (const pl of planes) { const s = v.dot(pl.v); if (s > pl.d) v.addScaledVector(pl.v, pl.d - s); } // chisel flat faces
    const k = 1 + (n(v.x * 2.1, v.y * 2.1, v.z * 2.1) - 0.5) * 0.35; v.multiplyScalar(k);
    v.y *= 0.8 * tall; if (v.y < -0.35 * tall) v.y = -0.35 * tall; // flat sitting base
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const rc = new THREE.Color(rock), mc = new THREE.Color(0x77a052), mc2 = new THREE.Color(0x93b05c), tmp = new THREE.Color();
  paint(geo, (x, y, z, nx, ny) => {
    const m = clamp01((ny - 0.25) * 2.2 + (n(x * 3 + 4, y * 3, z * 3) - 0.5) * 0.9) * moss;
    tmp.copy(rc).multiplyScalar(0.8 + n(x * 4, y * 4, z * 4) * 0.4).lerp(mc.clone().lerp(mc2, n(x * 5, z * 5, y)), m); return tmp.clone();
  });
  return geo;
}

// ---------- beveled stone slab (bench / border stones) with weathered edges ----------
export function slabGeometry(w, d, h, seed, bevel = 0.07) {
  const r = rng(seed), s = new THREE.Shape(), hw = w / 2, hd = d / 2, c = 0.12 + r() * 0.08;
  s.moveTo(-hw + c, -hd); s.lineTo(hw - c, -hd); s.lineTo(hw, -hd + c * (0.6 + r())); s.lineTo(hw, hd - c); s.lineTo(hw - c * (0.5 + r()), hd); s.lineTo(-hw + c, hd); s.lineTo(-hw, hd - c * (0.5 + r())); s.lineTo(-hw, -hd + c); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, bevel, 0);
  const p = geo.attributes.position, n = noise3(seed), uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { // chip & roughen
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), top = y > h - bevel * 1.5 ? 1 : 0;
    p.setY(i, y + (n(x * 3, 0, z * 3) - 0.5) * 0.05 * (top ? 1 : 0.4));
    p.setX(i, x + (n(x * 5, y * 5, 2) - 0.5) * 0.03); p.setZ(i, z + (n(z * 5, y * 5, 7) - 0.5) * 0.03);
  }
  geo.computeVertexNormals();
  { const nr = geo.attributes.normal; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (nr.getY(i) > 0.6) uv.setXY(i, x / w + 0.5, z / d + 0.5); else uv.setXY(i, 0.02 + (x + z) * 0.12 + 0.06, 0.03 + y * 0.2); } } // carved diamond on the top face only; sides sample a plain weathered area
  paint(geo, (x, y, z, nx, ny) => { const v = 0.78 + n(x * 6, y * 6, z * 6) * 0.3 - (ny < 0.5 ? 0.12 : 0); return new THREE.Color(0.86 * v + 0.1, 0.82 * v + 0.1, 0.74 * v + 0.08); });
  return geo;
}
export function carvedStoneTexture(seed = 3) {
  const c = canvas(256, 256), g = c.getContext("2d"), n = noise2(seed), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const o = (y * 256 + x) * 4, f = n(x / 28, y / 28) * 0.55 + n(x / 7, y / 7) * 0.3 + n(x / 2.4, y / 2.4) * 0.15, v = 176 + (f - 0.5) * 70;
    const mossy = Math.max(0, n(x / 11 + 40, y / 11) - 0.62) * 3; img.data[o] = v - mossy * 60; img.data[o + 1] = v - mossy * 18; img.data[o + 2] = v - 14 - mossy * 60; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.translate(128, 128); g.lineJoin = "round";
  for (const [s, a, col] of [[62, 0.5, "#4a463e"], [44, 0.35, "#5a554a"], [26, 0.45, "#4a463e"]]) { g.save(); g.rotate(Math.PI / 4); g.strokeStyle = col; g.globalAlpha = a; g.lineWidth = 5; g.strokeRect(-s / 1.45, -s / 1.45, s * 1.38, s * 1.38); g.restore(); }
  g.globalAlpha = 0.55; g.strokeStyle = "#e9e2cf"; g.lineWidth = 1.6; g.save(); g.rotate(Math.PI / 4); g.strokeRect(-41, -41, 82, 82); g.restore();
  const t = canvasTex(c); return t;
}

// ---------- tapered organic tube (tree trunks / branches / roots) ----------
export function taperTube(points, radialSegs, r0, r1, { seed = 1, wobble = 0.12, segs = 20 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points), n = noise3(seed), rings = [], idx = [], pos = [], col = [];
  const frames = curve.computeFrenetFrames(segs, false), p = new THREE.Vector3();
  const bark = new THREE.Color(0x5a3a30), bark2 = new THREE.Color(0x7a5646);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; curve.getPointAt(t, p); const N = frames.normals[i], B = frames.binormals[i];
    const rad = lerp(r0, r1, Math.pow(t, 0.85)) * (1 + (i === 0 ? 0 : 0));
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2, f = 1 + (n(j * 0.9, t * 9, 3) - 0.5) * wobble * 2 + Math.max(0, 0.3 - t) * 0.5 * (0.6 + 0.4 * Math.cos(a * 3 + seed)); // root flare at the base
      const cx = Math.cos(a) * rad * f, cy = Math.sin(a) * rad * f;
      pos.push(p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy, p.z + N.z * cx + B.z * cy);
      const c = bark.clone().lerp(bark2, n(j * 1.7, t * 14, 5)); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radialSegs; j++) { const a = i * radialSegs + j, b = i * radialSegs + (j + 1) % radialSegs, c = (i + 1) * radialSegs + j, d = (i + 1) * radialSegs + (j + 1) % radialSegs; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); void rings; return g;
}

// ---------- cherry blossom ----------
let blossomTexCache = null;
function blossomCardTexture() {
  if (blossomTexCache) return blossomTexCache;
  const S = 256, c = canvas(S, S), g = c.getContext("2d"), r = rng(77);
  const cols = ["#f7a8cc", "#ffc4de", "#ee86b6", "#ffd9ea", "#e872a8"];
  for (let i = 0; i < 90; i++) { // painted blossom clump: overlapping five-petal flowers on a soft base blob
    const x = S / 2 + (r() - 0.5) * 170 * (1 - Math.abs(r() - 0.5) * 0.6), y = S / 2 + (r() - 0.5) * 150, s = 12 + r() * 20;
    if (Math.hypot(x - S / 2, (y - S / 2) * 1.1) > 118) continue;
    g.save(); g.translate(x, y); g.rotate(r() * 6.28); g.fillStyle = cols[Math.floor(r() * cols.length)]; g.strokeStyle = "rgba(150,50,100,.35)"; g.lineWidth = 1;
    for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 0.4); g.beginPath(); g.ellipse(s * 0.5, 0, s * 0.55, s * 0.34, 0, 0, 7); g.fill(); g.stroke(); }
    g.fillStyle = "#fff0a8"; g.beginPath(); g.arc(0, 0, s * 0.16, 0, 7); g.fill(); g.restore();
  }
  const t = canvasTex(c); return (blossomTexCache = t);
}
export function buildCherryTree(seed, scale, q, shadows) {
  const r = rng(seed), g = new THREE.Group(), n = noise3(seed);
  const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
  const V = (x, y, z) => new THREE.Vector3(x, y, z), parts = [];
  parts.push(taperTube([V(0, -0.4, 0), V(0.35, 1.2, 0.1), V(-0.25, 2.8, -0.15), V(0.5, 4.4, 0.05), V(0.2, 5.6, 0.1)], 10, 0.78, 0.34, { seed, segs: 26 }));
  const tips = [];
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + r() * 0.6, y0 = 3 + r() * 2, L = 2.4 + r() * 1.8, up = 1.2 + r() * 1.6;
    const st = V(0.3 * Math.cos(a), y0, 0.3 * Math.sin(a)), mid = V(Math.cos(a) * L * 0.55, y0 + up * 0.35, Math.sin(a) * L * 0.55), en = V(Math.cos(a) * L, y0 + up, Math.sin(a) * L);
    parts.push(taperTube([st, mid, en], 7, 0.24, 0.07, { seed: seed + b, segs: 10, wobble: 0.08 })); tips.push(en);
  }
  for (let b = 0; b < 5; b++) { // surface roots
    const a = (b / 5) * Math.PI * 2 + r() * 0.5, L = 1.2 + r() * 0.8;
    parts.push(taperTube([V(Math.cos(a) * 0.3, 0.55, Math.sin(a) * 0.3), V(Math.cos(a) * L * 0.6, 0.25, Math.sin(a) * L * 0.6), V(Math.cos(a) * L, -0.08, Math.sin(a) * L)], 6, 0.26, 0.05, { seed: seed + 40 + b, segs: 8 }));
  }
  const trunk = new THREE.Mesh(mergeGeos(parts), barkMat); trunk.castShadow = shadows; g.add(trunk);
  // canopy: lumpy blossom masses + painted blossom cards
  const centres = [...tips.map((t) => t.clone().add(V(0, 0.9, 0))), V(0, 6.6, 0), V(0.8, 6.2, -1.3), V(-1.2, 6.0, 1.1)];
  const blobs = centres.map((c, i) => {
    const bg = new THREE.IcosahedronGeometry(1, 3).toNonIndexed(), p = bg.attributes.position, s = 1.3 + r() * 0.7;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), f = s * (1 + (n(x * 2.6 + i, y * 2.6, z * 2.6) - 0.5) * 0.7); p.setXYZ(k, x * f * 1.15 + c.x, y * f * 0.78 + c.y, z * f * 1.15 + c.z); }
    bg.computeVertexNormals();
    const lo = new THREE.Color(0xf09cc2), hi = new THREE.Color(0xffd6e8);
    paint(bg, (x, y) => lo.clone().lerp(hi, clamp01((y - (c.y - 1.2)) / 2.4)).multiplyScalar(0.92 + n(x * 3, y * 3, i) * 0.16)); return bg;
  });
  const canopy = new THREE.Mesh(mergeGeos(blobs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false, emissive: 0x6a2a4c, emissiveIntensity: 0.3 })); canopy.castShadow = shadows; canopy.receiveShadow = shadows; g.add(canopy);
  const cardGeo = new THREE.PlaneGeometry(1, 1); const cardMat = windify(new THREE.MeshStandardMaterial({ map: blossomCardTexture(), transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x401030, emissiveIntensity: 0.18 }), { amp: 0.9, height: 0.5 });
  const count = q.blossoms, cards = new THREE.InstancedMesh(cardGeo, cardMat, count), m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const c = centres[Math.floor(r() * centres.length)], u = new THREE.Vector3(r() - 0.5, (r() - 0.35) * 0.8, r() - 0.5).normalize(), rad = 1.5 + r() * 1.2;
    ps.set(c.x + u.x * rad * 1.15, c.y + u.y * rad * 0.8, c.z + u.z * rad * 1.15); const s = 1.1 + r() * 1.1; sc.set(s, s, s);
    qt.setFromEuler(new THREE.Euler((r() - 0.5) * 1.6 - 0.2, r() * 6.28, (r() - 0.5) * 1.2)); m4.compose(ps, qt, sc); cards.setMatrixAt(i, m4);
    cards.setColorAt(i, new THREE.Color().setHSL(0.93 + (r() - 0.5) * 0.04, 0.55 + r() * 0.3, 0.8 + r() * 0.12));
  }
  g.add(cards); g.scale.setScalar(scale); g.userData = { cards, canopy, centres };
  return g;
}

// ---------- grass / flowers / bushes ----------
export function grassTuftGeometry(seed = 4) {
  const r = rng(seed), parts = [], blades = 7;
  for (let b = 0; b < blades; b++) {
    const ang = r() * 6.28, off = r() * 0.1, h = 0.45 + r() * 0.35, w = 0.055 + r() * 0.03, lean = 0.12 + r() * 0.22, segs = 3, pos = [], col = [], idx = [];
    const lo = new THREE.Color(0x35672c), hi = new THREE.Color().setHSL(0.24 + r() * 0.06, 0.5, 0.42 + r() * 0.08);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, y = t * h, bend = lean * t * t, ww = w * (1 - t * 0.92), c = lo.clone().lerp(hi, t);
      const cx = Math.cos(ang), cz = Math.sin(ang), px = -cz, pz = cx;
      for (const side of [-1, 1]) { pos.push(cx * (off + bend) + px * ww * side, y, cz * (off + bend) + pz * ww * side); col.push(c.r, c.g, c.b); }
    }
    for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    for (let i = 0; i < g.attributes.normal.count; i++) g.attributes.normal.setXYZ(i, 0, 1, 0); // soft lighting, like painted grass
    parts.push(g);
  }
  return mergeGeos(parts);
}
export function flowerGeometries(seed = 6) {
  const r = rng(seed), H = 0.42, stem = [], head = [];
  for (let k = 0; k < 2; k++) { // crossed stem blades + a leaf
    const a = k * Math.PI / 2, g = new THREE.PlaneGeometry(0.03, H, 1, 2); g.translate(0, H / 2, 0); g.rotateY(a); stem.push(g);
  }
  paint(mergeGeos(stem), () => new THREE.Color(0x3f7a34)); const stemG = paint(mergeGeos(stem), () => new THREE.Color(0x3f7a34));
  for (let k = 0; k < 5; k++) { // five petals tilted up around a yellow centre
    const g = new THREE.PlaneGeometry(0.13, 0.15, 1, 1); g.translate(0, 0.075, 0); g.rotateX(-1.15); g.rotateY((k / 5) * Math.PI * 2 + r() * 0.2); g.translate(0, H, 0);
    paint(g, () => new THREE.Color(1, 1, 1)); head.push(g);
  }
  const ctr = new THREE.CircleGeometry(0.045, 8); ctr.rotateX(-Math.PI / 2); ctr.translate(0, H + 0.03, 0); paint(ctr, () => new THREE.Color(1, 0.86, 0.3)); head.push(ctr);
  return { stem: stemG, head: mergeGeos(head) };
}
export function bushGeometry(seed, tone = 0) {
  const r = rng(seed), n = noise3(seed), parts = [], blobs = 5 + Math.floor(r() * 3);
  for (let i = 0; i < blobs; i++) {
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed(), p = g.attributes.position, s = 0.5 + r() * 0.35, cx = (r() - 0.5) * 1.2, cz = (r() - 0.5) * 1.0, cy = s * 0.55;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), f = 1 + (n(x * 3 + i, y * 3, z * 3) - 0.5) * 0.55; p.setXYZ(k, cx + x * s * f, Math.max(0.02, cy + y * s * f * 0.85), cz + z * s * f); }
    g.computeVertexNormals(); parts.push(g);
  }
  const g = mergeGeos(parts), lo = new THREE.Color().setHSL(0.3 + tone * 0.02, 0.42, 0.2), hi = new THREE.Color().setHSL(0.26 + tone * 0.03, 0.5, 0.36);
  paint(g, (x, y, z) => lo.clone().lerp(hi, clamp01(y / 1.0 + (n(x * 4, y * 4, z * 4) - 0.5) * 0.7))); return g;
}

// ---------- ruins ----------
export function pillarGeometry(h, seed, { broken = true, rad = 0.55 } = {}) {
  const r = rng(seed), n = noise3(seed), sides = 10, rings = 9, pos = [], idx = [], col = [];
  const top = broken ? h * (0.78 + r() * 0.2) : h;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, y = t * top;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2, flute = 1 + Math.cos(a * sides * 0.6) * 0.035, f = flute * (1 + (n(j * 0.8, y * 1.5, seed) - 0.5) * 0.12) * (1 - t * 0.06);
      let yy = y; if (broken && i === rings) yy -= r() * 0.55 * (0.4 + 0.6 * Math.abs(Math.sin(a * 1.5 + seed))); // jagged break
      pos.push(Math.cos(a) * rad * f, yy, Math.sin(a) * rad * f);
      const wear = 0.8 + n(j, y * 2, seed + 9) * 0.3, moss = clamp01((0.35 - t) * 1.6 + (n(j * 1.3, y * 3, seed + 5) - 0.66) * 3);
      const c = new THREE.Color(0.84 * wear, 0.8 * wear, 0.72 * wear).lerp(new THREE.Color(0.38, 0.55, 0.28), moss * 0.8); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides, c = (i + 1) * sides + j, d = (i + 1) * sides + (j + 1) % sides; idx.push(a, c, b, b, c, d); }
  const cap = pos.length / 3; pos.push(0, top - 0.25, 0); col.push(0.75, 0.72, 0.66); for (let j = 0; j < sides; j++) idx.push((rings) * sides + j, cap, rings * sides + (j + 1) % sides);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  { const p = ng.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = Math.atan2(p.getZ(i), p.getX(i)) / 6.28 * 3; uv[i * 2 + 1] = p.getY(i) * 0.35; } ng.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
  const plinth = slabGeometry(rad * 2.7, rad * 2.7, 0.28, seed + 3, 0.05);
  const pb = plinth.clone(); pb.translate(0, -0.02, 0);
  const parts = [ng, pb];
  if (!broken) { const capl = slabGeometry(rad * 2.6, rad * 2.6, 0.26, seed + 4, 0.05); capl.translate(0, top, 0); parts.push(capl); }
  return mergeGeos(parts);
}
