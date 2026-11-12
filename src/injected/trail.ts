import { Vec, dist } from './math';
import { RGB, css } from './color';

interface Pt {
  x: number;
  y: number;
  t: number;
  seed: number;
}

/** Micro-fils de soie laissés derrière l'araignée, qui s'estompent. */
export class SilkTrail {
  private pts: Pt[] = [];
  private last: Vec | null = null;

  add(p: Vec, now: number, minStep = 7): void {
    if (!this.last || dist(p, this.last) >= minStep) {
      this.pts.push({ x: p.x, y: p.y, t: now, seed: Math.random() });
      this.last = { ...p };
    }
  }

  render(ctx: CanvasRenderingContext2D, rgb: RGB, now: number, life = 2.6): void {
    while (this.pts.length && now - this.pts[0].t > life) this.pts.shift();
    if (this.pts.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
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
      // brin latéral
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const l = Math.hypot(dx, dy) || 1;
      const side = p1.seed > 0.5 ? 1 : -1;
      const sl = 4 + p1.seed * 8;
      ctx.globalAlpha = a * 0.3;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x + (-dy / l) * sl * side, p1.y + (dx / l) * sl * side);
      ctx.stroke();
    }
    ctx.restore();
  }
}
