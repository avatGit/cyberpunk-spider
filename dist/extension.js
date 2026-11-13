"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));

// src/extension/patcher.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));

// src/shared/types.ts
var PRESETS = {
  "Spider-Verse": ["#39ff14", "#b026ff", "#00f0ff", "#ff2bd6"],
  "Neon Tokyo": ["#ff2bd6", "#00f0ff", "#fff200"],
  Matrix: ["#00ff41", "#00b82e", "#b8ffcb"],
  Synthwave: ["#ff6ec7", "#7a5cff", "#00e5ff"],
  Miles: ["#ff1e3c", "#00f0ff", "#ffffff"]
};
var DEFAULT_CONFIG = {
  enabled: true,
  speed: 1,
  size: 1,
  glow: 0.8,
  idleSeconds: 60,
  palette: PRESETS["Spider-Verse"],
  huntBugs: true,
  silkTrail: true
};
var ASSET_SCRIPT = "cyberpunk-spider.js";
var ASSET_CONFIG = "cyberpunk-spider.config.js";
var ASSET_CONFIG_JSON = "cyberpunk-spider.config.json";
var CONFIG_GLOBAL = "__CYBERPUNK_SPIDER_CONFIG__";
var HEX = /^#[0-9a-f]{6}$/i;
function num(v, min, max, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
function bool(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}
function sanitizeConfig(raw) {
  const r = raw ?? {};
  const palette = Array.isArray(r.palette) ? r.palette.filter((c) => typeof c === "string" && HEX.test(c)).slice(0, 8) : [];
  return {
    enabled: bool(r.enabled, DEFAULT_CONFIG.enabled),
    speed: num(r.speed, 0.3, 3, DEFAULT_CONFIG.speed),
    size: num(r.size, 0.5, 2.5, DEFAULT_CONFIG.size),
    glow: num(r.glow, 0, 1, DEFAULT_CONFIG.glow),
    idleSeconds: num(r.idleSeconds, 10, 3600, DEFAULT_CONFIG.idleSeconds),
    palette: palette.length ? palette : [...DEFAULT_CONFIG.palette],
    huntBugs: bool(r.huntBugs, DEFAULT_CONFIG.huntBugs),
    silkTrail: bool(r.silkTrail, DEFAULT_CONFIG.silkTrail)
  };
}

// src/extension/patcher.ts
var MARK_START = "<!-- CYBERPUNK-SPIDER-START -->";
var MARK_END = "<!-- CYBERPUNK-SPIDER-END -->";
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var BLOCK_RE = new RegExp(`${esc(MARK_START)}[\\s\\S]*?${esc(MARK_END)}\\n?`, "g");
function buildBlock() {
  return `${MARK_START}
<script src="${ASSET_CONFIG}"></script>
<script src="${ASSET_SCRIPT}"></script>
${MARK_END}
`;
}
function hasBlock(html) {
  return html.includes(MARK_START);
}
function removeBlock(html) {
  return html.replace(BLOCK_RE, "");
}
function injectBlock(html) {
  const clean = removeBlock(html);
  let i = clean.lastIndexOf("</body>");
  if (i < 0) i = clean.lastIndexOf("</html>");
  if (i < 0) throw new Error("workbench.html : balise </body> ou </html> introuvable.");
  return clean.slice(0, i) + buildBlock() + clean.slice(i);
}
function computeChecksum(content) {
  return crypto.createHash("sha256").update(content).digest("base64").replace(/=+$/, "");
}
function replaceChecksum(productRaw, key, newHash) {
  const re = new RegExp(`("${esc(key)}"\\s*:\\s*")[^"]*(")`);
  if (!re.test(productRaw)) return null;
  return productRaw.replace(re, `$1${newHash}$2`);
}
function configFileContent(cfg) {
  return `window.${CONFIG_GLOBAL}=${JSON.stringify(cfg)};
`;
}
var HTML_CANDIDATES = [
  "vs/code/electron-sandbox/workbench/workbench.html",
  "vs/code/electron-sandbox/workbench/workbench.esm.html",
  "vs/code/electron-browser/workbench/workbench.html"
];
function locateAll(appRoot) {
  const found = [];
  for (const rel of HTML_CANDIDATES) {
    const html = path.join(appRoot, "out", ...rel.split("/"));
    if (fs.existsSync(html)) {
      found.push({ html, dir: path.dirname(html), checksumKey: rel, product: path.join(appRoot, "product.json") });
    }
  }
  if (!found.length) {
    throw new Error(`workbench.html introuvable sous ${appRoot}. Version de VS Code non support\xE9e ?`);
  }
  return found;
}
var Patcher = class {
  /** `injectedSrc` : chemin du bundle dist/injected.js (vide pour une simple désinstallation). */
  constructor(appRoot, injectedSrc) {
    this.appRoot = appRoot;
    this.injectedSrc = injectedSrc;
  }
  targets() {
    return locateAll(this.appRoot);
  }
  isInstalled() {
    try {
      return this.targets().every(
        (p) => hasBlock(fs.readFileSync(p.html, "utf8")) && fs.existsSync(path.join(p.dir, ASSET_SCRIPT))
      );
    } catch {
      return false;
    }
  }
  /** Le script déposé correspond-il à celui de l'extension installée ? */
  isUpToDate() {
    try {
      const src = fs.readFileSync(this.injectedSrc);
      return this.targets().every((p) => fs.readFileSync(path.join(p.dir, ASSET_SCRIPT)).equals(src));
    } catch {
      return false;
    }
  }
  writeConfig(cfg) {
    for (const p of this.targets()) this.writeConfigIn(p, cfg);
  }
  writeConfigIn(p, cfg) {
    fs.writeFileSync(path.join(p.dir, ASSET_CONFIG), configFileContent(cfg), "utf8");
    fs.writeFileSync(path.join(p.dir, ASSET_CONFIG_JSON), JSON.stringify(cfg), "utf8");
  }
  install(cfg) {
    const targets = this.targets();
    for (const p of targets) fs.accessSync(p.html, fs.constants.W_OK);
    let allSynced = true;
    for (const p of targets) {
      const original = fs.readFileSync(p.html, "utf8");
      if (!hasBlock(original)) fs.copyFileSync(p.html, p.html + ".cyberpunk-spider.bak");
      fs.copyFileSync(this.injectedSrc, path.join(p.dir, ASSET_SCRIPT));
      this.writeConfigIn(p, cfg);
      fs.writeFileSync(p.html, injectBlock(original), "utf8");
      allSynced = this.syncChecksum(p) && allSynced;
    }
    return { checksumUpdated: allSynced };
  }
  uninstall() {
    for (const p of this.targets()) {
      const html = fs.readFileSync(p.html, "utf8");
      if (hasBlock(html)) fs.writeFileSync(p.html, removeBlock(html), "utf8");
      this.syncChecksum(p);
      for (const f of [ASSET_SCRIPT, ASSET_CONFIG, ASSET_CONFIG_JSON]) {
        try {
          fs.unlinkSync(path.join(p.dir, f));
        } catch {
        }
      }
    }
  }
  /** Recalcule le checksum de workbench.html dans product.json pour éviter l'alerte « installation corrompue ». */
  syncChecksum(p) {
    try {
      const raw = fs.readFileSync(p.product, "utf8");
      const next = replaceChecksum(raw, p.checksumKey, computeChecksum(fs.readFileSync(p.html)));
      if (next === null) return false;
      if (next !== raw) fs.writeFileSync(p.product, next, "utf8");
      return true;
    } catch {
      return false;
    }
  }
};

// src/extension/config.ts
var vscode = __toESM(require("vscode"));
var SECTION = "cyberpunkSpider";
function readConfig() {
  const c = vscode.workspace.getConfiguration(SECTION);
  return sanitizeConfig({
    enabled: c.get("enabled"),
    speed: c.get("speed"),
    size: c.get("size"),
    glow: c.get("glow"),
    idleSeconds: c.get("idleSeconds"),
    palette: c.get("palette"),
    huntBugs: c.get("huntBugs"),
    silkTrail: c.get("silkTrail")
  });
}
function readFavorites() {
  const raw = vscode.workspace.getConfiguration(SECTION).get("favoritePalettes");
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f) => !!f && typeof f.name === "string" && Array.isArray(f.colors)
  );
}

