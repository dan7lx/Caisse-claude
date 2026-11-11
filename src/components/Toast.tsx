import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { Emoji3D } from './Emoji3D';

interface ToastMessage {
  id: number;
  text: string;
  emoji: string;
}

const ToastContext = createContext<(text: string, emoji?: string) => void>(() => {});

/** Petites notifications éphémères (« 🎉 Envoyé en cuisine »). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-20)).current;
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, emoji = '✨') => {
    setMessage({ id: Date.now(), text, emoji });
  }, []);

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    translate.setValue(-20);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMessage(null));
    }, 1800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity, translate]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { top: insets.top + 10, opacity, transform: [{ translateY: translate }] }]}
        >
          <Emoji3D emoji={message.emoji} size={26} />
          <Text style={styles.text} numberOfLines={2}>
            {message.text}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 420,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 18,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { color: colors.onDark, fontWeight: '700', fontSize: 15, flexShrink: 1 },
});
