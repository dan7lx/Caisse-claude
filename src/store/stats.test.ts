import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reportDoc } from '../ticket/report';
import { createInitialState } from './defaults';
import { reduceAll, type Op } from './ops';
import { buildReport, change, periodOf, reportCsv, shiftPeriod } from './stats';
import type { AppState } from './types';

const at = (s: string) => new Date(s).getTime();

/** Une commande encaissée à `when` : un burger (cuisine), TVA choisie, pourboire éventuel. */
function sale(state: AppState, id: string, when: number, opts: { server?: string; vat?: number; tip?: number } = {}): Op[] {
  const burger = state.items.find((i) => i.name === 'Burger maison')!;
  return [
    { t: 'createOrder', id, tableId: state.tables[0].id, label: 'Table 1', server: opts.server ?? 'Julie', at: when },
    { t: 'addItem', orderId: id, lineId: `${id}-l`, item: burger, station: 'cuisine' },
    { t: 'payOrder', orderId: id, payment: 'carte', at: when, vatRate: opts.vat ?? 12, tip: opts.tip ?? 0 },
  ];
}

describe('périodes du rapport', () => {
  it('jour, semaine (lundi), mois, année et navigation', () => {
    const t = at('2026-11-19T15:30:00'); // jeudi
    const week = periodOf('semaine', t);
    assert.equal(new Date(week.start).getDay(), 1, 'la semaine commence le lundi');
    assert.equal(week.label, 'du 16/11/2026 au 22/11/2026');
    assert.equal(periodOf('mois', t).label, 'novembre 2026');
    assert.equal(periodOf('annee', t).label, 'année 2026');
    assert.equal(shiftPeriod(periodOf('mois', t), -1).label, 'octobre 2026');
    assert.equal(shiftPeriod(periodOf('mois', at('2026-01-10T12:00:00')), -1).label, 'décembre 2025');
    assert.equal(shiftPeriod(periodOf('jour', t), 1).label, 'ven. 20/11/2026');
  });
});

describe('rapport des ventes', () => {
  it('cumule CA, TVA par taux, serveurs, catégories, barres et pourboires sur la période', () => {
    const base = createInitialState();
    const price = base.items.find((i) => i.name === 'Burger maison')!.price;
    const s = reduceAll(base, [
      ...sale(base, 'a', at('2026-11-17T12:10:00'), { vat: 12, tip: 200 }),
      ...sale(base, 'b', at('2026-11-17T20:05:00'), { vat: 21, server: 'Marc' }),
      ...sale(base, 'c', at('2026-11-18T12:00:00'), { vat: 12 }), // autre jour
    ]);
    const day = buildReport(s, periodOf('jour', at('2026-11-17T09:00:00')));
    const vat12 = Math.round((price * 12) / 100);
    const vat21 = Math.round((price * 21) / 100);
    assert.equal(day.count, 2);
    assert.equal(day.revenue, price * 2 + vat12 + vat21);
    assert.deepEqual(day.vatByRate, { '12': vat12, '21': vat21 });
    assert.equal(day.tips, 200);
    assert.equal(day.byPayment.carte, day.revenue + 200);
    assert.deepEqual(day.byServer.map((x) => x.name).sort(), ['Julie', 'Marc']);
    assert.equal(day.buckets.length, 24);
    assert.equal(day.buckets[12].count, 1);
    assert.equal(day.buckets[20].count, 1);
    assert.equal(day.byCategory.length, 1);
    assert.equal(day.topItems[0].qty, 2);

    const month = buildReport(s, periodOf('mois', at('2026-11-17T09:00:00')));
    assert.equal(month.count, 3);
    assert.equal(month.buckets.length, 30, 'novembre : 30 barres');
    assert.equal(month.bestBucket?.label, '17');
    assert.equal(buildReport(s, periodOf('annee', at('2026-03-01T00:00:00'))).buckets[10].count, 3);
  });

  it('reprend les jours dont les tickets ont été effacés depuis leur clôture Z', () => {
    const base = createInitialState();
    const s = reduceAll(base, [
      {
        t: 'closeDay',
        resetCounter: false,
        closure: {
          date: '2026-11-03',
          closedAt: at('2026-11-04T00:00:01'),
          count: 5,
          cancelled: 1,
          guests: 9,
          revenue: 10_000,
          tips: 300,
          discounts: 0,
          byPayment: { especes: 4000, carte: 6300, autre: 0 },
          topItems: [],
          vatByRate: { '12': 1071 },
        },
      },
    ]);
    const r = buildReport(s, periodOf('mois', at('2026-11-10T12:00:00')));
    assert.equal(r.closureDays, 1);
    assert.equal(r.revenue, 10_000);
    assert.equal(r.count, 5);
    assert.equal(r.vatByRate['12'], 1071);
    assert.equal(r.buckets[2].revenue, 10_000, 'barre du 3 novembre');
    assert.equal(buildReport(s, periodOf('mois', at('2026-10-10T12:00:00'))).revenue, 0);
  });

  it('évolution, export CSV pour le comptable et rapport imprimable', () => {
    assert.equal(change(150, 100), 50);
    assert.equal(change(50, 100), -50);
    assert.equal(change(10, 0), null);
    const base = createInitialState();
    const s = reduceAll(base, sale(base, 'a', at('2026-11-17T12:10:00'), { vat: 6 }));
    const r = buildReport(s, periodOf('jour', at('2026-11-17T12:00:00')));
    const csv = reportCsv(s, r).split('\n');
    assert.match(csv[0], /^Date;Heure;Ticket;Table;Serveur;Statut;Paiement;Total HT;Taux TVA;TVA;Total TTC/);
    assert.match(csv[1], /^17\/11\/2026;12:10;\d+;Table 1;Julie;Encaissé;carte;\d+,\d\d;6 %;/);
    const doc = reportDoc(s, r, at('2026-11-17T23:00:00'));
    const text = doc.lines.map((l) => ('text' in l ? l.text : 'left' in l ? `${l.left} ${l.right}` : '')).join('\n');
    assert.match(text, /RAPPORT DES VENTES/);
    assert.match(text, /TVA 6 %/);
    assert.match(text, /Par serveur/);
  });
});
