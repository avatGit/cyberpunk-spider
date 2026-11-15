import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ASSET_SCRIPT, ASSET_CONFIG, ASSET_CONFIG_JSON, CONFIG_GLOBAL, SpiderConfig } from '../shared/types';

export const MARK_START = '<!-- CYBERPUNK-SPIDER-START -->';
export const MARK_END = '<!-- CYBERPUNK-SPIDER-END -->';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK_RE = new RegExp(`${esc(MARK_START)}[\\s\\S]*?${esc(MARK_END)}\\n?`, 'g');

// ---------- fonctions pures (testées) ----------

/** Deux balises statiques : la CSP du workbench (Trusted Types) interdit les scripts injectés dynamiquement. */
export function buildBlock(): string {
  return (
    `${MARK_START}\n` +
    `<script src="${ASSET_CONFIG}"></script>\n` +
    `<script src="${ASSET_SCRIPT}"></script>\n` +
    `${MARK_END}\n`
  );
}

export function hasBlock(html: string): boolean {
  return html.includes(MARK_START);
}

export function removeBlock(html: string): string {
  return html.replace(BLOCK_RE, '');
}

/** Idempotent : retire un éventuel ancien bloc puis insère le nouveau avant </body> (ou </html>). */
export function injectBlock(html: string): string {
  const clean = removeBlock(html);
  let i = clean.lastIndexOf('</body>');
  if (i < 0) i = clean.lastIndexOf('</html>');
  if (i < 0) throw new Error('workbench.html : balise </body> ou </html> introuvable.');
  return clean.slice(0, i) + buildBlock() + clean.slice(i);
}

/** Même algorithme que VS Code (sha256, base64, sans padding). */
export function computeChecksum(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('base64').replace(/=+$/, '');
}

export function replaceChecksum(productRaw: string, key: string, newHash: string): string | null {
  const re = new RegExp(`("${esc(key)}"\\s*:\\s*")[^"]*(")`);
  if (!re.test(productRaw)) return null;
  return productRaw.replace(re, `$1${newHash}$2`);
}

/** `alive` : horodatage de « signe de vie » de l'extension, lu par le runtime pour s'arrêter si elle disparaît. */
export function configPayload(cfg: SpiderConfig, alive: number = Date.now()): string {
  return JSON.stringify({ ...cfg, alive });
}

export function configFileContent(cfg: SpiderConfig, alive: number = Date.now()): string {
  return `window.${CONFIG_GLOBAL}=${configPayload(cfg, alive)};\n`;
}

/** Propriétaire à rétablir après une écriture en root (sudo), pour que l'extension puisse ensuite écrire seule. */
export interface Owner {
  uid: number;
  gid: number;
}

// ---------- accès disque ----------

/** Chemins relatifs à out/ (aussi les clés de checksum de product.json). */
const HTML_CANDIDATES = [
  'vs/code/electron-sandbox/workbench/workbench.html',
  'vs/code/electron-sandbox/workbench/workbench.esm.html',
  'vs/code/electron-browser/workbench/workbench.html',
];

export interface PatchPaths {
  html: string;
  dir: string;
  checksumKey: string;
  product: string;
}

/** Tous les workbench.html présents (selon la version, il peut y en avoir plusieurs). */
export function locateAll(appRoot: string): PatchPaths[] {
  const found: PatchPaths[] = [];
  for (const rel of HTML_CANDIDATES) {
    const html = path.join(appRoot, 'out', ...rel.split('/'));
    if (fs.existsSync(html)) {
      found.push({ html, dir: path.dirname(html), checksumKey: rel, product: path.join(appRoot, 'product.json') });
    }
  }
  if (!found.length) {
    throw new Error(`workbench.html introuvable sous ${appRoot}. Version de VS Code non supportée ?`);
  }
  return found;
}

export class Patcher {
  /** `injectedSrc` : chemin du bundle dist/injected.js (vide pour une simple désinstallation). */
  constructor(
    private appRoot: string,
    private injectedSrc: string,
    private owner?: Owner,
  ) {}

