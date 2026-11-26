// Lobby showcase: a small standalone three.js viewport that shows the selected commander's 3D model with its idle loop.
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
export class Lobby3D {
  constructor(canvas) {
    this.canvas = canvas; this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); this.r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); this.r.setSize(canvas.width, canvas.height, false);
    this.scene = new THREE.Scene(); this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.0)); const d = new THREE.DirectionalLight(0xfff0d8, 1.8); d.position.set(1.5, 2.5, 3); this.scene.add(d);
    this.cam = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 100); this.cache = new Map(); this.cur = null; this.id = null; this.t = 0; this.last = performance.now(); this.loader = new GLTFLoader();
    const tick = (n) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (n - this.last) / 1000);
      this.last = n;
      if (canvas.offsetParent === null) return;
      this.update(dt);
      this.r.render(this.scene, this.cam);
    };
    requestAnimationFrame(tick);
  }
  async show(id) {
    if (this.id === id) return;
    this.id = id;
    if (this.cur) {
      this.scene.remove(this.cur.root);
      this.cur = null;
    }
    let e = this.cache.get(id);
    if (!e) { e = this.load(id); this.cache.set(id, e); }
    const m = await e;
    if (!m || this.id !== id || this.cur === m) return;
    this.cur = m; this.scene.add(m.root); this.t = 0; this.pose(m, 0);
    const bb = new THREE.Box3().setFromObject(m.root), h = bb.max.y - bb.min.y, c = bb.getCenter(new THREE.Vector3());
    m.root.rotation.y = -0.25; this.cam.position.set(c.x, c.y + h * 0.04, c.z + h * 2.15); this.cam.lookAt(c.x, c.y, c.z);
  }
  async load(id) {
    try {
      const base = `art/models/${id}/`, g = await this.loader.loadAsync(base + "model.glb"); let motion = null;
      try { motion = (await (await fetch(base + "anim.json")).json()).motions.stand; } catch {}
      const bones = {}; g.scene.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh && o.material && o.material.name && o.material.name.endsWith("_eye") && o.material.map) { o.material.map.wrapS = o.material.map.wrapT = THREE.RepeatWrapping; o.material.map.needsUpdate = true; } }); // eye atlas UVs live in negative V and need repeat wrapping
      return { root: g.scene, motion, bones };
    } catch (e) { console.warn("lobby model", id, e); return null; }
  }
  pose(m, f) {
    if (!m.motion) return; const n = m.motion.frames;
    for (const [name, tr] of Object.entries(m.motion.bones)) { const b = m.bones[name]; if (!b) continue; const i = f % n; if (tr.q) b.quaternion.fromArray(tr.q[Math.min(i, tr.q.length - 1)]); if (tr.t) b.position.fromArray(tr.t[Math.min(i, tr.t.length - 1)]); }
  }
  update(dt) { this.t += dt; if (this.cur) this.pose(this.cur, Math.floor(this.t * 30)); }
}
