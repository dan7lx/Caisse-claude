import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LICENSE_SERVER } from '../config';
import {
  type BillingInfo,
  type CustomerInfo,
  formatIban,
  licenseApi,
  normalizeKey,
  type OrderStatus,
  type PaymentOrder,
  type PayPlan,
  proofWhatsAppLink,
} from '../license/server';
import { useBilling, useRedeemKey } from '../license/useLicenseServer';
import { useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { formatPrice } from '../utils/format';
import { haptic } from '../utils/haptics';
import { Emoji3D } from './Emoji3D';
import { useToast } from './Toast';
import { Button, Field, FormModal, notify } from './ui';

const WHATSAPP_GREEN = '#1FAF5A';
const POLL_MS = 20_000;

export const STATUS_TEXT: Record<OrderStatus, { label: string; emoji: string; color: string; soft: string }> = {
  en_attente: { label: 'En attente de votre virement', emoji: '⏳', color: colors.goldDeep, soft: colors.goldSoft },
  preuve_envoyee: { label: 'Preuve reçue · vérification en cours', emoji: '🔎', color: colors.busy, soft: colors.busySoft },
  confirmee: { label: 'Paiement confirmé', emoji: '✅', color: colors.free, soft: colors.freeSoft },
  refusee: { label: 'Paiement refusé', emoji: '⛔', color: colors.danger, soft: colors.dangerSoft },
  annulee: { label: 'Commande annulée', emoji: '🚫', color: colors.muted, soft: colors.line },
};

export const planLabel = (plan: PayPlan) => (plan === 'vie' ? 'Licence à vie' : 'Abonnement mensuel · 30 jours');

interface Props {
  /** Formule choisie (null = fenêtre fermée). */
  plan: PayPlan | null;
  onClose: () => void;
}

/**
 * Paiement par virement avec validation manuelle :
 * 1. coordonnées du client → commande avec référence unique ;
 * 2. page de virement (IBAN, montant exact, communication) + preuve sur WhatsApp ;
 * 3. suivi de la commande ; après confirmation du créateur, saisie de la clé reçue.
 */
export function PaymentFlow({ plan, onClose }: Props) {
  const { state, device, updateDevice } = useStore();
  const billing = useBilling();
  const pending = device.pendingPayment;
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showOrder = plan !== null && pending !== null && pending.plan === plan;

  const refresh = useCallback(async () => {
    if (!LICENSE_SERVER || !pending) return;
    try {
      const r = await licenseApi.orderStatus(LICENSE_SERVER, pending);
      setOrder(r.order);
      setKeyReady(r.key_ready);
      setInfo(r.billing);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      if (/introuvable/i.test(msg)) updateDevice({ pendingPayment: null });
      else setError(msg);
    }
  }, [pending, updateDevice]);

  // Suivi automatique de la commande tant que la fenêtre est ouverte.
  useEffect(() => {
    if (!showOrder) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [showOrder, refresh]);

  if (plan === null) return null;
  const server = LICENSE_SERVER;
  const title = plan === 'vie' ? 'Licence à vie' : 'Abonnement mensuel';

  if (!server) {
    return (
      <FormModal visible title={title} onClose={onClose}>
        <Text style={styles.text}>
          Le paiement en ligne n’est pas encore activé sur cette version. Contactez le support sur WhatsApp pour recevoir
          votre clé d’activation.
        </Text>
        <Button title="Fermer" onPress={onClose} />
      </FormModal>
    );
  }

  return (
    <FormModal visible title={title} onClose={onClose}>
      {showOrder ? (
        order ? (
          <OrderView
            order={order}
            billing={info ?? billing}
            keyReady={keyReady}
            onRefresh={refresh}
            onDone={onClose}
            onNew={() => {
              setOrder(null);
              updateDevice({ pendingPayment: null });
            }}
          />
        ) : (
          <View style={styles.loading}>
            {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.gold} />}
            {error ? <Button title="Réessayer" onPress={refresh} /> : null}
          </View>
        )
      ) : (
        <CustomerForm
          plan={plan}
          billing={billing}
          busy={busy}
          error={error}
          otherPending={pending !== null}
          defaults={{ restaurant: state.settings.restaurantName }}
          onSubmit={async (c) => {
            setBusy(true);
            setError(null);
            try {
              if (pending) await licenseApi.cancel(server, pending).catch(() => undefined);
              const r = await licenseApi.createOrder(server, state.license.id, plan, c);
              updateDevice({ pendingPayment: { orderId: r.order.id, token: r.token, plan } });
              setOrder(r.order);
              setInfo(r.billing);
              setKeyReady(false);
              haptic.success();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Impossible de créer la commande.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </FormModal>
  );
}

/* ------------------------------ Étape 1 : coordonnées ------------------------------ */

function CustomerForm({
  plan,
  billing,
  busy,
  error,
  otherPending,
  defaults,
  onSubmit,
}: {
  plan: PayPlan;
  billing: BillingInfo;
  busy: boolean;
  error: string | null;
  otherPending: boolean;
  defaults: { restaurant: string };
  onSubmit: (c: CustomerInfo) => void;
}) {
  const [name, setName] = useState('');
  const [restaurant, setRestaurant] = useState(defaults.restaurant);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const amount = plan === 'vie' ? billing.price_lifetime : billing.price_monthly;
  const valid = name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && phone.replace(/[^0-9]/g, '').length >= 8;

  return (
    <View style={styles.gap}>
      <View style={styles.planHead}>
        <Emoji3D emoji={plan === 'vie' ? '💎' : '🗓️'} size={52} />
        <View style={styles.flex}>
          <Text style={styles.planName}>{planLabel(plan)}</Text>
          <Text style={styles.planAmount}>{formatPrice(amount)}</Text>
        </View>
      </View>
      <Text style={styles.text}>Vos coordonnées, pour associer le paiement et la clé d’activation à votre restaurant :</Text>
      <Field label="Prénom et nom" value={name} onChangeText={setName} placeholder="ex : Marie Dupont" autoComplete="name" />
      <Field label="Nom du commerce" value={restaurant} onChangeText={setRestaurant} placeholder="ex : Le Comptoir" />
      <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="vous@exemple.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Numéro WhatsApp" value={phone} onChangeText={setPhone} placeholder="+32 470 12 34 56" keyboardType="phone-pad" hint="Pour vous envoyer votre clé d’activation." />
      {otherPending ? <Text style={styles.hint}>Votre commande précédente (autre formule) sera remplacée.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={busy ? 'Création…' : 'Continuer vers le paiement'}
        icon="arrow-forward"
        large
        disabled={!valid || busy}
        onPress={() => onSubmit({ name: name.trim(), restaurant: restaurant.trim(), email: email.trim(), phone: phone.trim() })}
      />
    </View>
  );
}

/* ------------------------------ Étape 2-3 : virement et suivi ------------------------------ */

function OrderView({
  order,
  billing,
  keyReady,
  onRefresh,
  onDone,
  onNew,
}: {
  order: PaymentOrder;
  billing: BillingInfo;
  keyReady: boolean;
  onRefresh: () => void;
  onDone: () => void;
  onNew: () => void;
}) {
  const { device, updateDevice } = useStore();
  const toast = useToast();
  const redeem = useRedeemKey();
  const [key, setKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const st = STATUS_TEXT[order.status];
  const amount = formatPrice(order.amount);
  const open = order.status === 'en_attente' || order.status === 'preuve_envoyee';

  const copy = (label: string, value: string) => {
    haptic.tap();
    Clipboard.setStringAsync(value)
      .then(() => toast(`${label} copié`, '📋'))
      .catch(() => toast('Copie impossible', '⚠️'));
  };

  // Ouvre WhatsApp avec le message prérempli et signale au créateur que la preuve est envoyée.
  const sendProof = () => {
    haptic.tap();
    const link = proofWhatsAppLink(billing, order, (c) => formatPrice(c));
    Linking.openURL(link).catch(() => notify('WhatsApp', `Écrivez au +${billing.whatsapp} avec la référence ${order.reference}.`));
    if (LICENSE_SERVER && device.pendingPayment) {
      licenseApi
        .proofSent(LICENSE_SERVER, device.pendingPayment)
        .then(onRefresh)
        .catch(() => undefined);
    }
  };

  const activate = async () => {
    const k = normalizeKey(key);
    if (!k) return setKeyError('Format attendu : XXXX-XXXX-XXXX-XXXX.');
    setActivating(true);
    const r = await redeem(k);
    setActivating(false);
    if ('error' in r) return setKeyError(r.error);
    haptic.success();
    toast(r.plan === 'vie' ? 'Licence à vie activée' : 'Abonnement activé pour 30 jours', '🎉');
    onDone();
  };

  return (
    <View style={styles.gap}>
      <View style={styles.merchant}>
        <Text style={styles.merchantLabel}>PAIEMENT À</Text>
        <Text style={styles.merchantName}>{billing.business_name}</Text>
        <Text style={styles.merchantOwner}>
          {billing.first_name} {billing.last_name}
        </Text>
      </View>

      <View style={[styles.status, { backgroundColor: st.soft, borderColor: st.color }]}>
        <Emoji3D emoji={st.emoji} size={26} />
        <View style={styles.flex}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          <Text style={styles.statusSub}>
            Commande n° {order.number} · {planLabel(order.plan)}
          </Text>
          {order.admin_note && order.status === 'refusee' ? <Text style={styles.statusSub}>{order.admin_note}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualiser" onPress={onRefresh} hitSlop={10}>
          <Ionicons name="refresh" size={22} color={st.color} />
        </Pressable>
      </View>

      {open ? (
        <>
          <View style={styles.box}>
            <Row label="Montant exact" value={amount} big onCopy={() => copy('Montant', (order.amount / 100).toFixed(2).replace('.', ','))} />
            <Row label="Bénéficiaire" value={billing.holder} onCopy={() => copy('Bénéficiaire', billing.holder)} />
            <Row label="IBAN" value={formatIban(billing.iban)} mono onCopy={() => copy('IBAN', billing.iban)} />
            <Row label="Communication (obligatoire)" value={order.reference} mono reference onCopy={() => copy('Référence', order.reference)} last />
          </View>
          <Text style={styles.instant}>⚡ Le virement doit être instantané.</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer ma preuve de paiement sur WhatsApp"
            onPress={sendProof}
            style={({ pressed }) => [styles.whatsapp, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            <Text style={styles.whatsappText}>Envoyer ma preuve de paiement sur WhatsApp</Text>
          </Pressable>
          <Text style={styles.hint}>
            WhatsApp s’ouvre avec un message déjà rempli : joignez simplement la capture d’écran de votre virement. Votre
            clé d’activation vous est envoyée dès la vérification du paiement.
          </Text>
        </>
      ) : null}

      {order.status === 'confirmee' || keyReady ? (
        <View style={styles.keyBox}>
          <Text style={styles.keyTitle}>🔑 Saisissez la clé reçue sur WhatsApp</Text>
          <TextInput
            value={key}
            onChangeText={(t) => {
              setKey(t);
              setKeyError(null);
            }}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor="#A99E90"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Clé d’activation reçue"
            style={styles.keyInput}
          />
          {keyError ? <Text style={styles.error}>{keyError}</Text> : null}
          <Button title={activating ? 'Activation…' : 'Activer ma licence'} icon="key" large onPress={activate} disabled={activating || !key.trim()} />
        </View>
      ) : null}

      {open ? (
        <Button
          title="Annuler cette commande"
          variant="ghost"
          icon="close-circle-outline"
          onPress={() => {
            if (LICENSE_SERVER && device.pendingPayment) licenseApi.cancel(LICENSE_SERVER, device.pendingPayment).catch(() => undefined);
            updateDevice({ pendingPayment: null });
            onDone();
          }}
        />
      ) : order.status === 'refusee' || order.status === 'annulee' ? (
        <Button title="Faire une nouvelle commande" icon="refresh" onPress={onNew} />
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  onCopy,
  mono,
  big,
  reference,
  last,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
  big?: boolean;
  reference?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, mono && styles.mono, big && styles.rowBig, reference && styles.rowRef]} selectable>
          {value}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Copier ${label}`} onPress={onCopy} style={styles.copy} hitSlop={6}>
        <Ionicons name="copy-outline" size={16} color={colors.goldDeep} />
        <Text style={styles.copyText}>Copier</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: 12 },
  loading: { padding: 30, alignItems: 'center', gap: 12 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: '700' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planName: { fontWeight: '800', color: colors.goldDeep, fontSize: 14 },
  planAmount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 34, color: colors.text },
  merchant: { backgroundColor: colors.ink, borderRadius: 18, padding: 16, alignItems: 'center' },
  merchantLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  merchantName: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 24, color: colors.onDark, marginTop: 2 },
  merchantOwner: { color: colors.onDarkMuted, fontSize: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  statusText: { fontWeight: '800', fontSize: 15 },
  statusSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  box: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  rowValue: { fontSize: 16, color: colors.text, fontWeight: '700', marginTop: 2 },
  rowBig: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 28 },
  rowRef: { fontSize: 22, color: colors.goldDeep, letterSpacing: 1.5 },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.goldSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  copyText: { color: colors.goldDeep, fontWeight: '800', fontSize: 12 },
  instant: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: WHATSAPP_GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  whatsappText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, flexShrink: 1, textAlign: 'center' },
  keyBox: { gap: 10, backgroundColor: colors.freeSoft, borderRadius: 16, padding: 14 },
  keyTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  keyInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
    color: colors.text,
  },
});
