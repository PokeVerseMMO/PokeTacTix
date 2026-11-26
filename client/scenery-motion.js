const systemPreference = matchMedia("(prefers-reduced-motion: reduce)");
const changes = new EventTarget();
const normalize = value => value === "on" || value === "off" ? value : "system";
let mode = normalize(localStorage.getItem("backgroundMotion"));

function announce() {
  changes.dispatchEvent(new Event("change"));
}
systemPreference.addEventListener("change", announce);
window.addEventListener("storage", event => {
  if (event.key !== "backgroundMotion" && event.key !== null) return;
  mode = normalize(localStorage.getItem("backgroundMotion"));
  announce();
});

export const sceneryMotion = {
  get mode() { return mode; },
  get enabled() { return mode === "system" ? !systemPreference.matches : mode === "on"; },
  setMode(value) {
    mode = normalize(value);
    localStorage.setItem("backgroundMotion", mode);
    announce();
  },
  onChange(listener) { changes.addEventListener("change", listener); }
};
