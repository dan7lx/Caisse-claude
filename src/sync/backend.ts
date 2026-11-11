import type { Op } from '../store/ops';
import type { AppState, ServerConfig } from '../store/types';

// Client du serveur de synchronisation (Supabase, fonctions SQL de supabase/schema.sql).
// Uniquement des appels HTTP simples : pas de dépendance, compatible iOS / Android / web.

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface RemoteEvent {
  seq: number;
  op_id: string;
  op: Op;
}

export interface JoinResult {
  lobby_id: string;
  code: string;
  snapshot: AppState;
  snapshot_seq: number;
}

export function normalizeServer(cfg: ServerConfig): ServerConfig {
  return { url: cfg.url.trim().replace(/\/+$/, ''), anonKey: cfg.anonKey.trim() };
}

export async function rpc<T>(cfg: ServerConfig, fn: string, args: Record<string, unknown>): Promise<T> {
  const { url, anonKey } = normalizeServer(cfg);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: anonKey };
  // Les anciennes clés « anon » sont des JWT ; les nouvelles clés « publishable » non.
  if (anonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${anonKey}`;
  let res: Response;
  try {
    res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch {
    throw new BackendError('Serveur injoignable. Vérifiez la connexion internet.', 0);
  }
  if (!res.ok) {
    let message = `Erreur du serveur (${res.status}).`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // corps illisible : on garde le message générique
    }
    throw new BackendError(message, res.status);
  }
  return (await res.json()) as T;
}

export const backend = {
  createLobby: (cfg: ServerConfig, snapshot: AppState) =>
    rpc<{ lobby_id: string; code: string }>(cfg, 'caisse_create_lobby', { p_snapshot: snapshot }),

  joinLobby: (cfg: ServerConfig, code: string) =>
    rpc<JoinResult>(cfg, 'caisse_join_lobby', { p_code: code.trim().toUpperCase() }),

  push: (cfg: ServerConfig, lobbyId: string, ops: { op_id: string; op: Op }[]) =>
    rpc<{ inserted: number }>(cfg, 'caisse_push', { p_lobby: lobbyId, p_ops: ops }),

  pull: (cfg: ServerConfig, lobbyId: string, after: number) =>
    rpc<{ closed: boolean; events: RemoteEvent[] }>(cfg, 'caisse_pull', { p_lobby: lobbyId, p_after: after }),

  saveSnapshot: (cfg: ServerConfig, lobbyId: string, snapshot: AppState, seq: number) =>
    rpc<{ ok: boolean }>(cfg, 'caisse_save_snapshot', { p_lobby: lobbyId, p_snapshot: snapshot, p_seq: seq }),

  closeLobby: (cfg: ServerConfig, lobbyId: string) =>
    rpc<{ ok: boolean }>(cfg, 'caisse_close_lobby', { p_lobby: lobbyId }),
};

/** Lien d'invitation : contient le code du lobby et l'adresse du serveur. */
export function makeInviteLink(baseUrl: string, code: string, cfg: ServerConfig): string {
  const payload = `${cfg.url}|${cfg.anonKey}`;
  const encoded = btoa(unescape(encodeURIComponent(payload)));
  return `${baseUrl.replace(/\/+$/, '')}/?equipe=${encodeURIComponent(code)}&srv=${encodeURIComponent(encoded)}`;
}

export function parseInvite(search: string): { code: string; server: ServerConfig | null } | null {
  const params = new URLSearchParams(search);
  const code = params.get('equipe');
  if (!code) return null;
  const srv = params.get('srv');
  let server: ServerConfig | null = null;
  if (srv) {
    try {
      const [url, anonKey] = decodeURIComponent(escape(atob(srv))).split('|');
      if (url && anonKey) server = { url, anonKey };
    } catch {
      server = null;
    }
  }
  return { code: code.toUpperCase(), server };
}
