// Patches / unpatches VS Code's workbench.html. Pure Node: no 'vscode' import,
// so it can also run from the `vscode:uninstall` hook and from tests.
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export const MARK_START = '<!-- CYBERPUNK-SPIDER-START (managed block, do not edit) -->';
export const MARK_END = '<!-- CYBERPUNK-SPIDER-END -->';
export const RUNTIME_FILE = 'cyberpunk-spider.js';
export const CONFIG_JS = 'cyberpunk-spider.config.js';
export const CONFIG_JSON = 'cyberpunk-spider.config.json';
const BACKUP_EXT = '.cyberpunk-spider.bak';

// Relative to appRoot. Every one that exists is patched (VS Code has moved this file around).
const HTML_CANDIDATES = [
  'out/vs/code/electron-sandbox/workbench/workbench.html',
  'out/vs/code/electron-sandbox/workbench/workbench.esm.html',
  'out/vs/code/electron-browser/workbench/workbench.html',
];

export type PatchErrorCode = 'NOT_FOUND' | 'PERMISSION' | 'IO';

export class PatchError extends Error {
  constructor(public readonly code: PatchErrorCode, message: string, public readonly file?: string) {
    super(message);
    this.name = 'PatchError';
  }
}

export interface Target {
  file: string;
  dir: string;
  /** Key used by product.json "checksums" (path relative to /out, forward slashes). */
  checksumKey: string;
}

export interface PatchStatus {
  found: number;
  patched: boolean;
  upToDate: boolean;
}

