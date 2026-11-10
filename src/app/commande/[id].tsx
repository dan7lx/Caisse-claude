import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderTitle } from '../../components/HeaderParts';
import { TicketContent } from '../../components/TicketContent';
import { Button, Chip, confirm, Empty, Field, FormModal, IconButton } from '../../components/ui';
import { addItem, cancelOrder, changeQty, payOrder, removeIfEmpty, sendOrder, setLineNote } from '../../store/actions';
import { orderTotal } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { MenuItem, Order, OrderLine, PaymentMethod } from '../../store/types';
import { colors, fonts, paymentLabel, shadow } from '../../theme';
import { formatPrice } from '../../utils/format';

const PAYMENT_ICONS: Record<PaymentMethod, React.ComponentProps<typeof Ionicons>['name']> = {
  especes: 'cash-outline',
  carte: 'card-outline',
  autre: 'wallet-outline',
};

const QUICK_NOTES = ['Saignant', 'À point', 'Bien cuit', 'Sans gluten', 'Sans oignons', 'Sans glaçons', 'À suivre'];

export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { state, dispatch } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const order = state.orders.find((o) => o.id === id);
  const currency = state.settings.currency;

  const [categoryId, setCategoryId] = useState<string | null>(state.categories[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [noteLine, setNoteLine] = useState<OrderLine | null>(null);
  const [noteText, setNoteText] = useState('');

  // Une table ouverte puis quittée sans rien commander redevient libre.
  const orderRef = useRef<Order | undefined>(order);
  orderRef.current = order;
  useEffect(
    () => () => {
      const o = orderRef.current;
      if (o && o.status === 'ouverte' && o.lines.length === 0) dispatch(removeIfEmpty(o.id));
    },
    [dispatch],
  );

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
  const draftQty = drafts.reduce((n, l) => n + l.qty, 0);
  const itemCount = order.lines.reduce((n, l) => n + l.qty, 0);
  const total = orderTotal(order);
  const columns = wide ? (width >= 1200 ? 4 : 3) : width >= 600 ? 3 : 2;
  const categoryColor = new Map(state.categories.map((c) => [c.id, c.color]));

  const qtyInDraft = (itemId: string) => drafts.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);
  const removeOne = (itemId: string) => {
    const line = [...drafts].reverse().find((l) => l.itemId === itemId);
    if (line) dispatch(changeQty(order.id, line.id, -1));
  };

  const send = () => {
    dispatch(sendOrder(order.id));
    setTicketOpen(false);
    if (state.settings.returnAfterSend) router.back();
  };

  const cancel = () =>
    confirm(
      'Annuler la commande ?',
      order.lines.some((l) => l.status !== 'brouillon')
        ? 'Des articles ont déjà été envoyés. La commande sera marquée comme annulée.'
        : 'La commande sera supprimée et la table libérée.',
      () => {
        setTicketOpen(false);
        dispatch(cancelOrder(order.id));
        router.back();
      },
      'Annuler la commande',
    );

  const pay = (method: PaymentMethod) => {
    dispatch(payOrder(order.id, method));
    setPayOpen(false);
    setTicketOpen(false);
    router.back();
  };

  const ticket = (
    <TicketContent
      order={order}
      onNote={(l) => {
        setNoteLine(l);
        setNoteText(l.note);
      }}
      onSend={send}
      onPay={() => setPayOpen(true)}
      onCancel={cancel}
    />
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: order.label,
          headerTitle: () => <HeaderTitle title={order.label} subtitle={`n°${order.number} · ${order.server}`} />,
          headerRight: () => (
            <IconButton
              icon={searching ? 'close' : 'search'}
              label={searching ? 'Fermer la recherche' : 'Rechercher un article'}
              color={colors.gold}
              onPress={() => {
                setSearching((v) => !v);
                setSearch('');
              }}
              style={styles.headerBtn}
            />
          ),
        }}
      />

      <View style={styles.catBar}>
        {searching ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.gold} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un plat, une boisson…"
              placeholderTextColor={colors.onDarkMuted}
              style={styles.searchInput}
              autoFocus
              accessibilityLabel="Rechercher un article"
            />
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
            {state.categories.map((c) => {
              const selected = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.cat, selected && styles.catActive]}
                >
                  <View style={[styles.catDot, { backgroundColor: c.color }]} />
                  <Text style={[styles.catText, selected && styles.catTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.body}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.grid}>
          {visibleItems.length === 0 ? (
            <View style={styles.full}>
              <Empty icon="restaurant-outline" title="Aucun article" subtitle="Le gérant ajoute la carte dans Gestion › Articles." />
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
                    qty > 0 && styles.itemSelected,
                    !item.available && styles.itemDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.itemBar, { backgroundColor: categoryColor.get(item.categoryId) ?? colors.border }]} />
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemPrice}>{item.available ? formatPrice(item.price, currency) : 'Épuisé'}</Text>
                  </View>
                  {qty > 0 ? (
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>{qty}</Text>
                    </View>
                  ) : null}
                </Pressable>
                {qty > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer un ${item.name}`}
                    onPress={() => removeOne(item.id)}
                    hitSlop={8}
                    style={styles.minus}
                  >
                    <Ionicons name="remove" size={20} color={colors.onDark} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {wide ? (
          <ScrollView style={styles.side} contentContainerStyle={styles.sideContent}>
            {ticket}
          </ScrollView>
        ) : null}
      </View>

      {!wide ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir le ticket"
            onPress={() => setTicketOpen(true)}
            style={({ pressed }) => [styles.summary, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.summaryIcon}>
              <Ionicons name="receipt" size={20} color={colors.gold} />
              {itemCount > 0 ? (
                <View style={styles.summaryCount}>
                  <Text style={styles.summaryCountText}>{itemCount}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <Text style={styles.summaryLabel}>Ticket</Text>
              <Text style={styles.summaryTotal}>{formatPrice(total, currency)}</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.onDarkMuted} />
          </Pressable>
          {readOnly ? null : draftQty > 0 ? (
            <Button title={`Envoyer (${draftQty})`} icon="paper-plane" large onPress={send} style={styles.flex} />
          ) : order.lines.length ? (
            <Button title="Encaisser" icon="card" large onPress={() => setPayOpen(true)} style={styles.flex} />
          ) : (
            <View style={[styles.flex, styles.hintBox]}>
              <Text style={styles.hint}>Touchez un plat pour l’ajouter</Text>
            </View>
          )}
        </View>
      ) : null}

      <Modal visible={ticketOpen && !wide} animationType="slide" transparent onRequestClose={() => setTicketOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grip} />
            <View style={styles.sheetHead}>
              <IconButton icon="chevron-down" label="Fermer le ticket" onPress={() => setTicketOpen(false)} color={colors.muted} size={28} />
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>{ticket}</ScrollView>
          </View>
        </View>
      </Modal>

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
          placeholder="ex : saignant, sans oignons…"
          autoFocus
        />
        <View style={styles.quickNotes}>
          {QUICK_NOTES.map((n) => (
            <Chip key={n} label={n} onPress={() => setNoteText((t) => (t ? `${t}, ${n.toLowerCase()}` : n))} />
          ))}
        </View>
      </FormModal>

      <FormModal visible={payOpen} title="Encaissement" onClose={() => setPayOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.payTotal}>
            <Text style={styles.payLabel}>{order.label}</Text>
            <Text style={styles.payAmount}>{formatPrice(total, currency)}</Text>
            <Text style={styles.payMeta}>
              dont TVA {state.settings.taxRate} % :{' '}
              {formatPrice(Math.round((total * state.settings.taxRate) / (100 + state.settings.taxRate)), currency)}
            </Text>
            {order.guests > 1 ? (
              <Text style={styles.payMeta}>
                soit {formatPrice(Math.round(total / order.guests), currency)} par couvert ({order.guests})
              </Text>
            ) : null}
            {draftQty ? <Text style={styles.warning}>{draftQty} article(s) non envoyé(s) seront envoyés automatiquement.</Text> : null}
          </View>
        </KeyboardAvoidingView>
        {(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => (
          <Button key={m} title={paymentLabel[m]} icon={PAYMENT_ICONS[m]} variant={m === 'carte' ? 'primary' : 'secondary'} large onPress={() => pay(m)} />
        ))}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  full: { width: '100%' },
  headerBtn: { marginRight: 12 },
  catBar: { backgroundColor: colors.ink, paddingBottom: 12 },
  cats: { gap: 8, paddingHorizontal: 16 },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink3,
  },
  catActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catText: { color: colors.onDark, fontWeight: '700', fontSize: 15 },
  catTextActive: { color: colors.ink },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink3,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 16, color: colors.onDark },
  body: { flex: 1, flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, paddingBottom: 24 },
  itemWrap: { padding: 6 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 104,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow,
  },
  itemSelected: { borderColor: colors.gold, backgroundColor: '#FFF9EA' },
  itemDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  itemBar: { width: 6 },
  itemBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 21 },
  itemPrice: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.goldDeep, marginTop: 8 },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  qtyText: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  minus: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: { width: 400, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: '#FBF7EF' },
  sideContent: { padding: 18, paddingBottom: 40 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 4 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  summaryCountText: { fontSize: 11, fontWeight: '900', color: colors.ink },
  summaryLabel: { color: colors.onDarkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  summaryTotal: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 19 },
  hintBox: { alignItems: 'center', justifyContent: 'center', minHeight: 58 },
  hint: { color: colors.onDarkMuted, fontStyle: 'italic' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,18,15,0.55)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '92%',
    paddingTop: 8,
  },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  sheetHead: { alignItems: 'flex-end', paddingHorizontal: 10 },
  sheetBody: { paddingHorizontal: 18, paddingBottom: 12 },
  quickNotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payTotal: { alignItems: 'center', paddingVertical: 8 },
  payLabel: { fontSize: 13, color: colors.goldDeep, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  payAmount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 46, color: colors.text },
  payMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  warning: { marginTop: 8, color: colors.ready, fontWeight: '700', textAlign: 'center' },
});
