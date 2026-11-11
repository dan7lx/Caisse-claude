import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { ManagerGate } from '../../components/ManagerGate';
import { formatIban } from '../../components/PaymentSheet';
import { formatLongDate } from '../../components/PaymentCalendar';
import { Button, Card, Chip, confirm, Field, Notice, notify, SectionTitle, SwitchRow } from '../../components/ui';
import { extendOneMonth, formatCountdown, lifetime, licenseStatus, makeActivationCode, monthKey, revoke } from '../../license/license';
import { setBilling, setLicense, setManagerPin, setPaymentLinks, setSecurity } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors, fonts } from '../../theme';

export default function AdminRoute() {
  return (
    <ManagerGate adminOnly>
      <AdminScreen />
    </ManagerGate>
  );
}

const MONTH_NAMES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function monthOptions(now: number): { key: string; label: string }[] {
  const d = new Date(now);
  return [0, 1, 2].map((offset) => {
    const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    return { key: monthKey(m.getTime()), label: `${MONTH_NAMES[m.getMonth()]} ${m.getFullYear()}` };
  });
}

function AdminScreen() {
  const { state, device, dispatch, setSession, closeLobby } = useStore();
  const status = licenseStatus(state.license);
  const [clientId, setClientId] = useState(state.license.id);
  const [month, setMonth] = useState(monthKey(Date.now()));
  const [generated, setGenerated] = useState<string | null>(null);
  const [linkMonthly, setLinkMonthly] = useState(state.paymentLinks.mensuel);
  const [linkLifetime, setLinkLifetime] = useState(state.paymentLinks.vie);
  const [iban, setIban] = useState(formatIban(state.billing.iban));
  const [holder, setHolder] = useState(state.billing.holder);

  const generate = (plan: 'mensuel' | 'vie') => {
    const id = clientId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id)) {
      notify('Identifiant invalide', 'Format attendu : ABCD-1234 (affiché dans l’écran Abonnement du client).');
      return;
    }
    setGenerated(makeActivationCode(id, plan === 'vie' ? { plan: 'vie' } : { plan: 'mensuel', month }));
  };

  const licenseText =
    status.plan === 'vie'
      ? 'Licence à vie'
      : status.active && status.dueDate
        ? `Mensuel, payé jusqu’au ${formatLongDate(status.dueDate)}`
        : status.demo && status.demoEndsAt
          ? `Mode démo, ${formatCountdown(status.demoEndsAt - Date.now())} restantes`
          : 'Aucune licence active (application bloquée)';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Administration' }} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>MODE ADMINISTRATEUR</Text>
        <Text style={styles.heroTitle}>Contrôle total</Text>
        <Text style={styles.heroSub}>Licence {state.license.id} · {licenseText}</Text>
      </View>

      <SectionTitle>Licence de ce restaurant</SectionTitle>
      <Card style={styles.card}>
        <View style={styles.buttons}>
          <Button title="+1 mois" icon="add" variant="secondary" onPress={() => dispatch(setLicense(extendOneMonth(state.license)))} style={styles.flex} />
          <Button title="À vie" icon="diamond" onPress={() => dispatch(setLicense(lifetime(state.license)))} style={styles.flex} />
        </View>
        <Button
          title="Révoquer (bloquer l’application)"
          icon="lock-closed"
          variant="danger"
          onPress={() =>
            confirm('Révoquer la licence ?', 'L’application sera bloquée immédiatement sur tous les appareils du restaurant.', () => dispatch(setLicense(revoke(state.license))), 'Révoquer')
          }
        />
      </Card>

      <SectionTitle>Mode démo (24 h)</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>
          {status.demo
            ? 'Démo en cours sur cette licence.'
            : status.demoUsed
              ? 'La démo a déjà été utilisée sur cette licence.'
              : 'La démo n’a pas encore été utilisée.'}
        </Text>
        <View style={styles.buttons}>
          <Button
            title="Réinitialiser la démo"
            icon="refresh"
            variant="secondary"
            disabled={!status.demoUsed}
            onPress={() => dispatch(setLicense({ ...state.license, demoStartedAt: null }))}
            style={styles.flex}
          />
          <Button
            title="Arrêter la démo"
            icon="stop-circle-outline"
            variant="secondary"
            disabled={!status.demo}
            onPress={() => dispatch(setLicense({ ...state.license, demoStartedAt: 0 }))}
            style={styles.flex}
          />
        </View>
      </Card>

      <SectionTitle>Coordonnées bancaires (paiement)</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>Affichées à vos clients quand ils appuient sur « Payer ».</Text>
        <Field label="Bénéficiaire" value={holder} onChangeText={setHolder} />
        <Field label="IBAN" value={iban} onChangeText={setIban} autoCapitalize="characters" />
        <Button
          title="Enregistrer"
          icon="checkmark"
          onPress={() => {
            const clean = iban.replace(/\s/g, '').toUpperCase();
            if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(clean)) return notify('IBAN invalide', 'Vérifiez le numéro de compte.');
            if (!holder.trim()) return notify('Nom manquant', 'Indiquez le nom du bénéficiaire.');
            dispatch(setBilling({ iban: clean, holder: holder.trim() }));
            notify('Coordonnées bancaires', 'Enregistrées.');
          }}
        />
      </Card>

      <SectionTitle>Accès du gérant</SectionTitle>
      <Card style={styles.card}>
        <SwitchRow
          label="Accès à la Gestion"
          hint="Désactivé : seul le code administrateur ouvre la Gestion."
          value={state.security.managerCanManage}
          onChange={(v) => dispatch(setSecurity({ managerCanManage: v }))}
        />
        <SwitchRow
          label="Création du lobby"
          hint="Autoriser le gérant à créer le lobby de son équipe."
          value={state.security.managerCanCreateLobby}
          onChange={(v) => dispatch(setSecurity({ managerCanCreateLobby: v }))}
        />
        <Button
          title="Réinitialiser le code gérant"
          icon="refresh"
          variant="secondary"
          onPress={() =>
            confirm('Réinitialiser le code gérant ?', 'Le prochain accès à la Gestion demandera de créer un nouveau code.', () => {
              dispatch(setManagerPin(null));
              notify('Code gérant', 'Code supprimé. Un nouveau code sera demandé à la prochaine ouverture de la Gestion.');
            }, 'Réinitialiser')
          }
        />
      </Card>

      <SectionTitle>Codes d’activation pour vos clients</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>
          Après réception d’un paiement, générez un code pour la licence du client (identifiant affiché dans son écran
          Abonnement) et envoyez-le lui.
        </Text>
        <Field label="Identifiant de licence du client" value={clientId} onChangeText={setClientId} autoCapitalize="characters" placeholder="ABCD-1234" />
        <Text style={styles.label}>Mois payé</Text>
        <View style={styles.chips}>
          {monthOptions(Date.now()).map((m) => (
            <Chip key={m.key} label={m.label} selected={month === m.key} color={colors.goldDeep} onPress={() => setMonth(m.key)} />
          ))}
        </View>
        <View style={styles.buttons}>
          <Button title="Code mensuel" icon="calendar" variant="secondary" onPress={() => generate('mensuel')} style={styles.flex} />
          <Button title="Code à vie" icon="diamond" onPress={() => generate('vie')} style={styles.flex} />
        </View>
        {generated ? (
          <View style={styles.generated}>
            <Text style={styles.generatedCode} selectable>
              {generated}
            </Text>
            <Button title="Partager" icon="share-social" small variant="dark" onPress={() => Share.share({ message: `Votre code d’activation Caisse Resto : ${generated}` }).catch(() => {})} />
          </View>
        ) : null}
      </Card>

      <SectionTitle>Liens de paiement</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>Liens ouverts par les boutons « Payer » (par exemple des liens de paiement Stripe).</Text>
        <Field label="Mensuel (45,99 €)" value={linkMonthly} onChangeText={setLinkMonthly} autoCapitalize="none" placeholder="https://buy.stripe.com/…" />
        <Field label="À vie (599,99 €)" value={linkLifetime} onChangeText={setLinkLifetime} autoCapitalize="none" placeholder="https://buy.stripe.com/…" />
        <Button
          title="Enregistrer les liens"
          icon="checkmark"
          onPress={() => {
            dispatch(setPaymentLinks({ mensuel: linkMonthly.trim(), vie: linkLifetime.trim() }));
            notify('Liens de paiement', 'Enregistrés.');
          }}
        />
      </Card>

      {device.lobby ? (
        <>
          <SectionTitle>Lobby</SectionTitle>
          <Button
            title={`Fermer le lobby ${device.lobby.code}`}
            icon="close-circle"
            variant="danger"
            onPress={() =>
              confirm('Fermer le lobby ?', 'Toute l’équipe sera déconnectée.', () => {
                closeLobby().catch((e: unknown) => notify('Erreur', e instanceof Error ? e.message : 'Erreur'));
              }, 'Fermer')
            }
          />
        </>
      ) : null}

      <Notice tone="info" title="Important">
        Ces contrôles sont appliqués par l’application sur les appareils. Pour une protection forte des paiements
        (activation automatique, impossible à contourner), il faut un serveur de licences.
      </Notice>

      <Button title="Quitter le mode administrateur" variant="ghost" icon="log-out-outline" onPress={() => setSession({ admin: false })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center', gap: 4 },
  flex: { flex: 1 },
  hero: { backgroundColor: '#2A0F0D', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.danger },
  heroLabel: { color: '#F2A39B', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 28, marginTop: 4 },
  heroSub: { color: colors.onDarkMuted, marginTop: 6 },
  card: { gap: 12 },
  buttons: { flexDirection: 'row', gap: 10 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  label: { fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  generated: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.goldSoft,
    borderRadius: 14,
    padding: 14,
  },
  generatedCode: { flex: 1, fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 22, color: colors.ink, letterSpacing: 1 },
});
