import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { licenseStatus } from '../license/license';
import { useNow, useStore } from '../store/StoreProvider';
import { colors } from '../theme';
import { formatLongDate } from './PaymentCalendar';

/** Bandeau permanent en haut de l'écran pendant les 5 jours qui précèdent l'échéance. */
export function ReminderBanner() {
  const { state } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(15000);
  const status = licenseStatus(state.license, now);
  if (!status.inReminderWindow || !status.dueDate) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Payer l’abonnement"
      onPress={() => router.push('/abonnement')}
      style={[styles.banner, { paddingTop: insets.top + 8 }]}
    >
      <Ionicons name="alarm" size={18} color={colors.ink} />
      <Text style={styles.text} numberOfLines={2}>
        Paiement dû le {formatLongDate(status.dueDate)}
        {status.daysLeft !== null ? ` · J-${status.daysLeft}` : ''} — touchez pour payer
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.goldLight,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 13 },
});
