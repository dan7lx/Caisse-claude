import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { BillingInfo } from '../../license/server';
import { colors } from '../../theme';
import { formatPrice, parsePrice } from '../../utils/format';
import { Button, Card, Field, notify, SectionTitle } from '../ui';

const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

interface Props {
  billing: BillingInfo;
  onSave: (b: BillingInfo) => Promise<void>;
  onChangePassword: (next: string) => Promise<void>;
}

/** Paramètres modifiables : commerce, prénom et nom, IBAN, titulaire, WhatsApp, prix, mot de passe. */
export function SettingsPanel({ billing, onSave, onChangePassword }: Props) {
  const [b, setB] = useState({
    business_name: billing.business_name,
    first_name: billing.first_name,
    last_name: billing.last_name,
    iban: billing.iban,
    holder: billing.holder,
    whatsapp: billing.whatsapp,
    monthly: euros(billing.price_monthly),
    lifetime: euros(billing.price_lifetime),
  });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof b>) => setB({ ...b, ...patch });

  const save = async () => {
    const monthly = parsePrice(b.monthly);
    const lifetime = parsePrice(b.lifetime);
    if (!monthly || !lifetime) return notify('Prix invalides', 'Exemple : 45,99');
    setBusy(true);
    try {
      await onSave({
        business_name: b.business_name.trim(),
        first_name: b.first_name.trim(),
        last_name: b.last_name.trim(),
        iban: b.iban.replace(/\s/g, '').toUpperCase(),
        holder: b.holder.trim(),
        whatsapp: b.whatsapp.replace(/[^0-9]/g, ''),
        price_monthly: monthly,
        price_lifetime: lifetime,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <SectionTitle>Page de paiement de vos clients</SectionTitle>
      <Card style={styles.card}>
        <Field label="Nom du commerce" value={b.business_name} onChangeText={(v) => set({ business_name: v })} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Prénom" value={b.first_name} onChangeText={(v) => set({ first_name: v })} />
          </View>
          <View style={styles.flex}>
            <Field label="Nom" value={b.last_name} onChangeText={(v) => set({ last_name: v })} />
          </View>
        </View>
        <Field label="IBAN" value={b.iban} onChangeText={(v) => set({ iban: v })} autoCapitalize="characters" />
        <Field label="Titulaire du compte" value={b.holder} onChangeText={(v) => set({ holder: v })} />
        <Field
          label="WhatsApp (avec indicatif, sans +)"
          value={b.whatsapp}
          onChangeText={(v) => set({ whatsapp: v })}
          keyboardType="phone-pad"
          hint="Les preuves de paiement arrivent sur ce numéro."
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Prix mensuel (€)" value={b.monthly} onChangeText={(v) => set({ monthly: v })} keyboardType="decimal-pad" />
          </View>
          <View style={styles.flex}>
            <Field label="Prix à vie (€)" value={b.lifetime} onChangeText={(v) => set({ lifetime: v })} keyboardType="decimal-pad" />
          </View>
        </View>
        <Text style={styles.hint}>
          Actuellement : mensuel {formatPrice(billing.price_monthly)}, à vie {formatPrice(billing.price_lifetime)}. Les commandes
          déjà créées gardent leur montant.
        </Text>
        <Button title={busy ? 'Enregistrement…' : 'Enregistrer'} icon="checkmark" onPress={save} disabled={busy} />
      </Card>

      <SectionTitle>Mot de passe de l’Espace créateur</SectionTitle>
      <Card style={styles.card}>
        <Field label="Nouveau mot de passe (10 caractères minimum)" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
        <Field label="Confirmer" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
        <Button
          title="Changer le mot de passe"
          icon="key"
          variant="secondary"
          disabled={pw.length < 10 || pw !== pw2}
          onPress={async () => {
            await onChangePassword(pw);
            setPw('');
            setPw2('');
          }}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  card: { gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
