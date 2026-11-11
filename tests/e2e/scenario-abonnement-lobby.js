// Scénario « abonnement + lobby » : mode démo, paiement par virement, code gérant, lobby créer/rejoindre, cuisson, cuisine.
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
  for (const k of code) await page.getByRole('button', { name: k, exact: true }).click();
  if (submit) await page.getByRole('button', { name: submit, exact: true }).click();
}

(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const errors = [];
  const opts = { ...devices['iPhone 13'], timezoneId: 'Europe/Paris', locale: 'fr-FR' };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });

  // ---------- 1. Mode démo ----------
  const ctxD = await browser.newContext(opts);
  const d = await ctxD.newPage();
  attach(d, 'démo', errors);
  await d.clock.setFixedTime(new Date('2026-11-20T10:00:00+01:00'));
  await d.goto(APP);
  await d.getByText('Activez votre abonnement').waitFor();
  await shot(d, 'v3-01-accueil');
  await d.getByRole('button', { name: 'Payer l’abonnement Mensuel' }).click();
  await d.getByText('BE71 6501 5624 2169').waitFor();
  await d.getByText('R Pereira').waitFor();
  await d.getByText('Le paiement doit être effectué par virement instantané', { exact: false }).waitFor();
  console.log('Paiement : montant, IBAN BE71 6501 5624 2169, R Pereira et mention « virement instantané » affichés');
  await shot(d, 'v3-02-paiement');
  await d.getByRole('button', { name: 'Fermer' }).click();
  await d.getByRole('button', { name: 'Activer le mode démo' }).click();
  await pin(d, CODES.demo);
  await d.getByRole('button', { name: /^Table 1,/ }).waitFor({ timeout: 10000 });
  await d.getByText('ESSAI GRATUIT · TEMPS RESTANT').waitFor();
  console.log('Code démo : mode démo activé, minuteur affiché');
  await shot(d, 'v3-03-demo-salle');
  await d.clock.setFixedTime(new Date('2026-11-21T10:00:05+01:00'));
  await d.getByText('Fin du mode démo').waitFor({ timeout: 25000 });
  console.log('24 h plus tard : application bloquée, paiement demandé');
  await shot(d, 'v3-04-demo-fin');
  await d.getByRole('button', { name: 'Activer le mode démo' }).count().then((n) => {
    if (n) throw new Error('le bouton de démo ne devrait plus être proposé');
  });
  console.log('La démo ne peut pas être relancée');
  await ctxD.close();

  // ---------- 2. Gérant : admin, code gérant, lobby ----------
  const ctxA = await browser.newContext(opts);
  const a = await ctxA.newPage();
  attach(a, 'A', errors);
  await a.goto(APP);
  await a.getByLabel('Code d’activation').fill(CODES.admin);
  await a.getByRole('button', { name: 'Activer', exact: true }).click();
  await a.getByRole('button', { name: /^Table 1,/ }).waitFor();
  await a.getByText('Gestion', { exact: true }).last().click();
  await a.getByText('Identité & logo').waitFor();
  await shot(a, 'v3-05-gestion');
  await a.getByRole('button', { name: 'Verrouiller' }).click();
  await a.getByText('Créez le code gérant').waitFor();
  await pin(a, '2580', 'Continuer');
  await pin(a, '2580'); // confirmation : validation automatique au 4e chiffre
  await a.getByText('Identité & logo').waitFor();
  await a.getByRole('button', { name: 'Verrouiller' }).click();
  await pin(a, '2580'); // ouverture automatique au dernier chiffre
  await a.getByText('Identité & logo').waitFor();
  console.log('Code gérant à 4 chiffres : ouverture automatique sans appuyer sur ✓');

  // Changement de code : l'ancien code est demandé
  await a.getByText('Code gérant', { exact: true }).click();
  await a.getByText('Code actuel').waitFor();
  await pin(a, '2580');
  await a.getByText('Nouveau code gérant').waitFor();
  await pin(a, '1234', 'Continuer');
  await a.getByText('Code trop simple', { exact: false }).waitFor();
  await pin(a, '4826', 'Continuer');
  await pin(a, '4826');
  await a.getByText('Nouveau code gérant enregistré').waitFor();
  console.log('Changement de code : ancien code demandé, code trop simple refusé');

  // Blocage après 5 erreurs
  await a.getByRole('button', { name: 'Verrouiller' }).click();
  for (let i = 0; i < 5; i++) await pin(a, '1111', 'Valider');
  await a.getByText(/Trop d’essais/).waitFor();
  console.log('5 codes faux : saisie bloquée temporairement');
  await shot(a, 'v3-06-trop-essais');

  // Lobby : créer (depuis la Salle)
  await a.getByText('Salle', { exact: true }).last().click();
  await a.getByRole('button', { name: 'Équipe' }).first().click();
  await a.getByRole('button', { name: 'Créer un lobby' }).click();
  await shot(a, 'v3-07-creer-ou-rejoindre');
  await a.getByRole('button', { name: 'Saisir le code gérant' }).count().then(async (n) => {
    if (n) {
      // la session gérant a été verrouillée : le code admin passe outre le blocage du gérant
      await a.getByRole('button', { name: 'Saisir le code gérant' }).click();
      await a.getByText(/Trop d’essais/).last().waitFor();
      await a.getByRole('button', { name: 'Annuler' }).click();
    }
  });
  console.log('Création du lobby protégée par le code gérant (bloqué pendant le délai)');
  await ctxA.close();

  // ---------- 3. Lobby complet avec un nouvel appareil gérant ----------
  const ctxM = await browser.newContext(opts);
  const m = await ctxM.newPage();
  globalThis.pages = { m };
  attach(m, 'M', errors);
  await m.goto(APP);
  await m.getByLabel('Code d’activation').fill(CODES.admin);
  await m.getByRole('button', { name: 'Activer', exact: true }).click();
  await m.getByRole('button', { name: 'Équipe' }).first().click();
  await m.getByRole('button', { name: 'Créer un lobby' }).click();
  await m.getByLabel('Adresse du serveur Supabase').fill(SERVER);
  await m.getByLabel('Clé publique (anon / publishable)').fill(KEY);
  await m.getByRole('button', { name: 'Créer le lobby maintenant' }).click();
  await m.getByText('CODE D’ACCÈS DU LOBBY', { exact: true }).waitFor({ timeout: 15000 });
  const code = (await m.getByText(/^[A-HJ-NP-Z2-9]{6}$/).first().textContent()).trim();
  console.log('Lobby créé en un geste, code', code, '+ QR code');
  await m.getByText(/Synchronisé/).waitFor({ timeout: 15000 });
  await shot(m, 'v3-08-lobby-qr');

  const ctxK = await browser.newContext(opts);
  const k = await ctxK.newPage();
  globalThis.pages.k = k;
  attach(k, 'K', errors);
  await k.goto(APP);
  await k.getByRole('button', { name: /rejoindre mon équipe/ }).click();
  await k.getByLabel('Code du lobby').fill(code);
  await k.getByLabel('Votre prénom').fill('Julie');
  await k.getByRole('tab', { name: /Cuisine/ }).click();
  await k.getByLabel('Adresse du serveur').fill(SERVER);
  await k.getByLabel('Clé publique').fill(KEY);
  await shot(k, 'v3-09-rejoindre');
  await k.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
  await k.getByText('Aucun ticket en attente').waitFor({ timeout: 15000 });
  console.log('Cuisine : a rejoint avec le code en 6 cases');

  // Commande avec choix de cuisson
  await m.goBack();
  await m.getByText('Salle', { exact: true }).last().click();
  await m.getByRole('button', { name: /^Table 1,/ }).click();
  await m.getByRole('tab', { name: 'Plats' }).click();
  await m.getByRole('button', { name: /^Ajouter Entrecôte frites/ }).click();
  await m.getByText('Allergènes', { exact: false }).count();
  await shot(m, 'v3-10-choix-cuisson');
  await m.getByRole('button', { name: 'Saignant', exact: true }).click();
  await m.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await shot(m, 'v3-11-commande');
  await m.getByRole('button', { name: /^Envoyer \(2\)/ }).last().click();
  await m.getByText('Envoyé en cuisine').waitFor();
  console.log('Commande envoyée, notification « Envoyé en cuisine »');
  await m.getByRole('button', { name: /^Table 1, En cours/ }).waitFor({ timeout: 10000 });

  await k.getByText('Saignant', { exact: false }).first().waitFor({ timeout: 15000 });
  console.log('Cuisine : ticket reçu avec la cuisson « Saignant »');
  await shot(k, 'v3-12-cuisine');
  await k.getByRole('button', { name: 'Prêt' }).first().click();
  await m.getByRole('button', { name: /^Table 1, Prêt à servir/ }).waitFor({ timeout: 15000 });
  console.log('Salle : table 1 prête à servir');
  await shot(m, 'v3-13-salle');

  console.log('erreurs :', JSON.stringify(errors));
  await browser.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n')[0], (e.stack || '').split('\n').find((l) => l.includes('scenario-abonnement-lobby.js')));
  for (const [n, p] of Object.entries(globalThis.pages || {})) await p.screenshot({ path: `${process.argv[2] || "."}/echec-${n}.png` }).catch(() => {});
  process.exit(1);
});
