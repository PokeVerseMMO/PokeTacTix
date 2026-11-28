import { artPath } from "./art.js";

const ordinal = (n) => n + ({ 1: "st", 2: "nd", 3: "rd" }[n] || "th");
const rankedPlace = (n) => Number.isInteger(n) && n >= 1 && n <= 8;
const trainerKey = (name) => ({ red: "red1", "nurse joy": "joy" }[name.toLowerCase()] || name.toLowerCase());
const placeLight = { 1: 50, 2: 19, 3: 81 };
const element = (tag, className, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

export function createFinalsBroadcast(root) {
  const title = root.querySelector("#overTitle");
  const rating = root.querySelector("#rankResult");
  const standings = root.querySelector("#standings");
  const podium = root.querySelector("#finalsPodium");
  const stage = root.querySelector(".finals-stage");
  const sparks = root.querySelector(".finals-sparks");
  const selected = root.querySelector(".finals-selection");
  const replay = root.querySelector("#finalsReplay");
  const yourFinish = root.querySelector("#finalsYourFinish");
  const announcement = root.querySelector("#finalsAnnouncement");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let entries = [], seats = new Map(), active;
  let animations = [], timers = [];

  function avatar(node, player) {
    const head = artPath("trainers", trainerKey(player.commander) + "_head");
    node.style.backgroundImage = head ? `url("${head}")` : "";
    node.textContent = head ? "" : player.commander.slice(0, 2).toUpperCase();
  }

  function spotlight(place) {
    stage.style.setProperty("--finals-light-x", `${placeLight[place] ?? 50}%`);
  }

  function select(entry, announce = false) {
    active = entry;
    if (!entry) { selected.hidden = true; return; }
    selected.hidden = false;
    for (const { player, row } of entries) {
      const pressed = player === entry.player;
      row.setAttribute("aria-pressed", String(pressed));
      seats.get(player.placement)?.button.setAttribute("aria-pressed", String(pressed));
    }
    const { player } = entry, place = rankedPlace(player.placement) ? ordinal(player.placement) : "Unplaced";
    selected.querySelector("strong").textContent = `${place} · ${player.name}${entry.mine ? " (you)" : ""}`;
    selected.querySelector("small").textContent = player.commander;
    avatar(selected.querySelector(".finals-avatar"), player);
    spotlight(player.placement);
    if (announce) announcement.textContent = `${player.name}, ${place}, trainer ${player.commander}.`;
  }

  function clearCeremony() {
    for (const timer of timers) clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    timers = [];
    animations = [];
    sparks.replaceChildren();
    root.removeAttribute("data-revealing");
  }

  function playCeremony() {
    clearCeremony();
    const places = [...seats.keys()].sort((a, b) => b - a);
    if (!places.length) return;
    select(entries.find(({ player }) => player.placement === places.at(-1)));
    const summary = places.map((place) => `${ordinal(place)}, ${seats.get(place).name}`).join(". ");
    if (reducedMotion.matches) { announcement.textContent = summary; return; }

    root.dataset.revealing = "";
    for (const [index, place] of places.entries()) {
      const { figure, caption, medal } = seats.get(place), delay = 240 + index * 390;
      const timing = { duration: 470, delay, fill: "both", easing: "cubic-bezier(.18,.72,.25,1)" };
      animations.push(figure.animate([
        { opacity: 0, transform: "translateY(14px) scale(.96)" },
        { opacity: 1, transform: "none" },
      ], timing), caption.animate([{ opacity: 0 }, { opacity: 1 }], timing), medal.animate([
        { opacity: .38, transform: "scale(.9)" },
        { opacity: 1, transform: "scale(1.12)", offset: .62 },
        { opacity: 1, transform: "none" },
      ], timing));
      timers.push(setTimeout(() => spotlight(place), delay));
    }
    if (seats.has(1)) {
      const delay = 450 + (places.length - 1) * 390;
      for (let i = 0; i < 16; i++) {
        const ray = i * 2.39996;
        const x = Math.cos(ray) * (39 + (i % 5) * 14), y = Math.sin(ray) * (21 + (i % 4) * 12) - 47;
        const chip = element("i", "finals-spark");
        chip.style.setProperty("--spark", i % 3 ? "#ffdfa5" : "#e4caff");
        sparks.append(chip);
        animations.push(chip.animate([
          { opacity: 0, transform: "translate(0,0) rotate(0deg)" },
          { opacity: .86, offset: .22 },
          { opacity: 0, transform: `translate(${x}px,${y}px) rotate(${i % 2 ? 135 : -135}deg)` },
        ], { duration: 620 + i % 3 * 80, delay: delay + i % 4 * 35, easing: "ease-out" }));
      }
    }
    timers.push(setTimeout(() => {
      clearCeremony();
      announcement.textContent = summary;
    }, 1080 + places.length * 330));
  }

  function createSeat(entry) {
    const { player } = entry, key = trainerKey(player.commander);
    const button = element("button", "finals-seat");
    button.type = "button";
    button.dataset.place = player.placement;
    button.setAttribute("aria-label", `${ordinal(player.placement)} place, ${player.name}, trainer ${player.commander}`);
    button.setAttribute("aria-pressed", "false");
    const figure = element("span", "finals-figure"), image = element("img", "finals-trainer");
    image.alt = "";
    figure.append(image);
    const sources = [
      ["model", artPath("trainers/podium", key)], ["sprite", artPath("trainers", key)],
      ["portrait", artPath("trainers", key + "_head")],
    ].filter(([, src]) => src);
    function loadArt() {
      const next = sources.shift();
      if (next) {
        const [kind, src] = next;
        figure.dataset.art = kind;
        image.src = src;
      } else {
        image.remove();
        figure.dataset.art = "initial";
        figure.append(element("span", "finals-initial", player.commander.slice(0, 2).toUpperCase()));
      }
    }
    image.addEventListener("error", loadArt);
    loadArt();
    const step = element("span", "finals-step"), medal = element("span", "finals-medal", String(player.placement));
    const caption = element("span", "finals-caption");
    caption.append(element("strong", "", player.name), element("small", "", player.commander));
    step.append(medal, caption);
    button.append(figure, step);
    button.onclick = () => { clearCeremony(); select(entry, true); };
    seats.set(player.placement, { button, figure, medal, caption, name: player.name });
    podium.append(button);
  }

  function renderRank(rank) {
    rating.hidden = !rank;
    if (!rank) return;
    rating.querySelector("span").textContent = `${rank.ranked ? "Ranked" : "Practice match"} · ${rank.label}`;
    const change = rating.querySelector("strong"), detail = rating.querySelector("small");
    change.textContent = rank.ranked && rank.delta ? `${rank.delta > 0 ? "+" : "−"}${Math.abs(rank.delta)} RP` : `${rank.rp} RP`;
    change.dataset.loss = String(rank.delta < 0);
    detail.textContent = rank.ranked && rank.delta ? `${rank.rp} total RP` : "RP unchanged";
  }

  function show(match) {
    clearCeremony();
    seats.clear();
    standings.replaceChildren();
    podium.replaceChildren();
    title.textContent = match.placement === 1 ? "You won the match" : `You placed ${ordinal(match.placement)}`;
    renderRank(match.rank);
    const players = [...match.standings].sort((a, b) => a.placement - b.placement);
    root.querySelector("#finalsCount").textContent = `${players.length} ${players.length === 1 ? "trainer" : "trainers"}`;
    entries = players.map((p) => {
      const player = { ...p, commander: p.commander || "Trainer" };
      const mine = Number.isInteger(match.seat) && Number.isInteger(p.seat) ? match.seat === p.seat : player.placement === match.placement;
      const item = element("li", "finals-place"), row = element("button", "finals-row");
      row.type = "button";
      row.dataset.place = player.placement;
      row.classList.toggle("me", mine);
      const rank = rankedPlace(player.placement) ? String(player.placement) : "—";
      const icon = element("span", "finals-avatar");
      icon.setAttribute("aria-hidden", "true");
      avatar(icon, player);
      row.append(element("span", "finals-medal", rank), icon, element("strong", "finals-name", player.name),
        element("span", "finals-commander", player.commander));
      if (mine) row.append(element("span", "finals-you", "You"));
      item.append(row);
      standings.append(item);
      const entry = { player, row, mine };
      row.onclick = () => { clearCeremony(); select(entry, true); };
      if (rankedPlace(player.placement) && player.placement <= 3 && !seats.has(player.placement)) createSeat(entry);
      return entry;
    });
    const own = entries.find((entry) => entry.mine);
    const champion = entries.find(({ player }) => player.placement === 1);
    yourFinish.disabled = !own;
    replay.disabled = !seats.size;
    stage.dataset.empty = String(!seats.size);
    select(champion ?? own ?? entries[0]);
    title.focus({ preventScroll: true });
    if (seats.size) playCeremony();
  }

  yourFinish.onclick = () => {
    clearCeremony();
    select(entries.find((entry) => entry.mine), true);
    active?.row.focus({ preventScroll: true });
    active?.row.scrollIntoView({ block: "nearest" });
  };
  replay.onclick = playCeremony;

  return { show, clear: clearCeremony };
}
