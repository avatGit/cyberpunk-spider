import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { CONFIG_KEYS, PALETTES, SECTION, readConfig } from './config';

export interface PanelHooks {
  getPatched(): boolean;
}

const ALLOWED_COMMANDS = new Set([
  'cyberpunkSpider.install',
  'cyberpunkSpider.uninstall',
  'workbench.action.reloadWindow',
]);

export class SettingsPanel {
  static current: SettingsPanel | undefined;

  static show(context: vscode.ExtensionContext, hooks: PanelHooks): void {
    if (SettingsPanel.current) {
      SettingsPanel.current.panel.reveal();
      SettingsPanel.current.push();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'cyberpunkSpiderSettings',
      'Cyberpunk Spider',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    SettingsPanel.current = new SettingsPanel(panel, hooks, context);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly hooks: PanelHooks,
    context: vscode.ExtensionContext
  ) {
    panel.webview.html = this.html(panel.webview);
    panel.onDidDispose(() => (SettingsPanel.current = undefined), null, context.subscriptions);
    panel.webview.onDidReceiveMessage(
      async (m: { type: string; key?: string; value?: unknown; id?: string }) => {
        switch (m.type) {
          case 'ready':
            this.push();
            break;
          case 'set':
            if (m.key && CONFIG_KEYS.has(m.key)) {
              await vscode.workspace.getConfiguration(SECTION).update(m.key, m.value, vscode.ConfigurationTarget.Global);
            }
            break;
          case 'command':
            if (m.id && ALLOWED_COMMANDS.has(m.id)) {
              void vscode.commands.executeCommand(m.id);
            }
            break;
        }
      },
      null,
      context.subscriptions
    );
  }

  push(): void {
    void this.panel.webview.postMessage({
      type: 'state',
      config: readConfig(),
      palettes: PALETTES,
      patched: this.hooks.getPatched(),
    });
  }

  private html(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
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

<script nonce="${nonce}">
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
</html>`;
  }
}
