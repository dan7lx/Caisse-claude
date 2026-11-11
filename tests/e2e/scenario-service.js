// Scénario « service » : bandeau d’essai, en-têtes défilants, encaissement (pourboire, monnaie), ticket, impression,
// historique (pourboires, rapport, clôture de minuit), sécurité automatique, codes employés, accès par poste.
const { chromium, devices } = require('playwright');
const CODES = require('./codes');

const APP = 'http://localhost:8766';
const SERVER = 'http://localhost:8790';
const KEY = 'eyJ-cle-de-test';

function attach(page, name, errors) {
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name}: ${m.text()}`);
  });
  page.on('dialog', (d) => d.accept());
}
async function pin(page, code, submit) {
  for (const k of code) await page.getByRole('button', { name: k, exact: true }).last().click();
  if (submit) await page.getByRole('button', { name: submit, exact: true }).last().click();
}
const tab = (page, name) => page.getByText(name, { exact: true }).last();

(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const errors = [];
  const opts = { ...devices['iPhone 13'], timezoneId: 'Europe/Brussels', locale: 'fr-FR' };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  globalThis.pages = {};

  // ---------- 1. Essai gratuit : bandeau explicite au-dessus des onglets ----------
  const ctxD = await browser.newContext(opts);
  const d = await ctxD.newPage();
  attach(d, 'démo', errors);
  await d.clock.setFixedTime(new Date('2026-11-20T10:00:00+01:00'));
  await d.goto(APP);
  await d.getByRole('button', { name: 'Activer le mode démo' }).click();
  await pin(d, CODES.demo);
  await d.getByText('ESSAI GRATUIT · TEMPS RESTANT').waitFor({ timeout: 10000 });
  await d.getByText('À la fin de l’essai, l’application sera bloquée jusqu’au paiement.').waitFor();
  console.log('Essai : bandeau explicite affiché au-dessus des onglets');
  await d.waitForTimeout(1500);
  await shot(d, 'v4-01-essai');
  await d.mouse.wheel(0, 600);
  await d.waitForTimeout(400);
  await shot(d, 'v4-02-entete-defile');
  console.log('En-tête : défile avec la page');
  await ctxD.close();

  // ---------- 2. Gérant : encaissement, ticket, historique ----------
  const ctxA = await browser.newContext(opts);
  const a = await ctxA.newPage();
  globalThis.pages.a = a;
  attach(a, 'A', errors);
  await a.clock.setFixedTime(new Date('2026-11-20T21:30:00+01:00'));
  await a.goto(APP);
  await a.getByLabel('Code d’activation').fill(CODES.admin);
  await a.getByRole('button', { name: 'Activer', exact: true }).click();
  await a.getByRole('button', { name: /^Table 1,/ }).click();
  await a.getByRole('tab', { name: 'Plats' }).click();
  await a.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await a.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await a.getByRole('button', { name: /^Envoyer \(2\)/ }).last().click();
  await a.getByRole('button', { name: /^Table 1, En cours/ }).click();
  await a.getByRole('button', { name: 'Encaisser', exact: true }).last().click();
  await a.getByText('Pourboire', { exact: true }).waitFor();
  await a.getByRole('button', { name: '10 %', exact: true }).click();
  await a.getByRole('button', { name: 'Espèces', exact: true }).click();
  await a.getByLabel('Espèces reçues').fill('50');
  await a.getByText('À rendre').waitFor();
  await shot(a, 'v4-03-encaissement');
  await a.getByRole('button', { name: /^Encaisser 41,80/ }).click();
  await a.getByText('TICKET DE CAISSE').waitFor();
  console.log('Encaissement : pourboire 10 % (3,80 €), monnaie rendue 8,20 €, ticket de caisse affiché');
  await a.waitForTimeout(900);
  await shot(a, 'v4-04-ticket');
  await a.getByRole('button', { name: 'Imprimer', exact: true }).click();
  await a.getByText('Impression lancée').waitFor();
  console.log('Impression lancée (fenêtre d’impression du téléphone)');
  await a.getByRole('button', { name: 'Terminer', exact: true }).click();

  await tab(a, 'Gestion').click();
  await a.getByText('Historique & statistiques').click();
  await a.getByText('3,80 €').first().waitFor();
  console.log('Historique : pourboire 3,80 € comptabilisé');
  await shot(a, 'v4-05-historique');
  await a.getByRole('button', { name: 'Imprimer le rapport' }).click();
  await a.getByText('RAPPORT DES VENTES').waitFor();
  await shot(a, 'v4-06-rapport');
  await a.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await a.goBack();

  // Clôture de minuit : on passe au lendemain et on recharge l'application
  await a.clock.setFixedTime(new Date('2026-11-21T00:01:00+01:00'));
  await a.reload();
  await a.getByLabel('Code d’activation').count().then(async (n) => {
    if (n) throw new Error('licence perdue');
  });
  await tab(a, 'Gestion').click();
  // Après rechargement, la session gérant est refermée : création du code gérant.
  await a.getByText('Créez le code gérant').waitFor();
  await pin(a, '2580', 'Continuer');
  await pin(a, '2580');
  await a.getByText('CA du jour').waitFor();
  await a.getByText('0,00 €').first().waitFor();
  await a.getByText('Historique & statistiques').click();
  await a.getByRole('tab', { name: 'Clôtures (1)' }).click();
  await a.getByText('Z du 20/11/2026').waitFor();
  console.log('Minuit : journée du 20/11 clôturée automatiquement, chiffre du jour revenu à 0 €');
  await shot(a, 'v4-07-clotures');
  await a.getByText('Z du 20/11/2026').click();
  await a.getByText(/CLÔTURE Z DU 20\/11\/2026/).waitFor();
  await a.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await a.goBack();

  // Identité : N° de TVA
  await a.getByText('Identité & logo').click();
  await a.getByLabel('N° de TVA de l’entreprise').fill('BE 0123.456.789');
  await a.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await a.goBack();

  // Équipe & postes : code personnel du chef
  await a.getByText('Équipe & postes').click();
  await a.getByText('Chef', { exact: true }).waitFor();
  await shot(a, 'v4-08-postes');
  await a.getByRole('button', { name: 'Créer code' }).nth(2).click();
  await pin(a, '5821', 'Valider');
  await a.getByText('Code personnel enregistré pour Chef').waitFor();
  console.log('Code personnel créé pour le chef (poste Cuisine)');
  await a.goBack();

  // Contact WhatsApp
  await a.getByText('Besoin d’aide ? Nous sommes là.').waitFor();
  await a.getByRole('button', { name: 'Écrire sur WhatsApp' }).waitFor();
  console.log('Gestion : carte de contact WhatsApp / téléphone 24h/24');

  // Sécurité automatique
  await a.getByText('Préférences', { exact: true }).click();
  await a.getByRole('button', { name: 'Automatique', exact: true }).click();
  await a.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await a.getByText('Identité & logo').waitFor();
  await tab(a, 'Salle').click();
  await tab(a, 'Gestion').click();
  await a.getByText('Saisissez le code gérant (4 chiffres) pour accéder à la Gestion.').waitFor();
  console.log('Sécurité automatique : en quittant la Gestion, le code gérant est redemandé');
  await pin(a, '2580');
  await a.getByText('Identité & logo').waitFor();

  // Lobby
  await a.getByRole('button', { name: 'Équipe' }).first().click();
  await a.getByRole('button', { name: 'Créer un lobby' }).click();
  await a.getByLabel('Adresse du serveur Supabase').fill(SERVER);
  await a.getByLabel('Clé publique (anon / publishable)').fill(KEY);
  await a.getByRole('button', { name: 'Créer le lobby maintenant' }).click();
  await a.getByText('CODE D’ACCÈS DU LOBBY', { exact: true }).waitFor({ timeout: 15000 });
  const code = (await a.getByText(/^[A-HJ-NP-Z2-9]{6}$/).first().textContent()).trim();
  console.log('Lobby créé :', code);
  await a.goBack();

  // ---------- 3. Cuisine : rejoint, puis se connecte avec son code ----------
  const ctxK = await browser.newContext(opts);
  const k = await ctxK.newPage();
  globalThis.pages.k = k;
  attach(k, 'K', errors);
  await k.clock.setFixedTime(new Date('2026-11-21T00:05:00+01:00'));
  await k.goto(APP);
  await k.getByRole('button', { name: /rejoindre mon équipe/ }).click();
  await k.getByLabel('Code du lobby').fill(code);
  await k.getByLabel('Votre prénom').fill('Tom');
  await k.getByLabel('Adresse du serveur').fill(SERVER);
  await k.getByLabel('Clé publique').fill(KEY);
  await k.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
  await k.getByRole('button', { name: /^Table 1,/ }).waitFor({ timeout: 15000 });
  // Connexion avec le code personnel du chef → poste Cuisine
  await k.getByRole('button', { name: /Changer d’employé/ }).click();
  await pin(k, '5821', 'Valider');
  await k.getByText('Chef · Cuisine').waitFor({ timeout: 10000 });
  const hiddenSalle = await k.getByText('Salle', { exact: true }).count();
  const hiddenBar = await k.getByText('🍸 Bar', { exact: false }).count();
  if (hiddenSalle || hiddenBar) throw new Error('le poste cuisine voit encore la salle ou le bar');
  console.log('Code 5821 : Chef connecté, poste Cuisine uniquement (ni salle, ni bar)');
  await shot(k, 'v4-09-poste-cuisine');

  // La salle envoie un plat et une boisson : la cuisine ne voit que le plat
  await tab(a, 'Salle').click();
  await a.getByRole('button', { name: /^Table 2,/ }).click();
  await a.getByRole('tab', { name: 'Plats' }).click();
  await a.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await a.getByRole('tab', { name: 'Vins & Bières' }).click();
  await a.getByRole('button', { name: /^Ajouter Verre de rouge/ }).click();
  await a.getByRole('button', { name: /^Envoyer \(2\)/ }).last().click();
  await k.getByText('Pavé de saumon').first().waitFor({ timeout: 15000 });
  if (await k.getByText('Verre de rouge').count()) throw new Error('la cuisine voit la boisson du bar');
  console.log('Cuisine : reçoit le plat, pas la boisson (envoyée au bar)');
  await shot(k, 'v4-10-cuisine-ticket');

  // Quitter le lobby : l'application redevient complète
  await k.getByRole('button', { name: /^Lobby / }).first().click();
  await k.getByRole('button', { name: 'Quitter le lobby' }).click();
  // Hors lobby, ce téléphone d'employé redevient tel qu'à l'origine (sans abonnement propre).
  await k.getByText('Activez votre abonnement').waitFor({ timeout: 10000 });
  await k.getByLabel('Code d’activation').fill(CODES.admin);
  await k.getByRole('button', { name: 'Activer', exact: true }).click();
  await k.getByText('Commandes', { exact: true }).last().waitFor({ timeout: 10000 });
  await k.getByText('Salle', { exact: true }).last().waitFor();
  console.log('Lobby quitté : plus de restriction de poste, tous les onglets reviennent');
  await shot(k, 'v4-11-apres-lobby');

  console.log('erreurs :', JSON.stringify(errors));
  await browser.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n')[0], (e.stack || '').split('\n').find((l) => l.includes('scenario-service.js')));
  for (const [n, p] of Object.entries(globalThis.pages || {})) {
    await p.screenshot({ path: `${process.argv[2] || "."}/echec-${n}.png` }).catch(() => {});
  }
  process.exit(1);
});
