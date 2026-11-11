import type { PrintDoc, PrintLine } from './doc';

// Encodeur ESC/POS pour imprimantes thermiques (58 mm = 32 caractères, 80 mm = 48 caractères).

export const charsPerLine = (paperWidth: 58 | 80) => (paperWidth === 80 ? 48 : 32);

/** Table de caractères PC858 (Europe de l'Ouest + €). */
const CP858: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a,
  ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, Å: 0x8f, É: 0x90, æ: 0x91, Æ: 0x92, ô: 0x93, ö: 0x94, ò: 0x95,
  û: 0x96, ù: 0x97, ÿ: 0x98, Ö: 0x99, Ü: 0x9a, ø: 0x9b, '£': 0x9c, Ø: 0x9d, á: 0xa0, í: 0xa1, ó: 0xa2,
  ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, '«': 0xae, '»': 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, Ê: 0xd2, Ë: 0xd3, È: 0xd4,
  '€': 0xd5, Í: 0xd6, Î: 0xd7, Ï: 0xd8, Ó: 0xe0, Ô: 0xe2, Ò: 0xe3, Ú: 0xe9, Û: 0xea, Ù: 0xeb, '°': 0xf8,
};

/** Remplacements des caractères absents de la table (typographie française, emojis…). */
const REPLACE: [RegExp, string][] = [
  [/[’‘]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/[·•]/g, '.'],
  [/×/g, 'x'],
  [/…/g, '...'],
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/[  ]/g, ' '],
];

export function cleanText(text: string, asciiOnly: boolean): string {
  let t = text;
  for (const [re, by] of REPLACE) t = t.replace(re, by);
  if (asciiOnly) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/€/g, 'EUR');
  return t;
}

function encode(text: string, asciiOnly: boolean): number[] {
  const out: number[] = [];
  for (const ch of cleanText(text, asciiOnly)) {
    const code = ch.codePointAt(0) ?? 63;
    if (code < 0x80) out.push(code);
    else out.push(CP858[ch] ?? 0x3f);
  }
  return out;
}

/** Découpe un texte en lignes de `width` caractères (sans couper les mots si possible). */
export function wrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
    while (cur.length > width) {
      lines.push(cur.slice(0, width));
      cur = cur.slice(width);
    }
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

/** Ligne « libellé ............ montant » ; si trop long, le libellé passe sur sa propre ligne. */
export function formatRow(left: string, right: string, width: number): string[] {
  if (left.length + right.length + 1 <= width) return [left + ' '.repeat(width - left.length - right.length) + right];
  const wrapped = wrap(left, width);
  const last = wrapped[wrapped.length - 1];
  if (last.length + right.length + 1 <= width) {
    wrapped[wrapped.length - 1] = last + ' '.repeat(width - last.length - right.length) + right;
    return wrapped;
  }
  return [...wrapped, ' '.repeat(Math.max(0, width - right.length)) + right];
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function toEscPos(doc: PrintDoc, paperWidth: 58 | 80, asciiOnly = false): Uint8Array {
  const width = charsPerLine(paperWidth);
  const bytes: number[] = [ESC, 0x40, ESC, 0x74, 19]; // initialisation + table PC858
  const align = (n: 0 | 1 | 2) => bytes.push(ESC, 0x61, n);
  const bold = (on: boolean) => bytes.push(ESC, 0x45, on ? 1 : 0);
  const size = (big: boolean, wide = big) => bytes.push(GS, 0x21, (wide ? 0x10 : 0) | (big ? 0x01 : 0));
  const text = (t: string) => bytes.push(...encode(t, asciiOnly), LF);

  const line = (l: PrintLine) => {
    switch (l.k) {
      case 'title':
        align(1);
        bold(true);
        size(true);
        wrap(l.text, Math.floor(width / 2)).forEach(text);
        size(false);
        bold(false);
        break;
      case 'center':
        align(1);
        bold(!!l.bold);
        wrap(l.text, width).forEach(text);
        bold(false);
        break;
      case 'text':
        align(0);
        bold(!!l.bold);
        size(!!l.big, false);
        wrap(l.text, width).forEach(text);
        size(false);
        bold(false);
        break;
      case 'row':
        align(0);
        bold(!!l.bold);
        size(!!l.big, false);
        formatRow(l.left, l.right, width).forEach(text);
        size(false);
        bold(false);
        break;
      case 'sep':
        align(0);
        text('-'.repeat(width));
        break;
      case 'feed':
        bytes.push(ESC, 0x64, 3);
        break;
    }
  };
  doc.lines.forEach(line);
  bytes.push(ESC, 0x64, 3, GS, 0x56, 0x42, 0x00); // avance + coupe papier
  return new Uint8Array(bytes);
}
