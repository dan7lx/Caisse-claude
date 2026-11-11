import { type ComponentRef, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  dark?: boolean;
  autoFocus?: boolean;
}

/** Saisie d'un code en cases (ex. code du lobby à 6 caractères). */
export function CodeBoxes({ value, onChange, length = 6, dark, autoFocus }: Props) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable accessibilityRole="none" onPress={() => input.current?.focus()} style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const ch = value[i] ?? '';
          const active = i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.box,
                dark ? styles.boxDark : styles.boxLight,
                ch ? styles.boxFilled : null,
                active ? styles.boxActive : null,
              ]}
            >
              <Text style={[styles.char, { color: dark ? colors.gold : colors.ink }]}>{ch}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus={autoFocus}
        maxLength={length + 4}
        accessibilityLabel="Code du lobby"
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.82,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDark: { backgroundColor: colors.ink, borderColor: colors.ink3 },
  boxLight: { backgroundColor: '#FFFFFF', borderColor: colors.border },
  boxFilled: { borderColor: colors.goldDeep },
  boxActive: { borderColor: colors.gold, borderWidth: 2 },
  char: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 26 },
  // Champ réel invisible mais focalisable (clavier natif, collage, remplissage automatique).
  hidden: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
