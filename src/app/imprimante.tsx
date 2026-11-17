import { Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Emoji3D } from '../components/Emoji3D';
import { useToast } from '../components/Toast';
import { Button, Card, Chip, Field, Notice, notify, SectionTitle, SwitchRow } from '../components/ui';
import { modeLabel, printDoc, useBluetoothPrinter } from '../print';
import { bluetoothSupported, connectBluetoothPrinter, disconnectBluetoothPrinter } from '../print/bluetooth';
import { eposUrl } from '../print/epos';
import { printerOf } from '../print/settings';
import { setPrintStatus, usePrintStatus } from '../print/status';
import { useStore } from '../store/StoreProvider';
import type { PrinterMode, PrinterSettings } from '../store/types';
import { testDoc } from '../ticket/kitchen';
import { colors, fonts, screenBg } from '../theme';
import { formatTime } from '../utils/format';

const isIos = () =>
  Platform.OS === 'ios' ||
  (Platform.OS === 'web' && /iPhone|iPad|iPod/.test((globalThis as { navigator?: { userAgent: string } }).navigator?.userAgent ?? ''));

const MODES: { mode: PrinterMode; label: string; emoji: string }[] = [
  { mode: 'bluetooth', label: 'Bluetooth', emoji: '🔵' },
  { mode: 'reseau', label: 'Wi-Fi (Epson)', emoji: '📶' },
  { mode: 'systeme', label: 'AirPrint / système', emoji: '🖨️' },
  { mode: 'aucune', label: 'Aucune', emoji: '⛔' },
];

