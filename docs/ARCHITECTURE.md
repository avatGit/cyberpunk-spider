# Architecture

## Vue d'ensemble

```
┌──────────────────────────── Extension Host (Node) ────────────────────────────┐
│ src/extension/                                                                │
│   extension.ts     commandes, status bar, logique de démarrage                │
│   config.ts        lit cyberpunkSpider.* → SpiderConfig                       │
│   patcher.ts       patch / unpatch de workbench.html (+ checksums product.json)│
│   settingsPanel.ts Webview de réglages                                        │
│   uninstall.ts     hook vscode:uninstall (Node pur, sans module 'vscode')     │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ écrit dans <appRoot>/out/vs/code/electron-sandbox/workbench/
                ▼
   workbench.html ── <script src="cyberpunk-spider.config.js">  (config de boot)
                  └─ <script src="cyberpunk-spider.js">         (runtime = dist/injected.js)
                     cyberpunk-spider.config.json               (config « live »)
                │
┌───────────────▼────────────── Renderer VS Code (navigateur) ──────────────────┐
│ src/injected/ (bundle IIFE)                                                   │
│   main.ts    <canvas> fixed, z-index max, pointer-events:none, boucle rAF     │
│   brain.ts   machine à états (IA)        spider.ts  corps + 8 pattes + rendu  │
│   ik.ts      IK à 2 segments             web.ts     toile (« stylo » continu) │
│   trail.ts   fils de soie éphémères     detect.ts  erreurs Monaco, frappe     │
│   color.ts   palette cyclique néon                                            │
└────────────────────────────────────────────────────────────────────────────────┘
        src/shared/types.ts : SpiderConfig, presets, validation (commun aux 2 mondes)
```

## Organisation du dépôt

| Dossier | Rôle |
| --- | --- |
| `src/extension`, `src/injected`, `src/shared` | Code TypeScript actuel (3 bundles esbuild → `dist/`) |
| `tests/` | Tests Vitest (IK, patcher sur fausse install, validation de config) |
| `dev/` | `preview.html` : voir l'araignée dans un navigateur, sans toucher à VS Code |
| `legacy/` | Première implémentation (runtime JS pur + tests maison), conservée pour référence |

## Décisions clés

| Sujet | Décision | Pourquoi |
| --- | --- | --- |
| Affichage plein écran | Patch de `workbench.html` | Aucune API VS Code ne permet de dessiner hors d'un webview/éditeur |
| Chargement du runtime | Balises `<script src>` **statiques** vers un fichier voisin | La CSP du workbench impose **Trusted Types** : pas d'`innerHTML`, pas de `script.src` dynamique, pas de `<script>` inline |
| Config live | `fetch('cyberpunk-spider.config.json')` toutes les 3 s ; config de boot via `config.js` | Seul canal Extension → renderer sans API. Après 4 échecs de `fetch`, on arrête de sonder (réglages pris au rechargement) |
| Détection d'erreurs | Lecture du DOM Monaco : `.monaco-editor .squiggly-error` | Le renderer n'a pas accès à `vscode.languages.getDiagnostics`. Bonus : position à l'écran directe |
| « Coin inutile » | Coin le plus éloigné du curseur de texte ; aléatoire sinon | Simple et pertinent |
| Inactivité | `keydown` / `paste` en capture sur `window` | Spec : activité = frappe. La souris est ignorée (et le canvas ne capte aucun clic) |
| Intégrité VS Code | Recalcul ciblé de `product.json > checksums` | Évite l'alerte « installation corrompue » ; recalculé aussi à la désinstallation |
| Désinstallation | Commande + hook `vscode:uninstall` | Restitue `workbench.html` à l'identique (testé) |
| Plusieurs `workbench.html` | `locateAll()` patche chaque variante présente (`.html`, `.esm.html`, `electron-browser`) | Le chemin varie selon les versions de VS Code |
| Extension côté UI | `extensionKind: ["ui"]` | En SSH/WSL/Dev Container, c'est l'installation **locale** qu'il faut patcher |

## IA de l'araignée (machine à états)

```
            erreur visible                 3,4 s
 wander ───────────────────► hunt ──► inspect ────┐
   ▲  ▲  (pause entre 2 déplacements)              │ cooldown 25 s par erreur
   │  └────────────────────────────────────────────┘
   │ frappe (keydown)
   │                      idle > N s
   └── rest ◄── weave ◄── toCorner ◄──── wander
        (la toile s'estompe dès la reprise de frappe)
```

Pendant la chasse et l'inspection, la couleur vire à l'alerte (rouge) et un réticule tourne autour de l'erreur.

## IK et marche

- 8 pattes, 2 segments (fémur 34 + tibia 44 px × `size`).
- IK analytique (loi des cosinus). Le coude est choisi à chaque image du côté **le plus éloigné du corps** : les genoux ne se croisent pas.
- Chaque pied est planté dans le monde ; il fait un pas quand il s'écarte de 22 px × `size` de sa position de repos, avec une avance dans le sens de la marche.
- Démarche tétrapode : deux groupes de 4 pattes en alternance ; un pied trop tendu force un pas.
- Limite v1 : l'IK est 2D (vue du dessus) ; « selon les surfaces » (pieds accrochés aux bords de l'UI) est une piste v2.

## Toile

La toile est dessinée par un « stylo » qui parcourt un chemin continu : cadre (rayons + bordure) puis spirale en zigzag, de l'extérieur vers le centre. L'araignée suit le stylo, qui n'avance que si elle est assez proche : le fil apparaît donc derrière elle, jamais en avance.

## Fichiers générés dans l'installation VS Code

`cyberpunk-spider.js`, `cyberpunk-spider.config.js`, `cyberpunk-spider.config.json`, `workbench.html.cyberpunk-spider.bak` (copie de sécurité, à côté de chaque `workbench.html` patché).

## Points à valider sur un vrai VS Code (non testables hors de VS Code)

- Que la CSP du workbench accepte les deux `<script src>` relatifs (même approche que les extensions de personnalisation existantes).
- Que `fetch` d'un JSON voisin soit autorisé (sinon repli : réglages au rechargement).
- Le sélecteur `.squiggly-error` et le chemin de `workbench.html` sur la dernière version stable **et** Insiders.

## Pistes v2

- Mode « tapette à mouches » et mode « meute » (reportés).
- Pieds accrochés aux bords réels de l'UI en lisant les rectangles DOM (onglets, barre d'état).
- Pont de diagnostics : l'extension écrit un JSON d'erreurs (`vscode.languages.getDiagnostics`) que le runtime sonde, pour réagir aussi aux erreurs hors écran.
- Localisation FR/EN (`package.nls.fr.json`).
