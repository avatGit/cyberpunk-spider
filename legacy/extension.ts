import * as vscode from 'vscode';
import * as path from 'path';
import { install, remove, getStatus, writeConfig, PatchError } from './patcher';
import { readConfig, toRuntimePayload, SECTION } from './config';
import { SettingsPanel } from './settingsPanel';

const KEY_INSTALLED = 'cyberpunkSpider.installed';
const KEY_PROMPTED = 'cyberpunkSpider.prompted';

export function activate(context: vscode.ExtensionContext): void {
  const appRoot = vscode.env.appRoot;
  const runtimeSrc = context.asAbsolutePath(path.join('media', 'spider-runtime.js'));

  const out = vscode.window.createOutputChannel('Cyberpunk Spider');
  context.subscriptions.push(out);
  const log = (msg: string) => out.appendLine(`[${new Date().toISOString()}] ${msg}`);

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  context.subscriptions.push(bar);

  const status = () => getStatus(appRoot, runtimeSrc);

  function refreshUi(): void {
    const s = status();
    const cfg = readConfig();
    if (!s.patched) {
      bar.text = '$(bug) Spider: install';
      bar.tooltip = 'Cyberpunk Spider is not installed. Click to install (patches VS Code).';
      bar.command = 'cyberpunkSpider.install';
    } else {
      bar.text = cfg.enabled ? '$(bug) Spider' : '$(bug) Spider (off)';
      bar.tooltip = 'Cyberpunk Spider: click to toggle. Use the command palette to open the settings panel.';
      bar.command = 'cyberpunkSpider.toggle';
    }
    bar.show();
    SettingsPanel.current?.push();
  }

  function permissionHelp(): string {
    switch (process.platform) {
      case 'win32':
        return 'Windows: use a per-user VS Code install, or start VS Code "as administrator" once to install the spider.';
      case 'darwin':
        return `macOS: your user needs write access to VS Code. Try: sudo chown -R $(whoami) "${appRoot}"`;
      default:
        return `Linux: your user needs write access to VS Code. Try: sudo chown -R $(whoami) "${appRoot}" (Flatpak/Snap installs are read-only and unsupported).`;
    }
  }

  async function reportError(e: unknown): Promise<void> {
    log(`ERROR ${String((e as Error)?.stack ?? e)}`);
    if (e instanceof PatchError && e.code === 'PERMISSION') {
      const pick = await vscode.window.showErrorMessage(`Cyberpunk Spider: ${e.message}. ${permissionHelp()}`, 'Show log');
      if (pick) {
        out.show();
      }
    } else if (e instanceof PatchError && e.code === 'NOT_FOUND') {
      vscode.window.showErrorMessage(
        'Cyberpunk Spider: workbench.html was not found. This VS Code build may be unsupported (see the log).'
      );
      out.show();
    } else {
      vscode.window.showErrorMessage(`Cyberpunk Spider: ${(e as Error)?.message ?? e}`);
    }
  }

  async function askReload(message: string): Promise<void> {
    const pick = await vscode.window.showInformationMessage(message, 'Reload Window');
    if (pick) {
      void vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  async function doInstall(): Promise<void> {
    try {
      install(appRoot, runtimeSrc, toRuntimePayload(readConfig()));
      await context.globalState.update(KEY_INSTALLED, true);
      log(`patched ${appRoot}`);
      refreshUi();
      await askReload('Cyberpunk Spider installed. Reload the window to wake it up.');
    } catch (e) {
      await reportError(e);
    }
  }

  async function doUninstall(): Promise<void> {
    try {
      remove(appRoot);
      await context.globalState.update(KEY_INSTALLED, false);
      log('unpatched');
      refreshUi();
      await askReload('Cyberpunk Spider removed. Reload the window to finish.');
    } catch (e) {
      await reportError(e);
    }
  }

  async function doToggle(): Promise<void> {
    if (!status().patched) {
      await doInstall();
      return;
    }
    const enabled = readConfig().enabled;
    await vscode.workspace.getConfiguration(SECTION).update('enabled', !enabled, vscode.ConfigurationTarget.Global);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('cyberpunkSpider.install', doInstall),
    vscode.commands.registerCommand('cyberpunkSpider.uninstall', doUninstall),
    vscode.commands.registerCommand('cyberpunkSpider.toggle', doToggle),
    vscode.commands.registerCommand('cyberpunkSpider.openSettings', () =>
      SettingsPanel.show(context, { getPatched: () => status().patched })
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) {
        return;
      }
      try {
        if (status().patched) {
          writeConfig(appRoot, toRuntimePayload(readConfig()));
        }
      } catch (err) {
        log(`config sync failed: ${String(err)}`);
      }
      refreshUi();
    })
  );

  // ---- startup logic -------------------------------------------------------
  const s = status();
  const wasInstalled = context.globalState.get<boolean>(KEY_INSTALLED, false);

  if (s.patched && !s.upToDate) {
    // Extension updated: refresh the runtime copy.
    try {
      install(appRoot, runtimeSrc, toRuntimePayload(readConfig()));
      log('runtime refreshed');
      void askReload('Cyberpunk Spider was updated. Reload the window to apply it.');
    } catch (e) {
      void reportError(e);
    }
  } else if (!s.patched && wasInstalled) {
    // A VS Code update restored the original workbench.html: re-apply (the user opted in earlier).
    try {
      install(appRoot, runtimeSrc, toRuntimePayload(readConfig()));
      log('re-applied after a VS Code update');
      void askReload('VS Code was updated and removed the spider. It has been re-applied: reload the window.');
    } catch (e) {
      void reportError(e);
    }
  } else if (!s.patched && !context.globalState.get<boolean>(KEY_PROMPTED, false)) {
    void context.globalState.update(KEY_PROMPTED, true);
    void vscode.window
      .showInformationMessage(
        'Cyberpunk Spider needs to modify VS Code\'s workbench.html so the spider can roam the whole window. ' +
          'You can undo it anytime with "Cyberpunk Spider: Uninstall". Install now?',
        'Install',
        'Not now'
      )
      .then((pick) => {
        if (pick === 'Install') {
          void doInstall();
        }
      });
  }

  refreshUi();
}

export function deactivate(): void {
  // Nothing to do: the spider lives in the workbench, not in the extension host.
}
