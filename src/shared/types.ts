export interface SpiderConfig {
  enabled: boolean;
  speed: number;
  size: number;
  glow: number;
  idleSeconds: number;
  palette: string[];
  huntBugs: boolean;
  silkTrail: boolean;
}

export const PRESETS: Record<string, string[]> = {
  'Spider-Verse': ['#39ff14', '#b026ff', '#00f0ff', '#ff2bd6'],
  'Neon Tokyo': ['#ff2bd6', '#00f0ff', '#fff200'],
  Matrix: ['#00ff41', '#00b82e', '#b8ffcb'],
  Synthwave: ['#ff6ec7', '#7a5cff', '#00e5ff'],
  Miles: ['#ff1e3c', '#00f0ff', '#ffffff'],
};

export const DEFAULT_CONFIG: SpiderConfig = {
  enabled: true,
  speed: 1,
  size: 1,
  glow: 0.8,
  idleSeconds: 60,
  palette: PRESETS['Spider-Verse'],
  huntBugs: true,
  silkTrail: true,
};

/** Fichiers déposés à côté de workbench.html. */
export const ASSET_SCRIPT = 'cyberpunk-spider.js';
/** Config de boot (balise <script> statique, lue avant le runtime). */
export const ASSET_CONFIG = 'cyberpunk-spider.config.js';
/** Config « live », relue par fetch() toutes les 3 s (la CSP Trusted Types interdit script.src dynamique). */
export const ASSET_CONFIG_JSON = 'cyberpunk-spider.config.json';
/** Variable globale posée par le fichier de config. */
export const CONFIG_GLOBAL = '__CYBERPUNK_SPIDER_CONFIG__';

const HEX = /^#[0-9a-f]{6}$/i;

function num(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function sanitizeConfig(raw: Partial<Record<keyof SpiderConfig, unknown>> | null | undefined): SpiderConfig {
  const r = raw ?? {};
  const palette = Array.isArray(r.palette)
    ? (r.palette as unknown[]).filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 8)
    : [];
  return {
    enabled: bool(r.enabled, DEFAULT_CONFIG.enabled),
    speed: num(r.speed, 0.3, 3, DEFAULT_CONFIG.speed),
    size: num(r.size, 0.5, 2.5, DEFAULT_CONFIG.size),
    glow: num(r.glow, 0, 1, DEFAULT_CONFIG.glow),
    idleSeconds: num(r.idleSeconds, 10, 3600, DEFAULT_CONFIG.idleSeconds),
    palette: palette.length ? palette : [...DEFAULT_CONFIG.palette],
    huntBugs: bool(r.huntBugs, DEFAULT_CONFIG.huntBugs),
    silkTrail: bool(r.silkTrail, DEFAULT_CONFIG.silkTrail),
  };
}
