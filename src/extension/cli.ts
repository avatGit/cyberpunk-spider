// Outil en ligne de commande (Node nu, sans module `vscode`), utilisé de trois façons :
//  1. hook "vscode:uninstall" : `node cli.js uninstall` (auto-détection de VS Code) ;
//  2. installation/désinstallation élevée, lancée par l'extension dans un terminal :
//       sudo env ELECTRON_RUN_AS_NODE=1 <code> cli.js install --app-root … --src … --config-b64 …
//  3. restauration manuelle : `sudo node cli.js uninstall --app-root /usr/share/code/resources/app`
import * as fs from 'fs';
import * as path from 'path';
import { Patcher, Owner } from './patcher';
import { sanitizeConfig } from '../shared/types';

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (name: string): string | undefined => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
};

function candidates(): string[] {
  const dir = path.dirname(process.execPath);
  return [
    arg('app-root') ?? '',
    process.env.CYBERPUNK_SPIDER_APP_ROOT ?? '',
    path.join(dir, 'resources', 'app'), // Windows / Linux
    path.join(dir, '..', 'Resources', 'app'), // macOS
    path.join(dir, '..', 'resources', 'app'),
  ].filter(Boolean);
}

function findAppRoot(): string | null {
  return candidates().find((r) => fs.existsSync(path.join(r, 'product.json'))) ?? null;
}

/** Sous sudo, on rend les fichiers à l'utilisateur d'origine. */
function sudoOwner(): Owner | undefined {
  const uid = Number(process.env.SUDO_UID);
  const gid = Number(process.env.SUDO_GID);
  return Number.isInteger(uid) && Number.isInteger(gid) && process.env.SUDO_UID ? { uid, gid } : undefined;
}

function main(): number {
  const root = findAppRoot();
  if (!root) {
    console.error('Cyberpunk Spider : dossier VS Code introuvable. Précisez --app-root <dossier contenant product.json>.');
    return 1;
  }
  try {
    if (cmd === 'install') {
      const src = arg('src');
      const b64 = arg('config-b64');
      if (!src || !b64) throw new Error('Arguments manquants : --src et --config-b64.');
      const cfg = sanitizeConfig(JSON.parse(Buffer.from(b64, 'base64').toString('utf8')));
      const { checksumUpdated } = new Patcher(root, src, sudoOwner()).install(cfg);
      console.log(`\nOK : araignée installée dans ${root}${checksumUpdated ? '' : ' (checksum non mis à jour)'}.`);
      console.log('Retournez dans VS Code et rechargez la fenêtre (Ctrl+Maj+P > Developer: Reload Window).');
      return 0;
    }
    if (cmd === 'uninstall') {
      new Patcher(root, '', sudoOwner()).uninstall();
      console.log(`\nOK : patch retiré de ${root}. Redémarrez VS Code.`);
      return 0;
    }
    console.error('Usage : cli.js install|uninstall [--app-root <dir>] [--src <injected.js>] [--config-b64 <base64>]');
    return 2;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.error(`\nÉCHEC : ${err.message}`);
    if (err.code === 'EACCES' || err.code === 'EPERM') console.error('Droits insuffisants : relancez avec sudo / en administrateur.');
    return 1;
  }
}

// Le hook vscode:uninstall ignore le code retour ; on ne casse jamais la désinstallation.
process.exitCode = main();
