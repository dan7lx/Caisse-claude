import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { JoinTeamForm } from '../components/JoinTeamForm';
import { Button, Card, Chip, confirm, Field, Notice, notify, PinPad, SectionTitle, Segmented } from '../components/ui';
import { BUILT_IN_SERVER } from '../config';
import { canCreateLobby, identifyCode } from '../license/access';
import { addServer } from '../store/actions';
import { useNow, useStore } from '../store/StoreProvider';
import type { Role } from '../store/types';
import { makeInviteLink } from '../sync/backend';
import { colors, fonts } from '../theme';

export default function TeamScreen() {
  const store = useStore();
  const { state, device, session, setSession, updateDevice, dispatch, sync, pendingCount } = store;
  const now = useNow(1000);
  const [askPin, setAskPin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState(device.server?.url ?? BUILT_IN_SERVER?.url ?? '');
  const [key, setKey] = useState(device.server?.anonKey ?? BUILT_IN_SERVER?.anonKey ?? '');
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

  const create = async () => {
    if (!url.trim() || !key.trim()) {
      notify('Serveur manquant', 'Renseignez l’adresse et la clé publique de votre projet Supabase (voir le guide).');
      return;
    }
    setCreating(true);
    try {
      const code = await store.createLobby({ url, anonKey: key });
      notify('Lobby créé', `Code d’accès : ${code}\nPartagez-le avec votre équipe.`);
    } catch (e) {
      notify('Création impossible', e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

  const statusText =
    sync.status === 'ok'
      ? `Synchronisé${sync.lastSync ? ` il y a ${Math.max(0, Math.round((now - sync.lastSync) / 1000))} s` : ''}`
      : sync.status === 'connexion'
        ? 'Connexion…'
        : sync.status === 'ferme'
          ? 'Lobby fermé par le gérant'
          : `Hors ligne${pendingCount ? ` · ${pendingCount} modification(s) en attente` : ''}`;
  const statusColor = sync.status === 'ok' ? colors.free : sync.status === 'ferme' ? colors.danger : colors.ready;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Équipe' }} />

      <SectionTitle>Cet appareil</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Je suis</Text>
        <View style={styles.chips}>
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
            { value: 'serveur', label: 'Salle / serveur' },
            { value: 'cuisine', label: 'Cuisine / bar' },
          ]}
        />
        <Text style={styles.hint}>« Cuisine / bar » n’affiche que les tickets : idéal pour la tablette en cuisine.</Text>
      </Card>

      {lobby ? (
        <>
          <SectionTitle>Lobby de l’équipe</SectionTitle>
          <View style={styles.lobby}>
            <Text style={styles.lobbyLabel}>CODE D’ACCÈS</Text>
            <Text style={styles.lobbyCode} selectable>
              {lobby.code}
            </Text>
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            {sync.error && sync.status === 'hors_ligne' ? <Text style={styles.error}>{sync.error}</Text> : null}
            <View style={styles.lobbyActions}>
              <Button title="Inviter l’équipe" icon="share-social" onPress={share} style={styles.flex} />
            </View>
          </View>
          <Notice title="Comment ça marche ?">
            Chaque serveur et la cuisine rejoignent ce lobby avec le code. Les commandes envoyées, les plats prêts et la carte
            sont partagés en direct sur tous les appareils.
          </Notice>
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
          <SectionTitle>Rejoindre l’équipe</SectionTitle>
          <Card style={styles.card}>
            <JoinTeamForm />
          </Card>

          <SectionTitle>Créer le lobby (gérant)</SectionTitle>
          <Card style={styles.card}>
            {allowedToCreate ? (
              <>
                <Text style={styles.text}>
                  Le lobby partage la carte, les tables et les commandes de cet appareil avec toute l’équipe. Un code
                  d’accès à 6 caractères est créé.
                </Text>
                <Field label="Adresse du serveur Supabase" value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://xxxx.supabase.co" />
                <Field label="Clé publique (anon / publishable)" value={key} onChangeText={setKey} autoCapitalize="none" placeholder="sb_publishable_…" />
                <Button title={creating ? 'Création…' : 'Créer le lobby'} icon="add-circle" large onPress={create} disabled={creating} />
              </>
            ) : session.manager && !state.security.managerCanCreateLobby ? (
              <Notice tone="danger" title="Création désactivée">
                L’administrateur a retiré au gérant le droit de créer un lobby.
              </Notice>
            ) : (
              <>
                <View style={styles.lockRow}>
                  <Ionicons name="lock-closed" size={20} color={colors.goldDeep} />
                  <Text style={styles.text}>Seul le gérant peut créer le lobby de son équipe.</Text>
                </View>
                <Button title="Saisir le code gérant" icon="key" variant="dark" onPress={() => setAskPin(true)} />
              </>
            )}
          </Card>
        </>
      )}

      <Modal visible={askPin} animationType="slide" onRequestClose={() => setAskPin(false)}>
        <View style={styles.pinScreen}>
          <PinPad
            title="Code gérant"
            subtitle={state.security.managerPinHash ? 'Pour créer le lobby de l’équipe.' : 'Créez d’abord le code gérant dans l’onglet Gestion.'}
            onSubmit={(c) => {
              const who = identifyCode(state, c);
              if (who === 'admin') setSession({ admin: true, manager: true });
              else if (who === 'manager') setSession({ manager: true });
              else return 'Code incorrect.';
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 },
  flex: { flex: 1 },
  card: { gap: 10 },
  label: { fontWeight: '800', color: colors.text, fontSize: 14 },
  hint: { fontSize: 12, color: colors.muted },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: colors.text,
  },
  lobby: {
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  lobbyLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  lobbyCode: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 46, letterSpacing: 10 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.onDarkMuted, fontWeight: '600' },
  error: { color: '#E8857C', textAlign: 'center' },
  lobbyActions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  lockRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
