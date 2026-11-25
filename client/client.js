// PokéTactix client: menu, lobby, 3D battle screen (Three.js), mockup-style HUD, drag & drop, combat replay.
import { Scene3D } from "./scene.js";
import { Audio2 } from "./audio.js";
import { portrait, avatar, iconSvg, loadArtManifest, artPath, hash } from "./art.js";
import { Lobby3D } from "./lobby3d.js";
const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
let DATA = null, ws = null, state = null, combat = null, scene = null, lastMode = "solo";
let timerBase = { left: 0, at: 0 }, selItem = null, selUid = null, drag = null, ptr = { x: 0, y: 0 }, hoverTip = null, phaseAt = 0, lastRound = -1, prev = { gold: null, shopSig: [], syn: {}, hp: {} };
const TIER_COLORS = ["#9aa3b8", "#59c27a", "#4aa3ff", "#b36bff", "#ffb23e"];
const RARITY_COLORS = { Rare: "#4aa3ff", Epic: "#b36bff", Legendary: "#ffb23e" };
const hexNum = (s) => parseInt(s.slice(1), 16);
const FACTIONS = ["JJK", "AOT", "CSM", "TG", "SAO"], ROLES = ["Fighter", "Assassin", "Ranger", "Caster", "Guardian", "Support"];
const thOf = (k) => DATA.synergies?.[k]?.thresholds || THRESH[k] || [2, 4];
const cryOf = (u) => { const f = formId(u), l = (defOf(u.id) || {}).evolutionLine || [u.id]; for (const k of [u.formArt, f, ...[...l].reverse(), u.id]) if (k && Audio2.CRIES.has(k)) return k; return u.id; };
const formId = (u) => { const l = (defOf(u.id) || {}).evolutionLine || [u.id]; return l[Math.min(u.stars - 1, l.length - 1)]; };
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
    d.style.left = box.children.length * 118 + "px";
    d.innerHTML = `<b>${c.id}</b>`;
    d.onclick = () => { localStorage.cmd = c.id; for (const e of box.children) e.classList.remove("sel"); d.classList.add("sel"); setCommanderVisual(c.id); };
    box.appendChild(d);
  }
  if (!scene) {
    scene = new Scene3D($("view"), localStorage.quality || "High"); scene.setNumberContainer($("numbers")); scene.onEvolve = (v) => { Audio2.sfx("egg_hatch", 0.9); setTimeout(() => { Audio2.jingle("evolved", 0.9); Audio2.cry(v.cryKey || v.id, 1); }, 1100); }; $("quality").value = scene.qname; fit();
    requestAnimationFrame(loop);
  }
  setCommanderVisual(localStorage.cmd || "Blue");
}
function setCommanderVisual(cid) {
  const cm = (DATA.rules.commanders || []).find((c) => c.id === cid); if ($("cmdInfo") && cm) $("cmdInfo").textContent = cm.text; if ($("heroName")) $("heroName").textContent = cid;
  if (!lobby3d && $("heroCanvas")) { try { lobby3d = new Lobby3D($("heroCanvas")); } catch (e) { console.warn(e); } } lobby3d && lobby3d.show(cid.toLowerCase());
  const id = cid.toLowerCase(), d = defOf(id) || { role: "Caster", faction: "JJK", name: cid };
  scene && scene.setCommander(id, d, fRGB(d.faction));
}
$("name").value = localStorage.name || "Player";
$("helpBtn").onclick = () => $("helpPanel").classList.toggle("hidden");
$("modeBtn").onclick = () => $("modePanel").classList.toggle("hidden");
for (const v of ["Beginner", "Intermediate", "Hard"]) { const b = document.createElement("button"); b.className = "lm-btn"; b.textContent = v; b.onclick = () => { $("difficulty").value = v; $("modeBtn").innerHTML = `Practice · ${v} &nbsp;&#9652;`; $("modePanel").classList.add("hidden"); }; $("diffBtns").appendChild(b); }
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
    timerBase = { left: m.timeLeft, at: performance.now() };
    if (m.phase === "Preparation") { combat = null; Audio2.music("route101"); }
    setCommanderVisual(m.you.commander);
    refreshHud();
    if (m.phase === "Preparation" && m.round !== lastRound) { lastRound = m.round; banner(`Round ${m.round}`, m.npc ? (m.npc.boss ? `BOSS · ${m.npc.name}` : "Creep encounter") : "Preparation phase"); }
  } else if (m.t === "combat") {
    startCombat(m);
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
  if (e.key === "d" || e.key === "D") send({ a: "reroll" });
  if (e.key === "f" || e.key === "F") send({ a: "xp" });
  if (e.key === "l" || e.key === "L") send({ a: "lock" });
  if (e.key === "Enter") send({ a: "ready" });
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
  const y = state.you, prep = state.phase === "Preparation" && !y.eliminated;
  $("round").textContent = `Round ${state.round}` + (state.npc ? (state.npc.boss ? " · Boss" : " · Creeps") : "");
  $("phase").textContent = state.phase === "Preparation" ? "Preparation" : "Combat";
  $("level").textContent = y.level; $("fielded").textContent = `${y.units.filter((u) => u.col !== null).length}/${y.level}`;
  $("xpbar").style.width = y.level >= DATA.rules.maxLevel ? "100%" : `${(y.xp / Math.max(1, y.xpNeed)) * 100}%`;
  if (prev.gold !== null && prev.gold !== y.gold) { const g = $("goldChip"); g.classList.remove("pop"); void g.offsetWidth; g.classList.add("pop"); }
  prev.gold = y.gold; $("gold").textContent = y.gold;
  $("rerollCost").textContent = y.rerollCost; $("reroll").disabled = !prep || y.shopLocked;
  $("xp").disabled = !prep || y.level >= DATA.rules.maxLevel;
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
    el.className = "card t" + d.tier + (y.gold < d.tier ? " poor" : "");
    if (same) el.style.animation = "none"; else el.style.animationDelay = slot * 0.05 + "s";
    el.innerHTML = `<div class="pic" style="background-image:url(${artPath("portraits", id) || portrait(id, d, fRGB(d.faction))})"></div><div class="frame" style="background-image:url(${TIER_FRAME(d.tier)})"></div>${hasIcon(d.faction) ? emb(d.faction) : ""}${ric(d.role)}<div class="nm">${d.name.split(" ")[0]}</div><div class="cost">${COIN}${d.tier}</div>`;
    el.onclick = () => {
      if (!prep) return;
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
        el.onmouseenter = () => (hoverTip = { text: `<b style="color:#ffd678">${k}</b> — ${n} active (thresholds ${th.join(" / ")})<br>${DATA.rules.traitDescriptions[k] || ""}` }); el.onmouseleave = () => (hoverTip = null);
        grid.appendChild(el);
      } };
    const present = Object.keys(y.traits).filter((k) => DATA.rules.factions.includes(k)).sort((a, b) => y.traits[b] - y.traits[a]);
    fill($("facGrid"), [...present, ...DATA.rules.factions.filter((k) => !present.includes(k))].slice(0, 6), emb); fill($("roleGrid"), ROLES, ric); }
  // standings
  const st = $("standings2"); st.innerHTML = "";
  const order = [...state.players].sort((a, b) => (a.seat === state.seat ? -1 : b.seat === state.seat ? 1 : (a.eliminated - b.eliminated) || b.hp - a.hp));
  for (const p of order) {
    const el = document.createElement("div"), pct = Math.max(0, Math.min(100, (p.hp / DATA.rules.startHealth) * 100));
    el.className = "pl" + (p.seat === state.seat ? " me" : "") + (p.eliminated ? " dead" : "");
    el.innerHTML = `<span class="av" style="background-image:url(${avatarUrl(p)})"></span><span class="nm">${p.name}</span><span class="hp">${Math.max(0, p.hp)}</span><div class="bar"><i style="width:${pct}%;background-size:${pct > 0 ? 10000 / pct : 100}% 100%"></i></div>`;
    if (prev.hp[p.seat] !== undefined && p.hp < prev.hp[p.seat]) { el.classList.add("hit"); }
    prev.hp[p.seat] = p.hp;
    st.appendChild(el);
  }
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
    el.className = "item" + (key === selItem ? " sel" : ""); el.style.borderColor = RARITY_COLORS[it.rarity] || "#888"; el.textContent = it.id;
    el.onclick = () => { if (it.stone) { const su = state.you.units.find((x) => x.uid === selUid); if (su && defOf(su.id).stoneEvolutions?.[key]) send({ a: "evolve", uid: su.uid, stone: key }); return; } selItem = selItem === key ? null : key; renderBag(); };
    el.onmouseenter = () => (hoverTip = { text: `<b style="color:${RARITY_COLORS[it.rarity]}">${it.id}</b> · ${it.rarity}<br>${it.text}<br><i>${it.stone ? "Select an Eevee, then click this stone." : "Click, then click a fighter."}</i>` }); el.onmouseleave = () => (hoverTip = null);
    bag.appendChild(el);
  }
}
function renderInspector() {
  const box = $("inspector"), u = state && selUid != null ? state.you.units.find((x) => x.uid === selUid) : null;
  if (!u || state.phase !== "Preparation") { box.classList.add("closed"); document.body.classList.remove("inspecting"); return; }
  const d = defOf(u.id), S = 1.8 ** (u.stars - 1), rc = TIER_COLORS[d.tier - 1];
  // dock on the side that keeps the selected fighter visible
  const sp = u.col !== null && scene ? scene.cellScreen({ col: u.col, row: u.row }) : null;
  if (sp) { const ux = sp.x / stageScale, W = innerWidth / stageScale, L = [262, 702], Rr = [W - 708, W - 268]; const hit = (r) => ux > r[0] - 40 && ux < r[1] + 40; box.classList.toggle("dockL", hit(Rr) && !hit(L) ? true : hit(L) && !hit(Rr) ? false : ux > W / 2); }
  box.classList.remove("closed"); document.body.classList.add("inspecting"); hoverTip = null;
  box.style.setProperty("--rc", rc); box.style.setProperty("--fc", factionColor(d.faction));
  const stat = (img, lab, v) => `<span title="${lab}"><img src="${UI}icons/${img}.png" alt="${lab}"><b>${v}</b></span>`;
  const slots = [0, 1, 2].map((i) => { const k = u.items[i], it = k && DATA.itemBy[k]; return it ? `<div class="slot fill" style="border-color:${RARITY_COLORS[it.rarity] || "#888"}" title="${it.id}: ${it.text} (click to unequip)" data-i="${i}">${it.id.slice(0, 6)}</div>` : `<div class="slot" title="Empty equipment slot"></div>`; }).join("");
  box.innerHTML = `<button class="x" title="Close">✕</button><div class="top"><div class="pt" style="background-image:url(${artPath("portraits", formId(u)) || artPath("portraits", u.id) || portrait(u.id, d, fRGB(d.faction))})"><div class="st">${"★".repeat(u.stars)}</div></div>
  <div><h4>${formId(u) === u.id ? d.name : prettyName(formId(u))}<small>${TIER_NAME[d.tier - 1]} · Tier ${d.tier}</small></h4>
  <div class="tags">${(d.types || [d.faction]).map((t) => `<span>${emb(t)}${t}</span>`).join("")}<span>${ric(d.role)}${roleName(d.role)}</span></div>
  <div class="stats">${stat("health", "Health", Math.round(d.health * S))}${stat("attack", "Attack", Math.round(d.attack * S))}${stat("defense", "Armor", d.armor)}${stat("mr", "Magic resist", d.mr)}${stat("mp", "Mana (start / max)", d.maxMana ? `${d.startMana || 0}/${d.maxMana}` : "–")}${stat("attack_speed", "Attack speed", d.speed.toFixed(2))}${stat("range", "Range", d.range)}</div></div></div>
  <div class="abil">${abilityImg(u.id, d, "ico")}<div><b>${d.ability}</b><br>${d.description}</div></div>
  ${d.stoneEvolutions ? `<div class="evo">${Object.entries(d.stoneEvolutions).filter(([k]) => y.items.includes(k)).map(([k, t]) => `<button class="wbtn" data-stone="${k}"><span>${DATA.itemBy[k]?.id || k} → ${prettyName(t)}</span></button>`).join("") || '<i>Eevee evolves with an Evolution Stone (dropped by creep/boss wins).</i>'}</div>` : ""}
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
function startCombat(m) {
  Audio2.music(m.npc ? (/Mewtwo|Rayquaza/.test(m.vs || "") ? "vs_rayquaza" : "vs_wild") : "vs_trainer");
  const units = {};
  for (const u of m.start) { const d = defOf(u.id); units[u.uid] = { ...u, formArt: null, maxHp: u.hp, alive: true, tc: u.col, tr: u.row, mana: u.mana ?? 0, maxMana: u.maxMana ?? 0 }; }
  combat = { m, units, idx: 0, t0: performance.now(), done: false, banner: false };
  selUid = null; renderInspector(); phaseAt = performance.now();
}
function stepCombat(now) {
  const c = combat, t = (now - c.t0) / 1000 - 0.9;
  while (c.idx < c.m.events.length && c.m.events[c.idx].t <= t) {
    const e = c.m.events[c.idx++], u = c.units[e.u], tg = e.tg && c.units[e.tg], K = (id) => "c" + id;
    if (e.k === "move") { u.tc = e.col; u.tr = e.row; }
    else if (e.k === "atk") { if (u) Audio2.sfx("click", 0.25, 120); scene.fxEvent("atk", K(e.u), K(e.tg)); }
    else if (e.k === "dmg") { Audio2.sfx(e.crit ? "super_effective" : "effective", e.crit ? 0.8 : 0.45, 90); tg.hp = Math.max(0, tg.hp - e.v); scene.fxEvent("dmg", K(e.u), K(e.tg), { v: e.v, crit: e.crit, magic: e.name === "magic" }); }
    else if (e.k === "mana") u.mana = e.v;
    else if (e.k === "heal") { Audio2.sfx("eb_heal", 0.5, 200); tg.hp = Math.min(tg.maxHp, tg.hp + e.v); scene.fxEvent("heal", K(e.u), K(e.tg), { v: e.v }); }
    else if (e.k === "shield") scene.fxEvent("shield", K(e.u), K(e.tg));
    else if (e.k === "die") { Audio2.sfx("faint", 0.7, 100); u.alive = false; scene.fxEvent("die", K(e.u)); }
    else if (e.k === "cast") { if (u) Audio2.cry(cryOf(u), 0.7); scene.fxEvent("cast", K(e.u), e.tg ? K(e.tg) : undefined, { name: e.name }); }
    else if (e.k === "form") { if (e.name === "mega") { Audio2.sfx("mega_flash", 1); setTimeout(() => Audio2.sfx("mega_refresh", 0.9), 350); Audio2.cry(cryOf(u), 1); } else if (e.x === 1) { Audio2.sfx("mega_harden", 1); Audio2.cry(cryOf(u), 1); } u.formArt = e.art || null; if (e.v) { if (e.v > u.maxHp) u.hp += e.v - u.maxHp; u.maxHp = e.v; u.hp = Math.min(u.hp, u.maxHp); } scene.fxEvent(e.name === "mega" ? "mega" : e.name === "gmax" ? "gmax" : "buff", K(e.u), undefined, { name: "control", on: e.x === 1 }); }
    else if (e.k === "status") { if (e.on) Audio2.sfx({ burn: "eb_burn", poison: "eb_poison", paralysis: "eb_paralysis", freeze: "eb_frozen", sleep: "eb_sleep", confusion: "eb_confused", slow: "eb_stat_down", flinch: "bang" }[e.name] ?? "eb_stat_down", 0.6, 150); scene.fxEvent("status", K(e.u), undefined, { name: e.name, on: e.on }); }
    else if (e.k === "weather") scene.fxEvent("weather", undefined, undefined, { name: e.name });
    else if (e.k === "buff") scene.fxEvent("buff", K(e.u), undefined, { name: e.name });
  }
  if (!c.done && t > c.m.duration + 0.5) {
    c.done = true; scene.setWeatherFx("none"); const won = c.m.winner === c.m.you, drew = c.m.winner === -1;
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
  if (combat && state.phase !== "Preparation") {
    const c0 = combat, flip = combat.m.you === 1;
    for (const u of Object.values(combat.units)) {
      const d = defOf(u.id);
      list.push({ key: "c" + u.uid, id: u.id, art: u.formArt || formId(u), def: u.npc ? { ...d, npc: true, boss: !!u.boss } : d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), cell: { col: u.tc, row: u.tr }, flip, mine: u.side === c0.m.you, hp: u.hp / u.maxHp, mana: u.maxMana ? u.mana / u.maxMana : 0, showMana: u.maxMana > 0, noPop: true, noEvo: true, instant: false, hidden: false, world: null });
    }
    return list;
  }
  const y = state.you, bench = y.units.filter((u) => u.col === null);
  for (const u of y.units) {
    const d = defOf(u.id), isDrag = drag && drag.moved && drag.uid === u.uid;
    const e = { key: "u" + u.uid, id: u.id, art: formId(u), def: d, fcolor: fRGB(d.faction), stars: u.stars, items: itemList(u.items), hp: 1, mine: true, selected: u.uid === selUid, spawnFx: !fresh, noPop: fresh };
    if (isDrag) { const p = scene.groundPoint(ptr.x, ptr.y, 0.9); if (p) { e.world = { x: p.x, z: p.z, y: 0.9 }; e.instant = true; } else e.cell = { col: u.col ?? 0, row: u.row ?? 0 }; }
    else e.cell = u.col !== null ? { col: u.col, row: u.row } : { bench: bench.indexOf(u) };
    list.push(e);
  }
  return list;
}
function loop(now) {
  requestAnimationFrame(loop);
  if (!scene) return;
  const inMatch = state && !$("match").classList.contains("hidden");
  if (inMatch && combat && state.phase !== "Preparation") stepCombat(now);
  scene.sync(buildList(now));
  const dragging = drag && drag.moved;
  scene.setGrid({ mode: inMatch && combat && state.phase !== "Preparation" ? "combat" : dragging ? "drag" : inMatch ? "prep" : "combat", hoverCell: dragging ? drag.hoverCell : null, hoverBench: dragging ? drag.hoverBench : null });
  scene.frame();
  if (inMatch) {
    if (state.phase === "Preparation") { const left = Math.max(0, timerBase.left - (now - timerBase.at) / 1000); $("timer").textContent = Math.ceil(left); $("timerWrap").classList.toggle("urgent", left <= 5 && left > 0); }
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
  if (e.button !== 0 || !state || state.phase !== "Preparation" || state.you.eliminated) return;
  const uid = uidOfVisual(scene.pickUnit(e.clientX, e.clientY));
  if (uid != null && selItem) { send({ a: "equip", uid, item: selItem }); selItem = null; return; }
  if (uid != null) drag = { uid, sx: e.clientX, sy: e.clientY, moved: false };
  else { selUid = null; renderInspector(); }
});
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

window.__ui = { send: (a) => send(a), info: () => ({ calls: scene.renderer.info.render.calls, tris: scene.renderer.info.render.triangles, geos: scene.renderer.info.memory.geometries, tex: scene.renderer.info.memory.textures }), banner, ids: () => DATA.roster.map((u) => u.id), refresh: () => refreshHud(), cell: (c, lift) => scene.cellScreen(c, lift), get state() { return state; }, get combat() { return combat; } };
loadData().then(fit).catch((e) => { console.error(e); $("menuMsg").textContent = "Cannot reach the game server."; });
fit();

// ---- left toolbar ----
{ const tool = (n) => document.querySelector(`[data-tool="${n}"]`), toggle = (n, el, off) => { const on = tool(n).classList.toggle("on"); el.classList.toggle(off, !on); };
  tool("synergies").onclick = () => toggle("synergies", $("synergies"), "off");
  tool("equipment").onclick = () => toggle("equipment", $("bag"), "hidden");
  tool("statistics").onclick = () => toggle("statistics", $("standings2"), "hidden");
  tool("combat").onclick = () => { if (!$("ready").disabled) $("ready").click(); };
  tool("emotes").onclick = () => { $("emoteMenu").classList.toggle("hidden"); tool("emotes").classList.toggle("on"); };
  for (const b of $("emoteMenu").querySelectorAll("button")) b.onclick = () => { // local-only reaction bubble above the commander (no server emote channel exists)
    const bub = $("emoteBubble"), cv = scene && scene.commanderVisual; if (!cv) return; const p = scene.screenOf(cv.worldPos(3.4));
    bub.textContent = b.textContent; bub.style.left = p.x / stageScale + "px"; bub.style.top = p.y / stageScale + "px"; bub.classList.remove("hidden"); bub.style.animation = "none"; void bub.offsetWidth; bub.style.animation = ""; setTimeout(() => bub.classList.add("hidden"), 2400);
    $("emoteMenu").classList.add("hidden"); tool("emotes").classList.remove("on"); };
}
