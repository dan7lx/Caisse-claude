# Mémoire du projet — Caisse Resto

> Source de vérité pour toute session de développement assisté par IA.
> Chargée automatiquement par `CLAUDE.md`. À tenir à jour après chaque modification importante (voir CLAUDE.md § 4).
> Dernière mise à jour : 2026-11-11 (paiements et licences).

## 1. Le produit en bref

Application de caisse et de prise de commande pour restaurants : plan de salle, commandes, écrans cuisine et bar, encaissement (TVA au choix), ticket de caisse à l’écran, gestion complète, travail en équipe (lobby) et abonnement payant par virement avec validation manuelle par le créateur.
Cible principale : **iPhone via une PWA** (site Netlify ajouté à l’écran d’accueil), aussi Android et navigateur. Builds natifs possibles avec EAS, mais jamais publiés à ce jour.
Interface et contenus **en français**, euro par défaut, TVA belge (10 % par défaut, modifiable).

Propriétaire (« créateur ») : vend l’application sous abonnement (45,99 € pour 30 jours ou 599,99 € à vie). Le client paie par virement et envoie la preuve sur WhatsApp ; le créateur confirme dans l’**Espace créateur** puis génère une clé. Guide : `docs/paiements.md`. Support client par WhatsApp et téléphone (voir `src/config.ts › SUPPORT`).

## 2. Technologies

| Domaine | Choix | Version |
|---|---|---|
| Framework | Expo (React Native) | SDK 58 (`expo ~58.0.23`) |
| UI | React / React Native / react-native-web | 19.3 / 0.88.1 / 0.21 |
| Navigation | Expo Router (fichiers dans `src/app/`) | 58 |
| Langage | TypeScript strict | 6.0 |
| Stockage local | AsyncStorage (localStorage sur le web) | 2.2 |
| Synchronisation d’équipe, paiements, licences | Supabase (PostgreSQL + fonctions RPC, pgcrypto), appelé en `fetch` | — |
| Polices | Playfair Display (`@expo-google-fonts`) | — |
| Emojis 3D | Fluent Emoji (MIT), PNG dans `assets/emoji/` | — |
| Tests unitaires | `node:test` via `tsx --test` | — |
| Tests de bout en bout | Playwright + Chromium (fournis par l’environnement) | — |
| Lint | ESLint 9 + `eslint-config-expo` (flat config) | — |
| Hébergement | Netlify (glisser-déposer du zip) | — |

## 3. Architecture

