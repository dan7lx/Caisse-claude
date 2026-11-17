import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type Period, type PeriodKind } from '../../store/stats';
import { colors, fonts } from '../../theme';
import { Emoji3D } from '../Emoji3D';
import { Segmented } from '../ui';

interface PeriodPickerProps {
  period: Period;
  isCurrent: boolean;
  onKind: (kind: PeriodKind) => void;
  onShift: (delta: number) => void;
  onToday: () => void;
}

/** Choix de la période : jour, semaine, mois, année, avec ‹ › pour remonter dans le temps. */
export function PeriodPicker({ period, isCurrent, onKind, onShift, onToday }: PeriodPickerProps) {
  return (
    <View style={styles.picker}>
      <Segmented<PeriodKind>
        value={period.kind}
        onChange={onKind}
        options={[
          { value: 'jour', label: 'Jour' },
          { value: 'semaine', label: 'Semaine' },
          { value: 'mois', label: 'Mois' },
          { value: 'annee', label: 'Année' },
        ]}
      />
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Période précédente" onPress={() => onShift(-1)} style={styles.arrow} hitSlop={8}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.periodLabel} numberOfLines={1} adjustsFontSizeToFit>
          {period.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Période suivante"
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => onShift(1)}
          style={[styles.arrow, isCurrent && styles.disabled]}
          hitSlop={8}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      {isCurrent ? null : (
        <Pressable accessibilityRole="button" onPress={onToday} style={styles.today}>
          <Text style={styles.todayText}>Revenir à aujourd’hui</Text>
        </Pressable>
      )}
    </View>
  );
}

interface KpiProps {
  emoji: string;
  label: string;
  value: string;
  /** Évolution en % par rapport à la période précédente. */
  delta?: number | null;
}

/** Tuile d'indicateur, avec l'évolution par rapport à la période précédente. */
export function Kpi({ emoji, label, value, delta }: KpiProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <View style={styles.kpi}>
      <Emoji3D emoji={emoji} size={24} />
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {delta !== undefined && delta !== null ? (
        <Text style={[styles.delta, { color: up ? colors.free : colors.danger }]}>
          {up ? '▲' : '▼'} {Math.abs(delta)} % vs précédente
        </Text>
      ) : null}
    </View>
  );
}

interface ShareRow {
  key: string;
  label: string;
  value: string;
  /** Part de 0 à 1 (barre horizontale). */
  share: number;
  sub?: string;
}

/** Liste avec une barre de proportion par ligne (serveurs, catégories, paiements…). */
export function ShareList({ rows, empty }: { rows: ShareRow[]; empty: string }) {
  if (!rows.length) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(1, Math.round(r.share * 100))}%` }]} />
          </View>
          {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrowText: { color: colors.text, fontSize: 26, lineHeight: 28, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  periodLabel: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: fonts.display, fontSize: 19 },
  today: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 12 },
  todayText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  kpi: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 2,
  },
  kpiValue: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 21, color: colors.text },
  kpiLabel: { fontSize: 12, color: colors.muted },
  delta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  list: { gap: 12 },
  row: { gap: 4 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { color: colors.text, fontSize: 15, flexShrink: 1 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  empty: { color: colors.muted, fontSize: 14 },
});
