import { clamp, smoothstep } from './math';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp(t, 0, 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

export const css = (c: RGB, a = 1): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Parcourt la palette : tient chaque couleur un moment, puis fond vers la suivante. */
export class PaletteCycler {
  private colors: RGB[] = [[57, 255, 20]];
  private t = 0;
  private readonly secondsPerColor = 4;

  setPalette(hexes: string[]): void {
    if (hexes.length) this.colors = hexes.map(hexToRgb);
  }

  update(dt: number): void {
    this.t += dt / this.secondsPerColor;
  }

  current(): RGB {
    const n = this.colors.length;
    if (n === 1) return this.colors[0];
    const i = Math.floor(this.t) % n;
    const f = smoothstep(0.65, 1, this.t - Math.floor(this.t));
    return mixRgb(this.colors[i], this.colors[(i + 1) % n], f);
  }
}
