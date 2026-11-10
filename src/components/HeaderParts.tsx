import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../store/StoreProvider';
import { colors, fonts } from '../theme';

export function HeaderTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Pastille « Équipe » : état de la synchronisation du lobby, ouvre l'écran Équipe. */
export function TeamButton() {
  const { device, sync, pendingCount } = useStore();
  const router = useRouter();
  const lobby = device.lobby;
  const dot =
    !lobby ? colors.onDarkMuted : sync.status === 'ok' ? '#4CC38A' : sync.status === 'ferme' ? '#E8857C' : colors.ready;
  const label = lobby ? lobby.code : 'Équipe';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lobby ? `Lobby ${lobby.code}, ${sync.status === 'ok' ? 'synchronisé' : 'non synchronisé'}` : 'Équipe'}
      onPress={() => router.push('/equipe')}
      style={({ pressed }) => [styles.team, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="people" size={16} color={colors.gold} />
      <Text style={styles.teamText}>{label}</Text>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      {pendingCount > 0 && sync.status !== 'ok' ? <Text style={styles.pending}>{pendingCount}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 21, color: colors.onDark },
  subtitle: { fontSize: 11, color: colors.gold, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  team: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.ink3,
    backgroundColor: colors.ink2,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 12,
  },
  teamText: { color: colors.onDark, fontWeight: '800', letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pending: { color: colors.ready, fontWeight: '800', fontSize: 12 },
});
