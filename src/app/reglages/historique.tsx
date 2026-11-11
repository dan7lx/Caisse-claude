import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { PrintPreview } from '../../components/PrintPreview';
import { Badge, Button, Card, confirm, Empty, Notice, SectionTitle, Segmented } from '../../components/ui';
import { closureDoc, type PrintDoc, receiptDoc, statsDoc } from '../../print/doc';
import { clearHistory } from '../../store/actions';
import { orderTotal, salesStats, startOfDay } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { PaymentMethod } from '../../store/types';
import { colors, fonts, paymentLabel } from '../../theme';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

type Period = 'jour' | 'clotures' | 'tout';

function HistoryScreen() {
  const { state, dispatch } = useStore();
  const [period, setPeriod] = useState<Period>('jour');
  const [preview, setPreview] = useState<PrintDoc | null>(null);
  const currency = state.settings.currency;
  const p = (n: number) => formatPrice(n, currency);

  const closed = state.orders
    .filter((o) => o.status !== 'ouverte')
    .filter((o) => period === 'tout' || (o.paidAt ?? 0) >= startOfDay())
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
  const stats = salesStats(closed);
  const closures = [...state.closures].reverse();
  const today = new Date();
  const periodLabel = period === 'jour' ? `du ${formatDate(today.getTime())}/${today.getFullYear()}` : 'complet';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Historique & stats' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'jour', label: 'Aujourd’hui' },
            { value: 'clotures', label: `Clôtures (${state.closures.length})` },
            { value: 'tout', label: 'Tout' },
          ]}
        />

        {period === 'clotures' ? (
          <>
            <Notice title="Clôture automatique à minuit">
              Chaque nuit à minuit, la journée est clôturée (Z de caisse) et le chiffre du jour repart à 0 €. Touchez une
              clôture pour la voir et l’imprimer.
            </Notice>
            {closures.length === 0 ? <Empty icon="time-outline" emoji="🗓️" title="Aucune clôture pour l’instant" subtitle="La première aura lieu ce soir à minuit." /> : null}
            {closures.map((z) => (
              <Pressable
                key={z.date}
                accessibilityRole="button"
                accessibilityLabel={`Clôture du ${z.date.split('-').reverse().join('/')}`}
                onPress={() => setPreview(closureDoc(state, z))}
                style={({ pressed }) => [styles.closure, pressed && styles.pressed]}
              >
                <Emoji3D emoji="🧾" size={36} />
                <View style={styles.flex}>
                  <Text style={styles.closureDate}>Z du {z.date.split('-').reverse().join('/')}</Text>
                  <Text style={styles.meta}>
                    {z.count} ticket(s) · {z.guests} couverts{z.tips ? ` · pourboires ${p(z.tips)}` : ''}
                  </Text>
                </View>
                <Text style={styles.closureAmount}>{p(z.revenue)}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.stats}>
              <Stat emoji="💰" label="Chiffre d’affaires" value={p(stats.revenue)} />
              <Stat emoji="🧾" label="Tickets" value={String(stats.count)} />
            </View>
            <View style={styles.stats}>
              <Stat emoji="💝" label="Pourboires" value={p(stats.tips)} />
              <Stat emoji="📊" label="Ticket moyen" value={p(stats.average)} />
            </View>
            <View style={styles.stats}>
              <Stat emoji="👥" label="Couverts" value={String(stats.guests)} />
              <Stat emoji="🏷️" label="Remises" value={p(stats.discounts)} />
            </View>

            <Button
              title="Imprimer le rapport"
              icon="print"
              onPress={() => setPreview(statsDoc(state, closed, periodLabel))}
              style={styles.printBtn}
            />

            <SectionTitle>Encaissé par moyen de paiement</SectionTitle>
            <Card style={styles.card}>
              {(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => (
                <View key={m} style={styles.kv}>
                  <Text style={styles.k}>{paymentLabel[m]}</Text>
                  <Text style={styles.v}>{p(stats.byPayment[m])}</Text>
                </View>
              ))}
              <View style={[styles.kv, styles.kvTotal]}>
                <Text style={[styles.k, styles.bold]}>Total encaissé (pourboires compris)</Text>
                <Text style={styles.v}>{p(stats.revenue + stats.tips)}</Text>
              </View>
            </Card>

            <SectionTitle>Meilleures ventes</SectionTitle>
            <Card style={styles.card}>
              {stats.topItems.length === 0 ? <Text style={styles.k}>Aucune vente</Text> : null}
              {stats.topItems.map((i, idx) => (
                <View key={i.name} style={styles.kv}>
                  <Text style={styles.k}>
                    {idx + 1}. {i.name} <Text style={styles.qty}>× {i.qty}</Text>
                  </Text>
                  <Text style={styles.v}>{p(i.total)}</Text>
                </View>
              ))}
            </Card>

            <SectionTitle>Tickets (touchez pour réimprimer)</SectionTitle>
            {closed.length === 0 ? <Empty icon="time-outline" emoji="🧾" title="Aucune commande clôturée" /> : null}
            {closed.map((o) => (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={`Ticket ${o.label} n°${o.number}`}
                onPress={() => setPreview(receiptDoc(state, o))}
                style={({ pressed }) => [styles.order, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={styles.orderTitle}>
                    {o.label} · n°{o.number}
                  </Text>
                  <Text style={styles.meta}>
                    {o.paidAt ? `${formatDate(o.paidAt)} ${formatTime(o.paidAt)}` : ''} · {o.server}
                    {o.tip ? ` · pourboire ${p(o.tip)}` : ''}
                    {o.discountPct ? ` · remise ${o.discountPct} %` : ''}
                  </Text>
                </View>
                {o.status === 'annulee' ? (
                  <Badge label="Annulée" color={colors.danger} soft={colors.dangerSoft} />
                ) : (
                  <View style={styles.right}>
                    <Text style={styles.v}>{p(orderTotal(o))}</Text>
                    <Text style={styles.meta}>{o.payment ? paymentLabel[o.payment] : ''}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}

        {state.orders.some((o) => o.status !== 'ouverte') ? (
          <Button
            title="Effacer l’historique des tickets"
            icon="trash-outline"
            variant="ghost"
            style={styles.clear}
            onPress={() =>
              confirm(
                'Effacer l’historique ?',
                'Les tickets encaissés ou annulés seront supprimés. Les clôtures journalières et les commandes en cours sont conservées.',
                () => dispatch(clearHistory),
                'Effacer',
              )
            }
          />
        ) : null}
      </ScrollView>
      <PrintPreview doc={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Emoji3D emoji={emoji} size={26} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HistoryRoute() {
  return (
    <ManagerGate>
      <HistoryScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center', gap: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
  },
  statValue: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 21, color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  printBtn: { marginTop: 14 },
  card: { gap: 10 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  kvTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  k: { color: colors.text, fontSize: 15, flexShrink: 1 },
  v: { color: colors.text, fontSize: 15, fontWeight: '700' },
  bold: { fontWeight: '800' },
  qty: { color: colors.muted },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  pressed: { opacity: 0.75 },
  orderTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  closure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
  },
  closureDate: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.text },
  closureAmount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 20, color: colors.text },
  clear: { marginTop: 20 },
});
