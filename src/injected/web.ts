import { Vec, dist, lerpV, clamp } from './math';
import { RGB, css, mixRgb } from './color';

interface Node {
  p: Vec;
  draw: boolean; // le segment arrivant à ce nœud laisse un fil
  cum: number; // distance cumulée du chemin jusqu'à ce nœud
}

/**
 * Toile en coin d'écran. L'araignée est le « stylo » : elle parcourt un chemin continu
 * (rayons + cadre, puis spirale en zigzag) et chaque fil apparaît au fur et à mesure.
 */
export class WebWeaver {
  private nodes: Node[] = [];
  private total = 0;
  private travelled = 0;
  alpha = 1;

  constructor(corner: Vec, sx: number, sy: number, radius: number) {
    const RAYS = 6;
    const RINGS = 7;
    const dirs: Vec[] = [];
    for (let i = 0; i < RAYS; i++) {
      const a = (i / (RAYS - 1)) * (Math.PI / 2);
      dirs.push({ x: sx * Math.cos(a), y: sy * Math.sin(a) });
    }
    const P = (k: number, i: number): Vec => ({
      x: corner.x + dirs[i].x * radius * (k / RINGS),
      y: corner.y + dirs[i].y * radius * (k / RINGS),
    });
    const pts: { p: Vec; draw: boolean }[] = [{ p: corner, draw: false }];
    const go = (p: Vec, draw: boolean) => pts.push({ p, draw });

    // Cadre : rayons + quelques segments de bordure
    go(P(RINGS, 0), true);
    go(P(RINGS, 1), true);
    go(corner, true);
    go(P(RINGS, 2), true);
    go(P(RINGS, 3), true);
    go(corner, true);
    go(P(RINGS, 4), true);
    go(P(RINGS, 5), true);
    go(corner, true);
    // Spirale en zigzag, de l'extérieur vers le centre
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

  get done(): boolean {
    return this.travelled >= this.total - 0.5;
  }

  advance(d: number): void {
    this.travelled = Math.min(this.total, this.travelled + d);
  }

  /** Position actuelle du « stylo » (là où l'araignée doit se rendre). */
  pen(): Vec {
    const n = this.nodes;
    for (let i = 1; i < n.length; i++) {
      if (this.travelled <= n[i].cum) {
        const span = n[i].cum - n[i - 1].cum || 1;
        return lerpV(n[i - 1].p, n[i].p, (this.travelled - n[i - 1].cum) / span);
      }
    }
    return n[n.length - 1].p;
  }

  render(ctx: CanvasRenderingContext2D, rgb: RGB, glow: number): void {
    if (this.alpha <= 0) return;
    const n = this.nodes;
    const path = new Path2D();
    const dots: Vec[] = [];
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
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(rgb);
    ctx.globalAlpha = this.alpha * 0.14 * glow;
    ctx.lineWidth = 5;
    ctx.stroke(path);
    ctx.globalAlpha = this.alpha * 0.85;
    ctx.strokeStyle = css(mixRgb(rgb, [255, 255, 255], 0.45));
    ctx.lineWidth = 0.9;
    ctx.stroke(path);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = this.alpha * 0.9;
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
