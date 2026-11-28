// Gallery: Hero grid (type x role), Equipment, Encyclopedia and Go Go Cards, reachable from the main menu.
import { createBonusCardFace } from "./card-draw.js";

let C = null, tab = "hero", sub = { equipment: "All", cards: "All", ency: "rules" }, sel = { hero: null, item: null };
const $ = (id) => document.getElementById(id);
const ROLE_ROWS = ["Fighter", "Assassin", "Ranger", "Caster", "Guardian", "Support"];
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export function initGallery(ctx) {
  C = ctx;
  $("glBack").onclick = () => C.show("menu");
  for (const b of document.querySelectorAll("#glNav button")) b.onclick = () => { tab = b.dataset.t; render(); };
}
export function openGallery(t) { if (t) tab = t; C.show("gallery"); render(); }

function tabs(list, cur, key) { return `<div class="glTabs">${list.map(([k, label]) => `<button data-k="${k}" class="${cur === k ? "on" : ""}">${label}</button>`).join("")}</div>`; }
function bindTabs(root, key) { for (const b of root.querySelectorAll(".glTabs button")) b.onclick = () => { sub[key] = b.dataset.k; render(); }; }

function render() {
  if (!C || !C.DATA) return;
  for (const b of document.querySelectorAll("#glNav button")) b.classList.toggle("on", b.dataset.t === tab);
  const el = $("glBody"); el.className = "gl-" + tab;
  ({ hero: renderHero, equipment: renderEquip, encyclopedia: renderEncy, cards: renderCards })[tab](el);
}

// ---------------- Hero: type columns x role rows ----------------
function renderHero(el) {
  const R = C.DATA.roster.filter((d) => !d.evolutionOnly), types = [...new Set(R.map((d) => (d.types || [d.faction])[0]))];
  const head = types.map((t) => `<div class="hgh" title="${t}">${C.emb(t)}<span>${t}</span></div>`).join("");
  const rows = ROLE_ROWS.map((role) => `<div class="hgr"><div class="hlab">${C.ric(role)}<span>${C.roleName(role)}</span></div>${types.map((t) => `<div class="hgc">${R.filter((d) => d.role === role && (d.types || [d.faction])[0] === t).sort((a, b) => a.tier - b.tier).map((d) => `<i class="ghp${sel.hero === d.id ? " on" : ""}" data-id="${d.id}" title="${d.name}" style="background-image:url(${C.portraitOf(d.id)});--tc:${C.TIER_COLORS[d.tier - 1]}"></i>`).join("")}</div>`).join("")}</div>`).join("");
  const d = sel.hero && C.defOf(sel.hero);
  el.innerHTML = `<div class="hgrid" style="--n:${types.length}"><div class="hgr hheadrow"><div class="hlab">Type<br>Role</div>${head}</div>${rows}</div>${d ? heroCard(d) : ""}`;
  for (const i of el.querySelectorAll(".ghp")) i.onclick = () => { sel.hero = sel.hero === i.dataset.id ? null : i.dataset.id; render(); };
  const x = el.querySelector(".hcard button"); if (x) x.onclick = () => { sel.hero = null; render(); };
}
function heroCard(d) {
  const st = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`, line = (d.evolutionLine || [d.id]).map((id) => `<i class="ghp" style="background-image:url(${C.portraitOf(id)});--tc:${C.TIER_COLORS[d.tier - 1]}" title="${C.prettyName(id)}"></i>`).join("<em>›</em>");
  return `<div class="hcard"><button title="Close">✕</button><div class="gtop"><i class="ghp big" style="background-image:url(${C.portraitOf(d.id)});--tc:${C.TIER_COLORS[d.tier - 1]}"></i><div><h3>${d.name}</h3><small>${C.TIER_NAME[d.tier - 1]} · Tier ${d.tier}</small><div class="htg">${(d.types || [d.faction]).map((t) => `<span>${C.emb(t)}${t}</span>`).join("")}<span>${C.ric(d.role)}${C.roleName(d.role)}</span></div></div></div>
  <div class="hstats">${st("HP", d.health)}${st("ATK", d.attack)}${st("Armor", d.armor)}${st("MR", d.mr)}${st("Range", d.range)}${st("Speed", d.speed)}${st("Mana", (d.startMana ?? 0) + "/" + (d.maxMana ?? 0))}</div>
  <div class="hab"><b>${esc(d.ability)}</b><p>${esc(d.description)}</p></div><div class="hev">${line}</div></div>`;
}

// ---------------- Equipment ----------------
function renderEquip(el) {
  const cats = [["All", "All"], ["Regular", "Regular"], ["Magic Crystal", "Magic Crystal"], ["Synergy Exclusive", "Synergy Exclusive"], ["Special", "Special"]], cur = sub.equipment;
  const items = C.DATA.items.filter((i) => cur === "All" || i.cat === cur), order = ["Rare", "Epic", "Legendary"];
  const sections = order.map((r) => [r, items.filter((i) => (i.rarity || "Rare") === r)]).filter(([, l]) => l.length);
  const it = sel.item && C.DATA.itemBy[sel.item] || items[0];
  const tile = (i) => `<div class="glit${it && it.key === i.key ? " on" : ""}" data-k="${i.key}"><i style="--rc:${C.RARITY_COLORS[i.rarity] || "#888"};${i.icon ? `background-image:url(${i.icon})` : ""}">${i.icon ? "" : esc(i.id[0])}</i><span>${esc(i.id)}</span></div>`;
  el.innerHTML = tabs(cats, cur) + `<div class="eqwrap"><div class="eqlist">${sections.map(([r, l]) => `<h4>◈ ${r}</h4><div class="eqgrid">${l.map(tile).join("")}</div>`).join("")}</div>
  <div class="eqdet">${it ? `<div class="gtop"><i style="--rc:${C.RARITY_COLORS[it.rarity] || "#888"};${it.icon ? `background-image:url(${it.icon})` : ""}"></i><div><h3>${esc(it.id)}</h3><small style="color:${C.RARITY_COLORS[it.rarity] || "#ccc"}">${it.rarity || ""} · ${esc(it.cat || "")}</small></div></div><hr><p>${esc(it.text)}</p>` : ""}</div></div>`;
  bindTabs(el, "equipment"); for (const t of el.querySelectorAll(".glit")) t.onclick = () => { sel.item = t.dataset.k; render(); };
}

