import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canManage, identifyCode } from '../license/access';
import { hashManagerPin } from '../license/license';
import { setManagerPin } from '../store/actions';
import { useStore } from '../store/StoreProvider';
import { colors } from '../theme';
import { Button, PinPad } from './ui';

interface Props {
  children: React.ReactNode;
  /** Réservé à l'administrateur (code admin uniquement). */
  adminOnly?: boolean;
}

/**
 * Protège la Gestion : demande le code gérant (ou le code administrateur).
 * À la première ouverture, propose de créer le code gérant.
 */
export function ManagerGate({ children, adminOnly }: Props) {
  const { state, session, setSession, dispatch } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstPin, setFirstPin] = useState<string | null>(null);

  const allowed = adminOnly ? session.admin : canManage(state, session);
  if (allowed) return <>{children}</>;

  const sec = state.security;
  const creating = !adminOnly && !sec.managerPinHash && sec.managerCanManage;

  const back = router.canGoBack() ? (
    <Button title="Retour" variant="ghost" icon="arrow-back" onPress={() => router.back()} />
  ) : null;

  let pad: React.ReactNode;
  if (creating && firstPin === null) {
    pad = (
      <PinPad
        key="create"
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
        title="Confirmez le code"
        subtitle="Saisissez le même code une seconde fois."
        onSubmit={(code) => {
          if (code !== firstPin) {
            setFirstPin(null);
            return 'Les deux codes sont différents. Recommencez.';
          }
          dispatch(setManagerPin(hashManagerPin(code, state.license.id)));
          setSession({ manager: true });
          return null;
        }}
      />
    );
  } else {
    pad = (
      <PinPad
        key="unlock"
        title={adminOnly ? 'Espace administrateur' : 'Espace gérant'}
        subtitle={adminOnly ? 'Saisissez le code administrateur.' : 'Saisissez le code gérant pour accéder à la Gestion.'}
        onSubmit={(code) => {
          const who = identifyCode(state, code);
          if (who === 'admin') {
            setSession({ admin: true, manager: true });
            return null;
          }
          if (who === 'manager' && !adminOnly) {
            if (!sec.managerCanManage) return 'L’administrateur a désactivé l’accès gérant.';
            setSession({ manager: true });
            return null;
          }
          return 'Code incorrect.';
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <View style={styles.lock}>
        <Ionicons name="lock-closed" size={28} color={colors.gold} />
      </View>
      {pad}
      {!creating && !adminOnly && !sec.managerCanManage ? (
        <Text style={styles.note}>Accès gérant désactivé : seul l’administrateur peut ouvrir la Gestion.</Text>
      ) : null}
      {back}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { alignItems: 'center', padding: 24, paddingBottom: 48, gap: 12 },
  lock: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { color: colors.onDarkMuted, textAlign: 'center', maxWidth: 320 },
});
