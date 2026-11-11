import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TicketDoc } from '../ticket/doc';
import { cleanText, formatRow, TICKET_WIDTH, wrap } from '../ticket/layout';
import { colors } from '../theme';
import { Button, FormModal } from './ui';

const MONO = Platform.select({ ios: 'Courier', android: 'monospace', default: '"Courier New", Courier, monospace' });

/** Ticket rendu comme sur le papier (police à chasse fixe, colonnes alignées). */
export function PaperTicket({ doc }: { doc: TicketDoc }) {
  const width = TICKET_WIDTH;
  const rows: { text: string; bold?: boolean; big?: boolean; center?: boolean }[] = [];
  for (const l of doc.lines) {
    if (l.k === 'title') wrap(cleanText(l.text), Math.floor(width / 2)).forEach((t) => rows.push({ text: t, bold: true, big: true, center: true }));
    else if (l.k === 'center') wrap(cleanText(l.text), width).forEach((t) => rows.push({ text: t, bold: l.bold, center: true }));
    else if (l.k === 'text') wrap(cleanText(l.text), width).forEach((t) => rows.push({ text: t, bold: l.bold, big: l.big }));
    else if (l.k === 'row') formatRow(cleanText(l.left), cleanText(l.right), width).forEach((t) => rows.push({ text: t, bold: l.bold }));
    else if (l.k === 'sep') rows.push({ text: '-'.repeat(width) });
    else rows.push({ text: ' ' });
  }
  return (
    <View style={styles.paper} accessibilityLabel={doc.title}>
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
  doc: TicketDoc | null;
  onClose: () => void;
  /** Texte du bouton de fermeture (ex. « Terminer »). */
  closeLabel?: string;
}

/** Fenêtre qui affiche un ticket (ticket de caisse, clôture Z). */
export function TicketPreview({ doc, onClose, closeLabel = 'Fermer' }: Props) {
  if (!doc) return null;
  return (
    <FormModal visible title={doc.title} onClose={onClose}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody}>
        <PaperTicket doc={doc} />
      </ScrollView>
      <Button title={closeLabel} large onPress={onClose} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  scrollBody: { alignItems: 'center', paddingVertical: 6 },
  paper: {
    width: '100%',
    maxWidth: 300,
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
  // Sur le web, les espaces d'alignement des colonnes doivent être conservés.
  line: { fontFamily: MONO, fontSize: 12, color: '#111', lineHeight: 16, ...(Platform.OS === 'web' ? ({ whiteSpace: 'pre' } as object) : null) },
  bold: { fontWeight: '700' },
  big: { fontSize: 15, lineHeight: 20 },
  center: { textAlign: 'center' },
  tear: { height: 6, marginTop: 8, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
});
