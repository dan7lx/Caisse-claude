import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { daysLeft, hasAccess, type LicenseHealth, licenseHealth } from '../../license/dashboard';
import { type ClientInfo, keyWhatsAppLink, type LicenseAction, type PaymentOrder, type PayPlan, type ServerLicense } from '../../license/server';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';
import { formatLongDate } from '../PaymentCalendar';
import { planLabel, STATUS_TEXT } from '../PaymentFlow';
import { useToast } from '../Toast';
import { Button, confirm, Field, FormModal, notify } from '../ui';
import { formatDateTime, openWhatsApp } from './OrderSheet';

export const HEALTH: Record<LicenseHealth, { label: string; color: string; soft: string }> = {
  vie: { label: 'À vie', color: colors.accentText, soft: colors.accentSoft },
  active: { label: 'Active', color: colors.free, soft: colors.freeSoft },
  bientot: { label: 'Fin sous 5 jours', color: '#FF9438', soft: 'rgba(255, 148, 56, 0.2)' },
  expiree: { label: 'Expirée', color: colors.danger, soft: colors.dangerSoft },
  revoquee: { label: 'Accès coupé', color: colors.muted, soft: colors.line },
  bloquee: { label: 'Bloqué', color: colors.danger, soft: colors.dangerSoft },
  aucune: { label: 'Pas encore activée', color: colors.busy, soft: colors.busySoft },
};

export function healthLine(l: ServerLicense, now: number): string {
  const h = licenseHealth(l, now);
  if (h === 'vie') return 'Licence à vie';
  if (h === 'bloquee') return 'Bloqué : aucun accès, aucune commande possible';
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
  onAction: (l: ServerLicense, action: LicenseAction, days?: number) => Promise<boolean>;
  onSaveInfo: (l: ServerLicense, info: ClientInfo) => Promise<boolean>;
  onCloseLobby: (l: ServerLicense) => Promise<boolean>;
  onGrantKey: (l: ServerLicense, plan: PayPlan) => Promise<string | null>;
}

/** Fiche de contrôle d'un client : abonnement, accès, équipe, fiche, clé offerte, historique, suppression. */
export function LicenseSheet(props: Props) {
  const { license, onClose } = props;
  if (!license) return null;
  // La clé `license_id` remet la fiche à zéro quand on ouvre un autre client.
  return <ClientPanel key={license.license_id} {...props} license={license} onClose={onClose} />;
}

