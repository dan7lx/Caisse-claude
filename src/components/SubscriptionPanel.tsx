import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DEMO_HOURS } from '../config';
import { applyCode, formatCountdown, isDemoCode, licenseStatus, startDemo } from '../license/license';
import { useBilling, useRedeemKey } from '../license/useLicenseServer';
import { setLicense } from '../store/actions';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, fonts, shadow } from '../theme';
import { formatPrice } from '../utils/format';
import { Emoji3D } from './Emoji3D';
import { PaymentFlow, planLabel, STATUS_TEXT } from './PaymentFlow';
import { useToast } from './Toast';
import { Button, PinPad } from './ui';

interface Props {
  /** Fond sombre (écran de blocage). */
  dark?: boolean;
}

/** Formules (mensuelle, à vie), mode démo, paiement et saisie d'un code d'activation. */
export function SubscriptionPanel({ dark }: Props) {
  const { state, device, dispatch } = useStore();
  const toast = useToast();
  const billing = useBilling();
  const redeem = useRedeemKey();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<'mensuel' | 'vie' | null>(null);
  const [demoPad, setDemoPad] = useState(false);
  const pending = device.pendingPayment;

  const submit = async () => {
    const result = applyCode(state.license, code);
    if (result.kind === 'invalid') {
      setError(result.message);
      return;
    }
    if (result.kind === 'demo') {
      dispatch(setLicense(result.license));
      setCode('');
      setError(null);
      toast(result.message, '🎁');
      return;
    }
    setBusy(true);
    const r = await redeem(result.key);
    setBusy(false);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setCode('');
    setError(null);
    toast(r.plan === 'vie' ? 'Licence à vie activée' : 'Abonnement activé pour 30 jours', '🎉');
  };

  const fg = dark ? colors.onDark : colors.text;
  const muted = dark ? colors.onDarkMuted : colors.muted;

  return (
    <View style={styles.wrap}>
      <View style={styles.plans}>
        <PlanCard
          emoji="🗓️"
          title="Mensuel"
          price={formatPrice(billing.price_monthly)}
          period="/ 30 jours"
          lines={['Sans engagement', 'Valable 30 jours dès l’activation', 'Rappel 5 jours avant la fin']}
          onPay={() => setPaying('mensuel')}
        />
        <PlanCard
          emoji="💎"
          title="À vie"
          price={formatPrice(billing.price_lifetime)}
          period="une fois"
          lines={['Paiement unique', 'Plus aucune échéance', 'Toutes les mises à jour']}
          highlight
          onPay={() => setPaying('vie')}
        />
      </View>

      {pending ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir ma commande en cours"
          onPress={() => setPaying(pending.plan)}
          style={({ pressed }) => [styles.pending, pressed && { opacity: 0.85 }]}
        >
          <Emoji3D emoji={STATUS_TEXT.preuve_envoyee.emoji} size={34} />
          <View style={styles.flex}>
            <Text style={styles.pendingTitle}>Paiement en cours · {planLabel(pending.plan)}</Text>
            <Text style={styles.pendingText}>Touchez pour voir le virement, envoyer la preuve ou saisir votre clé.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gold} />
        </Pressable>
      ) : null}

      <DemoCard dark={dark} onActivate={() => setDemoPad(true)} />

      <View style={[styles.codeBox, dark ? styles.codeBoxDark : styles.codeBoxLight]}>
        <View style={styles.codeHead}>
          <Emoji3D emoji="🔑" size={30} />
          <Text style={[styles.codeTitle, { color: fg }]}>J’ai reçu ma clé</Text>
        </View>
        <Text style={[styles.codeHint, { color: muted }]}>
          Après la confirmation de votre virement, saisissez la clé reçue sur WhatsApp. Identifiant de licence :{' '}
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
            placeholder="XXXX-XXXX-XXXX-XXXX"
            placeholderTextColor={muted}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={submit}
            accessibilityLabel="Code d’activation"
            style={[styles.codeInput, dark ? styles.codeInputDark : styles.codeInputLight]}
          />
          <Button title={busy ? '…' : 'Activer'} onPress={submit} disabled={!code.trim() || busy} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <PaymentFlow plan={paying} onClose={() => setPaying(null)} />

      <Modal visible={demoPad} animationType="slide" onRequestClose={() => setDemoPad(false)}>
        <View style={styles.pinScreen}>
          <PinPad
            emoji="🎁"
            title="Mode démo"
            subtitle={`Entrez le code démo pour ${DEMO_HOURS} h d’utilisation gratuite.`}
            length={4}
            onSubmit={(c) => {
              if (!isDemoCode(c)) return 'Code démo incorrect.';
              const started = startDemo(state.license);
              if (!started) return 'Le mode démo a déjà été utilisé sur cette licence.';
              dispatch(setLicense(started));
              setDemoPad(false);
              toast(`Mode démo activé : ${DEMO_HOURS} h offertes`, '🎁');
              return null;
            }}
          />
          <Button title="Annuler" variant="ghost" icon="close" onPress={() => setDemoPad(false)} />
        </View>
      </Modal>
    </View>
  );
}

