import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { LicenseGate } from '../components/LicenseGate';
import { ToastProvider } from '../components/Toast';
import { StoreProvider } from '../store/StoreProvider';
import { colors, headerStyle } from '../theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_800ExtraBold,
  });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;

  return (
    <StoreProvider>
      <ToastProvider>
        <StatusBar style="light" />
        <LicenseGate>
          <Stack
            screenOptions={{
              ...headerStyle,
              headerBackTitle: 'Retour',
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
              animationDuration: 220,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
          </Stack>
        </LicenseGate>
      </ToastProvider>
    </StoreProvider>
  );
}
