import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCreatorCode } from '../../components/CreatorGate';
import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { PeriodPicker } from '../../components/stats/ReportParts';
import { ReportView } from '../../components/stats/ReportView';
import { TicketPreview } from '../../components/TicketPreview';
import { useToast } from '../../components/Toast';
import { Badge, Button, confirm, Empty, Notice, notify, Segmented } from '../../components/ui';
import { clearHistory } from '../../store/actions';
import { dayKey, orderTotal } from '../../store/selectors';
import { buildReport, type Period, type PeriodKind, periodOf, reportCsv, shiftPeriod } from '../../store/stats';
import { useStore } from '../../store/StoreProvider';
import { closureDoc, receiptDoc, type TicketDoc } from '../../ticket/doc';
import { reportDoc } from '../../ticket/report';
import { colors, fonts, paymentLabel, screenBg } from '../../theme';
import { saveTextFile } from '../../utils/download';
import { formatDate, formatPrice, formatTime } from '../../utils/format';

type Tab = 'rapport' | 'tickets' | 'clotures';

function HistoryScreen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('rapport');
  const [period, setPeriod] = useState<Period>(() => periodOf('jour', Date.now()));
  const [preview, setPreview] = useState<TicketDoc | null>(null);
  const creator = useCreatorCode();
  const p = (n: number) => formatPrice(n, state.settings.currency);

  const report = useMemo(() => buildReport(state, period), [state, period]);
  const previous = useMemo(() => buildReport(state, shiftPeriod(period, -1)), [state, period]);
  const now = Date.now();
  const isCurrent = now >= period.start && now < period.end;
  const closures = [...state.closures].reverse();

  const exportCsv = async () => {
    try {
      const name = `ventes-${period.kind}-${dayKey(period.start)}.csv`;
      const how = await saveTextFile(name, reportCsv(state, report));
      toast(how === 'partage' ? 'Export prêt à partager' : `Fichier ${name} téléchargé`, '📤');
    } catch (e) {
      notify('Export impossible', e instanceof Error ? e.message : 'Réessayez.');
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Historique & stats' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'rapport', label: 'Rapport' },
            { value: 'tickets', label: `Tickets (${report.orders.length})` },
            { value: 'clotures', label: `Clôtures (${state.closures.length})` },
          ]}
        />

        {tab !== 'clotures' ? (
          <PeriodPicker
            period={period}
            isCurrent={isCurrent}
            onKind={(kind: PeriodKind) => setPeriod(periodOf(kind, Math.min(Date.now(), period.end - 1)))}
            onShift={(d) => setPeriod(shiftPeriod(period, d))}
            onToday={() => setPeriod(periodOf(period.kind, Date.now()))}
          />
        ) : null}

        {tab === 'rapport' ? (
          <>
            <ReportView report={report} previous={previous} format={p} />
            <View style={styles.actions}>
              <Button title="Voir / imprimer le rapport" icon="print-outline" onPress={() => setPreview(reportDoc(state, report, Date.now()))} style={styles.flex} />
              <Button title="Exporter (CSV)" icon="download-outline" variant="secondary" onPress={exportCsv} style={styles.flex} />
            </View>
            <Text style={styles.hint}>
              L’export CSV (une ligne par ticket : HT, taux et montant de TVA, TTC, paiement) s’ouvre dans Excel ou Numbers, et
              peut être envoyé à votre comptable.
            </Text>
          </>
        ) : null}

        {tab === 'tickets' ? (
          <>
            {report.orders.length === 0 ? <Empty icon="time-outline" emoji="🧾" title="Aucun ticket sur cette période" /> : null}
            {report.orders.map((o) => (
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
        ) : null}

        {tab === 'clotures' ? (
          <>
            <Notice title="Clôture automatique à minuit">
              Chaque nuit à minuit, la journée est clôturée (Z de caisse) et le chiffre du jour repart à 0 €. Touchez une
              clôture pour la voir ou l’imprimer.
            </Notice>
            {closures.length === 0 ? (
              <Empty icon="time-outline" emoji="🗓️" title="Aucune clôture pour l’instant" subtitle="La première aura lieu ce soir à minuit." />
            ) : null}
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
        ) : null}

        {state.orders.some((o) => o.status !== 'ouverte') ? (
          <Button
            title="Effacer l’historique des tickets"
            icon="trash-outline"
            variant="ghost"
            style={styles.clear}
            onPress={() =>
              creator.ask(() =>
                confirm(
                  'Effacer l’historique ?',
                  'Les tickets encaissés ou annulés seront supprimés. Les clôtures journalières et les commandes en cours sont conservées.',
                  () => dispatch(clearHistory),
                  'Effacer',
                ),
              )
            }
          />
        ) : null}
      </ScrollView>
      <TicketPreview doc={preview} onClose={() => setPreview(null)} />
      {creator.modal}
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
  screen: { flex: 1, ...screenBg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  pressed: { opacity: 0.75 },
  orderTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  v: { color: colors.text, fontSize: 15, fontWeight: '700' },
  closure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  closureDate: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.text },
  closureAmount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 20, color: colors.text },
  clear: { marginTop: 20 },
});
