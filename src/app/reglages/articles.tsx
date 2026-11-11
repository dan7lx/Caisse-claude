import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Emoji3D } from '../../components/Emoji3D';
import { EmojiPicker } from '../../components/EmojiPicker';
import { ManagerGate } from '../../components/ManagerGate';
import { useToast } from '../../components/Toast';
import {
  Button,
  Chip,
  confirm,
  Empty,
  Field,
  FormModal,
  IconButton,
  notify,
  SwitchRow,
} from '../../components/ui';
import { deleteItem, moveItem, setItemAvailable, upsertItem } from '../../store/actions';
import { ALLERGENS, COOKING_CHOICES, uid } from '../../store/defaults';
import { useStore } from '../../store/StoreProvider';
import type { MenuItem } from '../../store/types';
import { colors, fonts, stationLabel } from '../../theme';
import { formatPrice, parsePrice, priceToInput } from '../../utils/format';

interface Draft {
  id: string | null;
  name: string;
  price: string;
  categoryId: string;
  description: string;
  available: boolean;
  emoji: string;
  choices: string[];
  allergens: string[];
}

const ALL = '__all__';

function ArticlesScreen() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newChoice, setNewChoice] = useState('');

  const q = search.trim().toLowerCase();
  const sections = state.categories
    .filter((c) => filter === ALL || c.id === filter)
    .map((c) => ({
      category: c,
      title: c.name,
      data: state.items.filter((i) => i.categoryId === c.id && (!q || i.name.toLowerCase().includes(q))),
    }))
    .filter((s) => s.data.length > 0 || !q);

  const openNew = (categoryId?: string) =>
    setDraft({
      id: null,
      name: '',
      price: '',
      categoryId: categoryId ?? (filter !== ALL ? filter : state.categories[0]?.id ?? ''),
      description: '',
      available: true,
      emoji: '',
      choices: [],
      allergens: [],
    });

  const toDraft = (item: MenuItem, asCopy = false): Draft => ({
    id: asCopy ? null : item.id,
    name: asCopy ? `${item.name} (copie)` : item.name,
    price: priceToInput(item.price),
    categoryId: item.categoryId,
    description: item.description,
    available: item.available,
    emoji: item.emoji,
    choices: [...item.choices],
    allergens: [...item.allergens],
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
        emoji: draft.emoji,
        choices: draft.choices,
        allergens: draft.allergens,
      }),
    );
    toast(draft.id ? 'Article modifié' : 'Article ajouté à la carte', '✅');
    setDraft(null);
  };

  const addChoice = () => {
    const c = newChoice.trim();
    if (!draft || !c || draft.choices.includes(c)) return;
    setDraft({ ...draft, choices: [...draft.choices, c] });
    setNewChoice('');
  };

  if (state.categories.length === 0) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'La carte' }} />
        <Empty icon="pricetags-outline" emoji="🏷️" title="Aucune catégorie" subtitle="Créez d’abord une catégorie (Entrées, Plats, Boissons…).">
          <Button title="Gérer les catégories" onPress={() => router.push('/reglages/categories')} />
        </Empty>
      </View>
    );
  }

  const categoryOf = new Map(state.categories.map((c) => [c.id, c]));
  const draftCategory = draft ? categoryOf.get(draft.categoryId) : undefined;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: 'La carte',
          headerRight: () => (
            <IconButton icon="add-circle" label="Ajouter un article" color={colors.gold} size={30} onPress={() => openNew()} style={styles.headerBtn} />
          ),
        }}
      />
      <View style={styles.top}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="🔍  Rechercher un article"
          placeholderTextColor={colors.muted}
          style={styles.search}
          accessibilityLabel="Rechercher un article"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label={`Tout (${state.items.length})`} selected={filter === ALL} onPress={() => setFilter(ALL)} />
          {state.categories.map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === c.id }}
              onPress={() => setFilter(c.id)}
              style={[styles.filter, filter === c.id && { backgroundColor: c.color, borderColor: c.color }]}
            >
              <Emoji3D emoji={c.emoji} size={20} />
              <Text style={[styles.filterText, filter === c.id && { color: '#FFFFFF' }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Emoji3D emoji={section.category.emoji} size={30} />
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionStation}>
                {section.data.length} article(s) · envoyé {section.category.station === 'bar' ? 'au bar' : 'en cuisine'}
              </Text>
            </View>
            <Button title="Ajouter" icon="add" small variant="secondary" onPress={() => openNew(section.category.id)} />
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? <Text style={styles.emptySection}>Aucun article dans cette catégorie.</Text> : null
        }
        renderItem={({ item, index, section }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Modifier ${item.name}`}
            onPress={() => setDraft(toDraft(item))}
            android_ripple={{ color: colors.goldSoft }}
            style={({ pressed }) => [
              styles.item,
              index === 0 && styles.itemFirst,
              index === section.data.length - 1 && styles.itemLast,
              pressed && styles.itemPressed,
            ]}
          >
            <View style={[styles.itemEmoji, !item.available && styles.dim]}>
              <Emoji3D emoji={item.emoji || section.category.emoji} size={34} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.itemName, !item.available && styles.strike]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.tags}>
                <Text style={styles.itemPrice}>{formatPrice(item.price, state.settings.currency)}</Text>
                {item.choices.length ? <Text style={styles.tag}>{item.choices.length} choix</Text> : null}
                {item.allergens.length ? <Text style={[styles.tag, styles.tagWarn]}>⚠ {item.allergens.length} allergène(s)</Text> : null}
                {!item.available ? <Text style={[styles.tag, styles.tagOff]}>Épuisé</Text> : null}
              </View>
            </View>
            <Switch
              accessibilityLabel={`${item.name} disponible`}
              value={item.available}
              onValueChange={(v) => dispatch(setItemAvailable(item.id, v))}
              trackColor={{ true: colors.free, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </Pressable>
        )}
        ListFooterComponent={<Button title="Ajouter un article" icon="add" onPress={() => openNew()} style={styles.addBtn} />}
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
                  toast('Article supprimé', '🗑️');
                }, 'Supprimer')
            : undefined
        }
      >
        {draft ? (
          <>
            <EmojiPicker value={draft.emoji} inherited={draftCategory?.emoji ?? '🍽️'} onChange={(emoji) => setDraft({ ...draft, emoji })} />
            <Field label="Nom" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="ex : Burger maison" />
            <Field
              label={`Prix HTVA (${state.settings.currency})`}
              value={draft.price}
              onChangeText={(price) => setDraft({ ...draft, price })}
              keyboardType="decimal-pad"
              placeholder="12,50"
            />
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.chips}>
              {state.categories.map((c) => (
                <Chip key={c.id} label={`${c.name} · ${stationLabel[c.station]}`} color={c.color} selected={draft.categoryId === c.id} onPress={() => setDraft({ ...draft, categoryId: c.id })} />
              ))}
            </View>
            <Field
              label="Description (optionnel)"
              value={draft.description}
              onChangeText={(description) => setDraft({ ...draft, description })}
              placeholder="ex : servi avec frites maison"
            />

            <Text style={styles.label}>Choix à la commande</Text>
            <Text style={styles.hint}>Le serveur devra choisir une option (ex. cuisson) en ajoutant l’article.</Text>
            <View style={styles.chips}>
              {draft.choices.map((c) => (
                <Chip
                  key={c}
                  label={`${c}  ✕`}
                  selected
                  color={colors.goldDeep}
                  onPress={() => setDraft({ ...draft, choices: draft.choices.filter((x) => x !== c) })}
                />
              ))}
              {draft.choices.length === 0 ? (
                <Chip label="+ Cuissons" icon="flame-outline" onPress={() => setDraft({ ...draft, choices: [...COOKING_CHOICES] })} />
              ) : null}
            </View>
            <View style={styles.row}>
              <TextInput
                value={newChoice}
                onChangeText={setNewChoice}
                onSubmitEditing={addChoice}
                placeholder="Ajouter un choix (ex : Sans sauce)"
                placeholderTextColor="#A99E90"
                style={styles.input}
                accessibilityLabel="Ajouter un choix"
              />
              <Button title="Ajouter" small onPress={addChoice} disabled={!newChoice.trim()} />
            </View>

            <Text style={styles.label}>Allergènes</Text>
            <View style={styles.chips}>
              {ALLERGENS.map((a) => {
                const on = draft.allergens.includes(a);
                return (
                  <Chip
                    key={a}
                    label={a}
                    selected={on}
                    color={colors.danger}
                    onPress={() =>
                      setDraft({ ...draft, allergens: on ? draft.allergens.filter((x) => x !== a) : [...draft.allergens, a] })
                    }
                  />
                );
              })}
            </View>

            <SwitchRow
              label="Disponible"
              hint="Désactivez si l’article est épuisé : il reste visible mais ne peut plus être commandé."
              value={draft.available}
              onChange={(available) => setDraft({ ...draft, available })}
            />

            {draft.id ? (
              <View style={styles.tools}>
                <Button
                  title="Dupliquer"
                  icon="copy-outline"
                  small
                  variant="secondary"
                  onPress={() => {
                    const original = state.items.find((i) => i.id === draft.id);
                    if (original) setDraft(toDraft(original, true));
                  }}
                />
                <Button title="Monter" icon="arrow-up" small variant="secondary" onPress={() => draft.id && dispatch(moveItem(draft.id, -1))} />
                <Button title="Descendre" icon="arrow-down" small variant="secondary" onPress={() => draft.id && dispatch(moveItem(draft.id, 1))} />
              </View>
            ) : null}
          </>
        ) : null}
      </FormModal>
    </View>
  );
}

export default function ArticlesRoute() {
  return (
    <ManagerGate>
      <ArticlesScreen />
    </ManagerGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  headerBtn: { marginRight: 12 },
  top: { paddingTop: 12, gap: 10, width: '100%', maxWidth: 820, alignSelf: 'center' },
  search: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  filters: { gap: 8, paddingHorizontal: 16 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterText: { fontWeight: '700', color: colors.text },
  list: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 21, color: colors.text },
  sectionStation: { fontSize: 12, color: colors.muted },
  emptySection: { color: colors.muted, fontStyle: 'italic', paddingVertical: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
  },
  itemFirst: { borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  itemLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  itemPressed: { backgroundColor: colors.goldSoft },
  itemEmoji: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.4 },
  itemName: { fontSize: 16, fontWeight: '700', color: colors.text },
  strike: { textDecorationLine: 'line-through', color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 },
  itemPrice: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 15, color: colors.goldDeep },
  tag: { fontSize: 11, fontWeight: '700', color: colors.goldDeep, backgroundColor: colors.goldSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  tagWarn: { color: colors.danger, backgroundColor: colors.dangerSoft },
  tagOff: { color: colors.muted, backgroundColor: colors.line },
  addBtn: { marginTop: 24 },
  label: { fontSize: 14, fontWeight: '700', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: -8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: colors.text,
  },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