/** Imprimante de cet appareil : accessible à tous les postes (le cuisinier n'a pas le code gérant). */
export default function PrinterScreen() {
  const { state, device, updateDevice } = useStore();
  const toast = useToast();
  const btName = useBluetoothPrinter();
  const status = usePrintStatus();
  const printer = printerOf(device);
  const [host, setHost] = useState(printer.host);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<PrinterSettings>) => updateDevice({ printer: { ...printer, ...patch } });
  const kitchenRole = device.role !== 'serveur';

  const chooseMode = (mode: PrinterMode) => {
    // Premier choix d'une imprimante sur un poste cuisine / bar : impression automatique des bons.
    const first = printer.mode === 'aucune' && mode !== 'aucune';
    set({ mode, ...(first ? { autoKitchen: kitchenRole } : null) });
  };

  const connect = async () => {
    setBusy(true);
    try {
      const name = await connectBluetoothPrinter();
      set({ mode: 'bluetooth', bluetoothName: name });
      toast(`Imprimante connectée : ${name}`, '🖨️');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connexion impossible.';
      if (!/cancel|annul/i.test(msg)) notify('Imprimante Bluetooth', msg);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const current = { ...printer, host: host.trim() };
    if (current.mode === 'reseau') set({ host: current.host });
    setBusy(true);
    try {
      await printDoc(testDoc(state, current.paperWidth, modeLabel[current.mode], Date.now()), current);
      const message =
        current.mode === 'reseau'
          ? 'L’imprimante a confirmé l’impression.'
          : current.mode === 'bluetooth'
            ? 'Ticket envoyé à l’imprimante Bluetooth.'
            : 'Fenêtre d’impression ouverte.';
      setPrintStatus({ ok: true, message, at: Date.now() });
    } catch (e) {
      setPrintStatus({ ok: false, message: e instanceof Error ? e.message : 'Impression impossible.', at: Date.now() });
    } finally {
      setBusy(false);
    }
  };

  const connected =
    printer.mode === 'bluetooth' ? !!btName : printer.mode === 'reseau' ? !!printer.host : printer.mode === 'systeme';
  const headline =
    printer.mode === 'bluetooth'
      ? (btName ?? 'Imprimante Bluetooth non connectée')
      : printer.mode === 'reseau'
        ? printer.host
          ? `Imprimante Wi-Fi ${printer.host}`
          : 'Imprimante Wi-Fi : adresse à saisir'
        : modeLabel[printer.mode];
  const pageProtocol = (globalThis as { location?: Location }).location?.protocol ?? 'https:';
  const certUrl = eposUrl(host, pageProtocol)?.replace(/\/cgi-bin.*$/, '/');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Imprimante' }} />

      <View style={[styles.hero, { borderColor: connected ? colors.free : colors.border }]}>
        <Emoji3D emoji="🧾" size={52} />
        <View style={styles.flex}>
          <Text style={styles.heroTitle}>{headline}</Text>
          <Text style={styles.heroSub}>
            {printer.autoKitchen && (printer.mode === 'bluetooth' || printer.mode === 'reseau')
              ? 'Chaque nouveau bon envoyé par le serveur s’imprime automatiquement.'
              : 'Cet appareil imprime à la demande (bouton « Imprimer »).'}
          </Text>
        </View>
      </View>

      {status ? (
        <View accessibilityRole="alert" style={[styles.status, { borderColor: status.ok ? colors.free : colors.danger }]}>
          <Text style={[styles.statusTitle, { color: status.ok ? colors.free : colors.danger }]}>
            {status.ok ? '✅ Impression réussie' : '❌ Échec de l’impression'} · {formatTime(status.at)}
          </Text>
          <Text style={styles.text}>{status.message}</Text>
        </View>
      ) : null}

      <SectionTitle>Connexion</SectionTitle>
      <View style={styles.chips}>
        {MODES.map((m) => (
          <Chip key={m.mode} label={`${m.emoji} ${m.label}`} selected={printer.mode === m.mode} onPress={() => chooseMode(m.mode)} />
        ))}
      </View>

      {printer.mode === 'bluetooth' ? (
        <Card style={styles.card}>
          {bluetoothSupported() ? (
            <>
              <Text style={styles.text}>
                Allumez l’imprimante thermique, activez le Bluetooth du téléphone, touchez « Connecter » puis choisissez-la dans
                la liste.
              </Text>
              {btName ? (
                <Button title="Déconnecter" icon="close-circle-outline" variant="secondary" onPress={disconnectBluetoothPrinter} />
              ) : (
                <Button title={busy ? 'Recherche…' : 'Connecter une imprimante'} icon="bluetooth" large onPress={connect} disabled={busy} />
              )}
              <Text style={styles.hint}>
                Si l’imprimante n’est plus connectée après une fermeture de l’application, touchez à nouveau « Connecter ».
              </Text>
            </>
          ) : (
            <Notice tone="warning" title={isIos() ? 'Bluetooth impossible sur iPhone' : 'Bluetooth indisponible dans ce navigateur'}>
              {isIos()
                ? 'Safari (iPhone, iPad) n’autorise pas les sites à parler à une imprimante Bluetooth. Sur iPhone, choisissez « Wi-Fi (Epson) » ou « AirPrint / système ». Le Bluetooth fonctionne avec Chrome sur Android ou sur ordinateur.'
                : 'Ouvrez l’application dans Google Chrome (Android, Windows, Mac) pour connecter une imprimante Bluetooth.'}
            </Notice>
          )}
          <Text style={styles.hint}>Compatibles : imprimantes thermiques Bluetooth BLE au format ESC/POS (58 ou 80 mm).</Text>
        </Card>
      ) : null}

      {printer.mode === 'reseau' ? (
        <Card style={styles.card}>
          <Text style={styles.text}>
            Pour les imprimantes de caisse Epson en Wi-Fi ou câble réseau compatibles ePOS-Print (TM-m30, TM-T20III, TM-T88…),
            branchées sur le même Wi-Fi que ce téléphone. Fonctionne aussi sur iPhone, et les bons sortent sans aucun geste.
          </Text>
          <Field
            label="Adresse IP de l’imprimante"
            value={host}
            onChangeText={setHost}
            onBlur={() => set({ host: host.trim() })}
            placeholder="192.168.1.50"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'url'}
            hint="Imprimée sur la feuille d’état de l’imprimante (maintenez le bouton FEED en l’allumant)."
          />
          <Text style={styles.hint}>
            Première fois sur ce téléphone : dans les réglages Web de l’imprimante, activez ePOS-Print. Puis ouvrez son adresse
            ci-dessous et acceptez son certificat de sécurité (« Visiter ce site »), sans quoi le navigateur bloque l’envoi.
          </Text>
          {certUrl ? (
            <Button
              title="Ouvrir l’imprimante (certificat)"
              icon="lock-open-outline"
              small
              variant="secondary"
              onPress={() => void Linking.openURL(certUrl)}
            />
          ) : null}
        </Card>
      ) : null}

      {printer.mode === 'systeme' ? (
        <Card style={styles.card}>
          <Text style={styles.text}>
            « Imprimer » ouvre la fenêtre d’impression du téléphone : AirPrint sur iPhone et iPad, imprimantes Wi-Fi du réseau,
            service d’impression d’Android.
          </Text>
          <Notice tone="warning" title="Pas d’impression automatique">
            Le téléphone demande de toucher « Imprimer » à chaque ticket. Pour que les bons sortent seuls en cuisine, choisissez
            Bluetooth ou Wi-Fi (Epson).
          </Notice>
        </Card>
      ) : null}

      {printer.mode !== 'aucune' ? (
        <>
          <SectionTitle>Papier</SectionTitle>
          <Card style={styles.card}>
            <View style={styles.chips}>
              <Chip label="58 mm (petit)" selected={printer.paperWidth === 58} onPress={() => set({ paperWidth: 58 })} />
              <Chip label="80 mm (standard)" selected={printer.paperWidth === 80} onPress={() => set({ paperWidth: 80 })} />
            </View>
            <SwitchRow
              label="Imprimer sans accents"
              hint="Si l’imprimante affiche des signes bizarres à la place de é, è, €…"
              value={printer.asciiOnly}
              onChange={(asciiOnly) => set({ asciiOnly })}
            />
          </Card>

          <SectionTitle>Impression automatique (cet appareil)</SectionTitle>
          <Card style={styles.card}>
            <SwitchRow
              label={kitchenRole ? `Bons ${device.role === 'bar' ? 'du bar' : 'de la cuisine'} dès leur arrivée` : 'Bons cuisine et bar dès leur arrivée'}
              hint="Quand le serveur envoie une commande, le bon sort tout seul sur cette imprimante (Bluetooth ou Wi-Fi). L’application doit rester ouverte sur cet appareil."
              value={printer.autoKitchen}
              onChange={(autoKitchen) => set({ autoKitchen })}
            />
            <SwitchRow
              label="Ticket de caisse après chaque encaissement"
              value={printer.autoReceipt}
              onChange={(autoReceipt) => set({ autoReceipt })}
            />
          </Card>

          <Button
            title={busy ? 'Impression…' : 'Impression test'}
            icon="print"
            large
            disabled={busy || (printer.mode === 'bluetooth' && !btName) || (printer.mode === 'reseau' && !host.trim())}
            onPress={test}
            style={styles.test}
          />
          <Text style={styles.hint}>
            Vérifiez sur le papier : nom du commerce, accents (é è à ç ù € ô) et total aligné à droite.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, ...screenBg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 6 },
  flex: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
  },
  heroTitle: { fontFamily: fonts.display, color: colors.text, fontSize: 20 },
  heroSub: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  status: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1.5, padding: 12, gap: 4, marginTop: 8 },
  statusTitle: { fontWeight: '800', fontSize: 14 },
  card: { gap: 12 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  test: { marginTop: 18 },
});
