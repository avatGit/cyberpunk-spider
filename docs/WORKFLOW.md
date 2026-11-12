# Workflow de développement

## Mise en route

```bash
npm install
npm run build:dev      # esbuild → dist/
npm run typecheck
npm test               # Vitest : IK, patcher (fausse install VS Code), config
```

## Voir l'araignée sans toucher à VS Code

Ouvrir `dev/preview.html` dans un navigateur après `npm run build:dev`. Le bouton « Basculer une erreur » simule un `.squiggly-error` ; `idleSeconds` est à 10 s dans `dev/cyberpunk-spider.config.js`. Idéal pour régler l'animation, l'IK et la toile. `window.__cyberpunkSpiderDebug.mode()` donne l'état courant de l'IA.

## Lancer dans VS Code

1. Ouvrir le dossier dans VS Code, **F5** (« Lancer l'extension »).
2. Dans la fenêtre *Extension Development Host* : palette → `Cyberpunk Spider: Installer / réappliquer l'araignée`, puis `Developer: Reload Window`.

> ⚠️ Le patch touche **l'installation réelle** de VS Code (même `appRoot` pour l'hôte de dev). Pour tester sans risque, utilise **VS Code Insiders** ou une copie portable.

## Boucle de travail conseillée

| Étape | Commande | Note |
| --- | --- | --- |
| Modifier le moteur (`src/injected`) | `npm run watch` | Palette → *Installer / réappliquer* recopie `dist/injected.js`, puis *Reload Window* |
| Modifier l'extension | `npm run watch` | Recharger la fenêtre de dev |
| Vérifier | `npm test && npm run typecheck` | |
| Déboguer le runtime | `Developer: Toggle Developer Tools` | Console du renderer ; `window.__cyberpunkSpiderDebug` |

## Branches et versions

- `main` stable, branches `feat/*`. SemVer, `CHANGELOG.md` à jour avant chaque release.
- CI GitHub (`.github/workflows/ci.yml`) : typecheck, tests, `.vsix` en artefact. `release.yml` publie sur un tag `v*`.

## Checklist de test manuel (avant chaque release)

- [ ] Install → reload → l'araignée apparaît par-dessus éditeur, sidebar, menus.
- [ ] Les clics passent à travers (rien n'est bloqué).
- [ ] Créer une erreur de syntaxe visible → l'araignée s'y rend et la scanne.
- [ ] Ne plus taper N secondes → toile dans un coin ; retaper → la toile s'estompe.
- [ ] Panneau de réglages : vitesse, taille, néon, palettes, on/off agissent sans reload.
- [ ] Uninstall → reload → plus d'araignée, pas d'alerte « corrompu ».
- [ ] Mise à jour de VS Code → l'extension propose de réappliquer le patch.
- [ ] Windows, macOS, Linux (installation utilisateur et système).
- [ ] VS Code Stable **et** Insiders.
