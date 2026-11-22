# TEAch Time · *My Cup of English*

![TEAch Time](assets/logo-teachtime.svg)

Plateforme d'anglais de tous les jours pour Windows : cours, jeu en pixel art, mémorisation de textes, vocabulaire et oral. Chaque jour, un quota de points est à atteindre. À l'heure choisie (18 h par défaut), si le quota n'est pas atteint, TEAch Time s'ouvre en plein écran et ne se ferme plus tant que les points ne sont pas faits.

## Ce qu'il y a dedans

| Écran | Contenu | Points |
|---|---|---|
| Le Quartier | Un petit quartier en pixel art. Six habitants : grammaire (Bibliothèque), conjugaison (Tour de l'horloge), vocabulaire (Marché), écoute (Radio), anglais général (Salon de thé), oral (Théâtre) | 10 par bonne réponse, +10 pour un 4/4 |
| Cours | 18 fiches en français avec exemples à écouter, puis un entraînement d'au moins 12 questions (15 par cours). Chaque erreur ajoute une question et la question ratée revient ; 5 erreurs d'affilée rouvrent la fiche ; le cours est validé après 3 bonnes réponses d'affilée | 10 par bonne réponse, +20 à la validation (une fois par jour) |
| Mémoriser | Tes textes à apprendre, découpés en blocs de 2 ou 3 phrases et appris bloc par bloc puis cumulés. Parcours guidé : écouter (texte surligné, « répéter après moi »), texte à trous à taper (20, 50, 80 %), premières lettres, remettre dans l'ordre, puis écrire et réciter le texte cumulé ; chaque étape est validée à 85 %. Une fois le texte su, révisions espacées (1, 3, 7, 14, 30 jours) en le récitant. Exercices libres en onglets | 10 par étape, +30 quand le texte est su, jusqu'à 40 par révision |
| Vocabulaire | Vingt listes toutes prêtes (`content/vocab-lists.json`) : quatorze de vie quotidienne (maison, cuisine, ville, émotions, technologie, expressions…) et six de travail et TOEIC, et tes listes « anglais ; français ». Séances de 10 mots : chaque mot passe par un QCM, l'écriture puis une dictée, et il est acquis après 3 bonnes réponses d'affilée (une erreur le renvoie au QCM). Révision du jour : les mots à revoir de toutes les listes en une séance | 5 par bonne réponse (30 gains max par liste et par jour) |
| Oral | Séances de 5 phrases : chaque phrase revient jusqu'à 3 réussites d'affilée (80 % ou plus), avec réécoute de sa voix et du modèle. Huit jeux de rôle (café, hôtel, entretien, médecin…) où la voix joue l'autre personne. Réponse libre à une question | 5 par phrase réussie ou réplique validée, +20 par conversation complète, 20 par réponse libre |

La voix anglaise est une voix neuronale, **Kokoro** (licence Apache 2.0), calculée sur le PC : huit voix, accent britannique ou américain, au choix dans les Réglages. Ta voix est analysée **sur le PC** par Whisper (modèle base.en). Rien n'est envoyé sur Internet, à part le téléchargement des deux modèles la première fois.

## Lancer TEAch Time

Dans le dossier du projet :

```
npm start
```

Ou double-clique sur le raccourci **TEAch Time** du Bureau s'il a été créé par `scripts\installer.ps1`.

Au premier lancement, un assistant demande :
- un **code d'urgence** (au moins 4 caractères), qui débloque le PC jusqu'à minuit ;
- l'**heure du verrou** et le **quota** de points par jour ;
- le **démarrage automatique**. TEAch Time s'ajoute alors au démarrage de Windows, et une tâche planifiée « TeachTime-relance » le relance toutes les 5 minutes s'il a été fermé.

Le verrou est livré **en pause** : il ne s'active que lorsque la case « Activer le verrou » est cochée dans les Réglages (avec le code). Le jour de l'installation reste un jour d'essai.

## Le verrou

- La fenêtre passe en plein écran, toujours au premier plan. Alt+F4, la croix et la réduction sont bloqués, et les autres écrans sont couverts.
- Dès que le quota est atteint, le PC redevient libre.
- Le bouton « Code d'urgence » du bandeau débloque le PC jusqu'à minuit.
- Ctrl+Alt+Suppr reste toujours possible : Windows ne permet pas de le bloquer.
- Pour changer l'heure, le quota ou le démarrage automatique : Réglages, avec le code.

Pour tout retirer : Réglages, décoche le démarrage automatique et enregistre avec le code. La tâche planifiée et l'entrée de démarrage sont supprimées.

## Plusieurs PC

La progression est rangée dans `Mon Drive\TeachTime\devices` : un fichier par PC, fusionnés à la lecture. Les points, les textes, les listes et le déblocage d'urgence sont donc partagés entre tes PC. Si Google Drive n'est pas encore monté, tout reste sur le PC et part dans le Drive dès qu'il revient.

### Installer sur le PC fixe

1. Copie le dossier TeachTime **sans** `node_modules` ni `models` (par exemple avec l'archive `TeachTime.zip`).
2. Installe Node.js si besoin : `winget install OpenJS.NodeJS.LTS`.
3. Dans le dossier : `powershell -ExecutionPolicy Bypass -File scripts\installer.ps1`.
4. Lance TEAch Time et choisis le même code d'urgence.

## Version web : iPhone et iPad

La même app tourne dans Safari, à l'adresse <https://mxriine-mz.github.io/teachtime/> (GitHub Pages, fichier `index.html` à la racine). Différences avec le PC :

- pas de verrou (Safari ne peut pas bloquer un iPhone), mais le quota, les points et la série restent ;
- la voix anglaise est celle d'iOS (choix dans Réglages) ;
- la reconnaissance vocale (Whisper, ~80 Mo téléchargés une fois) tourne dans Safari, sur la carte graphique quand c'est possible ;
- barre d'onglets en bas sur téléphone, croix tactile dans le Quartier ;
- dans Safari, **Partager › Sur l'écran d'accueil** l'installe comme une app, utilisable hors connexion.

### Compte en ligne (Supabase)

Une base Supabase gratuite garde la progression pour le PC, l'iPad et l'iPhone. Chaque compte ne voit que ses propres données.

1. Crée un compte sur <https://supabase.com>, puis un projet (nom `teachtime`, région Paris). Garde le mot de passe de la base pour toi.
2. **SQL Editor** : colle le contenu de `supabase/schema.sql`, puis **Run**.
3. **Authentication › Users › Add user** : crée ton utilisateur (e-mail, mot de passe), avec **Auto Confirm User**.
4. **Authentication › Sign In / Providers** : décoche **Allow new users to sign up**, pour que personne d'autre ne puisse créer de compte.
5. **Project Settings › API Keys** : récupère l'**URL du projet** et la **clé publique** (*publishable*, jamais la clé *secret*).
6. **PC** : copie `.env.example` en `.env` dans le dossier du projet et remplis-le. Le `.env` n'est jamais envoyé sur GitHub.
7. **Site web** : dans le dépôt GitHub, **Settings › Secrets and variables › Actions**, crée deux secrets `SUPABASE_URL` et `SUPABASE_KEY`. Dans **Settings › Pages**, choisis la source **GitHub Actions** : le site est publié par `.github/workflows/pages.yml`, qui écrit la configuration dans `renderer/web/config.js` au moment du déploiement.

Ensuite, la page de connexion ne demande plus que l'e-mail et le mot de passe, sur le PC comme sur l'iPhone et l'iPad.

Sécurité : la clé publique sert seulement à trouver la base. Ce sont les règles de `supabase/schema.sql` (chaque compte ne voit que ses lignes, rien pour un visiteur non connecté) et la fermeture des inscriptions qui protègent les données. Le mot de passe n'est jamais gardé par l'app : Supabase le stocke haché, l'app ne garde qu'un jeton de session.

## Dessiner son propre personnage

1. Ouvre `assets/sprites/modele-personnage.png` (48 × 128 pixels) dans un éditeur de pixel art, par exemple Piskel.
2. La planche a 3 colonnes (debout, pas 1, pas 2) et 4 lignes (face, profil gauche, profil droit, dos) : des cases de 16 × 32, pieds sur la ligne du bas. L'image `modele-personnage-explications.png` montre la planche agrandie avec le nom des cases.
3. Dessine par-dessus le guide pâle avec des couleurs opaques : le jeu ignore tout pixel à moins de 50 % d'opacité, donc le guide disparaît tout seul.
4. Le profil droit est facultatif : s'il est vide, le jeu retourne le profil gauche en miroir. Une case de marche vide reprend la pose debout.
5. Enregistre le résultat sous `assets/sprites/joueuse.png` et relance l'app.

## Pour le développement

| Commande | Rôle |
|---|---|
| `npm run dev` | Mode développement : pas de démarrage automatique, « Quitter » dans la zone de notification |
| `npm run model` | Télécharge le modèle Whisper dans `models/` |
| `npm run voice` | Télécharge la voix Kokoro (~310 Mo) dans `models/` et fait un essai |
| `npm run chaussette` | Regénère les SVG de Chaussette (trois poses, dans sa tasse ou seule), l'icône et le logo (tasse fumante) |
| `npm run icons` | Recrée les icônes PNG et ICO à partir de `assets/icon-teachtime.svg` |
| `npm run modele` | Recrée la planche modèle du personnage dans `assets/sprites/` |
| `npm run habitants` | Redessine les six habitants du Quartier dans `assets/sprites/habitants/` (même format que la planche, plus une colonne de clin d'oeil) |
| `node scripts/test-store.js` | Teste la synchronisation entre deux PC |
| `npx electron . --selftest=<dossier>` | Autotest hors écran : logique du verrou, captures de tous les écrans, jeu, Whisper |

Contenus modifiables dans `content/` : `questions.json`, `listening.json`, `speaking.json`, `roleplays.json`, `lessons.json`, `vocab-lists.json`.
