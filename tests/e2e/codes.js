// Codes d'accès utilisés par les scénarios, lus dans l'environnement : ils ne doivent jamais être écrits
// en clair dans le dépôt (public). Exemple : CAISSE_ADMIN_CODE=xxxxxx CAISSE_DEMO_CODE=xxxx npm run e2e
const admin = process.env.CAISSE_ADMIN_CODE;
const demo = process.env.CAISSE_DEMO_CODE;
if (!admin || !demo) {
  console.error('Définissez CAISSE_ADMIN_CODE et CAISSE_DEMO_CODE (codes administrateur et démo) avant de lancer les tests.');
  process.exit(2);
}
module.exports = { admin, demo };
