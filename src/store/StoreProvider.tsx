import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '../theme';
import { createDemoState } from './defaults';
import type { AppState, Updater } from './types';

const STORAGE_KEY = 'caisse-resto:v1';

interface StoreValue {
  state: AppState;
  dispatch: (updater: Updater) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement initial depuis le stockage de l'appareil.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed = raw ? (JSON.parse(raw) as AppState) : null;
        if (!cancelled) setState(parsed?.version === 1 ? parsed : createDemoState());
      })
      .catch(() => {
        if (!cancelled) setState(createDemoState());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sauvegarde automatique (regroupée pour éviter d'écrire à chaque frappe).
  useEffect(() => {
    if (!state) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
  }, [state]);

  const dispatch = useCallback((updater: Updater) => {
    setState((prev) => (prev ? updater(prev) : prev));
  }, []);

  if (!state) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
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
