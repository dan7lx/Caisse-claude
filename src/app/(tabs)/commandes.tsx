import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Badge, Empty, Segmented } from '../../components/ui';
import { countByStatus, openOrders, orderTotal, tableState } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import type { Order } from '../../store/types';
import { colors, fonts, lineStatusStyle, shadow, tableStateStyle } from '../../theme';
import { formatElapsed, formatPrice } from '../../utils/format';
import { useLayout } from '../../utils/layout';

type Filter = 'toutes' | 'miennes' | 'a_servir';

export default function OrdersScreen() {
  const { state, device } = useStore();
  const router = useRouter();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('toutes');
  const { small } = useLayout();

  const me = device.currentServer;
  const all = openOrders(state).sort((a, b) => a.createdAt - b.createdAt);
  const orders = all.filter((o) => {
    if (filter === 'miennes') return o.server === me;
    if (filter === 'a_servir') return o.lines.some((l) => l.status === 'pret');
    return true;
  });
  const toServe = all.filter((o) => o.lines.some((l) => l.status === 'pret')).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Commandes" subtitle="En cours" />
            <View style={styles.header}>
              <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'toutes', label: small ? `Toutes ${all.length}` : `Toutes (${all.length})` },
                  { value: 'miennes', label: small ? 'Moi' : 'Les miennes' },
                  { value: 'a_servir', label: small ? `Servir ${toServe}` : `À servir (${toServe})` },
                ]}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          <Empty
            icon="receipt-outline"
            emoji={filter === 'a_servir' ? '🛎️' : '🧾'}
            title={filter === 'a_servir' ? 'Rien à servir' : 'Aucune commande en cours'}
            subtitle="Les commandes s’ouvrent depuis le plan de salle."
          />
        }
        renderItem={({ item }) => (
          <OrderCard order={item} now={now} currency={state.settings.currency} onPress={() => router.push(`/commande/${item.id}`)} />
        )}
      />
    </View>
  );
}

/** « 3 prêts », « 1 envoyé », « 2 en préparation » */
function plural(n: number, label: string): string {
  return `${n} ${label}${n > 1 && !label.includes(' ') ? 's' : ''}`;
}

interface OrderCardProps {
  order: Order;
  now: number;
  currency: string;
  onPress: () => void;
}

function OrderCard({ order, now, currency, onPress }: OrderCardProps) {
  const st = tableStateStyle[tableState(order)];
  const counts = countByStatus(order);
  const statuses = (['brouillon', 'envoye', 'en_preparation', 'pret'] as const).filter((s) => counts[s] > 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${order.label}, ${st.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.side, { backgroundColor: st.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Emoji3D emoji={counts.pret ? '🛎️' : counts.brouillon ? '✏️' : counts.envoye + counts.en_preparation ? '🔥' : '🍽️'} size={28} />
          <Text style={[styles.cardTitle, styles.flex]}>{order.label}</Text>
          <Text style={styles.cardTotal}>{formatPrice(orderTotal(order), currency)}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Ionicons name="person" size={13} color={colors.goldDeep} />
          <Text style={styles.metaText}>{order.server}</Text>
          <Ionicons name="people" size={13} color={colors.goldDeep} />
          <Text style={styles.metaText}>{order.guests}</Text>
          <Ionicons name="time" size={13} color={colors.goldDeep} />
          <Text style={styles.metaText}>{formatElapsed(now - order.createdAt)}</Text>
          <Text style={styles.metaText}>· n°{order.number}</Text>
        </View>
        <View style={styles.badges}>
          {statuses.length === 0 && counts.servi === 0 ? <Badge label="Vide" color={colors.muted} soft={colors.line} /> : null}
          {statuses.map((s) => (
            <Badge key={s} label={plural(counts[s], lineStatusStyle[s].label.toLowerCase())} color={lineStatusStyle[s].color} soft={lineStatusStyle[s].soft} />
          ))}
          {counts.servi > 0 ? (
            <Badge label={plural(counts.servi, 'servi')} color={lineStatusStyle.servi.color} soft={lineStatusStyle.servi.soft} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { marginBottom: 6 },
  list: { padding: 16, paddingTop: 10, gap: 12, width: '100%', maxWidth: 900, alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow,
  },
  side: { width: 6 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  cardTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 21, color: colors.text },
  cardTotal: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19, color: colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: colors.muted, marginRight: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