```
src/
  app/                      Écrans (Expo Router) — chaque fichier est une route
    _layout.tsx             Racine : polices, StoreProvider, LicenseGate, Toast, Stack
    (tabs)/_layout.tsx      Onglets + bandeau d’état (essai/rappel) ; onglets filtrés selon le poste en lobby
    (tabs)/index.tsx        Salle (plan des tables)
    (tabs)/commandes.tsx    Commandes en cours
    (tabs)/cuisine.tsx      Écran Cuisine / Bar (tickets, impression des bons)
    (tabs)/gestion.tsx      Gestion (derrière ManagerGate = code gérant)
    commande/[id].tsx       Prise de commande, encaissement, ticket (le plus gros écran)
    equipe.tsx              Profil de l’appareil, lobby créer/rejoindre, QR code
    connexion.tsx           Connexion d’un employé par code personnel → son poste
    abonnement.tsx          Formules, calendrier (rappel orange, fin rouge), paiement
    createur.tsx            Espace créateur : connexion mot de passe, à traiter, clients, paiements, réglages
    reglages/*.tsx          Écrans de la Gestion (articles, catégories, tables, équipe, identité,
                            préférences, historique, admin local)
  store/
    types.ts                Tous les types de données (AppState, Order, Settings, License…)
    ops.ts                  Opérations rejouables `Op` + réducteur `reduce` (cœur de la logique)
    actions.ts              Créateurs d’opérations (ids, horodatages)
    selectors.ts            Calculs dérivés (totaux, TVA, stats, tickets cuisine, clôtures)
    defaults.ts             Données de démo, `normalize` (migration des anciennes données)
    StoreProvider.tsx       État, sauvegarde, boucle de synchro, session gérant, clôture de minuit, useNow
    store.test.ts           Tests unitaires (43)
  sync/backend.ts           Appels RPC Supabase, liens d’invitation
  license/license.ts        Statut d’abonnement, démo, rappel, codes démo/admin/créateur, reconnaissance des clés
  license/server.ts         Client du serveur de paiements et licences (RPC), règles locales (clé, sync, liens WhatsApp)
  license/dashboard.ts      Calculs de l’Espace créateur (à traiter, santé des licences, chiffres)
  license/useLicenseServer.ts  Hooks : prix/coordonnées, activation d’une clé, contrôle régulier de la licence
  license/access.ts         Droits gérant/admin, codes employés
  ticket/                   doc.ts (ticket de caisse, clôture Z), layout.ts (colonnes) : affichage à l’écran uniquement
  components/               UI partagée (ui.tsx = boutons, champs, pavé numérique…), écrans de verrouillage, feuilles ;
                            PaymentFlow.tsx (paiement client), CheckoutSheet.tsx (encaissement + TVA),
                            CreatorGate.tsx (code créateur), creator/ (fiches de l’Espace créateur)
  labels.ts                 Libellés sans React Native (utilisables dans les tests)
  theme.ts                  Couleurs, polices, styles d’état
  config.ts                 Prix, empreintes des codes, IBAN, support, serveur intégré
supabase/schema.sql         Tables + fonctions RPC du lobby, des paiements, clés et licences (idempotent)
docs/paiements.md           Guide du créateur : mise en service Supabase, travail quotidien, règles, sécurité
tests/e2e/                  Scénarios Playwright + serveurs de test (voir son README)
docs/captures/              Captures d’écran du README
```

### Flux de données (essentiel à comprendre)

1. Toute modification des données passe par `dispatch(op)` : une **opération** (`Op`, dans `ops.ts`) créée par `actions.ts`.
2. `reduce(state, op)` applique l’opération de façon **pure et déterministe**. Les identifiants et horodatages sont fixés à la création, jamais dans le réducteur.
3. Hors lobby : l’état est sauvegardé localement (`caisse-resto:v1`). L’appareil (profil, poste, imprimante, lobby) est stocké séparément (`caisse-resto:device`).
4. En lobby :
   - les opérations sont envoyées (`caisse_push`) et relues toutes les 2 s (`caisse_pull`, `POLL_MS`) ;
   - chaque appareil rejoue le même journal ordonné (seq), dédoublonné par `op_id` ;
   - état affiché = état confirmé + opérations en attente (file `caisse-resto:sync`, rejouée si le réseau coupe) ;
   - un instantané (`caisse_save_snapshot`) accélère l’arrivée des nouveaux.
5. La licence fait partie de l’état partagé : tous les appareils d’un lobby partagent l’abonnement du restaurant.

### Règles métier importantes