function wrap<T>(file: string, fn: () => T): T {
  try {
    return fn();
  } catch (e: any) {
    if (e instanceof PatchError) {
      throw e;
    }
    if (e && (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EROFS')) {
      throw new PatchError('PERMISSION', `No write access to ${file} (${e.code})`, file);
    }
    throw new PatchError('IO', String(e?.message ?? e), file);
  }
}

function sha256b64(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeIfChanged(file: string, content: string | Buffer): void {
  wrap(file, () => {
    if (fs.existsSync(file)) {
      const cur = fs.readFileSync(file);
      const next = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
      if (cur.equals(next)) {
        return;
      }
    }
    fs.writeFileSync(file, content);
  });
}

function rmQuiet(file: string): void {
  wrap(file, () => {
    if (fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
    }
  });
}

export function findTargets(appRoot: string): Target[] {
  const out: Target[] = [];
  for (const rel of HTML_CANDIDATES) {
    const file = path.join(appRoot, rel);
    if (fs.existsSync(file)) {
      out.push({ file, dir: path.dirname(file), checksumKey: rel.replace(/^out\//, '') });
    }
  }
  return out;
}

export function stripBlock(html: string): string {
  return html.replace(new RegExp(`${esc(MARK_START)}[\\s\\S]*?${esc(MARK_END)}\\n?`, 'g'), '');
}

export function injectBlock(html: string): string {
  const clean = stripBlock(html);
  const block =
    `${MARK_START}\n` +
    `<script src="${CONFIG_JS}"></script>\n` +
    `<script src="${RUNTIME_FILE}"></script>\n` +
    `${MARK_END}\n`;
  const idx = clean.toLowerCase().lastIndexOf('</html>');
  return idx === -1 ? clean + '\n' + block : clean.slice(0, idx) + block + clean.slice(idx);
}

function hasMarker(file: string): boolean {
  try {
    return fs.readFileSync(file, 'utf8').includes(MARK_START);
  } catch {
    return false;
  }
}

export function getStatus(appRoot: string, runtimeSrc: string): PatchStatus {
  const targets = findTargets(appRoot);
  const patched = targets.length > 0 && targets.every((t) => hasMarker(t.file));
  let upToDate = false;
  if (patched) {
    try {
      const src = fs.readFileSync(runtimeSrc);
      upToDate = targets.every((t) => {
        try {
          return fs.readFileSync(path.join(t.dir, RUNTIME_FILE)).equals(src);
        } catch {
          return false;
        }
      });
    } catch {
      upToDate = false;
    }
  }
  return { found: targets.length, patched, upToDate };
}

/** Keeps product.json "checksums" in sync so VS Code does not warn about a "corrupt installation". */
function syncChecksums(appRoot: string, targets: Target[]): number {
  const pj = path.join(appRoot, 'product.json');
  if (!fs.existsSync(pj)) {
    return 0;
  }
  let raw = fs.readFileSync(pj, 'utf8');
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return 0;
  }
  if (!json || typeof json.checksums !== 'object' || json.checksums === null) {
    return 0;
  }
  let changed = 0;
  for (const t of targets) {
    const old: string | undefined = json.checksums[t.checksumKey];
    if (old === undefined || !fs.existsSync(t.file)) {
      continue;
    }
    const sum = sha256b64(fs.readFileSync(t.file));
    if (old === sum) {
      continue;
    }
    // Targeted replace keeps the rest of product.json byte-identical.
    const re = new RegExp(`("${esc(t.checksumKey)}"\\s*:\\s*")${esc(old)}(")`);
    if (re.test(raw)) {
      raw = raw.replace(re, `$1${sum}$2`);
    } else {
      json.checksums[t.checksumKey] = sum;
      raw = JSON.stringify(json, null, '\t');
    }
    changed++;
  }
  if (changed) {
    const bak = pj + BACKUP_EXT;
    if (!fs.existsSync(bak)) {
      wrap(bak, () => fs.copyFileSync(pj, bak));
    }
    writeIfChanged(pj, raw);
  }
  return changed;
}

export function writeConfig(appRoot: string, payload: object): void {
  const json = JSON.stringify(payload);
  for (const t of findTargets(appRoot)) {
    if (!hasMarker(t.file)) {
      continue;
    }
    writeIfChanged(path.join(t.dir, CONFIG_JSON), json);
    writeIfChanged(path.join(t.dir, CONFIG_JS), `window.__CYBER_SPIDER_BOOT__=${json};\n`);
  }
}

export function install(appRoot: string, runtimeSrc: string, payload: object): void {
  const targets = findTargets(appRoot);
  if (targets.length === 0) {
    throw new PatchError('NOT_FOUND', `workbench.html not found under ${appRoot}`);
  }
  const runtime = fs.readFileSync(runtimeSrc);
  for (const t of targets) {
    const html = wrap(t.file, () => fs.readFileSync(t.file, 'utf8'));
    const bak = t.file + BACKUP_EXT;
    if (!html.includes(MARK_START) && !fs.existsSync(bak)) {
      wrap(bak, () => fs.copyFileSync(t.file, bak));
    }
    writeIfChanged(path.join(t.dir, RUNTIME_FILE), runtime);
    const json = JSON.stringify(payload);
    writeIfChanged(path.join(t.dir, CONFIG_JSON), json);
    writeIfChanged(path.join(t.dir, CONFIG_JS), `window.__CYBER_SPIDER_BOOT__=${json};\n`);
    writeIfChanged(t.file, injectBlock(html));
  }
  syncChecksums(appRoot, targets);
}

export function remove(appRoot: string): number {
  const targets = findTargets(appRoot);
  let patched = 0;
  for (const t of targets) {
    const html = wrap(t.file, () => fs.readFileSync(t.file, 'utf8'));
    if (html.includes(MARK_START)) {
      writeIfChanged(t.file, stripBlock(html));
      patched++;
    }
    for (const f of [RUNTIME_FILE, CONFIG_JS, CONFIG_JSON, path.basename(t.file) + BACKUP_EXT]) {
      rmQuiet(path.join(t.dir, f));
    }
  }
  syncChecksums(appRoot, targets);
  rmQuiet(path.join(appRoot, 'product.json' + BACKUP_EXT));
  return patched;
}
