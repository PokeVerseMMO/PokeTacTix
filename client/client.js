// PokéTactix client: menu, lobby, 3D battle screen (Three.js), mockup-style HUD, drag & drop, combat replay.
import { Scene3D } from "./scene.js";
import { initGallery, openGallery } from "./gallery.js";
import { Audio2 } from "./audio.js";
import { portrait, avatar, iconSvg, loadArtManifest, artPath, hash } from "./art.js";
import { Lobby3D } from "./lobby3d.js";
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
let avatars = new Map(), lastViewed = null, lastAvatarSent = 0, walkKeys = { l: 0, r: 0, u: 0, d: 0, jump: false }, joy = { ix: 0, iz: 0 }, scouting = null, xferFrom = null, roundTotal = 1, lastCombatRound = -1, lastCombat = null, dmgMode = "dealt", bagPick = null;
let DATA = null, ws = null, state = null, combat = null, spec = null, watchKey = "", scene = null, lastMode = "solo";
let timerBase = { left: 0, at: 0 }, selItem = null, selUid = null, drag = null, ptr = { x: 0, y: 0 }, hoverTip = null, phaseAt = 0, lastRound = -1, prev = { gold: null, shopSig: [], syn: {}, hp: {} };
const TIER_COLORS = ["#9aa3b8", "#59c27a", "#4aa3ff", "#b36bff", "#ffb23e"];
const RARITY_COLORS = { Rare: "#4aa3ff", Epic: "#b36bff", Legendary: "#ffb23e" };
const hexNum = (s) => parseInt(s.slice(1), 16);
const FACTIONS = ["JJK", "AOT", "CSM", "TG", "SAO"], ROLES = ["Fighter", "Assassin", "Ranger", "Caster", "Guardian", "Support"];
const thOf = (k) => DATA.synergies?.[k]?.thresholds || THRESH[k] || [2, 4];
const cryOf = (u) => { const f = formId(u), l = (defOf(u.id) || {}).evolutionLine || [u.id]; for (const k of [u.formArt, f, ...[...l].reverse(), u.id]) if (k && Audio2.CRIES.has(k)) return k; return u.id; };
const formId = (u) => { const l = (defOf(u.id) || {}).evolutionLine || [u.id]; return l[Math.min(u.stars - 1, l.length - 1)]; };
const nameOf = (u) => { const d = defOf(u.id), f = formId(u); return !d ? u.id : f === u.id ? d.name : prettyName(f); }; // evolved form name (Froakie -> Greninja)
const prettyName = (id) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const THRESH = { Fighter: [2, 4, 6], Guardian: [2, 4, 6], Caster: [2, 4, 6], Support: [2, 4, 6], Ranger: [2, 4, 6], Assassin: [2, 4, 6], JJK: [2, 4], CSM: [2, 4], SAO: [2, 4], AOT: [2, 4], TG: [2, 4] };

let stageScale = 1;
function fit() {
  // responsive anchors: the stage is the real window divided by one uniform scale, so edge-anchored HUD stays on its edge at any aspect ratio
  stageScale = Math.min(innerWidth / 1280, innerHeight / 720);
  const st = $("stage"); st.style.width = innerWidth / stageScale + "px"; st.style.height = innerHeight / stageScale + "px"; st.style.transform = `scale(${stageScale})`;
  scene && scene.resize();
}
addEventListener("resize", fit);
const show = (id) => { if (id === "menu") Audio2.music("title"); if (id === "over") Audio2.music("victory_trainer"); for (const s of document.querySelectorAll(".screen")) if (s.id !== "settingsPanel") s.classList.toggle("hidden", s.id !== id); };
const apiBase = () => {
  const v = $("server").value.trim();
  if (!v) return { http: location.origin, ws: location.origin.replace(/^http/, "ws") };
  const w = v.startsWith("ws") ? v : "ws://" + v;
  return { http: w.replace(/^ws/, "http"), ws: w };
};
const factionColor = (f) => { const c = DATA.rules.factionColors[f] || [200, 200, 200]; return `rgb(${c[0]},${c[1]},${c[2]})`; };
const fRGB = (f) => DATA.rules.factionColors[f] || [200, 200, 200];
const defOf = (id) => DATA.byId[id];
const itemList = (keys = []) => keys.map((k) => ({ color: hexNum(RARITY_COLORS[DATA.itemBy[k]?.rarity] || "#ffffff") }));

let lobby3d = null;
// ---------------- data + menu ----------------
async function loadData() {
  const base = apiBase().http;
  DATA = await (await fetch(base + "/data.json")).json();
  DATA.byId = Object.fromEntries([...DATA.roster, ...(DATA.enemies || [])].map((u) => [u.id, u]));
  DATA.itemBy = Object.fromEntries((DATA.items || []).map((i) => [i.key, i]));
  await loadArtManifest(base);
  const box = $("commanders"); box.innerHTML = "";
  for (const c of DATA.rules.commanders) {
    const d = document.createElement("div");
    d.className = "cmd" + (c.id === (localStorage.cmd || "Blue") ? " sel" : "");
    d.innerHTML = `<i class="cav" style="background-image:url(${avatarUrl({ commander: c.id, human: true })})"></i><div><b>${c.id}</b><span>${c.text}</span></div>`;
    d.onclick = () => { localStorage.cmd = c.id; for (const e of box.children) e.classList.remove("sel"); d.classList.add("sel"); setCommanderVisual(c.id); $("cmdPicker").classList.add("hidden"); };
    box.appendChild(d);
  }
  initGallery({ DATA, show, defOf, emb, ric, portraitOf, roleName, prettyName, TIER_COLORS, TIER_NAME, RARITY_COLORS });
  if (!scene) {
    scene = new Scene3D($("view"), localStorage.quality || "High"); scene.setNumberContainer($("numbers")); scene.onEvolve = (v) => { Audio2.sfx("egg_hatch", 0.9); setTimeout(() => { Audio2.jingle("evolved", 0.9); Audio2.cry(v.cryKey || v.id, 1); }, 1100); }; $("quality").value = scene.qname; fit();
    requestAnimationFrame(loop);
  }
  setCommanderVisual(localStorage.cmd || "Blue");
}
function setCommanderVisual(cid) {
  const cm = (DATA.rules.commanders || []).find((c) => c.id === cid); if ($("cmdInfo") && cm) $("cmdInfo").textContent = cm.text; if ($("heroName")) $("heroName").textContent = cid; if ($("lmAvatar")) $("lmAvatar").style.backgroundImage = `url(${avatarUrl({ commander: cid, human: true })})`;
  if (!lobby3d && $("heroCanvas")) { try { lobby3d = new Lobby3D($("heroCanvas")); } catch (e) { console.warn(e); } } lobby3d && lobby3d.show(cid.toLowerCase());
  const id = cid.toLowerCase(), d = defOf(id) || { role: "Caster", faction: "JJK", name: cid };
  scene && scene.setCommander(id, d, fRGB(d.faction));
}
$("name").value = localStorage.name || "Player";
$("helpBtn").onclick = () => $("helpPanel").classList.toggle("hidden");
const togglePicker = () => $("cmdPicker").classList.toggle("hidden");
$("heroPlate").onclick = togglePicker; $("navCollection").onclick = togglePicker; $("cmdPickerClose").onclick = () => $("cmdPicker").classList.add("hidden");
$("navGallery").onclick = () => openGallery("hero"); $("sideGallery").onclick = () => openGallery("hero"); $("navEncy").onclick = () => openGallery("encyclopedia");
$("modeBtn").onclick = () => $("modePanel").classList.toggle("hidden");
for (const v of ["Beginner", "Intermediate", "Hard"]) { const b = document.createElement("button"); b.className = "lm-btn"; b.textContent = v; b.onclick = () => { $("difficulty").value = v; $("modeTxt").textContent = `Practice · ${v}`; $("modePanel").classList.add("hidden"); }; $("diffBtns").appendChild(b); }
$("lbBtn").onclick = () => { $("menuMsg").textContent = "Leaderboards need an online server."; };
if (localStorage.server) $("server").value = localStorage.server;
if (qs.get("server")) $("server").value = qs.get("server");

function connect(mode) {
  lastMode = mode;
  localStorage.name = $("name").value; localStorage.server = $("server").value;
  $("menuMsg").textContent = "Connecting…";
  try { ws = new WebSocket(apiBase().ws); } catch (e) { $("menuMsg").textContent = "Bad server address."; return; }
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: "join", mode, name: $("name").value, commander: localStorage.cmd || "Blue", difficulty: $("difficulty").value }));
    show(mode === "solo" ? "match" : "lobby");
  };
  ws.onerror = () => { $("menuMsg").textContent = "Could not reach the server."; show("menu"); };
  ws.onclose = () => { if (!$("over").classList.contains("hidden")) return; if ($("menu").classList.contains("hidden")) { $("menuMsg").textContent = "Disconnected from the server."; show("menu"); state = null; combat = null; } };
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
}
$("solo").onclick = () => connect("solo");
$("online").onclick = () => connect("online");
$("again").onclick = () => leave();
function leave() { try { ws && ws.close(); } catch {} state = null; combat = null; selUid = null; $("settingsPanel").classList.add("hidden"); show("menu"); scene && scene.clearUnits(); }
$("server").addEventListener("change", loadData);
async function showRank() {
  const name = $("name").value.trim(); if (!name) return;
  try {
    const p = await (await fetch(apiBase().http + "/api/profile?name=" + encodeURIComponent(name))).json();
    if (p.tier) { $("rkName").textContent = p.label; $("rkRP").textContent = p.rp + " RP"; $("rkTitle").textContent = p.title; $("rkNote").textContent = `${p.matches} matches, ${p.wins} wins`; }
    $("rankBox").innerHTML = p.tier ? `Rank: <b>${p.label}</b> · ${p.rp} RP · ${p.title} · ${p.matches} matches, ${p.wins} wins (online matches are ranked)` : "";
  } catch { $("rankBox").textContent = ""; }
}
$("name").addEventListener("change", showRank); setTimeout(showRank, 300);
// settings
const openSettings = () => { $("settingsPanel").classList.remove("hidden"); $("leave").style.display = state ? "" : "none"; };
$("settings").onclick = openSettings; $("menuSettings").onclick = openSettings; $("settingsClose").onclick = () => $("settingsPanel").classList.add("hidden");
$("quality").onchange = () => { localStorage.quality = $("quality").value; if (!state) location.reload(); else $("msg").textContent = "Graphics change applies when you start the next match."; };
for (const [id, k] of [["volMaster", "master"], ["volMusic", "music"], ["volSfx", "sfx"]]) { $(id).value = Audio2.vol[k]; $(id).oninput = () => { Audio2.vol[k] = +$(id).value; Audio2.save(); Audio2.sfx("click"); }; }
$("fullscreen").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
$("leave").onclick = leave;