  private own(file: string): void {
    if (!this.owner) return;
    try {
      fs.chownSync(file, this.owner.uid, this.owner.gid);
    } catch {
      /* best effort */
    }
  }

  targets(): PatchPaths[] {
    return locateAll(this.appRoot);
  }

  isInstalled(): boolean {
    try {
      return this.targets().every(
        (p) => hasBlock(fs.readFileSync(p.html, 'utf8')) && fs.existsSync(path.join(p.dir, ASSET_SCRIPT)),
      );
    } catch {
      return false;
    }
  }

  /** Le script déposé correspond-il à celui de l'extension installée ? */
  isUpToDate(): boolean {
    try {
      const src = fs.readFileSync(this.injectedSrc);
      return this.targets().every((p) => fs.readFileSync(path.join(p.dir, ASSET_SCRIPT)).equals(src));
    } catch {
      return false;
    }
  }

  writeConfig(cfg: SpiderConfig): void {
    for (const p of this.targets()) this.writeConfigIn(p, cfg);
  }

  private writeConfigIn(p: PatchPaths, cfg: SpiderConfig): void {
    const js = path.join(p.dir, ASSET_CONFIG);
    const json = path.join(p.dir, ASSET_CONFIG_JSON);
    const alive = Date.now();
    fs.writeFileSync(js, configFileContent(cfg, alive), 'utf8');
    fs.writeFileSync(json, configPayload(cfg, alive), 'utf8');
    this.own(js);
    this.own(json);
  }

  install(cfg: SpiderConfig): { checksumUpdated: boolean } {
    const targets = this.targets();
    for (const p of targets) fs.accessSync(p.html, fs.constants.W_OK); // lève EACCES avant toute écriture
    let allSynced = true;
    for (const p of targets) {
      const original = fs.readFileSync(p.html, 'utf8');
      if (!hasBlock(original)) {
        fs.copyFileSync(p.html, p.html + '.cyberpunk-spider.bak');
        this.own(p.html + '.cyberpunk-spider.bak');
      }
      // Assets d'abord : on ne référence jamais un fichier absent.
      const script = path.join(p.dir, ASSET_SCRIPT);
      fs.copyFileSync(this.injectedSrc, script);
      this.own(script);
      this.writeConfigIn(p, cfg);
      fs.writeFileSync(p.html, injectBlock(original), 'utf8');
      allSynced = this.syncChecksum(p) && allSynced;
      // Après un sudo : le dossier, workbench.html et product.json deviennent modifiables par l'utilisateur,
      // pour que mises à jour, réglages et désinstallation n'aient plus besoin de droits root.
      this.own(p.html);
      this.own(p.dir);
      this.own(p.product);
    }
    return { checksumUpdated: allSynced };
  }

  uninstall(): void {
    for (const p of this.targets()) {
      const html = fs.readFileSync(p.html, 'utf8');
      if (hasBlock(html)) fs.writeFileSync(p.html, removeBlock(html), 'utf8');
      this.syncChecksum(p);
      this.own(p.html);
      this.own(p.product);
      // Le .bak ne sert qu'à la sécurité pendant l'installation : après restauration exacte, il serait périmé.
      for (const f of [ASSET_SCRIPT, ASSET_CONFIG, ASSET_CONFIG_JSON, path.basename(p.html) + '.cyberpunk-spider.bak']) {
        try {
          fs.unlinkSync(path.join(p.dir, f));
        } catch {
          /* déjà absent */
        }
      }
    }
  }

  /** Recalcule le checksum de workbench.html dans product.json pour éviter l'alerte « installation corrompue ». */
  private syncChecksum(p: PatchPaths): boolean {
    try {
      const raw = fs.readFileSync(p.product, 'utf8');
      const next = replaceChecksum(raw, p.checksumKey, computeChecksum(fs.readFileSync(p.html)));
      if (next === null) return false;
      if (next !== raw) fs.writeFileSync(p.product, next, 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}