- Montants en **centimes** (entiers). Prix de la carte **hors TVA**. La TVA (0/6/12/21 %, `VAT_RATES`) est **choisie à l’encaissement** (obligatoire) et **ajoutée** : `orderTotal = orderNet + orderVat`. Les anciennes commandes sans `vatRate` gardent l’ancien calcul (TVA incluse au `settings.taxRate`, qui n’est plus modifiable).
- Licence mensuelle : chaque clé donne **30 jours** dès son activation (`MONTHLY_DAYS`), cumulables (calcul sur le serveur, `caisse_redeem_key`). `paidUntil` = fin de validité. Rappel 5 jours avant (`REMINDER_DAYS`), blocage à l’heure exacte de fin, puis la page de paiement revient. Revérification locale toutes les 15 s ; contrôle serveur (`caisse_license_check`) au démarrage, toutes les 30 min et au retour dans l’application.
- Activation : **uniquement** par une clé `XXXX-XXXX-XXXX-XXXX` générée par le créateur sur le serveur, liée à la licence de la commande, à usage unique. Le code démo reste local. Le code admin n’active plus de licence (il ouvre seulement l’administration locale).
- Code créateur (empreinte `CREATOR_CODE_HASH`) : exigé pour « Partir de zéro », « Recharger la démo » et « Effacer l’historique des tickets ».
- Démo : 24 h (`DEMO_HOURS`), une seule fois par licence.
- Clôture Z : chaque jour passé qui a des ventes est clôturé (`daysToClose`). L’opération est dédoublonnée par date, la numérotation est remise à zéro, et les 400 dernières clôtures sont conservées.
- Postes : `serveur` voit Salle + Commandes, `cuisine` / `bar` ne voient que leur écran ; Gestion toujours derrière le code gérant. Restriction **seulement en lobby**.
- Sécurité gérant : `autoLockMinutes` vaut -1 pour « automatique » (verrouillage en quittant la Gestion ou en passant en arrière-plan), 0 pour jamais, et une valeur > 0 pour des minutes d’inactivité.
- Codes : stockés en SHA-256 (`src/utils/sha256.ts`). Côté serveur : mot de passe créateur en bcrypt, jetons et clés aléatoires (pgcrypto) dont seule l’empreinte est stockée.

## 4. État des fonctionnalités

### Terminé ✅
- Salle : plan par zones, état coloré des tables, montant, durée, serveur.
- Prise de commande en 3 gestes, choix (cuisson…), allergènes, notes, quantités, couverts, « servi », changement de table, annulation, ticket à côté de la carte sur tablette (total affiché HTVA).
- Commandes en cours (filtres toutes / miennes / à servir).
- Cuisine / Bar : tickets par envoi, chrono, retard en rouge, avancement des lignes, rappel des tickets prêts.
- Encaissement : **TVA obligatoire 0/6/12/21 % ajoutée au montant**, pourboire (5/10/15 %, arrondi, libre), remise %, partage, carte/espèces/autre, monnaie à rendre.
- Ticket de caisse à l’écran : HT, TVA au taux choisi, TTC, remise, pourboire, rendu, N° de TVA, message de bas de ticket.
- Historique & statistiques : aujourd’hui / clôtures / tout, pourboires, remises, **TVA collectée par taux**, moyens de paiement, meilleures ventes.
- Clôture automatique à minuit, avec rattrapage à la réouverture.
- Gestion : identité & logo (avec N° de TVA), carte complète (articles, catégories, emojis 3D, choix, 14 allergènes, disponibilité, ordre), tables & zones, équipe & postes, préférences, données (protégées par le code créateur).
- Code gérant : ouverture auto, blocage progressif, changement avec l’ancien code, sécurité Automatique / inactivité / jamais.
- Équipe : postes Serveur / Bar / Cuisine, codes personnels, connexion directe au poste.
- Lobby : créer / rejoindre (code 6 caractères, QR code, lien d’invitation), synchro 2 s, file hors-ligne, accès filtré par poste, retour à la normale en quittant.
- Abonnement : mode démo 24 h ; mensuel 30 jours cumulables, rappel 5 jours (calendrier orange), fin en rouge, blocage puis nouveau paiement ; à vie.
- Paiement par virement : formulaire client, page pro (commerce, prénom et nom, montant exact, IBAN, titulaire, référence unique `CR-NNNN-XXXX`, « virement instantané »), bouton « Envoyer ma preuve de paiement sur WhatsApp » prérempli, suivi de commande, saisie de la clé.
- Espace créateur (`/createur`, mot de passe serveur) : à traiter, confirmation, refus, génération et envoi WhatsApp de la clé, clients et licences (couleurs, révocation), historique des paiements, réglages modifiables (commerce, prénom et nom, IBAN, titulaire, WhatsApp, prix, mot de passe).
- Administration locale (code admin) : droits du gérant, réinitialisation du code gérant, fermeture du lobby.
- Code créateur pour toute suppression de données.
- Contact support WhatsApp / téléphone 24 h/24.
- PWA Netlify installable sur iPhone ; mise en page vérifiée du 320 px à l’iPad.
- Outillage : `npm run verify` (types + lint + tests), `npm run e2e` (5 vérifications : paiement, service, abonnement + lobby, écrans, serveur), mémoire IA (ce fichier + CLAUDE.md).

