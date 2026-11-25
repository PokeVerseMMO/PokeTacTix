// The floating-island arena: irregular island, sculpted cliffs, trees, rocks, ruins, grass, waterfalls, podium, bench stones, sky and atmosphere.
// Pure presentation - gameplay only reads boardXZ/benchXZ and the podium position. All scenery is real geometry that casts/receives shadows.
import * as THREE from "./vendor/three.module.min.js";
import { rng, artPath } from "./art.js";
import { WIND, noise2, noise3, canvas, canvasTex, mergeGeos, paint, windify, rockMap, rockGeometry, slabGeometry, carvedStoneTexture, buildCherryTree, grassTuftGeometry, flowerGeometries, bushGeometry, pillarGeometry } from "./scenery.js";

export const R = 1, W = Math.sqrt(3) * R;            // hex circumradius / width (pointy-top, odd-r rows)
export const COLS = 8, ROWS = 8, BENCH = 10;
export const boardXZ = (col, row) => ({ x: (col + 0.5 * (row % 2) - 3.75) * W, z: (3.5 - row) * 1.5 * R });
export const BENCH_Z = 6.85, BENCH_DX = 1.62, BENCH_TOP = 0.5;
export const benchXZ = (i) => ({ x: (i - (BENCH - 1) / 2) * BENCH_DX + 0.6, z: BENCH_Z });
export const PODIUM = { x: -9.2, z: 7.7, h: 0.95 };

const lerp = (a, b, t) => a + (b - a) * t, clamp01 = (x) => Math.max(0, Math.min(1, x)), sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const CX = 0, CZ = -0.55, A = 12.8, B = 9.8, PEXP = 3.2; // island outline: superellipse + lumps
const inFlat = (x, z) => Math.abs(x) < 8.3 && z > -7.1 && z < 8.1; // playable arena + bench (kept clear of scenery)

function softCircle(color = "255,255,255", size = 128) {
  const c = canvas(size, size), g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.5, `rgba(${color},.45)`); gr.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gr; g.fillRect(0, 0, size, size); return canvasTex(c);
}
function cloudTexture(seed) {
  const c = canvas(256, 128), g = c.getContext("2d"), r = rng(seed);
  for (let i = 0; i < 30; i++) {
    const x = 30 + r() * 196, y = 50 + r() * 30 - Math.abs(x - 128) * 0.14, rad = 14 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.55, "rgba(246,246,255,.7)"); gr.addColorStop(1, "rgba(235,240,255,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return canvasTex(c);
}
function grassTexture(size) { // painterly mottled grass for the island top (the battle plate has its own art)
  const c = canvas(size, size), g = c.getContext("2d"), r = rng(31), n = noise2(12), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4, f1 = n(x / (size / 8), y / (size / 8)), f2 = n(x / (size / 30) + 9, y / (size / 30)), f3 = n(x / (size / 90), y / (size / 90));
    img.data[o] = 74 + f1 * 30 + f3 * 14; img.data[o + 1] = 118 + f1 * 36 + f2 * 20 - f3 * 8; img.data[o + 2] = 54 + f1 * 14; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < size * 1.2; i++) { g.fillStyle = `rgba(${130 + r() * 40},${170 + r() * 40},${70 + r() * 30},${0.12 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * size, r() * size, 2 + r() * 5, 1 + r() * 2.4, r() * 3, 0, 7); g.fill(); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
}
function plateMask(w, h) { // soft rounded-rectangle alpha so the painted plate melts into the 3D grass
  const c = canvas(w, h), g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  const m = Math.min(w, h) * 0.1; g.filter = `blur(${m * 0.55}px)`; g.fillStyle = "#fff"; g.beginPath(); g.roundRect(w * 0.1, h * 0.065, w * 0.8, h * 0.84, m * 0.8); g.fill(); g.filter = "none"; return new THREE.CanvasTexture(c);
}
function waterMaterial(stream = false) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, defines: stream ? { STREAM: 1 } : {}, uniforms: { uTime: WIND },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float side = smoothstep(0.0,0.18,vUv.x) * smoothstep(1.0,0.82,vUv.x);
        float flow = vUv.y * 22.0 + uTime * 3.2;
        float s = vn(vec2(vUv.x * 9.0, flow)) * 0.6 + vn(vec2(vUv.x * 21.0 + 5.0, flow * 1.7 + 3.0)) * 0.4;
        float streak = smoothstep(0.42, 0.9, s);
        vec3 deep = vec3(0.32,0.68,0.88), light = vec3(0.86,0.96,1.0);
        vec3 col = mix(deep, light, streak * 0.85 + 0.12);
        float topFoam = smoothstep(0.93, 1.0, vUv.y) * (0.6 + vn(vec2(vUv.x*14.0, uTime*2.0)) * 0.4);
        col = mix(col, vec3(1.0), topFoam);
        float a = side * (0.62 + streak * 0.3) * smoothstep(0.0, 0.2, vUv.y) + topFoam * 0.3;
        #ifdef STREAM
        a *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y) * 0.8; col = mix(col, vec3(0.7,0.9,1.0), 0.2);
#endif
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
      }` });
}
// petals: fully GPU-animated instanced quads
function petalSystem(count, origin, spread, height, color) {
  const base = new THREE.PlaneGeometry(0.17, 0.11), geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute("position", base.attributes.position); geo.setAttribute("uv", base.attributes.uv);
  const r = rng(99), st = new Float32Array(count * 3), sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { st.set([origin.x + (r() - 0.5) * spread.x, origin.y, origin.z + (r() - 0.5) * spread.z], i * 3); sd.set([r(), 0.5 + r() * 0.8, r() * 6.28, r() * 6.28], i * 4); }
  geo.setAttribute("aStart", new THREE.InstancedBufferAttribute(st, 3)); geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sd, 4)); geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uTime: WIND, uH: { value: height }, uCol: { value: new THREE.Color(color) } },
    vertexShader: `attribute vec3 aStart; attribute vec4 aSeed; uniform float uTime; uniform float uH; varying float vA; varying vec2 vUv;
      void main(){
        float ph = fract(aSeed.x + uTime * 0.035 * aSeed.y);
        vec3 p = aStart + vec3(sin(uTime*0.7+aSeed.z)*0.9 + ph*7.0, (1.0-ph)*uH, cos(uTime*0.55+aSeed.w)*0.9 - ph*1.5);
        float a = uTime*1.8*aSeed.y + aSeed.z, ca = cos(a), sa = sin(a);
        vec3 l = position; l.xy = vec2(l.x*ca - l.y*sa, l.x*sa + l.y*ca); l.xz = vec2(l.x*cos(aSeed.w) - l.z*sin(aSeed.w), l.x*sin(aSeed.w));
        vA = smoothstep(0.0,0.06,ph) * smoothstep(1.0,0.9,ph); vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * vec4(p + l * (1.0 + 0.4*sin(aSeed.z*3.0)), 1.0);
      }`,
    fragmentShader: "uniform vec3 uCol; varying float vA; varying vec2 vUv; void main(){ float e = smoothstep(0.0,0.35,vUv.x)*smoothstep(1.0,0.65,vUv.x); gl_FragColor = vec4(uCol * (0.9+0.2*vUv.y), vA * (0.35+0.6*e)); }" });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; return m;
}
function moteSystem(count, box, color) {
  const geo = new THREE.BufferGeometry(), r = rng(5), pos = new Float32Array(count * 3), sd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos.set([(r() - 0.5) * box.x, r() * box.y, (r() - 0.5) * box.z], i * 3); sd.set([r() * 6.28, 0.3 + r(), r()], i * 3); }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aSeed", new THREE.BufferAttribute(sd, 3));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: WIND, uCol: { value: new THREE.Color(color) }, uPx: { value: 1 } },
    vertexShader: `attribute vec3 aSeed; uniform float uTime; varying float vA;
      void main(){ vec3 p = position + vec3(sin(uTime*0.25*aSeed.y+aSeed.x)*1.6, sin(uTime*0.4*aSeed.y+aSeed.x*2.0)*0.8, cos(uTime*0.22*aSeed.y+aSeed.x)*1.6);
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (34.0 + aSeed.z*40.0) / -mv.z; vA = 0.35 + 0.65 * (0.5 + 0.5*sin(uTime*(0.8+aSeed.y)+aSeed.x*5.0)); }`,
    fragmentShader: "uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0,0.0,d); gl_FragColor = vec4(uCol, a*a*vA*0.55); }" });
  const m = new THREE.Points(geo, mat); m.frustumCulled = false; return m;
}

