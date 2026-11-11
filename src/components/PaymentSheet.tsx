import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRICES } from '../config';
import { licenseStatus, monthKey } from '../license/license';
import { useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';
import { formatPrice } from '../utils/format';
import { haptic } from '../utils/haptics';
import { Emoji3D } from './Emoji3D';
import { useToast } from './Toast';
import { Button, FormModal } from './ui';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « BE71650156242169 » → « BE71 6501 5624 2169 » */
export const formatIban = (iban: string) => iban.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();

interface Props {
  plan: 'mensuel' | 'vie' | null;
  onClose: () => void;
}

/** Fiche de paiement par virement : montant, bénéficiaire, IBAN et communication à copier. */
export function PaymentSheet({ plan, onClose }: Props) {
  const { state } = useStore();
  const toast = useToast();
  if (!plan) return null;

  const status = licenseStatus(state.license);
  // Mois réglé : celui de la prochaine échéance si l'abonnement est actif, sinon le mois en cours.
  const monthTs = plan === 'mensuel' && status.dueDate && status.dueDate > Date.now() ? status.dueDate : Date.now();
  const month = monthKey(monthTs);
  const monthLabel = `${MONTHS[parseInt(month.slice(4), 10) - 1]} ${month.slice(0, 4)}`;
  const amount = formatPrice(PRICES[plan]);
  const reference = `CAISSE ${state.license.id} ${plan === 'vie' ? 'VIE' : `M${month}`}`;
  const iban = formatIban(state.billing.iban);
  const cardLink = state.paymentLinks[plan];

  const copy = (label: string, value: string) => {
    haptic.tap();
    Clipboard.setStringAsync(value)
      .then(() => toast(`${label} copié`, '📋'))
      .catch(() => toast('Copie impossible', '⚠️'));
  };

  return (
    <FormModal visible title="Paiement" onClose={onClose}>
      <View style={styles.head}>
        <Emoji3D emoji={plan === 'vie' ? '💎' : '🗓️'} size={56} />
        <View style={styles.flex}>
          <Text style={styles.plan}>{plan === 'vie' ? 'Licence à vie' : `Abonnement mensuel · ${monthLabel}`}</Text>
          <Text style={styles.amount}>{amount}</Text>
        </View>
      </View>

      <Text style={styles.intro}>Effectuez un virement avec les informations suivantes :</Text>

      <View style={styles.box}>
        <Row label="Montant à payer" value={amount} onCopy={() => copy('Montant', amount.replace(/\s?€/, '').replace(/ /g, ''))} strong />
        <Row label="Bénéficiaire" value={state.billing.holder} onCopy={() => copy('Nom', state.billing.holder)} />
        <Row label="IBAN" value={iban} onCopy={() => copy('IBAN', state.billing.iban.replace(/\s/g, ''))} mono />
        <Row label="Communication" value={reference} onCopy={() => copy('Communication', reference)} mono last />
      </View>

      <View style={styles.instant}>
        <Emoji3D emoji="⚡" size={18} />
        <Text style={styles.instantText}>
          Le paiement doit être effectué par virement instantané. Indiquez la communication pour que votre paiement soit
          reconnu.
        </Text>
      </View>

      <View style={styles.steps}>
        <Text style={styles.step}>1. Faites le virement depuis votre application bancaire.</Text>
        <Text style={styles.step}>2. Vous recevez votre code d’activation.</Text>
        <Text style={styles.step}>3. Saisissez-le dans « Code d’activation » : l’application est débloquée.</Text>
      </View>

      {cardLink ? (
        <Button title="Payer par carte" icon="card" variant="secondary" onPress={() => Linking.openURL(cardLink).catch(() => {})} />
      ) : null}
      <Button
        title="J’ai effectué le virement"
        icon="checkmark-circle"
        large
        onPress={() => {
          toast('Merci ! Votre code d’activation va vous être envoyé.', '🎉');
          onClose();
        }}
      />
    </FormModal>
  );
}

interface RowProps {
  label: string;
  value: string;
  onCopy: () => void;
  strong?: boolean;
  mono?: boolean;
  last?: boolean;
}

function Row({ label, value, onCopy, strong, mono, last }: RowProps) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, strong && styles.rowStrong, mono && styles.rowMono]} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copier ${label}`}
        onPress={onCopy}
        hitSlop={8}
        style={({ pressed }) => [styles.copy, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="copy-outline" size={18} color={colors.goldDeep} />
        <Text style={styles.copyText}>Copier</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  plan: { color: colors.goldDeep, fontWeight: '800', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  amount: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 40, color: colors.text },
  intro: { color: colors.text, fontSize: 15 },
  box: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rowValue: { fontSize: 17, color: colors.text, fontWeight: '600', marginTop: 2 },
  rowStrong: { fontSize: 20, fontWeight: '800' },
  rowMono: { letterSpacing: 0.8 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
  },
  copyText: { color: colors.goldDeep, fontWeight: '800', fontSize: 13 },
  instant: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  instantText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 17 },
  steps: { gap: 4, backgroundColor: colors.goldSoft, borderRadius: 14, padding: 12 },
  step: { fontSize: 13, color: colors.text, lineHeight: 19 },
});
