/*
 * Cyberpunk Spider - in-window runtime.
 *
 * Injected into VS Code's workbench.html. Plain browser JS: no Node, no VS Code API.
 * The workbench CSP enforces Trusted Types, so this file never uses innerHTML or
 * script.src; it only uses DOM APIs, <canvas> and fetch() for live config updates.
 */
(function () {
  'use strict';
  if (window.__CYBER_SPIDER_LOADED__) { return; }
  window.__CYBER_SPIDER_LOADED__ = true;

  const TAU = Math.PI * 2;
  const CONFIG_URL = 'cyberpunk-spider.config.json';
  const DEFAULTS = {
    enabled: true,
    speed: 120,
    idleDelaySeconds: 30,
    scale: 1,
    glowIntensity: 1,
    colors: ['#00f0ff', '#b026ff', '#39ff14'],
    colorCycleSeconds: 6,
    silkTrails: true,
    bugHunter: true,
  };
  const ALERT = { r: 255, g: 42, b: 77 };
  const WHITE = { r: 255, g: 255, b: 255 };

  // ------------------------------------------------------------------ helpers
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const easeInOut = (t) => t * t * (3 - 2 * t);
  const angDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) { d -= TAU; }
    if (d < -Math.PI) { d += TAU; }
    return d;
  };
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) { return { r: 0, g: 240, b: 255 }; }
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const mix = (a, b, t) => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });
  const rgba = (c, a) => 'rgba(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')';

  function sanitize(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object') { return out; }
    const num = (k, min, max) => { const v = Number(raw[k]); if (Number.isFinite(v)) { out[k] = clamp(v, min, max); } };
    const bool = (k) => { if (typeof raw[k] === 'boolean') { out[k] = raw[k]; } };
    bool('enabled'); bool('silkTrails'); bool('bugHunter');
    num('speed', 20, 500); num('idleDelaySeconds', 3, 3600); num('scale', 0.4, 3);
    num('glowIntensity', 0, 2); num('colorCycleSeconds', 2, 120);
    if (Array.isArray(raw.colors)) {
      const c = raw.colors.filter((x) => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x));
      if (c.length) { out.colors = c; }
    }
    return out;
  }

  // ------------------------------------------------------------------ state
  const cfg = Object.assign({}, DEFAULTS, sanitize(window.__CYBER_SPIDER_BOOT__));
  let layer = null, canvas = null, ctx = null;
  let W = 0, H = 0, dpr = 1;
  let clock = 0;                  // ms, advances only while the spider is running
  let lastTs = null;
  let lastActivity = 0;
  let colorClock = 0;
  let color = hexToRgb(cfg.colors[0]);
  let errors = [];
  const cooldown = new Map();     // error key -> clock expiry
  let huntCooldownUntil = 0;
  let web = null;
  const threads = [];
  let silkAcc = 0;
  let glitchT = 0;
  let nextGlitch = 5000;
  let pollFails = 0;

  const sp = {
    x: 300, y: 300, vx: 0, vy: 0, heading: 0, u: 9,
    mode: 'wander',               // wander | hunt | inspect | toCorner | weave | rest
    target: null, pause: 0.6, speedMul: 1,
    legs: [], lastSilk: null,
    errCx: 0, errCy: 0, errRect: null, errKey: '', inspectT: 0,
  };

  // Leg layout in units of u: attach point (on the body) and home (rest) position. x = forward, y = lateral.
  const BASE_U = 10;
  const LEG_DEF = [
    { ax: 0.9, ay: 0.5, hx: 4.8, hy: 3.7 },
    { ax: 0.45, ay: 0.65, hx: 2.5, hy: 5.4 },
    { ax: -0.05, ay: 0.7, hx: -1.6, hy: 5.4 },
    { ax: -0.5, ay: 0.6, hx: -4.7, hy: 4.3 },
  ];
  const LEG_L1 = 3.3, LEG_L2 = 3.5; // bone lengths in units of u (reach 6.8u vs ~5u rest distance)

  function toWorld(fwd, lat) {
    const c = Math.cos(sp.heading), s = Math.sin(sp.heading);
    return { x: sp.x + c * fwd - s * lat, y: sp.y + s * fwd + c * lat };
  }

  // ------------------------------------------------------------------ DOM layer
  function mountLayer() {
    layer = document.createElement('div');
    layer.id = 'cyberpunk-spider-layer';
    layer.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;overflow:hidden;';
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    layer.appendChild(canvas);
    document.body.appendChild(layer);
    ctx = canvas.getContext('2d');
    layer.style.display = cfg.enabled ? '' : 'none';
    resize();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  function ensureMounted() {
    if (layer && !layer.isConnected && document.body) { document.body.appendChild(layer); }
  }

  // ------------------------------------------------------------------ legs / IK
  function homeOf(leg) {
    const d = LEG_DEF[leg.i];
    return toWorld(d.hx * sp.u, d.hy * sp.u * leg.side);
  }

  function initSpider() {
    sp.x = rand(W * 0.25, W * 0.75);
    sp.y = rand(H * 0.25, H * 0.75);
    sp.heading = rand(0, TAU);
    sp.u = BASE_U * cfg.scale;
    sp.legs = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        sp.legs.push({
          i, side, group: (i + (side > 0 ? 1 : 0)) % 2,
          fx: 0, fy: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 0, stepping: false, lift: 0,
          base: { x: 0, y: 0 }, knee: { x: 0, y: 0 }, end: { x: 0, y: 0 },
        });
      }
    }
    for (const leg of sp.legs) { const h = homeOf(leg); leg.fx = h.x; leg.fy = h.y; }
    updateLegs(0.016);
  }

  // Analytic two-bone IK. The knee is picked on the side farthest from the body centre.
  function solveIK(leg, base, L1, L2) {
    const dx = leg.fx - base.x, dy = leg.fy - base.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const dc = clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const a = Math.atan2(dy, dx);
    const cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1);
    const ang = Math.acos(cosA);
    const k1 = { x: base.x + Math.cos(a + ang) * L1, y: base.y + Math.sin(a + ang) * L1 };
    const k2 = { x: base.x + Math.cos(a - ang) * L1, y: base.y + Math.sin(a - ang) * L1 };
    leg.knee = dist(k1.x, k1.y, sp.x, sp.y) >= dist(k2.x, k2.y, sp.x, sp.y) ? k1 : k2;
    leg.end = { x: base.x + Math.cos(a) * dc, y: base.y + Math.sin(a) * dc };
  }

  function updateLegs(dt) {
    const u = sp.u;
    const speed = Math.hypot(sp.vx, sp.vy);
    const nx = speed > 1 ? sp.vx / speed : 0;
    const ny = speed > 1 ? sp.vy / speed : 0;
    const lead = Math.min(speed * 0.15, 1.3 * u);
    const stepDur = clamp(0.2 - speed / 1600, 0.09, 0.2);
    const L1 = LEG_L1 * u, L2 = LEG_L2 * u;
    for (const leg of sp.legs) {
      const d = LEG_DEF[leg.i];
      const home = homeOf(leg);
      const tx = home.x + nx * lead, ty = home.y + ny * lead;
      if (leg.stepping) {
        leg.t += dt / stepDur;
        leg.tx = tx; leg.ty = ty;
        if (leg.t >= 1) {
          leg.stepping = false; leg.t = 1; leg.lift = 0;
          leg.fx = leg.tx; leg.fy = leg.ty;
        } else {
          const e = easeInOut(leg.t);
          leg.fx = lerp(leg.sx, leg.tx, e);
          leg.fy = lerp(leg.sy, leg.ty, e);
          leg.lift = Math.sin(Math.PI * leg.t);
        }
      } else {
        const dd = dist(leg.fx, leg.fy, home.x, home.y);
        if (dd > 1.5 * u) {
          // Tetrapod-like gait: a leg waits while the opposite group is mid-step.
          const blocked = sp.legs.some((o) => o.stepping && o.group !== leg.group);
          if (!blocked || dd > 2.4 * u) {
            leg.stepping = true; leg.t = 0;
            leg.sx = leg.fx; leg.sy = leg.fy; leg.tx = tx; leg.ty = ty;
          }
        }
      }
      leg.base = toWorld(d.ax * u, d.ay * u * leg.side);
      solveIK(leg, leg.base, L1, L2);
    }
  }

  // ------------------------------------------------------------------ steering
  function steer(dt, desiredSpeed, tx, ty, arrive) {
    let dvx = 0, dvy = 0;
    if (tx !== null) {
      const dx = tx - sp.x, dy = ty - sp.y;
      const d = Math.hypot(dx, dy) || 1;
      let s = desiredSpeed;
      if (arrive) { s *= clamp(d / 80, 0.12, 1); }
      dvx = (dx / d) * s; dvy = (dy / d) * s;
    }
    const k = Math.min(1, dt * 4.5);
    sp.vx += (dvx - sp.vx) * k;
    sp.vy += (dvy - sp.vy) * k;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    const speed = Math.hypot(sp.vx, sp.vy);
    if (speed > 10) {
      sp.heading += angDiff(sp.heading, Math.atan2(sp.vy, sp.vx)) * Math.min(1, dt * 7);
      sp.heading %= TAU;
    }
    const m = 6; // must stay smaller than the web inset, or corner waypoints become unreachable
    sp.x = clamp(sp.x, m, Math.max(m, W - m));
    sp.y = clamp(sp.y, m, Math.max(m, H - m));
  }

  // ------------------------------------------------------------------ errors (bug hunter)
  // The workbench renderer cannot call the VS Code API, so we read Monaco's own DOM:
  // error squiggles are elements with the `squiggly-error` class.
  function scanErrors() {
    if (!cfg.enabled || !cfg.bugHunter) { errors = []; return; }
    const nodes = document.querySelectorAll('.monaco-editor .squiggly-error');
    const out = [];
    for (let i = 0; i < nodes.length && out.length < 40; i++) {
      const r = nodes[i].getBoundingClientRect();
      if (r.width < 3 || r.height < 2) { continue; }
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) { continue; }
      out.push({
        left: r.left, top: r.top, width: r.width, height: r.height,
        cx: r.left + r.width / 2, cy: r.top + r.height / 2,
        key: Math.round(r.left / 40) + ':' + Math.round(r.top / 40) + ':' + Math.round(r.width / 40),
      });
    }
    errors = out;
  }

  function findErrorNear(cx, cy) {
    let best = null, bd = 160;
    for (const e of errors) {
      const d = dist(cx, cy, e.cx, e.cy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function maybeStartHunt() {
    if (!cfg.bugHunter || clock < huntCooldownUntil || errors.length === 0) { return false; }
    let best = null, bd = Infinity;
    for (const e of errors) {
      if ((cooldown.get(e.key) || 0) > clock) { continue; }
      const d = dist(sp.x, sp.y, e.cx, e.cy);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { return false; }
    sp.mode = 'hunt';
    sp.errCx = best.cx; sp.errCy = best.cy; sp.errRect = best; sp.errKey = best.key;
    sp.inspectT = 0;
    return true;
  }

  // ------------------------------------------------------------------ web (idle behaviour)
  function cornerInfo(name, inset) {
    switch (name) {
      case 'tl': return { x: inset, y: inset, a0: 0 };
      case 'tr': return { x: W - inset, y: inset, a0: Math.PI / 2 };
      case 'br': return { x: W - inset, y: H - inset, a0: Math.PI };
      default: return { x: inset, y: H - inset, a0: Math.PI * 1.5 };
    }
  }

  function pickCorner() {
    const names = ['tl', 'tr', 'br', 'bl'];
    const caret = document.querySelector('.monaco-editor .cursors-layer .cursor');
    if (!caret) { return names[Math.floor(Math.random() * 4)]; }
    const r = caret.getBoundingClientRect();
    const cx = r.left, cy = r.top;
    let best = 'br', bd = -1;
    for (const n of names) {
      const c = cornerInfo(n, 0);
      const d = dist(cx, cy, c.x, c.y);
      if (d > bd) { bd = d; best = n; }
    }
    return best;
  }

  function buildWeb(name) {
    const o = cornerInfo(name, 14);
    const R = clamp(Math.min(W, H) * 0.26, 140, 240) * clamp(cfg.scale, 0.8, 1.4);
    const N = 7, RINGS = 5;
    const dirs = [];
    for (let i = 0; i < N; i++) {
      const a = o.a0 + (i / (N - 1)) * (Math.PI / 2);
      dirs.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    const pt = (i, k) => ({ x: o.x + dirs[i].x * (R * k / RINGS), y: o.y + dirs[i].y * (R * k / RINGS) });
    const edges = [], wp = [];
    const edge = (A, B, curved) => {
      const e = { ax: A.x, ay: A.y, bx: B.x, by: B.y, curved, prog: 0, cx: 0, cy: 0 };
      if (curved) {
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        e.cx = mx + (o.x - mx) * 0.16; e.cy = my + (o.y - my) * 0.16;
      }
      edges.push(e);
      return e;
    };
    for (let i = 0; i < N; i++) {
      const tip = pt(i, RINGS);
      wp.push({ x: tip.x, y: tip.y, edge: edge(o, tip, false) });
      wp.push({ x: o.x, y: o.y, edge: null });
    }
    let forward = true;
    for (let k = RINGS; k >= 1; k--) {
      const order = [];
      for (let i = 0; i < N; i++) { order.push(forward ? i : N - 1 - i); }
      const first = pt(order[0], k);
      wp.push({ x: first.x, y: first.y, edge: null });
      for (let j = 1; j < N; j++) {
        const A = pt(order[j - 1], k), B = pt(order[j], k);
        wp.push({ x: B.x, y: B.y, edge: edge(A, B, true) });
      }
      forward = !forward;
    }
    return { corner: name, o: o, edges: edges, wp: wp, i: 0, segLen: 0, alpha: 1, fading: false };
  }

  function startWebTrip() {
    web = null;
    sp.corner = pickCorner();
    const o = cornerInfo(sp.corner, 14);
    sp.target = { x: o.x, y: o.y };
    sp.mode = 'toCorner';
  }

  function onActivity() {
    lastActivity = clock;
    if (sp.mode === 'toCorner' || sp.mode === 'weave' || sp.mode === 'rest') {
      sp.mode = 'wander';
      sp.target = null;
      sp.pause = 0;
      if (web) { web.fading = true; }
    }
  }

  // ------------------------------------------------------------------ update
  function updateColor(dt) {
    const colors = cfg.colors.length ? cfg.colors : DEFAULTS.colors;
    const n = colors.length;
    colorClock += dt;
    if (n === 1) { color = hexToRgb(colors[0]); return; }
    const period = Math.max(2, cfg.colorCycleSeconds);
    const idx = Math.floor(colorClock / period);
    const phase = (colorClock % period) / period;
    const t = phase > 0.8 ? easeInOut((phase - 0.8) / 0.2) : 0;
    color = mix(hexToRgb(colors[idx % n]), hexToRgb(colors[(idx + 1) % n]), t);
  }

  function pickWanderTarget() {
    for (let i = 0; i < 6; i++) {
      const x = rand(60, Math.max(61, W - 60)), y = rand(60, Math.max(61, H - 60));
      if (dist(x, y, sp.x, sp.y) > 200) { return { x: x, y: y }; }
    }
    return { x: rand(60, Math.max(61, W - 60)), y: rand(60, Math.max(61, H - 60)) };
  }

  function update(dt) {
    sp.u = BASE_U * cfg.scale;
    updateColor(dt);
    const speed = cfg.speed;

    switch (sp.mode) {
      case 'wander': {
        sp.errRect = null;
        if (sp.pause > 0) {
          sp.pause -= dt;
          steer(dt, 0, null, null, false);
        } else {
          if (!sp.target) { sp.target = pickWanderTarget(); }
          steer(dt, speed * sp.speedMul, sp.target.x, sp.target.y, true);
          if (dist(sp.x, sp.y, sp.target.x, sp.target.y) < 24) {
            sp.target = null;
            sp.pause = rand(0.2, 1.8);
            sp.speedMul = rand(0.6, 1.3);
          }
        }
        if (!maybeStartHunt() && clock - lastActivity > cfg.idleDelaySeconds * 1000) { startWebTrip(); }
        break;
      }
      case 'hunt': {
        const e = findErrorNear(sp.errCx, sp.errCy);
        if (!e) { sp.mode = 'wander'; sp.target = null; break; }
        sp.errCx = e.cx; sp.errCy = e.cy; sp.errRect = e; sp.errKey = e.key;
        steer(dt, speed * 1.4, e.cx, e.cy + e.height, true);
        if (dist(sp.x, sp.y, e.cx, e.cy) < 70 + e.width * 0.25) { sp.mode = 'inspect'; sp.inspectT = 0; }
        break;
      }
      case 'inspect': {
        const e = findErrorNear(sp.errCx, sp.errCy);
        if (!e) { sp.mode = 'wander'; sp.target = null; break; }
        sp.errCx = e.cx; sp.errCy = e.cy; sp.errRect = e;
        sp.inspectT += dt;
        const dur = 3.4;
        const tt = clamp(sp.inspectT / dur, 0, 1);
        const p = tt < 0.5 ? tt * 2 : 2 - tt * 2;
        const x = lerp(e.left, e.left + e.width, p);
        const y = e.top + e.height + 16 + Math.sin(sp.inspectT * 5) * 3;
        steer(dt, speed * 0.8, x, y, false);
        if (sp.inspectT >= dur) {
          cooldown.set(sp.errKey, clock + 25000);
          huntCooldownUntil = clock + 4000;
          sp.mode = 'wander'; sp.target = null; sp.pause = 0.4;
        }
        break;
      }
      case 'toCorner': {
        steer(dt, speed * 1.2, sp.target.x, sp.target.y, true);
        if (dist(sp.x, sp.y, sp.target.x, sp.target.y) < 14) {
          web = buildWeb(sp.corner);
          web.segLen = dist(sp.x, sp.y, web.wp[0].x, web.wp[0].y);
          sp.mode = 'weave';
        }
        break;
      }
      case 'weave': {
        const wp = web && web.wp[web.i];
        if (!wp) { sp.mode = 'rest'; sp.target = null; break; }
        steer(dt, clamp(speed * 1.1, 110, 260), wp.x, wp.y, false);
        const d = dist(sp.x, sp.y, wp.x, wp.y);
        if (wp.edge) {
          const lag = Math.min(2.5 * sp.u, web.segLen * 0.3);
          wp.edge.prog = clamp((web.segLen - d - lag) / Math.max(1, web.segLen - lag), 0, 1);
        }
        if (d < 8) {
          if (wp.edge) { wp.edge.prog = 1; }
          web.i++;
          const next = web.wp[web.i];
          web.segLen = next ? dist(wp.x, wp.y, next.x, next.y) : 0;
        }
        break;
      }
      default: { // 'rest': web finished, wait for the user to come back
        steer(dt, 0, null, null, false);
        break;
      }
    }

    updateLegs(dt);
    emitSilk(dt);

    if (web && web.fading) {
      web.alpha -= dt / 1.4;
      if (web.alpha <= 0) { web = null; }
    }
    glitchT = Math.max(0, glitchT - dt);
    if (clock > nextGlitch) { glitchT = rand(0.1, 0.22); nextGlitch = clock + rand(4000, 9000); }
  }

  // ------------------------------------------------------------------ silk threads
  function emitSilk(dt) {
    if (!cfg.silkTrails) { threads.length = 0; sp.lastSilk = null; return; }
    const speed = Math.hypot(sp.vx, sp.vy);
    if (speed < 25) { sp.lastSilk = null; return; }
    silkAcc += dt;
    if (silkAcc < 0.04) { return; }
    silkAcc = 0;
    const p = toWorld(-3.4 * sp.u, 0);
    if (sp.lastSilk) {
      threads.push({ x1: sp.lastSilk.x, y1: sp.lastSilk.y, x2: p.x, y2: p.y, born: clock, life: 2600 });
      if (Math.random() < 0.3) {
        const a = Math.random() * TAU, l = rand(6, 16) * cfg.scale;
        threads.push({ x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * l, y2: p.y + Math.sin(a) * l, born: clock, life: 1800 });
      }
    }
    sp.lastSilk = p;
    while (threads.length > 420) { threads.shift(); }
  }

  // ------------------------------------------------------------------ rendering
  function strokeGlow(path, col, w, alpha, glowScale) {
    const g = cfg.glowIntensity * (glowScale === undefined ? 1 : glowScale);
    if (g > 0.01) {
      ctx.strokeStyle = rgba(col, 0.07 * g * alpha); ctx.lineWidth = w * 5; ctx.stroke(path);
      ctx.strokeStyle = rgba(col, 0.18 * g * alpha); ctx.lineWidth = w * 2.6; ctx.stroke(path);
    }
    ctx.strokeStyle = rgba(mix(col, WHITE, 0.35), 0.95 * alpha);
    ctx.lineWidth = w;
    ctx.stroke(path);
  }

  function dot(x, y, r, col, alpha) {
    const g = cfg.glowIntensity;
    if (g > 0.01) {
      ctx.fillStyle = rgba(col, 0.12 * g * alpha);
      ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col, 0.28 * g * alpha);
      ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgba(mix(col, WHITE, 0.55), alpha);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function drawThreads() {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    let w = 0;
    for (let i = 0; i < threads.length; i++) {
      const t = threads[i];
      const age = clock - t.born;
      if (age > t.life) { continue; }
      threads[w++] = t;
      const a = Math.pow(1 - age / t.life, 1.6) * 0.55;
      ctx.strokeStyle = rgba(color, a);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    threads.length = w;
  }

  function edgePoints(e) {
    const prog = e.prog;
    if (!e.curved) {
      return [{ x: e.ax, y: e.ay }, { x: lerp(e.ax, e.bx, prog), y: lerp(e.ay, e.by, prog) }];
    }
    const pts = [];
    const n = Math.max(2, Math.ceil(10 * prog));
    for (let s = 0; s <= n; s++) {
      const t = (prog * s) / n, m = 1 - t;
      pts.push({ x: m * m * e.ax + 2 * m * t * e.cx + t * t * e.bx, y: m * m * e.ay + 2 * m * t * e.cy + t * t * e.by });
    }
    return pts;
  }

  function drawWeb() {
    if (!web) { return; }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const a = clamp(web.alpha, 0, 1);
    for (const e of web.edges) {
      if (e.prog <= 0) { continue; }
      const pts = edgePoints(e);
      const p = new Path2D();
      p.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) { p.lineTo(pts[i].x, pts[i].y); }
      strokeGlow(p, color, 0.9, 0.6 * a, 0.5);
      if (e.curved && e.prog >= 1) { dot(e.bx, e.by, 1.3, color, 0.7 * a); }
    }
  }

  function drawErrorOverlay() {
    const r = sp.errRect;
    if (!r || (sp.mode !== 'hunt' && sp.mode !== 'inspect')) { return; }
    const t = clock / 1000, pad = 5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -t * 20;
    ctx.strokeStyle = rgba(ALERT, 0.4 + 0.25 * Math.sin(t * 8));
    ctx.strokeRect(r.left - pad, r.top - pad, r.width + pad * 2, r.height + pad * 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(ALERT, 0.22);
    ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(r.cx, r.cy); ctx.stroke();
  }

  function drawSpider(col, ox, oy, alpha, fill) {
    const u = sp.u, sc = cfg.scale;
    const alert = sp.mode === 'inspect' || sp.mode === 'hunt';
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // legs
    ctx.globalCompositeOperation = 'lighter';
    for (const leg of sp.legs) {
      // thicker femur, thinner tibia; a lifted (stepping) leg is slightly bolder
      const lift = 1 + 0.45 * leg.lift;
      const femur = new Path2D(); femur.moveTo(leg.base.x, leg.base.y); femur.lineTo(leg.knee.x, leg.knee.y);
      const tibia = new Path2D(); tibia.moveTo(leg.knee.x, leg.knee.y); tibia.lineTo(leg.end.x, leg.end.y);
      strokeGlow(femur, col, 2.4 * sc * lift, alpha);
      strokeGlow(tibia, col, 1.5 * sc * lift, alpha);
      dot(leg.knee.x, leg.knee.y, 1.8 * sc, col, alpha);
      dot(leg.end.x, leg.end.y, 1.1 * sc, col, alpha);
    }

    // body
    const th = toWorld(0.9 * u, 0), ab = toWorld(-1.5 * u, 0);
    const thP = new Path2D(); thP.ellipse(th.x, th.y, 1.25 * u, 0.95 * u, sp.heading, 0, TAU);
    const abP = new Path2D(); abP.ellipse(ab.x, ab.y, 1.9 * u, 1.35 * u, sp.heading, 0, TAU);
    if (fill) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(5,7,18,0.93)';
      ctx.fill(abP); ctx.fill(thP);
    }
    ctx.globalCompositeOperation = 'lighter';
    strokeGlow(abP, col, 1.6 * sc, alpha);
    strokeGlow(thP, col, 1.6 * sc, alpha);

    // abdomen circuit chevrons
    for (let k = 0; k < 3; k++) {
      const fwd = (-0.6 - k * 0.75) * u, spread = (1.15 - k * 0.28) * u;
      const a = toWorld(fwd, -spread), b = toWorld(fwd - 0.55 * u, 0), c = toWorld(fwd, spread);
      const p = new Path2D(); p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); p.lineTo(c.x, c.y);
      strokeGlow(p, col, 1.1 * sc, alpha * 0.9);
    }
    dot(ab.x, ab.y, (0.32 + 0.08 * Math.sin(clock / 260)) * u, col, alpha);

    // fangs + eyes
    const eyeCol = alert ? ALERT : mix(col, WHITE, 0.4);
    for (const s of [-1, 1]) {
      const f0 = toWorld(1.9 * u, s * 0.3 * u), f1 = toWorld(2.7 * u, s * 0.14 * u);
      const p = new Path2D(); p.moveTo(f0.x, f0.y); p.lineTo(f1.x, f1.y);
      strokeGlow(p, col, 1.1 * sc, alpha);
      const e1 = toWorld(1.95 * u, s * 0.4 * u), e2 = toWorld(1.5 * u, s * 0.66 * u);
      dot(e1.x, e1.y, 0.26 * u, eyeCol, alpha);
      dot(e2.x, e2.y, 0.16 * u, eyeCol, alpha);
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    drawThreads();
    drawWeb();
    drawErrorOverlay();
    if (glitchT > 0) {
      const o = 3 * cfg.scale;
      drawSpider({ r: 255, g: 0, b: 230 }, o, -o * 0.35, 0.55, false);
      drawSpider({ r: 0, g: 240, b: 255 }, -o, o * 0.35, 0.55, false);
    }
    drawSpider(color, 0, 0, 1, true);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ main loop + config
  function frame(ts) {
    requestAnimationFrame(frame);
    if (lastTs === null) { lastTs = ts; }
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    if (!cfg.enabled || document.hidden || !ctx) { return; }
    clock += dt * 1000;
    update(dt);
    render();
  }

  function applyConfig(raw) {
    const next = sanitize(raw);
    const wasEnabled = cfg.enabled;
    Object.assign(cfg, next);
    if (layer) { layer.style.display = cfg.enabled ? '' : 'none'; }
    if (cfg.enabled && !wasEnabled) { lastActivity = clock; }
    if (!cfg.enabled) { web = null; threads.length = 0; errors = []; }
  }

  function pollConfig() {
    if (typeof fetch !== 'function' || pollFails >= 4) { return; }
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then((r) => { if (!r.ok) { throw new Error('http ' + r.status); } return r.json(); })
      .then((j) => { pollFails = 0; applyConfig(j); })
      .catch(() => { pollFails++; }); // after 4 failures we stop: settings then apply on reload
  }

  function start() {
    mountLayer();
    initSpider();
    window.addEventListener('resize', resize);
    // Typing is the only activity signal. The mouse is deliberately ignored.
    window.addEventListener('keydown', onActivity, true);
    setInterval(scanErrors, 600);
    setInterval(pollConfig, 3000);
    setInterval(ensureMounted, 2000);
    requestAnimationFrame(frame);
  }

  // Test hooks (harmless in production).
  window.__CYBER_SPIDER__ = {
    sp: sp,
    cfg: cfg,
    getWeb: () => web,
    getThreads: () => threads,
    applyConfig: applyConfig,
    scanErrors: scanErrors,
    now: () => clock,
  };

  if (document.body) { start(); } else { document.addEventListener('DOMContentLoaded', start, { once: true }); }
})();
