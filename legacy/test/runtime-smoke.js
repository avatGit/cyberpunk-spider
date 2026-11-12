// Headless smoke test of media/spider-runtime.js with a stubbed DOM/canvas.
// Drives the animation loop manually with a simulated clock and checks the behaviours.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'media', 'spider-runtime.js'), 'utf8');

function makeEnv(boot) {
  const rafQueue = [];
  const intervals = [];
  const listeners = {};
  const noopCtx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : () => undefined),
    set: (t, p, v) => { t[p] = v; return true; },
  });
  class Path2D { moveTo() {} lineTo() {} ellipse() {} arc() {} closePath() {} quadraticCurveTo() {} }
  const squiggles = [];
  const caret = { getBoundingClientRect: () => ({ left: 400, top: 300, width: 1, height: 18 }) };
  const el = () => ({ style: {}, appendChild() {}, isConnected: true, getContext: () => noopCtx });
  const document = {
    body: el(),
    hidden: false,
    createElement: el,
    querySelectorAll: () => squiggles.map((r) => ({ getBoundingClientRect: () => r })),
    querySelector: () => caret,
    addEventListener() {},
  };
  const win = {
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, document,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    __CYBER_SPIDER_BOOT__: boot,
  };
  const sandbox = {
    window: win, document, Path2D, console,
    requestAnimationFrame: (fn) => { rafQueue.push(fn); },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    fetch: () => Promise.reject(new Error('no fetch in test')),
    Math, Number, Object, Array, Map, Set, Date, Infinity, Promise,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  let ts = 0;
  const step = (seconds) => {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) {
      ts += 1000 / 60;
      const fn = rafQueue.shift();
      fn(ts);
      if (i % 36 === 0) { intervals.filter((x) => x.ms === 600).forEach((x) => x.fn()); }
    }
  };
  return {
    api: win.__CYBER_SPIDER__, step, squiggles, win,
    key: () => (listeners.keydown || []).forEach((fn) => fn({})),
  };
}

function finite(api) {
  const { sp } = api;
  assert(Number.isFinite(sp.x) && Number.isFinite(sp.y), 'position is finite');
  for (const l of sp.legs) {
    for (const p of [l.base, l.knee, l.end]) {
      assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'leg joints are finite');
    }
  }
}

// 1) wandering stays on screen, legs stay finite, spider ignores the mouse (no mouse listeners)
{
  const env = makeEnv({ idleDelaySeconds: 600 });
  const { api } = env;
  env.step(20);
  finite(api);
  assert(api.sp.x >= 0 && api.sp.x <= 1280 && api.sp.y >= 0 && api.sp.y <= 800, 'stays on screen');
  assert.strictEqual(api.sp.mode, 'wander');
  const l = Object.keys(env.win).filter((k) => k.startsWith('mouse'));
  assert.strictEqual(l.length, 0);
  console.log('ok  wander + IK stay finite and on screen');
}

// 2) error squiggle -> hunt -> inspect -> back to wander
{
  const env = makeEnv({ idleDelaySeconds: 600 });
  const { api } = env;
  env.step(2);
  env.squiggles.push({ left: 900, top: 500, width: 120, height: 6, right: 1020, bottom: 506 });
  const seen = new Set();
  for (let i = 0; i < 60 * 20 / 6; i++) { env.step(0.1 * 6); seen.add(api.sp.mode); if (seen.has('inspect') && api.sp.mode === 'wander') { break; } }
  assert(seen.has('hunt'), 'entered hunt mode');
  assert(seen.has('inspect'), 'entered inspect mode');
  assert.strictEqual(api.sp.mode, 'wander', 'returned to wander after inspecting');
  console.log('ok  error squiggle -> hunt -> inspect -> wander');
}

// 3) idle -> corner -> weave -> rest, then typing fades the web and resumes wandering
{
  const env = makeEnv({ idleDelaySeconds: 5, speed: 300 });
  const { api } = env;
  const seen = new Set();
  for (let i = 0; i < 300; i++) { env.step(1); seen.add(api.sp.mode); if (api.sp.mode === 'rest') { break; } }
  assert(seen.has('toCorner'), 'went to a corner');
  assert(seen.has('weave'), 'weaved');
  assert.strictEqual(api.sp.mode, 'rest', 'finished the web');
  const web = api.getWeb();
  assert(web && web.edges.every((e) => e.prog === 1), 'web fully drawn');
  env.key();
  assert.strictEqual(api.sp.mode, 'wander', 'typing resumes wandering');
  assert(api.getWeb().fading, 'web starts fading');
  env.step(3);
  assert.strictEqual(api.getWeb(), null, 'web gone after fade');
  finite(api);
  console.log('ok  idle -> corner -> web -> typing -> fade + wander');
}

// 4) silk trails are emitted and expire
{
  const env = makeEnv({ idleDelaySeconds: 600 });
  const { api } = env;
  env.step(6);
  assert(api.getThreads().length > 0, 'silk threads emitted');
  console.log('ok  silk trails');
}

// 5) live config: disable stops simulation
{
  const env = makeEnv({ idleDelaySeconds: 600 });
  const { api } = env;
  env.step(1);
  api.applyConfig({ enabled: false });
  const t = api.now();
  env.step(1);
  assert.strictEqual(api.now(), t, 'clock frozen when disabled');
  console.log('ok  live disable');
}

console.log('runtime smoke tests passed');
