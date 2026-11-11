import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../store/StoreProvider';
import { colors, fonts, roleEmoji, roleLabel } from '../theme';
import { useLayout } from '../utils/layout';
import { Emoji3D } from './Emoji3D';
import { TeamButton } from './HeaderParts';

interface Props {
  title: string;
  subtitle?: string;
  logo?: string | null;
  /** Contenu supplémentaire sous le titre (ex. sélecteur). */
  children?: React.ReactNode;
}

/**
 * En-tête de page qui défile avec le contenu (au lieu de rester figé en haut de l'écran).
 * À placer en premier élément d'un ScrollView / FlatList dont le contenu a 16 px de marge.
 */
export function ScreenHeader({ title, subtitle, logo, children }: Props) {
  const insets = useSafeAreaInsets();
  const { small } = useLayout();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        {logo ? <Image source={{ uri: logo }} style={styles.logo} accessibilityLabel="Logo" /> : null}
        <View style={styles.flex}>
          <Text style={[styles.title, small && styles.titleSmall]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <TeamButton />
      </View>
      <ProfileChip />
      {children}
    </View>
  );
}

/** « 🙋 Julie · Salle » : qui utilise l'appareil ; touchez pour changer d'employé avec son code. */
function ProfileChip() {
  const { device } = useStore();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${device.currentServer}, poste ${roleLabel[device.role]}. Changer d’employé`}
      onPress={() => router.push('/connexion')}
      style={({ pressed }) => [styles.profile, pressed && { opacity: 0.7 }]}
    >
      <Emoji3D emoji={roleEmoji[device.role]} size={20} />
      <Text style={styles.profileText} numberOfLines={1}>
        {device.currentServer} · {roleLabel[device.role]}
      </Text>
      <Text style={styles.profileSwitch}>Changer</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.ink,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  logo: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.gold },
  title: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 26, color: colors.onDark },
  titleSmall: { fontSize: 21 },
  subtitle: { fontSize: 11, color: colors.gold, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink3,
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 12,
    maxWidth: '100%',
  },
  profileText: { color: colors.onDark, fontWeight: '700', flexShrink: 1 },
  profileSwitch: { color: colors.gold, fontWeight: '800', fontSize: 12 },
});
