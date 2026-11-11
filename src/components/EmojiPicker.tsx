import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { haptic } from '../utils/haptics';
import { Emoji3D, FOOD_EMOJIS } from './Emoji3D';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  /** Emoji hérité (catégorie) proposé en premier, représenté par « Auto ». */
  inherited?: string;
}

/** Sélecteur d'emoji 3D (défilement horizontal sur deux lignes). */
export function EmojiPicker({ value, onChange, inherited }: Props) {
  const rows = [FOOD_EMOJIS.filter((_, i) => i % 2 === 0), FOOD_EMOJIS.filter((_, i) => i % 2 === 1)];
  return (
    <View style={styles.wrap}>
      <View style={styles.current}>
        <Emoji3D emoji={value || inherited || '🍽️'} size={64} />
        {inherited !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === '' }}
            onPress={() => {
              haptic.tap();
              onChange('');
            }}
            style={[styles.auto, value === '' && styles.autoActive]}
          >
            <Text style={[styles.autoText, value === '' && styles.autoTextActive]}>Comme la catégorie</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.rows}>
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((e) => (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={`Emoji ${e}`}
                  accessibilityState={{ selected: value === e }}
                  onPress={() => {
                    haptic.tap();
                    onChange(e);
                  }}
                  style={[styles.cell, value === e && styles.cellActive]}
                >
                  <Emoji3D emoji={e} size={34} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  current: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  auto: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  autoActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  autoText: { fontWeight: '700', color: colors.text, fontSize: 13 },
  autoTextActive: { color: colors.onDark },
  scroll: { paddingVertical: 2 },
  rows: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cellActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
});