function ClientPanel({ license, orders, now, onClose, onOpenOrder, onAction, onSaveInfo, onCloseLobby, onGrantKey }: Props & { license: ServerLicense }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState<ClientInfo>({
    customer_name: license.customer_name,
    restaurant_name: license.restaurant_name,
    email: license.email,
    phone: license.phone,
    note: license.note ?? '',
  });
  const [gift, setGift] = useState<{ key: string; plan: PayPlan } | null>(null);
  const [busy, setBusy] = useState(false);
  const h = HEALTH[licenseHealth(license, now)];
  const mine = orders.filter((o) => o.license_id === license.license_id);
  const paid = mine.filter((o) => o.status === 'confirmee').reduce((s, o) => s + o.amount, 0);
  const access = hasAccess(license, now);
  const lifetime = license.plan === 'vie';
  const name = license.customer_name || license.license_id;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const action = (a: LicenseAction, title: string, message: string, label: string, days?: number) =>
    confirm(title, message, () => run(() => onAction(license, a, days)), label);
  // Message WhatsApp de la clé offerte : mêmes informations qu'une commande.
  const giftOrder = gift
    ? ({ customer_name: name, phone: license.phone, plan: gift.plan, reference: 'clé offerte' } as PaymentOrder)
    : null;

  return (
    <FormModal visible title={name} onClose={onClose}>
      <View style={[styles.health, { backgroundColor: h.soft, borderColor: h.color }]}>
        <Text style={[styles.healthLabel, { color: h.color }]}>{h.label}</Text>
        <Text style={styles.healthLine}>{healthLine(license, now)}</Text>
        {license.deleted_at ? <Text style={styles.healthLine}>Retiré du tableau de bord le {formatDateTime(license.deleted_at)}</Text> : null}
      </View>

      {license.deleted_at ? (
        <Button title="Remettre dans le tableau de bord" icon="arrow-undo-outline" disabled={busy} onPress={() => run(() => onAction(license, 'undelete'))} />
      ) : null}

      {/* Fiche client */}
      <Text style={styles.section}>FICHE CLIENT</Text>
      {editing ? (
        <View style={styles.box}>
          <Field label="Prénom et nom" value={info.customer_name} onChangeText={(v) => setInfo({ ...info, customer_name: v })} />
          <Field label="Commerce" value={info.restaurant_name} onChangeText={(v) => setInfo({ ...info, restaurant_name: v })} />
          <Field label="E-mail" value={info.email} onChangeText={(v) => setInfo({ ...info, email: v })} autoCapitalize="none" keyboardType="email-address" />
          <Field label="WhatsApp" value={info.phone} onChangeText={(v) => setInfo({ ...info, phone: v })} keyboardType="phone-pad" />
          <Field label="Note interne (visible par vous seul)" value={info.note} onChangeText={(v) => setInfo({ ...info, note: v })} multiline />
          <View style={styles.row}>
            <Button title="Annuler" variant="secondary" onPress={() => setEditing(false)} style={styles.flex} />
            <Button
              title="Enregistrer"
              icon="checkmark"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  if (await onSaveInfo(license, info)) setEditing(false);
                })
              }
              style={styles.flex}
            />
          </View>
        </View>
      ) : (
        <View style={styles.box}>
          <Row label="Commerce" value={license.restaurant_name || '—'} />
          <Row label="E-mail" value={license.email || '—'} />
          <Row label="WhatsApp" value={license.phone || '—'} />
          <Row label="Licence" value={license.license_id} />
          <Row label="Client depuis" value={formatDateTime(license.created_at)} />
          <Row label="Activations" value={String(license.activations)} />
          <Row label="Total payé" value={formatPrice(paid)} />
          {license.note ? <Text style={styles.note}>📝 {license.note}</Text> : null}
          <View style={styles.row}>
            <Button title="Modifier la fiche" icon="create-outline" small variant="secondary" onPress={() => setEditing(true)} style={styles.flex} />
            {license.phone ? (
              <Button title="WhatsApp" icon="logo-whatsapp" small variant="secondary" onPress={() => openWhatsApp(license.phone)} style={styles.flex} />
            ) : null}
          </View>
        </View>
      )}

      {/* Abonnement */}
      <Text style={styles.section}>ABONNEMENT</Text>
      <View style={styles.box}>
        <View style={styles.grid}>
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              title={`+${d} jours`}
              icon="add-circle-outline"
              small
              variant="secondary"
              disabled={busy || lifetime || !!license.banned}
              onPress={() => action('extend', `Offrir ${d} jours ?`, `${d} jours sont ajoutés à l’abonnement de ${name} (à la suite s’il est encore actif).`, 'Ajouter', d)}
              style={styles.cell}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Button
            title="Passer à vie"
            icon="diamond-outline"
            small
            variant="secondary"
            disabled={busy || lifetime || !!license.banned}
            onPress={() => action('lifetime', 'Passer à vie ?', `${name} n’aura plus jamais d’échéance.`, 'Passer à vie')}
            style={styles.flex}
          />
          <Button
            title="Terminer maintenant"
            icon="stop-circle-outline"
            small
            variant="secondary"
            disabled={busy || !access}
            onPress={() =>
              action('expire', 'Terminer l’abonnement maintenant ?', `L’application de ${name} demandera un nouveau paiement à sa prochaine vérification.`, 'Terminer')
            }
            style={styles.flex}
          />
        </View>
        <Text style={styles.hint}>Vos changements s’appliquent sur les appareils du client en 10 minutes au plus, ou dès qu’il rouvre l’app.</Text>
        {gift ? (
          <View style={styles.keyBox}>
            <Text style={styles.keyLabel}>CLÉ OFFERTE (affichée une seule fois)</Text>
            <Text style={styles.key} selectable>
              {gift.key}
            </Text>
            <View style={styles.row}>
              <Button
                title="Copier"
                icon="copy-outline"
                small
                onPress={() => Clipboard.setStringAsync(gift.key).then(() => toast('Clé copiée', '📋')).catch(() => undefined)}
                style={styles.flex}
              />
              {giftOrder && license.phone ? (
                <Button
                  title="Envoyer"
                  icon="logo-whatsapp"
                  small
                  variant="success"
                  onPress={() => Linking.openURL(keyWhatsAppLink(giftOrder, gift.key)).catch(() => notify('WhatsApp', gift.key))}
                  style={styles.flex}
                />
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            {(['mensuel', 'vie'] as PayPlan[]).map((p) => (
              <Button
                key={p}
                title={p === 'vie' ? 'Clé offerte à vie' : 'Clé offerte 30 j'}
                icon="gift-outline"
                small
                variant="secondary"
                disabled={busy || !!license.banned}
                onPress={() =>
                  confirm('Créer une clé offerte ?', `Une clé « ${planLabel(p)} » gratuite est créée pour ${name}.`, () =>
                    run(async () => {
                      const key = await onGrantKey(license, p);
                      if (key) setGift({ key, plan: p });
                    }),
                  'Créer')
                }
                style={styles.flex}
              />
            ))}
          </View>
        )}
      </View>

      {/* Accès et équipe */}
      <Text style={styles.section}>ACCÈS ET ÉQUIPE</Text>
      <View style={styles.box}>
        {license.lobby ? (
          <>
            <Row label="Lobby ouvert" value={`${license.lobby.code} · depuis ${formatDateTime(license.lobby.created_at)}`} />
            <Button
              title="Déconnecter toute son équipe"
              icon="people-circle-outline"
              small
              variant="secondary"
              disabled={busy}
              onPress={() => confirm('Fermer son lobby ?', 'Tous ses employés seront déconnectés dans les secondes qui suivent.', () => run(() => onCloseLobby(license)), 'Fermer')}
            />
          </>
        ) : (
          <Text style={styles.hint}>Aucun lobby d’équipe ouvert.</Text>
        )}
        {license.revoked && !license.banned ? (
          <Button title="Rendre l’accès" icon="lock-open-outline" disabled={busy} onPress={() => run(() => onAction(license, 'restore'))} />
        ) : !license.banned ? (
          <Button
            title="Couper l’accès"
            icon="lock-closed-outline"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              action('revoke', 'Couper l’accès ?', `L’application de ${name} se bloque à sa prochaine vérification. Il pourra payer à nouveau pour revenir.`, 'Couper')
            }
          />
        ) : null}
        {license.banned ? (
          <Button title="Débloquer" icon="checkmark-circle-outline" disabled={busy} onPress={() => run(() => onAction(license, 'unban'))} />
        ) : (
          <Button
            title="Bloquer ce client"
            icon="ban-outline"
            variant="danger"
            disabled={busy}
            onPress={() =>
              action(
                'ban',
                'Bloquer ce client ?',
                'Accès coupé, commandes en attente annulées, équipe déconnectée, et plus aucun paiement ni activation possible tant que vous ne le débloquez pas.',
                'Bloquer',
              )
            }
          />
        )}
      </View>

      {/* Historique */}
      <Text style={styles.section}>HISTORIQUE DES PAIEMENTS</Text>
      {mine.length === 0 ? <Text style={styles.hint}>Aucune commande.</Text> : null}
      {mine.map((o) => {
        const st = STATUS_TEXT[o.status];
        return (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => onOpenOrder(o)} style={styles.order}>
            <View style={styles.flex}>
              <Text style={styles.orderTitle}>
                {o.reference} · {o.amount ? formatPrice(o.amount) : 'offert'}
              </Text>
              <Text style={styles.hint}>
                {planLabel(o.plan)} · {formatDateTime(o.created_at)}
              </Text>
            </View>
            <Text style={[styles.badge, { color: st.color, backgroundColor: st.soft }]}>{st.emoji}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        );
      })}

      {/* Retirer */}
      {!license.deleted_at ? (
        <>
          <Text style={styles.section}>TABLEAU DE BORD</Text>
          <Button
            title="Retirer ce client du tableau de bord"
            icon="trash-outline"
            variant="ghost"
            disabled={busy || access}
            onPress={() =>
              action(
                'delete',
                'Retirer ce client ?',
                'Il disparaît de vos listes (vous le retrouvez dans « Retirés »). Son accès reste coupé et son équipe est déconnectée. Ses paiements restent dans l’historique.',
                'Retirer',
              )
            }
          />
          {access ? <Text style={styles.hint}>Coupez l’accès ou bloquez le client avant de pouvoir le retirer.</Text> : null}
        </>
      ) : null}
    </FormModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  grid: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  health: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 2 },
  healthLabel: { fontWeight: '900', fontSize: 16 },
  healthLine: { color: colors.text },
  section: { fontWeight: '900', color: colors.accentText, letterSpacing: 1.5, fontSize: 11, marginTop: 6 },
  box: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  kvLabel: { color: colors.muted, fontSize: 13 },
  kvValue: { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  note: { color: colors.text, fontSize: 13, lineHeight: 19, backgroundColor: colors.field, borderRadius: 10, padding: 10 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  keyBox: { backgroundColor: colors.ink, borderRadius: 14, padding: 12, gap: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.accent },
  keyLabel: { color: colors.accentText, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  key: { fontFamily: fonts.displayHeavy, color: colors.onDark, fontSize: 21, letterSpacing: 2 },
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