function onMessage(m) {
  if (m.t === "lobby") {
    show("lobby");
    $("lobbyList").innerHTML = m.players.map((p) => `${p.name} <small style="color:#a9b3d6">(${p.commander})</small>`).join("<br>") + `<br><br>${m.players.length} / 8`;
  } else if (m.t === "state") {
    if ($("match").classList.contains("hidden")) { show("match"); }
    const phaseChanged = !state || state.phase !== m.phase; if (phaseChanged) phaseAt = performance.now();
    state = m;
    timerBase = { left: m.timeLeft, at: performance.now() }; if (m.timeLeft > roundTotal || m.round !== lastCombatRound) { roundTotal = Math.max(1, m.timeLeft); lastCombatRound = m.round; }
    if (m.phase === "Preparation") { combat = null; Audio2.music("route101"); } else if (m.phase === "Supply") combat = null;
    setCommanderVisual(m.you.commander);
    refreshHud();
    if (m.phase === "Preparation" && m.round !== lastRound) { lastRound = m.round; banner(`Round ${m.round}`, m.npc ? (m.npc.boss ? `BOSS · ${m.npc.name}` : "Creep encounter") : "Preparation phase"); }
  } else if (m.t === "avatars") {
    avatars = new Map(m.list.map((a) => [a.seat, a]));
  } else if (m.t === "combat") {
    if (m.spectate !== undefined) spec = makeCombat(m, m.spectate); else startCombat(m);
  } else if (m.t === "over") {
    show("over");
    $("overTitle").textContent = m.placement === 1 ? "VICTORY — 1st place!" : `You placed #${m.placement}`;
    const r = m.rank;
    $("rankResult").innerHTML = r ? (r.ranked ? `Rank: <b>${r.label}</b> · ${r.rp} RP (${r.delta >= 0 ? "+" : ""}${r.delta})` : `Practice match — rank unchanged (${r.label}, ${r.rp} RP). Online matches are ranked.`) : "";
    $("standings").innerHTML = m.standings.map((s) => `<div class="${s.human ? "me" : ""}"><span>#${s.placement} ${s.name}</span><span>${s.commander}</span></div>`).join("");
    lastRound = -1;
  }
}
function banner(text, sub = "", cls = "") {
  const b = $("banner"); b.className = ""; void b.offsetWidth; b.innerHTML = (cls ? `<img src="${UI}banners/${cls === "win" ? "victory" : "defeat"}.png" alt="${text}">` : text) + (sub ? `<small>${sub}</small>` : ""); b.className = "show " + cls;
}

// ---------------- actions ----------------
const SFX_ACT = { buy: "shop", sell: "switch", reroll: "click", xp: "exp", equip: "use_item", unequip: "switch", lock: "unlock", ready: "select", move: "click", evolve: "success" };
const send = (action) => (Audio2.sfx(SFX_ACT[action.a] ?? "click", 0.8), 0) || ws && ws.readyState === 1 && ws.send(JSON.stringify({ t: "act", action }));
$("reroll").onclick = () => { const r = $("reroll"); r.classList.remove("spin"); void r.offsetWidth; r.classList.add("spin"); send({ a: "reroll" }); };
$("xp").onclick = () => send({ a: "xp" });
$("lock").onclick = () => send({ a: "lock" });
$("ready").onclick = () => send({ a: "ready" });
addEventListener("keydown", (e) => {
  if ($("match").classList.contains("hidden") || e.target.tagName === "INPUT") return;
  if (e.key === "r" || e.key === "R") send({ a: "reroll" }); // D is for walking (WASD)
  if (e.key === "f" || e.key === "F") send({ a: "xp" });
  if (e.key === "l" || e.key === "L") send({ a: "lock" });
  if (e.key === "Enter") send({ a: "ready" });
  if (e.key === "Escape" && cmdTarget) { cmdTarget = null; refreshCmd(); return; }
  if (e.key === "Escape" && scouting !== null) { scouting = null; refreshHud(); return; }
  if (e.key === "Escape") { selUid = null; selItem = null; renderInspector(); }
});

