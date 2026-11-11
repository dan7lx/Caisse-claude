import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { formatCountdown, licenseStatus, type LicenseStatus } from '../license/license';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { Emoji3D } from './Emoji3D';
import { formatLongDate } from './PaymentCalendar';

/** Un bandeau est affiché pendant l'essai gratuit ou les 5 jours qui précèdent l'échéance. */
export const hasStatusStrip = (status: LicenseStatus) => status.demo || status.inReminderWindow;

/** « 23:59:12 » → « 23 h 59 min 12 s » */
function humanCountdown(ms: number): string {
  const [h, m, s] = formatCountdown(ms).split(':');
  return `${parseInt(h, 10)} h ${m} min ${s} s`;
}

/**
 * Bandeau placé juste au-dessus des onglets : toujours visible, sans cacher l'en-tête.
 * Pendant l'essai : temps restant à la seconde et ce qui se passera ensuite.
 * Avant l'échéance mensuelle : rappel de paiement (5 jours avant le 1er).
 */
export function StatusStrip() {
  const { state } = useStore();
  const router = useRouter();
  const narrow = useWindowDimensions().width < 370;
  const coarse = licenseStatus(state.license);
  // Mis à jour chaque seconde pendant l'essai, mais seulement dans ce bandeau.
  const now = useNow(coarse.demo ? 1000 : 15000);
  const status = licenseStatus(state.license, now);
  if (!hasStatusStrip(status)) return null;

  const demo = status.demo && status.demoEndsAt !== null;
  const remaining = demo ? (status.demoEndsAt ?? now) - now : 0;
  const urgent = demo ? remaining < 2 * 3600_000 : (status.daysLeft ?? 9) <= 1;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={demo ? 'Essai gratuit en cours, voir les abonnements' : 'Paiement de l’abonnement à effectuer'}
      onPress={() => router.push('/abonnement')}
      style={({ pressed }) => [styles.strip, urgent && styles.urgent, pressed && { opacity: 0.9 }]}
    >
      <Emoji3D emoji={demo ? '🎁' : '⏰'} size={narrow ? 28 : 34} />
      <View style={styles.flex}>
        {demo ? (
          <>
            <Text style={styles.kicker} numberOfLines={1}>
              ESSAI GRATUIT · TEMPS RESTANT
            </Text>
            <Text style={styles.timer} numberOfLines={1} accessibilityLabel={`Essai gratuit : encore ${humanCountdown(remaining)}`}>
              {humanCountdown(remaining)}
            </Text>
            <Text style={styles.text} numberOfLines={2}>
              À la fin de l’essai, l’application sera bloquée jusqu’au paiement.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title} numberOfLines={1}>
              Paiement dû le {formatLongDate(status.dueDate ?? now)}
            </Text>
            <Text style={styles.text} numberOfLines={2}>
              {status.daysLeft !== null ? `Dans ${status.daysLeft} jour${status.daysLeft > 1 ? 's' : ''}. ` : ''}Sans paiement,
              l’application se bloque automatiquement à cette date.
            </Text>
          </>
        )}
      </View>
      {narrow ? (
        <Ionicons name="chevron-forward" size={22} color={colors.gold} />
      ) : (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{demo ? 'S’abonner' : 'Payer'}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2B2213',
    borderTopWidth: 1,
    borderTopColor: colors.goldDeep,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  urgent: { backgroundColor: '#3A1714', borderTopColor: colors.danger },
  flex: { flex: 1 },
  title: { color: colors.onDark, fontWeight: '800', fontSize: 14 },
  kicker: { color: colors.gold, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  timer: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums', 'tabular-nums'], color: colors.onDark, fontSize: 20 },
  text: { color: colors.onDarkMuted, fontSize: 12, marginTop: 1 },
  cta: { backgroundColor: colors.gold, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  ctaText: { color: colors.ink, fontWeight: '900', fontSize: 13 },
});
