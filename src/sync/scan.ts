import type { ServerConfig } from '../store/types';
import { parseInvite } from './backend';

/** Code de lobby : 6 caractères sans ambiguïté (pas de 0/O ni 1/I). */
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * Interprète le contenu d'un QR code scanné pour rejoindre un lobby :
 * le lien d'invitation affiché par le gérant (code + serveur) ou un code seul.
 */
export function parseScannedLobby(text: string): { code: string; server: ServerConfig | null } | null {
  const raw = text.trim();
  const plain = raw.toUpperCase().replace(/[\s-]/g, '');
  if (CODE.test(plain)) return { code: plain, server: null };
  const query = raw.indexOf('?');
  if (query < 0) return null;
  const invite = parseInvite(raw.slice(query));
  if (!invite) return null;
  const code = invite.code.trim().toUpperCase();
  return CODE.test(code) ? { code, server: invite.server } : null;
}
