// Mise en page « papier » des tickets affichés à l'écran (police à chasse fixe).

/** Nombre de caractères par ligne d'un ticket (largeur d'un ticket de caisse 58 mm). */
export const TICKET_WIDTH = 32;

/** Remplacements typographiques pour une police à chasse fixe. */
const REPLACE: [RegExp, string][] = [
  [/[’‘]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/[·•]/g, '.'],
  [/×/g, 'x'],
  [/…/g, '...'],
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/[  ]/g, ' '],
];

export function cleanText(text: string): string {
  let t = text;
  for (const [re, by] of REPLACE) t = t.replace(re, by);
  return t;
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
