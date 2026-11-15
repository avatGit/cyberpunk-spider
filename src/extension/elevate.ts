import { SpiderConfig } from '../shared/types';

/** Protège une valeur pour un shell POSIX (bash/zsh). */
export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export interface SudoCommandInput {
  kind: 'install' | 'uninstall';
  /** binaire de VS Code (exécuté en mode Node via ELECTRON_RUN_AS_NODE) */
  execPath: string;
  cliPath: string;
  appRoot: string;
  injectedPath: string;
  cfg: SpiderConfig;
}

/**
 * Commande à lancer dans un terminal : pas besoin que Node soit installé, on réutilise le binaire de VS Code.
 * `sudo env` fait passer ELECTRON_RUN_AS_NODE à travers sudo ; SUDO_UID/SUDO_GID permettent à cli.js
 * de rendre les fichiers à l'utilisateur, qui pourra ensuite tout gérer sans root.
 */
export function buildSudoCommand(i: SudoCommandInput): string {
  const parts = ['sudo', 'env', 'ELECTRON_RUN_AS_NODE=1', shQuote(i.execPath), shQuote(i.cliPath), i.kind, '--app-root', shQuote(i.appRoot)];
  if (i.kind === 'install') {
    parts.push('--src', shQuote(i.injectedPath), '--config-b64', Buffer.from(JSON.stringify(i.cfg)).toString('base64'));
  }
  return parts.join(' ');
}
