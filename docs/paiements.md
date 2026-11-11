# Paiements par virement et licences — guide du créateur

Ce système vous laisse le contrôle total. Le client paie par virement et envoie la preuve sur WhatsApp. **Vous** vérifiez sur Revolut, **vous** confirmez, **vous** générez la clé. Rien ne s'active sans vous.

## 1. Mise en service (une seule fois, environ 10 minutes)

1. Sur [supabase.com](https://supabase.com), ouvrez votre projet ou créez-en un gratuitement.
2. Ouvrez **SQL Editor › New query**, collez **tout** le fichier [`supabase/schema.sql`](../supabase/schema.sql), puis cliquez sur **Run**. Le fichier crée le lobby d'équipe, les paiements, les clés et les licences. Vous pouvez le relancer sans risque après une mise à jour.
3. Dans une **nouvelle requête**, choisissez votre mot de passe pour l'Espace créateur (10 caractères minimum, long et unique) :
   ```sql
   select public.caisse_admin_set_password('votre-mot-de-passe-long-et-unique');
   ```
   Le mot de passe est stocké chiffré (bcrypt) et n'est jamais visible en clair. Vous pourrez le changer depuis l'application.
4. Dans **Project Settings › API**, récupérez :
   - l'adresse du projet, `https://xxxx.supabase.co` ;
   - la clé **publique** (*publishable* ou *anon*).

   **Jamais la clé secrète ni la clé `service_role`.**
5. Envoyez ces deux valeurs pour la construction du zip. La clé publique est faite pour être visible. Le zip est construit avec :
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co EXPO_PUBLIC_SUPABASE_KEY=<clé publique> npm run build:netlify
   ```
   Le même serveur sert au lobby de l'équipe et aux licences. Pour des serveurs séparés, utilisez `EXPO_PUBLIC_LICENSE_URL` et `EXPO_PUBLIC_LICENSE_KEY`.
6. Déposez le nouveau zip sur Netlify.

## 2. Ce que voit votre client

1. Écran **Abonnement**, ou écran de blocage : il choisit **Mensuel** ou **À vie**, puis **Payer**.
2. Il saisit son prénom et son nom, son commerce, son e-mail et son WhatsApp. Il obtient une page de paiement avec :
   - votre commerce, votre prénom et votre nom ;
   - le **montant exact** et la formule ;
   - l'IBAN et le titulaire ;
   - une **référence unique** à mettre en communication, par exemple `CR-0042-K7PQ`.

   Chaque valeur a un bouton « Copier ». En petit : « Le virement doit être instantané ».
3. Il touche **« Envoyer ma preuve de paiement sur WhatsApp »**. WhatsApp s'ouvre vers votre numéro avec un message prérempli : numéro de commande, référence, nom, e-mail, formule, licence. Il y joint la capture d'écran de son virement.
4. Son écran affiche « Preuve reçue · vérification en cours ». Dès que vous avez confirmé, il voit « Paiement confirmé » et un champ **« Activer ma licence »**, où il saisit la clé reçue.

Le client ne voit que **sa** commande : elle est protégée par un jeton secret propre à son appareil.

## 3. Votre travail au quotidien (depuis l'iPhone)

Ouvrez l'application, puis le lien discret **« Espace créateur »**. Il se trouve en bas de la Gestion, ou en bas de l'écran de blocage si votre téléphone n'a pas d'abonnement. Saisissez votre mot de passe.

- **À traiter** : les commandes, les plus urgentes d'abord.
  - *Preuve reçue · à vérifier* : vérifiez sur Revolut le montant et la référence, puis touchez **Confirmer le paiement** ;
  - *Clé à générer* : touchez **Générer la clé d'activation**. La clé (`XXXX-XXXX-XXXX-XXXX`) s'affiche **une seule fois**. Utilisez **Envoyer au client** (WhatsApp prérempli) ou **Copier** ;
  - *En attente du virement* : le client n'a pas encore envoyé de preuve ;
  - **Refuser** si le virement n'est jamais arrivé.
- **Clients** : chaque licence avec sa couleur. Vert : active. **Orange** : se termine dans moins de 5 jours. **Rouge** : expirée. Or : à vie. Gris : révoquée. Une fiche montre l'historique des paiements, ouvre WhatsApp et permet de **Révoquer** ou de **Rétablir** l'accès.
- **Paiements** : l'historique complet et le total encaissé.
- **Réglages** : nom du commerce, prénom et nom, IBAN, titulaire, numéro WhatsApp, prix, mot de passe.

Le tableau de bord se met à jour toutes les minutes. Tirez vers le bas pour le rafraîchir. Le cadenas en haut le verrouille.

## 4. Règles des licences

- **Mensuel** : chaque clé donne **30 jours** à partir de son activation. Une clé activée avant la fin ajoute ses 30 jours **à la suite**, sans perte de jours.
- **Rappel** : pendant les 5 jours qui précèdent la fin, un bandeau et une fenêtre s'affichent. Dans le calendrier, ces jours sont en **orange** et le jour de fin en **rouge**.
- **Fin** : à l'heure exacte de fin, l'application se bloque. La page de paiement revient et le client refait le même processus (nouvelle commande, nouvelle clé).
- **À vie** : sans expiration.
- **Révocation** : appliquée au prochain contrôle de l'application. Ce contrôle a lieu au démarrage, toutes les 30 minutes et au retour dans l'application.
- Une clé ne sert **qu'une fois**, et seulement pour la licence du client qui a passé la commande.
- L'essai gratuit de 24 h (code démo) est conservé.
- Les anciens codes ne fonctionnent plus : code administrateur à vie, codes `M202612-…` et `VIE-…`. Les licences déjà actives sur des appareils restent valables jusqu'à leur fin.

## 5. Sécurité

- Les tables ne sont lisibles par personne depuis l'application. Tout passe par des fonctions qui vérifient les droits.
- Les fonctions du créateur exigent votre mot de passe à chaque appel. Après 8 erreurs, l'accès est bloqué 10 minutes, même avec le bon mot de passe.
- Clés et jetons sont tirés au hasard (pgcrypto). Le serveur n'en garde que l'empreinte : personne, pas même vous, ne peut relire une clé après sa génération. En cas de perte, **régénérez-la** : l'ancienne cesse de fonctionner.
- Limites connues :
  - l'application est une page web : une personne très technique pourrait modifier la licence **sur son propre appareil**. Le contrôle serveur la remet en ordre dès qu'il s'exécute, sauf si l'appareil reste hors ligne ;
  - quelqu'un qui connaît l'adresse du serveur pourrait bloquer votre accès 10 minutes en tapant de faux mots de passe. Vos données ne seraient pas en danger.
