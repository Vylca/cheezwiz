# Formation des classes

Composer les classes de la rentrée au collège (6e, 5e, 4e, 3e) : import des listes CSV, tags, options,
genre, incompatibilités, règles d'équilibre, contraintes par classe, remplissage automatique et
ajustement par glisser-déposer.

## Installer ou mettre à jour (Linux et macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/Vylca/cheezwiz/main/install.sh | bash
```

Copier cette commande dans le Terminal. La même commande sert pour les mises à jour. Sous Linux, après la première installation, `formation-classes-update` suffit.

Sous Linux, l'application s'installe dans `~/.local/share/formation-classes` et apparaît dans le menu des applications. Sous macOS (12 ou plus récent), elle s'installe dans le dossier Applications (puce Apple ou Intel, détectée automatiquement). Rien d'autre n'est nécessaire.

Pour désinstaller :

```bash
curl -fsSL https://raw.githubusercontent.com/Vylca/cheezwiz/main/install.sh | bash -s -- --desinstaller
```

## Où sont mes données ?

Tout reste sur l'ordinateur, dans `~/.config/Formation des classes/projet.json` (Linux) ou `~/Library/Application Support/Formation des classes/projet.json` (macOS). Le projet est enregistré automatiquement et des copies de sécurité horodatées sont gardées dans le sous-dossier `sauvegardes` (menu Fichier > Afficher le dossier des sauvegardes). Les mises à jour n'y touchent pas.

## Fichiers CSV acceptés

Exports Pronote, SIECLE, Excel ou LibreOffice : séparateur `;` `,` ou tabulation, encodage UTF-8 ou Windows-1252. Chaque colonne est reconnue automatiquement (modifiable) : Nom, Prénom, « NOM Prénom », Sexe (F/G, F/M, 1/2), classe d'origine, LV2 ou options, tags, colonne « ULIS » cochée, ou n'importe quelle propriété. Le niveau à la rentrée est deviné d'après la classe d'origine (CM2 → 6e, 6e → 5e…).

## Développement

```bash
npm install
npm start          # lancer l'application (ajouter -- --no-sandbox sous Linux si besoin)
npm test           # tests de la logique (contraintes, remplissage automatique, import CSV)
npm run selftest   # scénario complet dans la vraie fenêtre, résultats dans selftest-out/
npm run dist       # construire le paquet Linux dans release/
npm run dist:mac   # construire les paquets macOS (sur un Mac)
```

Pour publier une nouvelle version, changer `version` dans `package.json` et pousser sur `main` : GitHub construit les paquets Linux et macOS, lance l'autotest sur chacun et les met en ligne.

La configuration Windows (`win` dans `package.json`) est prête pour une future version.
