/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canCreateLobby, canManage, identifyCode } from '../license/access';
import {
  applyCode,
  formatCountdown,
  isDemoCode,
  extendOneMonth,
  firstOfMonth,
  hashManagerPin,
  isAdminCode,
  licenseStatus,
  makeActivationCode,
  revoke,
} from '../license/license';
import { formatElapsed, formatPrice, parsePrice } from '../utils/format';
import { sha256 } from '../utils/sha256';
import {
  addItem,
  addServer,
  cancelOrder,
  changeQty,
  createOrder,
  deleteCategory,
  moveCategory,
  moveItem,
  payOrder,
  removeIfEmpty,
  removeServer,
  renameServer,
  sendOrder,
  setLinesStatus,
  setManagerPin,
  setSecurity,
} from './actions';
import { createInitialState, migrate, normalize } from './defaults';
import { reduce, reduceAll, type Op } from './ops';
import { kitchenTickets, openOrderForTable, orderTotal, salesStats, tableState } from './selectors';
import type { AppState, License } from './types';

function setup() {
  const base = createInitialState();
  const table = base.tables[0];
  const burger = base.items.find((i) => i.name === 'Burger maison')!;
  const coca = base.items.find((i) => i.name === 'Coca-Cola')!;
  const s = reduce(base, createOrder('o1', table.id, 'Table 1', 'Julie'));
  return { s, table, burger, coca };
}

const order = (s: AppState) => s.orders.find((o) => o.id === 'o1')!;

