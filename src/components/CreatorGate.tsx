import { useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { isCreatorCode } from '../license/license';
import { colors } from '../theme';
import { Button, PinPad } from './ui';

const MAX_TRIES = 5;
const LOCK_MS = 60_000;

/**
 * Protège une action destructrice (effacer les données) par le code créateur.
 * `ask(action)` ouvre le pavé numérique ; l'action ne s'exécute qu'avec le bon code.
 * 5 erreurs d'affilée bloquent la saisie pendant 1 minute.
 */
export function useCreatorCode() {
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const failures = useRef(0);

  const ask = (action: () => void) => setPending(() => action);
  const close = () => setPending(null);
  const locked = lockedUntil !== null && Date.now() < lockedUntil;

  const modal = (
    <Modal visible={pending !== null} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        <PinPad
          emoji="🛡️"
          title="Code créateur"
          subtitle="Réservé au créateur de l’application : saisissez le code pour autoriser la suppression des données."
          length={4}
          lockedMessage={locked ? 'Trop d’essais. Réessayez dans une minute.' : undefined}
          onSubmit={(code) => {
            if (locked) return 'Trop d’essais. Réessayez dans une minute.';
            if (!isCreatorCode(code)) {
              failures.current += 1;
              if (failures.current >= MAX_TRIES) {
                failures.current = 0;
                setLockedUntil(Date.now() + LOCK_MS);
                return 'Trop d’essais. Réessayez dans une minute.';
              }
              return 'Code créateur incorrect.';
            }
            failures.current = 0;
            const action = pending;
            setPending(null);
            action?.();
            return null;
          }}
        />
        <Button title="Annuler" variant="ghost" onPress={close} />
      </View>
    </Modal>
  );

  return { ask, modal };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', padding: 20, gap: 12 },
});
