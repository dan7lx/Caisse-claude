import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

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
  const { state } = useStore();
  const readyToServe = openOrders(state).filter((o) => o.lines.some((l) => l.status === 'pret')).length;
  const kitchenCount =
    kitchenTickets(state, 'cuisine').active.length + kitchenTickets(state, 'bar').active.length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '600' },
        headerTitleStyle: { fontWeight: '800' },
        headerStyle: { backgroundColor: colors.card },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tables',
          headerTitle: state.settings.restaurantName,
          tabBarIcon: tabIcon('grid-outline'),
        }}
      />
      <Tabs.Screen
        name="commandes"
        options={{
          title: 'Commandes',
          tabBarBadge: readyToServe || undefined,
          tabBarIcon: tabIcon('receipt-outline'),
        }}
      />
      <Tabs.Screen
        name="cuisine"
        options={{
          title: 'Cuisine / Bar',
          tabBarBadge: kitchenCount || undefined,
          tabBarIcon: tabIcon('flame-outline'),
        }}
      />
      <Tabs.Screen
        name="gestion"
        options={{
          title: 'Gestion',
          tabBarIcon: tabIcon('settings-outline'),
        }}
      />
    </Tabs>
  );
}