### Retiré à la demande du propriétaire (2026-11-11)
- Toute l’impression (Bluetooth ESC/POS, AirPrint, écran « Imprimante & tickets », impression automatique, boutons « Imprimer », rapport imprimable) et l’option « Addition ». Le ticket de caisse et les clôtures restent **affichés** à l’écran.
- Le réglage du taux de TVA dans la Gestion (remplacé par le choix à l’encaissement).
- L’activation par les anciens codes (admin à vie, `M…`, `VIE-…`) et la génération locale de codes ; dans l’administration locale : licence, coordonnées bancaires, démo, liens de paiement.

### En cours 🚧
- Réduction progressive des 39 avertissements lint (voir § 6).

### Restant / idées 📋 (par priorité ; rien n’est engagé sans l’accord du propriétaire)
1. **Mise en service du serveur** : le propriétaire exécute `supabase/schema.sql`, définit le mot de passe, puis fournit l’URL et la clé publique → reconstruire le zip avec `EXPO_PUBLIC_SUPABASE_URL/KEY` (voir `docs/paiements.md`). Sans cela, le paiement affiche « non configuré ».
2. **Sécurité des codes** (voir § 7) : le code admin (administration locale) et le code démo sont publics → en choisir de nouveaux, retirer les codes en clair des tests unitaires, et/ou rendre le dépôt privé.
3. Tests sur vrais appareils (iPhone, Android).
6. Lancer `verify` (et éventuellement `e2e`) automatiquement à chaque push (GitHub Actions).
7. Suivi des erreurs en production (ex. Sentry).

## 5. Décisions techniques (et pourquoi)

| # | Décision | Raison | Conséquence à respecter |
|---|---|---|---|
| D1 | Expo + Expo Router, une seule base de code | iOS, Android et web avec un seul code | Routes uniquement dans `src/app/` ; pas de dossiers `ios/` `android/` à la main |
| D2 | Distribution en PWA via un zip Netlify | Pas de compte Apple Developer, installation immédiate sur iPhone | Tester le **build web** (`dist/`) ; les API natives doivent avoir un repli web |
| D3 | Données = journal d’opérations rejouables | Synchro d’équipe simple, file hors-ligne, déterminisme | Toute nouvelle modification de données = nouvelle `Op` + cas dans `reduce` + test ; jamais d’aléatoire ni de `Date.now()` dans `reduce` |
| D4 | Supabase par fonctions RPC + interrogation toutes les 2 s (pas de Realtime) | Fiable derrière tous les réseaux, aucun SDK, tables fermées (RLS) | Toute évolution serveur passe par `supabase/schema.sql`, gardé idempotent |
| D5 | Seule la clé **publique** Supabase côté app | La clé secrète donnerait tous les droits | Jamais de clé `service_role` dans le dépôt |
| D6 | Codes stockés en SHA-256 | Ne pas exposer les codes dans le code de l’app | Ne pas écrire de code en clair dans de nouveaux fichiers |
| D7 | Licences sur le serveur, blocage appliqué par l’appareil | Clés impossibles à fabriquer, contrôle total du créateur, et l’app reste utilisable hors ligne | Le serveur fait foi (`syncFromServer`) ; contournable seulement sur un appareil modifié et resté hors ligne |
| D8 | Tickets affichés à l’écran (`TicketDoc`, police à chasse fixe) | Impression retirée à la demande du propriétaire | Ajouter un document = une fonction dans `ticket/doc.ts` + un test |
| D9 | Paiement par virement validé à la main (pas de Stripe) | Choix du propriétaire : contrôle total, pas de frais | Toute la logique sensible est dans les fonctions SQL `caisse_*` ; le client ne voit que sa commande (jeton secret) |
| D12 | Fonctions du créateur : mot de passe à chaque appel, sans session serveur | Simple, rien à stocker sur l’iPhone | Réponse `{ error }` (pas d’exception) pour enregistrer les échecs ; blocage 10 min après 8 erreurs |
| D13 | TVA choisie à l’encaissement et ajoutée (prix HT) | Demande du propriétaire (taux belges 0/6/12/21) | `vatRate` sur la commande ; ne jamais recalculer les anciennes commandes |
| D14 | Code créateur (empreinte) pour supprimer des données | Seul le propriétaire peut effacer | Ne jamais écrire le code en clair dans le dépôt |
| D10 | Lint Expo avec les règles « React Compiler » en avertissement | Le React Compiler n’est pas activé ; le code utilise volontairement des refs à jour et `Date.now` pour les chronos | 0 erreur exigée ; avertissements à réduire progressivement |
| D11 | Libellés sans React Native dans `src/labels.ts` | Les tests `tsx` ne peuvent pas importer React Native | La logique testée ne doit pas importer `react-native` |

