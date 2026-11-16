import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { playAlertSound, unlockSound } from '../notify/sound';
import { askNotificationPermission, notificationPermission } from '../notify/system';
import { useStore } from '../store/StoreProvider';
import { colors } from '../theme';
import { Button, SwitchRow } from './ui';

/** Réglages des alertes de service sur cet appareil (son, notifications du système). */
export function AlertSettings() {
  const { device, updateDevice } = useStore();
  const alerts = device.alerts ?? { sound: true, system: false };
  const [perm, setPerm] = useState(notificationPermission());

  const enableSystem = async () => {
    const p = await askNotificationPermission();
    setPerm(p);
    updateDevice({ alerts: { ...alerts, system: p === 'granted' } });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>🔔 Alertes de service</Text>
      <Text style={styles.hint}>
        Dans le lobby : la cuisine et le bar sont prévenus de chaque nouvelle commande, d’une annulation ou d’un retard ;
        le serveur est prévenu quand ses plats sont prêts.
      </Text>
      <SwitchRow
        label="Son et vibration"
        hint="Deux bips à chaque alerte (touchez l’écran une fois après l’ouverture pour autoriser le son)."
        value={alerts.sound}
        onChange={(sound) => updateDevice({ alerts: { ...alerts, sound } })}
      />
      <Button
        title="Tester le son"
        icon="volume-high-outline"
        small
        variant="secondary"
        onPress={() => {
          unlockSound();
          setTimeout(() => playAlertSound('haut'), 50);
        }}
      />
      {perm === 'unsupported' ? (
        <Text style={styles.hint}>
          Notifications du téléphone : disponibles une fois l’application ajoutée à l’écran d’accueil (iPhone avec iOS 16.4 ou
          plus récent, Android).
        </Text>
      ) : perm === 'denied' ? (
        <Text style={styles.hint}>Notifications refusées : autorisez-les pour ce site dans les réglages du téléphone.</Text>
      ) : alerts.system && perm === 'granted' ? (
        <SwitchRow
          label="Notifications du téléphone"
          hint="Quand l’application est en arrière-plan (sur iPhone, seulement tant qu’elle n’a pas été mise en veille)."
          value
          onChange={(system) => updateDevice({ alerts: { ...alerts, system } })}
        />
      ) : (
        <Button title="Activer les notifications du téléphone" icon="notifications-outline" small variant="secondary" onPress={enableSystem} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  title: { fontWeight: '800', fontSize: 15, color: colors.text },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
