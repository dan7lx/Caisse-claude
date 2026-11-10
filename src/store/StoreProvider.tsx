import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState as RNAppState, Platform, View } from 'react-native';

import { backend, BackendError, normalizeServer, parseInvite, type RemoteEvent } from '../sync/backend';
import { colors } from '../theme';
import { createDevice, createInitialState, migrate, uid } from './defaults';
import { reduce, reduceAll, type Op } from './ops';
import type { AppState, DeviceState, Role, ServerConfig } from './types';

const STATE_KEY = 'caisse-resto:v1';
const DEVICE_KEY = 'caisse-resto:device';
const SYNC_KEY = 'caisse-resto:sync';
const POLL_MS = 2000;
const SNAPSHOT_EVERY = 200;

interface PendingOp {
  opId: string;
  op: Op;
}

/** État du lobby sur cet appareil : données confirmées par le serveur + modifications en attente d'envoi. */
interface SyncData {
  lobbyId: string;
  seq: number;
  snapshotSeq: number;
  confirmed: AppState;
  pending: PendingOp[];
}

export type SyncStatus = 'local' | 'connexion' | 'ok' | 'hors_ligne' | 'ferme';

export interface SyncInfo {
  status: SyncStatus;
  lastSync: number | null;
  error: string | null;
}

export interface Session {
  /** Code gérant saisi sur cet appareil (jusqu'au verrouillage ou à la fermeture). */
  manager: boolean;
  /** Code administrateur saisi. */
  admin: boolean;
}

export interface Invite {
  code: string;
  server: ServerConfig | null;
}