/** Carte du mode démo : bouton d'activation, minuteur en cours, ou démo terminée. */
function DemoCard({ dark, onActivate }: { dark?: boolean; onActivate: () => void }) {
  const { state } = useStore();
  const status = licenseStatus(state.license);
  const now = useNow(status.demo ? 1000 : 60_000);
  const live = licenseStatus(state.license, now);
  if (live.plan === 'vie' || (live.plan === 'mensuel' && live.dueDate && live.dueDate > now)) return null;

  return (
    <View style={[styles.demo, dark && styles.demoDark]}>
      <Emoji3D emoji={live.demo ? '⏱️' : '🎁'} size={52} />
      <View style={styles.flex}>
        <Text style={[styles.demoTitle, dark && { color: colors.onDark }]}>
          {live.demo ? 'Mode démo en cours' : `Mode démo · ${DEMO_HOURS} h gratuites`}
        </Text>
        {live.demo && live.demoEndsAt ? (
          <>
            <Text style={styles.demoTimer}>{formatCountdown(live.demoEndsAt - now)}</Text>
            <Text style={[styles.demoText, dark && { color: colors.onDarkMuted }]}>
              Ensuite, l’application se bloque et demande le paiement.
            </Text>
          </>
        ) : live.demoUsed ? (
          <Text style={[styles.demoText, dark && { color: colors.onDarkMuted }]}>
            L’essai gratuit a déjà été utilisé. Choisissez une formule pour continuer.
          </Text>
        ) : (
          <Text style={[styles.demoText, dark && { color: colors.onDarkMuted }]}>
            Essayez toute l’application avec le code démo. Un minuteur de {DEMO_HOURS} h démarre à l’activation.
          </Text>
        )}
      </View>
      {!live.demo && !live.demoUsed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activer le mode démo"
          onPress={onActivate}
          style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.demoBtnText}>Activer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface PlanCardProps {
  emoji: string;
  title: string;
  price: string;
  period: string;
  lines: string[];
  highlight?: boolean;
  onPay: () => void;
}

function PlanCard({ emoji, title, price, period, lines, highlight, onPay }: PlanCardProps) {
  return (
    <View style={[styles.plan, highlight && styles.planHighlight]}>
      {highlight ? (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>LE PLUS AVANTAGEUX</Text>
        </View>
      ) : null}
      <View style={styles.planHead}>
        <Emoji3D emoji={emoji} size={44} />
        <Text style={[styles.planTitle, highlight && { color: colors.gold }]}>{title}</Text>
      </View>
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
  flex: { flex: 1 },
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
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 22, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 34, color: colors.text },
  period: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  lines: { gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontSize: 14, color: colors.text, flexShrink: 1 },
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
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF6E0',
    borderWidth: 1,
    borderColor: colors.goldLight,
  },
  demoDark: { backgroundColor: '#2B2213', borderColor: colors.goldDeep },
  demoTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19, color: colors.text },
  demoTimer: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums', 'tabular-nums'], fontSize: 30, color: colors.gold },
  demoText: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  demoBtn: { backgroundColor: colors.gold, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  demoBtnText: { color: colors.ink, fontWeight: '800' },
  codeBox: { borderRadius: 18, padding: 16, gap: 8, borderWidth: 1 },
  codeBoxDark: { backgroundColor: colors.ink2, borderColor: colors.ink3 },
  codeBoxLight: { backgroundColor: colors.card, borderColor: colors.border },
  codeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19 },
  codeHint: { fontSize: 13, lineHeight: 19 },
  licenseId: { fontWeight: '800', letterSpacing: 1 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  codeInput: {
    flex: 1,
    minWidth: 0,
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
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.ink2,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  pendingTitle: { color: colors.onDark, fontWeight: '800', fontSize: 15 },
  pendingText: { color: colors.onDarkMuted, fontSize: 13, marginTop: 2 },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
