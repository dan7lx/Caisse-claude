import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { VAT_RATES } from '../config';
import { orderSubtotal, vatOn } from '../store/selectors';
import { useStore } from '../store/StoreProvider';
import type { Order, PaymentMethod } from '../store/types';
import { colors, fonts, paymentLabel } from '../theme';
import { formatPrice, parsePrice } from '../utils/format';
import { haptic } from '../utils/haptics';
import { Emoji3D } from './Emoji3D';
import { Button, FormModal, Stepper } from './ui';

export interface CheckoutResult {
  payment: PaymentMethod;
  tip: number;
  discountPct: number;
  cashReceived: number | null;
  /** TVA choisie (0, 6, 12 ou 21 %), ajoutée au montant. */
  vatRate: number;
}

interface Props {
  order: Order;
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: CheckoutResult) => void;
}

const DISCOUNTS = [0, 5, 10, 15, 20];
type TipMode = 'aucun' | 5 | 10 | 15 | 'arrondi' | 'libre';
const METHODS: { m: PaymentMethod; emoji: string }[] = [
  { m: 'carte', emoji: '💳' },
  { m: 'especes', emoji: '💰' },
  { m: 'autre', emoji: '🧾' },
];

/** Encaissement : TVA (choix obligatoire), remise, pourboire, partage, moyen de paiement et monnaie à rendre. */
export function CheckoutSheet({ order, visible, onClose, onConfirm }: Props) {
  const { state } = useStore();
  const c = state.settings.currency;
  const p = (n: number) => formatPrice(n, c);
  const [discountPct, setDiscountPct] = useState(0);
  const [tipMode, setTipMode] = useState<TipMode>('aucun');
  const [tipText, setTipText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('carte');
  const [cashText, setCashText] = useState('');
  const [split, setSplit] = useState(1);
  // Aucun taux présélectionné : le choix de la TVA est obligatoire avant d'encaisser.
  const [vatRate, setVatRate] = useState<number | null>(null);

  const subtotal = orderSubtotal(order);
  const discount = Math.round((subtotal * discountPct) / 100);
  const net = subtotal - discount;
  const vat = vatRate === null ? 0 : vatOn(net, vatRate);
  const total = net + vat;
  const tip = useMemo(() => {
    if (tipMode === 'aucun') return 0;
    if (tipMode === 'arrondi') return (Math.ceil(total / 100) * 100 === total ? total + 100 : Math.ceil(total / 100) * 100) - total;
    if (tipMode === 'libre') return parsePrice(tipText) ?? 0;
    return Math.round((total * tipMode) / 100);
  }, [tipMode, tipText, total]);
  const toPay = total + tip;
  const cash = parsePrice(cashText);
  const change = method === 'especes' && cash !== null ? cash - toPay : null;
  const drafts = order.lines.filter((l) => l.status === 'brouillon').reduce((n, l) => n + l.qty, 0);
  const quickCash = [toPay, ...[500, 1000, 2000, 5000, 10000].map((b) => Math.ceil(toPay / b) * b)].filter(
    (v, i, a) => a.indexOf(v) === i,
  ).slice(0, 4);

  const confirm = () => {
    if (vatRate === null) return;
    haptic.success();
    onConfirm({ payment: method, tip, discountPct, cashReceived: method === 'especes' ? cash : null, vatRate });
  };

  return (
    <FormModal visible={visible} title="Encaissement" onClose={onClose}>
      <View style={styles.head}>
        <Text style={styles.label}>{order.label} · n°{order.number}</Text>
        <Text style={styles.amount}>{p(toPay)}</Text>
        <Text style={styles.meta}>
          {vatRate === null ? `${p(net)} HTVA · choisissez la TVA` : `${p(net)} HT + TVA ${vatRate} % : ${p(vat)}`}
          {tip ? ` · pourboire ${p(tip)}` : ''}
        </Text>
        {drafts ? <Text style={styles.warning}>{drafts} article(s) non envoyé(s) seront envoyés automatiquement.</Text> : null}
      </View>

      <Section emoji="🏛️" title="TVA (obligatoire)">
        <View style={styles.vatRow}>
          {VAT_RATES.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: vatRate === r }}
              accessibilityLabel={`TVA ${r} %`}
              onPress={() => {
                haptic.tap();
                setVatRate(r);
              }}
              style={[styles.vat, vatRate === r && styles.vatActive]}
            >
              <Text style={[styles.vatText, vatRate === r && styles.vatTextActive]}>{r} %</Text>
            </Pressable>
          ))}
        </View>
        {vatRate === null ? <Text style={styles.vatHint}>Touchez le taux de TVA à appliquer : il s’ajoute au montant.</Text> : null}
      </Section>

      <Section emoji="🏷️" title="Remise">
        <View style={styles.chips}>
          {DISCOUNTS.map((d) => (
            <Choice key={d} label={d ? `-${d} %` : 'Aucune'} selected={discountPct === d} onPress={() => setDiscountPct(d)} />
          ))}
        </View>
        {discount ? <Text style={styles.meta}>Sous-total {p(subtotal)} · remise -{p(discount)} (avant TVA)</Text> : null}
      </Section>

      <Section emoji="💝" title="Pourboire">
        <View style={styles.chips}>
          <Choice label="Aucun" selected={tipMode === 'aucun'} onPress={() => setTipMode('aucun')} />
          {([5, 10, 15] as const).map((t) => (
            <Choice key={t} label={`${t} %`} selected={tipMode === t} onPress={() => setTipMode(t)} />
          ))}
          <Choice label="Arrondi" selected={tipMode === 'arrondi'} onPress={() => setTipMode('arrondi')} />
          <Choice label="Montant" selected={tipMode === 'libre'} onPress={() => setTipMode('libre')} />
        </View>
        {tipMode === 'libre' ? (
          <TextInput
            value={tipText}
            onChangeText={setTipText}
            keyboardType="decimal-pad"
            placeholder="Montant du pourboire (ex : 2,50)"
            placeholderTextColor="#A99E90"
            style={styles.input}
            accessibilityLabel="Montant du pourboire"
          />
        ) : null}
      </Section>

      <Section emoji="👥" title="Partager l’addition">
        <View style={styles.splitRow}>
          <Stepper label="personnes" value={split} min={1} onChange={setSplit} />
          <Text style={styles.splitText}>{split > 1 ? `${p(Math.ceil(toPay / split))} par personne` : '1 personne'}</Text>
        </View>
      </Section>

      <Section emoji="💳" title="Paiement">
        <View style={styles.methods}>
          {METHODS.map(({ m, emoji }) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityState={{ selected: method === m }}
              accessibilityLabel={paymentLabel[m]}
              onPress={() => {
                haptic.tap();
                setMethod(m);
              }}
              style={[styles.method, method === m && styles.methodActive]}
            >
              <Emoji3D emoji={emoji} size={30} />
              <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{paymentLabel[m]}</Text>
            </Pressable>
          ))}
        </View>
        {method === 'especes' ? (
          <View style={styles.cash}>
            <View style={styles.chips}>
              {quickCash.map((v) => (
                <Choice key={v} label={p(v)} selected={cash === v} onPress={() => setCashText((v / 100).toFixed(2).replace('.', ','))} />
              ))}
            </View>
            <TextInput
              value={cashText}
              onChangeText={setCashText}
              keyboardType="decimal-pad"
              placeholder="Espèces reçues"
              placeholderTextColor="#A99E90"
              style={styles.input}
              accessibilityLabel="Espèces reçues"
            />
            {change !== null ? (
              <View style={[styles.change, change < 0 && styles.changeMissing]}>
                <Text style={styles.changeLabel}>{change < 0 ? 'Il manque' : 'À rendre'}</Text>
                <Text style={styles.changeValue}>{p(Math.abs(change))}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Section>

      <Button
        title={vatRate === null ? 'Choisissez la TVA' : `Encaisser ${p(toPay)}`}
        icon={vatRate === null ? 'alert-circle-outline' : 'checkmark-circle'}
        large
        onPress={confirm}
        disabled={vatRate === null || (method === 'especes' && change !== null && change < 0)}
      />
    </FormModal>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Emoji3D emoji={emoji} size={22} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[styles.choice, selected && styles.choiceActive]}
    >
      {selected ? <Ionicons name="checkmark" size={14} color={colors.ink} /> : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center' },
  label: { fontSize: 13, color: colors.goldDeep, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  amount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 44, color: colors.text },
  meta: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  warning: { marginTop: 6, color: colors.ready, fontWeight: '700', textAlign: 'center' },
  section: { gap: 8, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  choiceActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  choiceText: { fontWeight: '700', color: colors.text },
  choiceTextActive: { color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: colors.text,
  },
  vatRow: { flexDirection: 'row', gap: 8 },
  vat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  vatActive: { backgroundColor: colors.ink, borderColor: colors.gold },
  vatText: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 20, color: colors.text },
  vatTextActive: { color: colors.gold },
  vatHint: { fontSize: 13, color: colors.ready, fontWeight: '700' },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitText: { flex: 1, fontWeight: '700', color: colors.text },
  methods: { flexDirection: 'row', gap: 8 },
  method: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  methodActive: { backgroundColor: colors.ink, borderColor: colors.gold },
  methodText: { fontWeight: '700', color: colors.text, fontSize: 13, textAlign: 'center' },
  methodTextActive: { color: colors.onDark },
  cash: { gap: 8 },
  change: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.freeSoft,
    borderRadius: 12,
    padding: 12,
  },
  changeMissing: { backgroundColor: colors.dangerSoft },
  changeLabel: { fontWeight: '800', color: colors.text },
  changeValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 24, color: colors.text },
});
