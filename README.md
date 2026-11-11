# Caisse Resto

Application de prise de commande pour restaurant, pensée pour les serveurs, la cuisine et le bar.
Elle fonctionne sur **iPhone, Android** et **navigateur** (à installer sur l’écran d’accueil).

| Salle | Prise de commande | Cuisine & Bar | Gestion |
|---|---|---|---|
| ![Salle](docs/captures/salle.png) | ![Commande](docs/captures/prise-de-commande.png) | ![Cuisine](docs/captures/cuisine.png) | ![Gestion](docs/captures/gestion.png) |

| Lobby + QR code | Paiement | Mode démo | Tablette |
|---|---|---|---|
| ![Lobby](docs/captures/lobby.png) | ![Paiement](docs/captures/paiement.png) | ![Démo](docs/captures/mode-demo.png) | ![Tablette](docs/captures/tablette.png) |

| Encaissement + pourboire | Ticket de caisse | Historique & stats | Clôture de minuit |
|---|---|---|---|
| ![Encaissement](docs/captures/encaissement.png) | ![Ticket](docs/captures/ticket-de-caisse.png) | ![Historique](docs/captures/historique.png) | ![Clôture](docs/captures/cloture-minuit.png) |

| Équipe & postes | Poste Cuisine (lobby) |
|---|---|
| ![Postes](docs/captures/equipe-postes.png) | ![Poste cuisine](docs/captures/poste-cuisine.png) |

## Fonctionnalités

**Salle** : plan des tables par zones. La couleur indique l’état : libre, en cours, à envoyer ou prêt à servir. Chaque table affiche le montant, la durée et le serveur. Toucher une table ouvre sa commande.

**Prise de commande, en trois gestes** : table → plats → **Envoyer**.
- Barre de catégories en haut, emojis 3D sur chaque plat. Toucher un plat l’ajoute ; un bouton « − » apparaît sur la carte du plat.
- Les plats avec **choix** (cuisson, Normal/Zéro…) ouvrent un choix rapide, avec les **allergènes** affichés.
- En bas : le ticket (total, nombre d’articles) et le bouton **Envoyer**, qui ramène au plan de salle (réglable).
- Le ticket permet de modifier les quantités, les couverts et les notes (« saignant », « sans glaçons »…), de marquer les plats « Servis », d’imprimer l’**addition**, de **changer de table** et d’annuler.

**Encaissement** : une seule fenêtre, de haut en bas :
- **pourboire** : Aucun, 5 %, 10 %, 15 %, Arrondi à l’euro supérieur, ou montant libre ;
- **remise** en % et **partage de l’addition** (montant par personne) ;
- **mode de paiement** (carte, espèces, autre) ; en espèces, montants proposés et **monnaie à rendre** calculée ;
- bouton « Encaisser X € », puis **ticket de caisse** affiché à l’écran, prêt à imprimer (ou imprimé automatiquement si activé).

**Ticket de caisse** : nom, adresse, téléphone et **N° de TVA** du commerce, numéro du ticket, date et heure, table, serveur, articles, total TTC, HT et TVA, remise, pourboire, total payé, mode de paiement, espèces reçues et rendu, message de bas de ticket personnalisable.

**Impression** (Gestion › Imprimante & tickets) :
- **imprimante Bluetooth** de ticket (ESC/POS, 58 ou 80 mm) connectée directement depuis l’application ;
- sinon, impression par le téléphone (AirPrint sur iPhone, service d’impression sur Android) au même format ;
- impression du **ticket**, de l’**addition**, des **bons cuisine/bar**, du **rapport** d’historique et des **clôtures Z** ; impression automatique du ticket après encaissement et des nouveaux bons en cuisine (réglable par appareil) ;
- bouton « Impression test ».
- Sur tablette, le ticket reste affiché à droite de la carte.

**Commandes** : commandes en cours, avec trois filtres : toutes, les miennes, à servir.

**Cuisine / Bar** : un ticket par envoi, avec chronomètre. Le ticket passe en rouge en cas de retard. Toucher une ligne la fait avancer : envoyé → en préparation → prêt. Les tickets prêts récemment peuvent être rappelés. Chaque bon peut être imprimé.

**Gestion**, protégée par le **code gérant** :
- **identité & logo** : le gérant ajoute le logo de son commerce (affiché sur le plan de salle, la Gestion et l’écran d’accueil), le nom, le slogan, l’adresse, le téléphone, le **N° de TVA de l’entreprise** et le message du bas de ticket ;
- **carte complète** : articles avec emoji 3D, prix, description, **choix à la commande**, **14 allergènes**, disponibilité, duplication et ordre d’affichage ; catégories avec emoji, couleur et poste (cuisine ou bar) ;
- tables et zones, **équipe & postes**, lobby de l’équipe, imprimante ;
- préférences (devise, TVA, alerte cuisine, retour au plan de salle, **sécurité / verrouillage**) ;
- **historique & statistiques** : aujourd’hui, clôtures, tout ; chiffre d’affaires, tickets, couverts, ticket moyen, **pourboires**, remises, répartition par mode de paiement, meilleures ventes ; bouton **Imprimer** ;
- abonnement, code gérant, données ;
- **contact** : en cas de souci ou de besoin d’aide, WhatsApp ou téléphone au **+32 465 53 88 69**, disponible 24 h/24.

