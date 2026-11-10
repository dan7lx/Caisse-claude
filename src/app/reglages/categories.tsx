import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  confirm,
  Empty,
  Field,
  FormModal,
  IconButton,
  ListRow,
  notify,
  Segmented,
} from '../../components/ui';
import { deleteCategory, moveCategory, upsertCategory } from '../../store/actions';
import { uid } from '../../store/defaults';
import { useStore } from '../../store/StoreProvider';
import type { Category, Station } from '../../store/types';
import { categoryPalette, colors, stationLabel } from '../../theme';

export default function CategoriesScreen() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState<Category | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setIsNew(true);
    setDraft({
      id: uid(),
      name: '',
      station: 'cuisine',
      color: categoryPalette[state.categories.length % categoryPalette.length],
    });
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return notify('Nom manquant', 'Indiquez le nom de la catégorie.');
    dispatch(upsertCategory({ ...draft, name: draft.name.trim() }));
    setDraft(null);
  };

  const itemCount = (id: string) => state.items.filter((i) => i.categoryId === id).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Catégories',
          headerRight: () => <IconButton icon="add-circle" label="Ajouter une catégorie" color={colors.primary} size={28} onPress={openNew} />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Chaque catégorie est envoyée soit en cuisine, soit au bar. L’ordre ici est celui de la carte lors de la prise de
          commande.
        </Text>
        {state.categories.length === 0 ? <Empty icon="pricetags-outline" title="Aucune catégorie" /> : null}
        <View style={styles.group}>
          {state.categories.map((c, index) => (
            <ListRow
              key={c.id}
              title={c.name}
              subtitle={`${stationLabel[c.station]} · ${itemCount(c.id)} article(s)`}
              icon={c.station === 'bar' ? 'wine-outline' : 'restaurant-outline'}
              iconColor={c.color}
              onPress={() => {
                setIsNew(false);
                setDraft(c);
              }}
              right={
                <View style={styles.arrows}>
                  <IconButton icon="chevron-up" label={`Monter ${c.name}`} disabled={index === 0} onPress={() => dispatch(moveCategory(c.id, -1))} />
                  <IconButton
                    icon="chevron-down"
                    label={`Descendre ${c.name}`}
                    disabled={index === state.categories.length - 1}
                    onPress={() => dispatch(moveCategory(c.id, 1))}
                  />
                </View>
              }
            />
          ))}
        </View>
        <Button title="Ajouter une catégorie" icon="add" onPress={openNew} style={styles.addBtn} />
      </ScrollView>

      <FormModal
        visible={draft !== null}
        title={isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={
          draft && !isNew
            ? () => {
                const n = itemCount(draft.id);
                confirm(
                  'Supprimer la catégorie ?',
                  n ? `Ses ${n} article(s) seront aussi supprimés.` : 'Cette catégorie est vide.',
                  () => {
                    dispatch(deleteCategory(draft.id));
                    setDraft(null);
                  },
                  'Supprimer',
                );
              }
            : undefined
        }
      >
        {draft ? (
          <>
            <Field label="Nom" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="ex : Plats" />
            <Text style={styles.label}>Envoyer vers</Text>
            <Segmented<Station>
              value={draft.station}
              onChange={(station) => setDraft({ ...draft, station })}
              options={[
                { value: 'cuisine', label: 'Cuisine' },
                { value: 'bar', label: 'Bar' },
              ]}
            />
            <Text style={styles.label}>Couleur</Text>
            <View style={styles.palette}>
              {categoryPalette.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Couleur ${color}`}
                  accessibilityState={{ selected: draft.color === color }}
                  onPress={() => setDraft({ ...draft, color })}
                  style={[styles.swatch, { backgroundColor: color }, draft.color === color && styles.swatchActive]}
                />
              ))}
            </View>
          </>
        ) : null}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  help: { color: colors.muted, marginBottom: 12 },
  group: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  arrows: { flexDirection: 'row' },
  addBtn: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchActive: { borderWidth: 4, borderColor: colors.text },
});
