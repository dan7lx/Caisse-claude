// Codes et outils communs aux scénarios. Les codes d'accès sont lus dans l'environnement : ils ne doivent
// jamais être écrits en clair dans le dépôt (public).
//   CAISSE_DEMO_CODE            code du mode démo
//   CAISSE_DASHBOARD_PASSWORD   mot de passe de l'Espace créateur sur la base de TEST (choisi librement)
const demo = process.env.CAISSE_DEMO_CODE;
const dashboard = process.env.CAISSE_DASHBOARD_PASSWORD;
if (!demo || !dashboard) {
  console.error('Définissez CAISSE_DEMO_CODE et CAISSE_DASHBOARD_PASSWORD avant de lancer les tests (voir tests/e2e/README.md).');
  process.exit(2);
}

const API = 'http://localhost:8790/rest/v1/rpc/';

async function rpc(fn, args) {
  const res = await fetch(API + fn, {
    method: 'POST',
    headers: { apikey: 'cle-publique-de-test', 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.message || body.error);
  return body;
}

/**
 * Active la licence de la page par le vrai circuit : commande de paiement sur le serveur de test,
 * confirmation et génération de la clé par le créateur, puis saisie de la clé dans l'application.
 */
async function activateWithKey(page, plan = 'vie') {
  const hint = await page.getByText(/Identifiant de licence/).first().textContent();
  const license = /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(hint ?? '')?.[1];
  if (!license) throw new Error('identifiant de licence introuvable');
  const created = await rpc('caisse_create_payment_order', {
    p_license: license,
    p_plan: plan,
    p_name: 'Client Test',
    p_restaurant: 'Le Comptoir',
    p_email: 'test@example.com',
    p_phone: '+32470000000',
  });
  await rpc('caisse_admin_confirm', { p_password: dashboard, p_order: created.order.id, p_note: 'e2e' });
  const { key } = await rpc('caisse_admin_generate_key', { p_password: dashboard, p_order: created.order.id });
  await page.getByLabel('Code d’activation').fill(key);
  await page.getByRole('button', { name: 'Activer', exact: true }).click();
  return key;
}

module.exports = { demo, dashboard, rpc, activateWithKey };
