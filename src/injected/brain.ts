import { Spider } from './spider';
import { WebWeaver } from './web';
import { Vec, dist, rand } from './math';
import { SpiderConfig } from '../shared/types';
import { ErrorInfo } from './detect';
import { RGB } from './color';

export type Mode = 'wander' | 'pause' | 'hunt' | 'inspect' | 'toCorner' | 'weave' | 'rest';

export interface Tick {
  cfg: SpiderConfig;
  idleMs: number;
  errors: ErrorInfo;
  /** curseur de texte de l'éditeur (null si inconnu) */
  caret: Vec | null;
  /** secondes écoulées depuis le démarrage */
  now: number;
  w: number;
  h: number;
}

const HUNT_COOLDOWN = 25; // s avant de re-inspecter les mêmes erreurs

export class Brain {
  mode: Mode = 'pause';
  /** 0..1 : teinte d'alerte pendant la chasse */
  alert = 0;
  web: WebWeaver | null = null;
  private fading: WebWeaver | null = null;
  private timer = 0.8;
  private target: Vec = { x: 0, y: 0 };
  private corner: { p: Vec; sx: number; sy: number } = { p: { x: 0, y: 0 }, sx: 1, sy: 1 };
  private cruise = 1;
  private huntCooldownUntil = 0;
  private lastErr = 0;
  private orbit = 0;
  private focus: Vec | null = null;
  private caret: Vec | null = null;

  constructor(private spider: Spider) {}

  update(dt: number, k: Tick): void {
    const { cfg, idleMs, errors, now, w, h } = k;
    this.caret = k.caret;
    const sp = this.spider;
    const s = sp.scale;
    const idle = idleMs >= cfg.idleSeconds * 1000;
    const inWeb = this.mode === 'toCorner' || this.mode === 'weave' || this.mode === 'rest';

    if (inWeb && !idle) this.dropWeb(w, h);
    else if (!inWeb && idle) this.goCorner(w, h);

    if (this.fading) {
      this.fading.alpha -= dt / 1.3;
      if (this.fading.alpha <= 0) this.fading = null;
    }

    const canHunt = cfg.huntBugs && errors.count > 0 && !idle;
    if (canHunt && (this.mode === 'wander' || this.mode === 'pause')) {
      if (errors.count > this.lastErr || now > this.huntCooldownUntil) this.mode = 'hunt';
    }
    if (!canHunt && (this.mode === 'hunt' || this.mode === 'inspect')) {
      this.mode = 'pause';
      this.timer = 0.4;
      this.focus = null;
    }
    this.lastErr = errors.count;

    const wantAlert = this.mode === 'hunt' || this.mode === 'inspect' ? 1 : 0;
    this.alert += (wantAlert - this.alert) * Math.min(1, dt * 3);

    const v = cfg.speed;
    switch (this.mode) {
      case 'pause':
        sp.stop(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.pickWander(w, h);
        break;
      case 'wander':
        sp.steer(this.target, dt, 150 * v * this.cruise);
        if (sp.arrived(this.target, 14 * s)) {
          this.mode = 'pause';
          this.timer = rand(0.3, 1.8);
        }
        break;
      case 'hunt': {
        const p = this.nearestError(errors);
        if (p) this.focus = p;
        if (this.focus) {
          sp.steer(this.focus, dt, 280 * v);
          if (dist(sp.pos, this.focus) < 36 * s) {
            this.mode = 'inspect';
            this.timer = 3.4;
            this.orbit = Math.atan2(sp.pos.y - this.focus.y, sp.pos.x - this.focus.x);
          }
        }
        break;
      }
      case 'inspect': {
        const p = this.nearestError(errors);
        if (p) this.focus = p;
        if (this.focus) {
          this.orbit += dt * 2.6;
          const t = {
            x: this.focus.x + Math.cos(this.orbit) * 38 * s,
            y: this.focus.y + Math.sin(this.orbit) * 38 * s,
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
      case 'toCorner':
        sp.steer(this.corner.p, dt, 220 * v);
        if (sp.arrived(this.corner.p, 26 * s)) {
          const R = Math.min(340, Math.max(150, Math.min(w, h) * 0.32));
          this.web = new WebWeaver(this.corner.p, this.corner.sx, this.corner.sy, R);
          this.mode = 'weave';
        }
        break;
      case 'weave': {
        const web = this.web;
        if (!web) {
          this.mode = 'rest';
          break;
        }
        const pen = web.pen();
        if (dist(sp.pos, pen) < 46 * s) web.advance(140 * Math.max(0.6, v) * dt);
        sp.steer(pen, dt, 260 * v);
        if (web.done) this.mode = 'rest';
        break;
      }
      case 'rest':
        sp.stop(dt);
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D, rgb: RGB, glow: number, now: number): void {
    this.fading?.render(ctx, rgb, glow);
    this.web?.render(ctx, rgb, glow);
    if (this.mode === 'inspect' && this.focus) this.drawReticle(ctx, rgb, now);
  }

  private drawReticle(ctx: CanvasRenderingContext2D, rgb: RGB, now: number): void {
    const f = this.focus!;
    const r = 20 + Math.sin(now * 6) * 3;
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},0.85)`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const a = now * 2 + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, a, a + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  private nearestError(e: ErrorInfo): Vec | null {
    let best: Vec | null = null;
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

  private pickWander(w: number, h: number): void {
    const m = 40;
    this.target = { x: rand(m, Math.max(m + 1, w - m)), y: rand(m, Math.max(m + 1, h - m)) };
    this.cruise = Math.random() < 0.15 ? 2 : rand(0.6, 1.5);
    this.mode = 'wander';
  }

  private goCorner(w: number, h: number): void {
    const m = 24;
    const corners = [
      { p: { x: m, y: m }, sx: 1, sy: 1 },
      { p: { x: w - m, y: m }, sx: -1, sy: 1 },
      { p: { x: m, y: h - m }, sx: 1, sy: -1 },
      { p: { x: w - m, y: h - m }, sx: -1, sy: -1 },
    ];
    // Coin « inutilisé » = le plus éloigné du curseur de texte ; sinon aléatoire.
    const ref = this.caret;
    this.corner = ref
      ? corners.reduce((best, c) => (dist(c.p, ref) > dist(best.p, ref) ? c : best))
      : corners[Math.floor(Math.random() * corners.length)];
    this.mode = 'toCorner';
    this.focus = null;
  }

  private dropWeb(w: number, h: number): void {
    if (this.web) {
      this.fading = this.web;
      this.web = null;
    }
    this.pickWander(w, h);
  }
}
