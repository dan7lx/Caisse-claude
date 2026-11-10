import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button, Empty, SectionTitle, Segmented } from '../../components/ui';
import { setLinesStatus } from '../../store/actions';
import { kitchenTickets, type Ticket } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import type { LineStatus, OrderLine, Station } from '../../store/types';
import { colors, fonts, lineStatusStyle } from '../../theme';
import { formatElapsed, formatTime } from '../../utils/format';

/** Statut suivant quand on touche une ligne en cuisine / au bar. */
const NEXT: Partial<Record<LineStatus, LineStatus>> = {
  envoye: 'en_preparation',
  en_preparation: 'pret',
  pret: 'en_preparation',
};

const LINE_ICON: Record<LineStatus, React.ComponentProps<typeof Ionicons>['name']> = {
  brouillon: 'ellipse-outline',
  envoye: 'ellipse-outline',
  en_preparation: 'flame',
  pret: 'checkmark-circle',
  servi: 'checkmark-done-circle',
};

export default function KitchenScreen() {
  const { state, dispatch } = useStore();
  const now = useNow(15000);
  const { width } = useWindowDimensions();
  const [station, setStation] = useState<Station>('cuisine');

  const kitchen = kitchenTickets(state, 'cuisine', now);
  const bar = kitchenTickets(state, 'bar', now);
  const { active, done } = station === 'cuisine' ? kitchen : bar;
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const alertMs = state.settings.alertMinutes * 60000;

  const update = (ticket: Ticket, lines: OrderLine[], status: LineStatus) =>
    dispatch(setLinesStatus(ticket.order.id, lines.map((l) => l.id), status));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Segmented<Station>
          value={station}
          onChange={setStation}
          options={[
            { value: 'cuisine', label: `Cuisine (${kitchen.active.length})` },
            { value: 'bar', label: `Bar (${bar.active.length})` },
          ]}
        />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {active.length === 0 ? (
          <Empty
            icon={station === 'cuisine' ? 'restaurant-outline' : 'wine-outline'}
            title="Aucun ticket en attente"
            subtitle="Les commandes envoyées par les serveurs apparaîtront ici."
          />
        ) : null}
        <View style={styles.grid}>
          {active.map((t) => {
            const elapsed = now - t.sentAt;
            const late = elapsed >= alertMs;
            const pending = t.lines.filter((l) => l.status === 'envoye');
            const open = t.lines.filter((l) => l.status === 'envoye' || l.status === 'en_preparation');
            return (
              <View key={t.key} style={[styles.cell, { width: `${100 / columns}%` }]}>
                <View style={[styles.ticket, late && styles.ticketLate]}>
                  <View style={[styles.ticketHead, late && styles.ticketHeadLate]}>
                    <View style={styles.flex}>
                      <Text style={styles.ticketTitle}>{t.order.label}</Text>
                      <Text style={styles.ticketMeta}>
                        n°{t.order.number} · envoi {t.batch} · {t.order.server} · {t.order.guests} couv.
                      </Text>
                    </View>
                    <View style={styles.timer}>
                      <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
                    </View>
                  </View>
                  {t.lines.map((l) => {
                    const st = lineStatusStyle[l.status];
                    const next = NEXT[l.status];
                    return (
                      <Pressable
                        key={l.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${l.qty} ${l.name}, ${st.label}`}
                        disabled={!next}
                        onPress={() => next && update(t, [l], next)}
                        style={({ pressed }) => [styles.line, pressed && styles.pressed]}
                      >
                        <Ionicons name={LINE_ICON[l.status]} size={24} color={st.color} />
                        <View style={styles.flex}>
                          <Text style={[styles.lineText, (l.status === 'pret' || l.status === 'servi') && styles.lineDone]}>
                            <Text style={styles.lineQty}>{l.qty} × </Text>
                            {l.name}
                          </Text>
                          {l.note ? <Text style={styles.lineNote}>⚠ {l.note}</Text> : null}
                        </View>
                        <Text style={[styles.lineStatus, { color: st.color }]}>{st.label}</Text>
                      </Pressable>
                    );
                  })}
                  <View style={styles.ticketActions}>
                    {pending.length ? (
                      <Button small variant="secondary" title="Commencer" icon="flame-outline" onPress={() => update(t, pending, 'en_preparation')} style={styles.flex} />
                    ) : null}
                    <Button small variant="success" title="Prêt" icon="checkmark" onPress={() => update(t, open, 'pret')} style={styles.flex} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {done.length ? (
          <View style={styles.done}>
            <SectionTitle>Prêts récemment</SectionTitle>
            {done.map((t) => (
              <View key={t.key} style={styles.doneRow}>
                <Ionicons name="checkmark-circle" size={20} color={colors.free} />
                <View style={styles.flex}>
                  <Text style={styles.doneTitle}>
                    {t.order.label} · envoi {t.batch}
                  </Text>
                  <Text style={styles.ticketMetaDark} numberOfLines={1}>
                    {t.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                  </Text>
                </View>
                <Text style={styles.ticketMetaDark}>{t.readyAt ? formatTime(t.readyAt) : ''}</Text>
                {t.lines.some((l) => l.status === 'pret') ? (
                  <Button
                    small
                    variant="secondary"
                    title="Rappeler"
                    onPress={() => update(t, t.lines.filter((l) => l.status === 'pret'), 'en_preparation')}
                  />
                ) : (
                  <Text style={styles.served}>Servi</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { padding: 16, paddingBottom: 8 },
  content: { padding: 11, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { padding: 5 },
  ticket: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  ticketLate: { borderColor: colors.danger },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dark, padding: 12 },
  ticketHeadLate: { backgroundColor: colors.danger },
  ticketTitle: { color: colors.onDark, fontSize: 22, fontFamily: fonts.display, fontVariant: ['lining-nums'] },
  ticketMeta: { color: colors.goldLight, fontSize: 12, marginTop: 2 },
  ticketMetaDark: { color: colors.muted, fontSize: 12 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.goldSoft },
  lineText: { fontSize: 17, fontWeight: '600', color: colors.text },
  lineDone: { textDecorationLine: 'line-through', color: colors.muted },
  lineQty: { fontWeight: '800' },
  lineNote: { fontSize: 14, color: colors.danger, fontWeight: '700', marginTop: 2 },
  lineStatus: { fontSize: 12, fontWeight: '700' },
  ticketActions: { flexDirection: 'row', gap: 8, padding: 10 },
  done: { paddingHorizontal: 5, marginTop: 12 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneTitle: { fontWeight: '700', color: colors.text },
  served: { color: colors.free, fontWeight: '700' },
});
