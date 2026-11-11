import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { ManagerGate } from '../../components/ManagerGate';
import { useToast } from '../../components/Toast';
import { Button, Card, confirm, Field, FormModal, notify, PinPad, SectionTitle, Segmented } from '../../components/ui';
import { hashStaffPin, identifyCode, identifyStaff } from '../../license/access';
import { addServer, removeServer, renameServer, setStaff } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import type { Role, StaffMember } from '../../store/types';
import { colors, fonts, roleEmoji, roleLabel } from '../../theme';

const ROLE_OPTIONS = (['serveur', 'cuisine', 'bar'] as Role[]).map((r) => ({ value: r, label: `${roleEmoji[r]} ${roleLabel[r]}` }));

function StaffScreen() {
  const { state, device, updateDevice, dispatch } = useStore();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('serveur');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [pinFor, setPinFor] = useState<StaffMember | null>(null);

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (state.staff.some((m) => m.name === name)) return notify('Déjà existant', `« ${name} » est déjà dans l’équipe.`);
    dispatch(addServer(name, newRole));
    setNewName('');
    toast(`${name} ajouté(e) · ${roleLabel[newRole]}`, roleEmoji[newRole]);
  };

  const saveEdit = () => {
    if (!editing) return;
    const name = editName.trim();
    if (!name) return notify('Nom manquant', 'Indiquez un nom.');
    if (name !== editing.name && state.staff.some((m) => m.name === name)) return notify('Déjà existant', `« ${name} » existe déjà.`);
    if (name !== editing.name) {
      dispatch(renameServer(editing.name, name));
      if (device.currentServer === editing.name) updateDevice({ currentServer: name });
    }
    dispatch(setStaff({ ...editing, name }));
    setEditing(null);
  };

  const byRole = (r: Role) => state.staff.filter((m) => m.role === r);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Équipe & postes' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Chaque employé a un poste et peut avoir son code personnel : en le tapant (Équipe › Connexion employé), il arrive
          directement sur son poste de travail.
        </Text>

        {(['serveur', 'cuisine', 'bar'] as Role[]).map((r) =>
          byRole(r).length ? (
            <View key={r}>
              <SectionTitle>
                {roleEmoji[r]} {roleLabel[r]}
              </SectionTitle>
              <View style={styles.group}>
                {byRole(r).map((m) => (
                  <Pressable
                    key={m.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Modifier ${m.name}`}
                    onPress={() => {
                      setEditing(m);
                      setEditName(m.name);
                    }}
                    android_ripple={{ color: colors.goldSoft }}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <View style={styles.avatar}>
                      <Emoji3D emoji={roleEmoji[m.role]} size={28} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.name}>{m.name}</Text>
                      <Text style={styles.sub}>
                        {roleLabel[m.role]} · {m.pinHash ? `🔑 code à ${m.pinLength ?? '?'} chiffres` : 'pas de code'}
                        {device.currentServer === m.name ? ' · sur cet appareil' : ''}
                      </Text>
                    </View>
                    <Button
                      title={m.pinHash ? 'Code' : 'Créer code'}
                      icon="key"
                      small
                      variant={m.pinHash ? 'secondary' : 'primary'}
                      onPress={() => setPinFor(m)}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null,
        )}

        <SectionTitle>Ajouter un employé</SectionTitle>
        <Card style={styles.card}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Prénom"
            placeholderTextColor="#A99E90"
            style={styles.input}
            onSubmitEditing={add}
            accessibilityLabel="Prénom du nouvel employé"
          />
          <Text style={styles.label}>Poste</Text>
          <Segmented<Role> value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
          <Button title="Ajouter" icon="person-add" onPress={add} disabled={!newName.trim()} />
        </Card>
      </ScrollView>

      <FormModal
        visible={editing !== null}
        title={editing ? `Modifier ${editing.name}` : ''}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onDelete={
          editing && state.staff.length > 1
            ? () =>
                confirm('Retirer cet employé ?', `« ${editing.name} » sera retiré de l’équipe.`, () => {
                  dispatch(removeServer(editing.name));
                  setEditing(null);
                }, 'Retirer')
            : undefined
        }
      >
        {editing ? (
          <>
            <Field label="Prénom" value={editName} onChangeText={setEditName} />
            <Text style={styles.label}>Poste</Text>
            <Segmented<Role> value={editing.role} onChange={(role) => setEditing({ ...editing, role })} options={ROLE_OPTIONS} />
            {editing.pinHash ? (
              <Button
                title="Supprimer le code personnel"
                icon="close-circle-outline"
                variant="ghost"
                onPress={() => {
                  setEditing({ ...editing, pinHash: null, pinLength: null });
                }}
              />
            ) : null}
          </>
        ) : null}
      </FormModal>

      <Modal visible={pinFor !== null} animationType="slide" onRequestClose={() => setPinFor(null)}>
        <View style={styles.pinScreen}>
          {pinFor ? (
            <PinPad
              emoji={roleEmoji[pinFor.role]}
              title={`Code de ${pinFor.name}`}
              subtitle="4 à 6 chiffres, personnel et différent pour chaque employé."
              maxLength={6}
              onSubmit={(code) => {
                if (/^(\d)\1+$/.test(code) || '0123456789'.includes(code)) return 'Code trop simple (ex. 1111, 1234).';
                const other = identifyStaff(state, code);
                if (other && other.id !== pinFor.id) return 'Ce code est déjà utilisé par un autre employé.';
                if (identifyCode(state, code)) return 'Ce code est réservé (gérant ou administrateur).';
                dispatch(setStaff({ ...pinFor, pinHash: hashStaffPin(code, state.license.id), pinLength: code.length }));
                toast(`Code personnel enregistré pour ${pinFor.name}`, '🔑');
                setPinFor(null);
                return null;
              }}
            />
          ) : null}
          <Button title="Annuler" variant="ghost" icon="close" onPress={() => setPinFor(null)} />
        </View>
      </Modal>
    </View>
  );
}

export default function StaffRoute() {
  return (
    <ManagerGate>
      <StaffScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 800, alignSelf: 'center' },
  flex: { flex: 1 },
  help: { color: colors.muted, lineHeight: 20 },
  group: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.goldSoft },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  card: { gap: 12 },
  label: { fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: colors.text,
  },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
