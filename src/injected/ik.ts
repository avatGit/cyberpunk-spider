import { Vec } from './math';

export interface TwoBoneResult {
  knee: Vec;
  /** Position réelle du pied (ramenée à portée si la cible est trop loin). */
  foot: Vec;
}

/**
 * Cinématique inverse analytique à deux segments (fémur l1, tibia l2).
 * `bend` (+1/-1) choisit de quel côté de la ligne hanche→pied plie le genou.
 */
export function solveTwoBone(hip: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): TwoBoneResult {
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
    foot: { x: hip.x + ux * dc, y: hip.y + uy * dc },
  };
}
