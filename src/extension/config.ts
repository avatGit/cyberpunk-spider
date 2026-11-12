import * as vscode from 'vscode';
import { SpiderConfig, sanitizeConfig } from '../shared/types';

export const SECTION = 'cyberpunkSpider';

export interface Favorite {
  name: string;
  colors: string[];
}

export function readConfig(): SpiderConfig {
  const c = vscode.workspace.getConfiguration(SECTION);
  return sanitizeConfig({
    enabled: c.get('enabled'),
    speed: c.get('speed'),
    size: c.get('size'),
    glow: c.get('glow'),
    idleSeconds: c.get('idleSeconds'),
    palette: c.get('palette'),
    huntBugs: c.get('huntBugs'),
    silkTrail: c.get('silkTrail'),
  });
}

export function readFavorites(): Favorite[] {
  const raw = vscode.workspace.getConfiguration(SECTION).get<unknown>('favoritePalettes');
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is Favorite => !!f && typeof f.name === 'string' && Array.isArray(f.colors),
  );
}
