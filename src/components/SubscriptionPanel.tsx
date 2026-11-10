import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PRICES } from '../config';
import { applyCode } from '../license/license';
import { setLicense } from '../store/actions';
import { useStore } from '../store/StoreProvider';
import type { Plan } from '../store/types';
import { colors, fonts, shadow } from '../theme';
import { formatPrice } from '../utils/format';
import { Button, notify } from './ui';

interface Props {
  /** Fond sombre (écran de blocage). */
  dark?: boolean;
  onActivated?: () => void;
}

/** Offres d'abonnement, paiement et saisie d'un code d'activation (ou du code administrateur). */
export function SubscriptionPanel({ dark, onActivated }: Props) {
  const { state, dispatch, setSession } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pay = (plan: Exclude<Plan, 'aucun'>) => {
    const link = state.paymentLinks[plan];
    if (!link) {
      notify(
        'Paiement',
        `Le paiement en ligne n’est pas encore configuré.\nContactez votre fournisseur en indiquant votre identifiant de licence : ${state.license.id}`,
      );
      return;
    }
    Linking.openURL(link).catch(() => notify('Paiement', 'Impossible d’ouvrir la page de paiement.'));
  };

  const submit = () => {
    const result = applyCode(state.license, code);
    if (result.kind === 'invalid') {
      setError(result.message);
      return;
    }
    dispatch(setLicense(result.license));
    setCode('');
    setError(null);
    if (result.kind === 'admin') {
      setSession({ admin: true, manager: true });
      notify('Mode administrateur', 'Licence à vie débloquée. Vous contrôlez tous les accès (Gestion › Administration).');
    } else {
      notify('Abonnement activé', result.message);
    }
    onActivated?.();
  };

  const fg = dark ? colors.onDark : colors.text;
  const muted = dark ? colors.onDarkMuted : colors.muted;

  return (
    <View style={styles.wrap}>
      <View style={styles.plans}>
        <PlanCard
          title="Mensuel"
          price={formatPrice(PRICES.mensuel)}
          period="/ mois"
          lines={['Sans engagement', 'Échéance le 1er de chaque mois', 'Rappel 5 jours avant']}
          onPay={() => pay('mensuel')}
        />
        <PlanCard
          title="À vie"
          price={formatPrice(PRICES.vie)}
          period="une fois"
          lines={['Paiement unique', 'Plus aucune échéance', 'Toutes les mises à jour']}
          highlight
          onPay={() => pay('vie')}
        />
      </View>

      <View style={[styles.codeBox, dark ? styles.codeBoxDark : styles.codeBoxLight]}>
        <Text style={[styles.codeTitle, { color: fg }]}>Code d’activation</Text>
        <Text style={[styles.codeHint, { color: muted }]}>
          Après paiement, saisissez le code reçu. Identifiant de licence :{' '}
          <Text style={[styles.licenseId, { color: colors.gold }]} selectable>
            {state.license.id}
          </Text>
        </Text>
        <View style={styles.codeRow}>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setError(null);
            }}
            placeholder="ex : M202612-3FA9C1"
            placeholderTextColor={muted}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={submit}
            accessibilityLabel="Code d’activation"
            style={[styles.codeInput, dark ? styles.codeInputDark : styles.codeInputLight]}
          />
          <Button title="Activer" onPress={submit} disabled={!code.trim()} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

interface PlanCardProps {
  title: string;
  price: string;
  period: string;
  lines: string[];
  highlight?: boolean;
  onPay: () => void;
}

function PlanCard({ title, price, period, lines, highlight, onPay }: PlanCardProps) {
  return (
    <View style={[styles.plan, highlight && styles.planHighlight]}>
      {highlight ? (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>LE PLUS AVANTAGEUX</Text>
        </View>
      ) : null}
      <Text style={[styles.planTitle, highlight && { color: colors.gold }]}>{title}</Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, highlight && { color: colors.onDark }]}>{price}</Text>
        <Text style={[styles.period, highlight && { color: colors.onDarkMuted }]}>{period}</Text>
      </View>
      <View style={styles.lines}>
        {lines.map((l) => (
          <View key={l} style={styles.line}>
            <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
            <Text style={[styles.lineText, highlight && { color: colors.onDark }]}>{l}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Payer l’abonnement ${title}`}
        onPress={onPay}
        style={({ pressed }) => [styles.payBtn, highlight ? styles.payBtnGold : styles.payBtnDark, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="card" size={18} color={highlight ? colors.ink : colors.onDark} />
        <Text style={[styles.payText, { color: highlight ? colors.ink : colors.onDark }]}>Payer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  plan: {
    flexGrow: 1,
    flexBasis: 240,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadow,
  },
  planHighlight: { backgroundColor: colors.ink2, borderColor: colors.gold, borderWidth: 2 },
  ribbon: {
    position: 'absolute',
    top: -11,
    right: 16,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ribbonText: { fontSize: 10, fontWeight: '900', color: colors.ink, letterSpacing: 1 },
  planTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 22, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 34, color: colors.text },
  period: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  lines: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontSize: 14, color: colors.text },
  payBtn: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: 14,
  },
  payBtnGold: { backgroundColor: colors.gold },
  payBtnDark: { backgroundColor: colors.ink },
  payText: { fontSize: 16, fontWeight: '800' },
  codeBox: { borderRadius: 18, padding: 16, gap: 8, borderWidth: 1 },
  codeBoxDark: { backgroundColor: colors.ink2, borderColor: colors.ink3 },
  codeBoxLight: { backgroundColor: colors.card, borderColor: colors.border },
  codeTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19 },
  codeHint: { fontSize: 13, lineHeight: 19 },
  licenseId: { fontWeight: '800', letterSpacing: 1 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
  codeInputDark: { backgroundColor: colors.ink, borderColor: colors.ink3, color: colors.onDark },
  codeInputLight: { backgroundColor: '#FFFFFF', borderColor: colors.border, color: colors.text },
  error: { color: '#E8857C', fontWeight: '700' },
});
