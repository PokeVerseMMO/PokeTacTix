const STATUS = {
  burn: { color: "#ffab6b", label: "Burn", path: "M12 2c2 5 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 3-6 0 3 2 3 2 3 3-3 2-7 2-10ZM12 14c-2 2-3 3-3 5a3 3 0 0 0 6 0c0-2-1-3-3-5Z", duration: .82 },
  poison: { color: "#e0a2ff", label: "Poison", path: "M9 3h6M10 3v6l-5 7a3 3 0 0 0 2 5h10a3 3 0 0 0 2-5l-5-7V3M7 14h10m-6 3h.1m4 1h.1", duration: .86 },
  paralysis: { color: "#ffe182", label: "Paralysis", path: "m13 2-9 12h7l-1 8 10-12h-7l1-8Z", duration: .53 },
  freeze: { color: "#a4edff", label: "Freeze", path: "M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 11l4-1-1-4m10 12-1-4 4-1M4 13l4 1-1 4M17 6l-1 4 4 1", duration: .78 },
  sleep: { color: "#bec5ff", label: "Sleep", path: "M19.5 15A8.4 8.4 0 0 1 9 4.5 8.6 8.6 0 1 0 19.5 15ZM15 5h5l-5 5h5", duration: 1.07 },
  confusion: { color: "#ffa6d9", label: "Confusion", path: "M21 13a9 9 0 1 1-9-9 6 6 0 1 1-6 6 4 4 0 1 1 4 4", duration: .9 },
  flinch: { color: "#ffc5a9", label: "Flinch", path: "M10.5 4.5a1.7 1.7 0 0 1 3 0l8 13a1.7 1.7 0 0 1-1.5 2.5H4a1.7 1.7 0 0 1-1.5-2.5ZM12 9v4m0 3.5h.01", duration: .38 },
  slow: { color: "#a0caff", label: "Slow", path: "M6 3h12M6 21h12M7 3v3c0 3 3 4 5 6-2 2-5 3-5 6v3m10-18v3c0 3-3 4-5 6 2 2 5 3 5 6v3M8 18l4-3 4 3", duration: .78 },
};
const HITS = {
  hit: { color: "#fff0d6", duration: .29 },
  crit: { color: "#ffd580", duration: .52 },
  ability: { color: "#d7bcff", duration: .62 },
};
const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
const ease = (p) => 1 - (1 - p) ** 3;

function trace(ctx, ...xy) {
  ctx.beginPath();
  ctx.moveTo(xy[0], xy[1]);
  for (let i = 2; i < xy.length; i += 2) ctx.lineTo(xy[i], xy[i + 1]);
  ctx.stroke();
}

function ring(ctx, x, y, rx, ry = rx) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.stroke();
}

function spark(ctx, x, y, a, b = a) {
  trace(ctx, x - a, y, x + a, y);
  trace(ctx, x, y - b, x, y + b);
}

function icon(ctx, name, x, y, size) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 1.75;
  ctx.stroke(STATUS[name].drawing ??= new Path2D(STATUS[name].path));
  ctx.restore();
}

function rays(ctx, p, count, inner, outer, phase = 0) {
  for (let i = 0; i < count; i++) {
    const a = phase + i * TAU / count, r = inner + (outer - inner) * (i % 2 === 0 ? 1 : .65);
    trace(ctx, (inner + p * 15) * Math.cos(a), (inner + p * 15) * Math.sin(a),
      (r + p * 22) * Math.cos(a), (r + p * 22) * Math.sin(a));
  }
}

const hitDraw = {
  hit(ctx, p) {
    rays(ctx, p, 4, 6, 16, -.45);
    if (p < .32) spark(ctx, 0, 0, 4, 6);
  },
  crit(ctx, p) {
    rays(ctx, p, 10, 10, 39, -.24);
    ring(ctx, 0, 0, 7 + 28 * p, 4 + 13 * p);
    spark(ctx, 0, 0, 10 * (1 - p), 16 * (1 - p));
  },
  ability(ctx, p) {
    const r = 10 + 30 * p;
    ring(ctx, 0, 7, r, r * .54);
    ring(ctx, 0, 7, r * .71, r * .38);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + p * 1.7, x = Math.cos(a) * r, y = 7 + Math.sin(a) * r * .54;
      trace(ctx, x - 4, y, x, y - 5, x + 4, y, x, y + 5, x - 4, y);
    }
  },
};

