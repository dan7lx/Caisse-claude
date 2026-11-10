import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Field, notify, SectionTitle } from '../../components/ui';
import { updateSettings } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors } from '../../theme';

export default function RestaurantScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const s = state.settings;
  const [name, setName] = useState(s.restaurantName);
  const [currency, setCurrency] = useState(s.currency);
  const [taxRate, setTaxRate] = useState(String(s.taxRate).replace('.', ','));
  const [alertMinutes, setAlertMinutes] = useState(String(s.alertMinutes));

  const save = () => {
    const tax = parseFloat(taxRate.replace(',', '.'));
    const alert = parseInt(alertMinutes, 10);
    if (!name.trim()) return notify('Nom manquant', 'Indiquez le nom du restaurant.');
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) return notify('TVA invalide', 'Indiquez un taux entre 0 et 100.');
    if (!Number.isFinite(alert) || alert < 1) return notify('Délai invalide', 'Indiquez un nombre de minutes (1 ou plus).');
    dispatch(
      updateSettings({
        restaurantName: name.trim(),
        currency: currency.trim() || '€',
        taxRate: tax,
        alertMinutes: alert,
      }),
    );
    router.back();
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Restaurant' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Établissement</SectionTitle>
        <Card style={styles.card}>
          <Field label="Nom du restaurant" value={name} onChangeText={setName} />
          <Field label="Devise" value={currency} onChangeText={setCurrency} hint="Symbole affiché après les prix (€, CHF, $…)." />
        </Card>
        <SectionTitle>Fiscalité</SectionTitle>
        <Card style={styles.card}>
          <Field
            label="Taux de TVA (%)"
            value={taxRate}
            onChangeText={setTaxRate}
            keyboardType="decimal-pad"
            hint="Les prix sont saisis TTC ; ce taux sert à afficher la TVA incluse à l’encaissement."
          />
        </Card>
        <SectionTitle>Cuisine & bar</SectionTitle>
        <Card style={styles.card}>
          <Field
            label="Alerte de retard (minutes)"
            value={alertMinutes}
            onChangeText={setAlertMinutes}
            keyboardType="number-pad"
            hint="Un ticket passe en rouge au-delà de ce délai."
          />
        </Card>
        <Button title="Enregistrer" icon="checkmark" onPress={save} style={styles.save} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  card: { gap: 14 },
  save: { marginTop: 24 },
});
