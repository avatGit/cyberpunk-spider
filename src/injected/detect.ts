import { Vec } from './math';

export interface ErrorInfo {
  count: number;
  points: Vec[];
}

/**
 * Détecte les erreurs visibles via les soulignements rouges de Monaco.
 * Limite connue : seules les erreurs actuellement affichées à l'écran sont vues.
 */
export function scanErrors(w: number, h: number): ErrorInfo {
  const els = document.querySelectorAll('.monaco-editor .squiggly-error');
  const seen = new Set<string>();
  const points: Vec[] = [];
  const max = Math.min(els.length, 300);
  for (let i = 0; i < max; i++) {
    const r = els[i].getBoundingClientRect();
    if (r.width < 2 || r.height <= 0) continue;
    if (r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) continue;
    const key = Math.round(r.top / 12) + ':' + Math.round(r.left / 40);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }
  return { count: points.length, points };
}

/** Position du curseur de texte (caret) de l'éditeur, pour choisir un coin « inutilisé ». */
export function caretPos(): Vec | null {
  const c = document.querySelector('.monaco-editor .cursors-layer .cursor');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

/** Suit la dernière frappe clavier. */
export class ActivityTracker {
  last = performance.now();

  constructor() {
    const touch = () => {
      this.last = performance.now();
    };
    window.addEventListener('keydown', touch, { capture: true, passive: true });
    window.addEventListener('paste', touch, { capture: true, passive: true });
  }

  idleMs(): number {
    return performance.now() - this.last;
  }
}
