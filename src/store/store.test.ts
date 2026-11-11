/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canCreateLobby, canManage, hashStaffPin, identifyCode, identifyStaff } from '../license/access';
import { dashboardStats, licenseHealth, ordersToProcess } from '../license/dashboard';
import { applyCode, formatCountdown, hashManagerPin, isAdminCode, isCreatorCode, isDemoCode, licenseStatus } from '../license/license';
import {
  applyRedeem,
  FALLBACK_BILLING,
  keyWhatsAppLink,
  normalizeKey,
  type PaymentOrder,
  proofWhatsAppLink,
  type ServerLicense,
  syncFromServer,
} from '../license/server';
import { formatElapsed, formatPrice, parsePrice } from '../utils/format';
import { sha256 } from '../utils/sha256';
import {
  addItem,
  addServer,
  cancelOrder,
  changeQty,
  createOrder,
  deleteCategory,
  closeDay,
  moveCategory,
  moveItem,
  moveOrderTable,
  setStaff,
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
import { closureDoc, receiptDoc } from '../ticket/doc';
import { cleanText, formatRow } from '../ticket/layout';
import {
  buildClosure,
  dayKey,
  daysToClose,
  kitchenTickets,
  openOrderForTable,
  orderDiscount,
  orderSubtotal,
  orderNet,
  orderTotal,
  orderVat,
  salesStats,
  tableState,
} from './selectors';
import type { AppState, License } from './types';

/** Texte brut d'un ticket, pour les vérifications. */
function docText(doc: { lines: ({ k: string; text?: string; left?: string; right?: string })[] }): string {
  return doc.lines.map((l) => (l.text !== undefined ? l.text : l.left !== undefined ? `${l.left} ${l.right}` : '')).join('\n');
}

function setup() {
  const base = createInitialState();
  const table = base.tables[0];
  const burger = base.items.find((i) => i.name === 'Burger maison')!;
  const coca = base.items.find((i) => i.name === 'Coca-Cola')!;
  const s = reduce(base, createOrder('o1', table.id, 'Table 1', 'Julie'));
  return { s, table, burger, coca };
}

const order = (s: AppState) => s.orders.find((o) => o.id === 'o1')!;
const DAY = 86_400_000;

/** Commande de paiement type, pour les tests du paiement par virement. */
const ORDER: PaymentOrder = {
  id: 'ord-1', number: 7, reference: 'CR-0007-K7PQ', license_id: 'K7M2-9QXA', plan: 'mensuel', amount: 4599,
  customer_name: 'Marie Dupont', restaurant_name: 'Chez Marie', email: 'marie@example.com', phone: '+32 470 12 34 56',
  status: 'en_attente', admin_note: '', created_at: '2026-11-20T10:00:00.000Z', proof_sent_at: null, confirmed_at: null,
  closed_at: null, key_hint: null, key_created_at: null, key_redeemed_at: null,
};

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

  it('gère l’équipe et les postes', () => {
    let s = createInitialState();
    const names = () => s.staff.map((m) => m.name);
    s = reduceAll(s, [addServer('Julie', 'bar'), addServer('Julie'), renameServer('Serveur 1', 'Marc')]);
    assert.equal(names().filter((n) => n === 'Julie').length, 1);
    assert.equal(s.staff.find((m) => m.name === 'Julie')?.role, 'bar');
    assert.ok(names().includes('Marc'));
    s = reduceAll(s, ['Marc', 'Julie', 'Serveur 2', 'Chef', 'Barman'].map((n) => removeServer(n)));
    assert.equal(s.staff.length, 1);
  });

  it('code personnel : identifie l’employé et son poste', () => {
    let s = createInitialState();
    const chef = s.staff.find((m) => m.role === 'cuisine')!;
    s = reduce(s, setStaff({ ...chef, pinHash: hashStaffPin('5821', s.license.id), pinLength: 4 }));
    assert.equal(identifyStaff(s, '5821')?.name, 'Chef');
    assert.equal(identifyStaff(s, '5821')?.role, 'cuisine');
    assert.equal(identifyStaff(s, '0000'), undefined);
  });

  it('reprend l’ancienne liste de serveurs', () => {
    const old = { ...createInitialState(), servers: ['Paul', 'Léa'] } as unknown as Record<string, unknown>;
    delete old.staff;
    const n = normalize(old as unknown as AppState);
    assert.deepEqual(n.staff.map((m) => [m.name, m.role]), [['Paul', 'serveur'], ['Léa', 'serveur']]);
  });

  it('change une commande de table, sauf vers une table occupée', () => {
    const { s, table } = setup();
    const [, t2, t3] = s.tables;
    const moved = reduce(s, moveOrderTable('o1', t2.id, 'Table 2'));
    assert.equal(order(moved).tableId, t2.id);
    assert.equal(openOrderForTable(moved, table.id), undefined);
    const busy = reduceAll(moved, [createOrder('o2', t3.id, 'Table 3', 'Marc'), moveOrderTable('o1', t3.id, 'Table 3')]);
    assert.equal(order(busy).tableId, t2.id);
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

  it('mensuel : 30 jours dès l’activation, rappel 5 jours avant, blocage à la fin', () => {
    const t = at(2026, 11, 10, 14);
    const l = applyRedeem(lic(), { plan: 'mensuel', valid_until: t + 30 * DAY }, t);
    assert.equal(l.paidUntil, t + 30 * DAY);
    assert.equal(licenseStatus(l, t + 24 * DAY).inReminderWindow, false);
    const reminder = licenseStatus(l, t + 25 * DAY);
    assert.equal(reminder.inReminderWindow, true);
    assert.equal(reminder.daysLeft, 5);
    assert.equal(licenseStatus(l, t + 30 * DAY - 1000).active, true);
    assert.equal(licenseStatus(l, t + 30 * DAY).active, false); // bloqué à la seconde près
  });

  it('à vie : jamais bloquée', () => {
    const l = applyRedeem(lic(), { plan: 'vie', valid_until: null });
    assert.equal(licenseStatus(l, at(2040, 1, 1)).active, true);
  });

  it('les anciens codes n’activent plus rien, seules les clés du serveur sont reconnues', () => {
    assert.equal(applyCode(lic(), 'M202612-3FA9C1').kind, 'invalid');
    assert.equal(applyCode(lic(), 'VIE-81B0D2').kind, 'invalid');
    const k = applyCode(lic(), ' abcd efgh jkmn pq23 ');
    assert.deepEqual(k, { kind: 'key', key: 'ABCD-EFGH-JKMN-PQ23' });
    assert.equal(normalizeKey('ABCD-EFGH-JKMN-PQ2'), null);
    assert.equal(normalizeKey('ABCD-EFGH-JKMN-PQ20'), null); // « 0 » n'existe pas dans les clés
  });

  it('le serveur fait foi : révocation, renouvellement, licence inconnue', () => {
    const active = applyRedeem(lic(), { plan: 'mensuel', valid_until: at(2026, 12, 10) });
    assert.equal(syncFromServer(active, { found: false }), null);
    assert.equal(syncFromServer(active, { found: true, plan: 'mensuel', valid_until: at(2026, 12, 10) }), null);
    assert.equal(syncFromServer(active, { found: true, plan: 'mensuel', valid_until: at(2027, 1, 9) })?.paidUntil, at(2027, 1, 9));
    const revoked = syncFromServer(active, { found: true, plan: 'aucun', valid_until: null });
    assert.equal(revoked && licenseStatus(revoked, at(2026, 11, 20)).active, false);
    assert.equal(syncFromServer(active, { found: true, plan: 'vie', valid_until: null })?.plan, 'vie');
  });

  it('message WhatsApp de preuve : commande, nom, e-mail, formule, capture', () => {
    const link = proofWhatsAppLink(FALLBACK_BILLING, ORDER, (c) => formatPrice(c));
    assert.ok(link.startsWith(`https://wa.me/${FALLBACK_BILLING.whatsapp}?text=`));
    const text = decodeURIComponent(link.split('?text=')[1]);
    for (const part of ['Commande n° 7', 'CR-0007-K7PQ', 'Marie Dupont', 'marie@example.com', 'Abonnement mensuel', '45,99', 'capture']) {
      assert.ok(text.includes(part), part);
    }
    const keyText = decodeURIComponent(keyWhatsAppLink(ORDER, 'ABCD-EFGH-JKMN-PQ23').split('?text=')[1]);
    assert.ok(keyText.includes('ABCD-EFGH-JKMN-PQ23'));
    assert.ok(keyWhatsAppLink(ORDER, 'X').startsWith('https://wa.me/32470123456?'));
  });

  it('tableau de bord : à traiter, santé des licences, chiffres', () => {
    const now = at(2026, 11, 20);
    const iso = (t: number) => new Date(t).toISOString();
    const o = (id: string, status: PaymentOrder['status'], extra: Partial<PaymentOrder> = {}): PaymentOrder => ({
      ...ORDER,
      id,
      status,
      created_at: iso(now - 3600000),
      ...extra,
    });
    const orders = [
      o('attente', 'en_attente'),
      o('preuve', 'preuve_envoyee'),
      o('generer', 'confirmee', { confirmed_at: iso(now) }),
      o('fini', 'confirmee', { confirmed_at: iso(at(2026, 10, 3)), key_created_at: iso(now), key_redeemed_at: iso(now) }),
      o('refus', 'refusee'),
    ];
    assert.deepEqual(ordersToProcess(orders).map((x) => x.id), ['preuve', 'generer', 'attente']);
    const L = (id: string, plan: ServerLicense['plan'], until: number | null, revoked = false): ServerLicense => ({
      license_id: id, plan, valid_until: until, revoked, customer_name: id, restaurant_name: '', email: '', phone: '',
      activations: 1, created_at: iso(now), updated_at: iso(now),
    });
    const licenses = [L('a', 'vie', null), L('b', 'mensuel', now + 20 * DAY), L('c', 'mensuel', now + 3 * DAY), L('d', 'mensuel', now - DAY), L('e', 'mensuel', now + 9 * DAY, true)];
    assert.deepEqual(licenses.map((l) => licenseHealth(l, now)), ['vie', 'active', 'bientot', 'expiree', 'revoquee']);
    const st = dashboardStats({ orders, licenses, billing: FALLBACK_BILLING, now });
    assert.equal(st.toProcess, 3);
    assert.equal(st.proofs, 1);
    assert.equal(st.activeLicenses, 3);
    assert.equal(st.endingSoon, 1);
    assert.equal(st.expired, 1);
    assert.equal(st.revenueThisMonth, 4599);
    assert.equal(st.revenueTotal, 9198);
  });
});

describe('code créateur', () => {
  it('protège la suppression des données : refuse les mauvais codes', () => {
    for (const c of ['0000', '1234', '9999', '']) assert.equal(isCreatorCode(c), false);
    // Le vrai code n'est jamais écrit dans le dépôt : vérifié seulement s'il est fourni.
    if (process.env.CAISSE_CREATOR_CODE) assert.equal(isCreatorCode(process.env.CAISSE_CREATOR_CODE), true);
  });
});

describe('encaissement : remise, pourboire, monnaie', () => {
  it('applique la remise, enregistre le pourboire et les espèces reçues', () => {
    const { s, burger } = setup();
    const s2 = reduceAll(s, [
      addItem('o1', burger, 'cuisine'),
      addItem('o1', burger, 'cuisine'),
      payOrder('o1', 'especes', { discountPct: 10, tip: 200, cashReceived: 5000 }),
    ]);
    const o = order(s2);
    assert.equal(orderSubtotal(o), 3300);
    assert.equal(orderDiscount(o), 330);
    assert.equal(orderTotal(o), 2970);
    const st = salesStats(s2.orders);
    assert.equal(st.revenue, 2970);
    assert.equal(st.tips, 200);
    assert.equal(st.discounts, 330);
    assert.equal(st.byPayment.especes, 3170); // encaissé = total + pourboire
  });

  it('affiche un ticket de caisse complet (ancienne commande, TVA incluse)', () => {
    const { s, burger } = setup();
    const s2 = reduceAll(s, [
      { t: 'updateSettings', patch: { vatNumber: 'BE 0123.456.789' } },
      addItem('o1', burger, 'cuisine'),
      payOrder('o1', 'especes', { tip: 150, cashReceived: 2000 }),
    ]);
    const text = docText(receiptDoc(s2, order(s2)));
    assert.match(text, /TICKET DE CAISSE/);
    assert.match(text, /TVA BE 0123\.456\.789/);
    assert.match(text, /1 x Burger maison/);
    assert.match(text, /Pourboire/);
    assert.match(text, /Rendu 2,00/); // 20,00 reçus − 16,50 − 1,50 de pourboire
  });

  it('met en forme les colonnes du ticket', () => {
    assert.deepEqual(formatRow('Total', '12,50 €', 20), ['Total        12,50 €']);
    assert.equal(formatRow('Un très long nom de plat maison', '9,00 €', 20).length, 2);
    assert.equal(cleanText('L’œuf – 2×'), "L'oeuf - 2x");
  });
});

describe('TVA choisie à l’encaissement', () => {
  it('ajoute la TVA au montant après remise, pourboire en plus', () => {
    const { s, burger } = setup();
    const s2 = reduceAll(s, [
      addItem('o1', burger, 'cuisine'),
      addItem('o1', burger, 'cuisine'),
      payOrder('o1', 'carte', { discountPct: 10, tip: 100, vatRate: 21 }),
    ]);
    const o = order(s2);
    assert.equal(orderNet(o), 2970); // 33,00 − 10 %
    assert.equal(orderVat(o), 624); // 21 % de 29,70 = 6,237 → 6,24
    assert.equal(orderTotal(o), 3594);
    const st = salesStats(s2.orders);
    assert.equal(st.revenue, 3594);
    assert.equal(st.vat, 624);
    assert.deepEqual(st.vatByRate, { '21': 624 });
    assert.equal(st.byPayment.carte, 3694);
  });

  it('accepte 0, 6, 12 et 21 % et les détaille sur le ticket et la clôture', () => {
    const { s, burger } = setup();
    const day = new Date(2026, 10, 20, 12).getTime();
    let st2 = s;
    const rates = [0, 6, 12, 21];
    rates.forEach((r, i) => {
      const id = `v${r}`;
      st2 = reduceAll(st2, [
        { t: 'createOrder', id, tableId: s.tables[i + 1].id, label: `T${i}`, server: 'Léa', at: day },
        { t: 'addItem', orderId: id, lineId: `${id}-l`, item: burger, station: 'cuisine' },
        { t: 'payOrder', orderId: id, payment: 'carte', at: day, vatRate: r },
      ]);
    });
    const totals = rates.map((r) => orderTotal(st2.orders.find((o) => o.id === `v${r}`)!));
    assert.deepEqual(totals, [1650, 1749, 1848, 1997]);
    const ticket = docText(receiptDoc(st2, st2.orders.find((o) => o.id === 'v12')!));
    assert.match(ticket, /Total HT 16,50/);
    assert.match(ticket, /TVA 12 % 1,98/);
    assert.match(ticket, /TOTAL TTC 18,48/);
    const z = buildClosure(st2, dayKey(day), day + 86400000);
    assert.deepEqual(z.vatByRate, { '0': 0, '6': 99, '12': 198, '21': 347 });
    assert.match(docText(closureDoc(st2, z)), /TVA 21 % 3,47/);
  });

  it('les commandes en cours n’ont pas encore de TVA', () => {
    const { s, burger } = setup();
    const o = order(reduceAll(s, [addItem('o1', burger, 'cuisine')]));
    assert.equal(orderVat(o), 0);
    assert.equal(orderTotal(o), 1650);
  });
});

describe('clôture automatique à minuit', () => {
  it('clôture les jours passés une seule fois et remet le compteur à zéro', () => {
    const { s, burger } = setup();
    const yesterday = new Date(2026, 10, 10, 21, 0).getTime();
    const now = new Date(2026, 10, 11, 0, 0, 30).getTime();
    let st = reduceAll(s, [addItem('o1', burger, 'cuisine'), { t: 'payOrder', orderId: 'o1', payment: 'carte', at: yesterday, tip: 100 }]);
    assert.deepEqual(daysToClose(st, now), ['2026-11-10']);
    const z = buildClosure(st, '2026-11-10', now);
    assert.equal(z.revenue, 1650);
    assert.equal(z.tips, 100);
    st = reduceAll(st, [closeDay(z, true), closeDay(z, true)]);
    assert.equal(st.closures.length, 1);
    assert.equal(st.orderCounter, 0);
    assert.deepEqual(daysToClose(st, now), []);
    // Le chiffre du jour repart de zéro.
    assert.equal(salesStats(st.orders.filter((o) => dayKey(o.paidAt ?? 0) === dayKey(now))).revenue, 0);
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
    const paid = applyRedeem(demo, { plan: 'vie', valid_until: null }, t0 + H);
    assert.equal(licenseStatus(paid, t0 + 48 * H).active, true);
    assert.equal(licenseStatus(paid, t0 + 2 * H).demo, false);
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
