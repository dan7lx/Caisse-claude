import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Emoji3D } from '../components/Emoji3D';
import { JoinTeamForm } from '../components/JoinTeamForm';
import { usePinLock } from '../components/ManagerGate';
import { QrCode } from '../components/QrCode';
import { useToast } from '../components/Toast';
import { Button, Card, Chip, confirm, Field, Notice, notify, PinPad, SectionTitle, Segmented } from '../components/ui';
import { BUILT_IN_SERVER } from '../config';
import { canCreateLobby, identifyCode } from '../license/access';
import { addServer } from '../store/actions';
import { useNow, useStore } from '../store/StoreProvider';
import type { Role, ServerConfig } from '../store/types';
import { makeInviteLink } from '../sync/backend';
import { colors, fonts } from '../theme';
import { haptic } from '../utils/haptics';
import { useLayout } from '../utils/layout';

type Mode = 'creer' | 'rejoindre';

export default function TeamScreen() {
  const store = useStore();
  const { state, device, session, setSession, recordPinAttempt, updateDevice, dispatch, sync, pendingCount, invite } = store;
  const toast = useToast();
  const { small } = useLayout();
  const now = useNow(5000);
  const lockedMessage = usePinLock();
  const knownServer: ServerConfig | null = device.server ?? BUILT_IN_SERVER;
  const [mode, setMode] = useState<Mode | null>(invite ? 'rejoindre' : null);
  const [askPin, setAskPin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editServer, setEditServer] = useState(!knownServer);
  const [url, setUrl] = useState(knownServer?.url ?? '');
  const [key, setKey] = useState(knownServer?.anonKey ?? '');
  const [newName, setNewName] = useState('');

  const lobby = device.lobby;
  const allowedToCreate = canCreateLobby(state, session);

  const inviteLink = (): string | null => {
    if (!lobby || Platform.OS !== 'web') return null;
    const origin = (globalThis as { location?: { origin: string } }).location?.origin;
    return origin ? makeInviteLink(origin, lobby.code, lobby.server) : null;
  };

  const share = async () => {
    if (!lobby) return;
    const link = inviteLink();
    const message = `Rejoignez l’équipe de ${state.settings.restaurantName} sur Caisse Resto.\nCode du lobby : ${lobby.code}${link ? `\n${link}` : ''}`;
    try {
      await Share.share({ message });
    } catch {
      notify('Invitation', message);
    }
  };

  const paste = async (setter: (v: string) => void) => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setter(text.trim());
    } catch {
      notify('Coller', 'Impossible de lire le presse-papiers.');
    }
  };

  const create = async () => {
    const server = editServer || !knownServer ? { url, anonKey: key } : knownServer;
    if (!server.url.trim() || !server.anonKey.trim()) {
      notify('Serveur manquant', 'Renseignez l’adresse et la clé publique de votre projet Supabase.');
      return;
    }
    setCreating(true);
    try {
      const code = await store.createLobby(server);
      haptic.success();
      toast(`Lobby ${code} créé : invitez votre équipe`, '🚀');
      setEditServer(false);
    } catch (e) {
      notify('Création impossible', e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const statusText =
    sync.status === 'ok'
      ? `Synchronisé${sync.lastSync ? ` · il y a ${Math.max(0, Math.round((now - sync.lastSync) / 1000))} s` : ''}`
      : sync.status === 'connexion'
        ? 'Connexion…'
        : sync.status === 'ferme'
          ? 'Lobby fermé par le gérant'
          : `Hors ligne${pendingCount ? ` · ${pendingCount} modification(s) en attente` : ''}`;
  const statusColor = sync.status === 'ok' ? '#4CC38A' : sync.status === 'ferme' ? '#E8857C' : colors.ready;
  const link = inviteLink();

  // Prénom et poste de cet appareil (bloc d'affichage, pas un composant : le clavier garde le focus).
  const profileCard = (
    <>
      <SectionTitle>Cet appareil</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Je suis</Text>
        <View style={styles.chipsRow}>
          {state.servers.map((s) => (
            <Chip key={s} label={s} color={colors.ink} selected={device.currentServer === s} onPress={() => updateDevice({ currentServer: s })} />
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Autre prénom"
            placeholderTextColor="#A99E90"
            style={styles.input}
            accessibilityLabel="Autre prénom"
          />
          <Button
            title="OK"
            small
            disabled={!newName.trim()}
            onPress={() => {
              dispatch(addServer(newName));
              updateDevice({ currentServer: newName.trim() });
              setNewName('');
            }}
          />
        </View>
        <Text style={styles.label}>Poste</Text>
        <Segmented<Role>
          value={device.role}
          onChange={(role) => updateDevice({ role })}
          options={[
            { value: 'serveur', label: '🙋 Salle' },
            { value: 'cuisine', label: '🧑‍🍳 Cuisine / bar' },
          ]}
        />
        <Text style={styles.hint}>« Cuisine / bar » n’affiche que les tickets : idéal pour la tablette en cuisine.</Text>
      </Card>
    </>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Équipe' }} />

      {lobby ? (
        <>
          <View style={styles.lobby}>
            <Emoji3D emoji="📡" size={46} />
            <Text style={styles.lobbyLabel}>CODE D’ACCÈS DU LOBBY</Text>
            <Text style={[styles.lobbyCode, small && styles.lobbyCodeSmall]} selectable>
              {lobby.code}
            </Text>
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            {sync.error && sync.status === 'hors_ligne' ? <Text style={styles.error}>{sync.error}</Text> : null}
            <View style={styles.qr}>
              <QrCode value={link ?? lobby.code} size={small ? 170 : 200} />
            </View>
            <Text style={styles.qrHint}>
              {link
                ? 'Vos employés scannent ce QR code avec l’appareil photo : ils rejoignent l’équipe sans rien taper.'
                : 'Vos employés saisissent ce code dans « Rejoindre ».'}
            </Text>
            <View style={styles.lobbyActions}>
              <Button title="Inviter" icon="share-social" onPress={share} style={styles.flex} />
              {link ? (
                <Button
                  title="Copier"
                  icon="link"
                  variant="secondary"
                  onPress={() =>
                    Clipboard.setStringAsync(link)
                      .then(() => toast('Lien d’invitation copié', '🔗'))
                      .catch(() => {})
                  }
                  style={styles.flex}
                />
              ) : null}
            </View>
          </View>

          {profileCard}

          <Button
            title="Quitter le lobby"
            variant="secondary"
            icon="exit-outline"
            onPress={() =>
              confirm(
                'Quitter le lobby ?',
                session.manager || session.admin
                  ? 'Cet appareil garde une copie des données du restaurant.'
                  : 'Cet appareil ne verra plus les commandes de l’équipe.',
                store.leaveLobby,
                'Quitter',
              )
            }
          />
          {allowedToCreate ? (
            <Button
              title="Fermer le lobby pour toute l’équipe"
              variant="ghost"
              icon="close-circle-outline"
              onPress={() =>
                confirm('Fermer le lobby ?', 'Plus personne ne pourra le rejoindre ni le synchroniser.', () => {
                  store.closeLobby().catch((e: unknown) => notify('Erreur', e instanceof Error ? e.message : 'Erreur'));
                }, 'Fermer')
              }
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Travaillez en équipe</Text>
            <Text style={styles.introText}>
              Le lobby relie les téléphones de la salle, de la cuisine et du bar : les commandes s’affichent partout en direct.
            </Text>
          </View>

          <View style={[styles.choices, small && styles.choicesSmall]}>
            <ChoiceCard emoji="🚀" title="Créer un lobby" subtitle="Je suis le gérant" selected={mode === 'creer'} onPress={() => setMode('creer')} />
            <ChoiceCard
              emoji="👋"
              title="Rejoindre"
              subtitle="J’ai un code ou un lien"
              selected={mode === 'rejoindre'}
              onPress={() => setMode('rejoindre')}
            />
          </View>

          {mode === 'rejoindre' ? (
            <Card style={styles.card}>
              <JoinTeamForm />
            </Card>
          ) : null}

          {mode === 'creer' ? (
            <Card style={styles.card}>
              {!allowedToCreate ? (
                session.manager && !state.security.managerCanCreateLobby ? (
                  <Notice tone="danger" title="Création désactivée">
                    L’administrateur a retiré au gérant le droit de créer un lobby.
                  </Notice>
                ) : (
                  <>
                    <View style={styles.stepHead}>
                      <Emoji3D emoji="🔐" size={34} />
                      <Text style={styles.text}>Seul le gérant peut créer le lobby. Saisissez votre code gérant pour continuer.</Text>
                    </View>
                    <Button title="Saisir le code gérant" icon="key" variant="dark" large onPress={() => setAskPin(true)} />
                  </>
                )
              ) : (
                <>
                  {knownServer && !editServer ? (
                    <View style={styles.server}>
                      <Emoji3D emoji="✅" size={26} />
                      <View style={styles.flex}>
                        <Text style={styles.serverLabel}>Serveur prêt</Text>
                        <Text style={styles.serverUrl} numberOfLines={1}>
                          {knownServer.url.replace(/^https?:\/\//, '')}
                        </Text>
                      </View>
                      <Chip label="Modifier" onPress={() => setEditServer(true)} />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.text}>
                        Une seule fois : collez l’adresse et la clé de votre projet Supabase (voir le guide dans le README).
                      </Text>
                      <ServerField label="Adresse du serveur Supabase" value={url} onChange={setUrl} onPaste={() => paste(setUrl)} placeholder="https://xxxx.supabase.co" />
                      <ServerField label="Clé publique (anon / publishable)" value={key} onChange={setKey} onPaste={() => paste(setKey)} placeholder="sb_publishable_…" />
                    </>
                  )}
                  <Text style={styles.hint}>
                    La carte, les tables et les commandes de cet appareil seront partagées avec l’équipe. Un code à 6
                    caractères et un QR code sont créés.
                  </Text>
                  <Button title={creating ? 'Création…' : 'Créer le lobby maintenant'} icon="rocket" large onPress={create} disabled={creating} />
                </>
              )}
            </Card>
          ) : null}

          {profileCard}
        </>
      )}

      <Modal visible={askPin} animationType="slide" onRequestClose={() => setAskPin(false)}>
        <View style={styles.pinScreen}>
          <PinPad
            emoji="🔐"
            title="Code gérant"
            subtitle={state.security.managerPinHash ? 'Pour créer le lobby de l’équipe.' : 'Créez d’abord le code gérant dans l’onglet Gestion.'}
            lockedMessage={lockedMessage}
            autoTry={
              state.security.managerPinLength
                ? {
                    length: state.security.managerPinLength,
                    attempt: (c) => {
                      if (identifyCode(state, c) !== 'manager') return false;
                      recordPinAttempt(true);
                      setSession({ manager: true });
                      setAskPin(false);
                      return true;
                    },
                  }
                : null
            }
            onSubmit={(c) => {
              const who = identifyCode(state, c);
              if (who === 'admin') setSession({ admin: true, manager: true });
              else if (who === 'manager') setSession({ manager: true });
              else {
                recordPinAttempt(false);
                return 'Code incorrect.';
              }
              recordPinAttempt(true);
              setAskPin(false);
              return null;
            }}
          />
          <Button title="Annuler" variant="ghost" icon="close" onPress={() => setAskPin(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

interface ChoiceCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

function ChoiceCard({ emoji, title, subtitle, selected, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.choice, selected && styles.choiceActive, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      <Emoji3D emoji={emoji} size={52} />
      <Text style={[styles.choiceTitle, selected && { color: colors.onDark }]}>{title}</Text>
      <Text style={[styles.choiceSub, selected && { color: colors.goldLight }]}>{subtitle}</Text>
    </Pressable>
  );
}

interface ServerFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPaste: () => void;
  placeholder: string;
}

function ServerField({ label, value, onChange, onPaste, placeholder }: ServerFieldProps) {
  return (
    <View style={styles.serverField}>
      <View style={styles.flex}>
        <Field label={label} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} placeholder={placeholder} />
      </View>
      <Button title="Coller" icon="clipboard-outline" small variant="secondary" onPress={onPaste} style={styles.pasteBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 },
  flex: { flex: 1 },
  card: { gap: 12 },
  intro: { gap: 4 },
  introTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 26, color: colors.text },
  introText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  choices: { flexDirection: 'row', gap: 12 },
  choicesSmall: { gap: 8 },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  choiceActive: { backgroundColor: colors.ink, borderColor: colors.gold },
  choiceTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 19, color: colors.text, textAlign: 'center' },
  choiceSub: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontWeight: '800', color: colors.text, fontSize: 14 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: colors.text,
  },
  server: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.freeSoft, borderRadius: 14, padding: 12 },
  serverLabel: { fontWeight: '800', color: colors.free },
  serverUrl: { color: colors.text, fontSize: 13 },
  serverField: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  pasteBtn: { marginBottom: 4 },
  lobby: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  lobbyLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  lobbyCode: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 46, letterSpacing: 10 },
  lobbyCodeSmall: { fontSize: 36, letterSpacing: 6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.onDarkMuted, fontWeight: '600' },
  error: { color: '#E8857C', textAlign: 'center' },
  qr: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 18, marginTop: 6 },
  qrHint: { color: colors.onDarkMuted, textAlign: 'center', fontSize: 13, maxWidth: 360 },
  lobbyActions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
