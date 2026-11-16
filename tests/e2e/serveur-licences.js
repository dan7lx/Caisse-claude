// Test du serveur de paiements et licences (supabase/schema.sql) à travers l'API, comme l'application.
// Prérequis : base de test + rest-server.js lancés (npm run e2e s'en charge),
// CAISSE_DASHBOARD_PASSWORD = mot de passe du tableau de bord défini dans la base de test.
const assert = require('node:assert/strict');

const API = 'http://localhost:8790/rest/v1/rpc/';
const PASSWORD = process.env.CAISSE_DASHBOARD_PASSWORD;
const DAY = 86400000;

async function rpc(fn, args) {
  const res = await fetch(API + fn, {
    method: 'POST',
    headers: { apikey: 'cle-publique-de-test', 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message);
  return body;
}
const fails = async (fn, args, re) => {
  await assert.rejects(rpc(fn, args), re);
};
const randomLicense = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('');
  return `${pick()}-${pick()}`;
};

(async () => {
  if (!PASSWORD) throw new Error('CAISSE_DASHBOARD_PASSWORD manquant');
  const lic = randomLicense();
  const client = { p_license: lic, p_name: 'Marie Dupont', p_restaurant: 'Chez Marie', p_email: 'marie@example.com', p_phone: '+32 470 12 34 56' };

  // Réglages publics et commande
  const billing = await rpc('caisse_billing_public', {});
  assert.ok(billing.iban && billing.price_monthly > 0);
  const created = await rpc('caisse_create_payment_order', { ...client, p_plan: 'mensuel' });
  const order = created.order;
  assert.match(order.reference, /^CR-\d{4,}-[A-Z2-9]{4}$/);
  assert.equal(order.amount, billing.price_monthly);
  assert.equal(order.status, 'en_attente');
  console.log('Commande créée :', order.reference, `(${order.amount / 100} €)`);

  // Personne d'autre ne peut lire la commande
  await fails('caisse_payment_order_status', { p_order: order.id, p_token: 'mauvais' }, /introuvable/);
  const st = await rpc('caisse_payment_order_status', { p_order: order.id, p_token: created.token });
  assert.equal(st.order.reference, order.reference);
  console.log('Suivi : uniquement avec le jeton secret du client');

  // Tables et fonctions internes fermées au public
  await fails('caisse_admin_set_password', { p_new: 'pirate-pirate' }, /permission|denied/i);
  await fails('caisse_random_text', { p_len: 4 }, /permission|denied/i);
  console.log('Fonctions internes inaccessibles depuis l’application');

  // Preuve envoyée, puis le créateur confirme et génère la clé
  await rpc('caisse_payment_proof_sent', { p_order: order.id, p_token: created.token });
  const bad = await rpc('caisse_admin_dashboard', { p_password: 'mauvais-mot-de-passe' });
  assert.match(bad.error, /incorrect/);
  const dash = await rpc('caisse_admin_dashboard', { p_password: PASSWORD });
  const seen = dash.orders.find((o) => o.id === order.id);
  assert.equal(seen.status, 'preuve_envoyee');
  const early = await rpc('caisse_admin_generate_key', { p_password: PASSWORD, p_order: order.id });
  assert.match(early.error, /Confirmez/);
  await rpc('caisse_admin_confirm', { p_password: PASSWORD, p_order: order.id, p_note: 'Vu sur Revolut' });
  const gen = await rpc('caisse_admin_generate_key', { p_password: PASSWORD, p_order: order.id });
  assert.match(gen.key, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  console.log('Créateur : preuve vue, paiement confirmé, clé générée');

  // Activation : seulement pour la bonne licence, une seule fois, 30 jours
  await fails('caisse_redeem_key', { p_license: randomLicense(), p_key: gen.key }, /autre licence/);
  const before = Date.now();
  const r1 = await rpc('caisse_redeem_key', { p_license: lic, p_key: gen.key.toLowerCase().replace(/-/g, ' ') });
  assert.equal(r1.plan, 'mensuel');
  assert.ok(Math.abs(r1.valid_until - (before + 30 * DAY)) < 60000, 'valable 30 jours');
  await fails('caisse_redeem_key', { p_license: lic, p_key: gen.key }, /déjà été utilisée/);
  console.log('Clé activée : 30 jours, liée à la licence, à usage unique');

  // Renouvellement anticipé : les 30 jours s'ajoutent à la suite
  const c2 = await rpc('caisse_create_payment_order', { ...client, p_plan: 'mensuel' });
  await rpc('caisse_admin_confirm', { p_password: PASSWORD, p_order: c2.order.id, p_note: '' });
  const k2 = await rpc('caisse_admin_generate_key', { p_password: PASSWORD, p_order: c2.order.id });
  const r2 = await rpc('caisse_redeem_key', { p_license: lic, p_key: k2.key });
  assert.ok(Math.abs(r2.valid_until - (r1.valid_until + 30 * DAY)) < 60000, '30 jours cumulés');
  console.log('Renouvellement anticipé : 30 jours ajoutés à la suite');

  // Contrôle de licence, révocation, rétablissement
  let chk = await rpc('caisse_license_check', { p_license: lic });
  assert.equal(chk.plan, 'mensuel');
  await rpc('caisse_admin_license_action', { p_password: PASSWORD, p_license: lic, p_action: 'revoke' });
  chk = await rpc('caisse_license_check', { p_license: lic });
  assert.equal(chk.plan, 'aucun');
  await rpc('caisse_admin_license_action', { p_password: PASSWORD, p_license: lic, p_action: 'restore' });
  assert.equal((await rpc('caisse_license_check', { p_license: lic })).plan, 'mensuel');
  console.log('Révocation et rétablissement par le créateur');

  // Licence à vie
  const c3 = await rpc('caisse_create_payment_order', { ...client, p_plan: 'vie' });
  assert.equal(c3.order.amount, billing.price_lifetime);
  await rpc('caisse_admin_confirm', { p_password: PASSWORD, p_order: c3.order.id, p_note: '' });
  const k3 = await rpc('caisse_admin_generate_key', { p_password: PASSWORD, p_order: c3.order.id });
  const r3 = await rpc('caisse_redeem_key', { p_license: lic, p_key: k3.key });
  assert.equal(r3.plan, 'vie');
  assert.equal(r3.valid_until, null);
  console.log('Licence à vie : sans expiration');

  // Refus, annulation, validation des saisies
  const c4 = await rpc('caisse_create_payment_order', { ...client, p_plan: 'mensuel' });
  await rpc('caisse_admin_reject', { p_password: PASSWORD, p_order: c4.order.id, p_note: 'Virement non reçu' });
  const c5 = await rpc('caisse_create_payment_order', { ...client, p_plan: 'mensuel' });
  await rpc('caisse_payment_cancel', { p_order: c5.order.id, p_token: c5.token });
  await fails('caisse_create_payment_order', { ...client, p_plan: 'mensuel', p_email: 'pas-un-email' }, /e-mail/);
  console.log('Refus, annulation et contrôle des saisies');

  // Réglages modifiables par le créateur seulement
  const upd = await rpc('caisse_admin_update_billing', {
    p_password: PASSWORD,
    p_billing: { ...billing, business_name: 'Caisse Resto Pro', price_monthly: 4599 },
  });
  assert.equal(upd.billing.business_name, 'Caisse Resto Pro');
  assert.match((await rpc('caisse_admin_update_billing', { p_password: 'x', p_billing: billing })).error, /incorrect/);
  await rpc('caisse_admin_update_billing', { p_password: PASSWORD, p_billing: billing });
  console.log('Réglages (commerce, IBAN, WhatsApp, prix) modifiables par le créateur');

  // Historique des paiements visible dans le tableau de bord
  const d2 = await rpc('caisse_admin_dashboard', { p_password: PASSWORD });
  const mine = d2.orders.filter((o) => o.license_id === lic);
  assert.deepEqual(
    mine.map((o) => o.status).sort(),
    ['annulee', 'confirmee', 'confirmee', 'confirmee', 'refusee'],
  );
  assert.ok(d2.licenses.some((l) => l.license_id === lic && l.plan === 'vie'));
  assert.ok(!('token_hash' in mine[0]) && !('key_hash' in mine[0]), 'aucune empreinte exposée');
  console.log('Tableau de bord : historique complet, aucune empreinte exposée');

  // Contrôle total du créateur sur un client
  const lc = randomLicense();
  const mk = async (plan) => {
    const c = await rpc('caisse_create_payment_order', { ...client, p_license: lc, p_plan: plan });
    await rpc('caisse_admin_confirm', { p_password: PASSWORD, p_order: c.order.id, p_note: '' });
    return (await rpc('caisse_admin_generate_key', { p_password: PASSWORD, p_order: c.order.id })).key;
  };
  const act = (action, days) => rpc('caisse_admin_license_action', { p_password: PASSWORD, p_license: lc, p_action: action, p_days: days ?? null });
  const r0 = await rpc('caisse_redeem_key', { p_license: lc, p_key: await mk('mensuel') });
  await act('extend', 7);
  let c0 = await rpc('caisse_license_check', { p_license: lc });
  assert.ok(Math.abs(c0.valid_until - (r0.valid_until + 7 * DAY)) < 60000, '+7 jours');
  await act('expire');
  c0 = await rpc('caisse_license_check', { p_license: lc });
  assert.ok(c0.valid_until <= Date.now() + 5000, 'terminé maintenant');
  await act('lifetime');
  assert.equal((await rpc('caisse_license_check', { p_license: lc })).plan, 'vie');
  assert.match((await act('extend', 30)).error, /déjà à vie/);
  assert.match((await act('delete')).error, /révoquez ou bloquez/, 'pas de suppression d’un client actif');
  await rpc('caisse_admin_update_client', { p_password: PASSWORD, p_license: lc, p_info: { note: 'Client fidèle', restaurant_name: 'Chez Marie bis' } });
  const gift = await rpc('caisse_admin_grant_key', { p_password: PASSWORD, p_license: lc, p_plan: 'mensuel' });
  assert.match(gift.key, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
  assert.equal(gift.order.amount, 0);
  // Bloquer : accès coupé, plus de commande ni d'activation, lobby fermé
  const lob = await rpc('caisse_create_lobby', { p_snapshot: { license: { id: lc }, settings: {} } });
  await act('ban');
  assert.equal((await rpc('caisse_license_check', { p_license: lc })).plan, 'aucun');
  await fails('caisse_create_payment_order', { ...client, p_license: lc, p_plan: 'mensuel' }, /bloquée/);
  await fails('caisse_redeem_key', { p_license: lc, p_key: gift.key }, /bloquée/);
  assert.equal((await rpc('caisse_pull', { p_lobby: lob.lobby_id, p_after: 0 })).closed, true, 'équipe déconnectée');
  // Retirer du tableau de bord : masqué, mais toujours coupé
  await act('delete');
  let d3 = await rpc('caisse_admin_dashboard', { p_password: PASSWORD });
  const gone = d3.licenses.find((l) => l.license_id === lc);
  assert.ok(gone.deleted_at && gone.banned && gone.note === 'Client fidèle' && gone.restaurant_name === 'Chez Marie bis');
  assert.equal((await rpc('caisse_license_check', { p_license: lc })).plan, 'aucun', 'reste coupé après suppression');
  await act('undelete');
  await act('unban');
  await act('restore');
  d3 = await rpc('caisse_admin_dashboard', { p_password: PASSWORD });
  assert.equal(d3.licenses.find((l) => l.license_id === lc).deleted_at, null);
  assert.equal((await rpc('caisse_license_check', { p_license: lc })).plan, 'vie');
  // Fermer le lobby d'un client à distance
  const lob2 = await rpc('caisse_create_lobby', { p_snapshot: { license: { id: lc }, settings: {} } });
  assert.equal(d3.licenses.find((l) => l.license_id === lc).lobby, null);
  const d4 = await rpc('caisse_admin_dashboard', { p_password: PASSWORD });
  assert.equal(d4.licenses.find((l) => l.license_id === lc).lobby.code, lob2.code);
  await rpc('caisse_admin_close_lobby', { p_password: PASSWORD, p_license: lc });
  assert.equal((await rpc('caisse_pull', { p_lobby: lob2.lobby_id, p_after: 0 })).closed, true);
  console.log('Contrôle total : +jours, fin, à vie, fiche, clé offerte, blocage, suppression masquée, lobby fermé à distance');

  // Lobbies : un par restaurant, sans lien entre restaurants
  const snap = (licenseId, name) => ({ license: { id: licenseId }, settings: { restaurantName: name } });
  const licA = randomLicense();
  const licB = randomLicense();
  const a1 = await rpc('caisse_create_lobby', { p_snapshot: snap(licA, 'Chez A') });
  const b1 = await rpc('caisse_create_lobby', { p_snapshot: snap(licB, 'Chez B') });
  assert.notEqual(a1.code, b1.code);
  assert.notEqual(a1.lobby_id, b1.lobby_id);
  const joinB = await rpc('caisse_join_lobby', { p_code: b1.code });
  assert.equal(joinB.snapshot.settings.restaurantName, 'Chez B');
  await rpc('caisse_push', { p_lobby: a1.lobby_id, p_ops: [{ op_id: 'op-a', op: { t: 'clearHistory' } }] });
  assert.equal((await rpc('caisse_pull', { p_lobby: b1.lobby_id, p_after: 0 })).events.length, 0, 'B ne voit rien de A');
  // Nouveau lobby du restaurant A : son ancien lobby est fermé, celui de B n'est pas touché.
  const a2 = await rpc('caisse_create_lobby', { p_snapshot: snap(licA, 'Chez A') });
  assert.notEqual(a2.code, a1.code);
  assert.equal((await rpc('caisse_pull', { p_lobby: a1.lobby_id, p_after: 0 })).closed, true);
  assert.equal((await rpc('caisse_pull', { p_lobby: b1.lobby_id, p_after: 0 })).closed, false);
  await fails('caisse_join_lobby', { p_code: a1.code }, /Aucun lobby ouvert/);
  await fails('caisse_create_lobby', { p_snapshot: { settings: {} } }, /Licence/);
  console.log('Lobbies : un par restaurant, isolés, nouveau lobby = ancien fermé (sans toucher aux autres)');

  // Blocage après 8 mots de passe faux (puis remise à zéro pour les tests suivants par setup-db.sh)
  for (let i = 0; i < 8; i++) await rpc('caisse_admin_login', { p_password: `faux-${i}` });
  const locked = await rpc('caisse_admin_login', { p_password: PASSWORD });
  assert.match(locked.error, /bloqué/);
  console.log('8 mots de passe faux : tableau de bord bloqué 10 minutes (même avec le bon)');
  console.log('erreurs : []');
})().catch((e) => {
  console.error('ÉCHEC', e.message);
  process.exit(1);
});
