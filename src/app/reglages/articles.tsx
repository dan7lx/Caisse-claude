import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

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
  SwitchRow,
} from '../../components/ui';
import { deleteItem, setItemAvailable, upsertItem } from '../../store/actions';
import { uid } from '../../store/defaults';
import { useStore } from '../../store/StoreProvider';
import type { MenuItem } from '../../store/types';
import { colors, stationLabel } from '../../theme';
import { formatPrice, parsePrice, priceToInput } from '../../utils/format';

interface Draft {
  id: string | null;
  name: string;
  price: string;
  categoryId: string;
  description: string;
  available: boolean;
}

export default function ArticlesScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const q = search.trim().toLowerCase();
  const sections = state.categories
    .map((c) => ({
      category: c,
      title: c.name,
      data: state.items.filter((i) => i.categoryId === c.id && (!q || i.name.toLowerCase().includes(q))),
    }))
    .filter((s) => s.data.length > 0 || !q);

  const openNew = () =>
    setDraft({
      id: null,
      name: '',
      price: '',
      categoryId: state.categories[0]?.id ?? '',
      description: '',
      available: true,
    });

  const openEdit = (item: MenuItem) =>
    setDraft({
      id: item.id,
      name: item.name,
      price: priceToInput(item.price),
      categoryId: item.categoryId,
      description: item.description,
      available: item.available,
    });

  const save = () => {
    if (!draft) return;
    const price = parsePrice(draft.price);
    if (!draft.name.trim()) return notify('Nom manquant', 'Indiquez le nom de l’article.');
    if (price === null) return notify('Prix invalide', 'Exemple de prix valide : 12,50');
    if (!draft.categoryId) return notify('Catégorie manquante', 'Choisissez une catégorie.');
    dispatch(
      upsertItem({
        id: draft.id ?? uid(),
        name: draft.name.trim(),
        price,
        categoryId: draft.categoryId,
        description: draft.description.trim(),
        available: draft.available,
      }),
    );
    setDraft(null);
  };

  if (state.categories.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Articles & prix' }} />
        <Empty icon="pricetags-outline" title="Aucune catégorie" subtitle="Créez d’abord une catégorie (Entrées, Plats, Boissons…).">
          <Button title="Gérer les catégories" onPress={() => router.push('/reglages/categories')} />
        </Empty>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'Articles & prix',
          headerRight: () => <IconButton icon="add-circle" label="Ajouter un article" color={colors.primary} size={28} onPress={openNew} />,
        }}
      />
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un article"
          placeholderTextColor={colors.muted}
          style={styles.search}
          accessibilityLabel="Rechercher un article"
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <View style={[styles.dot, { backgroundColor: section.category.color }]} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionStation}>→ {stationLabel[section.category.station]}</Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? <Text style={styles.emptySection}>Aucun article</Text> : null
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${formatPrice(item.price, state.settings.currency)}${item.available ? '' : ' · épuisé'}${item.description ? ` · ${item.description}` : ''}`}
            onPress={() => openEdit(item)}
            right={
              <Switch
                accessibilityLabel={`${item.name} disponible`}
                value={item.available}
                onValueChange={(v) => dispatch(setItemAvailable(item.id, v))}
                trackColor={{ true: colors.free, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            }
          />
        )}
        ListFooterComponent={<Button title="Ajouter un article" icon="add" onPress={openNew} style={styles.addBtn} />}
      />

      <FormModal
        visible={draft !== null}
        title={draft?.id ? 'Modifier l’article' : 'Nouvel article'}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={
          draft?.id
            ? () =>
                confirm('Supprimer l’article ?', `« ${draft.name} » sera retiré de la carte.`, () => {
                  if (draft.id) dispatch(deleteItem(draft.id));
                  setDraft(null);
                }, 'Supprimer')
            : undefined
        }
      >
        {draft ? (
          <>
            <Field label="Nom" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="ex : Burger maison" />
            <Field
              label={`Prix TTC (${state.settings.currency})`}
              value={draft.price}
              onChangeText={(price) => setDraft({ ...draft, price })}
              keyboardType="decimal-pad"
              placeholder="12,50"
            />
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chips}>
              {state.categories.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  color={c.color}
                  selected={draft.categoryId === c.id}
                  onPress={() => setDraft({ ...draft, categoryId: c.id })}
                />
              ))}
            </View>
            <Field
              label="Description (optionnel)"
              value={draft.description}
              onChangeText={(description) => setDraft({ ...draft, description })}
              placeholder="ex : servi avec frites maison"
            />
            <SwitchRow
              label="Disponible"
              hint="Désactivez si l’article est épuisé."
              value={draft.available}
              onChange={(available) => setDraft({ ...draft, available })}
            />
          </>
        ) : null}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { padding: 16, paddingBottom: 0 },
  search: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  list: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 800, alignSelf: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  sectionStation: { fontSize: 13, color: colors.muted },
  emptySection: { color: colors.muted, fontStyle: 'italic', paddingVertical: 6 },
  addBtn: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
