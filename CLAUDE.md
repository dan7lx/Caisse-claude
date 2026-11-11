# CLAUDE.md — règles de travail sur Caisse Resto

Ce fichier est lu automatiquement au début de chaque session Claude Code.
Les deux lignes ci-dessous importent la mémoire du projet : elles sont chargées à chaque session, sans action manuelle.

@docs/claude.md
@AGENTS.md

- `docs/claude.md` : mémoire du projet (architecture, fonctionnalités, état d’avancement, décisions, journal). **Source de vérité.**
- `AGENTS.md` : règles Expo / React Native (lire la doc Expo de la bonne version avant de toucher une API Expo).

Langue : le propriétaire écrit en français. Répondre, documenter et rédiger les messages de commit en français.

## 1. Au début de chaque session

1. Relire `docs/claude.md` (déjà importé ci-dessus), en particulier « État des fonctionnalités » et « Journal des sessions ».
2. Voir ce qui a changé depuis la dernière mise à jour de la mémoire :
   ```bash
   git status --short
   git log --oneline "$(git log -1 --format=%h -- docs/claude.md)"..HEAD
   git diff --stat "$(git log -1 --format=%h -- docs/claude.md)"..HEAD
   ```
   S’il y a des commits ou fichiers non documentés, les lire et mettre `docs/claude.md` à jour **avant** de commencer la nouvelle tâche.
3. Vérifier que le projet est sain : `npm run verify`. Signaler tout échec au propriétaire avant d’aller plus loin.

## 2. Pendant le travail

- **Ne jamais supprimer ni désactiver une fonctionnalité sans l’autorisation explicite du propriétaire**, même pour « simplifier ». En cas de doute, demander.
- Ne pas modifier le fonctionnement actuel sans que la demande l’exige. Les refactorisations se font sans changer le comportement visible.
- Ne jamais mettre de secret dans le code : seule la clé **publique** Supabase est permise. Les codes (admin, démo, gérant, employés) ne sont stockés que sous forme d’empreinte SHA-256.
- Ne jamais écrire en clair un code d’accès dans un nouveau fichier (le dépôt est public, voir docs/claude.md › Points d’attention).
- Paquets : `npx expo install <paquet>` (ajouter `EXPO_OFFLINE=1` si l’API Expo est bloquée par le réseau).
- Nouvelle logique métier → test dans `src/store/store.test.ts` (ou un nouveau `*.test.ts`), sans React Native dans les imports testés.
- Garder les fichiers petits et ciblés (repère : 400 lignes, 800 au maximum).

## 3. Après chaque modification

1. `npm run verify` : TypeScript, lint (0 erreur exigée) et tests unitaires.
2. Si l’interface, la navigation, le lobby, l’abonnement ou l’impression sont touchés : `npm run e2e` (voir `tests/e2e/README.md` ; les codes admin et démo sont à demander au propriétaire et à passer en variables d’environnement `CAISSE_ADMIN_CODE` / `CAISSE_DEMO_CODE`). Adapter un scénario seulement si le changement de comportement a été **demandé**, sinon corriger le code.
3. Ne jamais annoncer « vérifié » sans avoir lu la sortie de la commande.

## 4. Après chaque modification importante (avant le commit)

Mettre à jour `docs/claude.md` :
- « État des fonctionnalités » : déplacer les éléments entre Terminé / En cours / Restant ;
- « Architecture » ou « Décisions techniques » si la structure ou un choix change ;
- « Dette technique » et « Points d’attention » si besoin ;
- « Journal des sessions » : une entrée datée, courte (quoi, pourquoi, vérifications faites).

Mettre aussi à jour `README.md` si l’utilisateur final est concerné.

## 5. Livraison

- Commits au format `type: description` (feat, fix, refactor, docs, test, chore, perf), en français.
- Pousser sur la branche de travail indiquée par la session ; pas de pull request sans demande.
- Zip Netlify : `npm run build:netlify` → `caisse-resto-netlify.zip` (ignoré par Git), à envoyer au propriétaire.

## 6. Optimisation continue pour l’IA (petit à petit, sans changer le comportement)

À chaque session, si le temps le permet, améliorer **un** point de « Dette technique » de `docs/claude.md` (ex. réduire les avertissements lint, découper un gros fichier, ajouter un test) et le noter dans le journal.
