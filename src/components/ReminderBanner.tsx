import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCountdown, licenseStatus, type LicenseStatus } from '../license/license';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { Emoji3D } from './Emoji3D';
import { formatLongDate } from './PaymentCalendar';

/** Un bandeau est affiché pendant la démo ou les 5 jours qui précèdent l'échéance. */
export const hasTopBanner = (status: LicenseStatus) => status.demo || status.inReminderWindow;

/**
 * Bandeau en haut de l'écran : minuteur du mode démo (à la seconde)
 * ou rappel de paiement pendant les 5 jours qui précèdent le 1er du mois.
 */
export function ReminderBanner() {
  const { state } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const coarse = licenseStatus(state.license);
  // Le minuteur de la démo se met à jour chaque seconde, mais seulement dans ce bandeau.
  const now = useNow(coarse.demo ? 1000 : 15000);
  const status = licenseStatus(state.license, now);
  if (!hasTopBanner(status)) return null;

  if (status.demo && status.demoEndsAt) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mode démo, voir les abonnements"
        onPress={() => router.push('/abonnement')}
        style={[styles.banner, styles.demo, { paddingTop: insets.top + 8 }]}
      >
        <Emoji3D emoji="⏱️" size={24} />
        <Text style={styles.demoText} numberOfLines={1}>
          Mode démo · <Text style={styles.timer}>{formatCountdown(status.demoEndsAt - now)}</Text>
        </Text>
        <Text style={styles.demoCta}>S’abonner</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.gold} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Payer l’abonnement"
      onPress={() => router.push('/abonnement')}
      style={[styles.banner, styles.reminder, { paddingTop: insets.top + 8 }]}
    >
      <Emoji3D emoji="⏰" size={24} />
      <Text style={styles.text} numberOfLines={2}>
        Paiement dû le {formatLongDate(status.dueDate ?? now)}
        {status.daysLeft !== null ? ` · J-${status.daysLeft}` : ''} — touchez pour payer
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  reminder: { backgroundColor: colors.goldLight },
  demo: { backgroundColor: '#2B2213', borderBottomWidth: 1, borderBottomColor: colors.goldDeep },
  text: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 13 },
  demoText: { flex: 1, color: colors.onDark, fontWeight: '700', fontSize: 14 },
  timer: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums', 'tabular-nums'], color: colors.gold, fontSize: 16 },
  demoCta: { color: colors.gold, fontWeight: '800', fontSize: 13 },
});