## 6. Dette technique (à réduire petit à petit, sans changer le comportement)

- **39 avertissements lint**, surtout `react-hooks/refs` (19) et `react-hooks/purity` (11) : `Toast.tsx`, `commande/[id].tsx`, `ui.tsx`, `StoreProvider.tsx`, `(tabs)/index.tsx`. Voir `npm run lint`.
- **Gros fichiers** : `components/ui.tsx` (≈ 700 lignes), `app/commande/[id].tsx` (≈ 600), `store/StoreProvider.tsx` (≈ 520), `supabase/schema.sql` (≈ 830, découpage possible en sections) → découper par responsabilité (ex. sortir la synchro du StoreProvider dans un hook `useLobbySync`).
- Champs conservés pour la compatibilité des anciennes données : `settings.taxRate`, `state.billing`, `state.paymentLinks` (plus utilisés par l’interface) : **ne pas supprimer** sans migration.
- **Pas de tests de composants** : seule la logique (`store/`, `license/`, `print/`) est testée unitairement ; l’interface est couverte par `tests/e2e`.
- Ancienne opération `addServer` / `renameServer` / `removeServer` conservée pour rejouer les anciens journaux de lobby : **ne pas supprimer**.

## 7. Points d’attention

- ⚠️ **Le dépôt GitHub est public.** Les codes admin et démo apparaissent en clair dans `src/store/store.test.ts` et dans l’historique Git. Depuis le 2026-11-11, le code admin **n’active plus de licence** : il n’ouvre que l’administration locale (droits du gérant, réinitialisation du code gérant). Mais quelqu’un qui le connaît peut encore réinitialiser le code gérant d’un appareil. Le code démo donne 24 h une fois par licence. Recommandé : nouveaux codes et/ou dépôt privé. **Ne pas changer les codes sans l’accord du propriétaire.** Le code créateur n’est jamais écrit en clair.
- Les scénarios e2e lisent `CAISSE_DEMO_CODE` dans l’environnement. Le mot de passe de l’Espace créateur de la base de **test** est `CAISSE_DASHBOARD_PASSWORD`, aléatoire par défaut. Ils activent les licences par le vrai circuit (commande → confirmation → clé).
- Build de test : `EXPO_PUBLIC_LICENSE_URL=http://localhost:8790` (fait par `run-all.sh`). **Ne jamais livrer un zip construit ainsi** : reconstruire avec `npm run build:netlify` et les variables du vrai serveur.
- `npx expo lint` sans configuration tentait de télécharger une config et **échouait en silence** (code de sortie 0) derrière le proxy. Corrigé avec `eslint.config.js` ; utiliser `npm run lint`.
- Réseau de l’environnement cloud : l’API Expo est bloquée → `EXPO_OFFLINE=1` pour `expo install` et `expo export`.
- Données de démo (`defaults.ts`) : 14 tables, carte d’exemple, équipe Serveur 1, Serveur 2, Chef, Barman. Les scénarios e2e s’appuient dessus.
- `dist/` et `caisse-resto-netlify.zip` sont générés et ignorés par Git.

