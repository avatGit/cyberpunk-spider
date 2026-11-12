import { Vec, add, mul, dist, rot, lerpV, clamp, angleDiff } from './math';
import { solveTwoBone } from './ik';

const L1 = 34; // fémur
const L2 = 44; // tibia
// Repère local : +x = avant, y = côté. 4 paires de pattes.
const HIPS: Vec[] = [
  { x: 12, y: 4 },
  { x: 5, y: 5 },
  { x: -3, y: 5 },
  { x: -10, y: 4 },
];
const REST: Vec[] = [
  { x: 54, y: 40 },
  { x: 30, y: 60 },
  { x: -8, y: 62 },
  { x: -46, y: 50 },
];
const BEND_BASE: (1 | -1)[] = [1, 1, 1, -1];

interface Leg {
  hipLocal: Vec;
  restLocal: Vec;
  group: 0 | 1;
  bend: 1 | -1;
  hip: Vec;
  knee: Vec;
  foot: Vec; // pied planté (cible IK)
  drawFoot: Vec; // pied après contrainte de portée
  from: Vec;
  to: Vec;
  t: number;
  stepping: boolean;
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Spider {
  pos: Vec;
  heading = 0;
  speed = 0;
  scale = 1;
  legs: Leg[] = [];

  constructor(x: number, y: number) {
    this.pos = { x, y };
    for (let pair = 0; pair < 4; pair++) {
      for (const side of [1, -1] as const) {
        const hipLocal = { x: HIPS[pair].x, y: HIPS[pair].y * side };
        const restLocal = { x: REST[pair].x, y: REST[pair].y * side };
        const p = { x, y };
        this.legs.push({
          hipLocal,
          restLocal,
          group: ((pair + (side === 1 ? 0 : 1)) % 2) as 0 | 1,
          bend: (side * BEND_BASE[pair]) as 1 | -1,
          hip: { ...p },
          knee: { ...p },
          foot: add(p, restLocal),
          drawFoot: { ...p },
          from: { ...p },
          to: { ...p },
          t: 0,
          stepping: false,
        });
      }
    }
    this.updateLegs(0);
    for (const l of this.legs) l.foot = this.ideal(l);
    this.updateLegs(0);
  }

  /** Point de filage (arrière de l'abdomen), pour la traînée de soie. */
  tail(): Vec {
    return add(this.pos, mul(rot({ x: -23, y: 0 }, this.heading), this.scale));
  }

  arrived(target: Vec, radius: number): boolean {
    return dist(this.pos, target) <= radius;
  }

  stop(dt: number): void {
    this.speed += (0 - this.speed) * Math.min(1, dt * 8);
    if (this.speed < 0.5) this.speed = 0;
  }

  /** Oriente et avance le corps vers la cible (vitesse en px/s). */
  steer(target: Vec, dt: number, maxSpeed: number, turnRate = 5): void {
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
      y: this.pos.y + Math.sin(this.heading) * this.speed * dt,
    };
  }

  private ideal(l: Leg): Vec {
    return add(this.pos, mul(rot(l.restLocal, this.heading), this.scale));
  }

  /** Démarche tétrapode : un groupe de pattes avance pendant que l'autre reste planté. */
  updateLegs(dt: number): void {
    const stepDur = 0.11 + 0.06 * (1 - Math.min(1, this.speed / 220));
    const moving: [boolean, boolean] = [false, false];
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
        if (need && (over || !moving[1 - l.group as 0 | 1])) {
          const lead = clamp(this.speed * 0.16, 0, 30 * this.scale);
          l.from = { ...l.foot };
          l.to = add(ideal, mul(dir, lead));
          l.t = 0;
          l.stepping = true;
          moving[l.group] = true;
        }
      }
      // Coude du côté qui s'écarte le plus du corps : les genoux ne se croisent jamais.
      const a = solveTwoBone(l.hip, l.foot, L1 * this.scale, L2 * this.scale, 1);
      const b = solveTwoBone(l.hip, l.foot, L1 * this.scale, L2 * this.scale, -1);
      const r = dist(a.knee, this.pos) >= dist(b.knee, this.pos) ? a : b;
      let knee = r.knee;
      if (l.stepping) {
        // La patte se soulève : le genou s'écarte de la hanche.
        const lift = Math.sin(Math.PI * l.t) * 7 * this.scale;
        const kx = knee.x - l.hip.x;
        const ky = knee.y - l.hip.y;
        const kl = Math.hypot(kx, ky) || 1;
        knee = { x: knee.x + (kx / kl) * lift, y: knee.y + (ky / kl) * lift };
      }
      l.knee = knee;
      l.drawFoot = r.foot;
    }
  }

  /** Dessine pattes puis corps. `full=false` : seulement le trait net (couches glitch). */
  draw(ctx: CanvasRenderingContext2D, color: string, glow: number, ox = 0, oy = 0, alpha = 1, full = true): void {
    const s = this.scale;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

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
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.globalAlpha = alpha * 0.8;
      ctx.lineWidth = 0.7 * s;
      ctx.stroke(all);
      ctx.fillStyle = '#ffffff';
      for (const l of this.legs) {
        ctx.beginPath();
        ctx.arc(l.drawFoot.x, l.drawFoot.y, 1.6 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Corps
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.heading);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = full ? 16 * glow : 0;
    ctx.fillStyle = '#05050b';
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
      // chevrons sur l'abdomen
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
      // yeux + crochets
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
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
}
