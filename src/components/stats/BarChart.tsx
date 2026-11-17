import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Bucket } from '../../store/stats';
import { colors } from '../../theme';

interface Props {
  buckets: Bucket[];
  best: Bucket | null;
  format: (cents: number) => string;
  /** Unité d'une barre pour l'accessibilité (« heure », « jour », « mois »). */
  unit: string;
}

const HEIGHT = 150;

/** Graphique en barres du chiffre d'affaires (une seule série). Toucher une barre affiche sa valeur. */
export function BarChart({ buckets, best, format, unit }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.revenue));
  const picked = buckets.find((b) => b.key === selected) ?? null;
  const shown = picked ?? best;
  // Étiquettes de l'axe : une sur deux ou sur trois quand les barres sont nombreuses.
  const every = buckets.length > 24 ? 5 : buckets.length > 12 ? 3 : 1;

  return (
    <View>
      <Text style={styles.readout} accessibilityLiveRegion="polite">
        {shown
          ? `${picked ? '' : 'Meilleur moment · '}${shown.label} : ${format(shown.revenue)} · ${shown.count} ticket${shown.count > 1 ? 's' : ''}`
          : 'Aucune vente sur la période'}
      </Text>
      <View style={styles.plot}>
        <View style={[styles.grid, { bottom: HEIGHT / 2 }]} />
        {buckets.map((b) => {
          const h = b.revenue ? Math.max(3, Math.round((b.revenue / max) * HEIGHT)) : 0;
          const active = b.key === (shown?.key ?? '');
          return (
            <Pressable
              key={b.key}
              accessibilityRole="button"
              accessibilityLabel={`${unit} ${b.label} : ${format(b.revenue)}, ${b.count} tickets`}
              onPress={() => setSelected(b.key === selected ? null : b.key)}
              style={styles.col}
            >
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: active ? colors.accentLight : colors.accent, opacity: shown && !active ? 0.55 : 1 },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {buckets.map((b, i) => (
          <Text key={b.key} style={styles.tick} numberOfLines={1}>
            {i % every === 0 ? b.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 10, minHeight: 20 },
  plot: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.line },
  // Colonne entière cliquable (cible plus grande que la barre), 2 px d'écart entre les barres.
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', marginTop: 4 },
  tick: { flex: 1, color: colors.muted, fontSize: 9, textAlign: 'center' },
});
