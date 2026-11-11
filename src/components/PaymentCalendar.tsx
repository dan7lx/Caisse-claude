import { StyleSheet, Text, View } from 'react-native';

import { useNow } from '../store/StoreProvider';

import type { LicenseStatus } from '../license/license';
import { colors, fonts } from '../theme';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function formatLongDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate() === 1 ? '1er' : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const dayKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

interface Props {
  status: LicenseStatus;
  now: number;
  /** Version resserrée (fenêtre de rappel). */
  compact?: boolean;
}

/** Orange des 5 jours de rappel et rouge du jour d'échéance. */
const ORANGE = '#E8891A';
const ORANGE_SOFT = '#FCE2C4';

/**
 * Petit calendrier de l'abonnement : 5 jours de rappel (orange), jour de fin / blocage (rouge), aujourd'hui (cerclé).
 * Affiche le mois en cours et, si l'échéance tombe le mois suivant, ce mois aussi.
 */
export function PaymentCalendar({ status, now, compact }: Props) {
  if (status.plan === 'vie') {
    return (
      <View style={styles.lifetime}>
        <Text style={styles.lifetimeTitle}>Licence à vie</Text>
        <Text style={styles.lifetimeText}>Aucun paiement à prévoir.</Text>
      </View>
    );
  }
  const today = new Date(now);
  const due = status.dueDate ? new Date(status.dueDate) : null;
  const reminderStart = status.reminderStart ? new Date(status.reminderStart) : null;

  const mark = (d: Date): 'due' | 'reminder' | null => {
    if (!due) return null;
    const k = dayKey(d);
    if (k === dayKey(due)) return 'due';
    if (reminderStart && k >= dayKey(reminderStart) && k < dayKey(due)) return 'reminder';
    return null;
  };

  const months: [number, number][] = [[today.getFullYear(), today.getMonth()]];
  if (due && (due.getMonth() !== today.getMonth() || due.getFullYear() !== today.getFullYear())) {
    months.push([due.getFullYear(), due.getMonth()]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.months}>
        {months.map(([y, m]) => (
          <MonthGrid key={`${y}-${m}`} year={y} month={m} today={today} mark={mark} compact={compact} />
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.danger} label="Fin de l’abonnement (blocage)" />
        <Legend color={ORANGE_SOFT} border={ORANGE} label="Rappel (5 jours avant)" />
        <Legend color="transparent" border={colors.ink} label="Aujourd’hui" />
      </View>
    </View>
  );
}

function MonthGrid({
  year,
  month,
  today,
  mark,
  compact,
}: {
  year: number;
  month: number;
  today: Date;
  mark: (d: Date) => 'due' | 'reminder' | null;
  compact?: boolean;
}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <View style={styles.month}>
      <Text style={[styles.monthTitle, compact && styles.monthTitleCompact]}>
        {MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1)} {year}
      </Text>
      <View style={styles.row}>
        {DAYS.map((d, i) => (
          <Text key={i} style={styles.dow}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={i} style={[styles.cell, compact && styles.cellCompact]} />;
          const date = new Date(year, month, day);
          const m = mark(date);
          const isToday = dayKey(date) === dayKey(today);
          return (
            <View key={i} style={[styles.cell, compact && styles.cellCompact]}>
              <View
                style={[
                  styles.day,
                  compact && styles.dayCompact,
                  m === 'reminder' && styles.dayReminder,
                  m === 'due' && styles.dayDue,
                  isToday && styles.dayToday,
                ]}
              >
                <Text style={[styles.dayText, m === 'reminder' && styles.dayTextReminder, m === 'due' && styles.dayTextDue]}>{day}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: border ?? color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  month: { flexGrow: 1, flexBasis: 260, maxWidth: 360 },
  monthTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  cellCompact: { paddingVertical: 1 },
  dayCompact: { width: 28, height: 28, borderRadius: 14 },
  monthTitleCompact: { fontSize: 16, marginBottom: 4 },
  dayReminder: { backgroundColor: ORANGE_SOFT, borderColor: ORANGE },
  dayDue: { backgroundColor: colors.danger, borderColor: colors.danger },
  dayToday: { borderColor: colors.ink },
  dayText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  dayTextDue: { color: '#FFFFFF', fontWeight: '800' },
  dayTextReminder: { color: '#8A4A05', fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  legendText: { fontSize: 12, color: colors.muted },
  lifetime: { padding: 16, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: 'center' },
  lifetimeTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 20, color: colors.goldDeep },
  lifetimeText: { color: colors.text, marginTop: 4 },
});

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Date et heure actuelles, à la seconde (le calendrier et le blocage suivent l'horloge du téléphone). */
export function LiveClock() {
  const now = useNow(1000);
  const d = new Date(now);
  const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  return (
    <View style={clockStyles.wrap} accessibilityLabel={`Nous sommes le ${formatLongDate(now)}, il est ${time}`}>
      <Text style={clockStyles.date}>
        {WEEKDAYS[d.getDay()].charAt(0).toUpperCase() + WEEKDAYS[d.getDay()].slice(1)} {formatLongDate(now)}
      </Text>
      <Text style={clockStyles.time}>{time}</Text>
    </View>
  );
}

const clockStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  date: { fontWeight: '700', color: colors.text, flexShrink: 1 },
  time: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: 18, color: colors.goldDeep },
});
