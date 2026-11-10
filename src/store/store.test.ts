/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatElapsed, formatPrice, parsePrice } from '../utils/format';
import {
  addItem,
  addServer,
  cancelOrder,
  changeQty,
  compose,
  createOrder,
  deleteCategory,
  moveCategory,
  payOrder,
  removeIfEmpty,
  removeServer,
  renameServer,
  sendOrder,
  setLinesStatus,
} from './actions';
import { createDemoState } from './defaults';
import { kitchenTickets, openOrderForTable, orderTotal, salesStats, tableState } from './selectors';
import type { AppState } from './types';

function setup() {
  const state = createDemoState();
  const table = state.tables[0];
  const burger = state.items.find((i) => i.name === 'Burger maison')!;
  const coca = state.items.find((i) => i.name === 'Coca-Cola')!;
  const s = createOrder('o1', table.id, table.name)(state);
  return { s, table, burger, coca };
}

const order = (s: AppState) => s.orders.find((o) => o.id === 'o1')!;

describe('prise de commande', () => {
  it('ouvre une commande et occupe la table', () => {
    const { s, table } = setup();
    assert.equal(openOrderForTable(s, table.id)?.id, 'o1');
    assert.equal(order(s).number, 1);
    assert.equal(tableState(order(s)), 'occupee');
  });

  it('refuse une deuxième commande ouverte sur la même table', () => {
    const { s, table } = setup();
    const s2 = createOrder('o2', table.id, table.name)(s);
    assert.equal(s2.orders.length, 1);
  });

  it('regroupe les articles identiques et gère les quantités', () => {
    const { s, burger, coca } = setup();
    const s2 = compose(addItem('o1', burger, 'cuisine'), addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar'))(s);
    assert.equal(order(s2).lines.length, 2);
    assert.equal(order(s2).lines[0].qty, 2);
    assert.equal(orderTotal(order(s2)), 2 * 1650 + 450);

    const lineId = order(s2).lines[0].id;
    const s3 = compose(changeQty('o1', lineId, -1), changeQty('o1', lineId, -1))(s2);
    assert.equal(order(s3).lines.length, 1);
  });

  it('supprime une commande restée vide', () => {
    const { s } = setup();
    assert.equal(removeIfEmpty('o1')(s).orders.length, 0);
  });
});

describe('cuisine et bar', () => {
  it('envoie les lignes vers le bon poste et crée un ticket par envoi', () => {
    const { s, burger, coca } = setup();
    const s2 = compose(addItem('o1', burger, 'cuisine'), addItem('o1', coca, 'bar'), sendOrder('o1'))(s);
    assert.ok(order(s2).lines.every((l) => l.status === 'envoye' && l.batch === 1));
    assert.equal(kitchenTickets(s2, 'cuisine').active.length, 1);
    assert.equal(kitchenTickets(s2, 'bar').active.length, 1);

    const s3 = compose(addItem('o1', burger, 'cuisine'), sendOrder('o1'))(s2);
    assert.equal(order(s3).batchCount, 2);
    assert.equal(kitchenTickets(s3, 'cuisine').active.length, 2);
  });

  it('un ticket prêt quitte la file et signale la table', () => {
    const { s, burger } = setup();
    const s2 = compose(addItem('o1', burger, 'cuisine'), sendOrder('o1'))(s);
    const ids = order(s2).lines.map((l) => l.id);
    const s3 = setLinesStatus('o1', ids, 'pret')(s2);
    assert.equal(kitchenTickets(s3, 'cuisine').active.length, 0);
    assert.equal(kitchenTickets(s3, 'cuisine').done.length, 1);
    assert.equal(tableState(order(s3)), 'pret');
    const s4 = setLinesStatus('o1', ids, 'servi')(s3);
    assert.equal(tableState(order(s4)), 'occupee');
  });

  it('ne change pas le statut d’une ligne non envoyée', () => {
    const { s, burger } = setup();
    const s2 = addItem('o1', burger, 'cuisine')(s);
    const s3 = setLinesStatus('o1', [order(s2).lines[0].id], 'pret')(s2);
    assert.equal(order(s3).lines[0].status, 'brouillon');
  });
});

describe('encaissement', () => {
  it('envoie les lignes restantes, libère la table et compte la vente', () => {
    const { s, table, burger } = setup();
    const s2 = compose(addItem('o1', burger, 'cuisine'), payOrder('o1', 'carte'))(s);
    assert.equal(order(s2).status, 'payee');
    assert.equal(order(s2).lines[0].status, 'envoye');
    assert.equal(openOrderForTable(s2, table.id), undefined);
    const stats = salesStats(s2.orders);
    assert.equal(stats.revenue, 1650);
    assert.equal(stats.byPayment.carte, 1650);
  });

  it('annule : supprime si rien n’est envoyé, sinon garde une trace', () => {
    const { s, burger } = setup();
    const draft = compose(addItem('o1', burger, 'cuisine'), cancelOrder('o1'))(s);
    assert.equal(draft.orders.length, 0);
    const sent = compose(addItem('o1', burger, 'cuisine'), sendOrder('o1'), cancelOrder('o1'))(s);
    assert.equal(order(sent).status, 'annulee');
  });
});

describe('gestion', () => {
  it('supprime une catégorie avec ses articles', () => {
    const s = createDemoState();
    const cat = s.categories[0];
    const s2 = deleteCategory(cat.id)(s);
    assert.equal(s2.items.some((i) => i.categoryId === cat.id), false);
  });

  it('réordonne les catégories', () => {
    const s = createDemoState();
    const [a, b] = s.categories;
    const s2 = moveCategory(b.id, -1)(s);
    assert.deepEqual([s2.categories[0].id, s2.categories[1].id], [b.id, a.id]);
    assert.equal(moveCategory(a.id, -1)(s), s);
  });

  it('gère les serveurs et le serveur actif', () => {
    let s = createDemoState();
    s = addServer('Julie')(s);
    s = addServer('Julie')(s);
    assert.equal(s.servers.filter((n) => n === 'Julie').length, 1);
    s = renameServer('Serveur 1', 'Marc')(s);
    assert.equal(s.settings.currentServer, 'Marc');
    s = removeServer('Marc')(s);
    assert.notEqual(s.settings.currentServer, 'Marc');
    s = removeServer('Julie')(removeServer('Serveur 2')(s));
    assert.equal(s.servers.length, 1);
  });
});

describe('formatage', () => {
  it('formate et lit les prix', () => {
    assert.equal(formatPrice(1250), '12,50 €');
    assert.equal(formatPrice(123456, 'CHF'), '1 234,56 CHF');
    assert.equal(parsePrice('12,5'), 1250);
    assert.equal(parsePrice('12.50'), 1250);
    assert.equal(parsePrice('abc'), null);
    assert.equal(parsePrice('1,234'), null);
  });

  it('formate les durées', () => {
    assert.equal(formatElapsed(5 * 60000), '5 min');
    assert.equal(formatElapsed(65 * 60000), '1 h 05');
  });
});
