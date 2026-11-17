import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInitialState } from '../store/defaults';
import { reduce, reduceAll } from '../store/ops';
import { kitchenTickets } from '../store/selectors';
import { kitchenDoc, testDoc } from '../ticket/kitchen';
import { ticketsToPrint } from './auto';
import { eposBody, eposUrl, parseEposResponse } from './epos';
import { charsPerLine, printableText, toEscPos } from './escpos';
import { toHtml } from './html';
import { DEFAULT_PRINTER, canPrintSilently, printerOf, stationsFor } from './settings';

const t0 = new Date('2026-11-17T12:00:00').getTime();

function service() {
  const base = createInitialState();
  const burger = base.items.find((i) => i.name === 'Burger maison')!;
  const coca = base.items.find((i) => i.name === 'Coca-Cola')!;
  const s = reduce(base, { t: 'createOrder', id: 'o1', tableId: base.tables[0].id, label: 'Table 1', server: 'Julie', at: t0 });
  return { s, burger, coca };
}

/** Octets → texte lisible (les octets ESC/POS < 0x20 et > 0x7f sont ignorés). */
const ascii = (b: Uint8Array) => Array.from(b, (c) => (c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : c === 0x0a ? '\n' : '')).join('');

describe('impression ESC/POS', () => {
  it('initialise, encode les accents en PC858, aligne les colonnes et coupe le papier', () => {
    const doc = { title: 'T', lines: [{ k: 'title' as const, text: 'Chez Léa' }, { k: 'row' as const, left: 'Total', right: '12,00 €' }] };
    const bytes = toEscPos(doc, 58);
    assert.deepEqual([...bytes.slice(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 19]);
    assert.ok(bytes.includes(0x82), 'é en PC858');
    assert.ok(bytes.includes(0xd5), '€ en PC858');
    assert.deepEqual([...bytes.slice(-4)], [0x1d, 0x56, 0x42, 0x00]);
    // « Total ……… 12,00 € » occupe toute la largeur (le € PC858 n'est pas un caractère ASCII : +1).
    const row = (b: Uint8Array) => /Total +12,00 /.exec(ascii(b))![0].length + 1;
    assert.equal(row(bytes), charsPerLine(58), 'ligne pleine largeur 32 colonnes');
    assert.equal(row(toEscPos(doc, 80)), 48);
  });

  it('sans accents : é → e, € → EUR', () => {
    assert.equal(printableText('Café 3 €', true), 'Cafe 3 EUR');
    assert.ok(!toEscPos({ title: 'T', lines: [{ k: 'text', text: 'Crème brûlée' }] }, 58, true).some((b) => b >= 0x80));
  });
});

describe('imprimante Wi-Fi Epson (ePOS-Print)', () => {
  it('adresse du service : HTTPS quand l’application est en HTTPS', () => {
    assert.equal(eposUrl('192.168.1.50', 'https:'), 'https://192.168.1.50/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000');
    assert.equal(eposUrl('localhost:8791', 'http:'), 'http://localhost:8791/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000');
    assert.equal(eposUrl('  ', 'https:'), null);
  });

  it('envoie les octets ESC/POS en hexadécimal et lit la réponse', () => {
    const body = eposBody(new Uint8Array([0x1b, 0x40, 0x41]));
    assert.match(body, /<epos-print xmlns="http:\/\/www\.epson-pos\.com\/schemas\/2011\/03\/epos-print"><command>1b4041<\/command>/);
    assert.deepEqual(parseEposResponse('<response success="true" code="" status="251658262" />'), { ok: true });
    const paper = parseEposResponse('<response success="false" code="EPTR_REC_EMPTY" />');
    assert.equal(paper.ok, false);
    assert.match(!paper.ok ? paper.error : '', /papier/);
    assert.equal(parseEposResponse('<html>').ok, false);
  });
});

describe('impression automatique des bons', () => {
  it('chaque envoi en cuisine sort une fois, pas les bons déjà là à l’ouverture', () => {
    const { s, burger, coca } = service();
    const s1 = reduceAll(s, [
      { t: 'addItem', orderId: 'o1', lineId: 'l1', item: burger, station: 'cuisine' },
      { t: 'sendOrder', orderId: 'o1', at: t0 },
    ]);
    // Ouverture de l'application avec un bon déjà présent : rien n'est imprimé.
    let r = ticketsToPrint(null, s1, ['cuisine'], t0);
    assert.equal(r.fresh.length, 0);
    const s2 = reduceAll(s1, [
      { t: 'addItem', orderId: 'o1', lineId: 'l2', item: burger, station: 'cuisine' },
      { t: 'addItem', orderId: 'o1', lineId: 'l3', item: coca, station: 'bar' },
      { t: 'sendOrder', orderId: 'o1', at: t0 + 60_000 },
    ]);
    r = ticketsToPrint(r.memory, s2, ['cuisine'], t0 + 60_000);
    assert.deepEqual(r.fresh.map((t) => [t.station, t.batch]), [['cuisine', 2]], 'seulement le nouvel envoi cuisine, pas le bar');
    assert.equal(ticketsToPrint(r.memory, s2, ['cuisine'], t0 + 61_000).fresh.length, 0, 'pas deux fois');
  });

  it('le bon de cuisine contient la table, le serveur, les quantités et les remarques', () => {
    const { s, burger } = service();
    const s1 = reduceAll(s, [
      { t: 'addItem', orderId: 'o1', lineId: 'l1', item: burger, station: 'cuisine' },
      { t: 'setLineNote', orderId: 'o1', lineId: 'l1', note: 'Saignant' },
      { t: 'sendOrder', orderId: 'o1', at: t0 },
    ]);
    const ticket = kitchenTickets(s1, 'cuisine', t0).active[0];
    const text = ascii(toEscPos(kitchenDoc(ticket), 80));
    assert.match(text, /CUISINE/);
    assert.match(text, /Table 1/);
    assert.match(text, /Serveur Julie/);
    assert.match(text, /1 x Burger maison/);
  });

  it('réglages : impression silencieuse seulement en Bluetooth ou Wi-Fi ; bons du poste', () => {
    assert.deepEqual(printerOf({}), DEFAULT_PRINTER);
    assert.equal(canPrintSilently({ ...DEFAULT_PRINTER, mode: 'systeme' }), false);
    assert.equal(canPrintSilently({ ...DEFAULT_PRINTER, mode: 'reseau' }), true);
    assert.deepEqual(stationsFor('cuisine'), ['cuisine']);
    assert.deepEqual(stationsFor('serveur'), ['cuisine', 'bar']);
  });

  it('page d’essai et HTML (AirPrint) échappent le texte', () => {
    const s = createInitialState();
    const doc = testDoc({ ...s, settings: { ...s.settings, restaurantName: 'A <b>' } }, 58, 'Wi-Fi', t0);
    const html = toHtml(doc, 58);
    assert.match(html, /A &lt;b&gt;/);
    assert.match(html, /size: 58mm auto/);
  });
});
