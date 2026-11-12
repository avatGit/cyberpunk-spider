# Changelog

## 0.1.0 — Première version
- Injection d'une couche canvas plein écran dans `workbench.html` (avec correction du checksum).
- Araignée procédurale : 8 pattes, cinématique inverse à 2 segments, démarche tétrapode.
- IA : déambulation, chasse aux erreurs visibles, toile en coin après inactivité.
- Rendu néon (palette cyclique, lueur, glitch chromatique), fils de soie éphémères.
- Panneau de réglages (Webview) et réglages `cyberpunkSpider.*` sans rechargement.
- Hook `vscode:uninstall` qui restaure `workbench.html`.
- Réécriture en TypeScript (moteur `src/injected`, extension `src/extension`) ; première implémentation conservée dans `legacy/`.
- Commandes renommées : `cyberpunkSpider.enable` / `.disable` (anciennement `.install` / `.uninstall`).
