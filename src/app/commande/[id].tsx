import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Chip,
  confirm,
  Empty,
  Field,
  FormModal,
  IconButton,
  Segmented,
  SectionTitle,
  Stepper,
} from '../../components/ui';
import {
  addItem,
  cancelOrder,
  changeQty,
  payOrder,
  removeIfEmpty,
  removeLine,
  sendOrder,
  setGuests,
  setLineNote,
  setLinesStatus,
} from '../../store/actions';
import { lineTotal, orderTotal } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { MenuItem, OrderLine, PaymentMethod } from '../../store/types';
import { colors, lineStatusStyle, paymentLabel, stationLabel } from '../../theme';
import { formatPrice, formatTime } from '../../utils/format';

type View_ = 'carte' | 'ticket';

const PAYMENT_ICONS: Record<PaymentMethod, React.ComponentProps<typeof Ionicons>['name']> = {
  especes: 'cash-outline',
  carte: 'card-outline',
  autre: 'wallet-outline',
};

export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { state, dispatch } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const order = state.orders.find((o) => o.id === id);
  const currency = state.settings.currency;

  const [view, setView] = useState<View_>('carte');
  const [categoryId, setCategoryId] = useState<string | null>(state.categories[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [noteLine, setNoteLine] = useState<OrderLine | null>(null);
  const [noteText, setNoteText] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  // Une table ouverte puis quittée sans rien commander ne doit pas rester occupée.
  useEffect(() => () => dispatch(removeIfEmpty(id)), [id, dispatch]);

  const stationOf = useMemo(() => {
    const map = new Map(state.categories.map((c) => [c.id, c.station]));
    return (item: MenuItem) => map.get(item.categoryId) ?? 'cuisine';
  }, [state.categories]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return state.items.filter((i) => i.name.toLowerCase().includes(q));
    return state.items.filter((i) => i.categoryId === categoryId);
  }, [state.items, categoryId, search]);

  if (!order) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Commande' }} />
        <Empty icon="alert-circle-outline" title="Commande introuvable" subtitle="Elle a peut-être été encaissée ou annulée.">
          <Button title="Retour" onPress={() => router.back()} />
        </Empty>
      </View>
    );
  }

  const readOnly = order.status !== 'ouverte';
  const drafts = order.lines.filter((l) => l.status === 'brouillon');
  const sent = order.lines.filter((l) => l.status !== 'brouillon');
  const draftQty = drafts.reduce((n, l) => n + l.qty, 0);
  const itemCount = order.lines.reduce((n, l) => n + l.qty, 0);
  const total = orderTotal(order);
  const readyLines = sent.filter((l) => l.status === 'pret');
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const categoryColor = new Map(state.categories.map((c) => [c.id, c.color]));

  const qtyInDraft = (itemId: string) =>
    drafts.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);

  const onCancel = () =>
    confirm(
      'Annuler la commande ?',
      sent.length
        ? 'Des articles ont déjà été envoyés. La commande sera marquée comme annulée.'
        : 'La commande sera supprimée.',
      () => {
        dispatch(cancelOrder(order.id));
        router.back();
      },
      'Annuler la commande',
    );

  const onPay = (method: PaymentMethod) => {
    dispatch(payOrder(order.id, method));
    setPayOpen(false);
    router.back();
  };

  const batches = Array.from(new Set(sent.map((l) => l.batch ?? 0))).sort((a, b) => a - b);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: `${order.label} · n°${order.number}`,
          headerRight: () =>
            readOnly ? null : (
              <IconButton icon="trash-outline" label="Annuler la commande" color={colors.danger} onPress={onCancel} />
            ),
        }}
      />

      <View style={styles.top}>
        <Segmented<View_>
          value={view}
          onChange={setView}
          options={[
            { value: 'carte', label: 'Carte' },
            { value: 'ticket', label: `Ticket (${itemCount})` },
          ]}
        />
      </View>

      {view === 'carte' ? (
        <View style={styles.flex}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un article"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              accessibilityLabel="Rechercher un article"
            />
            {search ? <IconButton icon="close-circle" label="Effacer" onPress={() => setSearch('')} color={colors.muted} size={18} /> : null}
          </View>
          {!search ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBar} contentContainerStyle={styles.chips}>
              {state.categories.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
              ))}
            </ScrollView>
          ) : null}
          <ScrollView contentContainerStyle={styles.grid}>
            {visibleItems.length === 0 ? (
              <View style={styles.fullWidth}>
                <Empty icon="restaurant-outline" title="Aucun article" subtitle="Ajoutez des articles dans Gestion › Articles." />
              </View>
            ) : null}
            {visibleItems.map((item) => {
              const qty = qtyInDraft(item.id);
              const disabled = !item.available || readOnly;
              return (
                <View key={item.id} style={[styles.itemWrap, { width: `${100 / columns}%` }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${item.name}, ${formatPrice(item.price, currency)}`}
                    disabled={disabled}
                    onPress={() => dispatch(addItem(order.id, item, stationOf(item)))}
                    style={({ pressed }) => [
                      styles.item,
                      { borderTopColor: categoryColor.get(item.categoryId) ?? colors.border },
                      !item.available && styles.itemDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.itemFooter}>
                      <Text style={styles.itemPrice}>
                        {item.available ? formatPrice(item.price, currency) : 'Épuisé'}
                      </Text>
                      <Text style={styles.itemStation}>{stationLabel[stationOf(item)]}</Text>
                    </View>
                    {qty > 0 ? (
                      <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{qty}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.ticket}>
          <View style={styles.guestsRow}>
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <Text style={styles.guestsLabel}>Couverts</Text>
            <View style={styles.flex} />
            <Stepper label="couverts" value={order.guests} onChange={(v) => dispatch(setGuests(order.id, v))} />
          </View>
          <Text style={styles.meta}>
            Serveur : {order.server} · ouverte à {formatTime(order.createdAt)}
          </Text>

          {order.lines.length === 0 ? (
            <Empty icon="receipt-outline" title="Ticket vide" subtitle="Ajoutez des articles depuis l’onglet Carte.">
              <Button title="Voir la carte" icon="restaurant-outline" onPress={() => setView('carte')} />
            </Empty>
          ) : null}

          {drafts.length ? (
            <>
              <SectionTitle>À envoyer</SectionTitle>
              {drafts.map((l) => (
                <View key={l.id} style={styles.line}>
                  <View style={styles.flex}>
                    <Text style={styles.lineName}>{l.name}</Text>
                    {l.note ? <Text style={styles.lineNote}>« {l.note} »</Text> : null}
                    <Text style={styles.linePrice}>
                      {formatPrice(lineTotal(l), currency)} · {stationLabel[l.station]}
                    </Text>
                  </View>
                  <IconButton
                    icon={l.note ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'}
                    label={`Note pour ${l.name}`}
                    color={colors.toSend}
                    onPress={() => {
                      setNoteLine(l);
                      setNoteText(l.note);
                    }}
                  />
                  <Stepper label={l.name} value={l.qty} min={0} onChange={(v) => dispatch(changeQty(order.id, l.id, v - l.qty))} />
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
                            confirm('Retirer cet article ?', `${l.qty} × ${l.name} a déjà été envoyé.`, () =>
                              dispatch(removeLine(order.id, l.id)),
                            'Retirer')
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
              style={styles.mt}
            />
          ) : null}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(total, currency)}</Text>
        </View>
        {!readOnly ? (
          <View style={styles.actions}>
            <Button
              title={draftQty ? `Envoyer (${draftQty})` : 'Envoyer'}
              icon="paper-plane"
              variant="dark"
              disabled={!draftQty}
              onPress={() => {
                dispatch(sendOrder(order.id));
                setView('ticket');
              }}
              style={styles.flex}
            />
            <Button title="Encaisser" icon="card" disabled={!order.lines.length} onPress={() => setPayOpen(true)} style={styles.flex} />
          </View>
        ) : null}
      </View>

      <FormModal
        visible={noteLine !== null}
        title={noteLine ? `Note · ${noteLine.name}` : 'Note'}
        onClose={() => setNoteLine(null)}
        onSave={() => {
          if (noteLine) dispatch(setLineNote(order.id, noteLine.id, noteText));
          setNoteLine(null);
        }}
      >
        <Field
          label="Instruction pour la cuisine / le bar"
          value={noteText}
          onChangeText={setNoteText}
          placeholder="ex : saignant, sans oignons, sans glaçons…"
          autoFocus
        />
        <View style={styles.quickNotes}>
          {['Saignant', 'À point', 'Bien cuit', 'Sans gluten', 'Sans oignons', 'Sans glaçons', 'À suivre'].map((n) => (
            <Chip key={n} label={n} onPress={() => setNoteText((t) => (t ? `${t}, ${n.toLowerCase()}` : n))} />
          ))}
        </View>
      </FormModal>

      <FormModal visible={payOpen} title="Encaissement" onClose={() => setPayOpen(false)}>
        <View style={styles.payTotal}>
          <Text style={styles.payAmount}>{formatPrice(total, currency)}</Text>
          <Text style={styles.meta}>
            dont TVA {state.settings.taxRate} % :{' '}
            {formatPrice(Math.round((total * state.settings.taxRate) / (100 + state.settings.taxRate)), currency)}
          </Text>
          {order.guests > 1 ? (
            <Text style={styles.meta}>
              Soit {formatPrice(Math.round(total / order.guests), currency)} par couvert ({order.guests})
            </Text>
          ) : null}
          {draftQty ? (
            <Text style={styles.warning}>
              {draftQty} article(s) non envoyé(s) seront envoyés automatiquement.
            </Text>
          ) : null}
        </View>
        {(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => (
          <Button key={m} title={paymentLabel[m]} icon={PAYMENT_ICONS[m]} variant="secondary" onPress={() => onPay(m)} />
        ))}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  fullWidth: { width: '100%' },
  mt: { marginTop: 12 },
  top: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.text },
  chipsBar: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 11, paddingBottom: 16 },
  itemWrap: { padding: 5 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 5,
    padding: 12,
    minHeight: 92,
    justifyContent: 'space-between',
  },
  itemDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  itemPrice: { fontSize: 15, fontWeight: '800', color: colors.primary },
  itemStation: { fontSize: 11, color: colors.muted },
  qtyBadge: {
    position: 'absolute',
    top: -8,
    right: -6,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.toSend,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  qtyBadgeText: { color: '#FFFFFF', fontWeight: '800' },
  ticket: { padding: 16, paddingBottom: 24 },
  guestsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guestsLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  lineServed: { opacity: 0.55 },
  lineName: { fontSize: 16, fontWeight: '700', color: colors.text },
  lineNote: { fontSize: 13, fontStyle: 'italic', color: colors.toSend, marginTop: 2 },
  linePrice: { fontSize: 13, color: colors.muted, marginTop: 2 },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  totalValue: { fontSize: 26, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: 10 },
  quickNotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payTotal: { alignItems: 'center', paddingVertical: 8 },
  payAmount: { fontSize: 40, fontWeight: '800', color: colors.text },
  warning: { marginTop: 8, color: colors.ready, fontWeight: '600', textAlign: 'center' },
});
