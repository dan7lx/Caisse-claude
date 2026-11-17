import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { modeLabel, useBluetoothPrinter } from '../print';
import { canPrintSilently, printerOf } from '../print/settings';
import { usePrintStatus } from '../print/status';
import { useStore } from '../store/StoreProvider';
import { colors } from '../theme';

/** Bandeau de l'imprimante sur l'écran Cuisine / Bar : état, dernier bon imprimé, accès aux réglages. */
export function PrinterBar() {
  const { device } = useStore();
  const router = useRouter();
  const bt = useBluetoothPrinter();
  const status = usePrintStatus();
  const printer = printerOf(device);
  const ready = printer.mode === 'bluetooth' ? !!bt : printer.mode === 'reseau' ? !!printer.host : printer.mode === 'systeme';
  const auto = ready && printer.autoKitchen && canPrintSilently(printer);
  const color = printer.mode === 'aucune' ? colors.muted : ready ? colors.free : colors.danger;
  const title =
    printer.mode === 'aucune'
      ? 'Connecter une imprimante'
      : printer.mode === 'bluetooth' && !bt
        ? 'Imprimante Bluetooth déconnectée'
        : `${printer.mode === 'bluetooth' ? bt : modeLabel[printer.mode]}${auto ? ' · bons imprimés automatiquement' : ''}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Imprimante : ${title}`}
      onPress={() => router.push('/imprimante')}
      style={({ pressed }) => [styles.bar, { borderColor: color }, pressed && styles.pressed]}
    >
      <Ionicons name="print" size={20} color={color} />
      <View style={styles.flex}>
        <Text style={[styles.title, { color: printer.mode === 'aucune' ? colors.text : color }]} numberOfLines={1}>
          {title}
        </Text>
        {status ? (
          <Text style={[styles.sub, !status.ok && { color: colors.danger }]} numberOfLines={2}>
            {status.ok ? '✓ ' : '⚠ '}
            {status.message}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  pressed: { opacity: 0.8 },
  flex: { flex: 1 },
  title: { fontWeight: '800', fontSize: 14 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