describe('prise de commande', () => {
  it('ouvre une commande au nom du serveur et occupe la table', () => {
    const { s, table } = setup();
    assert.equal(openOrderForTable(s, table.id)?.id, 'o1');
    assert.equal(order(s).server, 'Julie');
    assert.equal(tableState(order(s)), 'occupee');
  });

  it('refuse une deuxième commande ouverte sur la même table', () => {
    const { s, table } = setup();
    assert.equal(reduce(s, createOrder('o2', table.id, 'Table 1', 'Marc')).orders.length, 1);
  });

  it('regroupe les articles identiques et gère les quantités', () => {
    const { s, burger, coca } = setup();
    const s2 = reduceAll(s, [addItem('o1', burger, 'cuisine'), addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar')]);
    assert.equal(order(s2).lines.length, 2);
    assert.equal(order(s2).lines[0].qty, 2);
    assert.equal(orderTotal(order(s2)), 2 * 1650 + 450);
    const lineId = order(s2).lines[0].id;
    const s3 = reduceAll(s2, [changeQty('o1', lineId, -1), changeQty('o1', lineId, -1)]);
    assert.equal(order(s3).lines.length, 1);
  });

  it('supprime une commande restée vide', () => {
    const { s } = setup();
    assert.equal(reduce(s, removeIfEmpty('o1')).orders.length, 0);
  });
});

describe('cuisine et bar', () => {
  it('envoie vers le bon poste et crée un ticket par envoi', () => {
    const { s, burger, coca } = setup();
    const s2 = reduceAll(s, [addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar'), sendOrder('o1')]);
    assert.ok(order(s2).lines.every((l) => l.status === 'envoye' && l.batch === 1));
    assert.equal(kitchenTickets(s2, 'cuisine').active.length, 1);
    assert.equal(kitchenTickets(s2, 'bar').active.length, 1);
    const s3 = reduceAll(s2, [addItem('o1', burger, 'cuisine'), sendOrder('o1')]);
    assert.equal(kitchenTickets(s3, 'cuisine').active.length, 2);
  });

  it('un ticket prêt quitte la file et signale la table', () => {
    const { s, burger } = setup();
    const s2 = reduceAll(s, [addItem('o1', burger, 'cuisine'), sendOrder('o1')]);
    const ids = order(s2).lines.map((l) => l.id);
    const s3 = reduce(s2, setLinesStatus('o1', ids, 'pret'));
    assert.equal(kitchenTickets(s3, 'cuisine').active.length, 0);
    assert.equal(tableState(order(s3)), 'pret');
    assert.equal(tableState(order(reduce(s3, setLinesStatus('o1', ids, 'servi')))), 'occupee');
  });
});

describe('encaissement', () => {
  it('envoie les lignes restantes, libère la table et compte la vente', () => {
    const { s, table, burger } = setup();
    const s2 = reduceAll(s, [addItem('o1', burger, 'cuisine'), payOrder('o1', 'carte')]);
    assert.equal(order(s2).status, 'payee');
    assert.equal(order(s2).lines[0].status, 'envoye');
    assert.equal(openOrderForTable(s2, table.id), undefined);
    assert.equal(salesStats(s2.orders).byPayment.carte, 1650);
  });

  it('annule : supprime si rien n’est envoyé, sinon garde une trace', () => {
    const { s, burger } = setup();
    assert.equal(reduceAll(s, [addItem('o1', burger, 'cuisine'), cancelOrder('o1')]).orders.length, 0);
    const sent = reduceAll(s, [addItem('o1', burger, 'cuisine'), sendOrder('o1'), cancelOrder('o1')]);
    assert.equal(order(sent).status, 'annulee');
  });
});

describe('synchronisation du lobby', () => {
  it('les opérations sont sérialisables et rejouables à l’identique', () => {
    const { s, burger, coca } = setup();
    const ops: Op[] = [addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar'), sendOrder('o1')];
    const viaJson = JSON.parse(JSON.stringify(ops)) as Op[];
    assert.deepEqual(reduceAll(s, viaJson), reduceAll(s, ops));
  });

  it('deux appareils convergent vers le même état', () => {
    const { s, burger, coca } = setup();
    // Le serveur (A) et la cuisine (B) partent du même instantané.
    const serverOps: Op[] = [addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar'), sendOrder('o1')];
    const log: Op[] = [];
    log.push(...serverOps); // A envoie ses opérations au serveur
    const kitchenView = reduceAll(s, log); // B reçoit le journal
    const burgerLine = order(kitchenView).lines.find((l) => l.station === 'cuisine')!;
    log.push(setLinesStatus('o1', [burgerLine.id], 'pret')); // B marque le plat prêt
    const a = reduceAll(s, log);
    const b = reduceAll(s, log);
    assert.deepEqual(a, b);
    assert.equal(tableState(order(a)), 'pret');
  });

  it('une opération visant une ligne inconnue est sans effet', () => {
    const { s } = setup();
    assert.deepEqual(reduce(s, setLinesStatus('o1', ['inconnue'], 'pret')), s);
  });
});

describe('gestion', () => {
  it('supprime une catégorie avec ses articles et réordonne', () => {
    const s = createInitialState();
    const [a, b] = s.categories;
    assert.equal(reduce(s, deleteCategory(a.id)).items.some((i) => i.categoryId === a.id), false);
    const s2 = reduce(s, moveCategory(b.id, -1));
    assert.deepEqual([s2.categories[0].id, s2.categories[1].id], [b.id, a.id]);
  });

  it('gère la liste des serveurs', () => {
    let s = createInitialState();
    s = reduceAll(s, [addServer('Julie'), addServer('Julie'), renameServer('Serveur 1', 'Marc')]);
    assert.equal(s.servers.filter((n) => n === 'Julie').length, 1);
    assert.ok(s.servers.includes('Marc'));
    s = reduceAll(s, [removeServer('Marc'), removeServer('Julie'), removeServer('Serveur 2')]);
    assert.equal(s.servers.length, 1);
  });
});

describe('codes gérant et administrateur', () => {
  it('reconnaît le code administrateur sans le stocker en clair', () => {
    assert.equal(isAdminCode('197905'), true);
    assert.equal(isAdminCode(' 197905 '), true);
    assert.equal(isAdminCode('197906'), false);
  });

  it('vérifie le code gérant et les droits', () => {
    let s = createInitialState();
    s = reduce(s, setManagerPin(hashManagerPin('4321', s.license.id), 4));
    assert.equal(s.security.managerPinLength, 4);
    assert.equal(identifyCode(s, '4321'), 'manager');
    assert.equal(identifyCode(s, '1234'), null);
    assert.equal(identifyCode(s, '197905'), 'admin');
    const manager = { manager: true, admin: false };
    assert.equal(canManage(s, manager), true);
    assert.equal(canCreateLobby(s, manager), true);
    s = reduce(s, setSecurity({ managerCanManage: false, managerCanCreateLobby: false }));
    assert.equal(canManage(s, manager), false);
    assert.equal(canCreateLobby(s, manager), false);
    assert.equal(canManage(s, { manager: false, admin: true }), true);
  });
});

describe('abonnement', () => {
  const lic = (): License => ({ id: 'K7M2-9QXA', plan: 'aucun', paidUntil: null, activatedAt: null, demoStartedAt: null });
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

  it('bloque sans abonnement', () => {
    assert.equal(licenseStatus(lic(), at(2026, 11, 10)).active, false);
  });

  it('mensuel : actif jusqu’au 1er, rappel 5 jours avant, blocage à l’échéance', () => {
    const l = extendOneMonth(lic(), at(2026, 11, 10)); // paie novembre
    assert.equal(l.paidUntil, firstOfMonth(2026, 11)); // 1er décembre 2026
    assert.equal(licenseStatus(l, at(2026, 11, 25)).inReminderWindow, false);
    const reminder = licenseStatus(l, at(2026, 11, 26, 0));
    assert.equal(reminder.inReminderWindow, true);
    assert.equal(reminder.daysLeft, 5);
    assert.equal(licenseStatus(l, at(2026, 11, 30, 23)).active, true);
    assert.equal(licenseStatus(l, at(2026, 12, 1, 0)).active, false); // bloqué à minuit
  });

  it('prolonger un mois actif repousse l’échéance', () => {
    const l = extendOneMonth(extendOneMonth(lic(), at(2026, 11, 10)), at(2026, 11, 28));
    assert.equal(l.paidUntil, firstOfMonth(2027, 0));
  });

  it('à vie : jamais bloquée ; révoquer bloque', () => {
    const l = applyCode(lic(), '197905');
    assert.equal(l.kind, 'admin');
    assert.equal(licenseStatus(l.kind === 'admin' ? l.license : lic(), at(2040, 1, 1)).active, true);
    assert.equal(licenseStatus(revoke(lic()), at(2026, 11, 10)).active, false);
  });

  it('codes d’activation liés à la licence', () => {
    const code = makeActivationCode('K7M2-9QXA', { plan: 'mensuel', month: '202612' });
    assert.match(code, /^M202612-[A-Z0-9]{6}$/);
    const ok = applyCode(lic(), code.toLowerCase(), at(2026, 12, 3));
    assert.equal(ok.kind, 'activation');
    if (ok.kind === 'activation') assert.equal(ok.license.paidUntil, firstOfMonth(2027, 0));
    const other = applyCode({ ...lic(), id: 'AAAA-BBBB' }, code);
    assert.equal(other.kind, 'invalid');
    const life = applyCode(lic(), makeActivationCode('K7M2-9QXA', { plan: 'vie' }));
    assert.equal(life.kind === 'activation' && life.license.plan, 'vie');
    assert.equal(applyCode(lic(), 'M202613-ABCDEF').kind, 'invalid');
  });
});

describe('mode démo', () => {
  const lic = (): License => ({ id: 'K7M2-9QXA', plan: 'aucun', paidUntil: null, activatedAt: null, demoStartedAt: null });
  const t0 = new Date(2026, 10, 10, 9, 0).getTime();
  const H = 3600_000;

  it('le code 6666 démarre 24 h de démo, puis bloque', () => {
    assert.equal(isDemoCode('6666'), true);
    assert.equal(isDemoCode('6667'), false);
    const r = applyCode(lic(), '6666', t0);
    assert.equal(r.kind, 'demo');
    const l = r.kind === 'demo' ? r.license : lic();
    assert.equal(licenseStatus(l, t0 + 23 * H).active, true);
    assert.equal(licenseStatus(l, t0 + 23 * H).demo, true);
    assert.equal(licenseStatus(l, t0 + 24 * H).active, false);
    assert.equal(licenseStatus(l, t0 + 24 * H).demoUsed, true);
  });

  it('la démo ne peut être utilisée qu’une fois', () => {
    const r = applyCode(lic(), '6666', t0);
    const l = r.kind === 'demo' ? r.license : lic();
    assert.equal(applyCode(l, '6666', t0 + 30 * H).kind, 'invalid');
  });

  it('un paiement pendant la démo prend le relais', () => {
    const r = applyCode(lic(), '6666', t0);
    const demo = r.kind === 'demo' ? r.license : lic();
    const paid = applyCode(demo, makeActivationCode('K7M2-9QXA', { plan: 'vie' }), t0 + H);
    assert.equal(paid.kind === 'activation' && licenseStatus(paid.license, t0 + 48 * H).active, true);
    assert.equal(paid.kind === 'activation' && licenseStatus(paid.license, t0 + 2 * H).demo, false);
  });

  it('affiche le minuteur', () => {
    assert.equal(formatCountdown(24 * H), '24:00:00');
    assert.equal(formatCountdown(65_000), '00:01:05');
  });
});

describe('carte complète', () => {
  it('ajoute un article avec un choix et regroupe les choix identiques', () => {
    const { s } = setup();
    const entrecote = s.items.find((i) => i.name === 'Entrecôte frites')!;
    assert.ok(entrecote.choices.includes('Saignant'));
    const s2 = reduceAll(s, [
      addItem('o1', entrecote, 'cuisine', 'Saignant'),
      addItem('o1', entrecote, 'cuisine', 'Saignant'),
      addItem('o1', entrecote, 'cuisine', 'À point'),
    ]);
    assert.deepEqual(
      order(s2).lines.map((l) => [l.note, l.qty]),
      [
        ['Saignant', 2],
        ['À point', 1],
      ],
    );
  });

  it('réordonne un article à l’intérieur de sa catégorie', () => {
    const s = createInitialState();
    const plats = s.items.filter((i) => i.categoryId === s.categories[1].id);
    const s2 = reduce(s, moveItem(plats[1].id, -1));
    const after = s2.items.filter((i) => i.categoryId === s.categories[1].id);
    assert.deepEqual([after[0].id, after[1].id], [plats[1].id, plats[0].id]);
    // Le premier article ne peut pas monter dans la catégorie précédente.
    assert.equal(reduce(s, moveItem(plats[0].id, -1)), s);
  });

  it('complète les données d’une version précédente', () => {
    const old = createInitialState() as unknown as Record<string, unknown>;
    const cats = (old.categories as Record<string, unknown>[]).map(({ emoji: _e, ...c }) => c);
    const items = (old.items as Record<string, unknown>[]).map(({ emoji: _e, choices: _c, allergens: _a, ...i }) => i);
    const n = normalize({ ...old, categories: cats, items, billing: undefined } as unknown as AppState);
    assert.equal(n.categories[0].emoji, '🥗');
    assert.deepEqual(n.items[0].choices, []);
    assert.equal(n.billing.iban, 'BE71650156242169');
    assert.equal(n.settings.autoLockMinutes, 10);
  });
});

describe('migration et utilitaires', () => {
  it('reprend les données de la première version', () => {
    const v1 = {
      version: 1,
      settings: { restaurantName: 'Chez Paul', currency: '€', taxRate: 10, alertMinutes: 15, currentServer: 'Paul' },
      servers: ['Paul'],
      tables: [],
      categories: [],
      items: [],
      orders: [],
      orderCounter: 7,
    };
    const m = migrate(v1)!;
    assert.equal(m.state.version, 2);
    assert.equal(m.state.settings.restaurantName, 'Chez Paul');
    assert.equal(m.state.orderCounter, 7);
    assert.equal(m.currentServer, 'Paul');
    assert.equal(m.state.license.plan, 'aucun');
  });

  it('SHA-256 conforme', () => {
    assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('formate prix et durées', () => {
    assert.equal(formatPrice(4599), '45,99 €');
    assert.equal(parsePrice('12,5'), 1250);
    assert.equal(parsePrice('abc'), null);
    assert.equal(formatElapsed(65 * 60000), '1 h 05');
  });
});
