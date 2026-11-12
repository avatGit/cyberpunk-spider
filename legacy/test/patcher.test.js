// Tests src/patcher.ts against a fake VS Code install (temp dir). Bundles the TS with esbuild first.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const esbuild = require('esbuild');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-test-'));
const bundle = path.join(tmp, 'patcher.cjs');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'patcher.ts')],
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent',
});
const P = require(bundle);

const sum = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('base64').replace(/=+$/, '');

// fake appRoot
const root = path.join(tmp, 'app');
const dir = path.join(root, 'out/vs/code/electron-sandbox/workbench');
fs.mkdirSync(dir, { recursive: true });
const htmlPath = path.join(dir, 'workbench.html');
const original = '<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n<script src="a.js"></script>\n</body>\n</html>\n';
fs.writeFileSync(htmlPath, original);
const key = 'vs/code/electron-sandbox/workbench/workbench.html';
const productPath = path.join(root, 'product.json');
const productOriginal = JSON.stringify({ nameShort: 'Code', checksums: { [key]: sum(htmlPath), 'vs/other.js': 'zzz' } }, null, '\t');
fs.writeFileSync(productPath, productOriginal);

const runtimeSrc = path.join(__dirname, '..', 'media', 'spider-runtime.js');
const payload = { enabled: true, speed: 120, colors: ['#00f0ff'] };

assert.strictEqual(P.getStatus(root, runtimeSrc).patched, false);

P.install(root, runtimeSrc, payload);
let st = P.getStatus(root, runtimeSrc);
assert(st.patched && st.upToDate, 'patched and up to date');
const html = fs.readFileSync(htmlPath, 'utf8');
assert(html.includes('cyberpunk-spider.js') && html.includes('cyberpunk-spider.config.js'));
assert(html.indexOf(P.MARK_START) < html.lastIndexOf('</html>'), 'block is before </html>');
assert(fs.existsSync(path.join(dir, 'cyberpunk-spider.js')));
assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cyberpunk-spider.config.json'), 'utf8')), payload);
assert.strictEqual(JSON.parse(fs.readFileSync(productPath, 'utf8')).checksums[key], sum(htmlPath), 'checksum updated');
assert.strictEqual(JSON.parse(fs.readFileSync(productPath, 'utf8')).checksums['vs/other.js'], 'zzz', 'other checksums untouched');

// idempotent: a second install must not duplicate the block
P.install(root, runtimeSrc, payload);
assert.strictEqual(fs.readFileSync(htmlPath, 'utf8').split(P.MARK_START).length - 1, 1, 'single block after re-install');

// live config update
P.writeConfig(root, { ...payload, speed: 200 });
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'cyberpunk-spider.config.json'), 'utf8')).speed, 200);

// remove restores the original byte for byte, including the checksum
P.remove(root);
assert.strictEqual(fs.readFileSync(htmlPath, 'utf8'), original, 'workbench.html restored exactly');
assert.strictEqual(fs.readFileSync(productPath, 'utf8'), productOriginal, 'product.json restored exactly');
assert(!fs.existsSync(path.join(dir, 'cyberpunk-spider.js')), 'runtime removed');
assert.strictEqual(P.getStatus(root, runtimeSrc).patched, false);

// missing workbench.html
assert.throws(() => P.install(path.join(tmp, 'nope'), runtimeSrc, payload), (e) => e.code === 'NOT_FOUND');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('patcher tests passed');
