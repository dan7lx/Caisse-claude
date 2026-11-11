import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type CheckoutResult, CheckoutSheet } from '../../components/CheckoutSheet';
import { Emoji3D } from '../../components/Emoji3D';
import { PrintPreview } from '../../components/PrintPreview';
import { printDoc } from '../../print';
import { receiptDoc, type PrintDoc as PrintDocType } from '../../print/doc';
import { HeaderTitle } from '../../components/HeaderParts';
import { MenuItemCard } from '../../components/MenuItemCard';
import { useToast } from '../../components/Toast';
import { TicketContent } from '../../components/TicketContent';
import { Button, Chip, confirm, Empty, Field, FormModal, IconButton, notify } from '../../components/ui';
import { addItem, cancelOrder, changeQty, moveOrderTable, payOrder, removeIfEmpty, sendOrder, setLineNote } from '../../store/actions';
import { orderTotal, tableLabel } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { MenuItem, Order, OrderLine, PaymentMethod } from '../../store/types';
import { colors, fonts, paymentLabel, shadow } from '../../theme';
import { formatPrice } from '../../utils/format';
import { haptic } from '../../utils/haptics';
import { columnsFor, useLayout } from '../../utils/layout';

const PAYMENT_ICONS: Record<PaymentMethod, React.ComponentProps<typeof Ionicons>['name']> = {
  especes: 'cash-outline',
  carte: 'card-outline',
  autre: 'wallet-outline',
};

const QUICK_NOTES = ['Saignant', 'À point', 'Bien cuit', 'Sans gluten', 'Sans oignons', 'Sans glaçons', 'À suivre'];