// ---------------- HUD ----------------
const UI = "art/ui/";
const COIN = `<img src="${UI}icons/gold.png" alt="">`;
const TIER_FRAME = (t) => `${UI}cards/tier_${Math.max(1, Math.min(5, t))}.png`;
const TIER_NAME = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const COMMANDER_TRAINER = { blue: "blue", joy: "joy", misty: "misty", brock: "brock", sabrina: "sabrina" };
const RIVAL_TRAINERS = ["lance", "erika", "ltsurge", "giovanni", "koga"];
const emb = (f) => { const ti = artPath("types", f); if (ti) return `<i class="emb ti" style="background-image:url(${ti})" title="${f}"></i>`; const c = DATA.rules.factionColors[f] || [150, 150, 150]; return `<i class="emb tb" style="--tc:rgb(${c[0]},${c[1]},${c[2]})" title="${f}">${f.slice(0, 2)}</i>`; };
const ROLE_LABEL = { Fighter: "Striker" }, roleName = (r) => ROLE_LABEL[r] || r;
const ric = (r) => `<i class="ric" style="background-image:url(${UI}roles/${r.toLowerCase()}.png)" title="${r}"></i>`;
const hasIcon = (k) => DATA.rules.factionColors[k] !== undefined;
function avatarUrl(p) {
  const t = COMMANDER_TRAINER[(p.commander || "").toLowerCase()] || RIVAL_TRAINERS[hash(p.name) % RIVAL_TRAINERS.length];
  return `art/trainers/${t}_head.png`;
}
function traitInfo(counts) {
  const rows = [];
  for (const [k, n] of Object.entries(counts)) {
    const th = thOf(k); const tier = th.filter((t) => n >= t).length;
    rows.push({ k, n, th, tier, active: tier > 0, next: th.find((t) => n < t) });
  }
  return rows.sort((a, b) => b.tier - a.tier || b.n - a.n);
}
function refreshHud() {
  if (!state) return;
  const y = state.you, prep = state.phase === "Preparation" && !y.eliminated, live = state.phase !== "Finished" && !y.eliminated;
  $("round").textContent = `Round ${state.round}` + (state.npc ? (state.npc.boss ? " · Boss" : " · Creeps") : "");
  $("phase").textContent = state.phase === "Preparation" ? "Preparation" : state.phase === "Supply" ? "Supply" : "Combat";
  $("level").textContent = y.level; $("fielded").textContent = `${y.units.filter((u) => u.col !== null).length}/${y.level}`;
  $("xpbar").style.width = y.level >= DATA.rules.maxLevel ? "100%" : `${(y.xp / Math.max(1, y.xpNeed)) * 100}%`;
  if (prev.gold !== null && prev.gold !== y.gold) { const g = $("goldChip"); g.classList.remove("pop"); void g.offsetWidth; g.classList.add("pop"); }
  prev.gold = y.gold; $("gold").textContent = y.gold;
  $("rerollCost").textContent = y.rerollCost; $("reroll").disabled = !live || y.shopLocked;
  $("xp").disabled = !live || y.level >= DATA.rules.maxLevel;
  $("lock").querySelector("span").innerHTML = y.shopLocked ? "&#128274;" : "&#128275;"; $("lock").classList.toggle("sel", y.shopLocked);
  $("lock").classList.toggle("goldr", y.shopLocked); $("lock").classList.toggle("dark", !y.shopLocked);
  $("ready").disabled = !prep || y.ready; $("ready").firstElementChild.textContent = y.ready ? "Waiting…" : "Ready";
  $("ready").classList.toggle("sel", !!y.ready);
  // shop
  const shop = $("shop"); shop.innerHTML = "";
  y.shop.forEach((id, slot) => {
    const d = id && defOf(id), el = document.createElement("div");
    if (!d) { el.className = "card empty"; shop.appendChild(el); prev.shopSig[slot] = null; return; }
    const same = prev.shopSig[slot] === id; prev.shopSig[slot] = id;
    const pi = (state.pool || {})[id], left = pi ? pi[0] : null, ratio = pi && pi[1] ? pi[0] / pi[1] : 1, heat = ratio <= 0.15 ? " scarce" : ratio <= 0.35 ? " hot" : "";
    el.className = "card t" + d.tier + (y.gold < d.tier ? " poor" : "") + heat;
    if (pi) el.title = `${pi[0]} of ${pi[1]} copies left in the shared pool · ${pi[2]} owned by players${heat ? " — heavily contested!" : ""}`;
    if (same) el.style.animation = "none"; else el.style.animationDelay = slot * 0.05 + "s";
    el.innerHTML = `<div class="pic" style="background-image:url(${artPath("portraits", id) || portrait(id, d, fRGB(d.faction))})"></div><div class="frame" style="background-image:url(${TIER_FRAME(d.tier)})"></div>${hasIcon(d.faction) ? emb(d.faction) : ""}${ric(d.role)}${pi ? `<div class="left">${heat ? "⚠ " : ""}${pi[0]}<small>/${pi[1]}</small></div>` : ""}<div class="nm">${d.name.split(" ")[0]}</div><div class="cost">${COIN}${d.tier}</div>`;
    el.onclick = () => {
      if (!live) return;
      if (y.gold < d.tier) { el.classList.remove("deny"); void el.offsetWidth; el.classList.add("deny"); $("goldChip").classList.add("nogold"); setTimeout(() => $("goldChip").classList.remove("nogold"), 320); return; }
      el.classList.add("bought"); send({ a: "buy", slot });
    };
    el.onmouseenter = () => (hoverTip = { id }); el.onmouseleave = () => (hoverTip = null);
    shop.appendChild(el);
  });
  // synergies: two columns (factions / roles), thresholds from THRESH, state from the server's trait counts
  { const fill = (grid, keys, icon) => { grid.innerHTML = "";
      for (const k of keys) {
        const n = y.traits[k] || 0, th = thOf(k), tier = th.filter((t) => n >= t).length, next = th.find((t) => n < t) ?? th[th.length - 1];
        const el = document.createElement("div"); el.className = "sc" + (tier > 0 ? " active" : "");
        el.innerHTML = `${icon(k)}<div><div class="nm">${roleName(k)}</div><div class="cnt"><b>${n}</b>/${next}</div></div>`;
        if (tier > (prev.syn[k] || 0)) { el.classList.add("flash"); } prev.syn[k] = tier;
        el.onclick = () => showSynDetail(k, icon); // details open on click, no hover tooltip
        grid.appendChild(el);
      } };
    const have = (k) => (y.traits[k] || 0) > 0, rank = (a, b) => { const ta = thOf(a).filter((t) => y.traits[a] >= t).length, tb = thOf(b).filter((t) => y.traits[b] >= t).length; return tb - ta || y.traits[b] - y.traits[a]; };
    fill($("facGrid"), DATA.rules.factions.filter(have).sort(rank), emb); fill($("roleGrid"), ROLES.filter(have).sort(rank), ric);
    $("synEmpty").classList.toggle("hidden", Object.values(y.traits || {}).some((n) => n > 0)); }
  // standings
  const st = $("standings2"); st.innerHTML = "";
  const order = [...state.players].sort((a, b) => (a.eliminated - b.eliminated) || b.hp - a.hp || a.seat - b.seat); // highest HP first, you included
  for (const p of order) {
    const el = document.createElement("div"), pct = Math.max(0, Math.min(100, (p.hp / DATA.rules.startHealth) * 100));
    el.className = "pl" + (p.seat === state.seat ? " me" : "") + (p.eliminated ? " dead" : "");
    el.innerHTML = `<span class="av" style="background-image:url(${avatarUrl(p)})"></span><span class="nm">${p.name}</span><span class="hp">${Math.max(0, p.hp)}${p.shield ? `<small class="shd" title="Commander shield">🛡${p.shield}</small>` : ""}</span><div class="bar"><i style="width:${pct}%;background-size:${pct > 0 ? 10000 / pct : 100}% 100%"></i></div>`;
    if (p.seat !== state.seat && !p.eliminated) { el.classList.add("scoutable"); el.title = "Click to scout this board"; el.onclick = () => { scouting = scouting === p.seat ? null : p.seat; selUid = null; renderInspector(); refreshHud(); }; }
    if (scouting === p.seat) el.classList.add("scouted");
    if (prev.hp[p.seat] !== undefined && p.hp < prev.hp[p.seat]) { el.classList.add("hit"); }
    prev.hp[p.seat] = p.hp;
    st.appendChild(el);
  }
  { const c = $("xpCost"); if (c) { c.textContent = DATA.rules.xpBuyGold ?? 1; $("xp").title = `Buy ${DATA.rules.xpBuyAmount ?? 1} XP (F)`; } }
  renderBag(); renderInspector();
  $("msg").textContent = state.message || (state.phase === "Preparation" && y.reward ? y.reward : "") || (y.eliminated ? "You were eliminated — waiting for the match to end." : "");
}
function renderBag() {
  const y = state.you, bag = $("bag"); bag.innerHTML = "";
  if (selItem && !y.items.includes(selItem)) selItem = null;
  if (!y.items.length) { bag.innerHTML = '<span class="hint">Equipment drops from creep and boss rounds.</span>'; return; }
  for (const key of y.items) {
    const it = DATA.itemBy[key]; if (!it) continue;
    const el = document.createElement("span");
    el.className = "item" + (key === selItem ? " sel" : ""); el.style.borderColor = RARITY_COLORS[it.rarity] || "#888"; el.innerHTML = (it.icon ? `<img src="${it.icon}" alt="">` : "") + `<span>${it.id}</span>`;
    el.onclick = () => { if (it.stone) { const su = state.you.units.find((x) => x.uid === selUid); if (su && defOf(su.id).stoneEvolutions?.[key]) send({ a: "evolve", uid: su.uid, stone: key }); return; } selItem = selItem === key ? null : key; renderBag(); };
    el.onmouseenter = () => (hoverTip = { text: `<b style="color:${RARITY_COLORS[it.rarity]}">${it.id}</b> · ${it.rarity}<br>${it.text}<br><i>${it.stone ? "Select an Eevee, then click this stone." : "Click, then click a fighter."}</i>` }); el.onmouseleave = () => (hoverTip = null);
    bag.appendChild(el);
  }
}
function renderInspector() {
  const box = $("inspector"), u = state && selUid != null ? state.you.units.find((x) => x.uid === selUid) : null;
  if (!u || (state.phase !== "Preparation" && u.col !== null)) { box.classList.add("closed"); document.body.classList.remove("inspecting"); return; }
  const d = defOf(u.id), S = 1.8 ** (u.stars - 1), rc = TIER_COLORS[d.tier - 1];
  // dock on the side that keeps the selected fighter visible
  const sp = u.col !== null && scene ? scene.cellScreen({ col: u.col, row: u.row }) : null;
  if (sp) { const ux = sp.x / stageScale, W = innerWidth / stageScale, L = [262, 702], Rr = [W - 708, W - 268]; const hit = (r) => ux > r[0] - 40 && ux < r[1] + 40; box.classList.toggle("dockL", hit(Rr) && !hit(L) ? true : hit(L) && !hit(Rr) ? false : ux > W / 2); }
  box.classList.remove("closed"); document.body.classList.add("inspecting"); hoverTip = null;
  box.style.setProperty("--rc", rc); box.style.setProperty("--fc", factionColor(d.faction));
  const stat = (img, lab, v) => `<span title="${lab}"><img src="${UI}icons/${img}.png" alt="${lab}"><b>${v}</b></span>`;
  const slots = [0, 1, 2].map((i) => { const k = u.items[i], it = k && DATA.itemBy[k]; return it ? `<div class="slot fill" style="border-color:${RARITY_COLORS[it.rarity] || "#888"}" title="${it.id}: ${it.text} (click to unequip)" data-i="${i}">${it.icon ? `<img src="${it.icon}" alt="${it.id}">` : it.id.slice(0, 6)}</div>` : `<div class="slot" title="Empty equipment slot"></div>`; }).join("");
  box.innerHTML = `<button class="x" title="Close">✕</button><div class="top"><div class="pt" style="background-image:url(${artPath("portraits", formId(u)) || artPath("portraits", u.id) || portrait(u.id, d, fRGB(d.faction))})"><div class="st">${"★".repeat(u.stars)}</div></div>
  <div><h4>${formId(u) === u.id ? d.name : prettyName(formId(u))}<small>${TIER_NAME[d.tier - 1]} · Tier ${d.tier}</small></h4>
  <div class="tags">${(d.types || [d.faction]).map((t) => `<span>${emb(t)}${t}</span>`).join("")}<span>${ric(d.role)}${roleName(d.role)}</span></div>
  <div class="stats">${stat("health", "Health", Math.round(d.health * S))}${stat("attack", "Attack", Math.round(d.attack * S))}${stat("defense", "Armor", d.armor)}${stat("mr", "Magic resist", d.mr)}${stat("mp", "Mana (start / max)", d.maxMana ? `${d.startMana || 0}/${d.maxMana}` : "–")}${stat("attack_speed", "Attack speed", d.speed.toFixed(2))}${stat("range", "Range", d.range)}</div></div></div>
  <div class="abil">${abilityImg(u.id, d, "ico")}<div><b>${d.ability}</b><br>${d.description}</div></div>
  ${d.stoneEvolutions ? `<div class="evo">${Object.entries(d.stoneEvolutions).filter(([k]) => y.items.includes(k)).map(([k, t]) => `<button class="wbtn" data-stone="${k}"><span>${DATA.itemBy[k]?.id || k} → ${prettyName(t)}</span></button>`).join("") || '<i>Eevee evolves with an Evolution Stone (dropped by creep/boss wins).</i>'}</div>` : ""}
  ${u.blessing ? `<div class="bless">✦ Blessing: ${emb(u.blessing)} <b>+1 ${u.blessing}</b></div>` : ""}
  <div class="foot"><div class="slots">${slots}</div><button class="wbtn red sell"><span>Sell</span><em>${COIN}${sellValue(d, u)}</em></button></div>`;
  box.querySelector(".x").onclick = () => { selUid = null; renderInspector(); };
  box.querySelector(".sell").onclick = () => { send({ a: "sell", uid: u.uid }); selUid = null; renderInspector(); };
  for (const b of box.querySelectorAll("[data-stone]")) b.onclick = () => send({ a: "evolve", uid: u.uid, stone: b.dataset.stone });
  for (const sl of box.querySelectorAll(".slot.fill")) sl.onclick = () => send({ a: "unequip", uid: u.uid, index: Number(sl.dataset.i) });
}
// ability art: client/art/ui/abilities/<fighter_id>.png (opaque square tiles); falls back to the role icon when a unit has none (creeps/bosses)
const ABIL_BAD = new Set();
const abilityImg = (id, d, cls) => ABIL_BAD.has(id) || !(DATA.abilityIcons || []).includes(id) ? ric(d.role) : `<img class="${cls}" src="${UI}abilities/${id}.png" alt="${d.ability}" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'ric'}))">`;
const sellValue = (d, u) => d.tier * 3 ** (u.stars - 1);

