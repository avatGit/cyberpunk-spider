"use strict";var K=Object.create;var b=Object.defineProperty;var G=Object.getOwnPropertyDescriptor;var V=Object.getOwnPropertyNames;var U=Object.getPrototypeOf,q=Object.prototype.hasOwnProperty;var H=(t,e)=>{for(var n in e)b(t,n,{get:e[n],enumerable:!0})},A=(t,e,n,o)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of V(e))!q.call(t,s)&&s!==n&&b(t,s,{get:()=>e[s],enumerable:!(o=G(e,s))||o.enumerable});return t};var v=(t,e,n)=>(n=t!=null?K(U(t)):{},A(e||!t||!t.__esModule?b(n,"default",{value:t,enumerable:!0}):n,t)),W=t=>A(b({},"__esModule",{value:!0}),t);var ce={};H(ce,{activate:()=>se,deactivate:()=>le});module.exports=W(ce);var a=v(require("vscode")),O=v(require("path"));var r=v(require("fs")),d=v(require("path")),z=v(require("crypto"));var P={"Spider-Verse":["#39ff14","#b026ff","#00f0ff","#ff2bd6"],"Neon Tokyo":["#ff2bd6","#00f0ff","#fff200"],Matrix:["#00ff41","#00b82e","#b8ffcb"],Synthwave:["#ff6ec7","#7a5cff","#00e5ff"],Miles:["#ff1e3c","#00f0ff","#ffffff"]},f={enabled:!0,speed:1,size:1,glow:.8,idleSeconds:60,palette:P["Spider-Verse"],huntBugs:!0,silkTrail:!0},m="cyberpunk-spider.js",y="cyberpunk-spider.config.js",$="cyberpunk-spider.config.json",B="__CYBERPUNK_SPIDER_CONFIG__",Y=/^#[0-9a-f]{6}$/i;function w(t,e,n,o){return typeof t=="number"&&Number.isFinite(t)?Math.min(n,Math.max(e,t)):o}function E(t,e){return typeof t=="boolean"?t:e}function L(t){let e=t??{},n=Array.isArray(e.palette)?e.palette.filter(o=>typeof o=="string"&&Y.test(o)).slice(0,8):[];return{enabled:E(e.enabled,f.enabled),speed:w(e.speed,.3,3,f.speed),size:w(e.size,.5,2.5,f.size),glow:w(e.glow,0,1,f.glow),idleSeconds:w(e.idleSeconds,10,3600,f.idleSeconds),palette:n.length?n:[...f.palette],huntBugs:E(e.huntBugs,f.huntBugs),silkTrail:E(e.silkTrail,f.silkTrail)}}var F="<!-- CYBERPUNK-SPIDER-START -->",D="<!-- CYBERPUNK-SPIDER-END -->",I=t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),J=new RegExp(`${I(F)}[\\s\\S]*?${I(D)}\\n?`,"g");function X(){return`${F}
<script src="${y}"></script>
<script src="${m}"></script>
${D}
`}function T(t){return t.includes(F)}function j(t){return t.replace(J,"")}function Q(t){let e=j(t),n=e.lastIndexOf("</body>");if(n<0&&(n=e.lastIndexOf("</html>")),n<0)throw new Error("workbench.html : balise </body> ou </html> introuvable.");return e.slice(0,n)+X()+e.slice(n)}function Z(t){return z.createHash("sha256").update(t).digest("base64").replace(/=+$/,"")}function ee(t,e,n){let o=new RegExp(`("${I(e)}"\\s*:\\s*")[^"]*(")`);return o.test(t)?t.replace(o,`$1${n}$2`):null}function te(t){return`window.${B}=${JSON.stringify(t)};
`}var ne=["vs/code/electron-sandbox/workbench/workbench.html","vs/code/electron-sandbox/workbench/workbench.esm.html","vs/code/electron-browser/workbench/workbench.html"];function oe(t){let e=[];for(let n of ne){let o=d.join(t,"out",...n.split("/"));r.existsSync(o)&&e.push({html:o,dir:d.dirname(o),checksumKey:n,product:d.join(t,"product.json")})}if(!e.length)throw new Error(`workbench.html introuvable sous ${t}. Version de VS Code non support\xE9e ?`);return e}var x=class{constructor(e,n){this.appRoot=e;this.injectedSrc=n}targets(){return oe(this.appRoot)}isInstalled(){try{return this.targets().every(e=>T(r.readFileSync(e.html,"utf8"))&&r.existsSync(d.join(e.dir,m)))}catch{return!1}}isUpToDate(){try{let e=r.readFileSync(this.injectedSrc);return this.targets().every(n=>r.readFileSync(d.join(n.dir,m)).equals(e))}catch{return!1}}writeConfig(e){for(let n of this.targets())this.writeConfigIn(n,e)}writeConfigIn(e,n){r.writeFileSync(d.join(e.dir,y),te(n),"utf8"),r.writeFileSync(d.join(e.dir,$),JSON.stringify(n),"utf8")}install(e){let n=this.targets();for(let s of n)r.accessSync(s.html,r.constants.W_OK);let o=!0;for(let s of n){let p=r.readFileSync(s.html,"utf8");T(p)||r.copyFileSync(s.html,s.html+".cyberpunk-spider.bak"),r.copyFileSync(this.injectedSrc,d.join(s.dir,m)),this.writeConfigIn(s,e),r.writeFileSync(s.html,Q(p),"utf8"),o=this.syncChecksum(s)&&o}return{checksumUpdated:o}}uninstall(){for(let e of this.targets()){let n=r.readFileSync(e.html,"utf8");T(n)&&r.writeFileSync(e.html,j(n),"utf8"),this.syncChecksum(e);for(let o of[m,y,$])try{r.unlinkSync(d.join(e.dir,o))}catch{}}}syncChecksum(e){try{let n=r.readFileSync(e.product,"utf8"),o=ee(n,e.checksumKey,Z(r.readFileSync(e.html)));return o===null?!1:(o!==n&&r.writeFileSync(e.product,o,"utf8"),!0)}catch{return!1}}};var R=v(require("vscode"));var g="cyberpunkSpider";function h(){let t=R.workspace.getConfiguration(g);return L({enabled:t.get("enabled"),speed:t.get("speed"),size:t.get("size"),glow:t.get("glow"),idleSeconds:t.get("idleSeconds"),palette:t.get("palette"),huntBugs:t.get("huntBugs"),silkTrail:t.get("silkTrail")})}function k(){let t=R.workspace.getConfiguration(g).get("favoritePalettes");return Array.isArray(t)?t.filter(e=>!!e&&typeof e.name=="string"&&Array.isArray(e.colors)):[]}var c=v(require("vscode"));var re=new Set(["enabled","speed","size","glow","idleSeconds","palette","huntBugs","silkTrail"]),S;function M(t,e){if(S){S.reveal();return}let n=c.window.createWebviewPanel("cyberpunkSpiderSettings","Cyberpunk Spider \u2014 R\xE9glages",c.ViewColumn.Active,{enableScripts:!0});S=n;let o=()=>n.webview.postMessage({type:"state",config:h(),favorites:k(),presets:P,installed:e.isInstalled()});n.webview.html=ae();let s=()=>c.workspace.getConfiguration(g),p=[c.workspace.onDidChangeConfiguration(l=>{l.affectsConfiguration(g)&&o()}),n.webview.onDidReceiveMessage(async l=>{try{switch(l?.type){case"ready":o();break;case"set":re.has(l.key)&&await s().update(l.key,l.value,c.ConfigurationTarget.Global);break;case"saveFavorite":{let i=String(l.name??"").trim().slice(0,40);if(!i||!Array.isArray(l.colors))break;let u=k().filter(_=>_.name!==i);u.push({name:i,colors:l.colors}),await s().update("favoritePalettes",u,c.ConfigurationTarget.Global);break}case"deleteFavorite":{let i=k().filter(u=>u.name!==l.name);await s().update("favoritePalettes",i,c.ConfigurationTarget.Global);break}case"install":await e.install(),o();break;case"uninstall":await e.uninstall(),o();break;case"reload":e.reload();break}}catch(i){c.window.showErrorMessage(`Cyberpunk Spider : ${i.message}`)}})];n.onDidDispose(()=>{S=void 0,p.forEach(l=>l.dispose())}),t.subscriptions.push(n)}function ie(){let t="abcdefghijklmnopqrstuvwxyz0123456789",e="";for(let n=0;n<24;n++)e+=t[Math.floor(Math.random()*t.length)];return e}function ae(){let t=ie();return`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${t}'; script-src 'nonce-${t}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${t}">
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

<script nonce="${t}">
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
</script></body></html>`}var C="cyberpunkSpider.installedBefore";function se(t){let e=new x(a.env.appRoot,O.join(t.extensionPath,"dist","injected.js")),n=a.window.createStatusBarItem(a.StatusBarAlignment.Right,0);n.command="cyberpunkSpider.toggle",t.subscriptions.push(n);let o=()=>{let i=e.isInstalled()&&h().enabled;n.text=i?"$(bug) Spider":"$(bug) Spider (off)",n.tooltip="Cyberpunk Spider \u2014 cliquer pour activer/d\xE9sactiver",n.show()};async function s(i){await a.window.showInformationMessage(i,"Recharger la fen\xEAtre")&&await a.commands.executeCommand("workbench.action.reloadWindow")}async function p(){try{let{checksumUpdated:i}=e.install(h());await t.globalState.update(C,!0),o(),await s(`Araign\xE9e install\xE9e${i?"":" (checksum non mis \xE0 jour : un avertissement \xAB installation corrompue \xBB peut appara\xEEtre.)"} Rechargez la fen\xEAtre pour la voir.`)}catch(i){N(i,"installer")}}async function l(){try{e.uninstall(),await t.globalState.update(C,!1),o(),await s("Patch retir\xE9. Rechargez la fen\xEAtre pour restaurer VS Code.")}catch(i){N(i,"d\xE9sinstaller")}}t.subscriptions.push(a.commands.registerCommand("cyberpunkSpider.enable",p),a.commands.registerCommand("cyberpunkSpider.disable",l),a.commands.registerCommand("cyberpunkSpider.toggle",async()=>{if(!e.isInstalled()){await a.window.showInformationMessage("L'araign\xE9e n'est pas encore install\xE9e dans VS Code.","Installer")&&await p();return}let i=a.workspace.getConfiguration(g);await i.update("enabled",!i.get("enabled",!0),a.ConfigurationTarget.Global)}),a.commands.registerCommand("cyberpunkSpider.openSettings",()=>M(t,{isInstalled:()=>e.isInstalled(),install:p,uninstall:l,reload:()=>void a.commands.executeCommand("workbench.action.reloadWindow")})),a.workspace.onDidChangeConfiguration(i=>{if(i.affectsConfiguration(g)){try{e.isInstalled()&&e.writeConfig(h())}catch(u){N(u,"\xE9crire la configuration")}o()}}));try{e.isInstalled()?e.isUpToDate()||e.install(h()):t.globalState.get(C)&&a.window.showWarningMessage("VS Code a probablement \xE9t\xE9 mis \xE0 jour : le patch de Cyberpunk Spider a disparu.","R\xE9appliquer","Ne plus me le demander").then(async i=>{i==="R\xE9appliquer"?await p():i&&await t.globalState.update(C,!1)})}catch{}o()}function le(){}function N(t,e){let n=t;if(n.code==="EACCES"||n.code==="EPERM"){let o=process.platform==="win32"?"Relancez VS Code en administrateur (ou utilisez l'installation \xAB utilisateur \xBB).":process.platform==="darwin"?'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/Contents/Resources/app/out".':'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/resources/app/out".';a.window.showErrorMessage(`Impossible de ${e} : droits insuffisants sur VS Code. ${o}`)}else a.window.showErrorMessage(`Impossible de ${e} : ${n.message}`)}0&&(module.exports={activate,deactivate});