**Clôture automatique à minuit** : chaque nuit à minuit, la journée est clôturée (Z de caisse : chiffre d’affaires, TVA, pourboires, paiements, meilleures ventes) et le chiffre du jour repart à **0 €** ; la numérotation des tickets aussi. Si l’application était fermée à minuit, la clôture se fait à sa réouverture. Les clôtures restent consultables et imprimables dans l’historique.

**Code gérant** : ouverture automatique dès le dernier chiffre, blocage progressif après 5 erreurs, changement de code avec l’ancien code (codes trop simples refusés), « Code oublié ? » renvoie vers l’administrateur. Sécurité au choix : **Automatique** (le code est redemandé dès que l’on quitte la Gestion ou l’application), après 2 à 30 min d’inactivité, ou jamais.

**Équipe & postes** : chaque employé a un **poste** (Serveur, Bar ou Cuisine) et peut avoir un **code personnel** (4 à 6 chiffres). En tapant son code (bouton « Changer » ou Équipe › Me connecter avec mon code), il arrive directement sur son poste de travail.

**Équipe / lobby** : deux grands choix, **Créer** ou **Rejoindre**. Le gérant crée un lobby (en un geste une fois le serveur renseigné), avec un **QR code** que les employés scannent avec l’appareil photo pour rejoindre sans rien taper. Le gérant crée un lobby avec un **code d’accès à 6 caractères**. Serveurs et cuisiniers le rejoignent depuis leur téléphone. Commandes, plats prêts, carte et tables sont alors partagés en direct (environ 2 secondes), avec une file d’attente si le réseau coupe. Chaque appareil choisit son prénom et son poste, ou se connecte avec son code personnel. Dans le lobby, chacun ne voit que son poste :
- **Serveur** : Salle, Commandes (tables, prise de commande, encaissement) ;
- **Cuisine** : uniquement les commandes envoyées en cuisine ;
- **Bar** : uniquement les commandes envoyées au bar ;
- la Gestion reste protégée par le code gérant.

Une fois le lobby quitté, l’application redevient complète, comme à l’origine.

**Abonnement** :
- **Mode démo** : avec le code démo, 24 h d’utilisation gratuite. Un bandeau au-dessus des onglets, toujours visible, affiche « Essai gratuit · temps restant » à la seconde près et ce qui se passe à la fin ; à la fin, l’application se bloque et demande le paiement. Une seule démo par licence (l’administrateur peut la réinitialiser).
- **Mensuel : 45,99 €** par mois, dû le 1er. Le calendrier suit la date et l’heure réelles du téléphone (horloge affichée). Un rappel s’affiche pendant les **5 jours** qui précèdent (fenêtre une fois par jour et bandeau permanent). Si le paiement n’est pas enregistré, l’application est **bloquée automatiquement** le 1er à 00:00  ; la vérification est refaite toutes les 15 secondes et dès le retour dans l’application.
- **À vie : 599,99 €** en paiement unique.
- Le bouton « Payer » affiche le **montant à payer**, le **bénéficiaire**, l’**IBAN** et une **communication** (identifiant de licence et mois), avec un bouton « Copier » pour chacun, et la mention « virement instantané ». Un lien de paiement par carte peut s’y ajouter. Le client saisit ensuite le **code d’activation** que vous lui envoyez.
- Tous les appareils d’un lobby partagent la licence du restaurant.

**Administration**, avec le code administrateur. Saisi dans le champ « Code d’activation », ce code débloque une licence à vie et ouvre l’écran **Gestion › Administration**. On peut y :
- prolonger d’un mois, passer à vie ou révoquer la licence ;
- retirer au gérant l’accès à la Gestion ou la création de lobby, et réinitialiser son code ;
- modifier les **coordonnées bancaires** affichées au paiement, réinitialiser ou arrêter le mode démo ;
- générer les **codes d’activation** de vos clients (mensuel pour un mois donné, ou à vie) à partir de leur identifiant de licence ;
- renseigner les liens de paiement, et fermer le lobby.

## Mettre l’application en ligne (Netlify) et l’installer sur iPhone

```bash
npm install
npm run build:netlify     # crée caisse-resto-netlify.zip
```

