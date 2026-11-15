import * as vscode from 'vscode';
import * as path from 'path';
import { Patcher } from './patcher';
import { SECTION, readConfig } from './config';
import { openSettingsPanel } from './settingsPanel';
import { buildSudoCommand } from './elevate';

const KEY_INSTALLED_BEFORE = 'cyberpunkSpider.installedBefore';
const KEY_WELCOMED = 'cyberpunkSpider.welcomed';
const GUIDE_URL = 'https://github.com/avatGit/cyberpunk-spider#installation-par-système';
const HEARTBEAT_MS = 2 * 60 * 1000;

type Kind = 'install' | 'uninstall';

export function activate(context: vscode.ExtensionContext): void {
  const distDir = path.join(context.extensionPath, 'dist');
  const injectedPath = path.join(distDir, 'injected.js');
  const patcher = new Patcher(vscode.env.appRoot, injectedPath);

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  status.command = 'cyberpunkSpider.toggle';
  context.subscriptions.push(status);
  const refreshStatus = () => {
    const installed = patcher.isInstalled();
    if (!installed) {
      status.text = '$(bug) Spider : à installer';
      status.tooltip = "L'araignée n'est pas encore installée dans VS Code — cliquer pour l'installer";
      status.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      status.text = readConfig().enabled ? '$(bug) Spider' : '$(bug) Spider (off)';
      status.tooltip = 'Cyberpunk Spider — cliquer pour activer/désactiver';
      status.backgroundColor = undefined;
    }
    status.show();
  };

  async function reloadPrompt(message: string): Promise<void> {
    const pick = await vscode.window.showInformationMessage(message, 'Recharger la fenêtre');
    if (pick) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  /** Droits insuffisants : propose l'élévation (sudo dans un terminal visible) ou le guide. */
  async function handleFsError(e: unknown, kind: Kind): Promise<void> {
    const err = e as NodeJS.ErrnoException;
    const verb = kind === 'install' ? "installer l'araignée" : 'retirer le patch';
    if (err.code !== 'EACCES' && err.code !== 'EPERM') {
      void vscode.window.showErrorMessage(`Impossible de ${verb} : ${err.message}`);
      return;
    }
    if (process.platform === 'win32') {
      const pick = await vscode.window.showErrorMessage(
        `Impossible de ${verb} : VS Code est installé dans un dossier protégé. Fermez VS Code, relancez-le en tant qu'administrateur, puis réessayez (ou utilisez l'installeur « User » de VS Code).`,
        'Ouvrir le guide',
      );
      if (pick) void vscode.env.openExternal(vscode.Uri.parse(GUIDE_URL));
      return;
    }
    const pick = await vscode.window.showWarningMessage(
      `Impossible de ${verb} : VS Code est installé dans un dossier protégé (${vscode.env.appRoot}). ` +
        'Il faut des droits administrateur une seule fois ; ensuite tout fonctionne sans.',
      'Ouvrir un terminal avec sudo',
      'Ouvrir le guide',
    );
    if (pick === 'Ouvrir le guide') void vscode.env.openExternal(vscode.Uri.parse(GUIDE_URL));
    if (pick === 'Ouvrir un terminal avec sudo') {
      const cmd = buildSudoCommand({
        kind,
        execPath: process.execPath,
        cliPath: path.join(distDir, 'cli.js'),
        appRoot: vscode.env.appRoot,
        injectedPath,
        cfg: readConfig(),
      });
      const term = vscode.window.createTerminal('Cyberpunk Spider (sudo)');
      term.show();
      term.sendText(cmd, true);
      void vscode.window.showInformationMessage(
        'Saisissez votre mot de passe dans le terminal. Quand « OK » s’affiche, rechargez la fenêtre.',
        'Recharger la fenêtre',
      ).then((p) => {
        if (p) void vscode.commands.executeCommand('workbench.action.reloadWindow');
      });
    }
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
      await handleFsError(e, 'install');
    }
  }

  async function uninstall(): Promise<void> {
    try {
      patcher.uninstall();
      await context.globalState.update(KEY_INSTALLED_BEFORE, false);
      refreshStatus();
      await reloadPrompt('Patch retiré. Rechargez la fenêtre pour restaurer VS Code.');
    } catch (e) {
      await handleFsError(e, 'uninstall');
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('cyberpunkSpider.enable', install),
    vscode.commands.registerCommand('cyberpunkSpider.disable', uninstall),
    vscode.commands.registerCommand('cyberpunkSpider.toggle', async () => {
      if (!patcher.isInstalled()) {
        await install();
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
      } catch {
        /* droits perdus (mise à jour de VS Code) : on le saura au prochain démarrage */
      }
      refreshStatus();
    }),
  );

  // Signe de vie : le runtime injecté s'arrête de lui-même si ce signal disparaît
  // (extension désinstallée ou désactivée alors que le patch est encore dans workbench.html).
  const beat = () => {
    try {
      if (patcher.isInstalled()) patcher.writeConfig(readConfig());
    } catch {
      /* silencieux */
    }
  };
  const timer = setInterval(beat, HEARTBEAT_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  // Démarrage
  try {
    if (patcher.isInstalled()) {
      if (!patcher.isUpToDate()) patcher.install(readConfig());
      else beat();
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
    } else if (!context.globalState.get<boolean>(KEY_WELCOMED)) {
      // Première utilisation : rien ne se passe sans action explicite, on l'explique.
      void context.globalState.update(KEY_WELCOMED, true);
      void vscode.window
        .showInformationMessage(
          "Cyberpunk Spider est installée. Pour afficher l'araignée, VS Code doit être modifié une fois (puis rechargé).",
          'Installer maintenant',
          'Lire le guide',
        )
        .then(async (pick) => {
          if (pick === 'Installer maintenant') await install();
          else if (pick === 'Lire le guide') void vscode.env.openExternal(vscode.Uri.parse(GUIDE_URL));
        });
    }
  } catch {
    /* droits insuffisants au démarrage : on reste silencieux, la commande Installer expliquera */
  }
  refreshStatus();
}

export function deactivate(): void {}
