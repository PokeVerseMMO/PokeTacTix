const TITLES = { start: "Combat begins", win: "Victory", loss: "Defeat", draw: "Draw" };

export function createDuelBanners(root, announcement) {
  const heading = root.querySelector("[data-duel-heading]");
  const roundLabel = root.querySelector("[data-duel-round]");
  const cards = [...root.querySelectorAll("[data-duel-side]")].map((el) => ({
    el,
    name: el.querySelector("[data-duel-name]"),
    portrait: el.querySelector("[data-duel-portrait]"),
    detail: el.querySelector("[data-duel-detail]"),
    winner: el.querySelector("[data-duel-winner]"),
  }));
  let timer = 0;

  function clear() {
    clearTimeout(timer);
    root.hidden = true;
    announcement.textContent = "";
  }

  function update(sides) {
    const mode = root.dataset.mode;
    cards.forEach((card, i) => {
      const { name, portrait, hp, loss, label } = sides[i];
      const damage = mode !== "start" && Number.isFinite(hp) ? Math.min(hp, loss ?? 0) : 0;
      card.name.textContent = name;
      card.portrait.style.backgroundImage = portrait;
      card.portrait.textContent = portrait === "none" ? name.trim().slice(0, 2).toUpperCase() : "";
      card.detail.textContent = label || (Number.isFinite(hp) ? (damage > 0 ? `${hp} → ${hp - damage} HP` : `${hp} HP`) : "");
      card.detail.dataset.damaged = String(damage > 0);
      card.winner.hidden = !((mode === "win" && i === 0) || (mode === "loss" && i === 1));
      card.el.dataset.winner = String(!card.winner.hidden);
    });
  }

  function show(mode, round, sides, duration) {
    clear();
    root.dataset.mode = mode;
    root.style.setProperty("--duel-duration", duration + "ms");
    heading.textContent = TITLES[mode];
    roundLabel.textContent = `Round ${round}`;
    update(sides);
    // Restart the one-shot entrance for a new round.
    void root.offsetWidth;
    root.hidden = false;
    const details = mode === "start" ? "" : cards.map((card) => ` ${card.name.textContent}, ${card.detail.textContent}.`).join("");
    announcement.textContent = `Round ${round}. ${TITLES[mode]}. ${sides[0].name} versus ${sides[1].name}.${details}`;
    timer = setTimeout(clear, duration);
  }

  return { clear, show, update };
}
