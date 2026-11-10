import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ManagerGate } from '../../components/ManagerGate';
import {
  Button,
  Chip,
  confirm,
  Empty,
  Field,
  FormModal,
  IconButton,
  ListRow,
  notify,
  SectionTitle,
} from '../../components/ui';
import { addTables, deleteTable, upsertTable } from '../../store/actions';
import { uid } from '../../store/defaults';
import { openOrderForTable } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import type { Table } from '../../store/types';
import { colors } from '../../theme';

interface TableDraft {
  id: string | null;
  name: string;
  seats: string;
  zone: string;
}

interface BulkDraft {
  zone: string;
  prefix: string;
  count: string;
  seats: string;
}

function TablesSettingsScreen() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState<TableDraft | null>(null);
  const [bulk, setBulk] = useState<BulkDraft | null>(null);

  const zones = Array.from(new Set(state.tables.map((t) => t.zone || 'Salle')));
  const defaultZone = zones[0] ?? 'Salle';

  const save = () => {
    if (!draft) return;
    const seats = parseInt(draft.seats, 10);
    if (!draft.name.trim()) return notify('Nom manquant', 'Indiquez le nom ou le numéro de la table.');
    if (!Number.isFinite(seats) || seats < 1) return notify('Places invalides', 'Indiquez un nombre de places (1 ou plus).');
    dispatch(
      upsertTable({ id: draft.id ?? uid(), name: draft.name.trim(), seats, zone: draft.zone.trim() || 'Salle' }),
    );
    setDraft(null);
  };

  const saveBulk = () => {
    if (!bulk) return;
    const count = parseInt(bulk.count, 10);
    const seats = parseInt(bulk.seats, 10);
    if (!Number.isFinite(count) || count < 1 || count > 100) return notify('Nombre invalide', 'Entre 1 et 100 tables.');
    if (!Number.isFinite(seats) || seats < 1) return notify('Places invalides', 'Indiquez un nombre de places.');
    // Numérotation à la suite des tables existantes qui utilisent le même préfixe.
    const prefix = bulk.prefix.trim();
    const used = state.tables
      .map((t) => (t.name.startsWith(prefix) ? parseInt(t.name.slice(prefix.length).trim(), 10) : NaN))
      .filter((n) => Number.isFinite(n));
    const start = (used.length ? Math.max(...used) : 0) + 1;
    const tables: Table[] = Array.from({ length: count }, (_, i) => ({
      id: uid(),
      name: `${prefix}${start + i}`,
      seats,
      zone: bulk.zone.trim() || 'Salle',
    }));
    dispatch(addTables(tables));
    setBulk(null);
  };

  const remove = (id: string) => {
    if (openOrderForTable(state, id)) {
      notify('Table occupée', 'Encaissez ou annulez la commande en cours avant de supprimer cette table.');
      return;
    }
    confirm('Supprimer la table ?', 'Elle disparaîtra du plan de salle.', () => {
      dispatch(deleteTable(id));
      setDraft(null);
    }, 'Supprimer');
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Tables & zones',
          headerRight: () => (
            <IconButton
              icon="add-circle"
              label="Ajouter une table"
              color={colors.primary}
              size={28}
              onPress={() => setDraft({ id: null, name: '', seats: '4', zone: defaultZone })}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {state.tables.length === 0 ? <Empty icon="grid-outline" title="Aucune table" subtitle="Ajoutez vos tables une par une ou en série." /> : null}
        {zones.map((z) => (
          <View key={z}>
            <SectionTitle>{z}</SectionTitle>
            <View style={styles.group}>
              {state.tables
                .filter((t) => (t.zone || 'Salle') === z)
                .map((t) => (
                  <ListRow
                    key={t.id}
                    icon="square-outline"
                    iconColor={colors.busy}
                    title={t.name}
                    subtitle={`${t.seats} place(s)${openOrderForTable(state, t.id) ? ' · occupée' : ''}`}
                    chevron
                    onPress={() => setDraft({ id: t.id, name: t.name, seats: String(t.seats), zone: t.zone })}
                  />
                ))}
            </View>
          </View>
        ))}
        <View style={styles.actions}>
          <Button
            title="Ajouter une table"
            icon="add"
            onPress={() => setDraft({ id: null, name: '', seats: '4', zone: defaultZone })}
          />
          <Button
            title="Ajouter plusieurs tables"
            icon="duplicate-outline"
            variant="secondary"
            onPress={() => setBulk({ zone: defaultZone, prefix: 'T', count: '5', seats: '4' })}
          />
        </View>
      </ScrollView>

      <FormModal
        visible={draft !== null}
        title={draft?.id ? 'Modifier la table' : 'Nouvelle table'}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={draft?.id ? () => draft.id && remove(draft.id) : undefined}
      >
        {draft ? (
          <>
            <Field label="Nom / numéro" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="ex : T12" />
            <Field label="Nombre de places" value={draft.seats} onChangeText={(seats) => setDraft({ ...draft, seats })} keyboardType="number-pad" />
            <Field label="Zone" value={draft.zone} onChangeText={(zone) => setDraft({ ...draft, zone })} placeholder="ex : Salle, Terrasse, Étage" />
            <ZoneChips zones={zones} onPick={(zone) => setDraft({ ...draft, zone })} />
          </>
        ) : null}
      </FormModal>

      <FormModal visible={bulk !== null} title="Ajouter plusieurs tables" onClose={() => setBulk(null)} onSave={saveBulk} saveLabel="Créer les tables">
        {bulk ? (
          <>
            <Field label="Zone" value={bulk.zone} onChangeText={(zone) => setBulk({ ...bulk, zone })} />
            <ZoneChips zones={zones} onPick={(zone) => setBulk({ ...bulk, zone })} />
            <Field
              label="Préfixe"
              value={bulk.prefix}
              onChangeText={(prefix) => setBulk({ ...bulk, prefix })}
              hint="Les tables seront numérotées à la suite : T13, T14…"
            />
            <Field label="Nombre de tables" value={bulk.count} onChangeText={(count) => setBulk({ ...bulk, count })} keyboardType="number-pad" />
            <Field label="Places par table" value={bulk.seats} onChangeText={(seats) => setBulk({ ...bulk, seats })} keyboardType="number-pad" />
          </>
        ) : null}
      </FormModal>
    </View>
  );
}

function ZoneChips({ zones, onPick }: { zones: string[]; onPick: (zone: string) => void }) {
  if (!zones.length) return null;
  return (
    <View style={styles.chips}>
      <Text style={styles.hint}>Zones existantes :</Text>
      {zones.map((z) => (
        <Chip key={z} label={z} onPress={() => onPick(z)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  group: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  actions: { gap: 10, marginTop: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  hint: { fontSize: 12, color: colors.muted },
});

export default function TablesSettingsScreenRoute() {
  return (
    <ManagerGate>
      <TablesSettingsScreen />
    </ManagerGate>
  );
}