// src/extension/settingsPanel.ts
var vscode2 = __toESM(require("vscode"));
var ALLOWED_KEYS = /* @__PURE__ */ new Set(["enabled", "speed", "size", "glow", "idleSeconds", "palette", "huntBugs", "silkTrail"]);
var current;
function openSettingsPanel(context, actions) {
  if (current) {
    current.reveal();
    return;
  }
  const panel = vscode2.window.createWebviewPanel("cyberpunkSpiderSettings", "Cyberpunk Spider \u2014 R\xE9glages", vscode2.ViewColumn.Active, {
    enableScripts: true
  });
  current = panel;
  const post = () => panel.webview.postMessage({
    type: "state",
    config: readConfig(),
    favorites: readFavorites(),
    presets: PRESETS,
    installed: actions.isInstalled()
  });
  panel.webview.html = getHtml();
  const cfg = () => vscode2.workspace.getConfiguration(SECTION);
  const subs = [
    vscode2.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) post();
    }),
    panel.webview.onDidReceiveMessage(async (m) => {
      try {
        switch (m?.type) {
          case "ready":
            post();
            break;
          case "set":
            if (ALLOWED_KEYS.has(m.key)) await cfg().update(m.key, m.value, vscode2.ConfigurationTarget.Global);
            break;
          case "saveFavorite": {
            const name = String(m.name ?? "").trim().slice(0, 40);
            if (!name || !Array.isArray(m.colors)) break;
            const favs = readFavorites().filter((f) => f.name !== name);
            favs.push({ name, colors: m.colors });
            await cfg().update("favoritePalettes", favs, vscode2.ConfigurationTarget.Global);
            break;
          }
          case "deleteFavorite": {
            const favs = readFavorites().filter((f) => f.name !== m.name);
            await cfg().update("favoritePalettes", favs, vscode2.ConfigurationTarget.Global);
            break;
          }
          case "install":
            await actions.install();
            post();
            break;
          case "uninstall":
            await actions.uninstall();
            post();
            break;
          case "reload":
            actions.reload();
            break;
        }
      } catch (e) {
        vscode2.window.showErrorMessage(`Cyberpunk Spider : ${e.message}`);
      }
    })
  ];
  panel.onDidDispose(() => {
    current = void 0;
    subs.forEach((s) => s.dispose());
  });
  context.subscriptions.push(panel);
}
function nonce() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function getHtml() {
  const n = nonce();
  return (
    /* html */
    `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${n}">
:root{--bg:#0a0a14;--card:#12121f;--line:#26264a;--fg:#d8f3ff;--dim:#8a8fb5;--neon:#00f0ff;--pink:#ff2bd6;--green:#39ff14}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font:13px/1.5 var(--vscode-editor-font-family,monospace);margin:0;padding:24px;max-width:720px}
h1{font-size:20px;margin:0 0 4px;color:var(--neon);text-shadow:0 0 12px var(--neon);letter-spacing:.05em}
.sub{color:var(--dim);margin-bottom:20px}
section{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin-bottom:14px}
h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--pink);margin:0 0 10px}
.row{display:flex;align-items:center;gap:12px;margin:8px 0}
.row label{flex:0 0 190px}
.row input[type=range]{flex:1;accent-color:var(--neon)}
.val{flex:0 0 52px;text-align:right;color:var(--neon)}
input[type=number]{width:90px;background:#0a0a14;color:var(--fg);border:1px solid var(--line);padding:3px 6px}
button{background:transparent;color:var(--neon);border:1px solid var(--neon);border-radius:3px;padding:4px 10px;cursor:pointer;font:inherit}
button:hover{background:rgba(0,240,255,.12);box-shadow:0 0 8px rgba(0,240,255,.4)}
button:disabled{opacity:.35;cursor:default;box-shadow:none}
button.danger{color:var(--pink);border-color:var(--pink)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}
.chip{padding:3px 10px;border-radius:12px;border:1px solid var(--line);color:var(--fg);position:relative}
.chip .x{margin-left:8px;color:var(--pink);cursor:pointer}
#grad{height:10px;border-radius:5px;margin:8px 0 10px;box-shadow:0 0 10px rgba(0,240,255,.25)}
#colors{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#colors input[type=color]{width:38px;height:28px;border:1px solid var(--line);background:none;padding:0}
.status{color:var(--green)} .status.off{color:var(--dim)}
.hint{color:var(--dim);font-size:12px;margin-top:8px}
</style></head><body>
<h1>\u{1F577} CYBERPUNK SPIDER</h1><div class="sub">R\xE9glages \u2014 appliqu\xE9s en direct, sans recharger.</div>

<section><h2>G\xE9n\xE9ral</h2>
 <div class="row"><label for="enabled">Araign\xE9e active</label><input type="checkbox" id="enabled"></div>
 <div class="row"><label for="huntBugs">Chasser les bugs</label><input type="checkbox" id="huntBugs"></div>
 <div class="row"><label for="silkTrail">Traces de soie</label><input type="checkbox" id="silkTrail"></div>
</section>

<section><h2>Comportement</h2>
 <div class="row"><label for="speed">Vitesse</label><input type="range" id="speed" min="0.3" max="3" step="0.1"><span class="val" id="v-speed"></span></div>
 <div class="row"><label for="size">Taille</label><input type="range" id="size" min="0.5" max="2.5" step="0.1"><span class="val" id="v-size"></span></div>
 <div class="row"><label for="glow">Intensit\xE9 du n\xE9on</label><input type="range" id="glow" min="0" max="1" step="0.05"><span class="val" id="v-glow"></span></div>
 <div class="row"><label for="idleSeconds">Inactivit\xE9 avant la toile (s)</label><input type="number" id="idleSeconds" min="10" max="3600" step="5"></div>
</section>

<section><h2>Palette n\xE9on</h2>
 <div id="grad"></div>
 <div class="chips" id="presets"></div>
 <div id="colors"></div>
 <div class="row" style="margin-top:12px"><input type="text" id="favName" placeholder="Nom du favori" style="background:#0a0a14;color:var(--fg);border:1px solid var(--line);padding:4px 8px"><button id="saveFav">\u2605 Enregistrer en favori</button></div>
 <div class="chips" id="favs"></div>
</section>

<section><h2>Installation</h2>
 <div class="row"><span id="status" class="status"></span></div>
 <div class="row"><button id="btn-install"></button><button id="btn-uninstall" class="danger">D\xE9sinstaller le patch</button><button id="btn-reload">Recharger la fen\xEAtre</button></div>
 <div class="hint">L'installation modifie workbench.html de VS Code. Rechargez la fen\xEAtre apr\xE8s une installation.</div>
</section>

<script nonce="${n}">
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const send = (m) => vscode.postMessage(m);
const timers = {};
let state = null;
let colors = [];
function setKey(key, value, delay) { clearTimeout(timers[key]); timers[key] = setTimeout(function () { send({ type: 'set', key: key, value: value }); }, delay || 0); }
const fmt = function (k, v) { return k === 'glow' ? Math.round(v * 100) + '%' : Number(v).toFixed(1) + '\xD7'; };

['speed', 'size', 'glow'].forEach(function (k) {
  $(k).addEventListener('input', function (e) { var v = parseFloat(e.target.value); $('v-' + k).textContent = fmt(k, v); setKey(k, v, 120); });
});
$('idleSeconds').addEventListener('change', function (e) { var v = Math.min(3600, Math.max(10, parseInt(e.target.value, 10) || 60)); setKey('idleSeconds', v); });
['enabled', 'huntBugs', 'silkTrail'].forEach(function (k) { $(k).addEventListener('change', function (e) { setKey(k, e.target.checked); }); });

function pushPalette(arr) { colors = arr; paintPalette(); setKey('palette', arr, 150); }
function paintPalette() {
  $('grad').style.background = 'linear-gradient(90deg,' + (colors.length > 1 ? colors.join(',') : colors[0] + ',' + colors[0]) + ')';
  var box = $('colors'); box.innerHTML = '';
  colors.forEach(function (c, i) {
    var inp = document.createElement('input'); inp.type = 'color'; inp.value = c;
    inp.addEventListener('input', function (e) { var a = colors.slice(); a[i] = e.target.value; pushPalette(a); });
    box.appendChild(inp);
    if (colors.length > 1) {
      var rm = document.createElement('button'); rm.textContent = '\u2212'; rm.className = 'danger';
      rm.addEventListener('click', function () { var a = colors.slice(); a.splice(i, 1); pushPalette(a); });
      box.appendChild(rm);
    }
  });
  if (colors.length < 8) {
    var add = document.createElement('button'); add.textContent = '+ couleur';
    add.addEventListener('click', function () { pushPalette(colors.concat(['#ffffff'])); });
    box.appendChild(add);
  }
}
function chip(label, arr, onClick, onDelete) {
  var el = document.createElement('span'); el.className = 'chip';
  el.style.cursor = 'pointer';
  el.style.borderImage = 'linear-gradient(90deg,' + (arr.length > 1 ? arr.join(',') : arr[0] + ',' + arr[0]) + ') 1';
  el.textContent = label;
  el.addEventListener('click', onClick);
  if (onDelete) { var x = document.createElement('span'); x.className = 'x'; x.textContent = '\u2715'; x.addEventListener('click', function (e) { e.stopPropagation(); onDelete(); }); el.appendChild(x); }
  return el;
}
function render(s) {
  state = s; var c = s.config;
  ['speed', 'size', 'glow'].forEach(function (k) { var el = $(k); if (document.activeElement !== el) el.value = c[k]; $('v-' + k).textContent = fmt(k, c[k]); });
  if (document.activeElement !== $('idleSeconds')) $('idleSeconds').value = c.idleSeconds;
  ['enabled', 'huntBugs', 'silkTrail'].forEach(function (k) { $(k).checked = c[k]; });
  colors = c.palette.slice(); paintPalette();
  var pr = $('presets'); pr.innerHTML = '';
  Object.keys(s.presets).forEach(function (name) { pr.appendChild(chip(name, s.presets[name], function () { pushPalette(s.presets[name].slice()); })); });
  var fv = $('favs'); fv.innerHTML = '';
  s.favorites.forEach(function (f) { fv.appendChild(chip('\u2605 ' + f.name, f.colors, function () { pushPalette(f.colors.slice()); }, function () { send({ type: 'deleteFavorite', name: f.name }); })); });
  $('status').textContent = s.installed ? '\u25CF Patch install\xE9' : '\u25CB Patch non install\xE9';
  $('status').className = 'status' + (s.installed ? '' : ' off');
  $('btn-install').textContent = s.installed ? 'R\xE9appliquer le patch' : 'Installer le patch';
  $('btn-uninstall').disabled = !s.installed;
}
$('saveFav').addEventListener('click', function () { var n = $('favName').value.trim(); if (n) { send({ type: 'saveFavorite', name: n, colors: colors }); $('favName').value = ''; } });
$('btn-install').addEventListener('click', function () { send({ type: 'install' }); });
$('btn-uninstall').addEventListener('click', function () { send({ type: 'uninstall' }); });
$('btn-reload').addEventListener('click', function () { send({ type: 'reload' }); });
window.addEventListener('message', function (e) { if (e.data && e.data.type === 'state') render(e.data); });
send({ type: 'ready' });
</script></body></html>`
  );
}

