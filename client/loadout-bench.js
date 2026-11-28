const SLOTS = [0, 1, 2];
const RARITY = { Rare: "#a7c8ff", Epic: "#edbcff", Legendary: "#ffda90", Mega: "#ffdbab" };

export function heldItemIndices(unit) {
  const indices = [null, null, null];
  unit.items.forEach((_, index) => { indices[unit.itemSlots?.[index] ?? index] = index; });
  return indices;
}

function element(tag, className, text = "") {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function art(src, fallback) {
  if (!src) return element("span", "loadout-art-fallback", fallback.slice(0, 2));
  const img = new Image();
  img.src = src;
  img.alt = "";
  img.draggable = false;
  return img;
}

const center = (el) => {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

export function createLoadoutBench(root, options) {
  const find = (selector) => root.querySelector(selector);
  const items = find(".loadout-items"), detail = find(".loadout-inspection"), apply = find(".loadout-apply");
  const effects = find(".loadout-effects"), status = find(".loadout-status");
  const rail = find(".loadout-units");
  const itemButtons = new Map(), slotButtons = new Map(), unitButtons = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let state, open = false, uid = null, targetSlot = null, selectedItem = null, held = false, armed = false, donor = null;
  let inventoryKey = "", rosterKey = "", requestId = 0, pending, drag, suppressClick = false;

  const units = () => state?.you.units ?? [];
  const selectedUnit = () => units().find((u) => u.uid === uid);
  const count = (key) => state?.you.items.filter((id) => id === key).length ?? 0;
  const stock = () => (state?.you.items ?? []).filter((key) => options.item(key));
  const canEdit = () => open && options.isLocal() && state?.phase === "Preparation" && !state.you.eliminated;
  const slotKey = (unit, slot) => `${unit}:${slot}`;
  const label = (selector, value) => { find(selector).textContent = value; };

  function notice(text, tone = "") {
    status.dataset.tone = tone;
    status.textContent = text;
  }

  function equipmentProblem(unit, key, position) {
    if (!unit) return "Choose a Pokémon.";
    const item = options.item(key);
    if (!item || item.stone || item.transfer) return "This item goes in the item inspector.";
    if (!count(key)) return "This item is no longer in the bag.";
    if (unit.items.includes(key)) return "This Pokémon already holds this item.";
    if (unit.items.length >= 3) return "All three held slots are full.";
    if (position !== null && heldItemIndices(unit)[position] !== null) return "This held-item slot is occupied.";
    return "";
  }

  function action() {
    const unit = selectedUnit(), item = options.item(selectedItem);
    const name = unit && options.name(unit);
    if (!item) return { label: "Equip", problem: "Choose an item." };
    if (held) {
      return { label: "Return to bag", problem: unit ? "" : "Choose a Pokémon.",
        packet: { a: "unequip", uid, index: unit?.items.indexOf(selectedItem) } };
    }
    if (item.stone) {
      const evolution = unit && options.def(unit.id)?.stoneEvolutions?.[selectedItem];
      return { label: evolution ? `Evolve into ${options.def(evolution)?.name || evolution}` : "Evolve",
        problem: evolution ? "" : "Choose a compatible Eevee.",
        packet: { a: "evolve", uid, stone: selectedItem } };
    }
    if (item.transfer) {
      const from = units().find((u) => u.uid === donor);
      if (!from) return { label: "Choose recipient", problem: unit?.blessing ? "" : "Choose a blessed Pokémon.", chooseDonor: true };
      const problem = !unit || unit === from || unit.blessing ? "Choose an unblessed recipient." : "";
      return { label: "Transfer blessing", problem, packet: { a: "transfer", from: donor, to: uid } };
    }
    return { label: name ? `Equip to ${name}` : "Equip", problem: equipmentProblem(unit, selectedItem, targetSlot),
      packet: { a: "equip", uid, item: selectedItem, slot: targetSlot ?? undefined } };
  }

  function renderStock() {
    const list = stock(), inventory = Array.from(new Set(list));
    const key = JSON.stringify(list);
    if (key === inventoryKey) return;
    inventoryKey = key;
    label("[data-loadout-count]", list.length === 1 ? "1 item" : `${list.length} items`);
    find("[data-loadout-empty]").hidden = list.length !== 0;
    itemButtons.clear();
    items.replaceChildren(...inventory.map((id) => {
      const it = options.item(id), button = element("button", "loadout-item");
      button.type = "button";
      button.dataset.loadoutItem = id;
      button.style.setProperty("--tier", RARITY[it.rarity] ?? "#d8c8de");
      const desc = element("span", "loadout-item-copy");
      desc.append(element("strong", "", it.id), element("small", "", it.rarity));
      const quantity = count(id);
      button.append(art(it.icon, it.id), desc, element("span", "loadout-qty", quantity > 1 ? `×${quantity}` : ""));
      button.setAttribute("aria-label", `Inspect ${it.id}, ${quantity} in bag`);
      itemButtons.set(id, button);
      return button;
    }));
  }

  function renderRoster() {
    const roster = units();
    const key = JSON.stringify(roster.map((u) => [u.uid, u.id, u.stars, u.col === null, u.items, u.itemSlots, u.blessing]));
    if (key === rosterKey) return;
    rosterKey = key;
    slotButtons.clear();
    unitButtons.clear();
    find("[data-loadout-no-units]").hidden = roster.length !== 0;
    const lastScroll = rail.scrollLeft;
    const ordered = [...roster].sort((a, b) => Number(a.col === null) - Number(b.col === null));
    rail.replaceChildren(...ordered.map((unit) => {
      const card = element("article", "loadout-unit"), name = options.name(unit);
      card.dataset.loadoutUnit = unit.uid;
      card.dataset.location = unit.col === null ? "bench" : "deployed";
      const head = element("button", "loadout-target"), copy = element("span", "loadout-unit-copy");
      head.type = "button";
      head.setAttribute("aria-label", `Select ${name}`);
      const def = options.def(unit.id), types = (def?.types ?? [def?.faction]).filter(Boolean).join(" / ");
      copy.append(element("strong", "", `${name} ${"★".repeat(unit.stars)}`));
      copy.append(element("small", "loadout-location", `${types} · ${unit.col === null ? "Bench" : "Deployed"}`));
      if (unit.blessing) copy.append(element("small", "", `${unit.blessing} blessing`));
      head.append(art(options.pokemon(unit), name), copy);
      const slots = element("div", "loadout-slots");
      slots.setAttribute("role", "group");
      slots.setAttribute("aria-label", `${name} held slots`);
      heldItemIndices(unit).forEach((index, position) => {
        const item = index === null ? null : options.item(unit.items[index]);
        const button = element("button", "loadout-slot", index === null ? "+" : "");
        button.type = "button";
        button.dataset.loadoutSlot = position;
        button.dataset.filled = String(index !== null);
        if (index !== null) {
          button.append(art(item?.icon, item?.id || unit.items[index]));
          button.setAttribute("aria-label", `Inspect ${item?.id || unit.items[index]} held by ${name} in slot ${position + 1}`);
        } else button.setAttribute("aria-label", `Select slot ${position + 1} on ${name}`);
        slotButtons.set(slotKey(unit.uid, position), button);
        slots.append(button);
      });
      card.append(head, slots, element("span", "loadout-capacity", `${unit.items.length}/3 held`));
      unitButtons.set(unit.uid, { card, head });
      return card;
    }));
    rail.scrollLeft = lastScroll;
  }

  function render() {
    if (!open || !state) return;
    renderRoster();
    renderStock();
    label("[data-loadout-phase]", `Round ${state.round} · ${state.phase}`);
    const item = options.item(selectedItem), unit = selectedUnit();
    for (const [key, button] of itemButtons) button.setAttribute("aria-pressed", String(key === selectedItem && !held));
    for (const [id, { head, card }] of unitButtons) {
      head.setAttribute("aria-pressed", String(id === uid));
      card.dataset.donor = String(id === donor);
    }
    for (const [key, button] of slotButtons) {
      const mark = targetSlot !== null && key === slotKey(uid, targetSlot);
      button.dataset.selected = String(mark);
      button.setAttribute("aria-pressed", String(mark));
    }
    detail.hidden = !item;
    find("[data-loadout-no-item]").hidden = Boolean(item);
    if (!item) return;
    detail.style.setProperty("--tier", RARITY[item.rarity] ?? "#d8c8de");
    const display = find(".loadout-display");
    if (display.dataset.item !== selectedItem) {
      display.dataset.item = selectedItem;
      display.replaceChildren(art(item.icon, item.id));
    }
    label("[data-loadout-name]", item.id);
    label("[data-loadout-rarity]", item.rarity);
    label("[data-loadout-effect]", item.text);
    const use = action(), def = unit && options.def(unit.id);
    const conditional = item.typeBoost || item.family;
    const inactive = def && ((item.typeBoost && !def.types?.includes(item.typeBoost)) || (item.family && def.family !== item.family));
    const fit = find("[data-loadout-fit]");
    fit.dataset.tone = use.problem || inactive ? "warn" : "";
    fit.textContent = !canEdit() ? "Equipment changes are available during preparation."
      : use.problem || (inactive ? `Bonus inactive on ${options.name(unit)}.`
        : item.transfer && donor !== null ? `From ${options.name(units().find((u) => u.uid === donor))}`
        : unit ? [options.name(unit), targetSlot !== null && `Slot ${targetSlot + 1}`, conditional && "Bonus applies"].filter(Boolean).join(" · ") : "");
    label("[data-loadout-source]", held && unit ? `Held by ${options.name(unit)}` : `${count(selectedItem)} in bag`);
    apply.textContent = pending ? "Applying…" : use.label;
    apply.disabled = !canEdit() || Boolean(use.problem || pending);
  }

  function resetSelection(preferredUid) {
    const roster = units();
    uid = roster.find((u) => u.uid === preferredUid)?.uid ?? roster.find((u) => u.col !== null)?.uid ?? roster[0]?.uid ?? null;
    selectedItem = stock()[0] ?? null;
    targetSlot = null;
    held = armed = false;
    donor = null;
  }

  function selectTarget(id, position = null) {
    const unit = units().find((u) => u.uid === id);
    if (!unit) return;
    if (held) {
      selectedItem = count(selectedItem) ? selectedItem : stock()[0] ?? null;
      held = false;
    }
    uid = id;
    targetSlot = position;
    render();
  }

  function animateEquip(key, from, target) {
    if (!open || !options.isLocal() || !target || reducedMotion.matches) return;
    const end = center(target), rect = effects.getBoundingClientRect();
    const scale = rect.width / effects.offsetWidth;
    if (!scale || !Number.isFinite(scale)) return;
    target.getAnimations().forEach((animation) => animation.cancel());
    target.animate([
      { transform: "scale(.90)", boxShadow: "0 0 0 #ffdf9f" },
      { transform: "scale(1.17)", boxShadow: "0 0 20px #ffdf9fa9", offset: .42 },
      { transform: "scale(1)", boxShadow: "0 0 5px #ffdf9f40" },
    ], { duration: 480, delay: from ? 210 : 0, easing: "ease-out" });
    if (!from) return;
    const item = options.item(key), badge = art(item?.icon, item?.id ?? key);
    badge.classList.add("loadout-flying-item");
    effects.append(badge);
    const place = (p, lift = 0) => `translate(${(p.x - rect.left) / scale - 14}px,${(p.y - rect.top) / scale - 14 + lift}px)`;
    const travel = badge.animate([
      { transform: place(from) + " scale(.9)", opacity: 1 },
      { transform: place({ x: (from.x + end.x) * .5, y: (from.y + end.y) * .5 }, -16) + " scale(1.08)", opacity: 1, offset: .55 },
      { transform: place(end) + " scale(.65)", opacity: 0 },
    ], { duration: 270, easing: "cubic-bezier(.32,.04,.24,1)" });
    travel.finished.then(() => badge.remove(), () => badge.remove());
  }

  function startRequest(packet, key, from = null) {
    if (pending || !canEdit()) return false;
    const id = ++requestId;
    if (!options.send({ ...packet, requestId: id })) {
      notice("Could not reach the game server.", "warn");
      return false;
    }
    armed = false;
    pending = { id, packet, key, from, beforeCount: count(key), timer: setTimeout(() => {
      pending = null;
      render();
      notice("No update from the server. Try again.", "warn");
    }, 4000) };
    render();
    return true;
  }

  function equip(key, unit, position, from) {
    const problem = equipmentProblem(unit, key, position);
    if (problem) { notice(problem, "warn"); return true; }
    return startRequest({ a: "equip", uid: unit.uid, item: key, slot: position ?? undefined }, key, from);
  }

  function receive(next) {
    state = next;
    const request = pending, ack = next.equipmentAction;
    let pulse;
    if (request) {
      const { packet, key } = request;
      const unit = units().find((u) => u.uid === (packet.uid ?? packet.to));
      const actualIndex = unit?.items.indexOf(key) ?? -1;
      const accepted = packet.a === "equip" ? actualIndex >= 0
        : packet.a === "unequip" ? Boolean(unit && actualIndex < 0) : count(key) < request.beforeCount;
      if (ack?.requestId === request.id || (!ack && accepted)) {
        clearTimeout(request.timer);
        pending = null;
        if (ack && !ack.ok) notice(next.message || "Equipment could not be changed.", "warn");
        else if (packet.a === "equip" && unit && actualIndex >= 0) {
          uid = unit.uid; selectedItem = key; held = true;
          targetSlot = unit.itemSlots?.[actualIndex] ?? actualIndex;
          pulse = { key, from: request.from, uid, position: targetSlot };
          notice(`${options.item(key).id} equipped to ${options.name(unit)}.`, "success");
        } else if (packet.a === "unequip") {
          selectedItem = key; held = false; targetSlot = null;
          notice(`${options.item(key).id} returned to the bag.`, "success");
        } else {
          donor = null; selectedItem = stock()[0] ?? null;
          notice(packet.a === "evolve" ? "Evolution complete." : "Blessing transferred.", "success");
        }
      }
    }
    if (!selectedUnit() && units().length) { resetSelection(); }
    if (donor !== null && !units().some((u) => u.uid === donor && u.blessing)) donor = null;
    if (held && !selectedUnit()?.items.includes(selectedItem)) { held = false; targetSlot = null; }
    if (!held && !count(selectedItem)) selectedItem = stock()[0] ?? null;
    if (!canEdit()) cancelDrag();
    render();
    if (drag && !root.contains(drag.source)) cancelDrag();
    if (pulse) {
      const target = slotButtons.get(slotKey(pulse.uid, pulse.position));
      animateEquip(pulse.key, pulse.from, target);
    }
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || suppressClick) return;
    if (button.dataset.loadoutAction === "close") { options.close(); return; }
    if (pending) return;
    const unit = units().find((u) => u.uid === Number(button.closest("[data-loadout-unit]")?.dataset.loadoutUnit));
    if (button.dataset.loadoutItem) {
      selectedItem = button.dataset.loadoutItem;
      held = false; armed = !options.item(selectedItem).stone && !options.item(selectedItem).transfer;
      donor = null; render();
    } else if (button.dataset.loadoutSlot !== undefined && unit) {
      const pos = Number(button.dataset.loadoutSlot), index = heldItemIndices(unit)[pos];
      if (index === null) selectTarget(unit.uid, pos);
      else { uid = unit.uid; targetSlot = pos; selectedItem = unit.items[index]; held = true; armed = false; donor = null; render(); }
    } else if (unit) selectTarget(unit.uid);
    else if (button === apply && canEdit()) {
      const use = action();
      if (use.problem) return;
      if (use.chooseDonor) {
        donor = uid;
        render();
        notice("Choose an unblessed Pokémon to receive the blessing.");
      } else if (use.packet.a === "equip") equip(selectedItem, selectedUnit(), targetSlot, itemButtons.get(selectedItem) && center(itemButtons.get(selectedItem)));
      else startRequest(use.packet, selectedItem);
    }
  });

  function cancelDrag() {
    if (!drag) return;
    drag.ghost?.remove();
    if (drag.source.hasPointerCapture(drag.pointer)) drag.source.releasePointerCapture(drag.pointer);
    for (const button of slotButtons.values()) delete button.dataset.drop;
    drag = null;
  }

  function dropAt(event) {
    const button = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-loadout-slot]");
    if (!button || !root.contains(button)) return null;
    const unit = units().find((u) => u.uid === Number(button.closest("[data-loadout-unit]").dataset.loadoutUnit));
    return { unit, position: Number(button.dataset.loadoutSlot), button };
  }

  root.addEventListener("pointerdown", (event) => {
    const source = event.target.closest("[data-loadout-item]"), key = source?.dataset.loadoutItem;
    if (!key || !canEdit() || pending || event.button !== 0 || event.pointerType === "touch") return;
    const item = options.item(key);
    if (!item || item.stone || item.transfer) return;
    source.setPointerCapture(event.pointerId);
    drag = { source, key, pointer: event.pointerId, x: event.clientX, y: event.clientY };
  });
  root.addEventListener("pointermove", (event) => {
    if (event.pointerId !== drag?.pointer) return;
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7) return;
      const item = options.item(drag.key);
      drag.ghost = art(item.icon, item.id);
      drag.ghost.classList.add("loadout-flying-item");
      effects.append(drag.ghost);
    }
    event.preventDefault();
    const rect = effects.getBoundingClientRect(), scale = rect.width / effects.offsetWidth;
    if (!scale) return;
    drag.ghost.style.transform = `translate(${(event.clientX - rect.left) / scale - 14}px,${(event.clientY - rect.top) / scale - 14}px)`;
    if (drag.highlight) delete drag.highlight.dataset.drop;
    const drop = dropAt(event);
    drag.highlight = drop?.button;
    if (drop) drop.button.dataset.drop = equipmentProblem(drop.unit, drag.key, drop.position) ? "blocked" : "ready";
  });
  root.addEventListener("pointerup", (event) => {
    if (event.pointerId !== drag?.pointer) return;
    const active = drag;
    const drop = active.ghost && dropAt(event);
    cancelDrag();
    if (!active.ghost) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (drop && canEdit()) equip(active.key, drop.unit, drop.position, { x: event.clientX, y: event.clientY });
  });
  root.addEventListener("pointercancel", cancelDrag);

  return {
    update: receive,
    setOpen(value, preferredUid) {
      open = value;
      if (!value) { cancelDrag(); effects.replaceChildren(); return; }
      if (!selectedUnit() || preferredUid !== null && preferredUid !== undefined && preferredUid !== uid) resetSelection(preferredUid);
      render();
      notice("Drag an item onto an open slot, or select a Pokémon and use Equip.");
    },
    equipFromBoard(unitId) {
      if (!armed || !canEdit() || pending) return false;
      const unit = units().find((u) => u.uid === unitId);
      armed = false;
      return equip(selectedItem, unit, null, itemButtons.get(selectedItem) && center(itemButtons.get(selectedItem)));
    },
    clear() {
      open = false;
      if (pending) clearTimeout(pending.timer);
      pending = state = null;
      resetSelection();
      inventoryKey = rosterKey = "";
      notice("");
      cancelDrag();
      effects.replaceChildren();
    },
  };
}
