"use strict";var oe=Object.create;var N=Object.defineProperty;var se=Object.getOwnPropertyDescriptor;var re=Object.getOwnPropertyNames;var ie=Object.getPrototypeOf,ae=Object.prototype.hasOwnProperty;var ce=(e,t)=>{for(var n in t)N(e,n,{get:t[n],enumerable:!0})},_=(e,t,n,o)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of re(t))!ae.call(e,s)&&s!==n&&N(e,s,{get:()=>t[s],enumerable:!(o=se(t,s))||o.enumerable});return e};var b=(e,t,n)=>(n=e!=null?oe(ie(e)):{},_(t||!e||!e.__esModule?N(n,"default",{value:e,enumerable:!0}):n,e)),de=e=>_(N({},"__esModule",{value:!0}),e);var ye={};ce(ye,{activate:()=>be,deactivate:()=>he});module.exports=de(ye);var c=b(require("vscode")),Z=b(require("path"));var a=b(require("fs")),l=b(require("path")),H=b(require("crypto")),S="<!-- CYBERPUNK-SPIDER-START (managed block, do not edit) -->",U="<!-- CYBERPUNK-SPIDER-END -->",P="cyberpunk-spider.js",D="cyberpunk-spider.config.js",L="cyberpunk-spider.config.json",R=".cyberpunk-spider.bak",le=["out/vs/code/electron-sandbox/workbench/workbench.html","out/vs/code/electron-sandbox/workbench/workbench.esm.html","out/vs/code/electron-browser/workbench/workbench.html"],f=class extends Error{constructor(n,o,s){super(o);this.code=n;this.file=s;this.name="PatchError"}};function v(e,t){try{return t()}catch(n){throw n instanceof f?n:n&&(n.code==="EACCES"||n.code==="EPERM"||n.code==="EROFS")?new f("PERMISSION",`No write access to ${e} (${n.code})`,e):new f("IO",String(n?.message??n),e)}}function pe(e){return H.createHash("sha256").update(e).digest("base64").replace(/=+$/,"")}function O(e){return e.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function h(e,t){v(e,()=>{if(a.existsSync(e)){let n=a.readFileSync(e),o=typeof t=="string"?Buffer.from(t,"utf8"):t;if(n.equals(o))return}a.writeFileSync(e,t)})}function B(e){v(e,()=>{a.existsSync(e)&&a.rmSync(e,{force:!0})})}function M(e){let t=[];for(let n of le){let o=l.join(e,n);a.existsSync(o)&&t.push({file:o,dir:l.dirname(o),checksumKey:n.replace(/^out\//,"")})}return t}function K(e){return e.replace(new RegExp(`${O(S)}[\\s\\S]*?${O(U)}\\n?`,"g"),"")}function ue(e){let t=K(e),n=`${S}
<script src="${D}"></script>
<script src="${P}"></script>
${U}
`,o=t.toLowerCase().lastIndexOf("</html>");return o===-1?t+`
`+n:t.slice(0,o)+n+t.slice(o)}function W(e){try{return a.readFileSync(e,"utf8").includes(S)}catch{return!1}}function V(e,t){let n=M(e),o=n.length>0&&n.every(r=>W(r.file)),s=!1;if(o)try{let r=a.readFileSync(t);s=n.every(d=>{try{return a.readFileSync(l.join(d.dir,P)).equals(r)}catch{return!1}})}catch{s=!1}return{found:n.length,patched:o,upToDate:s}}function Y(e,t){let n=l.join(e,"product.json");if(!a.existsSync(n))return 0;let o=a.readFileSync(n,"utf8"),s;try{s=JSON.parse(o)}catch{return 0}if(!s||typeof s.checksums!="object"||s.checksums===null)return 0;let r=0;for(let d of t){let p=s.checksums[d.checksumKey];if(p===void 0||!a.existsSync(d.file))continue;let m=pe(a.readFileSync(d.file));if(p===m)continue;let y=new RegExp(`("${O(d.checksumKey)}"\\s*:\\s*")${O(p)}(")`);y.test(o)?o=o.replace(y,`$1${m}$2`):(s.checksums[d.checksumKey]=m,o=JSON.stringify(s,null,"	")),r++}if(r){let d=n+R;a.existsSync(d)||v(d,()=>a.copyFileSync(n,d)),h(n,o)}return r}function G(e,t){let n=JSON.stringify(t);for(let o of M(e))W(o.file)&&(h(l.join(o.dir,L),n),h(l.join(o.dir,D),`window.__CYBER_SPIDER_BOOT__=${n};
`))}function j(e,t,n){let o=M(e);if(o.length===0)throw new f("NOT_FOUND",`workbench.html not found under ${e}`);let s=a.readFileSync(t);for(let r of o){let d=v(r.file,()=>a.readFileSync(r.file,"utf8")),p=r.file+R;!d.includes(S)&&!a.existsSync(p)&&v(p,()=>a.copyFileSync(r.file,p)),h(l.join(r.dir,P),s);let m=JSON.stringify(n);h(l.join(r.dir,L),m),h(l.join(r.dir,D),`window.__CYBER_SPIDER_BOOT__=${m};
`),h(r.file,ue(d))}Y(e,o)}function J(e){let t=M(e),n=0;for(let o of t){let s=v(o.file,()=>a.readFileSync(o.file,"utf8"));s.includes(S)&&(h(o.file,K(s)),n++);for(let r of[P,D,L,l.basename(o.file)+R])B(l.join(o.dir,r))}return Y(e,t),B(l.join(e,"product.json"+R)),n}var q=b(require("vscode")),w="cyberpunkSpider",C={toxic:{label:"Toxic green",color:"#39ff14"},violet:{label:"Ultraviolet",color:"#b026ff"},cyan:{label:"Cyan",color:"#00f0ff"},magenta:{label:"Hot magenta",color:"#ff2bd6"},amber:{label:"Amber",color:"#ffb300"},crimson:{label:"Crimson",color:"#ff2a4d"}},z=new Set(["enabled","speed","idleDelaySeconds","scale","glowIntensity","palettes","customColors","colorCycleSeconds","silkTrails","bugHunter"]),fe=/^#[0-9a-fA-F]{6}$/;function x(e,t,n,o,s){let r=Number(e.get(t,n));return Number.isFinite(r)?Math.min(s,Math.max(o,r)):n}function g(){let e=q.workspace.getConfiguration(w),t=(e.get("palettes",[])??[]).filter(o=>o in C),n=(e.get("customColors",[])??[]).filter(o=>fe.test(o));return{enabled:e.get("enabled",!0),speed:x(e,"speed",120,20,400),idleDelaySeconds:x(e,"idleDelaySeconds",30,5,600),scale:x(e,"scale",1,.5,2),glowIntensity:x(e,"glowIntensity",1,0,1.5),palettes:t,customColors:n,colorCycleSeconds:x(e,"colorCycleSeconds",6,2,60),silkTrails:e.get("silkTrails",!0),bugHunter:e.get("bugHunter",!0)}}function ge(e){let t=[...e.palettes.map(n=>C[n].color),...e.customColors];return t.length?t:[C.cyan.color]}function E(e){return{enabled:e.enabled,speed:e.speed,idleDelaySeconds:e.idleDelaySeconds,scale:e.scale,glowIntensity:e.glowIntensity,colors:ge(e),colorCycleSeconds:e.colorCycleSeconds,silkTrails:e.silkTrails,bugHunter:e.bugHunter}}var u=b(require("vscode")),X=b(require("crypto"));var me=new Set(["cyberpunkSpider.install","cyberpunkSpider.uninstall","workbench.action.reloadWindow"]),T=class e{constructor(t,n,o){this.panel=t;this.hooks=n;t.webview.html=this.html(t.webview),t.onDidDispose(()=>e.current=void 0,null,o.subscriptions),t.webview.onDidReceiveMessage(async s=>{switch(s.type){case"ready":this.push();break;case"set":s.key&&z.has(s.key)&&await u.workspace.getConfiguration(w).update(s.key,s.value,u.ConfigurationTarget.Global);break;case"command":s.id&&me.has(s.id)&&u.commands.executeCommand(s.id);break}},null,o.subscriptions)}static current;static show(t,n){if(e.current){e.current.panel.reveal(),e.current.push();return}let o=u.window.createWebviewPanel("cyberpunkSpiderSettings","Cyberpunk Spider",u.ViewColumn.Active,{enableScripts:!0,retainContextWhenHidden:!0});e.current=new e(o,n,t)}push(){this.panel.webview.postMessage({type:"state",config:g(),palettes:C,patched:this.hooks.getPatched()})}html(t){let n=X.randomBytes(16).toString("base64");return`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${`default-src 'none'; style-src ${t.cspSource} 'unsafe-inline'; script-src 'nonce-${n}';`}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyberpunk Spider</title>
<style>
  :root { --neon: #00f0ff; --neon2: #b026ff; }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 24px 32px; max-width: 720px; }
  h1 { font-weight: 600; letter-spacing: .04em; text-shadow: 0 0 12px var(--neon); margin: 0 0 4px; }
  .sub { opacity: .7; margin-bottom: 24px; }
  .card { border: 1px solid color-mix(in srgb, var(--neon) 35%, transparent); border-radius: 8px; padding: 16px 20px; margin-bottom: 16px;
          box-shadow: 0 0 18px color-mix(in srgb, var(--neon) 12%, transparent) inset; }
  .row { display: grid; grid-template-columns: 190px 1fr 64px; align-items: center; gap: 12px; margin: 10px 0; }
  .row.toggle { grid-template-columns: 1fr auto; }
  .row input[type=range] { width: 100%; accent-color: var(--neon); }
  .val { text-align: right; opacity: .8; font-variant-numeric: tabular-nums; }
  .palettes { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 12px; }
  .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; cursor: pointer; user-select: none;
          border: 1px solid var(--vscode-widget-border, #444); opacity: .55; }
  .chip.on { opacity: 1; }
  .sw { width: 12px; height: 12px; border-radius: 50%; }
  input[type=text] { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground);
                     border: 1px solid var(--vscode-input-border, #555); padding: 6px 8px; border-radius: 4px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 7px 14px; border-radius: 4px; cursor: pointer; margin-right: 8px; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; }
  .ok { background: #0b3d2e; color: #39ff14; } .no { background: #4a1020; color: #ff2a4d; }
  .hint { opacity: .65; font-size: 12px; margin-top: 4px; }
</style>
</head>
<body>
  <h1>Cyberpunk Spider</h1>
  <div class="sub">Status: <span id="status" class="badge"></span></div>

  <div class="card">
    <div class="row toggle"><label for="enabled">Spider enabled</label><input type="checkbox" id="enabled"></div>
    <div id="sliders"></div>
    <div class="row toggle"><label for="silkTrails">Silk trails</label><input type="checkbox" id="silkTrails"></div>
    <div class="row toggle"><label for="bugHunter">Bug hunter mode</label><input type="checkbox" id="bugHunter"></div>
  </div>

  <div class="card">
    <div>Neon palettes</div>
    <div class="palettes" id="palettes"></div>
    <label for="custom">Custom colors (#RRGGBB, comma separated)</label>
    <input type="text" id="custom" placeholder="#ff7a00, #00ff9c">
    <div class="hint">Changes apply live. If the spider does not react within a few seconds, reload the window.</div>
  </div>

  <div class="card">
    <button id="install">Install / Update</button>
    <button id="uninstall" class="secondary">Uninstall</button>
    <button id="reload" class="secondary">Reload Window</button>
  </div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const SLIDERS = [
    { key: 'speed', label: 'Speed (px/s)', min: 20, max: 400, step: 5 },
    { key: 'idleDelaySeconds', label: 'Idle before web (s)', min: 5, max: 300, step: 5 },
    { key: 'scale', label: 'Size', min: 0.5, max: 2, step: 0.1 },
    { key: 'glowIntensity', label: 'Glow', min: 0, max: 1.5, step: 0.1 },
    { key: 'colorCycleSeconds', label: 'Color change (s)', min: 2, max: 30, step: 1 }
  ];
  let state = null;
  const timers = {};

  function send(key, value) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () { vscode.postMessage({ type: 'set', key: key, value: value }); }, 150);
  }

  function buildSliders() {
    const host = $('sliders');
    SLIDERS.forEach(function (s) {
      const row = document.createElement('div'); row.className = 'row';
      const label = document.createElement('label'); label.textContent = s.label; label.htmlFor = s.key;
      const input = document.createElement('input'); input.type = 'range'; input.id = s.key;
      input.min = s.min; input.max = s.max; input.step = s.step;
      const val = document.createElement('span'); val.className = 'val'; val.id = s.key + '-v';
      input.addEventListener('input', function () { val.textContent = input.value; send(s.key, Number(input.value)); });
      row.append(label, input, val); host.append(row);
    });
  }

  function bindToggle(key) {
    $(key).addEventListener('change', function (e) { vscode.postMessage({ type: 'set', key: key, value: e.target.checked }); });
  }

  function render() {
    if (!state) { return; }
    const c = state.config;
    const st = $('status');
    st.textContent = state.patched ? 'installed' : 'not installed';
    st.className = 'badge ' + (state.patched ? 'ok' : 'no');
    ['enabled', 'silkTrails', 'bugHunter'].forEach(function (k) { $(k).checked = !!c[k]; });
    SLIDERS.forEach(function (s) {
      const el = $(s.key);
      if (document.activeElement !== el) { el.value = c[s.key]; }
      $(s.key + '-v').textContent = c[s.key];
    });
    const host = $('palettes'); host.textContent = '';
    Object.keys(state.palettes).forEach(function (k) {
      const p = state.palettes[k];
      const chip = document.createElement('span');
      chip.className = 'chip' + (c.palettes.indexOf(k) >= 0 ? ' on' : '');
      const sw = document.createElement('span'); sw.className = 'sw';
      sw.style.background = p.color; sw.style.boxShadow = '0 0 8px ' + p.color;
      chip.append(sw, document.createTextNode(p.label));
      chip.addEventListener('click', function () {
        const set = new Set(c.palettes);
        if (set.has(k)) { set.delete(k); } else { set.add(k); }
        vscode.postMessage({ type: 'set', key: 'palettes', value: Array.from(set) });
      });
      host.append(chip);
    });
    const custom = $('custom');
    if (document.activeElement !== custom) { custom.value = c.customColors.join(', '); }
  }

  buildSliders();
  ['enabled', 'silkTrails', 'bugHunter'].forEach(bindToggle);
  $('custom').addEventListener('change', function (e) {
    const list = e.target.value.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^#[0-9a-fA-F]{6}$/.test(s); });
    vscode.postMessage({ type: 'set', key: 'customColors', value: list });
  });
  $('install').addEventListener('click', function () { vscode.postMessage({ type: 'command', id: 'cyberpunkSpider.install' }); });
  $('uninstall').addEventListener('click', function () { vscode.postMessage({ type: 'command', id: 'cyberpunkSpider.uninstall' }); });
  $('reload').addEventListener('click', function () { vscode.postMessage({ type: 'command', id: 'workbench.action.reloadWindow' }); });
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'state') { state = e.data; render(); } });
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`}};var A="cyberpunkSpider.installed",Q="cyberpunkSpider.prompted";function be(e){let t=c.env.appRoot,n=e.asAbsolutePath(Z.join("media","spider-runtime.js")),o=c.window.createOutputChannel("Cyberpunk Spider");e.subscriptions.push(o);let s=i=>o.appendLine(`[${new Date().toISOString()}] ${i}`),r=c.window.createStatusBarItem(c.StatusBarAlignment.Right,0);e.subscriptions.push(r);let d=()=>V(t,n);function p(){let i=d(),k=g();i.patched?(r.text=k.enabled?"$(bug) Spider":"$(bug) Spider (off)",r.tooltip="Cyberpunk Spider: click to toggle. Use the command palette to open the settings panel.",r.command="cyberpunkSpider.toggle"):(r.text="$(bug) Spider: install",r.tooltip="Cyberpunk Spider is not installed. Click to install (patches VS Code).",r.command="cyberpunkSpider.install"),r.show(),T.current?.push()}function m(){switch(process.platform){case"win32":return'Windows: use a per-user VS Code install, or start VS Code "as administrator" once to install the spider.';case"darwin":return`macOS: your user needs write access to VS Code. Try: sudo chown -R $(whoami) "${t}"`;default:return`Linux: your user needs write access to VS Code. Try: sudo chown -R $(whoami) "${t}" (Flatpak/Snap installs are read-only and unsupported).`}}async function y(i){s(`ERROR ${String(i?.stack??i)}`),i instanceof f&&i.code==="PERMISSION"?await c.window.showErrorMessage(`Cyberpunk Spider: ${i.message}. ${m()}`,"Show log")&&o.show():i instanceof f&&i.code==="NOT_FOUND"?(c.window.showErrorMessage("Cyberpunk Spider: workbench.html was not found. This VS Code build may be unsupported (see the log)."),o.show()):c.window.showErrorMessage(`Cyberpunk Spider: ${i?.message??i}`)}async function $(i){await c.window.showInformationMessage(i,"Reload Window")&&c.commands.executeCommand("workbench.action.reloadWindow")}async function F(){try{j(t,n,E(g())),await e.globalState.update(A,!0),s(`patched ${t}`),p(),await $("Cyberpunk Spider installed. Reload the window to wake it up.")}catch(i){await y(i)}}async function ee(){try{J(t),await e.globalState.update(A,!1),s("unpatched"),p(),await $("Cyberpunk Spider removed. Reload the window to finish.")}catch(i){await y(i)}}async function te(){if(!d().patched){await F();return}let i=g().enabled;await c.workspace.getConfiguration(w).update("enabled",!i,c.ConfigurationTarget.Global)}e.subscriptions.push(c.commands.registerCommand("cyberpunkSpider.install",F),c.commands.registerCommand("cyberpunkSpider.uninstall",ee),c.commands.registerCommand("cyberpunkSpider.toggle",te),c.commands.registerCommand("cyberpunkSpider.openSettings",()=>T.show(e,{getPatched:()=>d().patched})),c.workspace.onDidChangeConfiguration(i=>{if(i.affectsConfiguration(w)){try{d().patched&&G(t,E(g()))}catch(k){s(`config sync failed: ${String(k)}`)}p()}}));let I=d(),ne=e.globalState.get(A,!1);if(I.patched&&!I.upToDate)try{j(t,n,E(g())),s("runtime refreshed"),$("Cyberpunk Spider was updated. Reload the window to apply it.")}catch(i){y(i)}else if(!I.patched&&ne)try{j(t,n,E(g())),s("re-applied after a VS Code update"),$("VS Code was updated and removed the spider. It has been re-applied: reload the window.")}catch(i){y(i)}else!I.patched&&!e.globalState.get(Q,!1)&&(e.globalState.update(Q,!0),c.window.showInformationMessage(`Cyberpunk Spider needs to modify VS Code's workbench.html so the spider can roam the whole window. You can undo it anytime with "Cyberpunk Spider: Uninstall". Install now?`,"Install","Not now").then(i=>{i==="Install"&&F()}));p()}function he(){}0&&(module.exports={activate,deactivate});
