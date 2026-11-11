import { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { PrintDoc } from '../print/doc';
import { charsPerLine, cleanText, formatRow, wrap } from '../print/escpos';
import { printDoc, useBluetoothPrinter } from '../print';
import { useStore } from '../store/StoreProvider';
import { colors } from '../theme';
import { haptic } from '../utils/haptics';
import { useToast } from './Toast';
import { Button, FormModal, notify } from './ui';

const MONO = Platform.select({ ios: 'Courier', android: 'monospace', default: '"Courier New", Courier, monospace' });

/** Ticket rendu comme sur le papier (même mise en page que l'impression thermique). */
export function PaperTicket({ doc, paperWidth }: { doc: PrintDoc; paperWidth: 58 | 80 }) {
  const width = charsPerLine(paperWidth);
  const rows: { text: string; bold?: boolean; big?: boolean; center?: boolean }[] = [];
  for (const l of doc.lines) {
    if (l.k === 'title') wrap(cleanText(l.text, false), Math.floor(width / 2)).forEach((t) => rows.push({ text: t, bold: true, big: true, center: true }));
    else if (l.k === 'center') wrap(cleanText(l.text, false), width).forEach((t) => rows.push({ text: t, bold: l.bold, center: true }));
    else if (l.k === 'text') wrap(cleanText(l.text, false), width).forEach((t) => rows.push({ text: t, bold: l.bold, big: l.big }));
    else if (l.k === 'row') formatRow(cleanText(l.left, false), cleanText(l.right, false), width).forEach((t) => rows.push({ text: t, bold: l.bold }));
    else if (l.k === 'sep') rows.push({ text: '-'.repeat(width) });
    else rows.push({ text: ' ' });
  }
  return (
    <View style={[styles.paper, { maxWidth: paperWidth === 80 ? 420 : 300 }]} accessibilityLabel={doc.title}>
      {doc.logo ? <Image source={{ uri: doc.logo }} style={styles.logo} accessibilityLabel="Logo" /> : null}
      {rows.map((r, i) => (
        <Text
          key={i}
          style={[styles.line, r.bold && styles.bold, r.big && styles.big, r.center && styles.center]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {r.text}
        </Text>
      ))}
      <View style={styles.tear} />
    </View>
  );
}

interface Props {
  doc: PrintDoc | null;
  onClose: () => void;
  /** Texte du bouton de fermeture (ex. « Terminer »). */
  closeLabel?: string;
}

/** Fenêtre d'aperçu avec le bouton « Imprimer » (Bluetooth si connecté, sinon impression du téléphone). */
export function PrintPreview({ doc, onClose, closeLabel = 'Fermer' }: Props) {
  const { device } = useStore();
  const toast = useToast();
  const btName = useBluetoothPrinter();
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const print = async () => {
    setBusy(true);
    try {
      const route = await printDoc(doc, device.printer);
      haptic.success();
      toast(route === 'bluetooth' ? `Envoyé à ${btName ?? 'l’imprimante'}` : 'Impression lancée', '🧾');
    } catch (e) {
      notify('Impression', e instanceof Error ? e.message : 'Impression impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal visible title={doc.title} onClose={onClose}>
      <ScrollView horizontal={false} style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        <PaperTicket doc={doc} paperWidth={device.printer.paperWidth} />
      </ScrollView>
      <Text style={styles.route}>
        {btName ? `🖨️ Imprimante Bluetooth : ${btName}` : '🖨️ Impression via le téléphone (AirPrint / Android). Imprimante Bluetooth : Gestion › Imprimante.'}
      </Text>
      <Button title={busy ? 'Impression…' : 'Imprimer'} icon="print" large onPress={print} disabled={busy} />
      <Button title={closeLabel} variant="secondary" onPress={onClose} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 420 },
  scrollBody: { alignItems: 'center', paddingVertical: 6 },
  paper: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  logo: { width: 56, height: 56, alignSelf: 'center', marginBottom: 6, borderRadius: 8 },
  line: { fontFamily: MONO, fontSize: 12, color: '#111', lineHeight: 16 },
  bold: { fontWeight: '700' },
  big: { fontSize: 15, lineHeight: 20 },
  center: { textAlign: 'center' },
  tear: { height: 6, marginTop: 8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  route: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
