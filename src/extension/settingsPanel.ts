import * as vscode from 'vscode';
import { PRESETS } from '../shared/types';
import { SECTION, readConfig, readFavorites } from './config';

export interface PanelActions {
  isInstalled(): boolean;
  install(): Promise<void>;
  uninstall(): Promise<void>;
  reload(): void;
}

const ALLOWED_KEYS = new Set(['enabled', 'speed', 'size', 'glow', 'idleSeconds', 'palette', 'huntBugs', 'silkTrail']);

let current: vscode.WebviewPanel | undefined;

export function openSettingsPanel(context: vscode.ExtensionContext, actions: PanelActions): void {
  if (current) {
    current.reveal();
    return;
  }
  const panel = vscode.window.createWebviewPanel('cyberpunkSpiderSettings', 'Cyberpunk Spider — Réglages', vscode.ViewColumn.Active, {
    enableScripts: true,
  });
  current = panel;

  const post = () =>
    panel.webview.postMessage({
      type: 'state',
      config: readConfig(),
      favorites: readFavorites(),
      presets: PRESETS,
      installed: actions.isInstalled(),
    });

  panel.webview.html = getHtml();
  const cfg = () => vscode.workspace.getConfiguration(SECTION);

  const subs: vscode.Disposable[] = [
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) post();
    }),
    panel.webview.onDidReceiveMessage(async (m: any) => {
      try {
        switch (m?.type) {
          case 'ready':
            post();
            break;
          case 'set':
            if (ALLOWED_KEYS.has(m.key)) await cfg().update(m.key, m.value, vscode.ConfigurationTarget.Global);
            break;
          case 'saveFavorite': {
            const name = String(m.name ?? '').trim().slice(0, 40);
            if (!name || !Array.isArray(m.colors)) break;
            const favs = readFavorites().filter((f) => f.name !== name);
            favs.push({ name, colors: m.colors });
            await cfg().update('favoritePalettes', favs, vscode.ConfigurationTarget.Global);
            break;
          }
          case 'deleteFavorite': {
            const favs = readFavorites().filter((f) => f.name !== m.name);
            await cfg().update('favoritePalettes', favs, vscode.ConfigurationTarget.Global);
            break;
          }
          case 'install':
            await actions.install();
            post();
            break;
          case 'uninstall':
            await actions.uninstall();
            post();
            break;
          case 'reload':
            actions.reload();
            break;
        }
      } catch (e) {
        vscode.window.showErrorMessage(`Cyberpunk Spider : ${(e as Error).message}`);
      }
    }),
  ];

  panel.onDidDispose(() => {
    current = undefined;
    subs.forEach((s) => s.dispose());
  });
  context.subscriptions.push(panel);
}

function nonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function getHtml(): string {
  const n = nonce();
  return /* html */ `<!DOCTYPE html>
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
<h1>🕷 CYBERPUNK SPIDER</h1><div class="sub">Réglages — appliqués en direct, sans recharger.</div>

<section><h2>Général</h2>
 <div class="row"><label for="enabled">Araignée active</label><input type="checkbox" id="enabled"></div>
 <div class="row"><label for="huntBugs">Chasser les bugs</label><input type="checkbox" id="huntBugs"></div>
 <div class="row"><label for="silkTrail">Traces de soie</label><input type="checkbox" id="silkTrail"></div>
</section>

<section><h2>Comportement</h2>
 <div class="row"><label for="speed">Vitesse</label><input type="range" id="speed" min="0.3" max="3" step="0.1"><span class="val" id="v-speed"></span></div>
 <div class="row"><label for="size">Taille</label><input type="range" id="size" min="0.5" max="2.5" step="0.1"><span class="val" id="v-size"></span></div>
 <div class="row"><label for="glow">Intensité du néon</label><input type="range" id="glow" min="0" max="1" step="0.05"><span class="val" id="v-glow"></span></div>
 <div class="row"><label for="idleSeconds">Inactivité avant la toile (s)</label><input type="number" id="idleSeconds" min="10" max="3600" step="5"></div>
</section>

<section><h2>Palette néon</h2>
 <div id="grad"></div>
 <div class="chips" id="presets"></div>
 <div id="colors"></div>
 <div class="row" style="margin-top:12px"><input type="text" id="favName" placeholder="Nom du favori" style="background:#0a0a14;color:var(--fg);border:1px solid var(--line);padding:4px 8px"><button id="saveFav">★ Enregistrer en favori</button></div>
 <div class="chips" id="favs"></div>
</section>

<section><h2>Installation</h2>
 <div class="row"><span id="status" class="status"></span></div>
 <div class="row"><button id="btn-install"></button><button id="btn-uninstall" class="danger">Désinstaller le patch</button><button id="btn-reload">Recharger la fenêtre</button></div>
 <div class="hint">L'installation modifie workbench.html de VS Code. Rechargez la fenêtre après une installation.</div>
</section>

<script nonce="${n}">
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const send = (m) => vscode.postMessage(m);
const timers = {};
let state = null;
let colors = [];
function setKey(key, value, delay) { clearTimeout(timers[key]); timers[key] = setTimeout(function () { send({ type: 'set', key: key, value: value }); }, delay || 0); }
const fmt = function (k, v) { return k === 'glow' ? Math.round(v * 100) + '%' : Number(v).toFixed(1) + '×'; };

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
      var rm = document.createElement('button'); rm.textContent = '−'; rm.className = 'danger';
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
  if (onDelete) { var x = document.createElement('span'); x.className = 'x'; x.textContent = '✕'; x.addEventListener('click', function (e) { e.stopPropagation(); onDelete(); }); el.appendChild(x); }
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
  s.favorites.forEach(function (f) { fv.appendChild(chip('★ ' + f.name, f.colors, function () { pushPalette(f.colors.slice()); }, function () { send({ type: 'deleteFavorite', name: f.name }); })); });
  $('status').textContent = s.installed ? '● Patch installé' : '○ Patch non installé';
  $('status').className = 'status' + (s.installed ? '' : ' off');
  $('btn-install').textContent = s.installed ? 'Réappliquer le patch' : 'Installer le patch';
  $('btn-uninstall').disabled = !s.installed;
}
$('saveFav').addEventListener('click', function () { var n = $('favName').value.trim(); if (n) { send({ type: 'saveFavorite', name: n, colors: colors }); $('favName').value = ''; } });
$('btn-install').addEventListener('click', function () { send({ type: 'install' }); });
$('btn-uninstall').addEventListener('click', function () { send({ type: 'uninstall' }); });
$('btn-reload').addEventListener('click', function () { send({ type: 'reload' }); });
window.addEventListener('message', function (e) { if (e.data && e.data.type === 'state') render(e.data); });
send({ type: 'ready' });
</script></body></html>`;
}