const statusDraw = {
  burn(ctx, p) {
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * (5 + p * 3) + 5 * Math.sin(i + p * 6);
      const y = 19 - p * (34 + (i % 3) * 16) - i % 2 * 7;
      trace(ctx, x - 3, y + 6, x - 1, y, x + 1, y + 2, x + 2, y - 6);
    }
    if (p < .72) icon(ctx, "burn", 0, 9 - p * 19, 31 * (1 - .37 * p));
  },
  poison(ctx, p) {
    ring(ctx, 0, 17, 16 + p * 19, 5 + p * 6);
    for (let i = 0; i < 6; i++) {
      const t = (p + i * .12) % 1;
      const x = (i - 2.5) * 8 + Math.sin(t * TAU + i) * 5, y = 18 - t * 51;
      ring(ctx, x, y, 2.4 + i % 3 + t * 2);
    }
  },
  paralysis(ctx, p) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * (18 + p * 9), y = (p < .35 ? 0 : 7) - i * 4;
      trace(ctx, x + 5, y - 27, x - 6, y - 9, x + 3, y - 10, x - 3, y + 8);
    }
    rays(ctx, p, 5, 22, 31, .2);
  },
  freeze(ctx, p) {
    const r = p < .38 ? 30 - p * 43 : 14 + (p - .38) * 23;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6, x = Math.cos(a) * r, y = Math.sin(a) * r;
      trace(ctx, x, y - 8, x + 4, y, x, y + 7, x - 4, y, x, y - 8);
    }
    icon(ctx, "freeze", 0, 0, 18 + 11 * ease(p));
  },
  sleep(ctx, p) {
    icon(ctx, "sleep", -9 + p * 12, -9 - p * 22, 26);
    for (let i = 0; i < 3; i++) {
      const q = (p + i * .19) % 1, x = 9 + q * 19 + Math.sin(q * TAU) * 4, y = 6 - q * 50, s = 2 + q * 2;
      trace(ctx, x - s, y - s, x + s, y - s, x - s, y + s, x + s, y + s);
    }
  },
  confusion(ctx, p) {
    const r = 22 + p * 8;
    ring(ctx, 0, -11, r, r * .40);
    for (let i = 0; i < 3; i++) {
      const a = p * 7 + i * TAU / 3;
      spark(ctx, Math.cos(a) * r, -11 + Math.sin(a) * r * .4, 4.5, 6);
    }
  },
  flinch(ctx, p) {
    icon(ctx, "flinch", 0, -10, 24 + p * 19);
    rays(ctx, p, 6, 20, 36, -.2);
  },
  slow(ctx, p) {
    ring(ctx, 0, 15, 11 + p * 30, 4 + p * 8);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 17, y = -28 + p * 46 + (i % 2) * 9;
      trace(ctx, x - 6, y - 4, x, y + 2, x + 6, y - 4);
      trace(ctx, x - 6, y + 2, x, y + 8, x + 6, y + 2);
    }
  },
};

