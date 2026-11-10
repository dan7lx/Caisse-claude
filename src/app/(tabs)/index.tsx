import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button, Chip, Empty, SectionTitle } from '../../components/ui';
import { createOrder } from '../../store/actions';
import { uid } from '../../store/defaults';
import { openOrderForTable, orderTotal, tableState } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import type { Table } from '../../store/types';
import { colors, tableStateStyle } from '../../theme';
import { formatElapsed, formatPrice } from '../../utils/format';

const ALL = 'Toutes';

export default function TablesScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const now = useNow();
  const { width } = useWindowDimensions();
  const [zone, setZone] = useState(ALL);

  const zones = useMemo(
    () => Array.from(new Set(state.tables.map((t) => t.zone || 'Salle'))),
    [state.tables],
  );
  const columns = width >= 1000 ? 6 : width >= 700 ? 4 : 3;
  const gap = 10;
  const contentWidth = Math.min(width, 1200) - 32;
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  const counts = { libre: 0, occupee: 0, pret: 0 };
  for (const t of state.tables) {
    const s = tableState(openOrderForTable(state, t.id));
    if (s === 'libre') counts.libre++;
    else counts.occupee++;
    if (s === 'pret') counts.pret++;
  }

  const openTable = (table: Table) => {
    const existing = openOrderForTable(state, table.id);
    if (existing) {
      router.push(`/commande/${existing.id}`);
      return;
    }
    const id = uid();
    dispatch(createOrder(id, table.id, table.name));
    router.push(`/commande/${id}`);
  };

  if (state.tables.length === 0) {
    return (
      <View style={styles.screen}>
        <Empty icon="grid-outline" title="Aucune table" subtitle="Ajoutez vos tables dans l’onglet Gestion.">
          <Button title="Ajouter des tables" icon="add" onPress={() => router.push('/reglages/tables')} />
        </Empty>
      </View>
    );
  }

  const visibleZones = zone === ALL ? zones : [zone];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Summary color={colors.free} label="libres" value={counts.libre} />
        <Summary color={colors.busy} label="occupées" value={counts.occupee} />
        <Summary color={colors.ready} label="prêtes à servir" value={counts.pret} />
        <View style={styles.server}>
          <Ionicons name="person-circle-outline" size={18} color={colors.muted} />
          <Text style={styles.serverText}>{state.settings.currentServer}</Text>
        </View>
      </View>

      {zones.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[ALL, ...zones].map((z) => (
            <Chip key={z} label={z} selected={zone === z} onPress={() => setZone(z)} />
          ))}
        </ScrollView>
      ) : null}

      {visibleZones.map((z) => (
        <View key={z}>
          <SectionTitle>{z}</SectionTitle>
          <View style={[styles.grid, { gap }]}>
            {state.tables
              .filter((t) => (t.zone || 'Salle') === z)
              .map((t) => {
                const order = openOrderForTable(state, t.id);
                const st = tableStateStyle[tableState(order)];
                return (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Table ${t.name}, ${st.label}`}
                    onPress={() => openTable(t)}
                    style={({ pressed }) => [
                      styles.table,
                      { width: cardWidth, backgroundColor: st.soft, borderColor: st.color },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.tableHeader}>
                      <Text style={styles.tableName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <View style={styles.seats}>
                        <Ionicons name="people" size={13} color={colors.muted} />
                        <Text style={styles.seatsText}>{order ? order.guests : t.seats}</Text>
                      </View>
                    </View>
                    <Text style={[styles.tableState, { color: st.color }]} numberOfLines={1}>
                      {st.label}
                    </Text>
                    {order ? (
                      <Text style={styles.tableInfo} numberOfLines={1}>
                        {formatPrice(orderTotal(order), state.settings.currency)} ·{' '}
                        {formatElapsed(now - order.createdAt)}
                      </Text>
                    ) : (
                      <Text style={styles.tableInfo}> </Text>
                    )}
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Summary({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.summaryText}>
        <Text style={styles.summaryValue}>{value}</Text> {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 8 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { color: colors.muted, fontSize: 14 },
  summaryValue: { color: colors.text, fontWeight: '800' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  server: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  serverText: { color: colors.muted, fontWeight: '600' },
  chips: { gap: 8, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  table: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 10,
    minHeight: 92,
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableName: { fontSize: 20, fontWeight: '800', color: colors.text, flexShrink: 1 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seatsText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  tableState: { fontSize: 13, fontWeight: '700' },
  tableInfo: { fontSize: 12, color: colors.text },
});
