"use strict";
(() => {
  // src/shared/types.ts
  var PRESETS = {
    "Spider-Verse": ["#39ff14", "#b026ff", "#00f0ff", "#ff2bd6"],
    "Neon Tokyo": ["#ff2bd6", "#00f0ff", "#fff200"],
    Matrix: ["#00ff41", "#00b82e", "#b8ffcb"],
    Synthwave: ["#ff6ec7", "#7a5cff", "#00e5ff"],
    Miles: ["#ff1e3c", "#00f0ff", "#ffffff"]
  };
  var DEFAULT_CONFIG = {
    enabled: true,
    speed: 1,
    size: 1,
    glow: 0.8,
    idleSeconds: 60,
    palette: PRESETS["Spider-Verse"],
    huntBugs: true,
    silkTrail: true
  };
  var ASSET_CONFIG_JSON = "cyberpunk-spider.config.json";
  var CONFIG_GLOBAL = "__CYBERPUNK_SPIDER_CONFIG__";
  var HEX = /^#[0-9a-f]{6}$/i;
  function num(v, min, max, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  }
  function bool(v, fallback) {
    return typeof v === "boolean" ? v : fallback;
  }
  function sanitizeConfig(raw) {
    const r = raw ?? {};
    const palette = Array.isArray(r.palette) ? r.palette.filter((c) => typeof c === "string" && HEX.test(c)).slice(0, 8) : [];
    return {
      enabled: bool(r.enabled, DEFAULT_CONFIG.enabled),
      speed: num(r.speed, 0.3, 3, DEFAULT_CONFIG.speed),
      size: num(r.size, 0.5, 2.5, DEFAULT_CONFIG.size),
      glow: num(r.glow, 0, 1, DEFAULT_CONFIG.glow),
      idleSeconds: num(r.idleSeconds, 10, 3600, DEFAULT_CONFIG.idleSeconds),
      palette: palette.length ? palette : [...DEFAULT_CONFIG.palette],
      huntBugs: bool(r.huntBugs, DEFAULT_CONFIG.huntBugs),
      silkTrail: bool(r.silkTrail, DEFAULT_CONFIG.silkTrail)
    };
  }

  // src/injected/math.ts
  var add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  var mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  var dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  var lerp = (a, b, t) => a + (b - a) * t;
  var lerpV = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  var clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  var rand = (a, b) => a + Math.random() * (b - a);
  function rot(a, ang) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
  }
  function angleDiff(to, from) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // src/injected/ik.ts
  function solveTwoBone(hip, target, l1, l2, bend) {
    let dx = target.x - hip.x;
    let dy = target.y - hip.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      dx = 1;
      dy = 0;
      d = 1e-6;
    }
    const minD = Math.abs(l1 - l2) + 1e-3;
    const maxD = l1 + l2 - 1e-3;
    const dc = Math.min(maxD, Math.max(minD, d));
    const ux = dx / d;
    const uy = dy / d;
    const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return {
      knee: { x: hip.x + ux * a - uy * h * bend, y: hip.y + uy * a + ux * h * bend },
      foot: { x: hip.x + ux * dc, y: hip.y + uy * dc }
    };
  }

  // src/injected/spider.ts
  var L1 = 34;
  var L2 = 44;
  var HIPS = [
    { x: 12, y: 4 },
    { x: 5, y: 5 },
    { x: -3, y: 5 },
    { x: -10, y: 4 }
  ];
  var REST = [
    { x: 54, y: 40 },
    { x: 30, y: 60 },
    { x: -8, y: 62 },
    { x: -46, y: 50 }
  ];
  var BEND_BASE = [1, 1, 1, -1];
  var ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  var Spider = class {
    pos;
    heading = 0;
    speed = 0;
    scale = 1;
    legs = [];
    constructor(x, y) {
      this.pos = { x, y };
      for (let pair = 0; pair < 4; pair++) {
        for (const side of [1, -1]) {
          const hipLocal = { x: HIPS[pair].x, y: HIPS[pair].y * side };
          const restLocal = { x: REST[pair].x, y: REST[pair].y * side };
          const p = { x, y };
          this.legs.push({
            hipLocal,
            restLocal,
            group: (pair + (side === 1 ? 0 : 1)) % 2,
            bend: side * BEND_BASE[pair],
            hip: { ...p },
            knee: { ...p },
            foot: add(p, restLocal),
            drawFoot: { ...p },
            from: { ...p },
            to: { ...p },
            t: 0,
            stepping: false
          });
        }
      }
      this.updateLegs(0);
      for (const l of this.legs) l.foot = this.ideal(l);
      this.updateLegs(0);
    }
    /** Point de filage (arrière de l'abdomen), pour la traînée de soie. */
    tail() {
      return add(this.pos, mul(rot({ x: -23, y: 0 }, this.heading), this.scale));
    }
    arrived(target, radius) {
      return dist(this.pos, target) <= radius;
    }
    stop(dt) {
      this.speed += (0 - this.speed) * Math.min(1, dt * 8);
      if (this.speed < 0.5) this.speed = 0;
    }
    /** Oriente et avance le corps vers la cible (vitesse en px/s). */
    steer(target, dt, maxSpeed, turnRate = 5) {
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        this.stop(dt);
        return;
      }
      const diff = angleDiff(Math.atan2(dy, dx), this.heading);
      const maxTurn = turnRate * dt;
      this.heading += clamp(diff, -maxTurn, maxTurn);
      const align = Math.max(0, Math.cos(diff));
      const arrive = Math.min(1, d / (60 * this.scale));
      const wanted = maxSpeed * arrive * (0.12 + 0.88 * align * align);
      this.speed += (wanted - this.speed) * Math.min(1, dt * 6);
      this.pos = {
        x: this.pos.x + Math.cos(this.heading) * this.speed * dt,
        y: this.pos.y + Math.sin(this.heading) * this.speed * dt
      };
    }
    ideal(l) {
      return add(this.pos, mul(rot(l.restLocal, this.heading), this.scale));
    }
    /** Démarche tétrapode : un groupe de pattes avance pendant que l'autre reste planté. */
    updateLegs(dt) {
      const stepDur = 0.11 + 0.06 * (1 - Math.min(1, this.speed / 220));
      const moving = [false, false];
      for (const l of this.legs) if (l.stepping) moving[l.group] = true;
      const dir = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
      const reach = (L1 + L2) * this.scale;
      for (const l of this.legs) {
        l.hip = add(this.pos, mul(rot(l.hipLocal, this.heading), this.scale));
        if (l.stepping) {
          l.t += dt / stepDur;
          if (l.t >= 1) {
            l.t = 1;
            l.stepping = false;
            l.foot = l.to;
          } else {
            l.foot = lerpV(l.from, l.to, ease(l.t));
          }
        } else {
          const ideal = this.ideal(l);
          const over = dist(l.foot, l.hip) > reach * 0.93;
          const need = dist(l.foot, ideal) > 22 * this.scale || over;
          if (need && (over || !moving[1 - l.group])) {
            const lead = clamp(this.speed * 0.16, 0, 30 * this.scale);
            l.from = { ...l.foot };
            l.to = add(ideal, mul(dir, lead));
            l.t = 0;
            l.stepping = true;
            moving[l.group] = true;
          }
        }
        const a = solveTwoBone(l.hip, l.foot, L1 * this.scale, L2 * this.scale, 1);
        const b = solveTwoBone(l.hip, l.foot, L1 * this.scale, L2 * this.scale, -1);
        const r = dist(a.knee, this.pos) >= dist(b.knee, this.pos) ? a : b;
        let knee = r.knee;
        if (l.stepping) {
          const lift = Math.sin(Math.PI * l.t) * 7 * this.scale;
          const kx = knee.x - l.hip.x;
          const ky = knee.y - l.hip.y;
          const kl = Math.hypot(kx, ky) || 1;
          knee = { x: knee.x + kx / kl * lift, y: knee.y + ky / kl * lift };
        }
        l.knee = knee;
        l.drawFoot = r.foot;
      }
    }
    /** Dessine pattes puis corps. `full=false` : seulement le trait net (couches glitch). */
    draw(ctx, color, glow, ox = 0, oy = 0, alpha = 1, full = true) {
      const s = this.scale;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const all = new Path2D();
      const femur = new Path2D();
      const tibia = new Path2D();
      for (const l of this.legs) {
        all.moveTo(l.hip.x, l.hip.y);
        all.lineTo(l.knee.x, l.knee.y);
        all.lineTo(l.drawFoot.x, l.drawFoot.y);
        femur.moveTo(l.hip.x, l.hip.y);
        femur.lineTo(l.knee.x, l.knee.y);
        tibia.moveTo(l.knee.x, l.knee.y);
        tibia.lineTo(l.drawFoot.x, l.drawFoot.y);
      }
      ctx.strokeStyle = color;
      if (full && glow > 0.02) {
        ctx.globalAlpha = alpha * 0.1 * glow;
        ctx.lineWidth = 10 * s;
        ctx.stroke(all);
        ctx.globalAlpha = alpha * 0.22 * glow;
        ctx.lineWidth = 5 * s;
        ctx.stroke(all);
      }
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = full ? 10 * glow : 0;
      ctx.lineWidth = 2.6 * s;
      ctx.stroke(femur);
      ctx.lineWidth = 1.7 * s;
      ctx.stroke(tibia);
      ctx.shadowBlur = 0;
      if (full) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 0.7 * s;
        ctx.stroke(all);
        ctx.fillStyle = "#ffffff";
        for (const l of this.legs) {
          ctx.beginPath();
          ctx.arc(l.drawFoot.x, l.drawFoot.y, 1.6 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(this.heading);
      ctx.scale(s, s);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = full ? 16 * glow : 0;
      ctx.fillStyle = "#05050b";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-10, 0, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(6, 0, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (full) {
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const x = -18 + k * 5;
          ctx.beginPath();
          ctx.moveTo(x, -5 + k);
          ctx.lineTo(x + 3, 0);
          ctx.lineTo(x, 5 - k);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        for (const sy of [1, -1]) {
          ctx.beginPath();
          ctx.arc(11, 2.2 * sy, 1.3, 0, Math.PI * 2);
          ctx.arc(8.5, 3.8 * sy, 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(14.5, 1.5 * sy);
          ctx.lineTo(17.5, 0.6 * sy);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.restore();
    }
  };

  // src/injected/color.ts
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var mixRgb = (a, b, t) => {
    const k = clamp(t, 0, 1);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  };
  var css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  var PaletteCycler = class {
    colors = [[57, 255, 20]];
    t = 0;
    secondsPerColor = 4;
    setPalette(hexes) {
      if (hexes.length) this.colors = hexes.map(hexToRgb);
    }
    update(dt) {
      this.t += dt / this.secondsPerColor;
    }
    current() {
      const n = this.colors.length;
      if (n === 1) return this.colors[0];
      const i = Math.floor(this.t) % n;
      const f = smoothstep(0.65, 1, this.t - Math.floor(this.t));
      return mixRgb(this.colors[i], this.colors[(i + 1) % n], f);
    }
  };

  // src/injected/web.ts
  var WebWeaver = class {
    nodes = [];
    total = 0;
    travelled = 0;
    alpha = 1;
    constructor(corner, sx, sy, radius) {
      const RAYS = 6;
      const RINGS = 7;
      const dirs = [];
      for (let i = 0; i < RAYS; i++) {
        const a = i / (RAYS - 1) * (Math.PI / 2);
        dirs.push({ x: sx * Math.cos(a), y: sy * Math.sin(a) });
      }
      const P = (k, i) => ({
        x: corner.x + dirs[i].x * radius * (k / RINGS),
        y: corner.y + dirs[i].y * radius * (k / RINGS)
      });
      const pts = [{ p: corner, draw: false }];
      const go = (p, draw) => pts.push({ p, draw });
      go(P(RINGS, 0), true);
      go(P(RINGS, 1), true);
      go(corner, true);
      go(P(RINGS, 2), true);
      go(P(RINGS, 3), true);
      go(corner, true);
      go(P(RINGS, 4), true);
      go(P(RINGS, 5), true);
      go(corner, true);
      go(P(RINGS, 0), false);
      let forward = true;
      for (let k = RINGS; k >= 2; k--) {
        if (forward) for (let i = 1; i < RAYS; i++) go(P(k, i), true);
        else for (let i = RAYS - 2; i >= 0; i--) go(P(k, i), true);
        if (k > 2) go(P(k - 1, forward ? RAYS - 1 : 0), true);
        forward = !forward;
      }
      let cum = 0;
      this.nodes = pts.map((n, i) => {
        if (i > 0) cum += dist(pts[i - 1].p, n.p);
        return { ...n, cum };
      });
      this.total = cum;
    }
    get done() {
      return this.travelled >= this.total - 0.5;
    }
    advance(d) {
      this.travelled = Math.min(this.total, this.travelled + d);
    }
    /** Position actuelle du « stylo » (là où l'araignée doit se rendre). */
    pen() {
      const n = this.nodes;
      for (let i = 1; i < n.length; i++) {
        if (this.travelled <= n[i].cum) {
          const span = n[i].cum - n[i - 1].cum || 1;
          return lerpV(n[i - 1].p, n[i].p, (this.travelled - n[i - 1].cum) / span);
        }
      }
      return n[n.length - 1].p;
    }
    render(ctx, rgb, glow) {
      if (this.alpha <= 0) return;
      const n = this.nodes;
      const path = new Path2D();
      const dots = [];
      for (let i = 1; i < n.length; i++) {
        if (!n[i].draw) continue;
        const span = n[i].cum - n[i - 1].cum || 1;
        const f = clamp((this.travelled - n[i - 1].cum) / span, 0, 1);
        if (f <= 0) continue;
        const a = n[i - 1].p;
        const e = lerpV(a, n[i].p, f);
        path.moveTo(a.x, a.y);
        path.lineTo(e.x, e.y);
        if (f >= 1) dots.push(n[i].p);
      }
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = css(rgb);
      ctx.globalAlpha = this.alpha * 0.14 * glow;
      ctx.lineWidth = 5;
      ctx.stroke(path);
      ctx.globalAlpha = this.alpha * 0.85;
      ctx.strokeStyle = css(mixRgb(rgb, [255, 255, 255], 0.45));
      ctx.lineWidth = 0.9;
      ctx.stroke(path);
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = this.alpha * 0.9;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  // src/injected/brain.ts
  var HUNT_COOLDOWN = 25;
  var Brain = class {
    constructor(spider) {
      this.spider = spider;
    }
    mode = "pause";
    /** 0..1 : teinte d'alerte pendant la chasse */
    alert = 0;
    web = null;
    fading = null;
    timer = 0.8;
    target = { x: 0, y: 0 };
    corner = { p: { x: 0, y: 0 }, sx: 1, sy: 1 };
    cruise = 1;
    huntCooldownUntil = 0;
    lastErr = 0;
    orbit = 0;
    focus = null;
    caret = null;
    update(dt, k) {
      const { cfg, idleMs, errors, now, w, h } = k;
      this.caret = k.caret;
      const sp = this.spider;
      const s = sp.scale;
      const idle = idleMs >= cfg.idleSeconds * 1e3;
      const inWeb = this.mode === "toCorner" || this.mode === "weave" || this.mode === "rest";
      if (inWeb && !idle) this.dropWeb(w, h);
      else if (!inWeb && idle) this.goCorner(w, h);
      if (this.fading) {
        this.fading.alpha -= dt / 1.3;
        if (this.fading.alpha <= 0) this.fading = null;
      }
      const canHunt = cfg.huntBugs && errors.count > 0 && !idle;
      if (canHunt && (this.mode === "wander" || this.mode === "pause")) {
        if (errors.count > this.lastErr || now > this.huntCooldownUntil) this.mode = "hunt";
      }
      if (!canHunt && (this.mode === "hunt" || this.mode === "inspect")) {
        this.mode = "pause";
        this.timer = 0.4;
        this.focus = null;
      }
      this.lastErr = errors.count;
      const wantAlert = this.mode === "hunt" || this.mode === "inspect" ? 1 : 0;
      this.alert += (wantAlert - this.alert) * Math.min(1, dt * 3);
      const v = cfg.speed;
      switch (this.mode) {
        case "pause":
          sp.stop(dt);
          this.timer -= dt;
          if (this.timer <= 0) this.pickWander(w, h);
          break;
        case "wander":
          sp.steer(this.target, dt, 150 * v * this.cruise);
          if (sp.arrived(this.target, 14 * s)) {
            this.mode = "pause";
            this.timer = rand(0.3, 1.8);
          }
          break;
        case "hunt": {
          const p = this.nearestError(errors);
          if (p) this.focus = p;
          if (this.focus) {
            sp.steer(this.focus, dt, 280 * v);
            if (dist(sp.pos, this.focus) < 36 * s) {
              this.mode = "inspect";
              this.timer = 3.4;
              this.orbit = Math.atan2(sp.pos.y - this.focus.y, sp.pos.x - this.focus.x);
            }
          }
          break;
        }
        case "inspect": {
          const p = this.nearestError(errors);
          if (p) this.focus = p;
          if (this.focus) {
            this.orbit += dt * 2.6;
            const t = {
              x: this.focus.x + Math.cos(this.orbit) * 38 * s,
              y: this.focus.y + Math.sin(this.orbit) * 38 * s
            };
            sp.steer(t, dt, 170 * v);
          }
          this.timer -= dt;
          if (this.timer <= 0) {
            this.huntCooldownUntil = now + HUNT_COOLDOWN;
            this.focus = null;
            this.pickWander(w, h);
          }
          break;
        }
        case "toCorner":
          sp.steer(this.corner.p, dt, 220 * v);
          if (sp.arrived(this.corner.p, 26 * s)) {
            const R = Math.min(340, Math.max(150, Math.min(w, h) * 0.32));
            this.web = new WebWeaver(this.corner.p, this.corner.sx, this.corner.sy, R);
            this.mode = "weave";
          }
          break;
        case "weave": {
          const web = this.web;
          if (!web) {
            this.mode = "rest";
            break;
          }
          const pen = web.pen();
          if (dist(sp.pos, pen) < 46 * s) web.advance(140 * Math.max(0.6, v) * dt);
          sp.steer(pen, dt, 260 * v);
          if (web.done) this.mode = "rest";
          break;
        }
        case "rest":
          sp.stop(dt);
          break;
      }
    }
    render(ctx, rgb, glow, now) {
      this.fading?.render(ctx, rgb, glow);
      this.web?.render(ctx, rgb, glow);
      if (this.mode === "inspect" && this.focus) this.drawReticle(ctx, rgb, now);
    }
    drawReticle(ctx, rgb, now) {
      const f = this.focus;
      const r = 20 + Math.sin(now * 6) * 3;
      ctx.save();
      ctx.strokeStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0.85)`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const a = now * 2 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, a, a + 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
    nearestError(e) {
      let best = null;
      let bd = Infinity;
      for (const p of e.points) {
        const d = dist(p, this.spider.pos);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    }
    pickWander(w, h) {
      const m = 40;
      this.target = { x: rand(m, Math.max(m + 1, w - m)), y: rand(m, Math.max(m + 1, h - m)) };
      this.cruise = Math.random() < 0.15 ? 2 : rand(0.6, 1.5);
      this.mode = "wander";
    }
    goCorner(w, h) {
      const m = 24;
      const corners = [
        { p: { x: m, y: m }, sx: 1, sy: 1 },
        { p: { x: w - m, y: m }, sx: -1, sy: 1 },
        { p: { x: m, y: h - m }, sx: 1, sy: -1 },
        { p: { x: w - m, y: h - m }, sx: -1, sy: -1 }
      ];
      const ref = this.caret;
      this.corner = ref ? corners.reduce((best, c) => dist(c.p, ref) > dist(best.p, ref) ? c : best) : corners[Math.floor(Math.random() * corners.length)];
      this.mode = "toCorner";
      this.focus = null;
    }
    dropWeb(w, h) {
      if (this.web) {
        this.fading = this.web;
        this.web = null;
      }
      this.pickWander(w, h);
    }
  };

  // src/injected/trail.ts
  var SilkTrail = class {
    pts = [];
    last = null;
    add(p, now, minStep = 7) {
      if (!this.last || dist(p, this.last) >= minStep) {
        this.pts.push({ x: p.x, y: p.y, t: now, seed: Math.random() });
        this.last = { ...p };
      }
    }
    render(ctx, rgb, now, life = 2.6) {
      while (this.pts.length && now - this.pts[0].t > life) this.pts.shift();
      if (this.pts.length < 2) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = css(rgb);
      for (let i = 1; i < this.pts.length; i++) {
        const a = 1 - (now - this.pts[i].t) / life;
        if (a <= 0) continue;
        const p0 = this.pts[i - 1];
        const p1 = this.pts[i];
        ctx.globalAlpha = a * 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const l = Math.hypot(dx, dy) || 1;
        const side = p1.seed > 0.5 ? 1 : -1;
        const sl = 4 + p1.seed * 8;
        ctx.globalAlpha = a * 0.3;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x + -dy / l * sl * side, p1.y + dx / l * sl * side);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  // src/injected/detect.ts
  function scanErrors(w, h) {
    const els = document.querySelectorAll(".monaco-editor .squiggly-error");
    const seen = /* @__PURE__ */ new Set();
    const points = [];
    const max = Math.min(els.length, 300);
    for (let i = 0; i < max; i++) {
      const r = els[i].getBoundingClientRect();
      if (r.width < 2 || r.height <= 0) continue;
      if (r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) continue;
      const key = Math.round(r.top / 12) + ":" + Math.round(r.left / 40);
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    return { count: points.length, points };
  }
  function caretPos() {
    const c = document.querySelector(".monaco-editor .cursors-layer .cursor");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top };
  }
  var ActivityTracker = class {
    last = performance.now();
    constructor() {
      const touch = () => {
        this.last = performance.now();
      };
      window.addEventListener("keydown", touch, { capture: true, passive: true });
      window.addEventListener("paste", touch, { capture: true, passive: true });
    }
    idleMs() {
      return performance.now() - this.last;
    }
  };

  // src/injected/main.ts
  var win = window;
  var ALERT = [255, 51, 85];
  var MAGENTA = [255, 43, 214];
  var CYAN = [0, 240, 255];
  function boot() {
    let cfg = sanitizeConfig(win[CONFIG_GLOBAL]);
    let pollFails = 0;
    const palette = new PaletteCycler();
    palette.setPalette(cfg.palette);
    const activity = new ActivityTracker();
    let running = false;
    let canvas = null;
    let ctx = null;
    let spider = null;
    let brain = null;
    const trail = new SilkTrail();
    let errors = { count: 0, points: [] };
    let caret = null;
    let raf = 0;
    let scanTimer = 0;
    let last = 0;
    let time = 0;
    let W = window.innerWidth;
    let H = window.innerHeight;
    let nextGlitch = 6;
    let glitchUntil = 0;
    function resize() {
      if (!canvas || !ctx) return;
      W = window.innerWidth;
      H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function start() {
      if (running || !document.body) return;
      running = true;
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;";
      document.body.appendChild(canvas);
      ctx = canvas.getContext("2d");
      resize();
      spider = new Spider(rand(100, Math.max(101, W - 100)), rand(100, Math.max(101, H - 100)));
      spider.scale = cfg.size;
      brain = new Brain(spider);
      activity.last = performance.now();
      last = performance.now();
      raf = requestAnimationFrame(frame);
      scanTimer = window.setInterval(() => {
        errors = scanErrors(W, H);
        caret = caretPos();
      }, 700);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(scanTimer);
      canvas?.remove();
      canvas = null;
      ctx = null;
    }
    function frame(t) {
      if (!running || !ctx || !spider || !brain) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (t - last) / 1e3));
      last = t;
      time += dt;
      palette.update(dt);
      spider.scale = cfg.size;
      brain.update(dt, { cfg, idleMs: activity.idleMs(), errors, caret, now: time, w: W, h: H });
      spider.updateLegs(dt);
      if (cfg.silkTrail && spider.speed > 18 * spider.scale) trail.add(spider.tail(), time);
      ctx.clearRect(0, 0, W, H);
      const rgb = mixRgb(palette.current(), ALERT, brain.alert * 0.7);
      if (cfg.silkTrail) trail.render(ctx, rgb, time);
      brain.render(ctx, rgb, cfg.glow, time);
      if (time >= nextGlitch) {
        glitchUntil = time + 0.14;
        nextGlitch = time + rand(5, 10);
      }
      if (time < glitchUntil) {
        ctx.globalCompositeOperation = "lighter";
        spider.draw(ctx, css(MAGENTA), cfg.glow, -3, 0, 0.55, false);
        spider.draw(ctx, css(CYAN), cfg.glow, 3, 1, 0.55, false);
        ctx.globalCompositeOperation = "source-over";
      }
      spider.draw(ctx, css(rgb), cfg.glow);
    }
    function applyConfig(next) {
      cfg = next;
      palette.setPalette(cfg.palette);
      if (cfg.enabled) start();
      else stop();
    }
    function pollConfig() {
      if (typeof fetch !== "function" || pollFails >= 4 || document.visibilityState === "hidden") return;
      fetch(ASSET_CONFIG_JSON, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }).then((j) => {
        pollFails = 0;
        applyConfig(sanitizeConfig(j));
      }).catch(() => {
        pollFails++;
      });
    }
    window.addEventListener("resize", resize);
    win.__cyberpunkSpiderDebug = { mode: () => brain?.mode, errors: () => errors, running: () => running };
    applyConfig(cfg);
    pollConfig();
    window.setInterval(pollConfig, 3e3);
  }
  if (!win.__cyberpunkSpiderBooted) {
    win.__cyberpunkSpiderBooted = true;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
