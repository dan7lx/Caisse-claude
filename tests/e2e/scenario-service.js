// Scénario « service » : bandeau d’essai, en-têtes défilants, encaissement (pourboire, monnaie), ticket,
// impression Bluetooth (imprimante simulée) et Wi-Fi Epson (fausse imprimante ePOS), historique par période
// (rapport, export CSV, clôture de minuit), sécurité automatique, codes employés, accès par poste,
// impression automatique des bons en cuisine.
const { chromium, devices } = require('playwright');
const CODES = require('./codes');

const APP = 'http://localhost:8766';
const SERVER = 'http://localhost:8790';
const KEY = 'eyJ-cle-de-test';
const PRINTER = 'http://localhost:8791';

/** Imprimante Bluetooth simulée : Web Bluetooth renvoie une imprimante thermique qui garde les octets reçus. */
function fakeBluetooth() {
  window.__btBytes = [];
  const characteristic = {
    properties: { write: true, writeWithoutResponse: false },
    writeValue: async (data) => {
      window.__btBytes.push(...data);
    },
  };
  const gatt = {
    connected: true,
    connect: async () => gatt,
    getPrimaryService: async (uuid) => {
      if (uuid !== '000018f0-0000-1000-8000-00805f9b34fb') throw new Error('service absent');
      return { getCharacteristics: async () => [characteristic] };
    },
  };
  const bluetooth = { requestDevice: async () => ({ name: 'MPT-II', gatt, addEventListener() {} }) };
  Object.defineProperty(Navigator.prototype, 'bluetooth', { get: () => bluetooth, configurable: true });
}
/** Texte reçu par l'imprimante Bluetooth simulée (ASCII). */
const btText = (page) =>
  page.evaluate(() => window.__btBytes.map((b) => (b === 10 ? '\n' : b >= 32 && b < 127 ? String.fromCharCode(b) : '')).join(''));
