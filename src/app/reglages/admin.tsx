import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ManagerGate } from '../../components/ManagerGate';
import { Button, Card, confirm, Notice, notify, SectionTitle, SwitchRow } from '../../components/ui';
import { setManagerPin, setSecurity } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors, fonts } from '../../theme';

export default function AdminRoute() {
  return (
    <ManagerGate adminOnly>
      <AdminScreen />
    </ManagerGate>
  );
}

/**
 * Administration locale (code administrateur) : droits du gérant de CE restaurant et lobby.
 * Les paiements, les clés et les licences se gèrent uniquement dans l'Espace créateur (mot de passe serveur).
 */
function AdminScreen() {
  const { state, device, dispatch, setSession, closeLobby } = useStore();
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Administration' }} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>ADMINISTRATION DU RESTAURANT</Text>
        <Text style={styles.heroTitle}>Accès & équipe</Text>
        <Text style={styles.heroSub}>Licence {state.license.id}</Text>
      </View>

      <SectionTitle>Paiements, clés et licences</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.text}>
          Les paiements de vos clients, les clés d’activation et les licences se gèrent dans l’Espace créateur, protégé par
          votre mot de passe.
        </Text>
        <Button title="Ouvrir l’Espace créateur" icon="shield-checkmark" onPress={() => router.push('/createur')} />
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
            confirm(
              'Réinitialiser le code gérant ?',
              'Le prochain accès à la Gestion demandera de créer un nouveau code.',
              () => {
                dispatch(setManagerPin(null));
                notify('Code gérant', 'Code supprimé. Un nouveau code sera demandé à la prochaine ouverture de la Gestion.');
              },
              'Réinitialiser',
            )
          }
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
              confirm(
                'Fermer le lobby ?',
                'Toute l’équipe sera déconnectée.',
                () => {
                  closeLobby().catch((e: unknown) => notify('Erreur', e instanceof Error ? e.message : 'Erreur'));
                },
                'Fermer',
              )
            }
          />
        </>
      ) : null}

      <Notice tone="info" title="Licences">
        Une licence ne peut plus être activée depuis cet écran : seules les clés générées dans l’Espace créateur, après
        confirmation d’un virement, activent un abonnement.
      </Notice>

      <Button title="Quitter le mode administrateur" variant="ghost" icon="log-out-outline" onPress={() => setSession({ admin: false })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center', gap: 4 },
  hero: { backgroundColor: '#2A0F0D', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: colors.danger },
  heroLabel: { color: '#F2A39B', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 28, marginTop: 4 },
  heroSub: { color: colors.onDarkMuted, marginTop: 6 },
  card: { gap: 12 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
