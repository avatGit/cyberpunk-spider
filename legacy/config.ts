import * as vscode from 'vscode';

export const SECTION = 'cyberpunkSpider';

export const PALETTES: Record<string, { label: string; color: string }> = {
  toxic: { label: 'Toxic green', color: '#39ff14' },
  violet: { label: 'Ultraviolet', color: '#b026ff' },
  cyan: { label: 'Cyan', color: '#00f0ff' },
  magenta: { label: 'Hot magenta', color: '#ff2bd6' },
  amber: { label: 'Amber', color: '#ffb300' },
  crimson: { label: 'Crimson', color: '#ff2a4d' },
};

export interface SpiderConfig {
  enabled: boolean;
  speed: number;
  idleDelaySeconds: number;
  scale: number;
  glowIntensity: number;
  palettes: string[];
  customColors: string[];
  colorCycleSeconds: number;
  silkTrails: boolean;
  bugHunter: boolean;
}

/** Keys the settings webview is allowed to write. */
export const CONFIG_KEYS: ReadonlySet<string> = new Set<keyof SpiderConfig>([
  'enabled',
  'speed',
  'idleDelaySeconds',
  'scale',
  'glowIntensity',
  'palettes',
  'customColors',
  'colorCycleSeconds',
  'silkTrails',
  'bugHunter',
]);

const HEX = /^#[0-9a-fA-F]{6}$/;

function num(c: vscode.WorkspaceConfiguration, key: string, def: number, min: number, max: number): number {
  const v = Number(c.get(key, def));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

export function readConfig(): SpiderConfig {
  const c = vscode.workspace.getConfiguration(SECTION);
  const palettes = (c.get<string[]>('palettes', []) ?? []).filter((k) => k in PALETTES);
  const customColors = (c.get<string[]>('customColors', []) ?? []).filter((s) => HEX.test(s));
  return {
    enabled: c.get<boolean>('enabled', true),
    speed: num(c, 'speed', 120, 20, 400),
    idleDelaySeconds: num(c, 'idleDelaySeconds', 30, 5, 600),
    scale: num(c, 'scale', 1, 0.5, 2),
    glowIntensity: num(c, 'glowIntensity', 1, 0, 1.5),
    palettes,
    customColors,
    colorCycleSeconds: num(c, 'colorCycleSeconds', 6, 2, 60),
    silkTrails: c.get<boolean>('silkTrails', true),
    bugHunter: c.get<boolean>('bugHunter', true),
  };
}

export function resolveColors(cfg: SpiderConfig): string[] {
  const colors = [...cfg.palettes.map((k) => PALETTES[k].color), ...cfg.customColors];
  return colors.length ? colors : [PALETTES.cyan.color];
}

/** What the in-window runtime receives (config.json + boot script). */
export function toRuntimePayload(cfg: SpiderConfig): object {
  return {
    enabled: cfg.enabled,
    speed: cfg.speed,
    idleDelaySeconds: cfg.idleDelaySeconds,
    scale: cfg.scale,
    glowIntensity: cfg.glowIntensity,
    colors: resolveColors(cfg),
    colorCycleSeconds: cfg.colorCycleSeconds,
    silkTrails: cfg.silkTrails,
    bugHunter: cfg.bugHunter,
  };
}
