import { StyleSheet, Text, View } from 'react-native';

import { paymentLabel } from '../../labels';
import { change, type Report } from '../../store/stats';
import type { PaymentMethod } from '../../store/types';
import { colors } from '../../theme';
import { Card, Notice, SectionTitle } from '../ui';
import { BarChart } from './BarChart';
import { Kpi, ShareList } from './ReportParts';

interface Props {
  report: Report;
  previous: Report;
  format: (cents: number) => string;
}

const UNIT = { jour: 'Heure', semaine: 'Jour', mois: 'Jour', annee: 'Mois' } as const;
const PREVIOUS = { jour: 'la veille', semaine: 'la semaine précédente', mois: 'le mois précédent', annee: 'l’année précédente' } as const;

/** Rapport complet d'une période : indicateurs, graphique, TVA, paiements, serveurs, catégories, articles. */
export function ReportView({ report: r, previous, format: p }: Props) {
  const share = (v: number, total: number) => (total ? v / total : 0);
  const paid = r.revenue + r.tips;
  const rates = Object.keys(r.vatByRate).sort((a, b) => Number(a) - Number(b));
  const maxQty = Math.max(1, ...r.topItems.map((i) => i.qty));

  return (
    <View style={styles.wrap}>
      <View style={styles.kpis}>
        <Kpi emoji="💰" label="Chiffre d’affaires TTC" value={p(r.revenue)} delta={change(r.revenue, previous.revenue)} />
        <Kpi emoji="🧾" label="Tickets" value={String(r.count)} delta={change(r.count, previous.count)} />
      </View>
      <View style={styles.kpis}>
        <Kpi emoji="📊" label="Ticket moyen" value={p(r.average)} delta={change(r.average, previous.average)} />
        <Kpi emoji="🪑" label="Couverts" value={String(r.guests)} delta={change(r.guests, previous.guests)} />
      </View>
      <View style={styles.kpis}>
        <Kpi emoji="📒" label="Chiffre d’affaires HT" value={p(r.revenue - r.vat)} />
        <Kpi emoji="🏛️" label="TVA collectée" value={p(r.vat)} />
      </View>
      <View style={styles.kpis}>
        <Kpi emoji="💝" label="Pourboires" value={p(r.tips)} />
        <Kpi emoji="🍽️" label="Moyenne par couvert" value={p(r.perGuest)} />
      </View>
      <Text style={styles.compare}>
        Comparaison avec {PREVIOUS[r.period.kind]} ({p(previous.revenue)}). Remises : {p(r.discounts)} · annulations : {r.cancelled}.
      </Text>

      {r.closureDays ? (
        <Notice title="Jours repris des clôtures">
          {r.closureDays} jour(s) de la période viennent des clôtures Z (tickets effacés) : montants complets, sans détail par
          heure, serveur ou article.
        </Notice>
      ) : null}

      <SectionTitle>Chiffre d’affaires par {UNIT[r.period.kind].toLowerCase()}</SectionTitle>
      <Card>
        <BarChart buckets={r.buckets} best={r.bestBucket} format={p} unit={UNIT[r.period.kind]} />
      </Card>

      <SectionTitle>Encaissé par moyen de paiement</SectionTitle>
      <Card>
        <ShareList
          empty="Aucun encaissement"
          rows={(Object.keys(paymentLabel) as PaymentMethod[]).map((m) => ({
            key: m,
            label: paymentLabel[m],
            value: p(r.byPayment[m]),
            share: share(r.byPayment[m], paid),
          }))}
        />
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total encaissé (pourboires compris)</Text>
          <Text style={styles.totalValue}>{p(paid)}</Text>
        </View>
      </Card>

      <SectionTitle>TVA par taux</SectionTitle>
      <Card style={styles.card}>
        {rates.length === 0 ? <Text style={styles.muted}>Aucune TVA sur la période</Text> : null}
        {rates.map((rate) => (
          <View key={rate} style={styles.kv}>
            <Text style={styles.k}>TVA {rate.replace('.', ',')} %</Text>
            <Text style={styles.v}>{p(r.vatByRate[rate])}</Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Par serveur</SectionTitle>
      <Card>
        <ShareList
          empty="Aucune vente"
          rows={r.byServer.map((s) => ({
            key: s.name,
            label: s.name,
            value: p(s.revenue),
            share: share(s.revenue, r.revenue),
            sub: `${s.count} ticket(s)${s.tips ? ` · pourboires ${p(s.tips)}` : ''}`,
          }))}
        />
      </Card>

      <SectionTitle>Par catégorie (HT, avant remise)</SectionTitle>
      <Card>
        <ShareList
          empty="Aucune vente"
          rows={r.byCategory.map((c) => ({
            key: c.name,
            label: `${c.emoji} ${c.name}`,
            value: p(c.revenue),
            share: share(c.revenue, Math.max(1, ...r.byCategory.map((x) => x.revenue))),
            sub: `${c.qty} article(s)`,
          }))}
        />
      </Card>

      <SectionTitle>Meilleures ventes</SectionTitle>
      <Card>
        <ShareList
          empty="Aucune vente"
          rows={r.topItems.map((i, idx) => ({
            key: i.name,
            label: `${idx + 1}. ${i.name}`,
            value: `× ${i.qty}`,
            share: i.qty / maxQty,
            sub: p(i.total),
          }))}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  kpis: { flexDirection: 'row', gap: 10, marginTop: 10 },
  compare: { color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  card: { gap: 10 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  k: { color: colors.text, fontSize: 15 },
  v: { color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 12,
  },
  totalLabel: { color: colors.text, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  totalValue: { color: colors.text, fontWeight: '800', fontSize: 15 },
});
