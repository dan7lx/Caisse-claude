# Tests de bout en bout

Ils pilotent l’application web compilée (`dist/`) dans Chromium, comme un vrai téléphone. Ils utilisent un vrai serveur de test : PostgreSQL et `supabase/schema.sql`, pour le lobby, les paiements et les licences.

```bash
export CAISSE_DEMO_CODE=…   # code démo, fourni par le propriétaire (jamais écrit dans le dépôt)
npm run e2e                 # base de test, build de test, serveurs, 5 vérifications, arrêt des serveurs
SKIP_BUILD=1 npm run e2e    # réutilise le dist/ existant (attention : il doit venir d’un build de test)
```

`CAISSE_DASHBOARD_PASSWORD` est le mot de passe de l’Espace créateur de la base de **test**. Il est tiré au hasard à chaque lancement, sauf si vous le fournissez.

Le build de test pointe le serveur de licences vers `http://localhost:8790`. **Ne jamais livrer ce `dist/`** : reconstruire avec `npm run build:netlify`.

| Fichier | Rôle |
|---|---|
| `run-all.sh` | Lance tout dans l’ordre et dit « tout est vert » ou « ÉCHEC » |
| `scenario-paiement.js` | Formulaire client, page de virement (IBAN, montant, référence), preuve WhatsApp préremplie, Espace créateur (mot de passe, confirmation, clé), activation, calendrier orange/rouge, fin des 30 jours → blocage et retour du paiement |
| `scenario-service.js` | Essai gratuit, encaissement (TVA obligatoire, pourboire, monnaie), ticket, historique (TVA collectée), code créateur, clôture de minuit, N° de TVA, codes employés, sécurité automatique, lobby, poste Cuisine |
| `scenario-abonnement-lobby.js` | Mode démo 24 h puis blocage, activation par clé, code gérant (blocage après 5 erreurs), lobby créer/rejoindre, cuisson, cuisine → salle |
| `responsive.js` | 5 tailles d’écran (iPhone SE → iPad) : aucun débordement horizontal |
| `serveur-licences.js` | Fonctions SQL des paiements et licences : isolement des commandes, clés à usage unique liées à la licence, 30 jours cumulés, révocation, réglages, blocage du mot de passe |
| `codes.js` | Lit les codes dans l’environnement ; `activateWithKey` active une licence par le vrai circuit |
| `setup-db.sh` | Crée et démarre PostgreSQL de test (port 5499, socket `/var/tmp/caisse-pg`), charge le schéma, définit le mot de passe de test |
| `rest-server.js` | Imite l’API RPC de Supabase sur le port 8790 (les droits GRANT/REVOKE du rôle anon s’appliquent) |
| `serve.js` | Sert `dist/` sur le port 8766 (comme Netlify) |

Prérequis : PostgreSQL 16 (`/usr/lib/postgresql/*/bin`, avec pgcrypto), Node, et Playwright avec Chromium. Dans l’environnement cloud de Claude Code, Playwright et Chromium sont préinstallés : **ne pas réinstaller Playwright**. Ailleurs : `npm i -g playwright && npx playwright install chromium`.

Les captures (et `echec-*.png` en cas d’échec) vont dans `tests/e2e/captures/`, qui est ignoré par Git.

Pièges connus :
- les onglets du bas ne sont pas des `role=tab` : utiliser `page.getByText('Salle', { exact: true }).last()` ;
- plusieurs écrans restent montés : pour un bouton présent dans plusieurs en-têtes (Équipe), filtrer `{ visible: true }` et attendre la fin de la transition d’onglet ;
- dans un lobby, le bouton Équipe s’appelle « Lobby CODE » ;
- l’heure est figée avec `page.clock.setFixedTime(...)` pour la démo, le rappel, la fin d’abonnement et la clôture de minuit. Le serveur, lui, suit l’heure réelle ;
- `serveur-licences.js` se termine en bloquant le mot de passe (test du blocage) : le garder en dernier.
