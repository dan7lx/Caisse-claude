# Mémoire du projet — Caisse Resto

> Source de vérité pour toute session de développement assisté par IA.
> Chargée automatiquement par `CLAUDE.md`. À tenir à jour après chaque modification importante (voir CLAUDE.md § 4).
> Dernière mise à jour : 2026-11-11.

## 1. Le produit en bref

Application de caisse et de prise de commande pour restaurants : plan de salle, commandes, écrans cuisine et bar, encaissement, ticket de caisse, gestion complète, travail en équipe (lobby) et abonnement payant.
Cible principale : **iPhone via une PWA** (site Netlify ajouté à l’écran d’accueil), aussi Android et navigateur. Builds natifs possibles avec EAS, mais jamais publiés à ce jour.
Interface et contenus **en français**, euro par défaut, TVA belge (10 % par défaut, modifiable).

Propriétaire : vend l’application sous abonnement (45,99 €/mois ou 599,99 € à vie), paiement par virement, activation par code. Support client par WhatsApp et téléphone (voir `src/config.ts › SUPPORT`).

## 2. Technologies

| Domaine | Choix | Version |
|---|---|---|
| Framework | Expo (React Native) | SDK 58 (`expo ~58.0.23`) |
| UI | React / React Native / react-native-web | 19.3 / 0.88.1 / 0.21 |
| Navigation | Expo Router (fichiers dans `src/app/`) | 58 |
| Langage | TypeScript strict | 6.0 |
| Stockage local | AsyncStorage (localStorage sur le web) | 2.2 |
| Synchronisation d’équipe | Supabase (PostgreSQL + fonctions RPC), appelé en `fetch` | — |
| Impression | ESC/POS via Web Bluetooth ; `expo-print` / iframe sinon | — |
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
    abonnement.tsx          Formules, calendrier de paiement
    reglages/*.tsx          Écrans de la Gestion (articles, catégories, tables, équipe, identité,
                            préférences, imprimante, historique, admin)
  store/
    types.ts                Tous les types de données (AppState, Order, Settings, License…)
    ops.ts                  Opérations rejouables `Op` + réducteur `reduce` (cœur de la logique)
    actions.ts              Créateurs d’opérations (ids, horodatages)
    selectors.ts            Calculs dérivés (totaux, TVA, stats, tickets cuisine, clôtures)
    defaults.ts             Données de démo, `normalize` (migration des anciennes données)
    StoreProvider.tsx       État, sauvegarde, boucle de synchro, session gérant, clôture de minuit, useNow
    store.test.ts           Tests unitaires (37)
  sync/backend.ts           Appels RPC Supabase, liens d’invitation
  license/license.ts        Statut d’abonnement, démo, rappel, codes d’activation
  license/access.ts         Droits gérant/admin, codes employés
  print/                    doc.ts (contenu), escpos.ts (imprimante), html.ts (AirPrint), bluetooth.ts, index.ts
  components/               UI partagée (ui.tsx = boutons, champs, pavé numérique…), écrans de verrouillage, feuilles
  labels.ts                 Libellés sans React Native (utilisables dans les tests)
  theme.ts                  Couleurs, polices, styles d’état
  config.ts                 Prix, empreintes des codes, IBAN, support, serveur intégré
supabase/schema.sql         Tables + fonctions RPC du lobby (idempotent)
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

- Montants en **centimes** (entiers). TVA **incluse** dans les prix (`includedVat`).
- Licence mensuelle : `paidUntil` = le 1er du mois suivant à 00:00 (heure locale). Rappel 5 jours avant (`REMINDER_DAYS`), blocage à l’échéance. Revérification toutes les 15 s et au retour dans l’application.
- Démo : 24 h (`DEMO_HOURS`), une seule fois par licence.
- Clôture Z : chaque jour passé qui a des ventes est clôturé (`daysToClose`). L’opération est dédoublonnée par date, la numérotation est remise à zéro, et les 400 dernières clôtures sont conservées.
- Postes : `serveur` voit Salle + Commandes, `cuisine` / `bar` ne voient que leur écran ; Gestion toujours derrière le code gérant. Restriction **seulement en lobby**.
- Sécurité gérant : `autoLockMinutes` vaut -1 pour « automatique » (verrouillage en quittant la Gestion ou en passant en arrière-plan), 0 pour jamais, et une valeur > 0 pour des minutes d’inactivité.
- Codes : stockés en SHA-256 (`src/utils/sha256.ts`). Codes d’activation `M{AAAAMM}-xxxxxx` / `VIE-xxxxxx` salés avec l’identifiant de licence.

## 4. État des fonctionnalités

### Terminé ✅
- Salle : plan par zones, état coloré des tables, montant, durée, serveur.
- Prise de commande en 3 gestes, choix (cuisson…), allergènes, notes, quantités, couverts, « servi », changement de table, annulation, ticket à côté de la carte sur tablette.
- Commandes en cours (filtres toutes / miennes / à servir).
- Cuisine / Bar : tickets par envoi, chrono, retard en rouge, avancement des lignes, rappel des tickets prêts, impression des bons, impression auto des nouveaux bons.
- Encaissement : pourboire (5/10/15 %, arrondi, libre), remise %, partage, carte/espèces/autre, monnaie à rendre.
- Ticket de caisse et addition : TVA, HT, remise, pourboire, rendu, N° de TVA, message de bas de ticket.
- Impression : Bluetooth ESC/POS (58/80 mm), impression système, ticket / addition / bons / rapport / clôture, impression test.
- Historique & statistiques : aujourd’hui / clôtures / tout, pourboires, remises, moyens de paiement, meilleures ventes, impression.
- Clôture automatique à minuit, avec rattrapage à la réouverture.
- Gestion : identité & logo (avec N° de TVA), carte complète (articles, catégories, emojis 3D, choix, 14 allergènes, disponibilité, ordre), tables & zones, équipe & postes, préférences, imprimante, données.
- Code gérant : ouverture auto, blocage progressif, changement avec l’ancien code, sécurité Automatique / inactivité / jamais.
- Équipe : postes Serveur / Bar / Cuisine, codes personnels, connexion directe au poste.
- Lobby : créer / rejoindre (code 6 caractères, QR code, lien d’invitation), synchro 2 s, file hors-ligne, accès filtré par poste, retour à la normale en quittant.
- Abonnement : mode démo 24 h, mensuel avec rappel de 5 jours et blocage automatique le 1er, à vie, écran de paiement (montant, IBAN, bénéficiaire, communication, « virement instantané »), codes d’activation.
- Administration (code admin) : licence, droits du gérant, coordonnées bancaires, démo, génération de codes, liens de paiement, fermeture du lobby.
- Contact support WhatsApp / téléphone 24 h/24.
- PWA Netlify installable sur iPhone ; mise en page vérifiée du 320 px à l’iPad.
- Outillage : `npm run verify` (types + lint + tests), `npm run e2e` (3 scénarios navigateur), mémoire IA (ce fichier + CLAUDE.md).

### En cours 🚧
- Réduction progressive des 39 avertissements lint (voir § 6).

### Restant / idées 📋 (par priorité ; rien n’est engagé sans l’accord du propriétaire)
1. **Sécurité des codes** (urgent, voir § 7) : choisir de nouveaux codes admin et démo, remplacer les empreintes dans `config.ts`, retirer les codes en clair des tests (variables d’environnement), et/ou rendre le dépôt privé.
2. Vérification de licence côté serveur (aujourd’hui tout est contrôlé sur l’appareil, donc contournable).
3. Activation automatique après paiement (lien Stripe + webhook) au lieu des codes manuels.
4. Tests sur vrais appareils (iPhone, Android) et avec une vraie imprimante Bluetooth.
5. Build natif EAS (permettrait le Bluetooth direct sur iPhone, impossible dans Safari).
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
| D7 | Licence vérifiée sur l’appareil | Simplicité, pas de serveur de licences | Limite connue et documentée (README › Limites) |
| D8 | Impression : un `PrintDoc` unique, rendu en ESC/POS ou HTML | Même contenu partout, testable sans appareil | Ajouter un document = une fonction dans `print/doc.ts` + un test |
| D9 | Web Bluetooth pour l’imprimante | Fonctionne dans la PWA sur Android/Chrome | Pas disponible dans Safari iOS : repli AirPrint obligatoire |
| D10 | Lint Expo avec les règles « React Compiler » en avertissement | Le React Compiler n’est pas activé ; le code utilise volontairement des refs à jour et `Date.now` pour les chronos | 0 erreur exigée ; avertissements à réduire progressivement |
| D11 | Libellés sans React Native dans `src/labels.ts` | Les tests `tsx` ne peuvent pas importer React Native | La logique testée ne doit pas importer `react-native` |

## 6. Dette technique (à réduire petit à petit, sans changer le comportement)

- **39 avertissements lint**, surtout `react-hooks/refs` (19) et `react-hooks/purity` (11) : `Toast.tsx`, `commande/[id].tsx`, `ui.tsx`, `StoreProvider.tsx`, `(tabs)/index.tsx`. Voir `npm run lint`.
- **Gros fichiers** : `components/ui.tsx` (≈ 700 lignes), `app/commande/[id].tsx` (≈ 610), `store/StoreProvider.tsx` (≈ 520) → découper par responsabilité (ex. sortir la synchro du StoreProvider dans un hook `useLobbySync`).
- **Pas de tests de composants** : seule la logique (`store/`, `license/`, `print/`) est testée unitairement ; l’interface est couverte par `tests/e2e`.
- Ancienne opération `addServer` / `renameServer` / `removeServer` conservée pour rejouer les anciens journaux de lobby : **ne pas supprimer**.

## 7. Points d’attention

- ⚠️ **Le dépôt GitHub est public**, et les codes admin et démo apparaissent en clair dans `src/store/store.test.ts` et dans l’historique Git (les scénarios `tests/e2e` les lisent dans l’environnement : `CAISSE_ADMIN_CODE`, `CAISSE_DEMO_CODE`). N’importe qui peut les lire et obtenir une licence à vie. Correctif proposé au propriétaire (§ 4 › Restant n° 1). En attente de sa décision : **ne pas changer les codes sans son accord**.
- `npx expo lint` sans configuration tentait de télécharger une config et **échouait en silence** (code de sortie 0) derrière le proxy. Corrigé avec `eslint.config.js` ; utiliser `npm run lint`.
- Réseau de l’environnement cloud : l’API Expo est bloquée → `EXPO_OFFLINE=1` pour `expo install` et `expo export`.
- Données de démo (`defaults.ts`) : 14 tables, carte d’exemple, équipe Serveur 1, Serveur 2, Chef, Barman. Les scénarios e2e s’appuient dessus.
- `dist/` et `caisse-resto-netlify.zip` sont générés et ignorés par Git.

## 8. Commandes utiles

```bash
npm run verify          # types + lint + tests unitaires (obligatoire après chaque modification)
CAISSE_ADMIN_CODE=… CAISSE_DEMO_CODE=… npm run e2e   # bout en bout (build web + PostgreSQL de test + 3 scénarios)
npm run build:netlify   # zip à déposer sur Netlify
npm start               # serveur de développement Expo
```

## 9. Journal des sessions

> Une entrée par session, la plus récente en haut. Pour voir ce qui a changé depuis la dernière mise à jour de ce fichier :
> `git log --oneline "$(git log -1 --format=%h -- docs/claude.md)"..HEAD`

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
