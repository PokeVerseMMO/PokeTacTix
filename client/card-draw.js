const ROLL_TIME = 380;

export function createBonusCardFace(option) {
  const face = document.getElementById("bonusCardFace").content.firstElementChild.cloneNode(true);
  face.dataset.rarity = option.rarity;
  face.querySelector(".draw-tier").textContent = option.rarity;
  face.querySelector(".draw-name").textContent = option.name;
  face.querySelector(".draw-effect").textContent = option.text;

  const art = face.querySelector(".draw-art");
  const image = art.querySelector("img");
  const illustration = /^[a-z0-9_-]+$/i.test(option.id)
    ? new URL(`./art/bonus-cards/${option.id}.webp`, import.meta.url).href
    : null;
  function loadArt(src, kind) {
    image.hidden = true;
    art.dataset.artwork = kind;
    if (!src) {
      image.removeAttribute("src");
      return;
    }
    image.onload = () => { image.hidden = false; };
    image.onerror = () => {
      if (kind === "illustration") loadArt(option.icon, "icon");
    };
    image.src = src;
  }
  loadArt(illustration || option.icon, illustration ? "illustration" : "icon");
  return face;
}

// Only a server snapshot spends dice or changes the offers. The pending request
// gives the roll time to finish, even on a local server that replies immediately.
export function createCardDraw(panel, sendAction) {
  const offers = panel.querySelector(".draw-offers");
  const rarity = panel.querySelector(".draw-rarity");
  const status = panel.querySelector(".draw-status");
  const template = panel.querySelector("template");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  panel.style.setProperty("--draw-roll-time", `${ROLL_TIME}ms`);
  let slots = [], drawKey = null, card = null, pending = null, revealTimer = null, returnFocus = null;

  function clearPending() {
    if (revealTimer !== null) clearTimeout(revealTimer);
    revealTimer = null;
    pending = null;
    for (const slot of slots) {
      slot.dice.forEach(die => die.classList.remove("is-rolling"));
      slot.pick.removeAttribute("aria-disabled");
      slot.roll.removeAttribute("aria-disabled");
    }
  }

  function close() {
    if (drawKey === null) return;
    const restoreFocus = panel.contains(document.activeElement) && returnFocus?.isConnected;
    clearPending();
    panel.classList.add("hidden");
    document.body.classList.remove("carding");
    drawKey = null;
    card = null;
    if (restoreFocus) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  function buildSlots(count) {
    slots = Array.from({ length: count }, () => {
      const root = template.content.firstElementChild.cloneNode(true);
      return {
        root, cardId: null,
        pick: root.querySelector(".draw-card"), roll: root.querySelector(".draw-reroll"),
        count: root.querySelector(".draw-reroll-copy small"), dice: Array.from(root.querySelectorAll(".draw-die"))
      };
    });
    offers.replaceChildren(...slots.map(slot => slot.root));
  }

  function paint() {
    panel.dataset.rarity = card.rarity;
    rarity.textContent = `${card.rarity} draw`;
    slots.forEach((slot, index) => {
      const option = card.options[index];
      slot.root.hidden = !option;
      if (!option) return;
      const left = card.rerolls[index] ?? 0;
      if (slot.cardId !== option.id) {
        slot.cardId = option.id;
        slot.pick.replaceChildren(createBonusCardFace(option));
        slot.pick.setAttribute("aria-label", `Take ${option.name}. ${option.text}`);
      }
      slot.count.textContent = left ? `${left} left` : "No dice left";
      slot.roll.setAttribute("aria-label", `Reroll ${option.name}, ${left} ${left === 1 ? "die" : "dice"} left`);
      slot.roll.disabled = left === 0;
      slot.dice.forEach((die, index) => die.classList.toggle("is-spent", index >= left));
    });
  }

  function finishRoll() {
    const { index } = pending;
    const slot = slots[index];
    const hadFocus = document.activeElement === slot.roll;
    clearPending();
    if (hadFocus && card.rerolls[index] === 0) slot.pick.focus({ preventScroll: true });
    paint();
    if (!reducedMotion.matches) {
      slot.pick.animate(
        [{ opacity: 0.52, transform: "translateY(3px) rotateX(-12deg)" }, { opacity: 1, transform: "none" }],
        { duration: 230, easing: "cubic-bezier(.2,.75,.3,1)" }
      );
    }
    const left = card.rerolls[index];
    status.textContent = `${card.options[index].name} revealed. ${left} ${left === 1 ? "die" : "dice"} left on this card.`;
  }

  function update(state) {
    const next = state?.phase === "Preparation" ? state.you.card : null;
    if (!next?.options.some(Boolean)) { close(); return; }
    const key = `${state.round}/${state.you.cardsTaken?.length ?? 0}`;
    const newDraw = key !== drawKey;
    card = next;
    if (newDraw) {
      clearPending();
      if (drawKey === null) returnFocus = document.activeElement;
      drawKey = key;
      buildSlots(card.options.length);
      paint();
      status.textContent = "";
      panel.classList.remove("hidden");
      document.body.classList.add("carding");
      slots.find(slot => !slot.root.hidden)?.pick.focus({ preventScroll: true });
      return;
    }

    if (!pending) {
      paint();
    } else if (pending.roll && card.rerolls[pending.index] < pending.left) {
      const delay = pending.endsAt - performance.now();
      if (revealTimer === null && (delay <= 0 || reducedMotion.matches)) finishRoll();
      else if (revealTimer === null) revealTimer = setTimeout(finishRoll, delay);
    } else if (state.message && revealTimer === null) {
      clearPending();
      status.textContent = state.message;
    }
  }

  offers.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || pending || !card) return;
    const index = slots.findIndex(slot => slot.pick === button || slot.roll === button);
    if (index < 0 || !card.options[index]) return;
    const slot = slots[index], roll = button === slot.roll, left = card.rerolls[index] ?? 0;
    if (roll && !left) return;
    const action = roll ? { a: "cardreroll", slot: index } : { a: "cardpick", id: card.options[index].id };
    pending = { roll, index, left, endsAt: performance.now() + ROLL_TIME };
    if (!sendAction(action)) {
      clearPending();
      status.textContent = "Could not send. Try again.";
      return;
    }
    for (const slot of slots) {
      slot.pick.setAttribute("aria-disabled", "true");
      slot.roll.setAttribute("aria-disabled", "true");
    }
    status.textContent = roll ? "Rolling…" : "Claiming bonus…";
    if (roll) slot.dice[left - 1]?.classList.add("is-rolling");
  });

  panel.addEventListener("keydown", event => {
    if (event.repeat && (event.key === "Enter" || event.key === " ")) event.preventDefault();
    if (event.key !== "Tab") return;
    const buttons = slots.filter(slot => !slot.root.hidden).flatMap(slot => slot.roll.disabled ? [slot.pick] : [slot.pick, slot.roll]);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey ? document.activeElement !== first : document.activeElement !== last) return;
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  });

  return { update, get active() { return drawKey !== null; } };
}
