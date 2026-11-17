// Fausse imprimante réseau Epson « ePOS-Print » pour les tests : reçoit les tickets en HTTP (port 8791),
// répond comme une vraie imprimante et garde le texte imprimé. GET /jobs renvoie les tickets reçus.
const http = require('http');

const PORT = Number(process.env.FAKE_PRINTER_PORT || 8791);
const jobs = [];

/** Octets ESC/POS (hexadécimal) → texte lisible (accents PC858 courants convertis). */
function decode(hex) {
  const cp858 = { 0x82: 'é', 0x8a: 'è', 0x85: 'à', 0x87: 'ç', 0x97: 'ù', 0xd5: '€', 0x93: 'ô', 0x88: 'ê' };
  const bytes = hex.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Commandes ESC x n / GS x n : on saute les octets de paramètres.
    if (b === 0x1b || b === 0x1d) {
      const cmd = bytes[i + 1];
      i += cmd === 0x56 ? 3 : 2;
      continue;
    }
    if (b === 0x0a) out += '\n';
    else if (b >= 0x20 && b < 0x7f) out += String.fromCharCode(b);
    else if (cp858[b]) out += cp858[b];
  }
  return out;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, SOAPAction, If-Modified-Since',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    if (req.method === 'GET' && req.url === '/jobs') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(jobs));
    }
    if (req.method === 'POST' && req.url.startsWith('/cgi-bin/epos/service.cgi')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const hex = /<command>([0-9a-f]*)<\/command>/i.exec(body)?.[1];
        const ok = !!hex && /epos-print/.test(body);
        if (ok) jobs.push(decode(hex));
        res.writeHead(200, { ...cors, 'Content-Type': 'text/xml; charset=utf-8' });
        res.end(
          '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
            `<response success="${ok}" code="${ok ? '' : 'SchemaError'}" status="251658262" battery="0" xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" />` +
            '</s:Body></s:Envelope>',
        );
      });
      return;
    }
    res.writeHead(404, cors);
    res.end();
  })
  .listen(PORT, () => console.log(`Fausse imprimante ePOS sur le port ${PORT}`));