// ---------------- Encyclopedia ----------------
function renderEncy(el) {
  const D = C.DATA, E = D.economy || {}, L = D.rules.stageLen || 6, T = D.rules.dmgTable || {}, iv = D.rules.npcInterval || 3, XP = D.xpTable || {};
  const sec = {
    rules: ["Game Rules", `<ol><li>All players recruit Pokémon from the <b>Shared Pokémon Pool</b> to build their battle lineups.</li><li>The number of copies of each Pokémon in the pool is fixed. The higher the tier, the rarer it is. When other players recruit a Pokémon, it becomes harder for you to get the same one.</li><li>The game proceeds in rounds where players take turns battling <b>Creeps</b> or <b>other players</b>.</li><li>Three copies of the same Pokémon merge into a higher-star one.</li><li>The last player standing becomes the <b>Champion</b> of the match.</li></ol>`],
    round: ["Round", `<p>A stage has ${L} rounds. Every ${iv} rounds is a creep or boss encounter (equipment drops); the others are player battles. Pokémon Cards appear in rounds ${(D.rules.gogoRounds || []).join(", ")}, and a Stage Supply draft closes each stage.</p><p><b>Losing damage</b> = round base damage + the star levels of every surviving enemy unit (a draw damages both players).</p><table>${Object.entries(T).map(([s, r]) => `<tr><td>Stage ${s}</td><td>${r.join(" / ")}</td></tr>`).join("")}</table>`],
    hero: ["Pokémon", `<p>Tiers 1–5 (Common → Legendary). Higher tiers cost more and have fewer copies in the shared pool. Merge three identical 1★ into a 2★, three 2★ into a 3★ (×1.8 stats each star).</p><p>Pokémon on the field are limited by your level. Equipment (3 per Pokémon) drops from creep and boss rounds; Eevee evolves with stones.</p>`],
    commander: ["Commander", D.rules.commanders.map((c) => `<p><b style="color:#ffd678">${c.id}</b> — ${esc(c.text)}</p>`).join("")],
    gold: ["Gold", `<p>Base income ${E.baseIncome}g per round (+1 in stage III, +2 in IV, +3 in V). Win streak / loss streak bonus: 1–2 → +1, 3 → +2, 4+ → +3. Interest: +1 per ${E.interestPer} gold held, up to +${E.interestMax}.</p><p>Commander EXP: +${E.xpPerRound} per round; buying XP costs ${E.xpBuyGold} gold per ${E.xpBuyAmount} EXP.</p><p>EXP needed per level: ${Object.entries(XP).map(([l, n]) => `Lv${l}→${+l + 1}: ${n}`).join(" · ")}</p>`],
    synergy: ["Synergy Guide", Object.keys(D.rules.traitDescriptions || {}).map((k) => `<p><b style="color:#ffd678">${k}</b> — ${esc(D.rules.traitDescriptions[k])}</p>`).join("")],
  };
  const list = [["rules", "Game Rules"], ["round", "Round"], ["hero", "Pokémon"], ["commander", "Commander"], ["gold", "Gold"], ["synergy", "Synergy Guide"]];
  if (!sec[sub.ency]) sub.ency = "rules";
  const [title, html] = sec[sub.ency];
  el.innerHTML = tabs(list, sub.ency) + `<div class="encBody"><h3>◈ ${title}</h3>${html}</div>`; bindTabs(el, "ency");
}

// ---------------- Go Go Cards ----------------
function renderCards(el) {
  const names = { All: "All", Legendary: "Orange Cards", Epic: "Purple Cards", Common: "Blue Cards" }, cur = sub.cards;
  const cards = (C.DATA.gogoCards || []).filter((c) => cur === "All" || c.rarity === cur).sort((a, b) => ["Legendary", "Epic", "Common"].indexOf(a.rarity) - ["Legendary", "Epic", "Common"].indexOf(b.rarity));
  el.innerHTML = tabs(Object.entries(names), cur) + '<div class="cdgrid"></div>';
  el.querySelector(".cdgrid").replaceChildren(...cards.map(createBonusCardFace));
  bindTabs(el, "cards");
}
