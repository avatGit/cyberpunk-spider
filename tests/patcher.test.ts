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
