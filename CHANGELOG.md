# Changelog

## 0.2.0 — Installation et désinstallation plus fiables
- Linux/macOS : en cas de droits insuffisants, bouton « Ouvrir un terminal avec sudo » (commande prête, sans Node requis). Les fichiers sont ensuite rendus à l'utilisateur : réglages, mises à jour et désinstallation sans root.
- Message d'accueil au premier lancement et bouton d'état « à installer » (l'araignée n'apparaissait pas tant qu'on n'avait pas lancé la commande).
- Auto-arrêt de l'araignée si l'extension est désinstallée ou désactivée alors que le patch est encore présent.
- La désinstallation supprime aussi le fichier `.bak` ; nouvel outil `cli.js` (hook `vscode:uninstall` et usage manuel).
- README : guide d'installation Windows / macOS / Linux, désinstallation propre, dépannage.

## 0.1.0 — Première version
- Injection d'une couche canvas plein écran dans `workbench.html` (avec correction du checksum).
- Araignée procédurale : 8 pattes, cinématique inverse à 2 segments, démarche tétrapode.
- IA : déambulation, chasse aux erreurs visibles, toile en coin après inactivité.
- Rendu néon (palette cyclique, lueur, glitch chromatique), fils de soie éphémères.
- Panneau de réglages (Webview) et réglages `cyberpunkSpider.*` sans rechargement.
- Hook `vscode:uninstall` qui restaure `workbench.html`.
- Réécriture en TypeScript (moteur `src/injected`, extension `src/extension`) ; première implémentation conservée dans `legacy/`.
- Commandes renommées : `cyberpunkSpider.enable` / `.disable` (anciennement `.install` / `.uninstall`).
