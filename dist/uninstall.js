"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/extension/uninstall.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/extension/patcher.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));

// src/shared/types.ts
var PRESETS = {
  "Spider-Verse": ["#39ff14", "#b026ff", "#00f0ff", "#ff2bd6"],
  "Neon Tokyo": ["#ff2bd6", "#00f0ff", "#fff200"],
  Matrix: ["#00ff41", "#00b82e", "#b8ffcb"],
  Synthwave: ["#ff6ec7", "#7a5cff", "#00e5ff"],
  Miles: ["#ff1e3c", "#00f0ff", "#ffffff"]
};
var DEFAULT_CONFIG = {
  enabled: true,
  speed: 1,
  size: 1,
  glow: 0.8,
  idleSeconds: 60,
  palette: PRESETS["Spider-Verse"],
  huntBugs: true,
  silkTrail: true
};
var ASSET_SCRIPT = "cyberpunk-spider.js";
var ASSET_CONFIG = "cyberpunk-spider.config.js";
var ASSET_CONFIG_JSON = "cyberpunk-spider.config.json";
var CONFIG_GLOBAL = "__CYBERPUNK_SPIDER_CONFIG__";

// src/extension/patcher.ts
var MARK_START = "<!-- CYBERPUNK-SPIDER-START -->";
var MARK_END = "<!-- CYBERPUNK-SPIDER-END -->";
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var BLOCK_RE = new RegExp(`${esc(MARK_START)}[\\s\\S]*?${esc(MARK_END)}\\n?`, "g");
function buildBlock() {
  return `${MARK_START}
<script src="${ASSET_CONFIG}"></script>
<script src="${ASSET_SCRIPT}"></script>
${MARK_END}
`;
}
function hasBlock(html) {
  return html.includes(MARK_START);
}
function removeBlock(html) {
  return html.replace(BLOCK_RE, "");
}
function injectBlock(html) {
  const clean = removeBlock(html);
  let i = clean.lastIndexOf("</body>");
  if (i < 0) i = clean.lastIndexOf("</html>");
  if (i < 0) throw new Error("workbench.html : balise </body> ou </html> introuvable.");
  return clean.slice(0, i) + buildBlock() + clean.slice(i);
}
function computeChecksum(content) {
  return crypto.createHash("sha256").update(content).digest("base64").replace(/=+$/, "");
}
function replaceChecksum(productRaw, key, newHash) {
  const re = new RegExp(`("${esc(key)}"\\s*:\\s*")[^"]*(")`);
  if (!re.test(productRaw)) return null;
  return productRaw.replace(re, `$1${newHash}$2`);
}
function configFileContent(cfg) {
  return `window.${CONFIG_GLOBAL}=${JSON.stringify(cfg)};
`;
}
var HTML_CANDIDATES = [
  "vs/code/electron-sandbox/workbench/workbench.html",
  "vs/code/electron-sandbox/workbench/workbench.esm.html",
  "vs/code/electron-browser/workbench/workbench.html"
];
function locateAll(appRoot) {
  const found = [];
  for (const rel of HTML_CANDIDATES) {
    const html = path.join(appRoot, "out", ...rel.split("/"));
    if (fs.existsSync(html)) {
      found.push({ html, dir: path.dirname(html), checksumKey: rel, product: path.join(appRoot, "product.json") });
    }
  }
  if (!found.length) {
    throw new Error(`workbench.html introuvable sous ${appRoot}. Version de VS Code non support\xE9e ?`);
  }
  return found;
}
var Patcher = class {
  /** `injectedSrc` : chemin du bundle dist/injected.js (vide pour une simple désinstallation). */
  constructor(appRoot, injectedSrc) {
    this.appRoot = appRoot;
    this.injectedSrc = injectedSrc;
  }
  targets() {
    return locateAll(this.appRoot);
  }
  isInstalled() {
    try {
      return this.targets().every(
        (p) => hasBlock(fs.readFileSync(p.html, "utf8")) && fs.existsSync(path.join(p.dir, ASSET_SCRIPT))
      );
    } catch {
      return false;
    }
  }
  /** Le script déposé correspond-il à celui de l'extension installée ? */
  isUpToDate() {
    try {
      const src = fs.readFileSync(this.injectedSrc);
      return this.targets().every((p) => fs.readFileSync(path.join(p.dir, ASSET_SCRIPT)).equals(src));
    } catch {
      return false;
    }
  }
  writeConfig(cfg) {
    for (const p of this.targets()) this.writeConfigIn(p, cfg);
  }
  writeConfigIn(p, cfg) {
    fs.writeFileSync(path.join(p.dir, ASSET_CONFIG), configFileContent(cfg), "utf8");
    fs.writeFileSync(path.join(p.dir, ASSET_CONFIG_JSON), JSON.stringify(cfg), "utf8");
  }
  install(cfg) {
    const targets = this.targets();
    for (const p of targets) fs.accessSync(p.html, fs.constants.W_OK);
    let allSynced = true;
    for (const p of targets) {
      const original = fs.readFileSync(p.html, "utf8");
      if (!hasBlock(original)) fs.copyFileSync(p.html, p.html + ".cyberpunk-spider.bak");
      fs.copyFileSync(this.injectedSrc, path.join(p.dir, ASSET_SCRIPT));
      this.writeConfigIn(p, cfg);
      fs.writeFileSync(p.html, injectBlock(original), "utf8");
      allSynced = this.syncChecksum(p) && allSynced;
    }
    return { checksumUpdated: allSynced };
  }
  uninstall() {
    for (const p of this.targets()) {
      const html = fs.readFileSync(p.html, "utf8");
      if (hasBlock(html)) fs.writeFileSync(p.html, removeBlock(html), "utf8");
      this.syncChecksum(p);
      for (const f of [ASSET_SCRIPT, ASSET_CONFIG, ASSET_CONFIG_JSON]) {
        try {
          fs.unlinkSync(path.join(p.dir, f));
        } catch {
        }
      }
    }
  }
  /** Recalcule le checksum de workbench.html dans product.json pour éviter l'alerte « installation corrompue ». */
  syncChecksum(p) {
    try {
      const raw = fs.readFileSync(p.product, "utf8");
      const next = replaceChecksum(raw, p.checksumKey, computeChecksum(fs.readFileSync(p.html)));
      if (next === null) return false;
      if (next !== raw) fs.writeFileSync(p.product, next, "utf8");
      return true;
    } catch {
      return false;
    }
  }
};

// src/extension/uninstall.ts
var dir = path2.dirname(process.execPath);
var candidates = [
  path2.join(dir, "resources", "app"),
  // Windows / Linux
  path2.join(dir, "..", "Resources", "app"),
  // macOS
  path2.join(dir, "..", "resources", "app")
];
for (const root of candidates) {
  try {
    if (fs2.existsSync(path2.join(root, "product.json"))) {
      new Patcher(root, "").uninstall();
      break;
    }
  } catch {
  }
}
//# sourceMappingURL=uninstall.js.map
