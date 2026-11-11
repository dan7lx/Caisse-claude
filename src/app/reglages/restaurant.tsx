import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { useToast } from '../../components/Toast';
import { Button, Card, Chip, Field, notify, SectionTitle, SwitchRow } from '../../components/ui';
import { updateSettings } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors } from '../../theme';

const AUTO_LOCK = [
  { value: -1, label: 'Automatique' },
  { value: 0, label: 'Jamais' },
  { value: 2, label: '2 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 30, label: '30 min' },
];

function PreferencesScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const toast = useToast();
  const s = state.settings;
  const [currency, setCurrency] = useState(s.currency);
  const [alertMinutes, setAlertMinutes] = useState(String(s.alertMinutes));
  const [returnAfterSend, setReturnAfterSend] = useState(s.returnAfterSend);
  const [autoLock, setAutoLock] = useState(s.autoLockMinutes);

  const save = () => {
    const alert = parseInt(alertMinutes, 10);
    if (!Number.isFinite(alert) || alert < 1) return notify('Délai invalide', 'Indiquez un nombre de minutes (1 ou plus).');
    dispatch(
      updateSettings({
        currency: currency.trim() || '€',
        alertMinutes: alert,
        returnAfterSend,
        autoLockMinutes: autoLock,
      }),
    );
    toast('Préférences enregistrées', '⚙️');
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Préférences' }} />

      <SectionTitle>Caisse</SectionTitle>
      <Card style={styles.card}>
        <Field label="Devise" value={currency} onChangeText={setCurrency} hint="Symbole affiché après les prix (€, CHF, $…)." />
        <Text style={styles.vatInfo}>
          TVA : choisie à chaque encaissement (0, 6, 12 ou 21 %) et ajoutée au montant. Les prix de la carte sont donc saisis hors TVA.
        </Text>
      </Card>

      <SectionTitle>Service</SectionTitle>
      <Card style={styles.card}>
        <SwitchRow
          label="Revenir au plan de salle après « Envoyer »"
          hint="Le serveur enchaîne avec la table suivante."
          value={returnAfterSend}
          onChange={setReturnAfterSend}
        />
        <Field
          label="Alerte de retard cuisine / bar (minutes)"
          value={alertMinutes}
          onChangeText={setAlertMinutes}
          keyboardType="number-pad"
          hint="Un ticket passe en rouge au-delà de ce délai."
        />
      </Card>

      <SectionTitle>Sécurité</SectionTitle>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Emoji3D emoji="🔒" size={30} />
          <Text style={styles.label}>Verrouiller la Gestion après</Text>
        </View>
        <View style={styles.chips}>
          {AUTO_LOCK.map((o) => (
            <Chip key={o.value} label={o.label} selected={autoLock === o.value} color={colors.goldDeep} onPress={() => setAutoLock(o.value)} />
          ))}
        </View>
        <Text style={styles.hint}>
          {autoLock === -1
            ? 'Automatique : dès qu’on quitte la Gestion (autre onglet, application fermée), le code gérant est redemandé pour y revenir.'
            : 'Sans activité pendant ce délai, le code gérant est redemandé.'}
        </Text>
      </Card>

      <Button title="Enregistrer" icon="checkmark" large onPress={save} style={styles.save} />
    </ScrollView>
  );
}

export default function PreferencesRoute() {
  return (
    <ManagerGate>
      <PreferencesScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { gap: 14 },
  vatInfo: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontWeight: '700', fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 12, color: colors.muted },
  save: { marginTop: 20 },
});
