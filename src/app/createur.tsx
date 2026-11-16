import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { HEALTH, healthLine, LicenseSheet } from '../components/creator/LicenseSheet';
import { formatDateTime, OrderSheet } from '../components/creator/OrderSheet';
import { SettingsPanel } from '../components/creator/SettingsPanel';
import { Emoji3D } from '../components/Emoji3D';
import { planLabel, STATUS_TEXT } from '../components/PaymentFlow';
import { useToast } from '../components/Toast';
import { Button, Chip, Empty, notify, Segmented } from '../components/ui';
import { LICENSE_SERVER } from '../config';
import { type ClientFilter, confirmedPayments, dashboardStats, filterClients, licenseHealth, orderTodo, ordersToProcess } from '../license/dashboard';
import { adminApi, type Dashboard, type LicenseAction, type PaymentOrder, type ServerLicense } from '../license/server';
import { colors, fonts, screenBg } from '../theme';
import { formatPrice } from '../utils/format';
import { haptic } from '../utils/haptics';

type Tab = 'traiter' | 'clients' | 'paiements' | 'reglages';
const REFRESH_MS = 60_000;
const FILTERS: { value: ClientFilter; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'actifs', label: 'Actifs' },
  { value: 'bientot', label: 'Fin < 5 j' },
  { value: 'sans_acces', label: 'Sans accès' },
  { value: 'retires', label: 'Retirés' },
];
const ACTION_DONE: Record<LicenseAction, (days?: number) => string> = {
  revoke: () => 'Accès coupé',
  restore: () => 'Accès rendu',
  ban: () => 'Client bloqué',
  unban: () => 'Client débloqué',
  extend: (d) => `${d ?? 0} jours ajoutés`,
  lifetime: () => 'Licence passée à vie',
  expire: () => 'Abonnement terminé',
  delete: () => 'Client retiré du tableau de bord',
  undelete: () => 'Client remis dans le tableau de bord',
};
const TODO_LABEL = { verifier: 'Preuve reçue · à vérifier', generer: 'Clé à générer', envoyer: 'Clé à envoyer / en attente', attente: 'En attente du virement' } as const;

/**
 * Espace créateur : réservé au propriétaire de l'application (mot de passe vérifié par le serveur).
 * Le mot de passe reste en mémoire le temps de la visite ; il n'est jamais enregistré sur l'appareil.
 */
export default function CreatorScreen() {
  const [password, setPassword] = useState<string | null>(null);
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Espace créateur' }} />
      {password ? <CreatorDashboard password={password} onLogout={() => setPassword(null)} /> : <Login onLogin={setPassword} />}
    </View>
  );
}

