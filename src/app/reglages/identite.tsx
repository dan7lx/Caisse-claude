import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { useToast } from '../../components/Toast';
import { Button, Card, confirm, Field, notify, SectionTitle } from '../../components/ui';
import { updateSettings } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors, fonts } from '../../theme';
import { pickLogo } from '../../utils/pickLogo';

function IdentityScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const s = state.settings;
  const [name, setName] = useState(s.restaurantName);
  const [slogan, setSlogan] = useState(s.slogan);
  const [address, setAddress] = useState(s.address);
  const [phone, setPhone] = useState(s.phone);
  const [vatNumber, setVatNumber] = useState(s.vatNumber);
  const [footer, setFooter] = useState(s.receiptFooter);
  const [loading, setLoading] = useState(false);

  const chooseLogo = async () => {
    setLoading(true);
    try {
      const logo = await pickLogo();
      if (logo) {
        dispatch(updateSettings({ logo }));
        toast('Logo enregistré', '🖼️');
      }
    } catch (e) {
      notify('Logo', e instanceof Error ? e.message : 'Impossible de charger l’image.');
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!name.trim()) return notify('Nom manquant', 'Indiquez le nom du commerce.');
    const vat = vatNumber.trim().toUpperCase();
    if (vat && !/^[A-Z]{2}[0-9A-Z .]{6,14}$/.test(vat)) {
      return notify('N° de TVA', 'Format attendu : code pays puis numéro, ex. BE 0123.456.789.');
    }
    dispatch(
      updateSettings({
        restaurantName: name.trim(),
        slogan: slogan.trim(),
        address: address.trim(),
        phone: phone.trim(),
        vatNumber: vat,
        receiptFooter: footer.trim(),
      }),
    );
    toast('Identité enregistrée', '🏪');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Identité & logo' }} />

      <View style={styles.preview}>
        <Pressable accessibilityRole="button" accessibilityLabel="Changer le logo" onPress={chooseLogo} style={styles.logoWrap}>
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : s.logo ? (
            <Image source={{ uri: s.logo }} style={styles.logo} accessibilityLabel="Logo du commerce" />
          ) : (
            <Emoji3D emoji="🖼️" size={54} />
          )}
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.previewName} numberOfLines={2}>
            {name || 'Nom du commerce'}
          </Text>
          {slogan ? <Text style={styles.previewSlogan}>{slogan}</Text> : null}
          <Text style={styles.previewHint}>Aperçu de l’en-tête et de l’écran d’accueil</Text>
        </View>
      </View>

      <SectionTitle>Logo du commerce</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>
          Choisissez une image carrée de préférence (PNG ou JPG). Elle est recadrée et optimisée automatiquement, puis
          affichée sur le plan de salle, la Gestion et l’écran d’accueil de toute l’équipe.
        </Text>
        <View style={styles.buttons}>
          <Button title={s.logo ? 'Changer le logo' : 'Ajouter un logo'} icon="image" onPress={chooseLogo} disabled={loading} style={styles.flex} />
          {s.logo ? (
            <Button
              title="Retirer"
              icon="trash-outline"
              variant="secondary"
              onPress={() => confirm('Retirer le logo ?', 'Le logo ne sera plus affiché.', () => dispatch(updateSettings({ logo: null })), 'Retirer')}
            />
          ) : null}
        </View>
      </Card>

      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.card}>
        <Field label="Nom du commerce" value={name} onChangeText={setName} />
        <Field label="Slogan (optionnel)" value={slogan} onChangeText={setSlogan} placeholder="ex : Cuisine maison depuis 1987" />
        <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="ex : 12 rue de la Paix, Bruxelles" />
        <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="ex : 02 123 45 67" />
        <Field
          label="N° de TVA de l’entreprise"
          value={vatNumber}
          onChangeText={setVatNumber}
          autoCapitalize="characters"
          placeholder="ex : BE 0123.456.789"
          hint="Imprimé sur les tickets de caisse et les rapports."
        />
      </Card>

      <SectionTitle>Ticket de caisse</SectionTitle>
      <Card style={styles.card}>
        <Field
          label="Message en bas du ticket"
          value={footer}
          onChangeText={setFooter}
          placeholder="ex : Merci de votre visite et à bientôt !"
        />
      </Card>
      <Button title="Enregistrer" icon="checkmark" large onPress={save} style={styles.save} />
    </ScrollView>
  );
}

export default function IdentityRoute() {
  return (
    <ManagerGate>
      <IdentityScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  flex: { flex: 1 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.ink2,
  },
  logo: { width: '100%', height: '100%' },
  previewName: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 24 },
  previewSlogan: { fontFamily: fonts.displayItalic, fontVariant: ['lining-nums'], color: colors.goldLight, fontSize: 15, marginTop: 2 },
  previewHint: { color: colors.onDarkMuted, fontSize: 12, marginTop: 6 },
  card: { gap: 12 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 10 },
  save: { marginTop: 20 },
});
