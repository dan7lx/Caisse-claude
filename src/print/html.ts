import type { PrintDoc } from './doc';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Ticket au format HTML (58 ou 80 mm) pour l'impression classique (AirPrint, Android, navigateur). */
export function toHtml(doc: PrintDoc, paperWidth: 58 | 80): string {
  const body = doc.lines
    .map((l) => {
      switch (l.k) {
        case 'title':
          return `<div class="title">${esc(l.text)}</div>`;
        case 'center':
          return `<div class="center${l.bold ? ' bold' : ''}">${esc(l.text)}</div>`;
        case 'text':
          return `<div class="${l.bold ? 'bold' : ''}${l.big ? ' big' : ''}">${esc(l.text)}</div>`;
        case 'row':
          return `<div class="row${l.bold ? ' bold' : ''}${l.big ? ' big' : ''}"><span>${esc(l.left)}</span><span>${esc(l.right)}</span></div>`;
        case 'sep':
          return '<hr />';
        case 'feed':
          return '<div class="feed"></div>';
        default:
          return '';
      }
    })
    .join('\n');
  const logo =
    doc.logo && doc.logo.startsWith('data:image/') ? `<img class="logo" src="${esc(doc.logo)}" alt="" />` : '';
  const inner = paperWidth - 8;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><title>${esc(doc.title)}</title>
<style>
  @page { size: ${paperWidth}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 4mm; width: ${paperWidth}mm; font-family: 'Courier New', Courier, monospace; font-size: ${paperWidth === 80 ? 12 : 10.5}px; color: #000; }
  .wrap { width: ${inner}mm; }
  .logo { display: block; margin: 0 auto 2mm; max-width: 28mm; max-height: 28mm; }
  .title { text-align: center; font-size: 1.6em; font-weight: 700; margin-bottom: 1mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 1.3em; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { white-space: nowrap; }
  hr { border: 0; border-top: 1px dashed #000; margin: 1.5mm 0; }
  .feed { height: 4mm; }
</style></head>
<body><div class="wrap">${logo}${body}</div></body></html>`;
}
