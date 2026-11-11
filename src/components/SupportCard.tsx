import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORT } from '../config';
import { useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { Emoji3D } from './Emoji3D';
import { notify } from './ui';

/** Contact de l'assistance : WhatsApp ou appel, 24 h/24. */
export function SupportCard({ dark }: { dark?: boolean }) {
  const { state } = useStore();
  const message = encodeURIComponent(
    `Bonjour, j’ai besoin d’aide avec Caisse Resto (${state.settings.restaurantName}, licence ${state.license.id}).`,
  );
  const open = (url: string) => Linking.openURL(url).catch(() => notify('Assistance', `Contactez-nous au ${SUPPORT.phoneLabel}.`));

  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={styles.head}>
        <Emoji3D emoji="👋" size={40} />
        <View style={styles.flex}>
          <Text style={[styles.title, dark && styles.onDark]}>Besoin d’aide ? Nous sommes là.</Text>
          <Text style={[styles.text, dark && styles.onDarkMuted]}>
            En cas de souci ou pour toute question, contactez-nous sur WhatsApp ou par téléphone au{' '}
            <Text style={styles.phone}>{SUPPORT.phoneLabel}</Text> : une réponse rapide, disponible 24 h/24 et 7 j/7.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Écrire sur WhatsApp"
          onPress={() => open(`https://wa.me/${SUPPORT.whatsapp}?text=${message}`)}
          style={({ pressed }) => [styles.btn, styles.whatsapp, pressed && styles.pressed]}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
          <Text style={styles.btnText}>WhatsApp</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Appeler le ${SUPPORT.phoneLabel}`}
          onPress={() => open(`tel:${SUPPORT.phone}`)}
          style={({ pressed }) => [styles.btn, styles.call, pressed && styles.pressed]}
        >
          <Ionicons name="call" size={18} color={colors.ink} />
          <Text style={[styles.btnText, { color: colors.ink }]}>Appeler</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 16, borderRadius: 20, backgroundColor: '#E8F5EC', borderWidth: 1, borderColor: '#BFE3CB', gap: 12 },
  cardDark: { backgroundColor: colors.ink2, borderColor: colors.ink3, marginTop: 0 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19, color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
  onDark: { color: colors.onDark },
  onDarkMuted: { color: colors.onDarkMuted },
  phone: { fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14 },
  whatsapp: { backgroundColor: '#25D366' },
  call: { backgroundColor: colors.gold },
  pressed: { opacity: 0.85 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
