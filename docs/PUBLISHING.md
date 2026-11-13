# Publication

## 1. Prérequis (une seule fois)

> ⚠️ Les Personal Access Tokens globaux d'Azure DevOps sont retirés le **1er décembre 2026**. Ce guide évite les tokens : première publication par upload manuel, mises à jour par Trusted Publishing.

1. Un compte Microsoft.
2. Un **publisher** : <https://marketplace.visualstudio.com/manage> → _Create publisher_ avec l'ID **`avatrix`** (permanent, visible dans l'URL) et un nom d'affichage unique.
3. `package.json` est déjà réglé : `publisher: avatrix`, dépôt `https://github.com/avatGit/cyberpunk-spider`.

## 2. Préparer la release

- [ ] `README.md` explicite (il est affiché sur la page du Marketplace). **Ajoute un GIF/capture de l'araignée** : c'est ce qui fait installer.
- [ ] `CHANGELOG.md` à jour, version bumpée (`npm version minor` ou à la main).
- [ ] Icône 128×128 minimum (fournie : `images/icon.png`).
- [ ] `npm test` et `npm run typecheck` verts.
- [ ] Checklist manuelle de `docs/WORKFLOW.md` faite sur au moins 2 OS.

## 3. Empaqueter et tester le .vsix

```bash
npm run package              # build minifié + vsce package → cyberpunk-spider-0.1.0.vsix
code --install-extension cyberpunk-spider-0.1.0.vsix
```

Vérifie le contenu : `npx vsce ls` (pas de `src/`, `node_modules/`, `test/`).

## 4. Publier

### Première publication (manuelle, sans token)

1. <https://marketplace.visualstudio.com/manage> → publisher `avatrix` → **New extension → Visual Studio Code**.
2. Envoie `cyberpunk-spider-0.1.0.vsix`. Validation automatique en quelques minutes.

### Mises à jour automatiques (Trusted Publishing, GitHub Actions)

1. Page du publisher → **Trusted Publishing → Create** : propriétaire `avatGit`, dépôt `cyberpunk-spider`, workflow `release.yml`.
2. `.github/workflows/release.yml` (fourni) a la permission `id-token: write` et lance `npx @vscode/vsce publish --no-dependencies --oidc`.
3. Pour sortir une version : incrémente la version (`npm version patch`), mets à jour `CHANGELOG.md`, puis `git push --follow-tags` (le tag `vX.Y.Z` déclenche la publication).

### Open VSX (VSCodium, Cursor, Gitpod…)

```bash
npx ovsx create-namespace avatrix -p <token-openvsx>   # une fois
npx ovsx publish cyberpunk-spider-0.1.0.vsix -p <token-openvsx>
```

Token sur <https://open-vsx.org> (compte Eclipse + accord de publication). Pour automatiser, ajoute le secret GitHub `OVSX_PAT` : `release.yml` publiera alors aussi sur Open VSX.

## 5. Points d'attention propres à cette extension

- **Transparence** : l'extension modifie des fichiers de VS Code. Dis-le clairement dans la description et le README (c'est déjà fait), garde le consentement explicite à l'installation et la commande _Uninstall_.
- **Règles de la place de marché** : vérifie les conditions de publication en vigueur au moment de publier. D'autres extensions populaires utilisent la même technique de patch, mais la politique du Marketplace peut évoluer ; garde Open VSX comme plan B.
- **Support** : prévois une section « Troubleshooting » (permissions, mise à jour de VS Code, alerte « corrompu ») et active les _Issues_ GitHub.
- **Compatibilité** : le chemin de `workbench.html` change parfois selon les versions de VS Code ; les 3 chemins connus sont gérés (`locateAll` dans `patcher.ts`). Teste sur VS Code Stable **et** Insiders avant chaque release.
- **Pas de télémétrie, pas de réseau** : à conserver, ça rassure.
- **Mises à jour** : incrémente la version à chaque publication ; les utilisateurs recevront le nouveau runtime et un message « reload ».
