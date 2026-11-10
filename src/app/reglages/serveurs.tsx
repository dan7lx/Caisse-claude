import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, confirm, Field, FormModal, IconButton, ListRow, notify } from '../../components/ui';
import { addServer, removeServer, renameServer, updateSettings } from '../../store/actions';
import { useStore } from '../../store/StoreProvider';
import { colors } from '../../theme';

export default function ServersScreen() {
  const { state, dispatch } = useStore();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ old: string; name: string } | null>(null);

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (state.servers.includes(name)) return notify('Déjà existant', `« ${name} » est déjà dans la liste.`);
    dispatch(addServer(name));
    setNewName('');
  };

  const saveRename = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return notify('Nom manquant', 'Indiquez un nom.');
    if (name !== editing.old && state.servers.includes(name)) return notify('Déjà existant', `« ${name} » existe déjà.`);
    dispatch(renameServer(editing.old, name));
    setEditing(null);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Serveurs' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Touchez un serveur pour l’attribuer à cet appareil : les nouvelles commandes seront à son nom.
        </Text>
        <View style={styles.group}>
          {state.servers.map((s) => {
            const active = s === state.settings.currentServer;
            return (
              <ListRow
                key={s}
                icon={active ? 'person' : 'person-outline'}
                iconColor={active ? colors.primary : colors.muted}
                title={s}
                subtitle={active ? 'Sur cet appareil' : undefined}
                onPress={() => dispatch(updateSettings({ currentServer: s }))}
                right={
                  <View style={styles.rowActions}>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                    <IconButton icon="create-outline" label={`Renommer ${s}`} onPress={() => setEditing({ old: s, name: s })} />
                    <IconButton
                      icon="trash-outline"
                      label={`Supprimer ${s}`}
                      color={colors.danger}
                      disabled={state.servers.length <= 1}
                      onPress={() => confirm('Supprimer ce serveur ?', `« ${s} » sera retiré de la liste.`, () => dispatch(removeServer(s)), 'Supprimer')}
                    />
                  </View>
                }
              />
            );
          })}
        </View>
        <View style={styles.addBox}>
          <Field label="Nouveau serveur" value={newName} onChangeText={setNewName} placeholder="Prénom" onSubmitEditing={add} returnKeyType="done" />
          <Button title="Ajouter" icon="person-add-outline" onPress={add} disabled={!newName.trim()} />
        </View>
      </ScrollView>

      <FormModal visible={editing !== null} title="Renommer" onClose={() => setEditing(null)} onSave={saveRename}>
        {editing ? <Field label="Nom" value={editing.name} onChangeText={(name) => setEditing({ ...editing, name })} autoFocus /> : null}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  help: { color: colors.muted, marginBottom: 12 },
  group: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBox: { gap: 10, marginTop: 20 },
});