1. Déposez le zip sur [app.netlify.com/drop](https://app.netlify.com/drop) (compte gratuit obligatoire : sans compte, le site est supprimé au bout d’une heure).
2. Ouvrez l’adresse Netlify dans **Safari**, puis **Partager › Sur l’écran d’accueil**.
3. Pour une mise à jour, déposez le nouveau zip dans **Deploys** du même site.

## Activer le lobby (serveur Supabase, environ 5 minutes, gratuit)

Pour que plusieurs téléphones partagent les commandes, il faut un serveur. L’application utilise Supabase.

1. Créez un compte et un projet sur [supabase.com](https://supabase.com) (offre gratuite).
2. **SQL Editor › New query** : collez le contenu de [`supabase/schema.sql`](supabase/schema.sql), puis **Run**.
3. Récupérez l’**adresse du projet** (`https://xxxx.supabase.co`) et la **clé publique** (*publishable* ou *anon*) dans les paramètres API du projet.
4. Dans l’application, en tant que gérant : **Équipe › Créer le lobby**, collez l’adresse et la clé, puis **Créer**.
5. **Inviter l’équipe** partage un lien qui contient le code et l’adresse du serveur. Les employés l’ouvrent dans Safari et choisissent leur prénom et leur poste.

À savoir :
- la clé publique est prévue pour être visible ; les tables ne sont accessibles qu’à travers les fonctions du schéma ;
- l’offre gratuite de Supabase met en pause un projet inactif pendant une semaine (il se relance depuis le tableau de bord) ;
- pour intégrer le serveur à l’application sans saisie, définissez `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_KEY` avant `npm run build:netlify`.

## Limites à connaître

- **Les contrôles d’abonnement et de codes sont faits par l’application, sur l’appareil.** Ils protègent contre un usage normal, pas contre une personne qui modifie le code ou les données du navigateur. Pour une protection forte, il faut un serveur de licences relié au paiement (par exemple un webhook Stripe), ce qui permettrait aussi l’activation automatique après paiement.
- Le paiement n’est pas encore automatisé : après réception d’un paiement, l’administrateur génère un code d’activation et l’envoie au client.
- Hors lobby, chaque appareil garde ses propres données. Un employé qui quitte le lobby retrouve l’application de son téléphone telle qu’elle était : sans abonnement propre, elle affiche l’écran d’abonnement.
- **Bluetooth direct** : il passe par Web Bluetooth, disponible dans **Chrome sur Android** (et sur ordinateur), mais **pas dans Safari sur iPhone** (limite d’Apple). Sur iPhone, l’impression passe par AirPrint, ou par une imprimante Bluetooth appairée via son application. Imprimantes compatibles : imprimantes de ticket **Bluetooth Low Energy ESC/POS** (58 ou 80 mm). Les imprimantes Bluetooth « classiques » uniquement (SPP) ne sont pas joignables depuis un navigateur.
- Les commandes déjà encaissées restent dans l’écran cuisine tant que les plats ne sont pas marqués « Prêt ».

## Autres façons de l’installer

- **Tester avec Expo Go** : `npx expo start`, puis scanner le QR code avec l’application Expo Go.
- **Applications natives (App Store / Play Store)** avec EAS Build : modifiez `ios.bundleIdentifier` et `android.package` dans `app.json`, puis :
  ```bash
  npx eas-cli@latest build --platform android --profile preview   # APK Android
  npx eas-cli@latest build --platform ios --profile production    # compte Apple Developer requis
  ```

## Adapté à tous les téléphones

Mise en page vérifiée sur iPhone SE (320 px), Galaxy S8 (360 px), iPhone 13 (390 px), Pixel 7 (412 px) et iPad en paysage : grilles qui s’adaptent à la largeur, libellés raccourcis sur petit écran, ticket affiché à côté de la carte sur tablette. Retour haptique (vibration légère) sur iPhone et Android, notifications éphémères, transitions animées.

## Crédits

Emojis 3D : [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) de Microsoft, licence MIT (`assets/emoji/LICENSE-fluentui-emoji.txt`).

## Développement

```bash
npm run verify      # TypeScript + lint + tests unitaires (à lancer après chaque modification)
npm test            # tests unitaires : commandes, cuisine, encaissement, synchronisation, abonnement, codes
npm run e2e         # tests de bout en bout dans un navigateur (voir tests/e2e/README.md)
```

Mémoire du projet pour le développement assisté par IA : [`CLAUDE.md`](CLAUDE.md) (règles de travail) et [`docs/claude.md`](docs/claude.md) (architecture, état des fonctionnalités, décisions, journal).

```
src/
  app/                    écrans (Expo Router)
    (tabs)/               Salle, Commandes, Cuisine / Bar, Gestion
    commande/[id].tsx     prise de commande et encaissement
    equipe.tsx            profil de l’appareil et lobby
    abonnement.tsx        formules, calendrier des paiements
    reglages/             écrans de la Gestion (dont admin.tsx)
  store/
    ops.ts                opérations rejouables (base de la synchronisation)
    actions.ts            création des opérations (identifiants, horodatages)
    StoreProvider.tsx     données, sauvegarde, boucle de synchronisation du lobby
  sync/backend.ts         appels au serveur Supabase, liens d’invitation
  license/                abonnement, rappels, codes d’activation, droits gérant / admin
  components/             interface (thème, pavé numérique, calendrier, verrous…)
  print/                  ticket, bons, rapports : ESC/POS (Bluetooth) et HTML
supabase/schema.sql       tables et fonctions du serveur de synchronisation
tests/e2e/                scénarios de bout en bout (Playwright) et serveurs de test
```
