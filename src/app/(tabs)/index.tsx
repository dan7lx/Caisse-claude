import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { Button, Chip, Empty, SectionTitle } from '../../components/ui';
import { createOrder } from '../../store/actions';
import { uid } from '../../store/defaults';
import { openOrderForTable, orderTotal, tableLabel, tableState } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import type { Order, Table } from '../../store/types';
import { colors, fonts, shadow, tableStateStyle } from '../../theme';
import { formatElapsed, formatPrice } from '../../utils/format';
import { haptic } from '../../utils/haptics';
import { columnsFor, useLayout } from '../../utils/layout';

const ALL = 'Toutes';

export default function TablesScreen() {
  const { state, device, dispatch } = useStore();
  const router = useRouter();
  const now = useNow();
  const { width, small } = useLayout();
  const [zone, setZone] = useState(ALL);

  const zones = useMemo(() => Array.from(new Set(state.tables.map((t) => t.zone || 'Salle'))), [state.tables]);

  if (device.role === 'cuisine') return <Redirect href="/cuisine" />;

  const gap = small ? 8 : 12;
  const contentWidth = Math.min(width, 1200) - 32;
  const columns = columnsFor(contentWidth, small ? 96 : 112, 7);
  const cardWidth = (contentWidth - gap * (columns - 1)) / columns;

  const counts = { libre: 0, occupee: 0, pret: 0 };
  for (const t of state.tables) {
    const s = tableState(openOrderForTable(state, t.id));
    if (s === 'libre') counts.libre++;
    else counts.occupee++;
    if (s === 'pret') counts.pret++;
  }

  // Référence toujours à jour : la fonction reste la même et les cartes ne sont pas redessinées.
  const stateRef = useRef(state);
  stateRef.current = state;
  const serverRef = useRef(device.currentServer);
  serverRef.current = device.currentServer;
  const openTable = useCallback((table: Table) => {
    haptic.tap();
    const existing = openOrderForTable(stateRef.current, table.id);
    if (existing) {
      router.push(`/commande/${existing.id}`);
      return;
    }
    const id = uid();
    dispatch(createOrder(id, table.id, tableLabel(table), serverRef.current));
    router.push(`/commande/${id}`);
  }, [dispatch, router]);

  if (state.tables.length === 0) {
    return (
      <View style={styles.screen}>
        <Empty icon="grid-outline" emoji="🪑" title="Aucune table" subtitle="Le gérant ajoute les tables dans Gestion › Tables & zones.">
          <Button title="Ajouter des tables" icon="add" onPress={() => router.push('/reglages/tables')} />
        </Empty>
      </View>
    );
  }

  const visibleZones = zone === ALL ? zones : [zone];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Stat emoji="🍽️" color={colors.free} value={counts.libre} label="libres" />
        <Stat emoji="⏳" color={colors.busy} value={counts.occupee} label="occupées" />
        <Stat emoji="🛎️" color={colors.ready} value={counts.pret} label="à servir" />
      </View>
      <View style={styles.me}>
        <Ionicons name="person-circle" size={18} color={colors.goldDeep} />
        <Text style={styles.meText}>
          Service de <Text style={styles.meName}>{device.currentServer}</Text> · touchez une table pour commander
        </Text>
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
              .map((t) => (
                <TableCard
                  key={t.id}
                  table={t}
                  order={openOrderForTable(state, t.id)}
                  now={now}
                  currency={state.settings.currency}
                  width={cardWidth}
                  compact={small}
                  onOpen={openTable}
                />
              ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const STATE_EMOJI = { libre: null, occupee: '⏳', a_envoyer: '✏️', pret: '🛎️' } as const;

interface TableCardProps {
  table: Table;
  order: Order | undefined;
  now: number;
  currency: string;
  width: number;
  compact: boolean;
  onOpen: (table: Table) => void;
}

/** Carte d'une table (mémorisée : redessinée seulement si sa commande change). */
const TableCard = memo(function TableCard({ table: t, order, now, currency, width, compact, onOpen }: TableCardProps) {
  const state = tableState(order);
  const st = tableStateStyle[state];
  const emoji = STATE_EMOJI[state];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tableLabel(t)}, ${st.label}`}
      onPress={() => onOpen(t)}
      android_ripple={{ color: colors.goldSoft }}
      style={({ pressed }) => [styles.table, compact && styles.tableCompact, { width }, pressed && styles.pressed]}
    >
      <View style={[styles.band, { backgroundColor: st.color }]} />
      <View style={styles.tableBody}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableName, compact && styles.tableNameCompact]} numberOfLines={1} adjustsFontSizeToFit>
            {t.name}
          </Text>
          {emoji ? (
            <Emoji3D emoji={emoji} size={compact ? 22 : 26} />
          ) : (
            <View style={styles.seats}>
              <Ionicons name="people" size={12} color={colors.muted} />
              <Text style={styles.seatsText}>{t.seats}</Text>
            </View>
          )}
        </View>
        <View style={[styles.pill, { backgroundColor: st.soft }]}>
          <Text style={[styles.pillText, { color: st.color }]} numberOfLines={1}>
            {st.label}
          </Text>
        </View>
        {order ? (
          <View>
            <Text style={styles.amount} numberOfLines={1}>
              {formatPrice(orderTotal(order), currency)}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatElapsed(now - order.createdAt)} · {order.guests} couv.
            </Text>
          </View>
        ) : (
          <Text style={styles.metaFree}>Ouvrir</Text>
        )}
      </View>
    </Pressable>
  );
});

function Stat({ emoji, color, value, label }: { emoji: string; color: string; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Emoji3D emoji={emoji} size={26} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  summary: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 26 },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  meText: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  meName: { color: colors.text, fontWeight: '800' },
  chips: { gap: 8, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  table: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 132,
    ...shadow,
  },
  band: { height: 6 },
  tableBody: { flex: 1, padding: 10, gap: 6, justifyContent: 'space-between' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tableCompact: { minHeight: 120, borderRadius: 16 },
  tableNameCompact: { fontSize: 26, lineHeight: 30 },
  tableName: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 30, color: colors.text, flexShrink: 1, lineHeight: 34 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  seatsText: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  pillText: { fontSize: 11, fontWeight: '800' },
  amount: { fontSize: 15, fontWeight: '800', color: colors.text },
  meta: { fontSize: 11, color: colors.muted },
  metaFree: { fontSize: 12, color: colors.goldDeep, fontWeight: '700' },
});