function Login({ onLogin }: { onLogin: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const server = LICENSE_SERVER;

  const submit = async () => {
    if (!server) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.login(server, pw);
      haptic.success();
      onLogin(pw);
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.login} keyboardShouldPersistTaps="handled">
      <Emoji3D emoji="🛡️" size={64} />
      <Text style={styles.loginTitle}>Espace créateur</Text>
      <Text style={styles.loginText}>Paiements, clés d’activation et licences de vos clients. Accès réservé au créateur.</Text>
      {server ? (
        <>
          <TextInput
            value={pw}
            onChangeText={(t) => {
              setPw(t);
              setError(null);
            }}
            placeholder="Mot de passe"
            placeholderTextColor={colors.onDarkMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={submit}
            accessibilityLabel="Mot de passe de l’Espace créateur"
            style={styles.loginInput}
          />
          {error ? <Text style={styles.loginError}>{error}</Text> : null}
          <Button title={busy ? 'Connexion…' : 'Se connecter'} icon="log-in-outline" large onPress={submit} disabled={!pw || busy} />
        </>
      ) : (
        <Text style={styles.loginError}>
          Serveur de licences non configuré dans cette version : voir le guide de mise en service (docs/paiements.md).
        </Text>
      )}
    </ScrollView>
  );
}

function CreatorDashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const server = LICENSE_SERVER;
  const toast = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('traiter');
  const [loading, setLoading] = useState(false);
  const [openOrder, setOpenOrder] = useState<PaymentOrder | null>(null);
  const [openLicense, setOpenLicense] = useState<ServerLicense | null>(null);
  const [filter, setFilter] = useState<ClientFilter>('tous');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!server) return;
    setLoading(true);
    try {
      setData(await adminApi.dashboard(server, password));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      if (/mot de passe|bloqué/i.test(msg)) onLogout();
      notify('Espace créateur', msg);
    } finally {
      setLoading(false);
    }
  }, [server, password, onLogout]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (!server) return null;
  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const stats = dashboardStats(data);
  const act = async <T,>(fn: () => Promise<T>, done?: string): Promise<T | null> => {
    try {
      const r = await fn();
      if (done) toast(done, '✅');
      await load();
      return r;
    } catch (e) {
      notify('Action impossible', e instanceof Error ? e.message : 'Erreur');
      return null;
    }
  };
  // Les fiches ouvertes se mettent à jour avec les données rechargées.
  const liveOrder = openOrder ? (data.orders.find((o) => o.id === openOrder.id) ?? openOrder) : null;
  const liveLicense = openLicense ? (data.licenses.find((l) => l.license_id === openLicense.license_id) ?? openLicense) : null;
  const todo = ordersToProcess(data.orders);
  const clients = filterClients(data.licenses, filter, query, data.now);
  const payments = confirmedPayments(data.orders);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>TABLEAU DE BORD</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Verrouiller l’Espace créateur" onPress={onLogout} hitSlop={10}>
              <Ionicons name="lock-closed" size={20} color={colors.accent} />
            </Pressable>
          </View>
          <Text style={styles.heroTitle}>{data.billing.business_name}</Text>
          <View style={styles.kpis}>
            <Kpi value={String(stats.toProcess)} label="à traiter" accent={stats.proofs > 0} />
            <Kpi value={String(stats.activeLicenses)} label="licences actives" />
            <Kpi value={formatPrice(stats.revenueThisMonth)} label="encaissé ce mois" />
          </View>
          {stats.endingSoon || stats.expired ? (
            <Text style={styles.heroAlert}>
              {stats.endingSoon ? `🟠 ${stats.endingSoon} se termine(nt) sous 5 jours  ` : ''}
              {stats.expired ? `🔴 ${stats.expired} expirée(s)` : ''}
            </Text>
          ) : null}
        </View>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'traiter', label: `À traiter${todo.length ? ` (${todo.length})` : ''}` },
            { value: 'clients', label: 'Clients' },
            { value: 'paiements', label: 'Paiements' },
            { value: 'reglages', label: 'Réglages' },
          ]}
        />

        {tab === 'traiter' ? (
          todo.length === 0 ? (
            <Empty icon="checkmark-done" emoji="🎉" title="Rien à traiter" subtitle="Les nouvelles preuves de paiement apparaîtront ici." />
          ) : (
            todo.map((o) => <OrderRow key={o.id} order={o} note={TODO_LABEL[orderTodo(o) ?? 'attente']} onPress={() => setOpenOrder(o)} />)
          )
        ) : null}

        {tab === 'clients' ? (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher : nom, commerce, e-mail, licence…"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Rechercher un client"
              style={styles.search}
            />
            <View style={styles.filters}>
              {FILTERS.map((f) => {
                const n = filterClients(data.licenses, f.value, '', data.now).length;
                return <Chip key={f.value} label={`${f.label} (${n})`} selected={filter === f.value} onPress={() => setFilter(f.value)} />;
              })}
            </View>
          </>
        ) : null}
        {tab === 'clients' ? (
          clients.length === 0 ? (
            <Empty
              icon="people-outline"
              emoji="🙋"
              title={data.licenses.length ? 'Aucun client dans cette liste' : 'Aucun client'}
              subtitle={data.licenses.length ? 'Changez de filtre ou de recherche.' : 'Un client apparaît dès la confirmation de son premier paiement.'}
            />
          ) : (
            clients.map((l) => {
              const h = HEALTH[licenseHealth(l, data.now)];
              return (
                <Pressable key={l.license_id} accessibilityRole="button" onPress={() => setOpenLicense(l)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                  <View style={[styles.dot, { backgroundColor: h.color }]} />
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{l.customer_name || l.license_id}</Text>
                    <Text style={styles.itemSub}>
                      {l.restaurant_name ? `${l.restaurant_name} · ` : ''}
                      {healthLine(l, data.now)}
                    </Text>
                    {l.lobby ? <Text style={styles.itemNote}>👥 Équipe connectée · lobby {l.lobby.code}</Text> : null}
                  </View>
                  <Text style={[styles.chip, { color: h.color, backgroundColor: h.soft }]}>{h.label}</Text>
                </Pressable>
              );
            })
          )
        ) : null}

        {tab === 'paiements' ? (
          <>
            <View style={styles.total}>
              <Text style={styles.totalLabel}>Total encaissé</Text>
              <Text style={styles.totalValue}>{formatPrice(stats.revenueTotal)}</Text>
            </View>
            {data.orders.length === 0 ? <Empty icon="card-outline" emoji="🧾" title="Aucun paiement" /> : null}
            {data.orders.map((o) => (
              <OrderRow key={o.id} order={o} onPress={() => setOpenOrder(o)} />
            ))}
            <Text style={styles.itemSub}>{payments.length} paiement(s) confirmé(s) · 500 dernières commandes affichées.</Text>
          </>
        ) : null}

        {tab === 'reglages' ? (
          <SettingsPanel
            key={JSON.stringify(data.billing)}
            billing={data.billing}
            onSave={async (b) => {
              await act(() => adminApi.updateBilling(server, password, b), 'Réglages enregistrés');
            }}
            onChangePassword={async (next) => {
              const ok = await act(() => adminApi.changePassword(server, password, next));
              if (ok) {
                notify('Mot de passe changé', 'Reconnectez-vous avec le nouveau mot de passe.');
                onLogout();
              }
            }}
          />
        ) : null}
      </ScrollView>

      <OrderSheet
        order={liveOrder}
        onClose={() => setOpenOrder(null)}
        onConfirm={async (o, note) => {
          await act(() => adminApi.confirm(server, password, o.id, note), 'Paiement confirmé');
        }}
        onReject={async (o, note) => {
          await act(() => adminApi.reject(server, password, o.id, note), 'Paiement refusé');
        }}
        onGenerateKey={async (o) => {
          const r = await act(() => adminApi.generateKey(server, password, o.id));
          return r ? r.key : null;
        }}
      />
      <LicenseSheet
        license={liveLicense}
        orders={data.orders}
        now={data.now}
        onClose={() => setOpenLicense(null)}
        onOpenOrder={(o) => {
          setOpenLicense(null);
          setOpenOrder(o);
        }}
        onAction={async (l, action, days) => {
          const r = await act(() => adminApi.licenseAction(server, password, l.license_id, action, days), ACTION_DONE[action](days));
          // Un client retiré quitte la liste : on referme sa fiche.
          if (r && action === 'delete') setOpenLicense(null);
          return r !== null;
        }}
        onSaveInfo={async (l, info) => (await act(() => adminApi.updateClient(server, password, l.license_id, info), 'Fiche enregistrée')) !== null}
        onCloseLobby={async (l) => (await act(() => adminApi.closeClientLobby(server, password, l.license_id), 'Équipe déconnectée')) !== null}
        onGrantKey={async (l, plan) => {
          const r = await act(() => adminApi.grantKey(server, password, l.license_id, plan), 'Clé offerte créée');
          return r ? r.key : null;
        }}
      />
    </>
  );
}