function element(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

export class CombatFeedback {
  constructor(root) {
    this.canvas = element("canvas", "spotlight-field");
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.hidden = true;
    this.ctx = this.canvas.getContext("2d");
    this.statusLayer = element("div", "spotlight-status-layer");
    this.numberLayer = element("div", "spotlight-number-layer");
    this.numberLayer.setAttribute("aria-hidden", "true");
    root.append(this.canvas, this.statusLayer, this.numberLayer);
    this.numbers = Array.from({ length: 48 }, () => {
      const el = element("div", "spotlight-number"), value = element("strong"), label = element("small");
      el.hidden = true;
      el.append(value, label);
      this.numberLayer.append(el);
      return { el, value, label };
    });
    this.bursts = [];
    this.docks = new Map();
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
  }

  clear() {
    for (const { el } of this.numbers) el.hidden = true;
    for (const { el } of this.docks.values()) el.remove();
    this.docks.clear();
    this.bursts.length = 0;
    this.canvas.hidden = true;
  }

  number(pos, key, kind, text, label = "") {
    const now = performance.now();
    const used = new Set(this.numbers.filter((n) => !n.el.hidden && n.key === key && now - n.start < n.duration).map((n) => n.lane));
    const lane = [0, -1, 1, -2, 2, -3, 3].find((n) => !used.has(n)) ?? 0;
    let n = this.numbers.find((n) => n.el.hidden || now - n.start >= n.duration);
    if (!n) n = this.numbers.reduce((a, b) => a.start < b.start ? a : b);
    n.el.dataset.kind = kind;
    n.value.textContent = text;
    n.label.textContent = label.replaceAll("_", " ");
    n.label.hidden = !label;
    n.el.style.visibility = "hidden";
    n.el.hidden = false;
    Object.assign(n, { pos, key, kind, lane, start: now, duration: kind === "crit" || kind === "ability" ? 970 : kind === "hit" || kind === "tick" ? 740 : 870 });
    n.halfWidth = n.el.offsetWidth / 2;
  }

  clearCast(key, ability) {
    const label = ability.replaceAll("_", " ");
    for (const n of this.numbers) {
      if (!n.el.hidden && n.kind === "cast" && n.key === key && n.label.textContent === label) n.el.hidden = true;
    }
  }

  impact(kind, pos, key, status = false) {
    const style = status ? STATUS[kind] : HITS[kind];
    if (!style || !this.ctx) return;
    this.bursts.push({ kind, pos, key, status, style, start: performance.now() });
    if (this.bursts.length > 56) this.bursts.shift();
  }

  syncStatuses(units, project, anchors, bounds) {
    const visible = new Map();
    for (const [key, v] of units) {
      if (v.statuses?.size && v.ui.visible && v.root.visible && !v.dead) visible.set(key, v);
    }
    for (const [key, dock] of this.docks) {
      if (!visible.has(key)) { dock.el.remove(); this.docks.delete(key); }
    }
    if (!visible.size) return;
    const bars = new Map();
    for (const [key, v] of units) {
      if (!v.statuses || !v.ui.visible || !v.root.visible || v.dead) continue;
      const { bar, left, right } = anchors(v);
      bars.set(key, { center: project(bar), left: project(left).x, right: project(right).x });
    }
    const occupied = [...document.querySelectorAll("#synergies:not(.off), #scoutPanel:not(.hidden), #bagPanel:not(.hidden), #dmgPanel:not(.hidden)")]
      .map((panel) => panel.getBoundingClientRect());
    for (const [key, v] of visible) {
      const bar = bars.get(key);
      let dock = this.docks.get(key);
      if (!dock) {
        dock = { el: element("div", "spotlight-statuses"), icons: new Map(), width: 0, height: 0 };
        dock.el.dataset.unit = key;
        this.statusLayer.append(dock.el);
        this.docks.set(key, dock);
      }
      let changed = false;
      for (const [name, badge] of dock.icons) {
        if (!v.statuses.has(name)) { badge.el.remove(); dock.icons.delete(name); changed = true; }
      }
      for (const [name, state] of v.statuses) {
        const style = STATUS[name];
        if (!style) continue;
        let badge = dock.icons.get(name);
        if (!badge) {
          const el = element("span", "spotlight-status"), glyph = element("canvas"), stack = element("b");
          el.dataset.status = name;
          el.setAttribute("role", "img");
          el.style.setProperty("--status-ink", style.color);
          glyph.width = glyph.height = 48;
          const ink = glyph.getContext("2d");
          ink.lineJoin = ink.lineCap = "round"; ink.strokeStyle = style.color;
          icon(ink, name, 24, 24, 40);
          el.append(glyph, stack); dock.el.append(el);
          badge = { el, stack };
          dock.icons.set(name, badge);
          changed = true;
        }
        if (badge.count !== state.stacks) {
          badge.count = state.stacks;
          badge.stack.textContent = state.stacks > 1 ? state.stacks : "";
          badge.stack.hidden = state.stacks <= 1;
          badge.el.setAttribute("aria-label", style.label + (state.stacks > 1 ? `, ${state.stacks} stacks` : ""));
        }
        const proc = this.bursts.findLast((e) => e.status && e.key === key && e.kind === name);
        if (proc && badge.proc !== proc) {
          badge.proc = proc;
          if (!this.motion.matches) {
            badge.animation?.cancel();
            badge.animation = badge.el.animate([
              { transform: "scale(.9)", boxShadow: `0 0 13px ${style.color}` },
              { transform: "scale(1.19)", offset: .35 },
              { transform: "scale(1)", boxShadow: "0 1px 4px #10091c" },
            ], { duration: 345, easing: "ease-out" });
          }
        }
      }
      if (changed || !dock.width) {
        dock.width = dock.el.offsetWidth;
        dock.height = dock.el.offsetHeight;
      }
      const { width, height } = dock, y = bar.center.y - 9;
      const fits = (x, top) => x >= bounds.left + 4 && x + width <= bounds.right - 4 && top >= bounds.top + 4 && top + height <= bounds.bottom - 4
        && occupied.every((r) => x + width + 3 < r.left || x > r.right + 3 || top + height + 4 < r.top || top > r.bottom + 4)
        && [...bars].every(([other, b]) => other === key || top > b.center.y + 9 || top + height < b.center.y - 8 || x > b.right + 4 || x + width < b.left - 7);
      const right = bar.right + 4, left = bar.left - width - 12;
      const center = clamp(bar.center.x - width / 2, bounds.left + 4, bounds.right - width - 4);
      const up = Math.max(bounds.top + 4, y - height - 7), down = y + 25;
      const [x, top] = [[right, y], [left, y], [center, up], [right, up], [left, up], [right, down], [left, down], [center, down]]
        .find(([x, top]) => fits(x, top)) ?? [center, up];
      dock.el.style.transform = `translate(${x.toFixed(1)}px, ${top.toFixed(1)}px)`;
      occupied.push({ left: x, right: x + width, top, bottom: top + height });
    }
  }

  draw(units, project, anchors, rect) {
    const now = performance.now(), width = rect.width, height = rect.height, reduced = this.motion.matches;
    this.syncStatuses(units, project, anchors, rect);
    for (const n of this.numbers) {
      if (n.el.hidden) continue;
      const p = (now - n.start) / n.duration;
      if (p >= 1) { n.el.hidden = true; continue; }
      const src = project(n.pos);
      const critical = n.kind === "crit", scale = reduced ? 1 : 1 + (critical ? .26 : .13) * Math.sin(Math.PI * Math.min(1, p / .29));
      const travel = reduced ? 0 : ease(p) * (critical ? 35 : n.kind === "tick" ? 16 : 25);
      const x = clamp(src.x + n.lane * 33, rect.left + n.halfWidth + 6, rect.right - n.halfWidth - 6);
      const y = clamp(src.y - 24 - travel - Math.abs(n.lane) * 11, rect.top + 19, rect.bottom - 24);
      n.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${scale.toFixed(3)})`;
      n.el.style.opacity = String(Math.min(1, (1 - p) / .27));
      n.el.style.visibility = "visible";
    }
    this.bursts = this.bursts.filter((e) => now - e.start < e.style.duration * (reduced ? 420 : 1000));
    if (!this.bursts.length) { this.canvas.hidden = true; return; }
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = Math.ceil((rect.left + width) * dpr), ch = Math.ceil((rect.top + height) * dpr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.canvas.hidden = false;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw / dpr, ch / dpr);
    this.canvas.dataset.effects = [...new Set(this.bursts.map((e) => e.kind))].join(" ");
    for (const e of this.bursts) {
      const v = units.get(e.key);
      if (e.status && (!v || v.dead || !v.root.visible)) continue;
      const center = project(e.status ? anchors(v).body : e.pos);
      const p = (now - e.start) / (e.style.duration * (reduced ? 420 : 1000));
      const k = clamp(height / 820, .73, 1.22);
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.scale(k, k);
      ctx.globalAlpha = Math.min(1, (1 - p) * 2.2) * (reduced ? .65 : .96);
      ctx.strokeStyle = e.style.color;
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.lineWidth = e.kind === "crit" ? 2.55 : 1.8;
      ctx.shadowColor = e.status ? e.style.color : "#2a183b";
      ctx.shadowBlur = e.kind === "hit" ? 3 : 7;
      if (reduced && e.status) icon(ctx, e.kind, 0, 0, 23);
      else (e.status ? statusDraw : hitDraw)[e.kind](ctx, reduced ? .20 : ease(p));
      ctx.restore();
    }
  }
}
