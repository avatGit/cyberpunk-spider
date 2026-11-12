import * as vscode from 'vscode';
import * as path from 'path';
import { Patcher } from './patcher';
import { SECTION, readConfig } from './config';
import { openSettingsPanel } from './settingsPanel';

const KEY_INSTALLED_BEFORE = 'cyberpunkSpider.installedBefore';

export function activate(context: vscode.ExtensionContext): void {
  const patcher = new Patcher(vscode.env.appRoot, path.join(context.extensionPath, 'dist', 'injected.js'));

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  status.command = 'cyberpunkSpider.toggle';
  context.subscriptions.push(status);
  const refreshStatus = () => {
    const on = patcher.isInstalled() && readConfig().enabled;
    status.text = on ? '$(bug) Spider' : '$(bug) Spider (off)';
    status.tooltip = 'Cyberpunk Spider — cliquer pour activer/désactiver';
    status.show();
  };

  async function reloadPrompt(message: string): Promise<void> {
    const pick = await vscode.window.showInformationMessage(message, 'Recharger la fenêtre');
    if (pick) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  async function install(): Promise<void> {
    try {
      const { checksumUpdated } = patcher.install(readConfig());
      await context.globalState.update(KEY_INSTALLED_BEFORE, true);
      refreshStatus();
      const extra = checksumUpdated
        ? ''
        : ' (checksum non mis à jour : un avertissement « installation corrompue » peut apparaître.)';
      await reloadPrompt(`Araignée installée${extra} Rechargez la fenêtre pour la voir.`);
    } catch (e) {
      showFsError(e, 'installer');
    }
  }

  async function uninstall(): Promise<void> {
    try {
      patcher.uninstall();
      await context.globalState.update(KEY_INSTALLED_BEFORE, false);
      refreshStatus();
      await reloadPrompt('Patch retiré. Rechargez la fenêtre pour restaurer VS Code.');
    } catch (e) {
      showFsError(e, 'désinstaller');
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('cyberpunkSpider.enable', install),
    vscode.commands.registerCommand('cyberpunkSpider.disable', uninstall),
    vscode.commands.registerCommand('cyberpunkSpider.toggle', async () => {
      if (!patcher.isInstalled()) {
        const pick = await vscode.window.showInformationMessage(
          "L'araignée n'est pas encore installée dans VS Code.",
          'Installer',
        );
        if (pick) await install();
        return;
      }
      const cfg = vscode.workspace.getConfiguration(SECTION);
      await cfg.update('enabled', !cfg.get<boolean>('enabled', true), vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand('cyberpunkSpider.openSettings', () =>
      openSettingsPanel(context, {
        isInstalled: () => patcher.isInstalled(),
        install,
        uninstall,
        reload: () => void vscode.commands.executeCommand('workbench.action.reloadWindow'),
      }),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) return;
      try {
        if (patcher.isInstalled()) patcher.writeConfig(readConfig());
      } catch (err) {
        showFsError(err, 'écrire la configuration');
      }
      refreshStatus();
    }),
  );

  // Démarrage : rafraîchit les assets après une mise à jour de l'extension,
  // ou propose de réappliquer le patch après une mise à jour de VS Code.
  try {
    if (patcher.isInstalled()) {
      if (!patcher.isUpToDate()) patcher.install(readConfig());
    } else if (context.globalState.get<boolean>(KEY_INSTALLED_BEFORE)) {
      void vscode.window
        .showWarningMessage(
          'VS Code a probablement été mis à jour : le patch de Cyberpunk Spider a disparu.',
          'Réappliquer',
          'Ne plus me le demander',
        )
        .then(async (pick) => {
          if (pick === 'Réappliquer') await install();
          else if (pick) await context.globalState.update(KEY_INSTALLED_BEFORE, false);
        });
    }
  } catch {
    /* droits insuffisants au démarrage : on reste silencieux */
  }
  refreshStatus();
}

export function deactivate(): void {}

function showFsError(e: unknown, action: string): void {
  const err = e as NodeJS.ErrnoException;
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    const hint =
      process.platform === 'win32'
        ? 'Relancez VS Code en administrateur (ou utilisez l\'installation « utilisateur »).'
        : process.platform === 'darwin'
          ? 'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/Contents/Resources/app/out".'
          : 'Donnez-vous les droits : sudo chown -R "$(whoami)" "<dossier VS Code>/resources/app/out".';
    void vscode.window.showErrorMessage(`Impossible de ${action} : droits insuffisants sur VS Code. ${hint}`);
  } else {
    void vscode.window.showErrorMessage(`Impossible de ${action} : ${err.message}`);
  }
}
