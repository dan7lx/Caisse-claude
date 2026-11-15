import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BUILT_IN_SERVER } from '../config';
import { useStore } from '../store/StoreProvider';
import type { Role } from '../store/types';
import { colors } from '../theme';
import { haptic } from '../utils/haptics';
import { useToast } from './Toast';
import { CodeBoxes } from './CodeBoxes';
import { QrScanner } from './QrScanner';
import { parseScannedLobby } from '../sync/scan';
import { Button, Field, Segmented } from './ui';

interface Props {
  dark?: boolean;
  onJoined?: () => void;
}

/** Rejoindre le lobby de son restaurant avec le code donné par le gérant. */
export function JoinTeamForm({ dark, onJoined }: Props) {
  const { device, invite, clearInvite, joinLobby } = useStore();
  const knownServer = invite?.server ?? device.lastLobby?.server ?? device.server ?? BUILT_IN_SERVER;
  const [code, setCode] = useState(invite?.code ?? device.lastLobby?.code ?? '');
  const [name, setName] = useState(device.currentServer === 'Serveur 1' ? '' : device.currentServer);
  const [role, setRole] = useState<Role>(device.role);
  const [url, setUrl] = useState(knownServer?.url ?? '');
  const [key, setKey] = useState(knownServer?.anonKey ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (invite) {
      setCode(invite.code);
      if (invite.server) {
        setUrl(invite.server.url);
        setKey(invite.server.anonKey);
      }
    }
  }, [invite]);

  const needsServer = !knownServer;
  const fg = dark ? colors.onDark : colors.text;

  const join = async (override?: { code: string; url: string; key: string }) => {
    const c = override?.code ?? code;
    const u = override?.url ?? url;
    const k = override?.key ?? key;
    if (c.trim().length < 6) return setError('Le code du lobby contient 6 caractères.');
    if (!name.trim()) return setError('Indiquez votre prénom.');
    if (!u.trim() || !k.trim()) return setError('Adresse du serveur manquante : utilisez le lien d’invitation du gérant.');
    setBusy(true);
    setError(null);
    try {
      await joinLobby({ url: u, anonKey: k }, c, { name, role });
      clearInvite();
      haptic.success();
      toast('Bienvenue dans l’équipe !', '👋');
      onJoined?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de rejoindre le lobby.');
    } finally {
      setBusy(false);
    }
  };

  // QR code scanné : remplit le code (et le serveur), puis rejoint directement si le prénom est connu.
  const onScan = (text: string): string | null => {
    const found = parseScannedLobby(text);
    if (!found) return 'Ce QR code n’est pas une invitation de lobby.';
    const u = found.server?.url ?? url;
    const k = found.server?.anonKey ?? key;
    setCode(found.code);
    setUrl(u);
    setKey(k);
    setScanning(false);
    if (name.trim()) void join({ code: found.code, url: u, key: k });
    else toast('Code scanné : indiquez votre prénom', '📷');
    return null;
  };

  return (
    <View style={styles.wrap}>
      <Button title="Scanner le QR code du gérant" icon="qr-code-outline" variant="secondary" large onPress={() => setScanning(true)} />
      {scanning ? <QrScanner onClose={() => setScanning(false)} onScan={onScan} /> : null}
      <Text style={[styles.label, { color: fg }]}>Ou saisissez le code du lobby (6 caractères)</Text>
      <CodeBoxes value={code} onChange={setCode} dark={dark} />
      <Text style={[styles.label, { color: fg }]}>Votre prénom</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="ex : Julie"
        placeholderTextColor={dark ? colors.onDarkMuted : '#A99E90'}
        accessibilityLabel="Votre prénom"
        style={[styles.input, dark ? styles.inputDark : styles.inputLight]}
      />
      <Text style={[styles.label, { color: fg }]}>Votre poste</Text>
      <Segmented<Role>
        dark={dark}
        value={role}
        onChange={setRole}
        options={[
          { value: 'serveur', label: '🙋 Salle' },
          { value: 'cuisine', label: '🧑‍🍳 Cuisine' },
          { value: 'bar', label: '🍸 Bar' },
        ]}
      />
      {needsServer ? (
        <View style={styles.server}>
          <Text style={[styles.hint, { color: dark ? colors.onDarkMuted : colors.muted }]}>
            Ouvrez de préférence le lien d’invitation envoyé par le gérant : il remplit ces champs automatiquement.
          </Text>
          <Field label="Adresse du serveur" value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://xxxx.supabase.co" />
          <Field label="Clé publique" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="sb_publishable_…" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={busy ? 'Connexion…' : 'Rejoindre l’équipe'} icon="people" onPress={() => join()} disabled={busy || code.length < 6} large />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: { fontWeight: '700', fontSize: 14, marginTop: 4 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  inputDark: { backgroundColor: colors.ink, borderColor: colors.ink3, color: colors.onDark },
  inputLight: { backgroundColor: colors.field, borderColor: colors.border, color: colors.text },
  server: { gap: 10, marginTop: 6 },
  hint: { fontSize: 13 },
  error: { color: '#E8857C', fontWeight: '700' },
});
