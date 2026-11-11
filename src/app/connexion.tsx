import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePinLock } from '../components/ManagerGate';
import { useToast } from '../components/Toast';
import { Button, PinPad } from '../components/ui';
import { identifyStaff } from '../license/access';
import { useStore } from '../store/StoreProvider';
import { colors, roleEmoji, roleLabel } from '../theme';

/**
 * Connexion employé : chaque membre de l'équipe tape son code personnel
 * et arrive directement sur son poste (Salle, Cuisine ou Bar).
 */
export default function StaffLoginScreen() {
  const { state, device, updateDevice, recordPinAttempt } = useStore();
  const router = useRouter();
  const toast = useToast();
  const lockedMessage = usePinLock();
  const withCode = state.staff.filter((m) => m.pinHash);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Connexion employé' }} />
      <PinPad
        emoji="🔑"
        title="Mon code personnel"
        subtitle={`Actuellement : ${device.currentServer} · ${roleLabel[device.role]}`}
        maxLength={6}
        lockedMessage={lockedMessage}
        onSubmit={(code) => {
          const member = identifyStaff(state, code);
          if (!member) {
            recordPinAttempt(false);
            return 'Code inconnu.';
          }
          recordPinAttempt(true);
          updateDevice({ currentServer: member.name, role: member.role });
          toast(`Bonjour ${member.name} · poste ${roleLabel[member.role]}`, roleEmoji[member.role]);
          // Chacun arrive sur son poste de travail.
          router.replace(member.role === 'serveur' ? '/' : '/cuisine');
          return null;
        }}
      />
      {withCode.length === 0 ? (
        <Text style={styles.note}>
          Aucun employé n’a encore de code personnel. Le gérant les crée dans Gestion › Équipe & postes.
        </Text>
      ) : (
        <Text style={styles.note}>{withCode.length} employé(s) avec un code personnel.</Text>
      )}
      <View style={styles.back}>
        <Button title="Retour" variant="ghost" icon="arrow-back" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { alignItems: 'center', padding: 20, paddingBottom: 48, gap: 8 },
  note: { color: colors.onDarkMuted, textAlign: 'center', maxWidth: 320 },
  back: { marginTop: 8 },
});
