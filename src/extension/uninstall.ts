// Exécuté par VS Code via "vscode:uninstall" (processus Node nu, sans API `vscode`).
// Restaure workbench.html et le checksum.
import * as fs from 'fs';
import * as path from 'path';
import { Patcher } from './patcher';

const dir = path.dirname(process.execPath);
const candidates = [
  path.join(dir, 'resources', 'app'), // Windows / Linux
  path.join(dir, '..', 'Resources', 'app'), // macOS
  path.join(dir, '..', 'resources', 'app'),
];

for (const root of candidates) {
  try {
    if (fs.existsSync(path.join(root, 'product.json'))) {
      new Patcher(root, '').uninstall();
      break;
    }
  } catch {
    /* best effort */
  }
}
