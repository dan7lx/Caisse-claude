import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCreatorCode } from '../../components/CreatorGate';
import { Emoji3D } from '../../components/Emoji3D';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SupportCard } from '../../components/SupportCard';
import { ManagerGate } from '../../components/ManagerGate';
import { formatLongDate } from '../../components/PaymentCalendar';
import { useToast } from '../../components/Toast';
import { Button, confirm, Group, IconButton, ListRow, PinPad, SectionTitle } from '../../components/ui';
import { identifyCode } from '../../license/access';
import { formatCountdown, hashManagerPin, licenseStatus } from '../../license/license';
import { resetDemo, setManagerPin, wipeAll } from '../../store/actions';
import { openOrders, salesStats, startOfDay } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import { colors, fonts } from '../../theme';
import { formatPrice } from '../../utils/format';
import { useLayout } from '../../utils/layout';

export default function ManagementTab() {
  return (
    <ManagerGate>
      <ManagementScreen />
    </ManagerGate>
  );
}

type PinStep = null | 'current' | 'new' | 'confirm';

function ManagementScreen() {
  const { state, device, session, setSession, dispatch } = useStore();
  const creator = useCreatorCode();
  const router = useRouter();
  const toast = useToast();
  const { small, phone } = useLayout();
  const [pinStep, setPinStep] = useState<PinStep>(null);
  const [newPin, setNewPin] = useState('');

  const today = salesStats(state.orders.filter((o) => (o.paidAt ?? 0) >= startOfDay()));
  const unavailable = state.items.filter((i) => !i.available).length;
  const zones = new Set(state.tables.map((t) => t.zone)).size;
  const hasOpenOrders = openOrders(state).length > 0;
  const lic = licenseStatus(state.license);
  const licenseText =
    lic.plan === 'vie'
      ? 'Licence à vie'
      : lic.active && lic.dueDate
        ? `Mensuel · échéance le ${formatLongDate(lic.dueDate)}`
        : lic.demo && lic.demoEndsAt
          ? `Mode démo · ${formatCountdown(lic.demoEndsAt - Date.now())} restantes`
          : 'Inactif';
  const s = state.settings;

  // Changer le code : l'ancien code est demandé (sauf pour l'administrateur ou s'il n'existe pas).
  const startPinChange = () => setPinStep(session.admin || !state.security.managerPinHash ? 'new' : 'current');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Gestion" subtitle={session.admin ? 'Espace administrateur' : 'Espace gérant'} />
      <View style={styles.hero}>
        {s.logo ? (
          <Image source={{ uri: s.logo }} style={styles.logo} accessibilityLabel="Logo" />
        ) : (
          <View style={styles.logoEmpty}>
            <Emoji3D emoji="🏪" size={40} />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.heroLabel} numberOfLines={1}>
            {session.admin ? 'ADMINISTRATEUR' : 'GÉRANT'}
          </Text>
          <Text style={[styles.heroTitle, small && styles.heroTitleSmall]} numberOfLines={2}>
            {s.restaurantName}
          </Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {device.lobby ? `📡 Lobby ${device.lobby.code}` : 'Appareil seul'}
            {s.autoLockMinutes === -1 ? ' · verrouillage automatique' : s.autoLockMinutes ? ` · verrouillage ${s.autoLockMinutes} min` : ''}
          </Text>
        </View>
        {phone ? (
          <IconButton icon="lock-closed" label="Verrouiller" color={colors.gold} size={24} onPress={() => setSession({ manager: false, admin: false })} style={styles.lockBtn} />
        ) : (
          <Button title="Verrouiller" icon="lock-closed" small onPress={() => setSession({ manager: false, admin: false })} />
        )}
      </View>

      <View style={styles.stats}>
        <Stat emoji="💰" label="CA du jour" value={formatPrice(today.revenue, s.currency)} />
        <Stat emoji="🧾" label="Tickets" value={String(today.count)} />
        <Stat emoji="📊" label="Moyen" value={formatPrice(today.average, s.currency)} />
      </View>

      <SectionTitle>Mon commerce</SectionTitle>
      <Group>
        <ListRow
          emoji="🖼️"
          title="Identité & logo"
          subtitle={s.logo ? 'Logo, nom, slogan, adresse' : 'Ajoutez le logo de votre commerce'}
          chevron
          onPress={() => router.push('/reglages/identite')}
        />
        <ListRow
          emoji="⚙️"
          title="Préférences"
          subtitle={`Alerte cuisine ${s.alertMinutes} min · ${s.currency} · sécurité`}
          chevron
          onPress={() => router.push('/reglages/restaurant')}
        />
      </Group>

      <SectionTitle>La carte</SectionTitle>
      <Group>
        <ListRow
          emoji="🍔"
          title="Articles, prix & allergènes"
          subtitle={`${state.items.length} articles${unavailable ? ` · ${unavailable} épuisé(s)` : ''}`}
          chevron
          onPress={() => router.push('/reglages/articles')}
        />
        <ListRow
          emoji="🏷️"
          title="Catégories"
          subtitle={`${state.categories.length} catégories · cuisine ou bar`}
          chevron
          onPress={() => router.push('/reglages/categories')}
        />
      </Group>

      <SectionTitle>La salle & l’équipe</SectionTitle>
      <Group>
        <ListRow emoji="🪑" title="Tables & zones" subtitle={`${state.tables.length} tables · ${zones} zone(s)`} chevron onPress={() => router.push('/reglages/tables')} />
        <ListRow emoji="👥" title="Équipe & postes" subtitle={`${state.staff.length} employé(s) · postes et codes`} chevron onPress={() => router.push('/reglages/serveurs')} />
        <ListRow
          emoji="📡"
          title="Lobby de l’équipe"
          subtitle={device.lobby ? `Code ${device.lobby.code} · inviter, QR code` : 'Créer ou rejoindre un lobby'}
          chevron
          onPress={() => router.push('/equipe')}
        />
      </Group>

      <SectionTitle>Activité & abonnement</SectionTitle>
      <Group>
        <ListRow emoji="📊" title="Historique & statistiques" subtitle="Ventes, paiements, meilleures ventes" chevron onPress={() => router.push('/reglages/historique')} />
        <ListRow emoji="💎" title="Abonnement" subtitle={licenseText} chevron onPress={() => router.push('/abonnement')} />
      </Group>

      <SectionTitle>Sécurité</SectionTitle>
      <Group>
        <ListRow
          emoji="🔑"
          title="Code gérant"
          subtitle={state.security.managerPinLength ? `${state.security.managerPinLength} chiffres · modifier le code` : 'Modifier le code'}
          chevron
          onPress={startPinChange}
        />
        {session.admin ? (
          <ListRow emoji="🛡️" title="Administration" subtitle="Accès du gérant, lobby" chevron onPress={() => router.push('/reglages/admin')} />
        ) : null}
      </Group>

      <SectionTitle>Données</SectionTitle>
      <Group>
        <ListRow
          emoji="🔄"
          title="Recharger la carte de démonstration"
          subtitle="Remplace la carte, les tables et l’historique · code créateur"
          onPress={() =>
            creator.ask(() =>
              confirm('Recharger la démo ?', 'La carte, les tables et les commandes seront remplacées.', () => dispatch(resetDemo(state.settings, state.staff)), 'Recharger'),
            )
          }
        />
        <ListRow
          emoji="🗑️"
          title="Partir de zéro"
          subtitle="Vide la carte, les tables et les commandes · code créateur"
          onPress={() =>
            creator.ask(() =>
              confirm(
                'Tout effacer ?',
                hasOpenOrders
                  ? 'Des commandes sont en cours. Elles seront aussi supprimées. Action définitive.'
                  : 'La carte, les tables et l’historique seront supprimés. Action définitive.',
                () => dispatch(wipeAll(state.settings, state.staff)),
                'Tout effacer',
              ),
            )
          }
        />
      </Group>
      {creator.modal}
      <SupportCard />
      <Text style={styles.creatorLink} accessibilityRole="link" onPress={() => router.push('/createur')}>
        Espace créateur
      </Text>
      <Text style={styles.footnote}>
        {device.lobby ? 'Les modifications sont partagées avec toute l’équipe du lobby.' : 'Les données sont enregistrées sur cet appareil.'}
      </Text>

      <Modal visible={pinStep !== null} animationType="slide" onRequestClose={() => setPinStep(null)}>
        <View style={styles.pinScreen}>
          {pinStep === 'current' ? (
            <PinPad
              key="current"
              emoji="🔐"
              title="Code actuel"
              subtitle="Saisissez le code gérant actuel."
              length={state.security.managerPinLength}
              onSubmit={(c) => {
                if (identifyCode(state, c) !== 'manager') return 'Code incorrect.';
                setPinStep('new');
                return null;
              }}
            />
          ) : pinStep === 'new' ? (
            <PinPad
              key="new"
              emoji="🔑"
              title="Nouveau code gérant"
              subtitle="4 à 8 chiffres, différent d’une date de naissance."
              submitLabel="Continuer"
              onSubmit={(c) => {
                if (/^(\d)\1+$/.test(c) || '0123456789'.includes(c) || '9876543210'.includes(c)) {
                  return 'Code trop simple (ex. 1111, 1234). Choisissez-en un autre.';
                }
                setNewPin(c);
                setPinStep('confirm');
                return null;
              }}
            />
          ) : pinStep === 'confirm' ? (
            <PinPad
              key="confirm"
              emoji="🔑"
              title="Confirmez le code"
              length={newPin.length}
              onSubmit={(c) => {
                if (c !== newPin) {
                  setPinStep('new');
                  return 'Les deux codes sont différents.';
                }
                dispatch(setManagerPin(hashManagerPin(c, state.license.id), c.length));
                setPinStep(null);
                toast('Nouveau code gérant enregistré', '🔑');
                return null;
              }}
            />
          ) : null}
          <Button title="Annuler" variant="ghost" icon="close" onPress={() => setPinStep(null)} />
        </View>
      </Modal>
    </ScrollView>
  );
}

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Emoji3D emoji={emoji} size={26} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  creatorLink: { color: colors.muted, fontSize: 12, textAlign: 'center', textDecorationLine: 'underline', paddingVertical: 6 },
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.goldDeep,
  },
  logo: { width: 60, height: 60, borderRadius: 16, borderWidth: 1, borderColor: colors.gold },
  logoEmpty: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink2,
  },
  lockBtn: { alignSelf: 'flex-start', padding: 8, borderRadius: 12, backgroundColor: colors.ink2 },
  heroLabel: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { fontFamily: fonts.display, fontVariant: ['lining-nums'], color: colors.onDark, fontSize: 24, marginTop: 2 },
  heroTitleSmall: { fontSize: 20 },
  heroSub: { color: colors.onDarkMuted, fontSize: 12, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 2,
  },
  statValue: { fontFamily: fonts.display, fontVariant: ['lining-nums'], fontSize: 18, color: colors.text },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  footnote: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 20 },
  pinScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
});