// ---------------- combat replay ----------------
function makeCombat(m, spectate) {
  const units = {};
  for (const u of m.start) { const d = defOf(u.id); units[u.uid] = { ...u, formArt: null, maxHp: u.hp, alive: true, tc: u.col, tr: u.row, mana: u.mana ?? 0, maxMana: u.maxMana ?? 0 }; }
  const c = { m, units, idx: 0, t0: performance.now() - (m.elapsed || 0) * 1000, done: false, banner: false, stats: {}, spectate };
  if (spectate !== undefined && m.elapsed > 1) stepCombat(performance.now(), c, true); // late joiner: catch up silently
  return c;
}
// the battle on screen: mine, or (while scouting) the scouted player's live battle
function viewCombat() { if (!state || state.phase !== "Combat") return null; return scouting === null ? combat : (spec && spec.spectate === scouting ? spec : null); }
function startCombat(m) {
  Audio2.music(m.npc ? (/Mewtwo|Rayquaza/.test(m.vs || "") ? "vs_rayquaza" : "vs_wild") : "vs_trainer");
  combat = makeCombat(m); lastCombat = combat;
  selUid = null; renderInspector(); phaseAt = performance.now();
}
function stepCombat(now, c, silent) {
  if (silent) { const sv = [scene.fxEvent, Audio2.sfx, Audio2.cry, Audio2.music]; scene.fxEvent = () => {}; Audio2.sfx = () => {}; Audio2.cry = () => {}; Audio2.music = () => {}; try { return stepCombat2(now, c, true); } finally { [scene.fxEvent, Audio2.sfx, Audio2.cry, Audio2.music] = sv; } }
  return stepCombat2(now, c, false);
}
function stepCombat2(now, c, silent) {
  const t = (now - c.t0) / 1000 - 0.9;
  while (c.idx < c.m.events.length && c.m.events[c.idx].t <= t) {
    const e = c.m.events[c.idx++], u = c.units[e.u], tg = e.tg && c.units[e.tg], K = (id) => "c" + id;
    if (e.k === "move") { u.tc = e.col; u.tr = e.row; }
    else if (e.k === "atk") { if (u) Audio2.sfx("click", 0.25, 120); scene.fxEvent("atk", K(e.u), K(e.tg)); }
    else if (e.k === "dmg") { const S = (id) => (c.stats[id] ||= { dealt: 0, taken: 0, heal: 0 }); S(e.u).dealt += e.v; S(e.tg).taken += e.v; Audio2.sfx(e.crit ? "super_effective" : "effective", e.crit ? 0.8 : 0.45, 90); tg.hp = Math.max(0, tg.hp - e.v); scene.fxEvent("dmg", K(e.u), K(e.tg), { v: e.v, crit: e.crit, magic: e.name === "magic" }); }
    else if (e.k === "mana") u.mana = e.v;
    else if (e.k === "heal") { (c.stats[e.u] ||= { dealt: 0, taken: 0, heal: 0 }).heal += e.v; Audio2.sfx("eb_heal", 0.5, 200); tg.hp = Math.min(tg.maxHp, tg.hp + e.v); scene.fxEvent("heal", K(e.u), K(e.tg), { v: e.v }); }
    else if (e.k === "shield") scene.fxEvent("shield", K(e.u), K(e.tg));
    else if (e.k === "die") { Audio2.sfx("faint", 0.7, 100); u.alive = false; scene.fxEvent("die", K(e.u)); }
    else if (e.k === "cast") { if (u) Audio2.cry(cryOf(u), 0.7); scene.fxEvent("cast", K(e.u), e.tg ? K(e.tg) : undefined, { name: e.name }); }
    else if (e.k === "form") { if (e.name === "mega") { Audio2.sfx("mega_flash", 1); setTimeout(() => Audio2.sfx("mega_refresh", 0.9), 350); Audio2.cry(cryOf(u), 1); } else if (e.x === 1) { Audio2.sfx("mega_harden", 1); Audio2.cry(cryOf(u), 1); } u.formArt = e.art || null; if (e.v) { if (e.v > u.maxHp) u.hp += e.v - u.maxHp; u.maxHp = e.v; u.hp = Math.min(u.hp, u.maxHp); } scene.fxEvent(e.name === "mega" ? "mega" : e.name === "gmax" ? "gmax" : "buff", K(e.u), undefined, { name: "control", on: e.x === 1 }); }
    else if (e.k === "status") { if (e.on) Audio2.sfx({ burn: "eb_burn", poison: "eb_poison", paralysis: "eb_paralysis", freeze: "eb_frozen", sleep: "eb_sleep", confusion: "eb_confused", slow: "eb_stat_down", flinch: "bang" }[e.name] ?? "eb_stat_down", 0.6, 150); scene.fxEvent("status", K(e.u), undefined, { name: e.name, on: e.on }); }
    else if (e.k === "weather") scene.fxEvent("weather", undefined, undefined, { name: e.name });
    else if (e.k === "buff") scene.fxEvent("buff", K(e.u), undefined, { name: e.name });
  }
  if (!c.done && t > c.m.duration + 0.5) {
    c.done = true; if (silent) return; scene.setWeatherFx("none"); if (c.spectate !== undefined) return; const won = c.m.winner === c.m.you, drew = c.m.winner === -1;
    Audio2.music(won ? "victory_trainer" : "too_bad"); banner(drew ? "DRAW" : won ? "VICTORY" : "DEFEAT", c.m.npc ? c.m.vs : `vs ${c.m.vs}`, drew ? "" : won ? "win" : "lose"); if (!won && !drew) scene.shake(0.3);
  }
}

// ---------------- scene sync + frame loop ----------------
const MENU_SHOW = [["charmander", 2, 3], ["squirtle", 3, 3], ["pikachu", 4, 3], ["eevee", 3, 2], ["gastly", 4, 2]];
function buildList(now) {
  const inMatch = state && !$("match").classList.contains("hidden");
  if (!inMatch) {
    if (!DATA) return [];
    return MENU_SHOW.map(([id, col, row]) => { const d = defOf(id); return { key: "m" + id, id, def: d, fcolor: fRGB(d.faction), stars: 1 + (col % 3), cell: { col, row }, hp: 1 }; });
  }
  const list = [], fresh = now - phaseAt < 450;
  const cv = viewCombat();
  if (state.phase === "Combat" && scouting !== null && !cv) return []; // waiting for the scouted player's battle to arrive
  if (cv) {
    const c0 = cv, flip = cv.m.you === 1;
    for (const u of Object.values(cv.units)) {
      const d = defOf(u.id);
      list.push({ key: "c" + u.uid, id: u.id, art: u.formArt || formId(u), def: u.npc ? { ...d, npc: true, boss: !!u.boss } : d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), cell: { col: u.tc, row: u.tr }, flip, mine: u.side === c0.m.you, hp: u.hp / u.maxHp, mana: u.maxMana ? u.mana / u.maxMana : 0, showMana: u.maxMana > 0, noPop: true, noEvo: true, instant: false, hidden: false, world: null });
    }
    if (!cv.spectate) { const bn = state.you.units.filter((u) => u.col === null); bn.forEach((u, i) => { const d = defOf(u.id); list.push({ key: "u" + u.uid, id: u.id, art: formId(u), def: d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), hp: 1, mine: true, selected: u.uid === selUid, spawnFx: false, noPop: true, cell: { bench: i } }); }); } // bench stays visible (and sellable) during battle
    return list;
  }
  if (scouting !== null) { // view-only scouting of another player's board
    const o = state.players.find((q) => q.seat === scouting), ob = o && o.board ? o.board : [], benchO = ob.filter((u) => u.col === null);
    return ob.map((u) => ({ key: "u" + u.uid, id: u.id, art: formId(u), def: defOf(u.id), fcolor: fRGB(defOf(u.id).faction), stars: u.stars, items: itemList(u.items), hp: 1, mine: false, spawnFx: false, noPop: true, cell: u.col !== null ? { col: u.col, row: u.row } : { bench: benchO.indexOf(u) } }));
  }
  const y = state.you, bench = y.units.filter((u) => u.col === null);
  if (state.phase === "Preparation" && state.opponent != null) { // next opponent's backrow (bench) along the far edge
    const o = state.players.find((q) => q.seat === state.opponent && !q.eliminated), ob = o && o.board ? o.board.filter((u) => u.col === null) : [];
    ob.forEach((u, i) => { const w = scene.worldOf({ bench: i }, false), d = defOf(u.id); if (!d) return;
      list.push({ key: "o" + u.uid + "_" + o.seat, id: u.id, art: formId(u), def: d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), hp: 1, mine: false, spawnFx: false, noPop: true, world: { x: 1.2 - w.x, z: -w.z + 0.5, y: w.y } }); });
  }
  for (const u of y.units) {
    const d = defOf(u.id), isDrag = drag && drag.moved && drag.uid === u.uid;
    const e = { key: "u" + u.uid, id: u.id, art: formId(u), def: d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), hp: 1, mine: true, selected: u.uid === selUid, spawnFx: !fresh, noPop: fresh };
    if (isDrag) { const p = scene.groundPoint(ptr.x, ptr.y, 0.9); if (p) { e.world = { x: p.x, z: p.z, y: 0.9 }; e.instant = true; } else e.cell = { col: u.col ?? 0, row: u.row ?? 0 }; }
    else e.cell = u.col !== null ? { col: u.col, row: u.row } : { bench: bench.indexOf(u) };
    list.push(e);
  }
  return list;
}
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
const KEYMAP = { ArrowLeft: "l", a: "l", A: "l", ArrowRight: "r", d: "r", D: "r", ArrowUp: "u", w: "u", W: "u", ArrowDown: "d", s: "d", S: "d" };
addEventListener("keydown", (e) => { if (typing(e) || !state || $("match").classList.contains("hidden")) return; const k = KEYMAP[e.key]; if (k) { walkKeys[k] = 1; e.preventDefault(); } if (e.key === " " || e.code === "Space") { walkKeys.jump = true; e.preventDefault(); } });
addEventListener("keyup", (e) => { const k = KEYMAP[e.key]; if (k) walkKeys[k] = 0; if (e.key === " " || e.code === "Space") walkKeys.jump = false; });
addEventListener("blur", () => { walkKeys = { l: 0, r: 0, u: 0, d: 0, jump: false }; });
// viewed island: my own, or the opponent being scouted; trainers standing there are drawn (visitors included)
function updateWalkers(now) {
  const mySeat = state.seat, viewed = scouting !== null ? scouting : mySeat;
  if (viewed !== lastViewed) { // entering / leaving another island moves my trainer there (and back home on return)
    if (lastViewed === null || lastViewed === mySeat) homePose = scene.localPose() || homePose;
    if (viewed === mySeat) { if (homePose) scene.teleportLocal(homePose.x, homePose.z, homePose.yaw); } else scene.teleportLocal(-9.2, 7.7 - 0.0, 1.25);
    lastViewed = viewed;
  }
  let ix = (walkKeys.r - walkKeys.l) + joy.ix, iz = (walkKeys.d - walkKeys.u) + joy.iz; const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
  scene.setInput(ix, iz, walkKeys.jump || joy.jump);
  const list = [];
  for (const q of state.players) {
    if (q.seat === mySeat || q.eliminated) continue; const a = avatars.get(q.seat);
    if (a ? a.island === viewed : q.seat === viewed) list.push({ key: "p" + q.seat, cmd: (q.commander || "Blue").toLowerCase(), x: a ? a.x : -9.2, y: a ? a.y : 0.95, z: a ? a.z : 7.7, yaw: a ? a.yaw : 1.25, mv: a ? a.mv : 0 });
  }
  { const opp = state.opponent != null && viewed === mySeat && state.phase === "Preparation" ? state.players.find((q) => q.seat === state.opponent && !q.eliminated) : null; // next opponent stands on their podium across the board
    scene.showOppPodium(!!opp);
    if (opp) list.push({ key: "opp" + opp.seat, cmd: (opp.commander || "Blue").toLowerCase(), x: 9.2, y: 0.95, z: -7.7, yaw: 1.25 + Math.PI, mv: 0 }); }
  scene.setRemote(list);
  const lp = scene.localPose();
  if (lp && now - lastAvatarSent > 100 && ws && ws.readyState === 1) { lastAvatarSent = now; ws.send(JSON.stringify({ t: "avatar", island: viewed, x: lp.x, y: lp.y, z: lp.z, yaw: lp.yaw, mv: lp.mv })); }
}
let homePose = null;
function loop(now) {
  requestAnimationFrame(loop);
  if (!scene) return;
  const inMatch = state && !$("match").classList.contains("hidden");
  if (inMatch && state.players) updateWalkers(now);
  if (inMatch && state.phase === "Combat") { const cv = viewCombat(); if (combat && combat !== cv) stepCombat(now, combat, true); if (spec && spec !== cv) stepCombat(now, spec, true); if (cv) stepCombat(now, cv, false); }
  scene.sync(buildList(now));
  const dragging = drag && drag.moved;
  const placing = !dragging && inMatch && state.phase === "Preparation" && selUid != null && document.elementFromPoint(ptr.x, ptr.y) === view; // click-to-place preview
  const hc = dragging ? drag.hoverCell : placing ? scene.pickCell(ptr.x, ptr.y, false) : null, hb = dragging ? drag.hoverBench : placing ? scene.pickBench(ptr.x, ptr.y) : null;
  scene.setGrid({ mode: inMatch && viewCombat() ? "combat" : dragging || placing ? "drag" : inMatch ? "prep" : "combat", hoverCell: hc, hoverBench: hb });
  scene.frame();
  if (inMatch) { renderDmg(); renderBagPanel(); renderRoundStrip(); renderPick(); renderBless(); renderSupply(); renderCards(); renderCardStack(); renderCmdSkill(); renderScout(); if (synOpen) renderSynDetail(); }
  if (inMatch) {
    if (state.phase === "Preparation" || state.phase === "Supply") { const left = Math.max(0, timerBase.left - (now - timerBase.at) / 1000); $("timer").textContent = Math.ceil(left); { const w = Math.min(100, (left / roundTotal) * 100) + "%"; $("tFill").style.width = w; $("tFill2").style.width = w; } $("timerWrap").classList.toggle("urgent", left <= 5 && left > 0); }
    else $("timer").textContent = combat ? (combat.done ? "✓" : "⚔") : "…";
    $("sellZone").classList.toggle("hidden", !dragging);
  }
  updateTip();
}