function Kpi({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={[styles.kpi, accent && styles.kpiAccent]}>
      <Text style={[styles.kpiValue, accent && { color: colors.onAccent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, accent && { color: colors.onAccent }]}>{label}</Text>
    </View>
  );
}

function OrderRow({ order, note, onPress }: { order: PaymentOrder; note?: string; onPress: () => void }) {
  const st = STATUS_TEXT[order.status];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Commande ${order.reference}`} onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <Emoji3D emoji={st.emoji} size={28} />
      <View style={styles.flex}>
        <Text style={styles.itemTitle}>
          {order.customer_name} · {formatPrice(order.amount)}
        </Text>
        <Text style={styles.itemSub}>
          {order.reference} · {planLabel(order.plan)}
        </Text>
        <Text style={[styles.itemNote, { color: st.color }]}>{note ?? st.label} · {formatDateTime(order.created_at)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, ...screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 10, width: '100%', maxWidth: 820, alignSelf: 'center' },
  login: { flexGrow: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  loginTitle: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 30, color: colors.accent },
  loginText: { color: colors.onDarkMuted, textAlign: 'center', maxWidth: 340, lineHeight: 20 },
  loginInput: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.ink2,
    borderColor: colors.ink3,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.onDark,
    fontSize: 17,
  },
  loginError: { color: '#E8857C', fontWeight: '700', textAlign: 'center', maxWidth: 360 },
  hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.accentText, gap: 8 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 24 },
  heroAlert: { color: colors.onDark, fontSize: 13, fontWeight: '700' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: colors.ink2, borderRadius: 14, padding: 10 },
  kpiAccent: { backgroundColor: colors.accent },
  kpiValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 20, color: colors.onDark },
  kpiLabel: { color: colors.onDarkMuted, fontSize: 11, marginTop: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  pressed: { opacity: 0.75 },
  itemTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  itemSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  itemNote: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  search: {
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: 14, padding: 14 },
  totalLabel: { fontWeight: '800', color: colors.text },
  totalValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], fontSize: 24, color: colors.accentText },
});
