const requestExpiry = 4000;
const purchaseFlight = 700;
const upgradeFlight = 840;
const maxStars = 3;

function offerUpgrade(player, id) {
  const copies = player.units.filter((unit) => unit.id === id);
  const firstTier = player.fastPromotions > 0 ? 2 : 1;
  const contributors = [];
  let stars = firstTier;
  while (stars < maxStars) {
    const matching = copies.filter((unit) => unit.stars === stars);
    if (matching.length < 2) break;
    contributors.push(...matching.slice(0, 2));
    stars++;
  }
  return { copies, contributors, stars, upgrade: stars > firstTier };
}

function cellOf(unit, bench) {
  return unit.col === null ? { bench: bench.indexOf(unit) } : { col: unit.col, row: unit.row };
}

export function createShopShowcase({
  grid, effects, count, receipt, sendBuy, getDef, unitName, portrait, crest, roleCrest,
  roleName, color, coin, benchSize, project, isLocalBoard, motionEnabled, onHover, onUpgrade, onUnaffordable
}) {
  const offers = [], soldSlots = new Set(), pending = new Map(), presentations = new Map();
  let snapshot, hovered, focused, marks = null, receiptTimer;

  function updateMarks() {
    if (!snapshot) { marks = null; return; }
    const player = snapshot.you;
    const bench = player.units.filter((unit) => unit.col === null);
    const selected = grid.contains(hovered) ? hovered : grid.contains(focused) ? focused : null;
    const id = selected && !selected.disabled ? selected.dataset.pokemon : null;
    const variation = id && offerUpgrade(player, id);
    const matches = variation?.upgrade ? variation.contributors : variation?.copies || [];
    marks = {
      occupied: bench.length,
      matches: new Set(bench.flatMap((unit, i) => matches.includes(unit) ? [i] : [])),
      board: new Set(variation?.upgrade ? matches.filter((u) => u.col !== null).map((u) => `${u.col},${u.row}`) : []),
      landing: id && !selected.classList.contains("poor") && !variation.upgrade && bench.length < benchSize() ? bench.length : -1
    };
  }

  function renderShop(next) {
    const player = next.you;
    const live = next.phase !== "Finished" && !player.eliminated;
    const active = document.activeElement;
    const focusedSlot = grid.contains(active) && active.matches(":focus-visible") ? Number(active.dataset.slot) : -1;
    player.shop.forEach((id, slot) => {
      const def = id && getDef(id);
      if (def) soldSlots.delete(slot);
      const sold = soldSlots.has(slot);
      const buying = pending.has(slot);
      const free = player.fastPromotions > 0;
      const poor = def && !free && player.gold < def.tier;
      const pool = def ? next.pool?.[id] : null;
      const upgrade = def ? offerUpgrade(player, id) : null;
      const ready = upgrade?.upgrade && !poor && live;
      const key = JSON.stringify([id, live, buying, free, poor, pool, sold, ready && upgrade.stars]);
      const old = offers[slot];
      if (old?.key === key) return;

      let el = old?.id === id ? old.el : null;
      if (!el) {
        el = document.createElement(def ? "button" : "div");
        if (old) old.el.replaceWith(el);
        else grid.append(el);
      }
      offers[slot] = { el, id, key };
      if (!def) {
        el.className = "card empty";
        el.textContent = sold ? "Sold" : "";
        el.setAttribute("aria-label", sold ? "Sold shop slot" : "Empty shop slot");
        return;
      }

      const ratio = pool?.[1] ? pool[0] / pool[1] : 1;
      const heat = ratio <= .15 ? " scarce" : ratio <= .35 ? " hot" : "";
      el.type = "button";
      el.disabled = !live;
      el.className = `card t${def.tier}${poor ? " poor" : ""}${heat}${old?.id === id ? " steady" : ""}`;
      el.dataset.pokemon = id;
      el.dataset.slot = slot;
      el.style.setProperty("--shop-aura", color(def.faction));
      el.style.animationDelay = old?.id !== id ? slot * .035 + "s" : "";
      el.toggleAttribute("data-upgrade", Boolean(ready));
      el.toggleAttribute("data-pending", buying);
      el.setAttribute("aria-busy", String(buying));
      const price = free ? "Free" : `${coin}${def.tier}`;
      const label = ready ? `Upgrade to ${upgrade.stars}★` : free ? "Fast Promotion" : `${def.faction} · ${roleName(def.role)}`;
      el.setAttribute("aria-label", `Buy ${def.name} ${free ? "for free" : `for ${def.tier} gold`}${ready ? `, upgrade to ${upgrade.stars} stars` : ""}`);
      el.title = pool ? `${pool[0]} of ${pool[1]} copies left in the shared pool · ${pool[2]} owned by players${heat ? " — heavily contested!" : ""}` : "";
      el.innerHTML = `<span class="pic" style="background-image:url(${portrait(id)})"></span>
        <span class="shop-crests">${crest(def.faction)}${roleCrest(def.role)}</span><span class="cost">${price}</span>
        <span class="nm" title="${def.name}">${def.name}</span><span class="shop-meta">${label}</span>
        ${pool ? `<span class="left" aria-hidden="true">${pool[0]}<small>/${pool[1]}</small></span>` : ""}`;
      el.onclick = () => buy(el, slot, id);
      el.onmouseenter = () => { hovered = el; onHover(id); updateMarks(); };
      el.onmouseleave = () => { if (hovered === el) { hovered = null; onHover(null); updateMarks(); } };
      el.onfocus = () => { focused = el; updateMarks(); };
      el.onblur = () => { if (focused === el) { focused = null; updateMarks(); } };
    });

    if (hovered && !grid.contains(hovered)) { hovered = null; onHover(null); }
    if (!grid.contains(focused)) focused = null;
    if (focusedSlot >= 0 && !grid.contains(active)) {
      const nextOffer = [...offers.slice(focusedSlot + 1), ...offers.slice(0, focusedSlot)]
        .find(({ el }) => el.matches("button:not(:disabled)"));
      nextOffer?.el.focus({ preventScroll: true });
    }
    count.textContent = `Bench ${player.units.filter((unit) => unit.col === null).length}/${benchSize()}`;
    updateMarks();
  }

  function discard(slot) {
    const purchase = pending.get(slot);
    if (purchase) clearTimeout(purchase.timer);
    pending.delete(slot);
    return purchase;
  }

  function buy(el, slot, id) {
    if (el.disabled || pending.has(slot) || snapshot.you.shop[slot] !== id) return;
    if (el.classList.contains("poor")) {
      reject(el);
      onUnaffordable();
      return;
    }
    const pic = el.querySelector(".pic").getBoundingClientRect();
    const source = { point: { x: (pic.left + pic.right) / 2, y: (pic.top + pic.bottom) / 2 }, art: portrait(id) };
    if (!sendBuy(slot)) return;
    const timer = setTimeout(() => { discard(slot); if (snapshot) renderShop(snapshot); }, requestExpiry);
    pending.set(slot, { id, source, timer });
    renderShop(snapshot);
  }

  function reject(el) {
    if (!el) return;
    el.classList.remove("deny");
    void el.offsetWidth;
    el.classList.add("deny");
  }

  function acknowledge(previous, next) {
    if (!previous || previous.round !== next.round || previous.seat !== next.seat) {
      for (const slot of pending.keys()) discard(slot);
      return;
    }
    if (next.shopPurchase) {
      const { slot, ok } = next.shopPurchase;
      const purchase = discard(slot);
      if (!purchase) return;
      if (ok) {
        soldSlots.add(slot);
        showPurchase(previous.you, next, purchase);
      } else return slot;
      return;
    }
    // Legacy servers still confirm a buy by clearing its exact slot and changing the roster.
    for (const [slot, purchase] of pending) {
      if (previous.you.shop[slot] !== purchase.id || next.you.shop[slot] != null) continue;
      discard(slot);
      if (showPurchase(previous.you, next, purchase)) soldSlots.add(slot);
    }
  }

  function showPurchase(previous, next, { id, source }) {
    const before = new Map(previous.units.map((unit) => [unit.uid, unit]));
    const survivors = next.you.units.filter((unit) => unit.id === id);
    const evolved = survivors.find((unit) => before.has(unit.uid) && unit.stars > before.get(unit.uid).stars);
    const added = survivors.find((unit) => !before.has(unit.uid));
    const result = evolved || added;
    if (!result) return false;
    const spent = previous.gold - next.you.gold;
    const upgraded = Boolean(evolved || result.stars > 1);
    const price = previous.fastPromotions > 0 ? "Free" : spent > 0 ? `−${spent} gold` : "";
    const resultLabel = upgraded ? `${"★".repeat(result.stars)} ${unitName(result)}` : `${unitName(result)} joined the bench`;
    receipt.textContent = price ? `${resultLabel} · ${price}` : resultLabel;
    receipt.toggleAttribute("data-upgrade", upgraded);
    clearTimeout(receiptTimer);
    receiptTimer = setTimeout(() => { receipt.textContent = ""; receipt.removeAttribute("data-upgrade"); }, 4300);
    if (upgraded) onUpgrade();

    const destination = cellOf(result, next.you.units.filter((unit) => unit.col === null));
    const showFeedback = isLocalBoard() && effects.getBoundingClientRect().width > 0;
    // Combat replays keep their starting line-up. A fielded upgrade during a
    // replay is announced above the shop until the new unit can join the field.
    const inWorld = next.phase !== "Combat" || destination.bench !== undefined;
    const landing = showFeedback && (inWorld ? project(destination, 1.05) : shopLanding());
    const floor = landing && (inWorld ? project(destination, .09) : { x: landing.x, y: landing.y + 20 });
    const duration = upgraded ? upgradeFlight : purchaseFlight;
    const animate = landing && floor && motionEnabled();
    const now = performance.now();
    for (const [uid, effect] of presentations) if (effect.until <= now) presentations.delete(uid);
    presentations.set(result.uid, {
      revealAt: now + (animate && inWorld ? duration : 0),
      until: now + (animate ? duration + 240 : 680),
      destination
    });
    if (!landing || !floor) return true;

    const sources = [source];
    if (animate && evolved) {
      const remaining = new Set(next.you.units.map((unit) => unit.uid));
      const oldBench = previous.units.filter((unit) => unit.col === null);
      for (const unit of previous.units.filter((unit) => unit.id === id && (unit.uid === result.uid || !remaining.has(unit.uid))).slice(0, 4)) {
        if (next.phase === "Combat" && unit.col !== null) continue;
        sources.push({ point: project(cellOf(unit, oldBench), 1.05), art: portrait(id, unit) });
      }
    }
    showArrival({ sources, landing, floor, resultLabel, upgraded, animate, duration, inWorld });
    return true;
  }

  function shopLanding() {
    const rect = grid.getBoundingClientRect();
    return { x: (rect.left + rect.right) / 2, y: rect.top - 64 };
  }

  function showArrival({ sources, landing, floor, resultLabel, upgraded, animate, duration, inWorld }) {
    const rect = effects.getBoundingClientRect();
    const scale = rect.width / effects.clientWidth;
    const point = (p) => ({ x: (p.x - rect.left) / scale, y: (p.y - rect.top) / scale });
    const at = ({ x, y }, size) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${size})`;
    const run = (el, frames, timing) => {
      effects.append(el);
      el.animate(frames, { fill: "both", ...timing }).finished.catch(() => {}).finally(() => el.remove());
    };
    const hold = (el, position, delay, visibleFor) => {
      el.style.transform = at(position, 1);
      if (!animate) {
        el.style.opacity = "1";
        effects.append(el);
        setTimeout(() => el.remove(), visibleFor);
        return;
      }
      run(el, [{ opacity: 1 }, { opacity: 1, offset: .81 }, { opacity: 0 }],
        { delay, duration: visibleFor, fill: "forwards", easing: "linear" });
    };
    const end = point(landing);
    const result = document.createElement("span");
    result.className = `shop-arrival${upgraded ? " shop-arrival-upgrade" : ""}`;
    result.textContent = resultLabel;
    const badgeX = Math.max(125, Math.min(effects.clientWidth - 125, end.x));
    const badgeY = Math.max(32, end.y - (inWorld ? 61 : 8));
    hold(result, { x: badgeX, y: badgeY }, duration - 35, upgraded ? 1550 : 1290);

    const base = point(floor);
    const ring = document.createElement("span");
    ring.className = upgraded ? "shop-land shop-merge" : "shop-land";
    if (!animate) {
      hold(ring, base, 0, upgraded ? 1320 : 980);
      return;
    }

    for (const [index, { point: origin, art }] of sources.entries()) {
      if (!origin) continue;
      const start = point(origin);
      const sprite = document.createElement("span");
      sprite.className = "shop-flight";
      const image = new Image();
      image.alt = "";
      image.src = art;
      sprite.append(image);
      const lift = { x: start.x + (end.x - start.x) * .12, y: start.y - (index ? 24 : 40) };
      const apex = {
        x: start.x + (end.x - start.x) * .60 + (index ? (index % 2 === 1 ? -43 : 43) : 0),
        y: Math.min(start.y, end.y) - (index ? 48 + (index % 2) * 28 : 91)
      };
      const approach = { x: end.x, y: end.y - 17 };
      run(sprite, [
        { transform: at(start, index ? .83 : .86), opacity: .94 },
        { transform: at(lift, 1.06), opacity: 1, offset: .22 },
        { transform: at(apex, index ? .94 : 1.12), opacity: 1, offset: .57 },
        { transform: at(approach, .87), opacity: .98, offset: .85 },
        { transform: at(end, .58), opacity: 0 }
      ], { duration: index ? duration - 45 : duration, delay: index ? 45 : 0, easing: "cubic-bezier(.35,.12,.58,.92)" });
    }
    run(ring, [{ transform: at(base, .62), opacity: 0 },
      { transform: at(base, 1.04), opacity: 1, offset: .21 },
      { transform: at(base, 1.18), opacity: .75, offset: .59 },
      { transform: at(base, 1.42), opacity: 0 }],
    { delay: duration - 80, duration: upgraded ? 660 : 480, easing: "ease-out" });
    const stars = upgraded ? 9 : 4;
    for (let i = 0; i < stars; i++) {
      const angle = i * Math.PI * 2 / stars;
      const radius = (upgraded ? 70 : 28) + i % 3 * 5;
      const edge = { x: end.x + Math.cos(angle) * radius, y: end.y + Math.sin(angle) * radius * .84 };
      const spark = document.createElement("span");
      spark.className = "shop-spark";
      spark.textContent = i % 2 ? "✧" : "✦";
      run(spark, [{ transform: at(end, .4), opacity: 0 }, { transform: at(end, upgraded ? 1.2 : .8), opacity: 1, offset: .16 },
        { transform: at(edge, .45), opacity: 0 }],
      { delay: duration - 36 + i % 3 * 12, duration: upgraded ? 570 : 420, easing: "ease-out" });
    }
  }

  return {
    update(next) {
      const rejected = acknowledge(snapshot, next);
      snapshot = next;
      renderShop(next);
      if (rejected !== undefined) reject(offers[rejected]?.el);
    },
    get marks() { return marks; },
    presentation(uid, now, cell) {
      const effect = presentations.get(uid);
      if (!effect) return null;
      if (now >= effect.until) { presentations.delete(uid); return null; }
      const sameCell = cell.bench === effect.destination.bench && cell.row === effect.destination.row && cell.col === effect.destination.col;
      return { hide: sameCell && now < effect.revealAt };
    },
    clear() {
      for (const slot of pending.keys()) discard(slot);
      presentations.clear();
      soldSlots.clear();
      offers.length = 0;
      grid.replaceChildren();
      effects.replaceChildren();
      clearTimeout(receiptTimer);
      receipt.textContent = "";
      receipt.removeAttribute("data-upgrade");
      snapshot = hovered = focused = marks = null;
      onHover(null);
    }
  };
}
