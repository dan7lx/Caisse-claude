import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Empty, Segmented } from '../../components/ui';
import { createOrder } from '../../store/actions';
import { uid } from '../../store/defaults';
import { countByStatus, openOrders, orderTotal, tableState } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import type { Order } from '../../store/types';
import { colors, lineStatusStyle, tableStateStyle } from '../../theme';
import { formatElapsed, formatPrice } from '../../utils/format';

type Filter = 'toutes' | 'miennes';

export default function OrdersScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('toutes');

  const me = state.settings.currentServer;
  const orders = openOrders(state)
    .filter((o) => filter === 'toutes' || o.server === me)
    .sort((a, b) => a.createdAt - b.createdAt);

  const newTakeaway = () => {
    const id = uid();
    const count = state.orders.filter((o) => o.tableId === null).length + 1;
    dispatch(createOrder(id, null, `À emporter ${count}`));
    router.push(`/commande/${id}`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Segmented<Filter>
          style={styles.flex}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'toutes', label: 'Toutes' },
            { value: 'miennes', label: 'Les miennes' },
          ]}
        />
        <Button title="À emporter" icon="bag-handle-outline" small variant="dark" onPress={newTakeaway} />
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Empty
            icon="receipt-outline"
            title="Aucune commande en cours"
            subtitle="Ouvrez une table depuis l’onglet Tables ou créez une commande à emporter."
          />
        }
        renderItem={({ item }) => (
          <OrderCard order={item} now={now} currency={state.settings.currency} onPress={() => router.push(`/commande/${item.id}`)} />
        )}
      />
    </View>
  );
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
      style={({ pressed }) => [styles.card, { borderLeftColor: st.color }, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{order.label}</Text>
        <Text style={styles.cardTotal}>{formatPrice(orderTotal(order), currency)}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Ionicons name="person-outline" size={13} color={colors.muted} />
        <Text style={styles.metaText}>{order.server}</Text>
        <Ionicons name="people-outline" size={13} color={colors.muted} />
        <Text style={styles.metaText}>{order.guests}</Text>
        <Ionicons name="time-outline" size={13} color={colors.muted} />
        <Text style={styles.metaText}>{formatElapsed(now - order.createdAt)}</Text>
        <Text style={styles.metaText}>· n°{order.number}</Text>
      </View>
      <View style={styles.badges}>
        {statuses.length === 0 ? <Badge label="Vide" color={colors.muted} soft={colors.bg} /> : null}
        {statuses.map((s) => (
          <Badge key={s} label={plural(counts[s], lineStatusStyle[s].label.toLowerCase())} color={lineStatusStyle[s].color} soft={lineStatusStyle[s].soft} />
        ))}
        {counts.servi > 0 ? (
          <Badge label={plural(counts.servi, 'servi')} color={lineStatusStyle.servi.color} soft={lineStatusStyle.servi.soft} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** « 3 prêts », « 1 envoyé », « 2 en préparation » */
function plural(n: number, label: string): string {
  return `${n} ${label}${n > 1 && !label.includes(' ') ? 's' : ''}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 8, gap: 10, width: '100%', maxWidth: 900, alignSelf: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    padding: 14,
    gap: 8,
  },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardTotal: { fontSize: 18, fontWeight: '800', color: colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 13, color: colors.muted, marginRight: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
