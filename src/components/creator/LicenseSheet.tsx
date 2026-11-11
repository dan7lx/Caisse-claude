import { Pressable, StyleSheet, Text, View } from 'react-native';

import { daysLeft, type LicenseHealth, licenseHealth } from '../../license/dashboard';
import type { PaymentOrder, ServerLicense } from '../../license/server';
import { colors } from '../../theme';
import { formatPrice } from '../../utils/format';
import { formatLongDate } from '../PaymentCalendar';
import { planLabel, STATUS_TEXT } from '../PaymentFlow';
import { Button, confirm, FormModal } from '../ui';
import { formatDateTime, openWhatsApp } from './OrderSheet';

export const HEALTH: Record<LicenseHealth, { label: string; color: string; soft: string }> = {
  vie: { label: 'À vie', color: colors.goldDeep, soft: colors.goldSoft },
  active: { label: 'Active', color: colors.free, soft: colors.freeSoft },
  bientot: { label: 'Fin sous 5 jours', color: '#C26A0A', soft: '#FCE2C4' },
  expiree: { label: 'Expirée', color: colors.danger, soft: colors.dangerSoft },
  revoquee: { label: 'Révoquée', color: colors.muted, soft: colors.line },
  aucune: { label: 'Pas encore activée', color: colors.busy, soft: colors.busySoft },
};

export function healthLine(l: ServerLicense, now: number): string {
  const h = licenseHealth(l, now);
  if (h === 'vie') return 'Licence à vie';
  if (h === 'revoquee') return 'Accès coupé par vous';
  if (h === 'aucune') return 'En attente d’activation de la clé';
  if (l.valid_until === null) return '';
  return h === 'expiree' ? `Terminée le ${formatLongDate(l.valid_until)}` : `Jusqu’au ${formatLongDate(l.valid_until)} · ${daysLeft(l, now)} j`;
}

interface Props {
  license: ServerLicense | null;
  orders: PaymentOrder[];
  now: number;
  onClose: () => void;
  onOpenOrder: (o: PaymentOrder) => void;
  onAction: (l: ServerLicense, action: 'revoke' | 'restore') => Promise<void>;
}

/** Fiche d'un client : licence, historique de ses paiements, contact, révocation. */
export function LicenseSheet({ license, orders, now, onClose, onOpenOrder, onAction }: Props) {
  if (!license) return null;
  const h = HEALTH[licenseHealth(license, now)];
  const mine = orders.filter((o) => o.license_id === license.license_id);
  const paid = mine.filter((o) => o.status === 'confirmee').reduce((s, o) => s + o.amount, 0);

  return (
    <FormModal visible title={license.customer_name || license.license_id} onClose={onClose}>
      <View style={[styles.health, { backgroundColor: h.soft, borderColor: h.color }]}>
        <Text style={[styles.healthLabel, { color: h.color }]}>{h.label}</Text>
        <Text style={styles.healthLine}>{healthLine(license, now)}</Text>
      </View>
      <View style={styles.box}>
        <Row label="Commerce" value={license.restaurant_name || '—'} />
        <Row label="E-mail" value={license.email || '—'} />
        <Row label="WhatsApp" value={license.phone || '—'} />
        <Row label="Licence" value={license.license_id} />
        <Row label="Activations" value={String(license.activations)} />
        <Row label="Total payé" value={formatPrice(paid)} />
      </View>
      {license.phone ? <Button title="Écrire sur WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => openWhatsApp(license.phone)} /> : null}

      <Text style={styles.section}>Historique des paiements</Text>
      {mine.length === 0 ? <Text style={styles.muted}>Aucune commande.</Text> : null}
      {mine.map((o) => {
        const st = STATUS_TEXT[o.status];
        return (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => onOpenOrder(o)} style={styles.order}>
            <View style={styles.flex}>
              <Text style={styles.orderTitle}>
                {o.reference} · {formatPrice(o.amount)}
              </Text>
              <Text style={styles.muted}>
                {planLabel(o.plan)} · {formatDateTime(o.created_at)}
              </Text>
            </View>
            <Text style={[styles.badge, { color: st.color, backgroundColor: st.soft }]}>{st.emoji}</Text>
          </Pressable>
        );
      })}

      {license.revoked ? (
        <Button title="Rétablir l’accès" icon="lock-open" onPress={() => onAction(license, 'restore')} />
      ) : (
        <Button
          title="Révoquer (couper l’accès)"
          icon="lock-closed"
          variant="danger"
          onPress={() =>
            confirm(
              'Révoquer cette licence ?',
              'L’application de ce client sera bloquée à sa prochaine connexion, sur tous ses appareils.',
              () => onAction(license, 'revoke'),
              'Révoquer',
            )
          }
        />
      )}
    </FormModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  health: { borderRadius: 14, borderWidth: 1, padding: 12 },
  healthLabel: { fontWeight: '900', fontSize: 16 },
  healthLine: { color: colors.text, marginTop: 2 },
  box: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  section: { fontWeight: '900', color: colors.goldDeep, letterSpacing: 1, fontSize: 12, marginTop: 6 },
  muted: { color: colors.muted, fontSize: 12 },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  orderTitle: { fontWeight: '700', color: colors.text },
  badge: { fontSize: 16, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
});
