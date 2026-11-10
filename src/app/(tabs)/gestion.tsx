import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ManagerGate } from '../../components/ManagerGate';
import { formatLongDate } from '../../components/PaymentCalendar';
import { Button, confirm, Group, ListRow, notify, PinPad, SectionTitle } from '../../components/ui';
import { hashManagerPin, licenseStatus } from '../../license/license';
import { resetDemo, setManagerPin, wipeAll } from '../../store/actions';
import { openOrders, salesStats, startOfDay } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';

export default function ManagementTab() {
  return (
    <ManagerGate>
      <ManagementScreen />
    </ManagerGate>
  );
}

function ManagementScreen() {
  const { state, device, session, setSession, dispatch } = useStore();
  const router = useRouter();
  const [changingPin, setChangingPin] = useState<null | 'new' | 'confirm'>(null);
  const [newPin, setNewPin] = useState('');

  const today = salesStats(state.orders.filter((o) => (o.paidAt ?? 0) >= startOfDay()));
  const unavailable = state.items.filter((i) => !i.available).length;
  const zones = new Set(state.tables.map((t) => t.zone)).size;
  const hasOpenOrders = openOrders(state).length > 0;
  const lic = licenseStatus(state.license);
  const licenseText =
    lic.plan === 'vie'
      ? 'Licence à vie'
      : lic.active && lic.dueDate
        ? `Mensuel · prochaine échéance le ${formatLongDate(lic.dueDate)}`
        : 'Inactif';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.flex}>
          <Text style={styles.heroLabel}>{session.admin ? 'ADMINISTRATEUR' : 'GÉRANT'}</Text>
          <Text style={styles.heroTitle}>{state.settings.restaurantName}</Text>
          <Text style={styles.heroSub}>
            {device.lobby ? `Lobby ${device.lobby.code} · équipe connectée` : 'Appareil seul (pas de lobby)'}
          </Text>
        </View>
        <Button
          title="Verrouiller"
          icon="lock-closed"
          small
          variant="primary"
          onPress={() => setSession({ manager: false, admin: false })}
        />
      </View>

      <View style={styles.stats}>
        <Stat label="CA du jour" value={formatPrice(today.revenue, state.settings.currency)} />
        <Stat label="Tickets" value={String(today.count)} />
        <Stat label="Ticket moyen" value={formatPrice(today.average, state.settings.currency)} />
      </View>

      <SectionTitle>La carte</SectionTitle>
      <Group>
        <ListRow
          icon="fast-food"
          iconColor="#B5502A"
          title="Articles & prix"
          subtitle={`${state.items.length} articles${unavailable ? ` · ${unavailable} épuisé(s)` : ''}`}
          chevron
          onPress={() => router.push('/reglages/articles')}
        />
        <ListRow
          icon="pricetags"
          iconColor="#A23B6B"
          title="Catégories"
          subtitle={`${state.categories.length} catégories · envoi cuisine ou bar`}
          chevron
          onPress={() => router.push('/reglages/categories')}
        />
      </Group>

      <SectionTitle>La salle & l’équipe</SectionTitle>
      <Group>
        <ListRow
          icon="grid"
          iconColor={colors.busy}
          title="Tables & zones"
          subtitle={`${state.tables.length} tables · ${zones} zone(s)`}
          chevron
          onPress={() => router.push('/reglages/tables')}
        />
        <ListRow
          icon="people"
          iconColor={colors.free}
          title="Serveurs"
          subtitle={`${state.servers.length} serveur(s)`}
          chevron
          onPress={() => router.push('/reglages/serveurs')}
        />
        <ListRow
          icon="wifi"
          iconColor={colors.goldDeep}
          title="Lobby de l’équipe"
          subtitle={device.lobby ? `Code ${device.lobby.code}` : 'Créer un lobby avec code d’accès'}
          chevron
          onPress={() => router.push('/equipe')}
        />
      </Group>

      <SectionTitle>Établissement</SectionTitle>
      <Group>
        <ListRow
          icon="storefront"
          iconColor={colors.ink}
          title="Restaurant & préférences"
          subtitle={`TVA ${state.settings.taxRate} % · alerte cuisine ${state.settings.alertMinutes} min`}
          chevron
          onPress={() => router.push('/reglages/restaurant')}
        />
        <ListRow
          icon="stats-chart"
          iconColor={colors.ready}
          title="Historique & statistiques"
          subtitle="Ventes, paiements, meilleures ventes"
          chevron
          onPress={() => router.push('/reglages/historique')}
        />
        <ListRow
          icon="diamond"
          iconColor={colors.gold}
          title="Abonnement"
          subtitle={licenseText}
          chevron
          onPress={() => router.push('/abonnement')}
        />
      </Group>

      <SectionTitle>Sécurité</SectionTitle>
      <Group>
        <ListRow
          icon="key"
          iconColor={colors.wine}
          title="Code gérant"
          subtitle="Protège la Gestion et la création du lobby"
          chevron
          onPress={() => setChangingPin('new')}
        />
        {session.admin ? (
          <ListRow
            icon="shield-checkmark"
            iconColor={colors.danger}
            title="Administration"
            subtitle="Licences, accès du gérant, codes d’activation"
            chevron
            onPress={() => router.push('/reglages/admin')}
          />
        ) : null}
      </Group>

      <SectionTitle>Données</SectionTitle>
      <Group>
        <ListRow
          icon="refresh"
          iconColor={colors.muted}
          title="Recharger la carte de démonstration"
          subtitle="Remplace la carte, les tables et l’historique"
          onPress={() =>
            confirm('Recharger la démo ?', 'La carte, les tables et les commandes seront remplacées.', () => dispatch(resetDemo()), 'Recharger')
          }
        />
        <ListRow
          icon="trash"
          iconColor={colors.danger}
          title="Partir de zéro"
          subtitle="Vide la carte, les tables et les commandes"
          onPress={() =>
            confirm(
              'Tout effacer ?',
              hasOpenOrders
                ? 'Des commandes sont en cours. Elles seront aussi supprimées. Action définitive.'
                : 'La carte, les tables et l’historique seront supprimés. Action définitive.',
              () => dispatch(wipeAll(state.settings, state.servers)),
              'Tout effacer',
            )
          }
        />
      </Group>
      <Text style={styles.footnote}>
        {device.lobby ? 'Les modifications sont partagées avec toute l’équipe du lobby.' : 'Les données sont enregistrées sur cet appareil.'}
      </Text>

      <Modal visible={changingPin !== null} animationType="slide" onRequestClose={() => setChangingPin(null)}>
        <View style={styles.pinScreen}>
          {changingPin === 'new' ? (
            <PinPad
              key="new"
              title="Nouveau code gérant"
              subtitle="4 à 8 chiffres"
              submitLabel="Continuer"
              onSubmit={(c) => {
                setNewPin(c);
                setChangingPin('confirm');
                return null;
              }}
            />
          ) : (
            <PinPad
              key="confirm"
              title="Confirmez le code"
              onSubmit={(c) => {
                if (c !== newPin) {
                  setChangingPin('new');
                  return 'Les deux codes sont différents.';
                }
                dispatch(setManagerPin(hashManagerPin(c, state.license.id)));
                setChangingPin(null);
                notify('Code gérant', 'Le nouveau code gérant est enregistré.');
                return null;
              }}
            />
          )}
          <Button title="Annuler" variant="ghost" icon="close" onPress={() => setChangingPin(null)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  heroLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 26, marginTop: 2 },
  heroSub: { color: colors.onDarkMuted, fontSize: 13, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  statValue: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19, color: colors.text },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  footnote: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 20 },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
