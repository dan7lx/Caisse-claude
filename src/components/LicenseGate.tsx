import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { licenseStatus, type LicenseStatus } from '../license/license';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { Emoji3D } from './Emoji3D';
import { JoinTeamForm } from './JoinTeamForm';
import { formatLongDate, PaymentCalendar } from './PaymentCalendar';
import { SubscriptionPanel } from './SubscriptionPanel';
import { SupportCard } from './SupportCard';
import { Button, Card } from './ui';

/** Date locale AAAA-MM-JJ (le rappel est fermé pour la journée). */
const todayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Bloque l'application dès que l'abonnement n'est plus payé (vérifié toutes les 15 s). */
export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const now = useNow(15000);
  const status = licenseStatus(state.license, now);
  if (!status.active) return <LockScreen status={status} />;
  return (
    <>
      {children}
      <ReminderModal status={status} now={now} />
    </>
  );
}

function LockScreen({ status }: { status: LicenseStatus }) {
  const { state, device, leaveLobby, invite } = useStore();
  const insets = useSafeAreaInsets();
  const [joining, setJoining] = useState(invite !== null);
  const expired = status.plan === 'mensuel' && status.dueDate !== null;
  const demoOver = !expired && status.demoUsed;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.brand}>
        {state.settings.logo ? (
          <Image source={{ uri: state.settings.logo }} style={styles.logoImage} accessibilityLabel="Logo du restaurant" />
        ) : (
          <View style={styles.logo}>
            <Emoji3D emoji="🍽️" size={46} />
          </View>
        )}
        <Text style={styles.brandName}>Caisse Resto</Text>
        <Text style={styles.restaurant}>{state.settings.restaurantName}</Text>
      </View>

      <View style={[styles.alert, expired || demoOver ? styles.alertDanger : styles.alertInfo]}>
        <Emoji3D emoji={expired ? '🔒' : demoOver ? '⌛' : '✨'} size={34} />
        <View style={styles.flex}>
          <Text style={styles.alertTitle}>
            {expired ? 'Application bloquée' : demoOver ? 'Fin du mode démo' : 'Activez votre abonnement'}
          </Text>
          <Text style={styles.alertText}>
            {expired
              ? `Le paiement dû le ${formatLongDate(status.dueDate ?? Date.now())} n’a pas été effectué. L’accès reprend dès l’activation.`
              : demoOver
                ? 'Vos 24 h d’essai gratuit sont terminées. Choisissez une formule et effectuez le paiement pour continuer.'
                : 'Choisissez une formule, ou essayez gratuitement 24 h avec le mode démo.'}
          </Text>
        </View>
      </View>

      {joining ? (
        <Card style={styles.joinCard}>
          <Text style={styles.cardTitle}>Rejoindre mon équipe</Text>
          <Text style={styles.cardText}>
            Employé d’un restaurant déjà abonné ? Entrez le code du lobby donné par votre gérant.
          </Text>
          <JoinTeamForm />
          <Button title="Voir les abonnements" variant="ghost" onPress={() => setJoining(false)} />
        </Card>
      ) : (
        <>
          <SubscriptionPanel dark />
          <Button
            title="Je suis employé : rejoindre mon équipe"
            variant="secondary"
            icon="people-outline"
            onPress={() => setJoining(true)}
          />
        </>
      )}

      <SupportCard dark />

      {device.lobby ? (
        <Button title="Quitter le lobby de l’équipe" variant="ghost" icon="exit-outline" onPress={leaveLobby} />
      ) : null}
    </ScrollView>
  );
}

/** Rappel de paiement, une fois par jour, pendant les 5 jours qui précèdent le 1er du mois. */
function ReminderModal({ status, now }: { status: LicenseStatus; now: number }) {
  const { device, updateDevice } = useStore();
  const router = useRouter();
  const visible = status.inReminderWindow && device.reminderDismissedOn !== todayKey(now);
  const dismiss = () => updateDevice({ reminderDismissedOn: todayKey(now) });
  if (!visible || !status.dueDate) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Emoji3D emoji="⏰" size={36} />
            <Text style={styles.sheetTitle}>Rappel de paiement</Text>
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollBody}>
            <Text style={styles.sheetText}>
              Votre abonnement mensuel arrive à échéance le{' '}
              <Text style={styles.bold}>{formatLongDate(status.dueDate)}</Text>
              {status.daysLeft !== null ? ` (dans ${status.daysLeft} jour${status.daysLeft > 1 ? 's' : ''})` : ''}. Sans
              paiement, l’application sera bloquée automatiquement à cette date.
            </Text>
            <PaymentCalendar status={status} now={now} compact />
          </ScrollView>
          <View style={styles.sheetActions}>
            <Button title="Plus tard" variant="secondary" onPress={dismiss} style={styles.flex} />
            <Button
              title="Payer"
              icon="card"
              onPress={() => {
                dismiss();
                router.push('/abonnement');
              }}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 20, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  flex: { flex: 1 },
  brand: { alignItems: 'center', gap: 6 },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 84, height: 84, borderRadius: 22, borderWidth: 1.5, borderColor: colors.gold },
  brandName: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 34, color: colors.gold, letterSpacing: 0.5 },
  restaurant: { fontFamily: fonts.displayItalic, fontVariant: ['lining-nums'], fontSize: 17, color: colors.onDarkMuted },
  alert: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  alertDanger: { backgroundColor: '#3A1714', borderColor: '#6B2A24' },
  alertInfo: { backgroundColor: colors.ink2, borderColor: colors.ink3 },
  alertTitle: { color: colors.onDark, fontWeight: '800', fontSize: 16 },
  alertText: { color: colors.onDarkMuted, marginTop: 4, lineHeight: 20 },
  joinCard: { gap: 10 },
  cardTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 22, color: colors.text },
  cardText: { color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(22,18,15,0.6)', justifyContent: 'center', padding: 16 },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetScroll: { flexShrink: 1 },
  sheetScrollBody: { gap: 14 },
  sheetTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 24, color: colors.text },
  sheetText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: 10 },
});
