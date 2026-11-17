// Imprimantes réseau (Wi-Fi / Ethernet) Epson compatibles « ePOS-Print » : la page envoie le ticket
// en HTTP(S) à l'imprimante, sans application ni serveur intermédiaire. Sans React Native : testable.

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Adresse du service d'impression de l'imprimante. `host` : adresse IP (ex. 192.168.1.50), avec port
 * éventuel, ou adresse complète. Sans protocole : HTTPS si l'application est en HTTPS (obligatoire
 * pour le navigateur), HTTP sinon.
 */
export function eposUrl(host: string, pageProtocol: string): string | null {
  const h = host.trim().replace(/\/+$/, '');
  if (!h) return null;
  const base = /^https?:\/\//i.test(h) ? h : `${pageProtocol === 'https:' ? 'https' : 'http'}://${h}`;
  try {
    const u = new URL(base);
    if (u.pathname && u.pathname !== '/') return u.toString();
    return `${u.origin}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
  } catch {
    return null;
  }
}

/** Requête ePOS-Print : les commandes ESC/POS brutes, en hexadécimal. */
export function eposBody(escpos: Uint8Array): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">' +
    `<command>${toHex(escpos)}</command>` +
    '</epos-print></s:Body></s:Envelope>'
  );
}

/** Réponse de l'imprimante : succès, ou message d'erreur compréhensible. */
export function parseEposResponse(xml: string): { ok: true } | { ok: false; error: string } {
  const tag = /<response\b[^>]*>/i.exec(xml)?.[0];
  if (!tag) return { ok: false, error: 'Réponse inattendue : est-ce bien une imprimante Epson compatible ePOS-Print ?' };
  if (/success="true"/i.test(tag)) return { ok: true };
  const code = /code="([^"]*)"/i.exec(tag)?.[1] ?? '';
  const known: Record<string, string> = {
    EPTR_COVER_OPEN: 'Le capot de l’imprimante est ouvert.',
    EPTR_REC_EMPTY: 'Plus de papier dans l’imprimante.',
    EPTR_AUTOCUTTER: 'Problème de coupe du papier.',
    EX_TIMEOUT: 'L’imprimante n’a pas répondu à temps.',
    DeviceNotFound: 'Imprimante introuvable (vérifiez l’identifiant « local_printer »).',
    EX_BADPORT: 'L’imprimante est déconnectée.',
  };
  return { ok: false, error: known[code] ?? `L’imprimante a refusé le ticket${code ? ` (${code})` : ''}.` };
}