export default function OrderScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { state, device, dispatch } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, small } = useLayout();
  const wide = width >= 900;
  const toast = useToast();

  const order = state.orders.find((o) => o.id === id);
  const currency = state.settings.currency;

  const [categoryId, setCategoryId] = useState<string | null>(state.categories[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<PrintDocType | null>(null);
  const [preview, setPreview] = useState<PrintDocType | null>(null);
  const [moving, setMoving] = useState(false);
  const [noteLine, setNoteLine] = useState<OrderLine | null>(null);
  const [noteText, setNoteText] = useState('');
  const [choiceItem, setChoiceItem] = useState<MenuItem | null>(null);

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

  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);

  // Callbacks stables : les cartes de plats ne sont pas redessinées à chaque ajout.
  const onAdd = useCallback(
    (item: MenuItem) => {
      const o = orderRef.current;
      if (!o) return;
      if (item.choices.length) {
        haptic.tap();
        setChoiceItem(item);
        return;
      }
      haptic.impact();
      dispatch(addItem(o.id, item, stationOf(item)));
    },
    [dispatch, stationOf],
  );
  const onRemove = useCallback(
    (item: MenuItem) => {
      const o = orderRef.current;
      if (!o) return;
      const line = [...o.lines].reverse().find((l) => l.status === 'brouillon' && l.itemId === item.id);
      if (line) {
        haptic.tap();
        dispatch(changeQty(o.id, line.id, -1));
      }
    },
    [dispatch],
  );

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
  const sideWidth = Math.min(400, Math.round(width * 0.38));
  const gridWidth = (wide ? width - sideWidth : width) - 20;
  const columns = columnsFor(gridWidth, small ? 150 : 165, 5);
  const cellWidth = `${100 / columns}%` as const;
  const draftQtyByItem = new Map<string, number>();
  for (const l of drafts) draftQtyByItem.set(l.itemId, (draftQtyByItem.get(l.itemId) ?? 0) + l.qty);

  const send = () => {
    dispatch(sendOrder(order.id));
    haptic.success();
    const stations = new Set(drafts.map((l) => l.station));
    toast(
      stations.size === 2 ? 'Envoyé en cuisine et au bar' : stations.has('bar') ? 'Envoyé au bar' : 'Envoyé en cuisine',
      '🎉',
    );
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

  const pay = (result: CheckoutResult) => {
    dispatch(payOrder(order.id, result.payment, result));
    const paidOrder: Order = {
      ...order,
      status: 'payee',
      paidAt: Date.now(),
      payment: result.payment,
      tip: result.tip,
      discountPct: result.discountPct,
      cashReceived: result.cashReceived,
    };
    const doc = receiptDoc(state, paidOrder);
    toast(`${order.label} encaissée · ${formatPrice(orderTotal(paidOrder) + result.tip, currency)}`, '💰');
    setPayOpen(false);
    setTicketOpen(false);
    setReceipt(doc);
    if (device.printer.autoPrintReceipt) {
      printDoc(doc, device.printer).catch((e: unknown) => notify('Impression', e instanceof Error ? e.message : 'Impression impossible.'));
    }
  };

  const freeTables = state.tables.filter(
    (t) => t.id !== order.tableId && !state.orders.some((o) => o.status === 'ouverte' && o.tableId === t.id),
  );

  const ticket = (
    <TicketContent
      order={order}
      onNote={(l) => {
        setNoteLine(l);
        setNoteText(l.note);
      }}
      onSend={send}
      onPay={() => setPayOpen(true)}
      onPrintBill={() => setPreview(receiptDoc(state, order))}
      onMoveTable={state.tables.length > 1 ? () => setMoving(true) : undefined}
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
                  onPress={() => {
                    haptic.tap();
                    setCategoryId(c.id);
                  }}
                  style={[styles.cat, selected && styles.catActive]}
                >
                  <Emoji3D emoji={c.emoji} size={22} />
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
              <Empty icon="restaurant-outline" emoji="🍽️" title="Aucun article" subtitle="Le gérant ajoute la carte dans Gestion › Articles." />
            </View>
          ) : null}
          {visibleItems.map((item) => {
            const category = categoryById.get(item.categoryId);
            return (
              <MenuItemCard
                key={item.id}
                item={item}
                emoji={item.emoji || category?.emoji || '🍽️'}
                color={category?.color ?? colors.border}
                qty={draftQtyByItem.get(item.id) ?? 0}
                currency={currency}
                width={cellWidth}
                disabled={!item.available || readOnly}
                compact={small}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            );
          })}
        </ScrollView>

        {wide ? (
          <ScrollView style={[styles.side, { width: sideWidth }]} contentContainerStyle={styles.sideContent}>
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
              {small ? null : <Text style={styles.summaryLabel}>Ticket</Text>}
              <Text style={styles.summaryTotal}>{formatPrice(total, currency)}</Text>
            </View>
            {small ? null : <Ionicons name="chevron-up" size={18} color={colors.onDarkMuted} />}
          </Pressable>
          {readOnly ? null : draftQty > 0 ? (
            <Button title={small ? 'Envoyer' : `Envoyer (${draftQty})`} icon="paper-plane" large onPress={send} style={styles.flex} />
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

      <FormModal visible={choiceItem !== null} title={choiceItem?.name ?? ''} onClose={() => setChoiceItem(null)}>
        {choiceItem ? (
          <>
            <View style={styles.choiceHead}>
              <Emoji3D emoji={choiceItem.emoji || categoryById.get(choiceItem.categoryId)?.emoji || '🍽️'} size={60} />
              <View style={styles.flex}>
                <Text style={styles.choicePrice}>{formatPrice(choiceItem.price, currency)}</Text>
                {choiceItem.description ? <Text style={styles.choiceDesc}>{choiceItem.description}</Text> : null}
              </View>
            </View>
            {choiceItem.allergens.length ? (
              <View style={styles.allergens}>
                <Emoji3D emoji="⚠️" size={18} />
                <Text style={styles.allergensText}>Allergènes : {choiceItem.allergens.join(', ')}</Text>
              </View>
            ) : null}
            <Text style={styles.choiceLabel}>Choisissez</Text>
            <View style={styles.choices}>
              {choiceItem.choices.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={c}
                  onPress={() => {
                    haptic.impact();
                    dispatch(addItem(order.id, choiceItem, stationOf(choiceItem), c));
                    setChoiceItem(null);
                  }}
                  style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
                >
                  <Text style={styles.choiceText}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </FormModal>

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

      <CheckoutSheet order={order} visible={payOpen} onClose={() => setPayOpen(false)} onConfirm={pay} />

      <PrintPreview
        doc={receipt}
        closeLabel="Terminer"
        onClose={() => {
          setReceipt(null);
          router.back();
        }}
      />
      <PrintPreview doc={preview} onClose={() => setPreview(null)} />

      <FormModal visible={moving} title="Changer de table" onClose={() => setMoving(false)}>
        <Text style={styles.moveHint}>Choisissez la table libre où installer {order.label} :</Text>
        <View style={styles.moveGrid}>
          {freeTables.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`Déplacer vers ${tableLabel(t)}`}
              onPress={() => {
                dispatch(moveOrderTable(order.id, t.id, tableLabel(t)));
                setMoving(false);
                haptic.success();
                toast(`Commande déplacée vers ${tableLabel(t)}`, '🪑');
              }}
              style={({ pressed }) => [styles.moveCell, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.moveName}>{t.name}</Text>
              <Text style={styles.moveZone}>{t.zone}</Text>
            </Pressable>
          ))}
          {freeTables.length === 0 ? <Text style={styles.moveHint}>Aucune table libre.</Text> : null}
        </View>
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
  side: { flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: '#FBF7EF' },
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
  moveHint: { color: colors.muted },
  moveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moveCell: {
    width: 84,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.free,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveName: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 24, color: colors.text },
  moveZone: { fontSize: 11, color: colors.muted },
  choiceHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  choicePrice: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 28, color: colors.text },
  choiceDesc: { color: colors.muted, marginTop: 2 },
  allergens: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 10 },
  allergensText: { flex: 1, color: colors.danger, fontWeight: '700', fontSize: 13 },
  choiceLabel: { fontSize: 13, fontWeight: '800', color: colors.goldDeep, letterSpacing: 1.2, textTransform: 'uppercase' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
  },
  choicePressed: { backgroundColor: colors.gold },
  choiceText: { color: colors.onDark, fontSize: 17, fontWeight: '800' },
  payTotal: { alignItems: 'center', paddingVertical: 8 },
  payLabel: { fontSize: 13, color: colors.goldDeep, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  payAmount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 46, color: colors.text },
  payMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  warning: { marginTop: 8, color: colors.ready, fontWeight: '700', textAlign: 'center' },
});
