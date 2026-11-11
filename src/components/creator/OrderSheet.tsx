import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { orderTodo } from '../../license/dashboard';
import { keyWhatsAppLink, type PaymentOrder } from '../../license/server';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';
import { haptic } from '../../utils/haptics';
import { planLabel, STATUS_TEXT } from '../PaymentFlow';
import { useToast } from '../Toast';
import { Button, confirm, Field, FormModal, notify } from '../ui';

export const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

/** Ouvre une conversation WhatsApp avec un numéro (sans message). */
export const openWhatsApp = (phone: string) =>
  Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`).catch(() => notify('WhatsApp', `Numéro : ${phone}`));

interface Props {
  order: PaymentOrder | null;
  onClose: () => void;
  onConfirm: (o: PaymentOrder, note: string) => Promise<void>;
  onReject: (o: PaymentOrder, note: string) => Promise<void>;
  onGenerateKey: (o: PaymentOrder) => Promise<string | null>;
}

/** Détail d'une commande : vérification, confirmation, génération et envoi de la clé. */
export function OrderSheet({ order, onClose, onConfirm, onReject, onGenerateKey }: Props) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  if (!order) return null;
  const st = STATUS_TEXT[order.status];
  const todo = orderTodo(order);
  const open = order.status === 'en_attente' || order.status === 'preuve_envoyee';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setKey(null);
    setNote('');
    onClose();
  };

  return (
    <FormModal visible title={`Commande n° ${order.number}`} onClose={close}>
      <View style={[styles.status, { backgroundColor: st.soft, borderColor: st.color }]}>
        <Text style={[styles.statusText, { color: st.color }]}>
          {st.emoji} {todo === 'generer' ? 'Paiement confirmé · clé à générer' : todo === 'envoyer' ? 'Clé générée · en attente d’activation' : st.label}
        </Text>
      </View>

      <View style={styles.box}>
        <Info label="Référence (communication)" value={order.reference} strong />
        <Info label="Montant attendu" value={formatPrice(order.amount)} strong />
        <Info label="Formule" value={planLabel(order.plan)} />
        <Info label="Client" value={order.customer_name} />
        {order.restaurant_name ? <Info label="Commerce" value={order.restaurant_name} /> : null}
        <Info label="E-mail" value={order.email} />
        <Info label="WhatsApp" value={order.phone} />
        <Info label="Licence" value={order.license_id} />
        <Info label="Créée le" value={formatDateTime(order.created_at)} />
        <Info label="Preuve envoyée" value={order.proof_sent_at ? formatDateTime(order.proof_sent_at) : 'pas encore'} />
        {order.confirmed_at ? <Info label="Confirmée le" value={formatDateTime(order.confirmed_at)} /> : null}
        {order.key_created_at ? <Info label="Clé" value={`…${order.key_hint} · ${order.key_redeemed_at ? `activée le ${formatDateTime(order.key_redeemed_at)}` : 'pas encore activée'}`} /> : null}
        {order.admin_note ? <Info label="Note" value={order.admin_note} /> : null}
      </View>

      <Button title="Ouvrir la conversation WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => openWhatsApp(order.phone)} />

      {open ? (
        <>
          <Text style={styles.help}>
            Vérifiez sur Revolut un virement de {formatPrice(order.amount)} avec la communication {order.reference}, et la
            capture reçue sur WhatsApp.
          </Text>
          <Field label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="ex : reçu sur Revolut le 12/11" />
          <Button
            title="Confirmer le paiement"
            icon="checkmark-circle"
            large
            disabled={busy}
            onPress={() =>
              confirm('Confirmer le paiement ?', `Vous avez bien reçu ${formatPrice(order.amount)} (réf. ${order.reference}) ?`, () => run(() => onConfirm(order, note)), 'Confirmer')
            }
          />
          <Button
            title="Refuser"
            icon="close-circle-outline"
            variant="ghost"
            disabled={busy}
            onPress={() => confirm('Refuser ce paiement ?', 'Le client verra « Paiement refusé » et pourra refaire une commande.', () => run(() => onReject(order, note)), 'Refuser')}
          />
        </>
      ) : null}

      {order.status === 'confirmee' && !order.key_redeemed_at ? (
        key ? (
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>CLÉ D’ACTIVATION (affichée une seule fois)</Text>
            <Text style={styles.key} selectable>
              {key}
            </Text>
            <View style={styles.keyActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copier la clé"
                onPress={() => {
                  haptic.tap();
                  Clipboard.setStringAsync(key).then(() => toast('Clé copiée', '📋')).catch(() => undefined);
                }}
                style={styles.copy}
              >
                <Ionicons name="copy-outline" size={18} color={colors.ink} />
                <Text style={styles.copyText}>Copier</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Envoyer la clé sur WhatsApp"
                onPress={() => Linking.openURL(keyWhatsAppLink(order, key)).catch(() => notify('WhatsApp', key))}
                style={styles.send}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.sendText}>Envoyer au client</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Button
            title={order.key_created_at ? 'Régénérer la clé (l’ancienne ne marchera plus)' : 'Générer la clé d’activation'}
            icon="key"
            large
            disabled={busy}
            onPress={() =>
              run(async () => {
                const k = await onGenerateKey(order);
                if (k) setKey(k);
              })
            }
          />
        )
      ) : null}
    </FormModal>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoStrong]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { borderRadius: 14, borderWidth: 1, padding: 12 },
  statusText: { fontWeight: '800', fontSize: 15 },
  box: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  infoLabel: { color: colors.muted, fontSize: 13, flexShrink: 0 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  infoStrong: { fontWeight: '900', color: colors.goldDeep, fontSize: 15 },
  help: { color: colors.text, fontSize: 14, lineHeight: 20 },
  keyBox: { backgroundColor: colors.ink, borderRadius: 18, padding: 16, gap: 10, alignItems: 'center' },
  keyLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  key: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 24, letterSpacing: 2 },
  keyActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.gold, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  copyText: { fontWeight: '800', color: colors.ink },
  send: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1FAF5A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  sendText: { fontWeight: '800', color: '#FFFFFF' },
});
