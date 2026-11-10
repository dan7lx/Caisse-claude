import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Chip, confirm, ListRow, SectionTitle } from '../../components/ui';
import { resetDemo, updateSettings, wipeAll } from '../../store/actions';
import { openOrders, salesStats, startOfDay } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import { colors } from '../../theme';
import { formatPrice } from '../../utils/format';

export default function ManagementScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const today = salesStats(state.orders.filter((o) => (o.paidAt ?? 0) >= startOfDay()));
  const unavailable = state.items.filter((i) => !i.available).length;
  const zones = new Set(state.tables.map((t) => t.zone)).size;
  const hasOpenOrders = openOrders(state).length > 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.serverCard}>
        <View style={styles.serverHead}>
          <Ionicons name="person-circle" size={22} color={colors.primary} />
          <Text style={styles.serverTitle}>Serveur sur cet appareil</Text>
        </View>
        <View style={styles.chips}>
          {state.servers.map((s) => (
            <Chip
              key={s}
              label={s}
              color={colors.primary}
              selected={s === state.settings.currentServer}
              onPress={() => dispatch(updateSettings({ currentServer: s }))}
            />
          ))}
        </View>
      </Card>

      <View style={styles.stats}>
        <Stat label="CA du jour" value={formatPrice(today.revenue, state.settings.currency)} />
        <Stat label="Tickets" value={String(today.count)} />
        <Stat label="Ticket moyen" value={formatPrice(today.average, state.settings.currency)} />
      </View>

      <SectionTitle>La carte</SectionTitle>
      <View style={styles.group}>
        <ListRow
          icon="fast-food-outline"
          iconColor={colors.primary}
          title="Articles & prix"
          subtitle={`${state.items.length} articles${unavailable ? ` · ${unavailable} épuisé(s)` : ''}`}
          chevron
          onPress={() => router.push('/reglages/articles')}
        />
        <ListRow
          icon="pricetags-outline"
          iconColor="#8B5CF6"
          title="Catégories"
          subtitle={`${state.categories.length} catégories · envoi cuisine ou bar`}
          chevron
          onPress={() => router.push('/reglages/categories')}
        />
      </View>

      <SectionTitle>La salle</SectionTitle>
      <View style={styles.group}>
        <ListRow
          icon="grid-outline"
          iconColor={colors.busy}
          title="Tables & zones"
          subtitle={`${state.tables.length} tables · ${zones} zone(s)`}
          chevron
          onPress={() => router.push('/reglages/tables')}
        />
        <ListRow
          icon="people-outline"
          iconColor={colors.free}
          title="Serveurs"
          subtitle={`${state.servers.length} serveur(s)`}
          chevron
          onPress={() => router.push('/reglages/serveurs')}
        />
      </View>

      <SectionTitle>Établissement</SectionTitle>
      <View style={styles.group}>
        <ListRow
          icon="storefront-outline"
          iconColor={colors.dark}
          title="Restaurant, TVA & cuisine"
          subtitle={`${state.settings.restaurantName} · TVA ${state.settings.taxRate} % · alerte ${state.settings.alertMinutes} min`}
          chevron
          onPress={() => router.push('/reglages/restaurant')}
        />
        <ListRow
          icon="stats-chart-outline"
          iconColor={colors.ready}
          title="Historique & statistiques"
          subtitle="Ventes, moyens de paiement, meilleures ventes"
          chevron
          onPress={() => router.push('/reglages/historique')}
        />
      </View>

      <SectionTitle>Données</SectionTitle>
      <View style={styles.group}>
        <ListRow
          icon="refresh-outline"
          iconColor={colors.muted}
          title="Recharger les données de démonstration"
          subtitle="Remplace la carte, les tables et l’historique"
          onPress={() =>
            confirm(
              'Recharger la démo ?',
              'Toutes vos données (carte, tables, commandes) seront remplacées.',
              () => dispatch(resetDemo),
              'Recharger',
            )
          }
        />
        <ListRow
          icon="trash-outline"
          iconColor={colors.danger}
          title="Partir de zéro"
          subtitle="Vide la carte, les tables et les commandes"
          onPress={() =>
            confirm(
              'Tout effacer ?',
              hasOpenOrders
                ? 'Des commandes sont en cours. Elles seront aussi supprimées. Cette action est définitive.'
                : 'La carte, les tables et l’historique seront supprimés. Cette action est définitive.',
              () => dispatch(wipeAll),
              'Tout effacer',
            )
          }
        />
      </View>
      <Text style={styles.footnote}>Les données sont enregistrées sur cet appareil.</Text>
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
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  serverCard: { gap: 10 },
  serverHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serverTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  group: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  footnote: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 20 },
});
