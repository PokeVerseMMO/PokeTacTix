// Audio bus: music + sfx + Pokémon cries (audio/music, audio/sfx, audio/cries). Browsers block audio until the first click.
const base = () => (window.__AUDIO_BASE ?? "");
const cache = new Map(), st = { music: null, musicName: null, unlocked: false };
const vol = { master: +(localStorage.volMaster ?? 0.7), music: +(localStorage.volMusic ?? 0.5), sfx: +(localStorage.volSfx ?? 0.8) };
const CRIES = new Set(); // ids that have a cry file (filled from /api/art listing)
const last = new Map();
function el(path) { let a = cache.get(path); if (!a) { a = new Audio(base() + "/audio/" + path + ".ogg"); a.preload = "auto"; cache.set(path, a); } return a; }
export const Audio2 = {
  vol, CRIES,
  setCries(files) { for (const f of files) if (f.startsWith("cries/")) CRIES.add(f.slice(6).replace(/\.ogg$/, "")); },
  unlock() { if (st.unlocked) return; st.unlocked = true; if (st.musicName) this.music(st.musicName, true); },
  save() { localStorage.volMaster = vol.master; localStorage.volMusic = vol.music; localStorage.volSfx = vol.sfx; if (st.music) st.music.volume = Math.min(1, vol.master * vol.music); },
  sfx(name, v = 1, gap = 0) {
    if (!st.unlocked) return; const now = performance.now(); if (gap && now - (last.get(name) ?? 0) < gap) return; last.set(name, now);
    const a = el("sfx/" + name).cloneNode(); a.volume = Math.min(1, vol.master * vol.sfx * v); a.play().catch(() => {});
  },
  cry(id, v = 0.8) {
    if (!st.unlocked || !CRIES.has(id)) return; const now = performance.now(); if (now - (last.get("cry") ?? 0) < 140) return; last.set("cry", now);
    const a = el("cries/" + id).cloneNode(); a.volume = Math.min(1, vol.master * vol.sfx * v); a.play().catch(() => {});
  },
  music(name, force = false) {
    if (st.musicName === name && !force && st.music && !st.music.paused) return; st.musicName = name;
    if (!st.unlocked) return;
    if (st.music) { const o = st.music; let k = 10; const f = setInterval(() => { o.volume = Math.max(0, o.volume * 0.7); if (--k <= 0 || o.volume < 0.01) { o.pause(); clearInterval(f); } }, 60); }
    const a = new Audio(base() + "/audio/music/" + name + ".ogg"); a.loop = !name.startsWith("victory") && name !== "too_bad"; a.volume = Math.min(1, vol.master * vol.music); a.play().catch(() => {}); st.music = a;
  },
  jingle(name, v = 0.9) { if (!st.unlocked) return; const a = new Audio(base() + "/audio/music/" + name + ".ogg"); a.volume = Math.min(1, vol.master * vol.sfx * v); a.play().catch(() => {}); },
  stopMusic() { st.musicName = null; if (st.music) { st.music.pause(); st.music = null; } },
};
fetch(base() + "/audio/manifest.json").then((r) => r.json()).then((m) => { for (const c of m.cries) CRIES.add(c); }).catch(() => {});
window.addEventListener("pointerdown", () => Audio2.unlock(), { once: true }); window.addEventListener("keydown", () => Audio2.unlock(), { once: true });
