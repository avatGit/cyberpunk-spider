import { describe, it, expect } from 'vitest';
import { solveTwoBone } from '../src/injected/ik';

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('solveTwoBone', () => {
  it('respecte les longueurs des segments quand la cible est atteignable', () => {
    const hip = { x: 10, y: 20 };
    const r = solveTwoBone(hip, { x: 60, y: 50 }, 34, 44, 1);
    expect(d(hip, r.knee)).toBeCloseTo(34, 5);
    expect(d(r.knee, r.foot)).toBeCloseTo(44, 5);
    expect(r.foot.x).toBeCloseTo(60, 5);
  });

  it('ramène le pied à portée quand la cible est trop loin', () => {
    const hip = { x: 0, y: 0 };
    const r = solveTwoBone(hip, { x: 500, y: 0 }, 34, 44, 1);
    expect(d(hip, r.foot)).toBeLessThanOrEqual(78);
    expect(d(hip, r.knee)).toBeCloseTo(34, 3);
  });

  it('plie de côtés opposés selon le signe', () => {
    const a = solveTwoBone({ x: 0, y: 0 }, { x: 50, y: 0 }, 34, 44, 1);
    const b = solveTwoBone({ x: 0, y: 0 }, { x: 50, y: 0 }, 34, 44, -1);
    expect(a.knee.y).toBeCloseTo(-b.knee.y, 5);
    expect(a.knee.y).not.toBeCloseTo(0, 1);
  });

  it('ne produit pas de NaN si la cible est sur la hanche', () => {
    const r = solveTwoBone({ x: 5, y: 5 }, { x: 5, y: 5 }, 34, 44, 1);
    expect(Number.isFinite(r.knee.x + r.knee.y + r.foot.x + r.foot.y)).toBe(true);
  });
});