interface StoreValue {
  state: AppState;
  device: DeviceState;
  dispatch: (op: Op) => void;
  updateDevice: (patch: Partial<DeviceState>) => void;
  session: Session;
  setSession: (patch: Partial<Session>) => void;
  sync: SyncInfo;
  pendingCount: number;
  invite: Invite | null;
  clearInvite: () => void;
  createLobby: (server: ServerConfig) => Promise<string>;
  joinLobby: (server: ServerConfig, code: string, profile: { name: string; role: Role }) => Promise<void>;
  leaveLobby: () => void;
  closeLobby: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

function errorMessage(e: unknown): string {
  if (e instanceof BackendError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Erreur inconnue';
}

async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Écrit une valeur dans le stockage de l'appareil, regroupée pour éviter d'écrire à chaque frappe. */
function useDebouncedSave(enabled: boolean, key: string, value: unknown) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const write = value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(value));
      write.catch(() => {});
    }, 300);
  }, [enabled, key, value]);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<AppState | null>(null);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [sync, setSync] = useState<SyncInfo>({ status: 'local', lastSync: null, error: null });
  const [session, setSessionState] = useState<Session>({ manager: false, admin: false });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Références toujours à jour, utilisées par la boucle de synchronisation.
  const syncRef = useRef<SyncData | null>(null);
  const deviceRef = useRef<DeviceState | null>(null);
  const kickRef = useRef<() => void>(() => {});

  const commitSync = useCallback((next: SyncData | null) => {
    syncRef.current = next;
    setSyncData(next);
  }, []);

  const commitDevice = useCallback((next: DeviceState) => {
    deviceRef.current = next;
    setDevice(next);
  }, []);

  /* ----------------------------- Chargement ----------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rawState, rawDevice, rawSync] = await Promise.all([
        readJson(STATE_KEY),
        readJson(DEVICE_KEY),
        readJson(SYNC_KEY),
      ]);
      if (cancelled) return;
      const migrated = migrate(rawState);
      const state = migrated?.state ?? createInitialState();
      const dev = (rawDevice as DeviceState | null)?.version === 1 ? (rawDevice as DeviceState) : createDevice();
      if (!rawDevice && migrated?.currentServer) dev.currentServer = migrated.currentServer;
      const sd = rawSync as SyncData | null;
      const validSync = dev.lobby && sd && sd.lobbyId === dev.lobby.lobbyId ? sd : null;
      if (!validSync) dev.lobby = null;

      if (Platform.OS === 'web') {
        const loc = (globalThis as { location?: { search: string } }).location;
        const inv = loc ? parseInvite(loc.search) : null;
        if (inv) {
          setInvite(inv);
          const hist = (globalThis as { history?: { replaceState: (a: null, b: string, c: string) => void } }).history;
          hist?.replaceState(null, '', '/');
        }
      }

      setLocal(state);
      commitDevice(dev);
      commitSync(validSync);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [commitDevice, commitSync]);

  /* ----------------------------- Sauvegarde ----------------------------- */

  useDebouncedSave(loaded, STATE_KEY, local);
  useDebouncedSave(loaded, DEVICE_KEY, device);
  useDebouncedSave(loaded, SYNC_KEY, syncData);

  /* ------------------------------ Données ------------------------------- */

  const state = useMemo<AppState | null>(() => {
    if (device?.lobby && syncData) return reduceAll(syncData.confirmed, syncData.pending.map((p) => p.op));
    return local;
  }, [device?.lobby, syncData, local]);

  const dispatch = useCallback(
    (op: Op) => {
      const cur = syncRef.current;
      if (deviceRef.current?.lobby && cur) {
        commitSync({ ...cur, pending: [...cur.pending, { opId: uid(), op }] });
        kickRef.current();
      } else {
        setLocal((prev) => (prev ? reduce(prev, op) : prev));
      }
    },
    [commitSync],
  );

  const updateDevice = useCallback(
    (patch: Partial<DeviceState>) => {
      if (deviceRef.current) commitDevice({ ...deviceRef.current, ...patch });
    },
    [commitDevice],
  );

  const setSession = useCallback((patch: Partial<Session>) => setSessionState((s) => ({ ...s, ...patch })), []);

  /** Intègre les opérations confirmées par le serveur, dans l'ordre. */
  const applyEvents = useCallback(
    (lobbyId: string, events: RemoteEvent[]) => {
      const cur = syncRef.current;
      if (!cur || cur.lobbyId !== lobbyId || events.length === 0) return;
      let { confirmed, seq } = cur;
      const confirmedIds = new Set<string>();
      for (const ev of events) {
        if (ev.seq <= seq) continue;
        confirmed = reduce(confirmed, ev.op);
        seq = ev.seq;
        confirmedIds.add(ev.op_id);
      }
      commitSync({ ...cur, confirmed, seq, pending: cur.pending.filter((p) => !confirmedIds.has(p.opId)) });
    },
    [commitSync],
  );

  /* ------------------------ Boucle de synchronisation ------------------------ */

  const lobbyId = device?.lobby?.lobbyId ?? null;

  useEffect(() => {
    const lobby = deviceRef.current?.lobby;
    if (!lobby || !lobbyId) {
      setSync({ status: 'local', lastSync: null, error: null });
      return;
    }
    let stopped = false;
    let busy = false;
    let again = false;
    const sent = new Set<string>();
    setSync((s) => ({ ...s, status: s.status === 'ok' ? 'ok' : 'connexion', error: null }));

    const tick = async () => {
      if (stopped) return;
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const cur = syncRef.current;
        if (!cur || cur.lobbyId !== lobby.lobbyId) return;
        const toSend = cur.pending.filter((p) => !sent.has(p.opId)).slice(0, 150);
        if (toSend.length) {
          await backend.push(lobby.server, lobby.lobbyId, toSend.map((p) => ({ op_id: p.opId, op: p.op })));
          toSend.forEach((p) => sent.add(p.opId));
        }
        let closed = false;
        for (let page = 0; page < 20; page++) {
          const after = syncRef.current?.seq ?? 0;
          const res = await backend.pull(lobby.server, lobby.lobbyId, after);
          closed = res.closed;
          applyEvents(lobby.lobbyId, res.events);
          if (res.events.length < 500) break;
        }
        const after = syncRef.current;
        if (after && after.seq - after.snapshotSeq >= SNAPSHOT_EVERY) {
          await backend.saveSnapshot(lobby.server, lobby.lobbyId, after.confirmed, after.seq);
          if (syncRef.current) commitSync({ ...syncRef.current, snapshotSeq: after.seq });
        }
        if (!stopped) setSync({ status: closed ? 'ferme' : 'ok', lastSync: Date.now(), error: null });
      } catch (e) {
        if (!stopped) setSync((s) => ({ ...s, status: 'hors_ligne', error: errorMessage(e) }));
      } finally {
        busy = false;
        if (again && !stopped) {
          again = false;
          setTimeout(tick, 0);
        }
      }
    };

    kickRef.current = () => setTimeout(tick, 0);
    tick();
    const timer = setInterval(tick, POLL_MS);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') tick();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
      kickRef.current = () => {};
    };
  }, [lobbyId, applyEvents, commitSync]);

  /* --------------------------- Gestion du lobby --------------------------- */

  const createLobby = useCallback(
    async (rawServer: ServerConfig) => {
      const server = normalizeServer(rawServer);
      const snapshot = state ?? createInitialState();
      const res = await backend.createLobby(server, snapshot);
      commitSync({ lobbyId: res.lobby_id, seq: 0, snapshotSeq: 0, confirmed: snapshot, pending: [] });
      if (deviceRef.current) {
        commitDevice({ ...deviceRef.current, server, lobby: { lobbyId: res.lobby_id, code: res.code, server } });
      }
      return res.code;
    },
    [state, commitSync, commitDevice],
  );

  const joinLobby = useCallback(
    async (rawServer: ServerConfig, code: string, profile: { name: string; role: Role }) => {
      const server = normalizeServer(rawServer);
      const res = await backend.joinLobby(server, code);
      let confirmed = res.snapshot;
      let seq = res.snapshot_seq;
      for (let page = 0; page < 50; page++) {
        const pulled = await backend.pull(server, res.lobby_id, seq);
        for (const ev of pulled.events) {
          if (ev.seq > seq) {
            confirmed = reduce(confirmed, ev.op);
            seq = ev.seq;
          }
        }
        if (pulled.events.length < 500) break;
      }
      const name = profile.name.trim() || 'Serveur';
      const pending: PendingOp[] = confirmed.servers.includes(name)
        ? []
        : [{ opId: uid(), op: { t: 'addServer', name } }];
      commitSync({ lobbyId: res.lobby_id, seq, snapshotSeq: res.snapshot_seq, confirmed, pending });
      if (deviceRef.current) {
        commitDevice({
          ...deviceRef.current,
          server,
          currentServer: name,
          role: profile.role,
          lobby: { lobbyId: res.lobby_id, code: res.code, server },
        });
      }
    },
    [commitSync, commitDevice],
  );

  const leaveLobby = useCallback(() => {
    // Le gérant garde une copie des données du restaurant sur son appareil.
    if ((session.manager || session.admin) && state) setLocal(state);
    commitSync(null);
    if (deviceRef.current) commitDevice({ ...deviceRef.current, lobby: null });
  }, [session, state, commitSync, commitDevice]);

  const closeLobby = useCallback(async () => {
    const lobby = deviceRef.current?.lobby;
    if (lobby) await backend.closeLobby(lobby.server, lobby.lobbyId);
    leaveLobby();
  }, [leaveLobby]);

  const clearInvite = useCallback(() => setInvite(null), []);

  if (!loaded || !state || !device) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        state,
        device,
        dispatch,
        updateDevice,
        session,
        setSession,
        sync,
        pendingCount: syncData?.pending.length ?? 0,
        invite,
        clearInvite,
        createLobby,
        joinLobby,
        leaveLobby,
        closeLobby,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return value;
}

/** Retourne l'heure courante, rafraîchie à intervalle régulier (pour les chronos). */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
