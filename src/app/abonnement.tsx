import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatLongDate, LiveClock, PaymentCalendar } from '../components/PaymentCalendar';
import { SubscriptionPanel } from '../components/SubscriptionPanel';
import { Card, Notice, SectionTitle } from '../components/ui';
import { formatCountdown, licenseStatus } from '../license/license';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';

export default function SubscriptionScreen() {
  const { state } = useStore();
  const demo = licenseStatus(state.license).demo;
  const now = useNow(demo ? 1000 : 30000);
  const status = licenseStatus(state.license, now);

  const title =
    status.plan === 'vie'
      ? 'Licence à vie'
      : status.plan === 'mensuel' && status.active && !status.demo
        ? 'Abonnement mensuel'
        : status.demo
          ? 'Mode démo'
          : 'Aucun abonnement actif';
  const subtitle =
    status.plan === 'vie'
      ? 'Aucune échéance.'
      : status.demo && status.demoEndsAt
        ? `Temps restant : ${formatCountdown(status.demoEndsAt - now)} · ensuite, paiement requis.`
        : status.active && status.dueDate
        ? `Valable jusqu’au ${formatLongDate(status.dueDate)}${status.daysLeft !== null ? ` (encore ${status.daysLeft} j)` : ''}`
        : 'L’application est bloquée tant qu’aucune formule n’est active.';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Abonnement' }} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>VOTRE FORMULE</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSub}>{subtitle}</Text>
      </View>

      {status.inReminderWindow && status.dueDate ? (
        <Notice tone="warning" title="Paiement à effectuer">
          {`Votre abonnement se termine le ${formatLongDate(status.dueDate)}. Renouvelez-le dès maintenant : les 30 jours s’ajoutent à la suite. Sans paiement, l’application sera bloquée automatiquement à cette date.`}
        </Notice>
      ) : null}

      {status.plan !== 'vie' ? (
        <>
          <SectionTitle>Calendrier des paiements</SectionTitle>
          <Card>
            <LiveClock />
            <PaymentCalendar status={status} now={now} />
            <Text style={styles.calendarNote}>
              Chaque paiement donne 30 jours à partir de l’activation de la clé. Les 5 jours qui précèdent la fin sont en
              orange (rappel), le jour de fin en rouge : sans nouvelle clé, l’application se bloque automatiquement et la
              page de paiement revient.
            </Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Formules</SectionTitle>
      <SubscriptionPanel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center', gap: 4 },
  hero: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    marginBottom: 10,
  },
  heroLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 28, marginTop: 4 },
  heroSub: { color: colors.onDarkMuted, marginTop: 6 },
  calendarNote: { color: colors.muted, fontSize: 13, marginTop: 12, lineHeight: 19 },
});
