import { SpiderConfig, sanitizeConfig, CONFIG_GLOBAL, ASSET_CONFIG_JSON } from '../shared/types';
import { Spider } from './spider';
import { Brain } from './brain';
import { SilkTrail } from './trail';
import { PaletteCycler, css, mixRgb, RGB } from './color';
import { ActivityTracker, scanErrors, caretPos, ErrorInfo } from './detect';
import { Vec } from './math';
import { rand } from './math';

const win = window as any;
const ALERT: RGB = [255, 51, 85];
const MAGENTA: RGB = [255, 43, 214];
const CYAN: RGB = [0, 240, 255];

function boot(): void {
  // Config de boot posée par la balise <script> statique qui précède le runtime.
  let cfg: SpiderConfig = sanitizeConfig(win[CONFIG_GLOBAL]);
  let pollFails = 0;
  const palette = new PaletteCycler();
  palette.setPalette(cfg.palette);
  const activity = new ActivityTracker();

  let running = false;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let spider: Spider | null = null;
  let brain: Brain | null = null;
  const trail = new SilkTrail();
  let errors: ErrorInfo = { count: 0, points: [] };
  let caret: Vec | null = null;
  let raf = 0;
  let scanTimer = 0;
  let last = 0;
  let time = 0;
  let W = window.innerWidth;
  let H = window.innerHeight;
  let nextGlitch = 6;
  let glitchUntil = 0;

  function resize(): void {
    if (!canvas || !ctx) return;
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function start(): void {
    if (running || !document.body) return;
    running = true;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
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

  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(scanTimer);
    canvas?.remove();
    canvas = null;
    ctx = null;
  }

  function frame(t: number): void {
    if (!running || !ctx || !spider || !brain) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
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
      ctx.globalCompositeOperation = 'lighter';
      spider.draw(ctx, css(MAGENTA), cfg.glow, -3, 0, 0.55, false);
      spider.draw(ctx, css(CYAN), cfg.glow, 3, 1, 0.55, false);
      ctx.globalCompositeOperation = 'source-over';
    }
    spider.draw(ctx, css(rgb), cfg.glow);
  }

  function applyConfig(next: SpiderConfig): void {
    cfg = next;
    palette.setPalette(cfg.palette);
    if (cfg.enabled) start();
    else stop();
  }

  // Config « live » : fetch d'un JSON voisin de workbench.html (URL relative). La CSP du workbench
  // (Trusted Types) interdit les scripts ajoutés dynamiquement. Après 4 échecs on arrête de sonder :
  // les réglages s'appliquent alors au prochain rechargement.
  function pollConfig(): void {
    if (typeof fetch !== 'function' || pollFails >= 4 || document.visibilityState === 'hidden') return;
    fetch(ASSET_CONFIG_JSON, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then((j) => {
        pollFails = 0;
        applyConfig(sanitizeConfig(j));
      })
      .catch(() => {
        pollFails++;
      });
  }

  window.addEventListener('resize', resize);
  win.__cyberpunkSpiderDebug = { mode: () => brain?.mode, errors: () => errors, running: () => running };

  applyConfig(cfg);
  pollConfig();
  window.setInterval(pollConfig, 3000);
}

if (!win.__cyberpunkSpiderBooted) {
  win.__cyberpunkSpiderBooted = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