// ---------------- pointer interaction ----------------
const view = $("view");
const uidOfVisual = (v) => (v && v.key.startsWith("u") ? Number(v.key.slice(1)) : null);
view.addEventListener("pointerdown", (e) => {
  ptr = { x: e.clientX, y: e.clientY };
  if (e.button !== 0 || !state || state.you.eliminated || scouting !== null) return;
  const uid = uidOfVisual(scene.pickUnit(e.clientX, e.clientY));
  if (state.phase !== "Preparation") { // mid-battle: only bench Pokémon can be picked up (to sell them)
    const bu = uid != null && state.you.units.find((x) => x.uid === uid && x.col === null);
    if (bu) drag = { uid, sx: e.clientX, sy: e.clientY, moved: false };
    return;
  }
  if (cmdTarget) { // commander skill targeting
    if (cmdTarget === "unit" && uid != null) { send({ a: "cmd", uid }); cmdTarget = null; refreshCmd(); return; }
    if (cmdTarget === "cell") { const cell = scene.pickCell(e.clientX, e.clientY, false); if (cell && cell.row < 4) { send({ a: "cmd", col: cell.col, row: cell.row }); cmdTarget = null; refreshCmd(); return; } }
    if (uid == null) { cmdTarget = null; refreshCmd(); }
    return;
  }
  if (uid != null && selItem) { send({ a: "equip", uid, item: selItem }); selItem = null; return; }
  if (uid != null && selUid != null && uid !== selUid && !selItem) { // click-to-place: a selected fighter swaps with the fighter you click on the board
    const other = state.you.units.find((x) => x.uid === uid);
    if (other && other.col !== null) { send({ a: "move", uid: selUid, col: other.col, row: other.row }); selUid = null; renderInspector(); return; }
  }
  if (uid != null) drag = { uid, sx: e.clientX, sy: e.clientY, moved: false };
  else if (selUid != null && placeSelected(e.clientX, e.clientY)) return;
  else { selUid = null; renderInspector(); }
});
// click-to-place: select a fighter (click it), then click a free hex or the bench instead of dragging
function placeSelected(cx, cy) {
  const cell = scene.pickCell(cx, cy, false);
  if (cell && cell.row < 4) { send({ a: "move", uid: selUid, col: cell.col, row: cell.row }); selUid = null; renderInspector(); return true; }
  if (scene.pickBench(cx, cy) !== null) { send({ a: "move", uid: selUid, col: null, row: null }); selUid = null; renderInspector(); return true; }
  return false;
}
addEventListener("pointermove", (e) => {
  ptr = { x: e.clientX, y: e.clientY };
  if (drag) {
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 7) { drag.moved = true; selUid = null; renderInspector(); }
    if (drag.moved) { drag.hoverCell = scene.pickCell(e.clientX, e.clientY, false); const hb = scene.pickBench(e.clientX, e.clientY); drag.hoverBench = hb; }
    return;
  }
  if (!state) return;
  if (e.target === view) { const v = scene.pickUnit(e.clientX, e.clientY); hoverTip = v && v.id ? { id: v.id, key: v.key } : null; }
});
addEventListener("pointerup", (e) => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) { selUid = selUid === d.uid ? null : d.uid; renderInspector(); return; }
  const overSell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("#sellZone");
  if (overSell) return send({ a: "sell", uid: d.uid });
  if (state.phase !== "Preparation") return;
  const cell = scene.pickCell(e.clientX, e.clientY, false);
  if (cell && cell.row < 4) return send({ a: "move", uid: d.uid, col: cell.col, row: cell.row });
  if (scene.pickBench(e.clientX, e.clientY) !== null) return send({ a: "move", uid: d.uid, col: null, row: null });
});
view.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!state || state.phase !== "Preparation") return;
  const uid = uidOfVisual(scene.pickUnit(e.clientX, e.clientY)); const u = uid != null && state.you.units.find((x) => x.uid === uid);
  if (u && u.items.length) send({ a: "unequip", uid, index: u.items.length - 1 });
});
function updateTip() {
  const tip = $("tip");
  if (!hoverTip || drag?.moved) { tip.classList.add("hidden"); return; }
  let html = hoverTip.text;
  if (!html) {
    const d = defOf(hoverTip.id); if (!d) { tip.classList.add("hidden"); return; }
    html = `<div style="display:flex;gap:10px"><div>${abilityImg(hoverTip.id, d, "tipico")}</div><div><b style="color:#ffd678;font-size:15px">${d.name}</b> <span style="color:${factionColor(d.faction)}">${d.faction}</span> · ${d.role} · Tier ${d.tier}<br>HP ${d.health} · ATK ${d.attack} · Range ${d.range}<br><b style="color:#ffe896">${d.ability}</b><br>${d.description}</div></div>`;
  }
  if (tip._html !== html) { tip.innerHTML = html; tip._html = html; }
  tip.classList.remove("hidden");
  const sc = stageScale, W = innerWidth / sc, H = innerHeight / sc;
  const tw = tip.offsetWidth || 300, th = tip.offsetHeight || 120;
  tip.style.left = Math.max(8, Math.min(W - tw - 8, ptr.x / sc + 16)) + "px"; tip.style.top = Math.max(8, Math.min(H - th - 8, ptr.y / sc - th - 12)) + "px";
}

