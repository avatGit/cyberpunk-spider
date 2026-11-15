import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  injectBlock,
  removeBlock,
  hasBlock,
  computeChecksum,
  replaceChecksum,
  Patcher,
} from '../src/extension/patcher';
import { DEFAULT_CONFIG, sanitizeConfig } from '../src/shared/types';

const HTML = '<!DOCTYPE html>\n<html>\n<body>\n<script src="a.js"></script>\n</body>\n</html>\n';

describe('injection HTML', () => {
  it('injecte avant </body>, est idempotente et réversible à l\'identique', () => {
    const once = injectBlock(HTML);
    expect(hasBlock(once)).toBe(true);
    expect(once.indexOf('cyberpunk-spider.js')).toBeLessThan(once.indexOf('</body>'));
    expect(injectBlock(once)).toBe(once);
    expect(removeBlock(once)).toBe(HTML);
  });
});

describe('checksum', () => {
  it('sha256 base64 sans padding', () => {
    const c = computeChecksum('hello');
    expect(c).toBe('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ');
    expect(c.endsWith('=')).toBe(false);
  });

  it('remplace uniquement la bonne clé dans product.json', () => {
    const raw = '{\n\t"checksums": {\n\t\t"vs/a.html": "OLD",\n\t\t"vs/b.html": "KEEP"\n\t}\n}';
    const out = replaceChecksum(raw, 'vs/a.html', 'NEW')!;
    expect(out).toContain('"vs/a.html": "NEW"');
    expect(out).toContain('"vs/b.html": "KEEP"');
    expect(replaceChecksum(raw, 'vs/zzz.html', 'X')).toBeNull();
  });
});

describe('Patcher (disque)', () => {
  it('installe puis désinstalle en restaurant html et checksum', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-'));
    const dir = path.join(root, 'out', 'vs', 'code', 'electron-sandbox', 'workbench');
    fs.mkdirSync(dir, { recursive: true });
    const html = path.join(dir, 'workbench.html');
    fs.writeFileSync(html, HTML);
    const key = 'vs/code/electron-sandbox/workbench/workbench.html';
    const product = path.join(root, 'product.json');
    const originalProduct = JSON.stringify({ checksums: { [key]: computeChecksum(HTML) } }, null, '\t');
    fs.writeFileSync(product, originalProduct);
    const bundle = path.join(root, 'injected.js');
    fs.writeFileSync(bundle, 'console.log(1)');

    const p = new Patcher(root, bundle);
    expect(p.isInstalled()).toBe(false);
    expect(p.install(DEFAULT_CONFIG).checksumUpdated).toBe(true);
    expect(p.isInstalled()).toBe(true);
    expect(p.isUpToDate()).toBe(true);
    const patched = fs.readFileSync(html);
    expect(JSON.parse(fs.readFileSync(product, 'utf8')).checksums[key]).toBe(computeChecksum(patched));

    p.uninstall();
    expect(fs.readFileSync(html, 'utf8')).toBe(HTML);
    expect(fs.readFileSync(product, 'utf8')).toBe(originalProduct);
    expect(fs.existsSync(path.join(dir, 'cyberpunk-spider.js'))).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('sanitizeConfig', () => {
  it('borne les valeurs et rejette les couleurs invalides', () => {
    const c = sanitizeConfig({ speed: 99, size: -1, palette: ['#fff', 'red', '#00ff00'], idleSeconds: 'x' });
    expect(c.speed).toBe(3);
    expect(c.size).toBe(0.5);
    expect(c.palette).toEqual(['#00ff00']);
    expect(c.idleSeconds).toBe(60);
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
  });
});

import { buildSudoCommand, shQuote } from '../src/extension/elevate';
import { extensionAlive, GRACE_MS, STALE_MS } from '../src/injected/alive';
import { execFileSync } from 'child_process';

describe('élévation sudo', () => {
  it('protège les quotes et encode la config', () => {
    expect(shQuote("a'b")).toBe(`'a'\\''b'`);
    const cmd = buildSudoCommand({
      kind: 'install',
      execPath: '/usr/share/code/code',
      cliPath: "/home/u/.vscode/extensions/x y/dist/cli.js",
      appRoot: '/usr/share/code/resources/app',
      injectedPath: '/home/u/.vscode/extensions/x y/dist/injected.js',
      cfg: DEFAULT_CONFIG,
    });
    expect(cmd.startsWith('sudo env ELECTRON_RUN_AS_NODE=1 ')).toBe(true);
    expect(cmd).toContain("'/home/u/.vscode/extensions/x y/dist/cli.js' install --app-root");
    const b64 = cmd.split('--config-b64 ')[1];
    expect(JSON.parse(Buffer.from(b64, 'base64').toString())).toEqual(DEFAULT_CONFIG);
    expect(buildSudoCommand({ ...{ kind: 'uninstall' as const, execPath: 'c', cliPath: 'd', appRoot: 'r', injectedPath: 'i', cfg: DEFAULT_CONFIG } })).not.toContain('--src');
  });
});

describe('signe de vie (auto-arrêt)', () => {
  const T0 = 1_000_000_000_000;
  it('ne cache jamais l\'araignée pendant le délai de grâce, ni sans info', () => {
    expect(extensionAlive(T0 + 1000, T0, T0 - 99 * STALE_MS, true)).toBe(true);
    expect(extensionAlive(T0 + 10 * GRACE_MS, T0, null, true)).toBe(true);
    expect(extensionAlive(T0 + 10 * GRACE_MS, T0, T0 - 99 * STALE_MS, false)).toBe(true);
  });
  it('cache l\'araignée quand le signe de vie est périmé', () => {
    expect(extensionAlive(T0 + GRACE_MS + 1, T0, T0 - STALE_MS - 1, true)).toBe(false);
    expect(extensionAlive(T0 + GRACE_MS + 1, T0, T0 + GRACE_MS - 60_000, true)).toBe(true);
  });
});

describe('cli (désinstallation et install sans VS Code)', () => {
  it('install puis uninstall via le binaire cli, restauration à l\'identique', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-cli-'));
    const dir = path.join(root, 'out', 'vs', 'code', 'electron-sandbox', 'workbench');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'workbench.html'), HTML);
    const key = 'vs/code/electron-sandbox/workbench/workbench.html';
    const prod = JSON.stringify({ checksums: { [key]: computeChecksum(HTML) } }, null, '\t');
    fs.writeFileSync(path.join(root, 'product.json'), prod);
    fs.writeFileSync(path.join(root, 'injected.js'), '//x');
    const cli = path.resolve(__dirname, '../dist/cli.js');
    if (!fs.existsSync(cli)) return; // nécessite `npm run build`
    const b64 = Buffer.from(JSON.stringify(DEFAULT_CONFIG)).toString('base64');
    const run = (...a: string[]) => execFileSync(process.execPath, [cli, ...a], { encoding: 'utf8' });
    expect(run('install', '--app-root', root, '--src', path.join(root, 'injected.js'), '--config-b64', b64)).toContain('OK');
    expect(fs.readFileSync(path.join(dir, 'workbench.html'), 'utf8')).toContain('CYBERPUNK-SPIDER-START');
    expect(run('uninstall', '--app-root', root)).toContain('OK');
    expect(fs.readFileSync(path.join(dir, 'workbench.html'), 'utf8')).toBe(HTML);
    expect(fs.readFileSync(path.join(root, 'product.json'), 'utf8')).toBe(prod);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
