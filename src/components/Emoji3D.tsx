import { memo } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { EMOJI_3D } from './emojiAssets';

interface Props {
  /** L'emoji (ex. « 🍔 »). */
  emoji: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Retire les sélecteurs de variante (U+FE0F) pour retrouver l'image même si l'emoji a été saisi autrement. */
const strip = (e: string) => e.replace(/️/g, '');
const LOOKUP: Record<string, (typeof EMOJI_3D)[string]> = Object.fromEntries(
  Object.entries(EMOJI_3D).map(([k, v]) => [strip(k), v]),
);

export const hasEmoji3D = (emoji: string) => strip(emoji) in LOOKUP;

/** Emoji en 3D (Fluent Emoji). Si l'emoji n'est pas dans la collection, l'emoji du système est affiché. */
export const Emoji3D = memo(function Emoji3D({ emoji, size = 32, style }: Props) {
  const source = LOOKUP[strip(emoji)];
  if (source) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, style as object]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size }, style]}>
      <Text style={{ fontSize: size * 0.8, lineHeight: size }} accessible={false}>
        {emoji}
      </Text>
    </View>
  );
});

/** Emojis proposés dans les sélecteurs (catégories et articles). */
export const FOOD_EMOJIS = [
  '🥗', '🍲', '🥚', '🧀', '🥖', '🥐', '🍳', '🍄', '🥑', '🍅', '🥕', '🌶️',
  '🍔', '🍕', '🍝', '🥩', '🍗', '🐟', '🦐', '🦞', '🦪', '🍣', '🍜', '🥘',
  '🍛', '🌮', '🥙', '🥪', '🌭', '🍟', '🥟', '🍱', '🍽️', '🍴',
  '🍰', '🎂', '🍦', '🍨', '🍩', '🍫', '🍮', '🥧', '🍪', '🧁', '🍓',
  '🥤', '🧃', '💧', '🍋', '🍊', '🥛', '☕', '🍵', '🧋', '🍷', '🥂', '🍾', '🍺', '🍻', '🍸', '🍹',
];

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
