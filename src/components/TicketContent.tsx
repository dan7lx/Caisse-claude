import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { changeQty, removeLine, setGuests, setLinesStatus } from '../store/actions';
import { lineTotal, orderTotal } from '../store/selectors';
import { useStore } from '../store/StoreProvider';
import type { Order, OrderLine } from '../store/types';
import { colors, fonts, lineStatusStyle, stationLabel } from '../theme';
import { formatPrice, formatTime } from '../utils/format';
import { Badge, Button, confirm, IconButton, SectionTitle, Stepper } from './ui';

interface Props {
  order: Order;
  onNote: (line: OrderLine) => void;
  onSend: () => void;
  onPay: () => void;
  onCancel: () => void;
}

/** Détail du ticket d'une table : couverts, articles à envoyer, envois, total et actions. */
export function TicketContent({ order, onNote, onSend, onPay, onCancel }: Props) {
  const { state, dispatch } = useStore();
  const currency = state.settings.currency;
  const readOnly = order.status !== 'ouverte';
  const drafts = order.lines.filter((l) => l.status === 'brouillon');
  const sent = order.lines.filter((l) => l.status !== 'brouillon');
  const draftQty = drafts.reduce((n, l) => n + l.qty, 0);
  const readyLines = sent.filter((l) => l.status === 'pret');
  const total = orderTotal(order);
  const batches = Array.from(new Set(sent.map((l) => l.batch ?? 0))).sort((a, b) => a - b);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.title}>{order.label}</Text>
          <Text style={styles.meta}>
            n°{order.number} · {order.server} · ouverte à {formatTime(order.createdAt)}
          </Text>
        </View>
        <View style={styles.guests}>
          <Ionicons name="people" size={16} color={colors.goldDeep} />
          <Stepper label="couverts" value={order.guests} onChange={(v) => dispatch(setGuests(order.id, v))} />
        </View>
      </View>

      {order.lines.length === 0 ? (
        <Text style={styles.empty}>Aucun article. Touchez les plats de la carte pour les ajouter.</Text>
      ) : null}

      {drafts.length ? (
        <>
          <SectionTitle>À envoyer</SectionTitle>
          {drafts.map((l) => (
            <View key={l.id} style={[styles.line, styles.lineDraft]}>
              <View style={styles.flex}>
                <Text style={styles.lineName}>{l.name}</Text>
                {l.note ? <Text style={styles.lineNote}>« {l.note} »</Text> : null}
                <Text style={styles.linePrice}>
                  {formatPrice(lineTotal(l), currency)} · {stationLabel[l.station]}
                </Text>
              </View>
              <IconButton
                icon={l.note ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                label={`Note pour ${l.name}`}
                color={colors.toSend}
                onPress={() => onNote(l)}
              />
              <Stepper label={l.name} value={l.qty} onChange={(v) => dispatch(changeQty(order.id, l.id, v - l.qty))} />
            </View>
          ))}
        </>
      ) : null}

      {batches.map((batch) => {
        const lines = sent.filter((l) => (l.batch ?? 0) === batch);
        const sentAt = lines[0]?.sentAt;
        return (
          <View key={batch}>
            <SectionTitle>
              Envoi {batch}
              {sentAt ? ` · ${formatTime(sentAt)}` : ''}
            </SectionTitle>
            {lines.map((l) => {
              const st = lineStatusStyle[l.status];
              return (
                <View key={l.id} style={[styles.line, l.status === 'servi' && styles.lineServed]}>
                  <View style={styles.flex}>
                    <Text style={styles.lineName}>
                      {l.qty} × {l.name}
                    </Text>
                    {l.note ? <Text style={styles.lineNote}>« {l.note} »</Text> : null}
                    <Text style={styles.linePrice}>{formatPrice(lineTotal(l), currency)}</Text>
                  </View>
                  <Badge label={st.label} color={st.color} soft={st.soft} />
                  {l.status === 'pret' && !readOnly ? (
                    <Button small title="Servi" variant="success" onPress={() => dispatch(setLinesStatus(order.id, [l.id], 'servi'))} />
                  ) : null}
                  {l.status === 'envoye' && !readOnly ? (
                    <IconButton
                      icon="close-circle-outline"
                      label={`Retirer ${l.name}`}
                      color={colors.danger}
                      onPress={() =>
                        confirm('Retirer cet article ?', `${l.qty} × ${l.name} a déjà été envoyé.`, () => dispatch(removeLine(order.id, l.id)), 'Retirer')
                      }
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      {readyLines.length > 1 && !readOnly ? (
        <Button
          title={`Tout servir (${readyLines.length})`}
          variant="success"
          icon="checkmark-done"
          onPress={() => dispatch(setLinesStatus(order.id, readyLines.map((l) => l.id), 'servi'))}
        />
      ) : null}

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPrice(total, currency)}</Text>
      </View>

      {!readOnly ? (
        <View style={styles.actions}>
          {draftQty ? (
            <Button title={`Envoyer (${draftQty})`} icon="paper-plane" large onPress={onSend} />
          ) : null}
          <Button
            title="Encaisser"
            icon="card"
            variant={draftQty ? 'secondary' : 'primary'}
            large={!draftQty}
            disabled={!order.lines.length}
            onPress={onPay}
          />
          <Button title="Annuler la commande" icon="trash-outline" variant="ghost" onPress={onCancel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 26, color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  guests: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  empty: { color: colors.muted, fontStyle: 'italic', paddingVertical: 12 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  lineDraft: { borderLeftWidth: 4, borderLeftColor: colors.toSend },
  lineServed: { opacity: 0.55 },
  lineName: { fontSize: 16, fontWeight: '700', color: colors.text },
  lineNote: { fontSize: 13, fontStyle: 'italic', color: colors.toSend, marginTop: 2 },
  linePrice: { fontSize: 13, color: colors.muted, marginTop: 2 },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 13, fontWeight: '800', color: colors.goldDeep, letterSpacing: 1.4, textTransform: 'uppercase' },
  totalValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 32, color: colors.text },
  actions: { gap: 10, marginTop: 6 },
});