Object.defineProperty(window, "__scene", { get: () => scene });
window.__ui = { send: (a) => send(a), info: () => ({ calls: scene.renderer.info.render.calls, tris: scene.renderer.info.render.triangles, geos: scene.renderer.info.memory.geometries, tex: scene.renderer.info.memory.textures }), banner, ids: () => DATA.roster.map((u) => u.id), refresh: () => refreshHud(), at: (uid) => { const v = scene.units.get("u" + uid); return v && scene.screenOf(v.worldPos(0.8)); }, cell: (c, lift) => scene.cellScreen(c, lift), get state() { return state; }, get combat() { return combat; } };
loadData().then(fit).catch((e) => { console.error(e); $("menuMsg").textContent = "Cannot reach the game server."; });
fit();


// ---------------- left panels: damage meter and bag (heroes + their items) ----------------
const portraitOf = (id, u) => { const d = defOf(id) || {}; return artPath("portraits", u ? formId(u) : id) || artPath("portraits", id) || portrait(id, d, fRGB(d.faction)); };
function renderRoundStrip() {
  if (!state || !DATA) return; const iv = DATA.rules.npcInterval || 3, r = state.round;
  const sig = r + "|" + iv; const el = $("rIcons"); if (el._sig === sig) return; el._sig = sig;
  { const L = DATA.rules.stageLen || 6, T = DATA.rules.dmgTable || {}, R = ["I", "II", "III", "IV", "V"], row = T[R[Math.min(4, Math.floor((Math.max(1, r) - 1) / L))]] || [3], base = row[Math.min(5, (Math.max(1, r) - 1) % L)] ?? row[row.length - 1], st = R[Math.min(4, Math.floor((Math.max(1, r) - 1) / L))] + "-" + (((Math.max(1, r) - 1) % L) + 1);
    $("rDmg").innerHTML = `<b>${st}</b> · lose = <i>${base}</i> + enemy ★`; $("rDmg").title = `If you lose this round your commander takes ${base} base damage plus the star levels of every enemy unit still standing (a 2★ counts 2). A draw damages both players.`; }
  el.innerHTML = [0, 1, 2, 3, 4].map((k) => { const n = r + k, npc = n > 0 && n % iv === 0, boss = npc && Math.floor(n / iv) % 2 === 0;
    return `<div class="ri ${k === 0 ? "cur " : ""}${boss ? "boss" : npc ? "creep" : ""}" title="${boss ? "Boss" : npc ? "Creep encounter" : "Player battle"} · round ${n}">${boss ? `<img src="art/ui/toolbar/equipment.png" alt="">` : npc ? "<span>🐾</span>" : `<img src="art/ui/toolbar/combat.png" alt="">`}<small>${n}</small></div>`; }).join("");
}
let synOpen = null;
function showSynDetail(k, icon) {
  const el = $("synDetail"); if (synOpen === k) { synOpen = null; el.classList.add("hidden"); return; } synOpen = k; el._icon = icon; renderSynDetail();
}
function renderSynDetail() {
  const el = $("synDetail"), k = synOpen; if (!k || !state) return; const y = state.you, n = y.traits[k] || 0, th = thOf(k), isRole = ROLES.includes(k);
  const members = DATA.roster.filter((d) => (isRole ? d.role === k : d.faction === k)).sort((a, b) => a.tier - b.tier);
  const owned = new Set(y.units.map((u) => (defOf(u.id)?.evolutionLine || [u.id])[0]));
  el.classList.remove("hidden");
  el.innerHTML = `<div class="hd">${isRole ? ric(k) : emb(k)}<span>${roleName(k)}</span><button title="Close">✕</button></div><div class="ds">${DATA.rules.traitDescriptions[k] || ""}</div>`
    + `<div class="th">${th.map((t) => `<div class="${n >= t ? "on" : ""}">[${t}] ${n >= t ? "✓ active" : n + "/" + t}</div>`).join("")}</div>`
    + `<div class="mem">${members.map((d) => `<div class="${owned.has((d.evolutionLine || [d.id])[0]) ? "own" : ""}" title="${d.name}" style="background-image:url(${artPath("portraits", d.id) || portrait(d.id, d, fRGB(d.faction))})"><b>${d.tier}</b></div>`).join("")}</div>`;
  el.querySelector("button").onclick = () => { synOpen = null; el.classList.add("hidden"); };
}
function renderPick() {
  const el = $("pickPanel"), o = state && state.phase === "Preparation" ? state.you.picks : null;
  if (!o) { if (!el.classList.contains("hidden")) { el.classList.add("hidden"); el._sig = ""; } return; }
  const sig = o.join(",") + state.you.picksLeft; if (el._sig === sig) return; el._sig = sig; el.classList.remove("hidden");
  el.innerHTML = `<div class="cap">Please select</div>${state.you.picksLeft > 1 ? `<span class="more">${state.you.picksLeft - 1} more to choose after this</span>` : ""}` + o.map((k) => { const it = DATA.itemBy[k]; if (!it) return ""; const c = RARITY_COLORS[it.rarity] || "#e9c46a"; return `<div class="opt" data-k="${k}"><div class="ic" style="--rc:${c}">${it.icon ? `<img src="${it.icon}" alt="">` : ""}</div><div><b>${it.id}</b><span>${it.text}</span></div></div>`; }).join("");
  for (const b of el.querySelectorAll(".opt")) b.onclick = () => { send({ a: "pick", item: b.dataset.k }); };
}
function renderBless() {
  const el = $("blessPanel"), q = state && state.phase === "Preparation" ? state.you.bless : null;
  document.body.classList.toggle("modalpick", !!q || !!(state && state.phase === "Preparation" && state.you.picks));
  if (!q) { if (!el.classList.contains("hidden")) { el.classList.add("hidden"); el._sig = ""; } return; }
  const sig = JSON.stringify([q, state.you.units.map((u) => [u.uid, u.blessing])]); if (el._sig === sig) return; el._sig = sig; el.classList.remove("hidden");
  if (q.uid === null) {
    const cand = state.you.units.filter((u) => !u.blessing).sort((a, b) => b.stars - a.stars);
    el.innerHTML = `<div class="cap">Blessing Crystal</div><div class="sub">Choose a Pokémon to bless (+1 synergy count)</div>` + cand.map((u) => { const d = defOf(u.id); return `<div class="opt" data-u="${u.uid}"><div class="ic" style="background-image:url(${portraitOf(u.id, u)});background-size:cover;background-position:center top"></div><div><b>${nameOf(u)} ${"★".repeat(u.stars)}</b><span>${(d.types || [d.faction]).join(" / ")} · ${u.col === null ? "bench" : "deployed"}</span></div></div>`; }).join("");
    for (const b of el.querySelectorAll(".opt")) b.onclick = () => send({ a: "bless", uid: Number(b.dataset.u) });
  } else {
    const u = state.you.units.find((x) => x.uid === q.uid), d = u && defOf(u.id), own = d ? d.types || [d.faction] : [];
    el.innerHTML = `<div class="cap">${d ? nameOf(u) : "Pokémon"}'s Blessing</div><div class="sub">Choose a synergy to gain +1 count${q.left > 1 ? ` · ${q.left - 1} more blessing(s) waiting` : ""}</div>` + (q.options || []).map((t, i) => `<div class="opt" data-t="${t}"><div class="ic">${emb(t)}</div><div><b>${t}${own.includes(t) ? " (original type)" : ""}</b><span>${i < own.length ? "One of its own types counts one extra time." : "Random extra synergy."} ${DATA.rules.traitDescriptions[t] || ""}</span></div></div>`).join("");
    for (const b of el.querySelectorAll(".opt")) b.onclick = () => send({ a: "blesspick", type: b.dataset.t });
  }
}
function renderSupply() {
  const el = $("supplyPanel"), S = state && state.phase === "Supply" ? state.supply : null;
  document.body.classList.toggle("supplying", !!S);
  if (!S) { if (!el.classList.contains("hidden")) { el.classList.add("hidden"); el._sig = ""; } return; }
  const mine = S.turn === state.seat, who = (seat) => state.players.find((p) => p.seat === seat);
  const sig = JSON.stringify([S.entries.map((e) => e.by), S.turn, state.seat]); if (el._sig === sig) { return; } el._sig = sig; el.classList.remove("hidden");
  const stageName = ["", "I", "II", "III", "IV"][Math.min(S.stage, 4)] || S.stage;
  const card = (e) => { const taker = e.by !== null ? who(e.by) : null, c = RARITY_COLORS[e.rarity] || (e.kind === "bless" ? "#ff9de2" : e.kind === "unit" ? "#7be0a0" : "#e9c46a");
    const pic = e.kind === "unit" ? `<div class="ic big" style="background-image:url(${portraitOf(e.unitId)})"></div>` : e.icon ? `<div class="ic"><img src="${e.icon}" alt=""></div>` : `<div class="ic"></div>`;
    return `<div class="sc2${taker ? " taken" : mine ? " can" : ""}" data-id="${e.id}" style="--rc:${c}">${pic}<b>${e.label}</b><span>${e.text}</span>${taker ? `<div class="by"><i style="background-image:url(${avatarUrl(taker)})"></i>${taker.name}</div>` : ""}</div>`; };
  el.innerHTML = `<div class="hd"><b>Stage ${stageName} Supply</b><span>${mine ? "Your turn — choose one reward!" : `Waiting for ${who(S.turn)?.name || "…"}`}</span></div>`
    + `<div class="order">${S.order.map((seat) => { const p = who(seat), done = S.entries.some((e) => e.by === seat); return `<i class="${seat === S.turn ? "cur" : ""}${done ? " done" : ""}${seat === state.seat ? " me" : ""}" title="${p?.name} · ${p?.hp} HP" style="background-image:url(${avatarUrl(p)})"></i>`; }).join("")}</div>`
    + `<div class="cards">${S.entries.map(card).join("")}</div><div class="foot">Lowest HP chooses first · one reward each</div>`;
  if (mine) for (const c of el.querySelectorAll(".sc2.can")) c.onclick = () => send({ a: "supplypick", id: Number(c.dataset.id) });
}
function renderCards() {
  const el = $("cardPanel"), c = state && state.phase === "Preparation" ? state.you.card : null;
  document.body.classList.toggle("carding", !!c);
  if (!c) { if (!el.classList.contains("hidden")) { el.classList.add("hidden"); el._sig = ""; } return; }
  const sig = JSON.stringify(c); if (el._sig === sig) return; el._sig = sig; el.classList.remove("hidden");
  el.dataset.r = c.rarity;
  el.innerHTML = `<div class="ttl">Please select a Pokémon Card</div><div class="row">` + c.options.map((o, i) => `<div class="col"><div class="gcard ${c.rarity}" data-id="${o.id}"><div class="art">${o.icon ? `<img src="${o.icon}" alt="">` : ""}</div><div class="nm">${o.name}</div><div class="tx">${o.text}</div></div><button class="rf" data-i="${i}" ${c.rerolls[i] > 0 ? "" : "disabled"}><span class="dice">🎲</span><b>×${c.rerolls[i]}</b><em>Refresh</em></button></div>`).join("") + `</div>`;
  for (const g of el.querySelectorAll(".gcard")) g.onclick = () => send({ a: "cardpick", id: g.dataset.id });
  for (const b of el.querySelectorAll(".rf")) b.onclick = () => send({ a: "cardreroll", slot: Number(b.dataset.i) });
}
let cardsOpen = false, cmdOpen = false, cmdTarget = null;
const CMD_ACT = { Sabrina: ["Use Power of Chaos", "unit"], Misty: ["Select Hero", "unit"], Joy: ["Select ally", "unit"], Blue: ["Move trap", "cell"] };
function refreshCmd() { $("cmdSkill")._sig = null; renderCmdSkill(); }
function renderCmdSkill() {
  const b = $("cmdSkill"), d = $("cmdDetails"), id = state && state.you.commander; if (!id) return;
  const c = state.you.cmd || { used: 0 }, prep = state.phase === "Preparation";
  const unit = (uid) => state.you.units.find((x) => x.uid === uid), nm = (u) => { const r = u && DATA.roster.find((q) => q.id === u.id); return r ? r.name : ""; };
  const sig = JSON.stringify([id, cmdOpen, cmdTarget, c, prep, state.round, state.you.units.map((u) => [u.uid, u.col, u.row]), scouting]); if (b._sig === sig) return; b._sig = sig;
  const cm = (DATA.rules.commanders || []).find((x) => x.id === id), act = CMD_ACT[id];
  b.style.backgroundImage = `url(${avatarUrl({ commander: id, human: true })})`; b.classList.toggle("ready", id === "Sabrina" && prep && state.round >= 2 && !c.used); d.classList.toggle("hidden", !cmdOpen);
  let status = "", dis = !prep;
  if (id === "Sabrina") { status = state.round < 2 ? "Unlocks after Stage I-2" : c.used ? "Used (0/1)" : "1 use left"; dis = dis || state.round < 2 || !!c.used; }
  else if (id === "Misty") status = c.water !== undefined && unit(c.water) ? "Shielded: " + nm(unit(c.water)) : "No Hero selected";
  else if (id === "Joy") status = c.love !== undefined && unit(c.love) ? "Protecting: " + nm(unit(c.love)) : "No ally selected";
  else if (id === "Blue") status = c.trap ? `Trap at column ${c.trap.col + 1}, row ${c.trap.row + 1}` : "Trap not placed yet";
  else if (id === "Brock") status = state.round === 9 ? "Pick two Go Go Cards now" : "Active in Round II-3";
  if (cmdOpen) { d.innerHTML = `<div class="ttl">Details</div><div class="it"><div class="gi" style="background-image:url(${avatarUrl({ commander: id, human: true })});background-size:cover;border-radius:50%;width:52px;height:52px"></div><div><b>${id} · Commander skill</b><span>${cm ? cm.text : ""}</span><span class="cstat">${status}</span>${act ? `<button class="cact${cmdTarget ? " on" : ""}"${dis ? " disabled" : ""}>${cmdTarget ? "Click a " + (cmdTarget === "cell" ? "tile" : "Hero") + "… (Esc)" : act[0]}</button>` : ""}</div></div>`;
    const bt = d.querySelector(".cact"); if (bt) bt.onclick = () => { cmdTarget = cmdTarget ? null : act[1]; refreshCmd(); }; }
  // markers on the board
  const marks = []; if (prep && scouting === null) {
    if (c.water !== undefined && unit(c.water) && id === "Misty") { const u = unit(c.water); marks.push({ key: "water", cell: u.col === null ? { bench: benchIndex(u) } : { col: u.col, row: u.row }, color: 0x5ab4ff }); }
    if (c.love !== undefined && unit(c.love) && id === "Joy") { const u = unit(c.love); marks.push({ key: "love", cell: u.col === null ? { bench: benchIndex(u) } : { col: u.col, row: u.row }, color: 0xff7ab8 }); }
    if (id === "Blue" && c.trap) marks.push({ key: "trap", cell: { col: c.trap.col, row: c.trap.row }, color: 0xffa23a });
  }
  scene && scene.setMarks(marks);
}
function benchIndex(u) { const bn = state.you.units.filter((x) => x.col === null); return Math.max(0, bn.indexOf(u)); }

