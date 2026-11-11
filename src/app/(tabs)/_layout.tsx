import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderTitle, TeamButton } from '../../components/HeaderParts';
import { hasTopBanner, ReminderBanner } from '../../components/ReminderBanner';
import { licenseStatus } from '../../license/license';
import { kitchenTickets, openOrders } from '../../store/selectors';
import { useNow, useStore } from '../../store/StoreProvider';
import { colors, headerStyle } from '../../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
  );
}

export default function TabsLayout() {
  const { state, device } = useStore();
  const insets = useSafeAreaInsets();
  const now = useNow(15000);
  const kitchenOnly = device.role === 'cuisine';
  // Badges des onglets, recalculés seulement quand les commandes changent.
  const { readyToServe, kitchenCount } = useMemo(() => {
    const s = { ...state, orders: state.orders };
    return {
      readyToServe: openOrders(s).filter((o) => o.lines.some((l) => l.status === 'pret')).length,
      kitchenCount: kitchenTickets(s, 'cuisine').active.length + kitchenTickets(s, 'bar').active.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orders]);
  // Le bandeau (démo ou rappel) occupe déjà la zone de la barre d'état.
  const bannerVisible = hasTopBanner(licenseStatus(state.license, now));

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <ReminderBanner />
      <Tabs
        screenOptions={{
          ...headerStyle,
          headerStatusBarHeight: bannerVisible ? 0 : undefined,
          headerRight: () => <TeamButton />,
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
          options={{
            title: 'Salle',
            href: kitchenOnly ? null : undefined,
            headerTitle: () => <HeaderTitle title={state.settings.restaurantName} subtitle="Plan de salle" logo={state.settings.logo} />,
            tabBarIcon: tabIcon('grid'),
          }}
        />
        <Tabs.Screen
          name="commandes"
          options={{
            title: 'Commandes',
            href: kitchenOnly ? null : undefined,
            headerTitle: () => <HeaderTitle title="Commandes" subtitle="En cours" />,
            tabBarBadge: readyToServe || undefined,
            tabBarIcon: tabIcon('receipt'),
          }}
        />
        <Tabs.Screen
          name="cuisine"
          options={{
            title: 'Cuisine / Bar',
            headerTitle: () => <HeaderTitle title="Cuisine & Bar" subtitle="Tickets" />,
            tabBarBadge: kitchenCount || undefined,
            tabBarIcon: tabIcon('flame'),
          }}
        />
        <Tabs.Screen
          name="gestion"
          options={{
            title: 'Gestion',
            headerTitle: () => <HeaderTitle title="Gestion" subtitle="Espace gérant" />,
            tabBarIcon: tabIcon('settings'),
          }}
        />
      </Tabs>
    </View>
  );
}
