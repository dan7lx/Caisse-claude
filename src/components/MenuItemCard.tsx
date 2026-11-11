import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MenuItem } from '../store/types';
import { colors, fonts, shadow } from '../theme';
import { formatPrice } from '../utils/format';
import { Emoji3D } from './Emoji3D';

interface Props {
  item: MenuItem;
  emoji: string;
  color: string;
  qty: number;
  currency: string;
  width: `${number}%`;
  disabled: boolean;
  compact: boolean;
  onAdd: (item: MenuItem) => void;
  onRemove: (item: MenuItem) => void;
}

/** Carte d'un plat sur l'écran de commande (mémorisée : seule la carte modifiée est redessinée). */
export const MenuItemCard = memo(function MenuItemCard({
  item,
  emoji,
  color,
  qty,
  currency,
  width,
  disabled,
  compact,
  onAdd,
  onRemove,
}: Props) {
  return (
    <View style={[styles.wrap, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ajouter ${item.name}, ${formatPrice(item.price, currency)}`}
        disabled={disabled}
        onPress={() => onAdd(item)}
        android_ripple={{ color: colors.goldSoft }}
        style={({ pressed }) => [
          styles.item,
          compact && styles.itemCompact,
          qty > 0 && styles.selected,
          !item.available && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.bar, { backgroundColor: color }]} />
        <View style={styles.body}>
          <View style={styles.top}>
            <Emoji3D emoji={emoji} size={compact ? 34 : 42} />
            {item.choices.length ? <Ionicons name="options-outline" size={16} color={colors.muted} /> : null}
          </View>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.price, compact && styles.priceCompact, qty > 0 && styles.priceWithMinus]} numberOfLines={1} adjustsFontSizeToFit>
            {item.available ? formatPrice(item.price, currency) : 'Épuisé'}
          </Text>
        </View>
        {qty > 0 ? (
          <View style={styles.qty}>
            <Text style={styles.qtyText}>{qty}</Text>
          </View>
        ) : null}
      </Pressable>
      {qty > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer un ${item.name}`}
          onPress={() => onRemove(item)}
          hitSlop={8}
          style={({ pressed }) => [styles.minus, pressed && { transform: [{ scale: 0.9 }] }]}
        >
          <Ionicons name="remove" size={20} color={colors.onDark} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { padding: 6 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 132,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow,
  },
  itemCompact: { minHeight: 118, borderRadius: 16 },
  selected: { borderColor: colors.gold, backgroundColor: '#FFF9EA' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  bar: { width: 5 },
  body: { flex: 1, padding: 10, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 19 },
  nameCompact: { fontSize: 14, lineHeight: 18 },
  price: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 17, color: colors.goldDeep, marginTop: 'auto' },
  priceCompact: { fontSize: 15 },
  // Laisse la place au bouton « − » en bas à droite.
  priceWithMinus: { marginRight: 40 },
  qty: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  qtyText: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  minus: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
