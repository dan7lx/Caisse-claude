import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canManage, identifyCode } from '../license/access';
import { hashManagerPin } from '../license/license';
import { setManagerPin } from '../store/actions';
import { useNow, useStore } from '../store/StoreProvider';
import { colors } from '../theme';
import { Button, notify, PinPad } from './ui';

interface Props {
  children: React.ReactNode;
  /** Réservé à l'administrateur (code admin uniquement). */
  adminOnly?: boolean;
}

/** Message de blocage après trop d'essais (« Réessayez dans 25 s »). */
export function usePinLock(): string | null {
  const { device } = useStore();
  const locked = device.pinLockedUntil !== null && device.pinLockedUntil > Date.now();
  const now = useNow(locked ? 1000 : 60_000);
  if (!device.pinLockedUntil || device.pinLockedUntil <= now) return null;
  const s = Math.ceil((device.pinLockedUntil - now) / 1000);
  return `Trop d’essais. Réessayez dans ${s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`}.`;
}

/**
 * Protège la Gestion : demande le code gérant (ou le code administrateur).
 * À la première ouverture, propose de créer le code gérant.
 */
export function ManagerGate({ children, adminOnly }: Props) {
  const { state, session, setSession, touchSession, recordPinAttempt, dispatch } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const lockedMessage = usePinLock();

  const allowed = adminOnly ? session.admin : canManage(state, session);
  useEffect(() => {
    if (allowed) touchSession();
  }, [allowed, touchSession]);
  if (allowed) return <>{children}</>;

  const sec = state.security;
  const creating = !adminOnly && !sec.managerPinHash && sec.managerCanManage;

  let pad: React.ReactNode;
  if (creating && firstPin === null) {
    pad = (
      <PinPad
        key="create"
        emoji="🔑"
        title="Créez le code gérant"
        subtitle="4 à 8 chiffres. Il protège la Gestion et la création du lobby de l’équipe."
        onSubmit={(code) => {
          setFirstPin(code);
          return null;
        }}
        submitLabel="Continuer"
      />
    );
  } else if (creating) {
    pad = (
      <PinPad
        key="confirm"
        emoji="🔑"
        title="Confirmez le code"
        subtitle="Saisissez le même code une seconde fois."
        length={firstPin?.length}
        onSubmit={(code) => {
          if (code !== firstPin) {
            setFirstPin(null);
            return 'Les deux codes sont différents. Recommencez.';
          }
          dispatch(setManagerPin(hashManagerPin(code, state.license.id), code.length));
          setSession({ manager: true });
          return null;
        }}
      />
    );
  } else {
    pad = (
      <PinPad
        key="unlock"
        emoji={adminOnly ? '🛡️' : '🔐'}
        title={adminOnly ? 'Espace administrateur' : 'Espace gérant'}
        subtitle={
          adminOnly
            ? 'Saisissez le code administrateur.'
            : `Saisissez le code gérant${sec.managerPinLength ? ` (${sec.managerPinLength} chiffres)` : ''} pour accéder à la Gestion.`
        }
        // Ouverture automatique au dernier chiffre du code gérant ; le code admin se valide avec ✓.
        autoTry={
          !adminOnly && sec.managerPinLength && sec.managerCanManage
            ? {
                length: sec.managerPinLength,
                attempt: (code) => {
                  if (identifyCode(state, code) !== 'manager') return false;
                  recordPinAttempt(true);
                  setSession({ manager: true });
                  return true;
                },
              }
            : null
        }
        maxLength={8}
        lockedMessage={lockedMessage}
        onSubmit={(code) => {
          const who = identifyCode(state, code);
          if (who === 'admin') {
            recordPinAttempt(true);
            setSession({ admin: true, manager: true });
            return null;
          }
          if (who === 'manager' && !adminOnly) {
            if (!sec.managerCanManage) return 'L’administrateur a désactivé l’accès gérant.';
            recordPinAttempt(true);
            setSession({ manager: true });
            return null;
          }
          recordPinAttempt(false);
          return 'Code incorrect.';
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      {pad}
      {!creating && !adminOnly && !sec.managerCanManage ? (
        <Text style={styles.note}>Accès gérant désactivé : seul l’administrateur peut ouvrir la Gestion.</Text>
      ) : null}
      {!creating && !adminOnly ? (
        <Button
          title="Code oublié ?"
          variant="ghost"
          onPress={() =>
            notify(
              'Code gérant oublié',
              'Demandez à l’administrateur de le réinitialiser (Gestion › Administration › Réinitialiser le code gérant). Un nouveau code vous sera alors demandé.',
            )
          }
        />
      ) : null}
      {router.canGoBack() ? <Button title="Retour" variant="ghost" icon="arrow-back" onPress={() => router.back()} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { alignItems: 'center', padding: 20, paddingBottom: 48, gap: 6 },
  note: { color: colors.onDarkMuted, textAlign: 'center', maxWidth: 320 },
});