// src/extension/extension.ts
var KEY_INSTALLED_BEFORE = "cyberpunkSpider.installedBefore";
function activate(context) {
  const patcher = new Patcher(vscode3.env.appRoot, path2.join(context.extensionPath, "dist", "injected.js"));
  const status = vscode3.window.createStatusBarItem(vscode3.StatusBarAlignment.Right, 0);
  status.command = "cyberpunkSpider.toggle";
  context.subscriptions.push(status);
  const refreshStatus = () => {
    const on = patcher.isInstalled() && readConfig().enabled;
    status.text = on ? "$(bug) Spider" : "$(bug) Spider (off)";
    status.tooltip = "Cyberpunk Spider \u2014 cliquer pour activer/d\xE9sactiver";
    status.show();
  };
  async function reloadPrompt(message) {
    const pick = await vscode3.window.showInformationMessage(message, "Recharger la fen\xEAtre");
    if (pick) await vscode3.commands.executeCommand("workbench.action.reloadWindow");
  }
  async function install() {
    try {
      const { checksumUpdated } = patcher.install(readConfig());
      await context.globalState.update(KEY_INSTALLED_BEFORE, true);
      refreshStatus();
      const extra = checksumUpdated ? "" : " (checksum non mis \xE0 jour : un avertissement \xAB installation corrompue \xBB peut appara\xEEtre.)";
      await reloadPrompt(`Araign\xE9e install\xE9e${extra} Rechargez la fen\xEAtre pour la voir.`);
    } catch (e) {
      showFsError(e, "installer");
    }
  }
  async function uninstall() {
    try {
      patcher.uninstall();
      await context.globalState.update(KEY_INSTALLED_BEFORE, false);
      refreshStatus();
      await reloadPrompt("Patch retir\xE9. Rechargez la fen\xEAtre pour restaurer VS Code.");
    } catch (e) {
      showFsError(e, "d\xE9sinstaller");
    }
  }
  context.subscriptions.push(
    vscode3.commands.registerCommand("cyberpunkSpider.enable", install),
    vscode3.commands.registerCommand("cyberpunkSpider.disable", uninstall),
    vscode3.commands.registerCommand("cyberpunkSpider.toggle", async () => {
      if (!patcher.isInstalled()) {
        const pick = await vscode3.window.showInformationMessage(
          "L'araign\xE9e n'est pas encore install\xE9e dans VS Code.",
          "Installer"
        );
        if (pick) await install();
        return;
      }
      const cfg = vscode3.workspace.getConfiguration(SECTION);
      await cfg.update("enabled", !cfg.get("enabled", true), vscode3.ConfigurationTarget.Global);
    }),
    vscode3.commands.registerCommand(
      "cyberpunkSpider.openSettings",
      () => openSettingsPanel(context, {
        isInstalled: () => patcher.isInstalled(),
        install,
        uninstall,
        reload: () => void vscode3.commands.executeCommand("workbench.action.reloadWindow")
      })
    ),
    vscode3.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) return;
      try {
        if (patcher.isInstalled()) patcher.writeConfig(readConfig());
      } catch (err) {
        showFsError(err, "\xE9crire la configuration");
      }
      refreshStatus();
    })
  );
  try {
    if (patcher.isInstalled()) {
      if (!patcher.isUpToDate()) patcher.install(readConfig());
    } else if (context.globalState.get(KEY_INSTALLED_BEFORE)) {
      void vscode3.window.showWarningMessage(
        "VS Code a probablement \xE9t\xE9 mis \xE0 jour : le patch de Cyberpunk Spider a disparu.",
        "R\xE9appliquer",
        "Ne plus me le demander"
      ).then(async (pick) => {
        if (pick === "R\xE9appliquer") await install();
        else if (pick) await context.globalState.update(KEY_INSTALLED_BEFORE, false);
      });
    }
  } catch {
  }
  refreshStatus();
}
function deactivate() {
}
function showFsError(e, action) {
  const err = e;
  if (err.code === "EACCES" || err.code === "EPERM") {
    const hint = process.platform === "win32" ? "Relancez VS Code en administrateur (ou utilisez l'installation \xAB utilisateur \xBB)." : process.platform === "darwin" ? 'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/Contents/Resources/app/out".' : 'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/resources/app/out".';
    void vscode3.window.showErrorMessage(`Impossible de ${action} : droits insuffisants sur VS Code. ${hint}`);
  } else {
    void vscode3.window.showErrorMessage(`Impossible de ${action} : ${err.message}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
