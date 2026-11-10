import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ManagerGate } from '../../components/ManagerGate';
import { Badge, Button, Card, confirm, Empty, SectionTitle, Segmented } from '../../components/ui';
import { clearHistory } from '../../store/actions';
import { orderTotal, salesStats, startOfDay } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { PaymentMethod } from '../../store/types';
import { colors, paymentLabel } from '../../theme';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

type Period = 'jour' | 'tout';

function HistoryScreen() {
  const { state, dispatch } = useStore();
  const [period, setPeriod] = useState<Period>('jour');
  const currency = state.settings.currency;

  const closed = state.orders
    .filter((o) => o.status !== 'ouverte')
    .filter((o) => period === 'tout' || (o.paidAt ?? 0) >= startOfDay())
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
  const stats = salesStats(closed);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Historique & stats' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'jour', label: 'Aujourd’hui' },
            { value: 'tout', label: 'Tout l’historique' },
          ]}
        />

        <View style={styles.stats}>
          <Stat label="Chiffre d’affaires" value={formatPrice(stats.revenue, currency)} />
          <Stat label="Tickets encaissés" value={String(stats.count)} />
        </View>
        <View style={styles.stats}>
          <Stat label="Ticket moyen" value={formatPrice(stats.average, currency)} />
          <Stat label="Couverts" value={String(stats.guests)} />
        </View>

        <SectionTitle>Par moyen de paiement</SectionTitle>
        <Card style={styles.card}>
          {(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => (
            <View key={m} style={styles.kv}>
              <Text style={styles.k}>{paymentLabel[m]}</Text>
              <Text style={styles.v}>{formatPrice(stats.byPayment[m], currency)}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Meilleures ventes</SectionTitle>
        <Card style={styles.card}>
          {stats.topItems.length === 0 ? <Text style={styles.k}>Aucune vente</Text> : null}
          {stats.topItems.map((i, idx) => (
            <View key={i.name} style={styles.kv}>
              <Text style={styles.k}>
                {idx + 1}. {i.name} <Text style={styles.qty}>× {i.qty}</Text>
              </Text>
              <Text style={styles.v}>{formatPrice(i.total, currency)}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Commandes clôturées</SectionTitle>
        {closed.length === 0 ? <Empty icon="time-outline" title="Aucune commande clôturée" /> : null}
        {closed.map((o) => (
          <View key={o.id} style={styles.order}>
            <View style={styles.flex}>
              <Text style={styles.orderTitle}>
                {o.label} · n°{o.number}
              </Text>
              <Text style={styles.orderMeta}>
                {o.paidAt ? `${formatDate(o.paidAt)} ${formatTime(o.paidAt)}` : ''} · {o.server} ·{' '}
                {o.lines.reduce((n, l) => n + l.qty, 0)} article(s)
              </Text>
            </View>
            {o.status === 'annulee' ? (
              <Badge label="Annulée" color={colors.danger} soft={colors.dangerSoft} />
            ) : (
              <View style={styles.right}>
                <Text style={styles.v}>{formatPrice(orderTotal(o), currency)}</Text>
                <Text style={styles.orderMeta}>{o.payment ? paymentLabel[o.payment] : ''}</Text>
              </View>
            )}
          </View>
        ))}

        {state.orders.some((o) => o.status !== 'ouverte') ? (
          <Button
            title="Effacer l’historique"
            icon="trash-outline"
            variant="secondary"
            style={styles.clear}
            onPress={() =>
              confirm(
                'Effacer l’historique ?',
                'Toutes les commandes encaissées ou annulées seront supprimées. Les commandes en cours sont conservées.',
                () => dispatch(clearHistory),
                'Effacer',
              )
            }
          />
        ) : null}
      </ScrollView>
    </View>
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
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  card: { gap: 10 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  k: { color: colors.text, fontSize: 15, flexShrink: 1 },
  v: { color: colors.text, fontSize: 15, fontWeight: '700' },
  qty: { color: colors.muted },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  orderTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  orderMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  clear: { marginTop: 20 },
});

export default function HistoryScreenRoute() {
  return (
    <ManagerGate>
      <HistoryScreen />
    </ManagerGate>
  );
}
