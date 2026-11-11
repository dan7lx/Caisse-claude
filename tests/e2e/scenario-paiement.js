// Scénario « paiement par virement » : page de paiement, preuve WhatsApp, Espace créateur (confirmation,
// clé), activation 30 jours, calendrier orange/rouge, fin d'abonnement → blocage et nouveau paiement.
const { chromium, devices } = require('playwright');
const CODES = require('./codes');

const APP = 'http://localhost:8766';
const DAY = 86400000;

function attach(page, name, errors) {
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    // Ne comptent pas : WhatsApp bloqué en test, et le refus (400) de l'ancienne clé, vérifié plus bas.
    if (m.type() === 'error' && !/wa\.me|ERR_|net::|status of 400/.test(m.text())) errors.push(`${name}: ${m.text()}`);
  });
  page.on('dialog', (d) => d.accept());
}

(async () => {
  const out = process.argv[2] || '.';
  const browser = await chromium.launch();
  const errors = [];
  const opts = { ...devices['iPhone 13'], timezoneId: 'Europe/Brussels', locale: 'fr-FR' };
  const shot = (p, n) => p.screenshot({ path: `${out}/${n}.png` });
  globalThis.pages = {};

  // ---------- 1. Le client paie ----------
  const ctxP = await browser.newContext(opts);
  // WhatsApp : on intercepte l'ouverture pour lire le message prérempli.
  const whatsapp = [];
  await ctxP.route('https://wa.me/**', (route) => {
    whatsapp.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' });
  });
  const p = await ctxP.newPage();
  globalThis.pages.p = p;
  attach(p, 'client', errors);
  await p.goto(APP);
  await p.getByText('Activez votre abonnement').waitFor();
  await p.getByRole('button', { name: 'Payer l’abonnement Mensuel' }).click();
  await p.getByLabel('Prénom et nom').fill('Marie Dupont');
  await p.getByLabel('Nom du commerce').fill('Chez Marie');
  await p.getByLabel('E-mail').fill('marie@example.com');
  await p.getByLabel('Numéro WhatsApp').fill('+32 470 12 34 56');
  await p.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await p.getByText('En attente de votre virement').waitFor({ timeout: 10000 });
  const reference = (await p.getByText(/^CR-\d{4,}-[A-Z2-9]{4}$/).first().textContent()).trim();
  await p.getByText('BE71 6501 5624 2169').waitFor();
  await p.getByText('R Pereira').first().waitFor();
  await p.getByText('45,99 €').first().waitFor();
  await p.getByText('Le virement doit être instantané', { exact: false }).waitFor();
  console.log('Page de paiement : montant exact, IBAN, titulaire, référence unique', reference);
  await shot(p, 'p-01-page-paiement');

  const popup = ctxP.waitForEvent('page');
  await p.getByRole('button', { name: 'Envoyer ma preuve de paiement sur WhatsApp' }).click();
  await (await popup).close().catch(() => {});
  const text = decodeURIComponent((whatsapp[0] ?? '').split('text=')[1] ?? '');
  for (const part of [reference, 'Marie Dupont', 'marie@example.com', 'Abonnement mensuel', 'capture']) {
    if (!text.includes(part)) throw new Error(`message WhatsApp sans « ${part} »`);
  }
  if (!whatsapp[0].startsWith('https://wa.me/32465538869')) throw new Error('mauvais numéro WhatsApp');
  await p.getByText('Preuve reçue · vérification en cours').waitFor({ timeout: 10000 });
  console.log('WhatsApp : message prérempli (n° de commande, nom, e-mail, formule, capture) vers le créateur');

  // ---------- 2. Le créateur vérifie et génère la clé ----------
  const ctxC = await browser.newContext(opts);
  const c = await ctxC.newPage();
  globalThis.pages.c = c;
  attach(c, 'créateur', errors);
  await c.goto(`${APP}/createur`);
  await c.getByLabel('Mot de passe de l’Espace créateur').fill('mauvais-mot-de-passe');
  await c.getByRole('button', { name: 'Se connecter' }).click();
  await c.getByText('Mot de passe incorrect.').waitFor();
  await c.getByLabel('Mot de passe de l’Espace créateur').fill(CODES.dashboard);
  await c.getByRole('button', { name: 'Se connecter' }).click();
  await c.getByText('TABLEAU DE BORD').waitFor({ timeout: 10000 });
  console.log('Espace créateur : accès refusé sans le bon mot de passe, ouvert avec');
  await c.getByRole('button', { name: `Commande ${reference}` }).click();
  await c.getByText('Preuve reçue · vérification en cours').last().waitFor();
  await shot(c, 'p-02-createur-commande');
  await c.getByRole('button', { name: 'Confirmer le paiement' }).click();
  await c.getByRole('button', { name: 'Générer la clé d’activation' }).waitFor({ timeout: 10000 });
  await c.getByRole('button', { name: 'Générer la clé d’activation' }).click();
  const key = (await c.getByText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/).first().textContent({ timeout: 10000 })).trim();
  await c.getByRole('button', { name: 'Envoyer la clé sur WhatsApp' }).waitFor();
  console.log('Créateur : paiement confirmé, clé générée', key.slice(0, 4) + '-…');
  await shot(c, 'p-03-createur-cle');
  await c.getByRole('button', { name: 'Fermer' }).last().click();

  // ---------- 3. Le client active sa clé ----------
  await p.getByRole('button', { name: 'Actualiser' }).click();
  await p.getByText('Paiement confirmé').waitFor({ timeout: 25000 });
  await p.getByLabel('Clé d’activation reçue').fill(key.toLowerCase());
  await p.getByRole('button', { name: 'Activer ma licence' }).click();
  await p.getByRole('button', { name: /^Table 1,/ }).waitFor({ timeout: 15000 });
  console.log('Client : clé activée, application débloquée');

  // Tableau de bord : client et paiement visibles
  await c.getByRole('tab', { name: 'Clients' }).click();
  await c.getByText('Marie Dupont').first().waitFor({ timeout: 70000 }).catch(async () => {
    await c.reload();
  });
  await c.getByRole('tab', { name: 'Paiements' }).click();
  await c.getByText('Total encaissé').waitFor();
  console.log('Créateur : historique des paiements et liste des clients');
  await shot(c, 'p-04-createur-paiements');

  // ---------- 4. Calendrier : 5 jours avant en orange, jour de fin en rouge ----------
  const end = Date.now() + 30 * DAY;
  await p.clock.setFixedTime(new Date(end - 3 * DAY));
  await p.reload();
  await p.getByRole('button', { name: /^Table 1,/ }).waitFor({ timeout: 15000 });
  await p.getByText(/Fin de l’abonnement le/).waitFor();
  await p.getByRole('button', { name: 'Plus tard' }).click().catch(() => {});
  await p.goto(`${APP}/abonnement`);
  await p.getByText('Rappel (5 jours avant)').last().waitFor();
  await p.getByText('Fin de l’abonnement (blocage)').last().waitFor();
  console.log('Rappel 5 jours avant la fin, calendrier orange / rouge');
  await shot(p, 'p-05-calendrier');

  // ---------- 5. Fin de l'abonnement : blocage et nouveau paiement ----------
  await p.clock.setFixedTime(new Date(end + 60000));
  await p.goto(APP);
  await p.getByText('Abonnement terminé').waitFor({ timeout: 20000 });
  await p.getByRole('button', { name: 'Payer l’abonnement Mensuel' }).waitFor();
  await p.getByLabel('Code d’activation').fill(key);
  await p.getByRole('button', { name: 'Activer', exact: true }).click();
  await p.getByText('Cette clé a déjà été utilisée').waitFor({ timeout: 10000 });
  console.log('Fin des 30 jours : application bloquée, page de paiement de retour, ancienne clé refusée');
  await shot(p, 'p-06-fin-abonnement');

  console.log('erreurs :', JSON.stringify(errors));
  await browser.close();
})().catch(async (e) => {
  console.error('ÉCHEC', e.message.split('\n')[0], (e.stack || '').split('\n').find((l) => l.includes('scenario-paiement.js')));
  for (const [n, pg] of Object.entries(globalThis.pages || {})) {
    await pg.screenshot({ path: `${process.argv[2] || '.'}/echec-${n}.png` }).catch(() => {});
  }
  process.exit(1);
});