## 8. Commandes utiles

```bash
npm run verify          # types + lint + tests unitaires (obligatoire après chaque modification)
CAISSE_DEMO_CODE=… npm run e2e   # bout en bout (build de test + PostgreSQL + 5 vérifications)
npm run build:netlify   # zip à déposer sur Netlify
npm start               # serveur de développement Expo
```

## 9. Journal des sessions

> Une entrée par session, la plus récente en haut. Pour voir ce qui a changé depuis la dernière mise à jour de ce fichier :
> `git log --oneline "$(git log -1 --format=%h -- docs/claude.md)"..HEAD`

### 2026-11-11 — Paiement par virement, Espace créateur, TVA, retrait de l’impression
- Retiré à la demande : impression (Bluetooth, AirPrint, écran Imprimante, boutons Imprimer, rapport), option « Addition », réglage TVA de la Gestion, anciens codes d’activation (désactivés avec l’accord du propriétaire).
- TVA 0/6/12/21 % obligatoire à l’encaissement, ajoutée au montant ; ticket, statistiques et clôtures détaillés par taux.
- Code créateur pour partir de zéro, recharger la démo et effacer l’historique.
- Serveur (`schema.sql`) : commandes de paiement, référence unique, jeton client, clés aléatoires hachées et liées à la licence, licences (30 jours cumulables, à vie, révocation), réglages modifiables, mot de passe bcrypt avec blocage.
- Client : page de paiement pro, preuve WhatsApp préremplie, suivi, activation par clé, contrôle serveur régulier ; calendrier orange (rappel) / rouge (fin).
- Espace créateur `/createur` : à traiter, clients et licences, paiements, réglages.
- Vérifications : `npm run verify` OK (0 erreur, 43 tests) ; `npm run e2e` (paiement complet, service, abonnement + lobby, 5 écrans, test serveur) : tout est vert (aucune erreur console).

### 2026-11-11 — Mise en place de la mémoire du projet
- Création de `CLAUDE.md`, `docs/claude.md`, `eslint.config.js`, scripts `lint`, `verify`, `e2e`.
- Les tests de bout en bout, jusque-là hors du dépôt, sont sauvegardés dans `tests/e2e/`. Ils passent depuis le dépôt, et lisent les codes d’accès dans l’environnement : aucun code en clair n’est ajouté.
- Le lint n’avait jamais réellement tourné. Il fonctionne maintenant, avec 0 erreur. Corrections sans changement de comportement :
  - Salle : la redirection cuisine/bar était placée avant des hooks (risque de plantage), elle est déplacée après ;
  - ordre des imports dans `equipe.tsx` ;
  - nom du composant d’icône d’onglet ;
  - directive ESLint inutile dans `emojiAssets.ts`.
- Constat : dépôt public avec codes en clair (voir § 7).
- Vérifications : `npm run verify` OK (37 tests), `npm run e2e` OK (3 scénarios, 5 tailles d’écran).

### 2026-11-11 — Étape 7 (commit 2c4a35d)
- Ajouts :
  - bandeau d’essai explicite et en-têtes défilants ;
  - ticket de caisse, impression Bluetooth et système ;
  - pourboire, remise et monnaie à rendre ;
  - clôture de minuit, historique imprimable ;
  - postes et codes employés, accès par poste en lobby ;
  - sécurité automatique, N° de TVA, contact WhatsApp.

### Historique antérieur (résumé)
- `a6579f9` : application de prise de commande (tables, commandes, cuisine/bar, gestion).
- `cda7088` : version web installable sur iPhone via Netlify.
- `7b2a66d` : design prestige, lobby d’équipe, code gérant, abonnements, code admin.
- `178a26b` : mode démo, paiement par virement, emojis 3D, logo, carte complète, lobby simplifié.
