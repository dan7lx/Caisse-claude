# Tests de bout en bout

Ils pilotent l’application web compilée (`dist/`) dans Chromium, comme un vrai téléphone, avec un vrai serveur de lobby (PostgreSQL + `supabase/schema.sql`).

```bash
export CAISSE_ADMIN_CODE=…  CAISSE_DEMO_CODE=…   # codes admin et démo, fournis par le propriétaire
npm run e2e                 # base de test, build web, serveurs, 3 scénarios, arrêt des serveurs
SKIP_BUILD=1 npm run e2e    # réutilise le dist/ existant
```

Les codes d’accès ne sont **jamais** écrits dans le dépôt (il est public) : `codes.js` les lit dans l’environnement et arrête les tests s’ils manquent.

| Fichier | Rôle |
|---|---|
| `run-all.sh` | Lance tout dans l’ordre et dit « tout est vert » ou « ÉCHEC » |
| `scenario-service.js` | Essai gratuit, encaissement (pourboire, monnaie), ticket, impression, historique, clôture de minuit, N° de TVA, codes employés, sécurité automatique, lobby, poste Cuisine |
| `scenario-abonnement-lobby.js` | Paiement par virement, mode démo 24 h puis blocage, code gérant (blocage après 5 erreurs), lobby créer/rejoindre, cuisson, cuisine → salle |
| `responsive.js` | 5 tailles d’écran (iPhone SE → iPad) : aucun débordement horizontal |
| `setup-db.sh` | Crée et démarre PostgreSQL de test (port 5499, socket `/var/tmp/caisse-pg`) et charge le schéma |
| `rest-server.js` | Imite l’API RPC de Supabase sur le port 8790 |
| `serve.js` | Sert `dist/` sur le port 8766 (comme Netlify) |
| `codes.js` | Lit les codes admin et démo dans l’environnement |

Prérequis : PostgreSQL 16 (`/usr/lib/postgresql/*/bin`), Node, et Playwright avec Chromium. Dans l’environnement cloud de Claude Code, Playwright et Chromium sont préinstallés : **ne pas réinstaller Playwright**. Ailleurs : `npm i -g playwright && npx playwright install chromium`.

Les captures (et `echec-*.png` en cas d’échec) vont dans `tests/e2e/captures/` (ignoré par Git).

Pièges connus :
- les onglets du bas ne sont pas des `role=tab` : utiliser `page.getByText('Salle', { exact: true }).last()` ;
- dans un lobby, le bouton Équipe s’appelle « Lobby CODE » ;
- l’heure est figée avec `page.clock.setFixedTime(...)` pour tester la démo, le rappel et la clôture de minuit.
