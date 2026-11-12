# Publication

## 1. Prérequis (une seule fois)

1. Un compte Microsoft, puis une organisation Azure DevOps : <https://dev.azure.com>.
2. Un **Personal Access Token** : *User settings → Personal access tokens → New Token*
   - Organization : **All accessible organizations**
   - Scopes : **Custom defined → Marketplace → Manage**
3. Un **publisher** : <https://marketplace.visualstudio.com/manage> → *Create publisher* (ID unique, minuscules).
4. Dans `package.json`, remplace :
   - `"publisher": "your-publisher-id"` par ton ID
   - `repository.url` par ton vrai dépôt Git

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

```bash
npx vsce login <ton-publisher>      # colle le PAT
npx vsce publish                    # ou: vsce publish minor
```

L'extension apparaît sur le Marketplace après une courte validation automatique (quelques minutes).

### Open VSX (VSCodium, Cursor, Gitpod…)

```bash
npx ovsx create-namespace <ton-publisher> -p <token-openvsx>   # une fois
npx ovsx publish cyberpunk-spider-0.1.0.vsix -p <token-openvsx>
```
Token sur <https://open-vsx.org> (compte Eclipse + accord de publication).

### Automatiser (GitHub Actions)

`.github/workflows/release.yml` est déjà fourni : ajoute les secrets `VSCE_PAT` et `OVSX_PAT`, puis `git tag v0.1.0 && git push --tags`.

## 5. Points d'attention propres à cette extension

- **Transparence** : l'extension modifie des fichiers de VS Code. Dis-le clairement dans la description et le README (c'est déjà fait), garde le consentement explicite à l'installation et la commande *Uninstall*.
- **Règles de la place de marché** : vérifie les conditions de publication en vigueur au moment de publier. D'autres extensions populaires utilisent la même technique de patch, mais la politique du Marketplace peut évoluer ; garde Open VSX comme plan B.
- **Support** : prévois une section « Troubleshooting » (permissions, mise à jour de VS Code, alerte « corrompu ») et active les *Issues* GitHub.
- **Compatibilité** : le chemin de `workbench.html` change parfois selon les versions de VS Code ; les 3 chemins connus sont gérés (`locateAll` dans `patcher.ts`). Teste sur VS Code Stable **et** Insiders avant chaque release.
- **Pas de télémétrie, pas de réseau** : à conserver, ça rassure.
- **Mises à jour** : incrémente la version à chaque publication ; les utilisateurs recevront le nouveau runtime et un message « reload ».
