// Executed by VS Code via the `vscode:uninstall` script when the extension is fully removed.
// Best effort: restores workbench.html and product.json. No 'vscode' module here.
import * as fs from 'fs';
import * as path from 'path';
import { remove } from './patcher';

function findAppRoot(): string | undefined {
  let dir = path.dirname(process.execPath);
  for (let i = 0; i < 8; i++) {
    for (const rel of ['resources/app', 'Resources/app']) {
      const candidate = path.join(dir, rel);
      if (fs.existsSync(path.join(candidate, 'product.json'))) {
        return candidate;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

try {
  const root = findAppRoot();
  if (root) {
    remove(root);
  }
} catch {
  // Never block the uninstall. The user can remove leftovers by re-running
  // "Cyberpunk Spider: Uninstall" before uninstalling, or by reinstalling VS Code.
}
