import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Retour tactile léger sur iPhone et Android (sans effet sur le web).
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  tap() {
    if (enabled) Haptics.selectionAsync().catch(() => {});
  },
  impact() {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