function renderCardStack() {
  const st = $("cardStack"), det = $("cardDetails"), taken = state ? state.you.cardsTaken || [] : [];
  const sig = JSON.stringify([taken.map((c) => c.id), cardsOpen, state && state.phase]); if (st._sig === sig) return; st._sig = sig;
  const slots = (DATA.rules.gogoRounds || [2, 9, 15]).map((_, i) => taken[i]);
  st.innerHTML = slots.map((c, i) => `<i class="gc ${c ? c.rarity : ""}" style="--i:${i}">${c ? "" : "?"}</i>`).join("");
  det.classList.toggle("hidden", !cardsOpen);
  if (cardsOpen) det.innerHTML = `<div class="ttl">Details</div>` + (taken.length ? taken.map((c) => `<div class="it"><div class="gi ${c.rarity}">${c.icon ? `<img src="${c.icon}" alt="">` : ""}</div><div><b>${c.name}</b><span>${c.text}</span></div></div>`).join("") : `<div class="none">No Pokémon Cards selected yet.<br>You choose one at I-2, II-3 and III-3.</div>`);
}
function renderScout() {
  const bar = $("scoutBar"), panel = $("scoutPanel");
  if (scouting !== null && (!state || (state.phase !== "Preparation" && state.phase !== "Combat") || !state.players.find((q) => q.seat === scouting && !q.eliminated))) scouting = null;
  if (scouting !== null && state.phase === "Combat") { const k = scouting + ":" + state.round; if (watchKey !== k) { watchKey = k; spec = null; if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: "watch", seat: scouting })); } } else if (!state || state.phase !== "Combat") { watchKey = ""; spec = null; }
  document.body.classList.toggle("scouting", scouting !== null);
  if (scouting === null) { if (!bar.classList.contains("hidden")) { bar.classList.add("hidden"); panel.classList.add("hidden"); bar._sig = ""; } return; }
  const o = state.players.find((q) => q.seat === scouting), sig = JSON.stringify([o.board, o.hp, scouting]); if (bar._sig === sig) return; bar._sig = sig;
  bar.classList.remove("hidden"); panel.classList.remove("hidden");
  bar.innerHTML = `<span>🔍 Scouting <b>${o.name}</b> · ${o.hp} HP · Lv ${o.level}</span><button>Return to my board</button>`;
  bar.querySelector("button").onclick = () => { scouting = null; refreshHud(); };
  const dep = o.board.filter((u) => u.col !== null), ben = o.board.filter((u) => u.col === null);
  const rows = (arr) => arr.length ? arr.map((u) => { const d = defOf(u.id); return `<div class="so"><i style="background-image:url(${portraitOf(u.id, u)})"></i><div><b>${nameOf(u)} <em>${"★".repeat(u.stars)}</em></b><span>${(d.types || [d.faction]).join(" / ")} · ${d.role}${u.blessing ? ` · ✦${u.blessing}` : ""}</span></div><div class="it">${u.items.map((k) => { const it = DATA.itemBy[k]; return it && it.icon ? `<img src="${it.icon}" title="${it.id}: ${it.text}" alt="">` : `<u title="${k}"></u>`; }).join("")}</div></div>`; }).join("") : `<div class="none">None</div>`;
  const syn = Object.entries(o.traits || {}).filter(([k, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const th = thOf(k), tier = th.filter((t) => n >= t).length; return `<div class="sy${tier ? " on" : ""}" title="${k} ${n}/${th.join("/")}">${ROLES.includes(k) ? ric(k) : emb(k)}<b>${n}</b></div>`; }).join("");
  panel.innerHTML = `<div class="hd">${o.name}'s team</div><div class="sys">${syn || '<span class="none">No synergies</span>'}</div><h5>Deployed (${dep.length})</h5>${rows(dep)}<h5>Bench (${ben.length})</h5>${rows(ben)}`;
}
function renderDmg() {
  const el = $("dmgPanel"); if (el.classList.contains("hidden") || !DATA) return;
  const c = combat || lastCombat, side = c ? (c.m.you ?? 0) : 0;
  const rows = c ? Object.values(c.units).filter((u) => u.side === side).map((u) => ({ u, v: Math.round(c.stats[u.uid]?.[dmgMode] || 0) })).sort((a, b) => b.v - a.v) : [];
  const sig = dmgMode + "|" + rows.map((r) => r.u.uid + ":" + r.v).join(",");
  if (el._sig === sig) return; el._sig = sig;
  const max = Math.max(1, ...rows.map((r) => r.v)), titles = { dealt: "Ally DMG Dealt", taken: "Ally DMG Taken", heal: "Ally Healing" };
  el.dataset.m = dmgMode;
  el.innerHTML = `<h4>${titles[dmgMode]}</h4>` + (rows.length ? rows.map((r) => { const d = defOf(r.u.id); return `<div class="row"><img src="${portraitOf(r.u.id, r.u)}" alt=""><div class="col"><div class="nm" style="color:${r.u.stars > 1 ? "#7be0a0" : "#fff"}">${nameOf(r.u)}</div><div class="bar"><i style="width:${(r.v / max) * 100}%"></i></div></div><div class="val">${r.v}</div></div>`; }).join("") : `<div class="none">Fight a round to see damage numbers.</div>`)
    + `<div class="tabs">${[["dealt", "⚔"], ["taken", "🛡"], ["heal", "✚"]].map(([m, g]) => `<button data-m="${m}" class="${m === dmgMode ? "on" : ""}" title="${titles[m]}">${g}</button>`).join("")}</div>`;
  for (const b of el.querySelectorAll(".tabs button")) b.onclick = () => { dmgMode = b.dataset.m; el._sig = null; renderDmg(); };
}
function renderBagPanel() {
  const el = $("bagPanel"); if (el.classList.contains("hidden") || !state) return;
  const y = state.you, prep = state.phase === "Preparation" && !y.eliminated;
  const all = y.items.filter((k) => DATA.itemBy[k]), items = all.filter((k) => !DATA.itemBy[k].stone && !DATA.itemBy[k].transfer), stones = [...new Set(all.filter((k) => DATA.itemBy[k].stone))];
  const sig = JSON.stringify([y.units.map((u) => [u.uid, u.col === null, u.stars, u.items, u.blessing]), y.items.includes("blessing_transfer"), xferFrom, items, stones, bagPick, selItem, selUid, prep]);
  if (el._sig === sig) return; el._sig = sig;
  const row = (u) => { const d = defOf(u.id); const slots = [0, 1, 2].map((i) => { const k = u.items[i], it = k && DATA.itemBy[k]; return it ? `<button class="sl fill" data-u="${u.uid}" data-i="${i}" title="${it.id}: ${it.text} (click to unequip)">${it.icon ? `<img src="${it.icon}" alt="">` : it.id.slice(0, 2)}</button>` : `<button class="sl" data-u="${u.uid}" data-add="1" title="Equip an item">+</button>`; }).join("");
    return `<div class="hr${u.blessing ? " blessed" : ""}${xferFrom === u.uid ? " xfer" : ""}" data-u="${u.uid}"><div class="pt" style="background-image:url(${portraitOf(u.id, u)})"></div><div class="nm" style="color:${u.stars > 1 ? "#7be0a0" : "#fff"}">${nameOf(u)}<br><small>${"★".repeat(u.stars)}${u.blessing ? ` · ✦${u.blessing}` : ""}</small></div>${slots}</div>`; };
  const dep = y.units.filter((u) => u.col !== null), und = y.units.filter((u) => u.col === null);
  const pick = bagPick != null || selItem
    ? `<div class="pick"><span>${items.length ? "Choose an item:" : "No equipment in your bag."}</span>${[...new Set(items)].map((k) => { const it = DATA.itemBy[k], n = items.filter((x) => x === k).length; return `<button data-k="${k}" class="${k === selItem ? "sel" : ""}" style="border-color:${RARITY_COLORS[it.rarity] || "#888"}">${it.icon ? `<img src="${it.icon}" alt="">` : ""}${it.id}${n > 1 ? " ×" + n : ""}</button>`; }).join("")}</div>`
    : `<div class="pick"><span>${items.length ? "Click a + slot, or pick an item below then a slot:" : "Equipment drops from creep and boss rounds."}</span>${[...new Set(items)].map((k) => { const it = DATA.itemBy[k]; return `<button data-k="${k}" style="border-color:${RARITY_COLORS[it.rarity] || "#888"}">${it.icon ? `<img src="${it.icon}" alt="">` : ""}${it.id}</button>`; }).join("")}</div>`;
  const hasXfer = y.items.includes("blessing_transfer");
  const xferHtml = hasXfer ? `<div class="pick"><span>Blessing Transfer: ${xferFrom != null ? "now click the Pokémon to receive it" : "select a blessed Pokémon first, then press"}</span><button data-xfer="1" class="${xferFrom != null ? "sel" : ""}">✦ Transfer Blessing</button></div>` : "";
  const stoneHtml = stones.length ? `<div class="pick"><span>Stones (select an Eevee, then click):</span>${stones.map((k) => { const it = DATA.itemBy[k]; return `<button data-stone="${k}" style="border-color:${RARITY_COLORS[it.rarity] || "#888"}">${it.icon ? `<img src="${it.icon}" alt="">` : ""}${it.id}</button>`; }).join("")}</div>` : "";
  el.innerHTML = `<div class="cols"><div class="col"><h4>Deployed Heroes</h4><div class="list">${dep.length ? dep.map(row).join("") : `<div class="empty">No Pokémon on the field</div>`}</div></div><div class="col"><h4>Undeployed Heroes</h4><div class="list">${und.length ? und.map(row).join("") : `<div class="empty">Bench is empty</div>`}</div></div></div>${pick}${stoneHtml}${xferHtml}`;
  for (const b of el.querySelectorAll(".sl[data-add]")) b.onclick = () => { if (!prep) return; const uid = Number(b.dataset.u); if (selItem) { send({ a: "equip", uid, item: selItem }); selItem = null; bagPick = null; } else { bagPick = bagPick === uid ? null : uid; } el._sig = null; renderBagPanel(); renderBag(); };
  for (const b of el.querySelectorAll(".sl.fill")) b.onclick = () => { if (prep) send({ a: "unequip", uid: Number(b.dataset.u), index: Number(b.dataset.i) }); };
  for (const b of el.querySelectorAll("[data-xfer]")) b.onclick = () => { const su = y.units.find((x) => x.uid === selUid); if (xferFrom != null) xferFrom = null; else if (su && su.blessing) xferFrom = su.uid; el._sig = null; renderBagPanel(); };
  for (const r of el.querySelectorAll(".hr")) r.onclick = (e) => { if (e.target.closest(".sl")) return; const uid = Number(r.dataset.u); if (xferFrom != null && uid !== xferFrom) { send({ a: "transfer", from: xferFrom, to: uid }); xferFrom = null; } else { selUid = uid; renderInspector(); } el._sig = null; };
  for (const b of el.querySelectorAll("[data-stone]")) b.onclick = () => { const su = y.units.find((x) => x.uid === selUid); if (su && defOf(su.id).stoneEvolutions?.[b.dataset.stone]) send({ a: "evolve", uid: su.uid, stone: b.dataset.stone }); };
  for (const b of el.querySelectorAll(".pick button[data-k]")) b.onclick = () => { if (!prep) return; const k = b.dataset.k; if (bagPick != null) { send({ a: "equip", uid: bagPick, item: k }); bagPick = null; selItem = null; } else selItem = selItem === k ? null : k; el._sig = null; renderBagPanel(); renderBag(); };
}