const printerJobs = async () => (await fetch(`${PRINTER}/jobs`)).json();

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
  const ctxA = await browser.newContext({ ...opts, acceptDownloads: true });
  await ctxA.addInitScript(fakeBluetooth);
  const a = await ctxA.newPage();
  globalThis.pages.a = a;
  attach(a, 'A', errors);
  await a.clock.setFixedTime(new Date('2026-11-20T21:30:00+01:00'));
  await a.goto(APP);
  await CODES.activateWithKey(a, 'vie');
  await a.getByRole('button', { name: /^Table 1,/ }).click();
  await a.getByRole('tab', { name: 'Plats' }).click();
  await a.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await a.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
  await a.getByRole('button', { name: /^Envoyer \(2\)/ }).last().click();
  await a.getByRole('button', { name: /^Table 1, En cours/ }).click();
  await a.getByRole('button', { name: 'Encaisser', exact: true }).last().click();
  await a.getByText('Pourboire', { exact: true }).waitFor();
  // TVA obligatoire : sans choix, impossible d'encaisser.
  if (!(await a.getByRole('button', { name: 'Choisissez la TVA' }).isDisabled())) throw new Error('encaissement possible sans TVA');
  await a.getByRole('button', { name: 'TVA 12 %', exact: true }).click();
  await a.getByText('38,00 € HT + TVA 12 % : 4,56 €', { exact: false }).waitFor();
  await a.getByRole('button', { name: '10 %', exact: true }).click();
  await a.getByRole('button', { name: 'Espèces', exact: true }).click();
  await a.getByLabel('Espèces reçues').fill('50');
  await a.getByText('À rendre').waitFor();
  await shot(a, 'v4-03-encaissement');
  await a.getByRole('button', { name: /^Encaisser 46,82/ }).click();
  await a.getByText('TICKET DE CAISSE').waitFor();
  await a.getByText(/TVA 12 %\s+4,56 €/).waitFor();
  await a.getByText(/Rendu\s+3,18 €/).waitFor();
  await a.getByRole('button', { name: 'Imprimer', exact: true }).waitFor();
  console.log('Encaissement : TVA 12 % ajoutée (4,56 €), pourboire 4,26 €, monnaie rendue 3,18 €, ticket affiché avec « Imprimer »');
  await a.waitForTimeout(900);
  await shot(a, 'v4-04-ticket');
  await a.getByRole('button', { name: 'Terminer', exact: true }).click();

  await tab(a, 'Gestion').click();
  // Première ouverture de la Gestion : création du code gérant.
  await a.getByText('Créez le code gérant').waitFor();
  await pin(a, '2580', 'Continuer');
  await pin(a, '2580');
  // Imprimante Bluetooth (simulée) : connexion et impression test.
  await a.getByText('Imprimante', { exact: true }).click();
  await a.getByText('🔵 Bluetooth').click();
  await a.getByRole('button', { name: 'Connecter une imprimante' }).click();
  await a.getByText('MPT-II', { exact: true }).waitFor({ timeout: 10000 });
  await a.getByRole('button', { name: 'Impression test' }).click();
  await a.getByText('Ticket envoyé à l’imprimante Bluetooth.').waitFor({ timeout: 10000 });
  if (!/Impression test r.?ussie/.test(await btText(a))) throw new Error('page test non reçue en Bluetooth');
  console.log('Imprimante Bluetooth : connectée (MPT-II), impression test reçue par l’imprimante');
  await shot(a, 'v4-04b-imprimante-bluetooth');
  await a.goBack();

  await a.getByText('Historique & statistiques').click();
  await a.getByText('4,26 €').first().waitFor();
  await a.getByText('TVA collectée').waitFor();
  await a.getByText('Chiffre d’affaires par heure').waitFor();
  await a.getByText(/Meilleur moment · 21 h : 42,56 €/).waitFor();
  console.log('Historique : rapport du jour (TVA, pourboires 4,26 €, CA par heure, meilleur moment 21 h)');
  await shot(a, 'v4-05-historique');
  await a.getByRole('tab', { name: 'Mois' }).click();
  await a.getByText('novembre 2026').waitFor();
  await a.getByText('Chiffre d’affaires par jour').waitFor();
  await a.getByRole('button', { name: 'Période précédente' }).click();
  await a.getByText('octobre 2026').waitFor();
  await a.getByText('Aucune vente sur la période').waitFor();
  await a.getByText('Revenir à aujourd’hui').click();
  await a.getByText('novembre 2026').waitFor();
  await shot(a, 'v4-05b-historique-mois');
  console.log('Historique : vue par mois, navigation vers octobre puis retour');
  // Export CSV pour le comptable
  const download = a.waitForEvent('download');
  await a.getByRole('button', { name: 'Exporter (CSV)' }).click();
  const file = await download;
  const csv = require('fs').readFileSync(await file.path(), 'utf8');
  if (!/Total HT;Taux TVA;TVA;Total TTC/.test(csv) || !/;12 %;4,56;42,56;/.test(csv)) throw new Error('CSV inattendu : ' + csv.slice(0, 300));
  console.log('Export CSV :', file.suggestedFilename(), '(HT, TVA 12 % 4,56 €, TTC 42,56 €)');
  // Rapport imprimé sur l'imprimante Bluetooth
  await a.getByRole('button', { name: 'Voir / imprimer le rapport' }).click();
  await a.getByText('RAPPORT DES VENTES').waitFor();
  await a.getByRole('button', { name: 'Imprimer', exact: true }).last().click();
  await a.getByText(/imprimé/).last().waitFor({ timeout: 10000 });
  if (!/RAPPORT DES VENTES/.test(await btText(a))) throw new Error('rapport non reçu par l’imprimante');
  await a.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  // Ticket d'une commande, réimprimé
  await a.getByRole('tab', { name: /^Tickets/ }).click();
  await a.getByRole('button', { name: /^Ticket Table 1/ }).first().click();
  await a.getByRole('button', { name: 'Imprimer', exact: true }).last().click();
  await a.waitForTimeout(500);
  if (!/TICKET DE CAISSE/.test(await btText(a))) throw new Error('ticket non reçu par l’imprimante');
  await a.getByRole('button', { name: 'Fermer', exact: true }).last().click();
  await a.getByRole('tab', { name: 'Rapport' }).click();
  await a.getByRole('tab', { name: 'Jour' }).click();
  console.log('Impression Bluetooth : rapport et ticket de caisse reçus par l’imprimante');
  // Effacer l'historique : code créateur exigé.
  await a.getByRole('button', { name: 'Effacer l’historique des tickets' }).click();
  await a.getByText('Code créateur', { exact: true }).waitFor();
  await pin(a, '0000');
  await a.getByText('Code créateur incorrect.').waitFor();
  await a.getByRole('button', { name: 'Annuler', exact: true }).last().click();
  console.log('Effacer l’historique : code créateur exigé, mauvais code refusé');
  await a.goBack();

  // Clôture de minuit : on passe au lendemain et on recharge l'application
  await a.clock.setFixedTime(new Date('2026-11-21T00:01:00+01:00'));
  await a.reload();
  await a.getByLabel('Code d’activation').count().then(async (n) => {
    if (n) throw new Error('licence perdue');
  });
  await tab(a, 'Gestion').click();
  // Après rechargement, la session gérant est refermée : le code gérant est redemandé.
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

  // Photo d'un produit depuis la galerie
  await a.getByText('Articles, prix & allergènes').click();
  await a.getByRole('button', { name: 'Modifier Pavé de saumon' }).click();
  const chooser = a.waitForEvent('filechooser');
  await a.getByRole('button', { name: 'Galerie', exact: true }).click();
  await (await chooser).setFiles('docs/captures/salle.png');
  await a.getByLabel('Photo du produit', { exact: true }).waitFor({ timeout: 15000 });
  await shot(a, 'v4-07b-photo-produit');
  await a.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await a.getByLabel('Photo de Pavé de saumon').first().waitFor();
  console.log('Photo de produit : choisie dans la galerie, recadrée et enregistrée');
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

  // Le cuisinier connecte l'imprimante Wi-Fi (Epson ePOS) depuis son écran Cuisine.
  await k.getByRole('button', { name: /^Imprimante :/ }).click();
  await k.getByText('📶 Wi-Fi (Epson)').click();
  await k.getByLabel('Adresse IP de l’imprimante').fill(PRINTER.replace('http://', ''));
  await k.getByRole('button', { name: 'Impression test' }).click();
  await k.getByText('L’imprimante a confirmé l’impression.').last().waitFor({ timeout: 15000 });
  const testJobs = await printerJobs();
  if (!testJobs.some((j) => /Impression test réussie/.test(j) && /é è à ç ù € ô/.test(j))) throw new Error('page test Wi-Fi absente ou accents perdus');
  console.log('Cuisine : imprimante Wi-Fi Epson connectée, impression test confirmée par l’imprimante (accents OK)');
  await shot(k, 'v4-09b-imprimante-wifi');
  await k.goBack();
  await k.getByText(/bons imprimés automatiquement/).waitFor();

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
  await k.getByRole('alert', { name: /Nouvelle commande en cuisine/ }).first().waitFor({ timeout: 15000 });
  console.log('Cuisine : alerte « Nouvelle commande », reçoit le plat, pas la boisson (envoyée au bar)');
  await k.getByText(/Bon imprimé : Table 2/).waitFor({ timeout: 15000 });
  const bons = (await printerJobs()).filter((j) => /CUISINE/.test(j));
  if (bons.length !== 1 || !/Table 2/.test(bons[0]) || !/1 x Pav. de saumon/.test(bons[0]) || /Verre de rouge/.test(bons[0])) {
    throw new Error('bon cuisine imprimé inattendu : ' + JSON.stringify(bons));
  }
  console.log('Cuisine : bon de la table 2 imprimé automatiquement (plat seul, une seule fois)');
  await shot(k, 'v4-10-cuisine-ticket');

  // Fermeture complète de l'application : l'employé sort du lobby, l'écran de paiement revient.
  await k.reload();
  await k.getByText('Activez votre abonnement').waitFor({ timeout: 15000 });
  if (await k.getByText('Pavé de saumon').count()) throw new Error('les données du restaurant sont restées après fermeture');
  console.log('Fermeture complète : employé sorti du lobby, écran de paiement de retour');
  await shot(k, 'v4-10b-employe-ferme');
  // Il rejoint son équipe en un geste : code, prénom et poste déjà remplis.
  await k.getByRole('button', { name: /rejoindre mon équipe/ }).click();
  await k.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
  await k.getByText('Pavé de saumon').first().waitFor({ timeout: 15000 });
  console.log('Retour dans le lobby en un geste (code, prénom et poste mémorisés)');

  // Employé dans le lobby : aucun accès à l'abonnement, même avec le code gérant.
  await tab(k, 'Gestion').click();
  await pin(k, '2580');
  await k.getByText('Identité & logo').waitFor();
  if (await k.getByText('Abonnement', { exact: true }).count()) throw new Error('l’employé voit l’abonnement');
  if (await k.getByText('ESSAI GRATUIT · TEMPS RESTANT').count()) throw new Error('l’employé voit le bandeau d’abonnement');
  console.log('Employé dans le lobby : Gestion sans abonnement');

  // Quitter le lobby (Gestion ouverte) : l'employé ne garde pas l'abonnement du restaurant.
  await k.getByRole('button', { name: /^Lobby / }).filter({ visible: true }).first().click();
  await k.getByRole('button', { name: 'Quitter le lobby' }).click();
  // Hors lobby, ce téléphone d'employé redevient tel qu'à l'origine (sans abonnement propre).
  await k.getByText('Activez votre abonnement').waitFor({ timeout: 10000 });
  await CODES.activateWithKey(k, 'vie');
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
