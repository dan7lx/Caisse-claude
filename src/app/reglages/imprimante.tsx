import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { PrintPreview } from '../../components/PrintPreview';
import { useToast } from '../../components/Toast';
import { Button, Card, Chip, Notice, notify, SectionTitle, SwitchRow } from '../../components/ui';
import { useBluetoothPrinter } from '../../print';
import { bluetoothSupported, connectBluetoothPrinter, disconnectBluetoothPrinter } from '../../print/bluetooth';
import { type PrintDoc, testDoc } from '../../print/doc';
import { useStore } from '../../store/StoreProvider';
import type { PrinterSettings } from '../../store/types';
import { colors, fonts } from '../../theme';

function PrinterScreen() {
  const { state, device, updateDevice } = useStore();
  const toast = useToast();
  const btName = useBluetoothPrinter();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PrintDoc | null>(null);
  const printer = device.printer;
  const set = (patch: Partial<PrinterSettings>) => updateDevice({ printer: { ...printer, ...patch } });
  const supported = bluetoothSupported();
  const isIos = Platform.OS === 'ios' || (Platform.OS === 'web' && /iPhone|iPad|iPod/.test((globalThis as { navigator?: { userAgent: string } }).navigator?.userAgent ?? ''));

  const connect = async () => {
    setBusy(true);
    try {
      const name = await connectBluetoothPrinter();
      toast(`Imprimante connectée : ${name}`, '🖨️');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connexion impossible.';
      if (!/cancel|annul/i.test(msg)) notify('Imprimante Bluetooth', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Imprimante' }} />

      <View style={styles.hero}>
        <Emoji3D emoji="🧾" size={56} />
        <View style={styles.flex}>
          <Text style={styles.heroTitle}>{btName ?? 'Aucune imprimante Bluetooth'}</Text>
          <Text style={styles.heroSub}>
            {btName ? 'Connectée : les tickets partent directement sur l’imprimante.' : 'Les tickets s’impriment via la fenêtre d’impression du téléphone.'}
          </Text>
        </View>
      </View>

      <SectionTitle>Imprimante Bluetooth</SectionTitle>
      <Card style={styles.card}>
        {supported ? (
          <>
            <Text style={styles.text}>
              Allumez l’imprimante thermique, activez le Bluetooth, puis touchez « Connecter » et choisissez-la dans la liste.
            </Text>
            {btName ? (
              <Button title="Déconnecter" icon="close-circle-outline" variant="secondary" onPress={disconnectBluetoothPrinter} />
            ) : (
              <Button title={busy ? 'Recherche…' : 'Connecter une imprimante'} icon="bluetooth" large onPress={connect} disabled={busy} />
            )}
            <Text style={styles.hint}>À refaire à chaque ouverture de l’application (sécurité du navigateur).</Text>
          </>
        ) : (
          <Notice tone="warning" title={isIos ? 'Bluetooth direct indisponible sur iPhone' : 'Bluetooth indisponible ici'}>
            {isIos
              ? 'Safari ne permet pas aux sites de se connecter à une imprimante Bluetooth. Sur iPhone, utilisez une imprimante compatible AirPrint (ou l’application de votre imprimante) : le bouton « Imprimer » ouvre la fenêtre d’impression d’iOS. Pour le Bluetooth direct, utilisez une tablette ou un téléphone Android avec Chrome.'
              : 'Ouvrez l’application dans Google Chrome (Android, Windows, Mac) pour connecter une imprimante Bluetooth. Sinon, « Imprimer » utilise l’impression du système.'}
          </Notice>
        )}
        <Text style={styles.hint}>
          Compatibles : imprimantes thermiques Bluetooth BLE au format ESC/POS (58 ou 80 mm), les modèles de caisse les plus
          répandus.
        </Text>
      </Card>

      <SectionTitle>Format</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Largeur du papier</Text>
        <View style={styles.chips}>
          <Chip label="58 mm (petit)" selected={printer.paperWidth === 58} color={colors.goldDeep} onPress={() => set({ paperWidth: 58 })} />
          <Chip label="80 mm (standard)" selected={printer.paperWidth === 80} color={colors.goldDeep} onPress={() => set({ paperWidth: 80 })} />
        </View>
        <SwitchRow
          label="Imprimer sans accents"
          hint="Si l’imprimante affiche des caractères bizarres à la place de é, è, €…"
          value={printer.asciiOnly}
          onChange={(asciiOnly) => set({ asciiOnly })}
        />
      </Card>

      <SectionTitle>Automatismes (cet appareil)</SectionTitle>
      <Card style={styles.card}>
        <SwitchRow
          label="Ticket de caisse après chaque encaissement"
          value={printer.autoPrintReceipt}
          onChange={(autoPrintReceipt) => set({ autoPrintReceipt })}
        />
        <SwitchRow
          label="Bons cuisine / bar à leur arrivée"
          hint="Sur l’appareil de la cuisine ou du bar, avec l’imprimante Bluetooth connectée."
          value={printer.autoPrintKitchen}
          onChange={(autoPrintKitchen) => set({ autoPrintKitchen })}
        />
      </Card>

      <Button title="Impression test" icon="print" large onPress={() => setPreview(testDoc(state, printer.paperWidth))} style={styles.test} />
      <PrintPreview doc={preview} onClose={() => setPreview(null)} />
    </ScrollView>
  );
}

export default function PrinterRoute() {
  return (
    <ManagerGate>
      <PrinterScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center' },
  flex: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 21 },
  heroSub: { color: colors.onDarkMuted, fontSize: 13, marginTop: 4 },
  card: { gap: 12 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  label: { fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  test: { marginTop: 20 },
});
