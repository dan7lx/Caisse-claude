import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/tabs';
import { useCallback, useMemo } from 'react';
import type { ColorValue } from 'react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatusStrip } from '../../components/ReminderBanner';
import { kitchenTickets, openOrders } from '../../store/selectors';
import { useStore } from '../../store/StoreProvider';
import { colors } from '../../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
  );
}

export default function TabsLayout() {
  const { state, device, session, setSession } = useStore();
  const insets = useSafeAreaInsets();
  // Dans un lobby, chaque employé ne voit que son poste ; hors lobby, tout est accessible.
  const post = device.lobby ? device.role : null;
  const showRoom = post === null || post === 'serveur';
  const showKitchen = post === null || post !== 'serveur';

  // Badges des onglets, recalculés seulement quand les commandes changent.
  const { readyToServe, kitchenCount } = useMemo(() => {
    const cuisine = kitchenTickets(state, 'cuisine').active.length;
    const bar = kitchenTickets(state, 'bar').active.length;
    return {
      readyToServe: openOrders(state).filter((o) => o.lines.some((l) => l.status === 'pret')).length,
      kitchenCount: post === 'cuisine' ? cuisine : post === 'bar' ? bar : cuisine + bar,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orders, post]);

  // Sécurité « automatique » : quitter la Gestion pour un autre onglet referme l'accès gérant.
  const autoLock = state.settings.autoLockMinutes === -1;
  const unlocked = session.manager || session.admin;
  const lockOnLeave = useCallback(() => {
    if (autoLock && unlocked) setSession({ manager: false, admin: false });
  }, [autoLock, unlocked, setSession]);
  const leaveListeners = { focus: lockOnLeave };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        tabBar={(props) => (
          <View>
            <StatusStrip />
            <BottomTabBar {...props} />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.ink3, height: 60 + insets.bottom },
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.onDarkMuted,
          tabBarLabelStyle: { fontWeight: '700', fontSize: 11, letterSpacing: 0.3 },
          tabBarBadgeStyle: { backgroundColor: colors.ready, color: colors.ink, fontWeight: '800' },
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={leaveListeners}
          options={{ title: 'Salle', href: showRoom ? undefined : null, tabBarIcon: tabIcon('grid') }}
        />
        <Tabs.Screen
          name="commandes"
          listeners={leaveListeners}
          options={{
            title: 'Commandes',
            href: showRoom ? undefined : null,
            tabBarBadge: readyToServe || undefined,
            tabBarIcon: tabIcon('receipt'),
          }}
        />
        <Tabs.Screen
          name="cuisine"
          listeners={leaveListeners}
          options={{
            title: post === 'cuisine' ? 'Cuisine' : post === 'bar' ? 'Bar' : 'Cuisine / Bar',
            href: showKitchen ? undefined : null,
            tabBarBadge: kitchenCount || undefined,
            tabBarIcon: tabIcon(post === 'bar' ? 'wine' : 'flame'),
          }}
        />
        <Tabs.Screen name="gestion" options={{ title: 'Gestion', tabBarIcon: tabIcon('settings') }} />
      </Tabs>
      {/* Fond de la barre d'état : le contenu défile dessous sans se mélanger à l'heure et à la batterie. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.ink }} />
    </View>
  );
}