// ---- left toolbar ----
{ const tool = (n) => document.querySelector(`[data-tool="${n}"]`), toggle = (n, el, off) => { const on = tool(n).classList.toggle("on"); el.classList.toggle(off, !on); };
  const TABS = { synergies: ["synergies", "off"], damage: ["dmgPanel", "hidden"], equipment: ["bagPanel", "hidden"] }; // one left panel at a time
  const openTab = (n) => { for (const [k, [id, cls]] of Object.entries(TABS)) { const on = k === n && !tool(k).classList.contains("on"); tool(k).classList.toggle("on", on); $(id).classList.toggle(cls, !on); } if (n === "damage") { $("dmgPanel")._sig = null; renderDmg(); } if (n === "equipment") { $("bagPanel")._sig = null; renderBagPanel(); } };
  $("cardStack").onclick = () => { cardsOpen = !cardsOpen; cmdOpen = false; $("cardStack")._sig = null; $("cmdSkill")._sig = null; renderCardStack(); renderCmdSkill(); };
  $("cmdSkill").onclick = () => { cmdOpen = !cmdOpen; cardsOpen = false; $("cmdSkill")._sig = null; $("cardStack")._sig = null; renderCmdSkill(); renderCardStack(); };
  tool("synergies").onclick = () => openTab("synergies"); tool("damage").onclick = () => openTab("damage"); tool("equipment").onclick = () => openTab("equipment");
  tool("statistics").onclick = () => toggle("statistics", $("standings2"), "hidden");
  tool("emotes").onclick = () => { $("emoteMenu").classList.toggle("hidden"); tool("emotes").classList.toggle("on"); };
  for (const b of $("emoteMenu").querySelectorAll("button")) b.onclick = () => { // local-only reaction bubble above the commander (no server emote channel exists)
    const bub = $("emoteBubble"), cv = scene && scene.commanderVisual; if (!cv) return; const p = scene.screenOf(cv.worldPos(3.4));
    bub.textContent = b.textContent; bub.style.left = p.x / stageScale + "px"; bub.style.top = p.y / stageScale + "px"; bub.classList.remove("hidden"); bub.style.animation = "none"; void bub.offsetWidth; bub.style.animation = ""; setTimeout(() => bub.classList.add("hidden"), 2400);
    $("emoteMenu").classList.add("hidden"); tool("emotes").classList.remove("on"); };
}

// on-screen joystick + jump button for walking the trainer
{ const base = $("joy"), knob = $("joyKnob"); let id = null;
  const upd = (e) => { const r = base.getBoundingClientRect(), R = r.width / 2, cx = r.left + R, cy = r.top + R; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = Math.min(1, d / R); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } joy.ix = dx; joy.iz = dy; knob.style.transform = `translate(${dx * R * 0.55}px,${dy * R * 0.55}px)`; };
  base.addEventListener("pointerdown", (e) => { id = e.pointerId; base.setPointerCapture(id); upd(e); e.preventDefault(); });
  base.addEventListener("pointermove", (e) => { if (e.pointerId === id) upd(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; joy.ix = joy.iz = 0; knob.style.transform = ""; };
  base.addEventListener("pointerup", end); base.addEventListener("pointercancel", end);
  const jb = $("jumpBtn"); jb.addEventListener("pointerdown", (e) => { joy.jump = true; e.preventDefault(); }); const jend = () => { joy.jump = false; }; jb.addEventListener("pointerup", jend); jb.addEventListener("pointerleave", jend); jb.addEventListener("pointercancel", jend); }