export function buildArena(scene, q) {
  const r = rng(2024), nz = noise3(9), shadows = q.shadows;
  const root = new THREE.Group(); scene.add(root);
  const anim = { clouds: [], islets: [], spin: [], waterfalls: [] };
  const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), eu = new THREE.Euler();
  const detail = q.shadows ? 2 : 1;

  // ---------- outline + terrain height ----------
  const lump = (th) => 1 + (nz(Math.cos(th) * 1.6 + 3, Math.sin(th) * 1.6, 1) - 0.5) * 0.2 + (nz(Math.cos(th) * 4.2, Math.sin(th) * 4.2 + 8, 2) - 0.5) * 0.08;
  const outR = (th) => { const c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th)); return lump(th) / Math.pow(Math.pow(c / A, PEXP) + Math.pow(s / B, PEXP), 1 / PEXP); };
  const edge = (th) => { const rr = outR(th); return { x: CX + Math.cos(th) * rr, z: CZ + Math.sin(th) * rr }; };
  const terrainY = (x, z) => { // flat under the arena; gentle mounds toward the rim for scenery to sit on
    const dx = Math.max(0, Math.abs(x) - 8.3), dz = Math.max(0, z - 8.1, -7.1 - z), dd = Math.hypot(dx, dz);
    return sstep(0, 2.4, dd) * (0.12 + 0.5 * nz(x * 0.32, 0, z * 0.32));
  };
  const SEG = 112, RING = 30, DEPTH = 12.5, CLIFF_RINGS = 15;
  const thetas = Array.from({ length: SEG }, (_, j) => (j / SEG) * Math.PI * 2);
  const rimY = (j) => { const e = edge(thetas[j]); return terrainY(e.x, e.z) - 0.42; };

  // ---------- island top ----------
  { const pos = [], uv = [], col = [], idx = [], gc = new THREE.Color();
    for (let k = 0; k <= RING; k++) for (let j = 0; j < SEG; j++) {
      const t = k / RING, th = thetas[j], rr = outR(th) * t, x = CX + Math.cos(th) * rr, z = CZ + Math.sin(th) * rr;
      let y = terrainY(x, z); if (t > 0.9) y -= Math.pow((t - 0.9) / 0.1, 2) * 0.42;
      pos.push(x, y, z); uv.push(x / 10, z / 10);
      const f = nz(x * 0.25, z * 0.25, 5), g2 = nz(x * 1.1, z * 1.1, 6); gc.setRGB(0.66 + f * 0.26 - g2 * 0.07, 0.7 + f * 0.22 + g2 * 0.1, 0.6 + f * 0.1); col.push(gc.r, gc.g, gc.b);
    }
    for (let k = 0; k < RING; k++) for (let j = 0; j < SEG; j++) { const a = k * SEG + j, b = k * SEG + (j + 1) % SEG, c = (k + 1) * SEG + j, d = (k + 1) * SEG + (j + 1) % SEG; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const top = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: grassTexture(q.texSize >= 1024 ? 512 : 256), vertexColors: true, roughness: 1 })); top.receiveShadow = shadows; root.add(top);
  }
  // ---------- battle plate: painted flagstones (art) on a real mesh, edges faded into the 3D grass ----------
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(18.9, 14.75), new THREE.MeshStandardMaterial({ map: null, alphaMap: plateMask(256, 220), transparent: true, roughness: 0.95, color: 0xe8e4dc, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(0, 0.006, 0.56); plate.receiveShadow = shadows; plate.renderOrder = -1; root.add(plate);
  const groundArt = artPath("environment", "ground");
  if (groundArt) new THREE.TextureLoader().load(groundArt, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; plate.material.map = t; plate.material.needsUpdate = true; });
  else plate.visible = false;

  // ---------- cliff body (stratified, faceted, hanging spires) ----------
  { const pos = [], col = [], uv = [], idx = [], tmp = new THREE.Color();
    const rockLo = new THREE.Color(0x4b4650), rockWarm = new THREE.Color(0x8d7a66), rockCool = new THREE.Color(0x6c6a72), grass = new THREE.Color(0x5b8a3e);
    for (let k = 0; k <= CLIFF_RINGS; k++) for (let j = 0; j < SEG; j++) {
      const t = k / CLIFF_RINGS, th = thetas[j], e = edge(th), rimy = rimY(j);
      const taper = k === 0 ? 1.0 : Math.pow(1 - t, 0.62) * 0.95 + 0.05, jag = k === 0 ? 0 : (nz(th * 2.6 + k * 1.9, k * 1.3, 4) - 0.5) * 2.8 * (0.35 + t) + (nz(th * 9, k * 2.1, 8) - 0.5) * 0.9;
      const dist = Math.hypot(e.x - CX, e.z - CZ), s = Math.max(0.04, (dist * taper + jag * (k ? 1 : 0)) / dist);
      const ledge = k > 0 && k < CLIFF_RINGS ? (Math.sin(k * 1.9 + nz(th * 3, k, 1) * 5) > 0.55 ? 0.35 : 0) : 0; // terraces
      pos.push(CX + (e.x - CX) * s, rimy - Math.pow(t, 1.12) * DEPTH + ledge * (nz(th * 5, k, 3) - 0.3) - (k ? nz(th * 7, k * 0.8, 9) * 0.6 : 0), CZ + (e.z - CZ) * s);
      uv.push(th * 2.2, t * 3);
      const band = Math.sin(t * 24 + nz(th * 3, t * 4, 7) * 6) * 0.5 + 0.5, warmMix = clamp01(nz(th * 3.1, t * 5, 2) * 1.2 - 0.1 + band * 0.25);
      tmp.copy(rockCool).lerp(rockWarm, warmMix).lerp(rockLo, clamp01(t * 1.15 - 0.1)).multiplyScalar(0.8 + nz(th * 12, t * 9, 6) * 0.35);
      if (k === 0) tmp.copy(grass).multiplyScalar(0.8); else if (k === 1) tmp.lerp(grass, 0.5); else if (k === 2) tmp.lerp(grass, 0.15 * (nz(th * 8, 2, 1) > 0.5 ? 1 : 0)); // grassy lip, hanging moss
      col.push(tmp.r, tmp.g, tmp.b);
    }
    for (let k = 0; k < CLIFF_RINGS; k++) for (let j = 0; j < SEG; j++) { const a = k * SEG + j, b = k * SEG + (j + 1) % SEG, c = (k + 1) * SEG + j, d = (k + 1) * SEG + (j + 1) % SEG; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    const cliff = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ map: rockMap(), vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide })); cliff.receiveShadow = shadows; cliff.castShadow = false; root.add(cliff);
    // hanging stalactite spires
    const spireGeos = [rockGeometry(71, detail, { moss: 0.05, rock: 0x7b7770 }), rockGeometry(72, detail, { moss: 0.05, rock: 0x6e6a70 })].map((g) => { g.rotateX(Math.PI); return g; });
    const spireMat = new THREE.MeshStandardMaterial({ map: rockMap(), vertexColors: true, flatShading: true, roughness: 1 });
    for (let gi = 0; gi < 2; gi++) {
      const sp = new THREE.InstancedMesh(spireGeos[gi], spireMat, 9); sp.castShadow = false;
      for (let i = 0; i < 9; i++) { const th = r() * 6.28, e = edge(th), f = 0.18 + r() * 0.55, s = 1 + r() * 1.5; ps.set(CX + (e.x - CX) * f, -DEPTH * (0.45 + r() * 0.35), CZ + (e.z - CZ) * f); sc.set(s * 0.9, s * (1.8 + r() * 1.6), s * 0.9); qt.setFromEuler(eu.set(0, r() * 6.28, 0)); m4.compose(ps, qt, sc); sp.setMatrixAt(i, m4); }
      root.add(sp);
    }
  }

  // ---------- registry of contact-shadow blobs (cheap AO under every scenery object) ----------
  const blobs = [];
  const aoBlob = (x, z, rad, a = 0.38) => blobs.push({ x, z, rad, a });
  const place = (x, z, lift = 0) => ps.set(x, terrainY(x, z) + lift, z);

  // ---------- rocks (rock formations) ----------
  const rockGeos = [rockGeometry(11, detail), rockGeometry(12, detail, { tall: 1.5 }), rockGeometry(13, detail, { moss: 0.9 }), rockGeometry(14, detail, { tall: 0.8 })];
  const rockMat = new THREE.MeshStandardMaterial({ map: rockMap(), vertexColors: true, roughness: 1, flatShading: true });
  const rockSpots = [[-11.2, -6.5, 1.9], [-12.0, -2.6, 1.3], [-8.4, -8.8, 1.6], [-3.0, -9.1, 1.2], [1.8, -9.4, 1.7], [6.3, -9.0, 1.3], [11.6, -6.0, 1.8], [12.0, -1.6, 1.2], [11.3, 4.4, 1.5], [8.9, 8.2, 1.3], [-12.1, 3.6, 1.5], [-6.5, 9.0, 1.1], [-8.2, -5.2, 0.8], [9.8, -3.8, 0.9], [11.9, 7.0, 1.0]];
  const rockInst = rockGeos.map((g) => ({ g, list: [] })); rockSpots.forEach((s, i) => rockInst[i % rockGeos.length].list.push(s));
  for (const { g, list } of rockInst) {
    const im = new THREE.InstancedMesh(g, rockMat, list.length); im.castShadow = shadows; im.receiveShadow = shadows;
    list.forEach(([x, z, s], i) => { place(x, z, s * 0.18); sc.set(s * (1 + r() * 0.4), s * (0.8 + r() * 0.5), s * (1 + r() * 0.4)); qt.setFromEuler(eu.set(0, r() * 6.28, 0)); m4.compose(ps, qt, sc); im.setMatrixAt(i, m4); aoBlob(x, z, s * 1.5); });
    root.add(im);
  }
  // small scattered stones
  { const n = 34, im = new THREE.InstancedMesh(rockGeos[3], rockMat, n); im.castShadow = shadows; let i = 0;
    while (i < n) { const x = (r() - 0.5) * 25, z = (r() - 0.5) * 19 + CZ; if (inFlat(x, z) || Math.abs(x) > 12 || z < -9.2 || z > 9.2) continue; const s = 0.14 + r() * 0.3; place(x, z, s * 0.1); sc.set(s * 1.3, s, s * 1.2); qt.setFromEuler(eu.set(0, r() * 6.28, 0)); m4.compose(ps, qt, sc); im.setMatrixAt(i++, m4); }
    root.add(im); }

  // ---------- stone border around the arena (thin curb stones, left / right / back) ----------
  { const slabs = []; const mats = new THREE.MeshStandardMaterial({ map: carvedStoneTexture(8), vertexColors: true, roughness: 0.95 });
    const spots = []; for (let z = -6.3; z <= 6.4; z += 1.42) { spots.push([-7.7, z, Math.PI / 2], [7.7, z, Math.PI / 2]); } for (let x = -6.4; x <= 6.5; x += 1.42) spots.push([x, -6.85, 0]);
    spots.forEach(([x, z, rot], i) => { const g = slabGeometry(1.3 + r() * 0.12, 0.42 + r() * 0.06, 0.2 + r() * 0.08, 200 + i, 0.04); slabs.push({ g, x, z, rot, i }); });
    const merged = []; for (const s of slabs) { const m = new THREE.Matrix4().compose(new THREE.Vector3(s.x + (r() - 0.5) * 0.08, 0, s.z + (r() - 0.5) * 0.08), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.rot + (r() - 0.5) * 0.06, 0)), new THREE.Vector3(1, 1, 1)); const g = s.g.clone(); g.applyMatrix4(m); merged.push(g); aoBlob(s.x, s.z, 0.8, 0.2); }
    const curb = new THREE.Mesh(mergeGeos(merged), mats); curb.castShadow = shadows; curb.receiveShadow = shadows; root.add(curb); }

  // ---------- bench stones: nine individually sculpted, weathered platforms ----------
  const slabs = [];
  { const bm = new THREE.MeshStandardMaterial({ map: carvedStoneTexture(3), vertexColors: true, roughness: 0.95 });
    for (let i = 0; i < BENCH; i++) {
      const p = benchXZ(i), w = 1.46 + (r() - 0.5) * 0.14, d = 1.4 + (r() - 0.5) * 0.1, g = slabGeometry(w, d, BENCH_TOP, 400 + i * 7, 0.07), m = new THREE.Mesh(g, bm);
      m.position.set(p.x, 0, p.z); m.rotation.y = (r() - 0.5) * 0.05; m.castShadow = shadows; m.receiveShadow = shadows; root.add(m); slabs.push(m); aoBlob(p.x, p.z + 0.1, 1.15, 0.3);
      if (r() < 0.55) { const gs = slabGeometry(0.5 + r() * 0.3, 0.3, 0.12, 600 + i, 0.03); const c = new THREE.Mesh(gs, bm); c.position.set(p.x + (r() - 0.5) * 0.8, 0, p.z + 0.85 + r() * 0.15); c.rotation.y = r() * 3; c.receiveShadow = shadows; root.add(c); } // loose paving at the front
    }
  }

  // ---------- commander podium: stacked stonework, runic circle, banners and lanterns ----------
  const pod = new THREE.Group(); pod.position.set(PODIUM.x, 0, PODIUM.z); pod.scale.set(0.8, 1, 0.8); root.add(pod);
  { const pm = new THREE.MeshStandardMaterial({ map: carvedStoneTexture(5), vertexColors: true, roughness: 0.95 }), blockGeo = slabGeometry(0.98, 0.62, 0.5, 900, 0.06), block2 = slabGeometry(0.85, 0.55, 0.36, 901, 0.05);
    const ring = (n, rad, geo, y, base) => { const im = new THREE.InstancedMesh(geo, pm, n); im.castShadow = shadows; im.receiveShadow = shadows; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ps.set(Math.cos(a) * rad, y, Math.sin(a) * rad); qt.setFromEuler(eu.set(0, -a + Math.PI / 2 + (r() - 0.5) * 0.05, 0)); sc.set(1, 1, 1); m4.compose(ps, qt, sc); im.setMatrixAt(i, m4); } pod.add(im); void base; };
    ring(14, 1.95, blockGeo, 0, 0); ring(11, 1.55, block2, 0.5, 0);
    const topD = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.42, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, map: carvedStoneTexture(6), roughness: 0.9 })); topD.position.y = 0.89; topD.receiveShadow = shadows; topD.castShadow = shadows; pod.add(topD);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.7, 18), new THREE.MeshStandardMaterial({ color: 0x77705f, roughness: 1 })); fill.position.y = 0.32; pod.add(fill);
    // runic circle
    const rc = canvas(256, 256), rg = rc.getContext("2d"); rg.translate(128, 128);
    for (const [rad, w, a] of [[118, 6, 0.95], [96, 3, 0.7], [70, 2, 0.5]]) { rg.strokeStyle = `rgba(190,140,255,${a})`; rg.lineWidth = w; rg.beginPath(); rg.arc(0, 0, rad, 0, 7); rg.stroke(); }
    rg.fillStyle = "rgba(220,190,255,.9)"; for (let i = 0; i < 12; i++) { rg.save(); rg.rotate((i / 12) * 6.28); rg.fillRect(-3, -112, 6, 22); rg.restore(); }
    const rt = canvasTex(rc), magic = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: rt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); magic.rotation.x = -Math.PI / 2; magic.position.y = 0.97; pod.add(magic); anim.spin.push(magic);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCircle("170,110,255", 128), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false })); glow.scale.set(3.6, 1.4, 1); glow.position.y = 1.0; pod.add(glow); anim.podGlow = glow;
    // banners
    const bc = canvas(128, 256), bg = bc.getContext("2d"), grd = bg.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, "#6c3aa8"); grd.addColorStop(1, "#43217a"); bg.fillStyle = grd; bg.fillRect(0, 0, 128, 220); bg.beginPath(); bg.moveTo(0, 220); bg.lineTo(64, 256); bg.lineTo(128, 220); bg.fill();
    bg.strokeStyle = "#e6c262"; bg.lineWidth = 6; bg.strokeRect(5, 5, 118, 210); bg.beginPath(); bg.arc(64, 108, 34, 0, 7); bg.stroke(); bg.lineWidth = 4; bg.beginPath(); bg.arc(64, 108, 20, 0.5, 5.8); bg.stroke();
    const bt = canvasTex(bc), bannerMat = windify(new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide, roughness: 0.9 }), { amp: 1.7, height: -0.9 }), poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.8 });
    for (const sx of [-1, 1]) {
      const px = sx * 2.35, pz = -1.3, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6), poleMat); pole.position.set(px, 1.8, pz); pole.castShadow = shadows; pod.add(pole);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.5, roughness: 0.4 })); cap.position.set(px, 3.65, pz); pod.add(cap);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.7, 3, 8), bannerMat); cloth.position.set(px, 2.55, pz + 0.06); cloth.castShadow = shadows; pod.add(cloth);
      const base = new THREE.Mesh(slabGeometry(0.7, 0.7, 0.3, 910 + sx, 0.05), pm); base.position.set(px, 0, pz); base.castShadow = shadows; pod.add(base); aoBlob(PODIUM.x + px, PODIUM.z + pz, 0.8, 0.3);
      // lantern on a stone post
      const lx = sx * 2.55, lz = 1.55, post = new THREE.Mesh(slabGeometry(0.4, 0.4, 0.75, 920 + sx, 0.04), pm); post.position.set(lx, 0, lz); post.castShadow = shadows; pod.add(post);
      const lan = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffa43a, emissiveIntensity: 1.3, roughness: 0.4 })); lan.position.set(lx, 0.98, lz); pod.add(lan);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), poleMat); frame.position.set(lx, 1.22, lz); pod.add(frame); const frame2 = frame.clone(); frame2.position.y = 0.76; pod.add(frame2);
      const lg = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCircle("255,190,90", 128), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, fog: false })); lg.scale.set(1.6, 1.6, 1); lg.position.set(lx, 1.0, lz); pod.add(lg); anim.spin.push(lg); lg.userData.flicker = r() * 6;
    }
    aoBlob(PODIUM.x, PODIUM.z, 2.6, 0.45);
  }

  // ---------- cherry blossom trees ----------
  const trees = [];
  for (const [x, z, s, seed] of [[-10.0, -6.6, 0.92, 21], [10.8, -8.0, 0.72, 33]]) {
    const tr = buildCherryTree(seed, s, q, shadows); place(x, z); tr.position.copy(ps); tr.rotation.y = r() * 6; root.add(tr); trees.push(tr); aoBlob(x, z, 3.0 * s, 0.4);
  }

  // ---------- ruins: broken pillars, a mossy arch, tumbled blocks ----------
  const ruinMat = new THREE.MeshStandardMaterial({ map: carvedStoneTexture(9), vertexColors: true, roughness: 0.95, flatShading: false });
  const pillarSpots = [[-7.9, -7.5, 2.3, 1], [-3.2, -9.0, 2.7, 1], [4.7, -8.9, 1.5, 1], [11.5, -3.2, 2.2, 1], [-11.4, 1.0, 1.7, 1], [12.2, 2.6, 1.3, 1], [-12.0, 7.3, 1.4, 1]];
  pillarSpots.forEach(([x, z, h, br], i) => { const m = new THREE.Mesh(pillarGeometry(h, 30 + i, { broken: !!br }), ruinMat); place(x, z); m.position.copy(ps); m.rotation.y = r() * 6; m.rotation.z = (r() - 0.5) * 0.06; m.castShadow = shadows; m.receiveShadow = shadows; root.add(m); aoBlob(x, z, 1.1, 0.35); });
  { // arch (two columns + lintel), back right
    const ax = 8.3, az = -7.9; place(ax, az); const arch = new THREE.Group(); arch.position.copy(ps); arch.rotation.y = 0.35; root.add(arch);
    const c1 = new THREE.Mesh(pillarGeometry(3.7, 61, { broken: false, rad: 0.5 }), ruinMat); c1.position.x = -1.45; const c2 = new THREE.Mesh(pillarGeometry(2.7, 62, { broken: true, rad: 0.5 }), ruinMat); c2.position.x = 1.45;
    const lintel = new THREE.Mesh(slabGeometry(3.9, 0.95, 0.5, 63, 0.07), ruinMat); lintel.position.set(0.0, 3.62, 0); lintel.rotation.z = 0.04; const lint2 = new THREE.Mesh(slabGeometry(1.5, 0.8, 0.36, 64, 0.05), ruinMat); lint2.position.set(-1.4, 4.1, 0.05); lint2.rotation.y = 0.2;
    for (const m of [c1, c2, lintel, lint2]) { m.castShadow = shadows; m.receiveShadow = shadows; arch.add(m); }
    aoBlob(ax, az, 2.4, 0.4);
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(slabGeometry(0.7 + r() * 0.5, 0.6, 0.3 + r() * 0.2, 70 + i, 0.05), ruinMat); const bx = ax + 2 + r() * 2.4, bz = az + 1.2 + r() * 1.6; place(bx, bz); b.position.copy(ps); b.rotation.set((r() - 0.5) * 0.2, r() * 3, (r() - 0.5) * 0.2); b.castShadow = shadows; root.add(b); aoBlob(bx, bz, 0.7, 0.3); }
  }
  for (const [x, z] of [[-9.6, -4.4], [-11.1, 5.0], [11.0, 6.1]]) { // mossy low wall stacks
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(slabGeometry(1.0 + r() * 0.5, 0.7, 0.34, 80 + i + x, 0.05), ruinMat); place(x + (r() - 0.5) * 0.4, z + i * 0.55 * (r() - 0.5), i * 0.3); b.position.copy(ps); b.rotation.y = r() * 1.2; b.castShadow = shadows; b.receiveShadow = shadows; root.add(b); }
    aoBlob(x, z, 1.4, 0.35);
  }

  // ---------- vegetation (instanced, wind-driven) ----------
  const tuftGeo = grassTuftGeometry(), tuftMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), { amp: 1.4, height: 1.2 });
  { const n = q.grass, im = new THREE.InstancedMesh(tuftGeo, tuftMat, n); let i = 0; const col = new THREE.Color();
    const patches = Array.from({ length: 28 }, () => { let x, z; do { x = (r() - 0.5) * 25; z = (r() - 0.5) * 19.4 + CZ; } while (inFlat(x, z) || outR(Math.atan2(z - CZ, x - CX)) < Math.hypot(x - CX, z - CZ) - 0.9); return { x, z, rad: 0.8 + r() * 1.5 }; });
    while (i < n) {
      let x, z; if (r() < 0.78) { const p = patches[Math.floor(r() * patches.length)], a = r() * 6.28, d = Math.sqrt(r()) * p.rad; x = p.x + Math.cos(a) * d; z = p.z + Math.sin(a) * d; } else { x = (r() - 0.5) * 25; z = (r() - 0.5) * 19.4 + CZ; }
      if (inFlat(x, z) || (z > 7.0 && Math.abs(x) < 10) || Math.hypot(x - PODIUM.x, z - PODIUM.z) < 2.5 || outR(Math.atan2(z - CZ, x - CX)) < Math.hypot(x - CX, z - CZ) - 0.5) continue;
      place(x, z); const s = 0.42 + r() * 0.5; sc.set(s * (0.8 + r() * 0.6), s * (0.8 + r() * 0.8), s * (0.8 + r() * 0.6)); qt.setFromEuler(eu.set((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3)); m4.compose(ps, qt, sc); im.setMatrixAt(i, m4);
      col.setHSL(0.95 * 0.3 + r() * 0.04, 0.55, 0.78 + r() * 0.35); im.setColorAt(i++, col.setRGB(0.85 + r() * 0.3, 0.9 + r() * 0.25, 0.8 + r() * 0.2));
    }
    im.receiveShadow = false; root.add(im);
    // grass hugging the bench front and the arena curb (inside clear zone edges only, never on tiles)
    const edgeN = Math.floor(n * 0.12), em = new THREE.InstancedMesh(tuftGeo, tuftMat, edgeN);
    for (let k = 0; k < edgeN; k++) { const side = Math.floor(r() * 3); let x, z; if (side === 0) { x = -7.6 - r() * 0.7; z = (r() - 0.5) * 14; } else if (side === 1) { x = 7.6 + r() * 0.7; z = (r() - 0.5) * 14; } else { x = (r() - 0.5) * 14; z = -7.5 - r() * 0.7; } place(x, z); sc.setScalar(0.4 + r() * 0.4); qt.setFromEuler(eu.set(0, r() * 6.28, 0)); m4.compose(ps, qt, sc); em.setMatrixAt(k, m4); em.setColorAt(k, col.setRGB(0.85 + r() * 0.3, 0.9 + r() * 0.2, 0.8)); }
    root.add(em);
  }
  { // flower clusters
    const fg = flowerGeometries(), stemMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), { amp: 1.3, height: 1.4 }), headMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x201018, emissiveIntensity: 0.4 }), { amp: 1.3, height: 1.4 });
    const clusters = 18, per = Math.max(3, Math.floor(q.flowers / clusters)), N = clusters * per, stems = new THREE.InstancedMesh(fg.stem, stemMat, N), heads = new THREE.InstancedMesh(fg.head, headMat, N);
    const pal = [0xffffff, 0xffa8cf, 0xffe56a, 0xc7a9ff, 0xff7fa8, 0xfff0f6]; let i = 0;
    for (let c = 0; c < clusters; c++) {
      let cx, cz; do { cx = (r() - 0.5) * 25; cz = (r() - 0.5) * 19.4 + CZ; } while (inFlat(cx, cz) || Math.hypot(cx - PODIUM.x, cz - PODIUM.z) < 2.2 || outR(Math.atan2(cz - CZ, cx - CX)) < Math.hypot(cx - CX, cz - CZ) - 1.2);
      const base = new THREE.Color(pal[c % pal.length]);
      for (let k = 0; k < per; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.55; place(cx + Math.cos(a) * d, cz + Math.sin(a) * d); const s = 0.85 + r() * 0.8; sc.set(s, s, s); qt.setFromEuler(eu.set((r() - 0.5) * 0.25, r() * 6.28, (r() - 0.5) * 0.25)); m4.compose(ps, qt, sc); stems.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); heads.setColorAt(i, base.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.1)); i++; }
    }
    root.add(stems, heads);
  }
  { // bushes with blossoms
    const bushSpots = [[-8.6, -6.4, 1.2], [-6.2, -8.2, 1.0], [-1.0, -8.8, 1.1], [3.2, -8.1, 1.2], [7.2, -6.2, 1.0], [10.4, -4.6, 1.3], [11.4, 1.8, 1.1], [-11.6, -0.6, 1.2], [-12.2, 5.4, 1.0], [12.0, 7.4, 1.1], [-11.2, 3.7, 0.9], [11.7, 5.4, 1.0]];
    const geos = [bushGeometry(1, 0), bushGeometry(2, 1), bushGeometry(3, 2)], mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), { amp: 0.35, height: 0.35 });
    geos.forEach((g, gi) => { const list = bushSpots.filter((_, i) => i % 3 === gi), im = new THREE.InstancedMesh(g, mat, list.length); im.castShadow = shadows; im.receiveShadow = shadows; list.forEach(([x, z, s], i) => { place(x, z); sc.setScalar(s * 0.8); qt.setFromEuler(eu.set(0, r() * 6.28, 0)); m4.compose(ps, qt, sc); im.setMatrixAt(i, m4); aoBlob(x, z, s * 1.3, 0.35); }); root.add(im); });
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x301020, emissiveIntensity: 0.3 }), bushSpots.length * 7); let k = 0;
    for (const [x, z, s] of bushSpots) for (let j = 0; j < 7; j++) { const a = r() * 6.28, d = r() * 0.7 * s; place(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.45 * s + r() * 0.45 * s); sc.setScalar(0.8 + r() * 0.6); qt.identity(); m4.compose(ps, qt, sc); fl.setMatrixAt(k, m4); fl.setColorAt(k++, new THREE.Color([0xffb2d4, 0xffffff, 0xff8fbd, 0xffe38a][Math.floor(r() * 4)])); }
    root.add(fl);
  }

  // ---------- contact shadows (soft AO blobs, one instanced mesh) ----------
  { const bt = (() => { const c = canvas(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(10,18,8,.9)"); gr.addColorStop(0.55, "rgba(10,18,8,.45)"); gr.addColorStop(1, "rgba(10,18,8,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return canvasTex(c); })();
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: true }), blobs.length);
    blobs.forEach((b, i) => { ps.set(b.x, terrainY(b.x, b.z) + 0.03, b.z); sc.set(b.rad * 2.2, 1, b.rad * 2.2); m4.compose(ps, qt.identity(), sc); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(1, 1, 1).multiplyScalar(1)); });
    im.renderOrder = 2; im.material.opacity = 0.75; root.add(im); }

  // ---------- waterfalls (two): stream over the grass, bent sheet over the lip, foam and mist ----------
  const waterMat = waterMaterial(), streamMat = waterMaterial(true), mist = softCircle("255,255,255", 128);
  for (const th of [0.3, Math.PI - 0.3]) {
    const e = edge(th), nx = Math.cos(th), nzz = Math.sin(th), lipY = rimY(Math.floor((th / (Math.PI * 2)) * SEG) % SEG) + 0.42, len = 4.2, H = 24;
    const wf = new THREE.Group(); wf.position.set(e.x, 0, e.z); wf.rotation.y = Math.atan2(nx, nzz); root.add(wf); // local +z points out of the island
    const sg = new THREE.PlaneGeometry(1.9, len, 1, 12); sg.rotateX(-Math.PI / 2); { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const lz = p.getZ(i) - len / 2; /* lz in [-len, 0] from inside to lip */ const wx = e.x + nx * 0 + Math.sin(wf.rotation.y) * lz * -1, wz = e.z + Math.cos(wf.rotation.y) * lz * -1; void wx; void wz; p.setXYZ(i, p.getX(i) + Math.sin(p.getZ(i) * 0.6) * 0.25, 0.06 + Math.max(0, terrainY(e.x - nx * (len / 2 - p.getZ(i)), e.z - nzz * (len / 2 - p.getZ(i))) - 0.02), p.getZ(i) - len / 2); } sg.computeVertexNormals(); }
    const stream = new THREE.Mesh(sg, streamMat); stream.position.y = 0; stream.renderOrder = 3; wf.add(stream);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, H, 1, 14), waterMat); { const p = sheet.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const dy = -(p.getY(i) - H / 2) ; p.setZ(i, 0.05 + 0.9 * (1 - Math.exp(-dy / 2.5)) + dy * 0.02); p.setY(i, lipY + 0.05 - dy); } }
    sheet.renderOrder = 3; wf.add(sheet);
    for (const [y, s, o] of [[lipY + 0.25, 3.4, 0.8], [lipY - H + 1.0, 8, 0.6], [lipY - H - 1.5, 11, 0.45]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mist, transparent: true, opacity: o, depthWrite: false })); sp.scale.set(s, s * 0.55, 1); sp.position.set(0, y, 1.3); wf.add(sp); anim.clouds.push(Object.assign(sp, { userData: { speed: 0, bob: r() * 6, base: sp.position.y, wobble: true } })); }
    // rocks flanking the lip
    for (const sx of [-1.4, 1.4]) { const m = new THREE.Mesh(rockGeos[2], rockMat); m.scale.set(0.8, 0.7, 0.8); m.position.set(sx, lipY + 0.3, -0.2); m.castShadow = shadows; wf.add(m); }
  }

  // ---------- sky: painted panorama on a backdrop plane + gradient sphere fallback ----------
  { const gc = canvas(8, 256), gg = gc.getContext("2d"), gr = gg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#5aa6e8"); gr.addColorStop(0.5, "#9fd2f5"); gr.addColorStop(1, "#e6f2ff"); gg.fillStyle = gr; gg.fillRect(0, 0, 8, 256);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(260, 16, 12), new THREE.MeshBasicMaterial({ map: canvasTex(gc), side: THREE.BackSide, fog: false, depthWrite: false })); sph.renderOrder = -10; root.add(sph);
    const skyArt = artPath("environment", "sky"), back = new THREE.Mesh(new THREE.PlaneGeometry(340, 170), new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false })); back.position.set(0, -28, -150); back.renderOrder = -9; back.visible = false; root.add(back);
    if (skyArt) new THREE.TextureLoader().load(skyArt, (t) => { t.colorSpace = THREE.SRGBColorSpace; back.material.map = t; back.material.needsUpdate = true; back.visible = true; });
    anim.sky = back; }

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xb9d4f5, 0x8d7d58, 0.8));
  scene.add(new THREE.AmbientLight(0x93a7d4, 0.22));
  const sunL = new THREE.DirectionalLight(0xffe0b0, 2.8); sunL.position.set(-13, 13, 9); sunL.target.position.set(0, 0, 0);
  if (shadows) { sunL.castShadow = true; sunL.shadow.mapSize.set(q.shadowSize, q.shadowSize); const c = sunL.shadow.camera; c.left = -17; c.right = 17; c.top = 15; c.bottom = -15; c.near = 1; c.far = 60; sunL.shadow.bias = -0.0006; sunL.shadow.normalBias = 0.04; sunL.shadow.radius = 3.5; }
  scene.add(sunL, sunL.target);
  scene.fog = new THREE.Fog(0xbcd8f2, 62, 190);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softCircle("255,236,200", 256), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 })); sun.scale.set(80, 80, 1); sun.position.set(-60, 20, -120); root.add(sun);

  // ---------- clouds (layered, drifting) & distant floating islets ----------
  const cloudTex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  const layers = [{ n: Math.ceil(q.clouds * 0.45), y: [-26, -12], rad: [20, 46], w: [26, 44], o: 0.85, sp: [0.12, 0.25] }, { n: Math.ceil(q.clouds * 0.35), y: [-22, -8], rad: [40, 85], w: [22, 40], o: 0.8, sp: [0.25, 0.45] }, { n: Math.ceil(q.clouds * 0.3), y: [10, 24], rad: [50, 90], w: [28, 46], o: 0.6, sp: [0.08, 0.16] }];
  for (const L of layers) for (let i = 0; i < L.n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex[i % 3], transparent: true, opacity: L.o * (0.8 + r() * 0.2), depthWrite: false, fog: false })), a = r() * Math.PI * 2, rad = L.rad[0] + r() * (L.rad[1] - L.rad[0]), w = L.w[0] + r() * (L.w[1] - L.w[0]);
    s.scale.set(w, w * 0.45, 1); s.position.set(Math.cos(a) * rad * 1.4, L.y[0] + r() * (L.y[1] - L.y[0]), Math.sin(a) * rad * 0.7 - 12); s.userData.speed = L.sp[0] + r() * (L.sp[1] - L.sp[0]); root.add(s); anim.clouds.push(s);
  }
  const isletN = q.shadows ? 7 : 4, isletTop = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  for (let i = 0; i < isletN; i++) {
    const g = new THREE.Group(), s = 1.1 + r() * 1.3, nz2 = noise3(300 + i);
    const topG = new THREE.CylinderGeometry(3 * s, 2.4 * s, 0.9, 12, 2).toNonIndexed(), p = topG.attributes.position; for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (nz2(p.getX(k), p.getY(k), p.getZ(k)) - 0.5) * 0.25), p.getY(k) + (p.getY(k) > 0 ? (nz2(p.getX(k) * 0.7, 3, p.getZ(k) * 0.7) - 0.4) * 0.5 : 0), p.getZ(k) * (1 + (nz2(p.getZ(k), 9, p.getX(k)) - 0.5) * 0.25)); topG.computeVertexNormals();
    paint(topG, (x, y, z, nx, ny) => ny > 0.5 ? new THREE.Color(0x4f8a3c).multiplyScalar(0.9 + nz2(x, 2, z) * 0.3) : new THREE.Color(0x7a6f66));
    const base = rockGeometry(500 + i, 1, { moss: 0, rock: 0x716b72 }); base.rotateX(Math.PI); const bm = new THREE.Mesh(base, new THREE.MeshStandardMaterial({ map: rockMap(), vertexColors: true, flatShading: true, roughness: 1 })); bm.scale.set(2.9 * s, 4.2 * s, 2.9 * s); bm.position.y = -0.6;
    g.add(new THREE.Mesh(topG, isletTop), bm);
    for (let k = 0; k < 2 + (i % 2); k++) { const t = buildCherryTree(700 + i * 3 + k, 0.32 * s, { blossoms: 12 }, false); t.position.set((r() - 0.5) * 3.2 * s, 0.55, (r() - 0.5) * 2.4 * s); g.add(t); }
    const dist = 60 + r() * 70, pitch = (11 + r() * 13) * Math.PI / 180; g.scale.setScalar(dist / 55); g.position.set((i % 2 ? 1 : -1) * (14 + r() * dist * 0.5), 12.6 - (dist + 27.4) * Math.tan(pitch), -dist); g.rotation.y = r() * 6.28; g.userData.bob = r() * 6; root.add(g); anim.islets.push(g);
  }

  // ---------- atmosphere: petals, motes ----------
  const petals = petalSystem(q.petals * 2, new THREE.Vector3(-10, 9.5, -7), new THREE.Vector3(10, 0, 8), 11, 0xffb9d6); root.add(petals);
  const petals2 = petalSystem(q.petals, new THREE.Vector3(10, 8, -8), new THREE.Vector3(8, 0, 6), 9, 0xffc9df); root.add(petals2);
  const motes = moteSystem(q.motes || 40, new THREE.Vector3(28, 7, 22), 0xfff0c0); motes.position.set(0, 0.6, 0); root.add(motes);

  return { root, anim, slabs, podium: pod, sunLight: sunL, terrainY, update(t, dt) {
    WIND.value = t;
    for (const c of anim.clouds) { if (c.userData.wobble) { c.position.y = c.userData.base + Math.sin(t * 0.6 + c.userData.bob) * 0.15; continue; } c.position.x += c.userData.speed * dt; if (c.position.x > 100) c.position.x = -100; }
    for (const g of anim.islets) { g.position.y += Math.sin(t * 0.4 + g.userData.bob) * dt * 0.25; g.rotation.y += dt * 0.004; }
    for (const m of anim.spin) { if (m.userData.flicker !== undefined) m.material.opacity = 0.65 + Math.sin(t * 7 + m.userData.flicker) * 0.12 + Math.sin(t * 13.3 + m.userData.flicker) * 0.06; else m.rotation.z += dt * 0.35; }
    if (anim.podGlow) anim.podGlow.material.opacity = 0.45 + Math.sin(t * 1.6) * 0.15;
  } };
}
