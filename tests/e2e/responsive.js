// Vérifie l'affichage sur plusieurs téléphones (iPhone, Android) et une tablette : captures + débordements.
const { chromium, devices } = require('playwright');
const CODES = require('./codes');

const APP = 'http://localhost:8766';
const TARGETS = [
  ['iphone-se-320', devices['iPhone SE']],
  ['galaxy-s8-360', devices['Galaxy S8']],
  ['iphone-13-390', devices['iPhone 13']],
  ['pixel-7-412', devices['Pixel 7']],
  ['ipad-mini-paysage', devices['iPad Mini landscape']],
];

async function overflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const scrollsX = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return true;
      }
      return false;
    };
    const bad = [];
    for (const el of document.querySelectorAll('div, span, img, svg')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > vw + 1 && !scrollsX(el)) {
        bad.push(`${Math.round(r.right - vw)}px « ${(el.textContent || el.tagName).slice(0, 30)} »`);
      }
    }
    return bad.slice(0, 5);
  });
}

(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch();
  const errors = [];
  for (const [name, dev] of TARGETS) {
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('dialog', (d) => d.accept());
    await page.goto(APP);
    const report = [];
    const check = async (label) => {
      const bad = await overflow(page);
      report.push(`${label}: ${bad.length ? 'DÉBORDE ' + bad.join(' | ') : 'ok'}`);
      await page.screenshot({ path: `${out}/${name}-${label}.png` });
    };
    await check('accueil');
    await page.getByLabel('Code d’activation').fill(CODES.admin);
    await page.getByRole('button', { name: 'Activer', exact: true }).click();
    await page.getByRole('button', { name: /^Table 1,/ }).waitFor();
    await page.waitForTimeout(2500); // laisse disparaître la notification
    await check('salle');
    await page.getByRole('button', { name: /^Table 1,/ }).click();
    await page.getByRole('tab', { name: 'Plats' }).click();
    await page.getByRole('button', { name: /^Ajouter Pavé de saumon/ }).click();
    await page.getByRole('button', { name: /^Ajouter Entrecôte frites/ }).click();
    await page.getByRole('button', { name: 'À point', exact: true }).waitFor();
    await check('choix');
    await page.getByRole('button', { name: 'À point', exact: true }).click();
    await page.waitForTimeout(400);
    await check('commande');
    await page.goBack();
    await page.getByText('Gestion', { exact: true }).last().click();
    await page.getByText('Identité & logo').waitFor();
    await page.waitForTimeout(300);
    await check('gestion');
    await page.getByRole('button', { name: 'Équipe' }).first().click();
    await page.getByRole('button', { name: 'Créer un lobby' }).click();
    await check('equipe');
    console.log(`${name.padEnd(18)} ${report.join(' · ')}`);
    await ctx.close();
  }
  console.log('erreurs :', JSON.stringify(errors));
  await browser.close();
})().catch((e) => {
  console.error('ÉCHEC', e.message.split('\n')[0]);
  process.exit(1);
});
