import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AlertMemory, detectAlerts, type ServiceAlert } from '../notify/alerts';
import { playAlertSound, unlockSound, vibrate } from '../notify/sound';
import { registerServiceWorker, showSystemNotification } from '../notify/system';
import { useNow, useStore } from '../store/StoreProvider';
import { colors, frosted, safeInset } from '../theme';
import { haptic } from '../utils/haptics';
import { Emoji3D } from './Emoji3D';

const SHOW_MS = 20_000;
const MAX_SHOWN = 3;

const LOOK: Record<ServiceAlert['kind'], { emoji: string; color: string }> = {
  nouveau_bon: { emoji: '🛎️', color: colors.busy },
  pret: { emoji: '✅', color: colors.free },
  annulee: { emoji: '⚠️', color: colors.danger },
  retard: { emoji: '⏰', color: colors.ready },
};

interface Shown extends ServiceAlert {
  at: number;
}

/**
 * Alertes de service dans le lobby : nouveau bon (cuisine / bar), commande en retard ou annulée,
 * plats prêts à servir (serveur). Bannière en haut de l'écran, son, vibration et, si autorisée,
 * notification du système quand l'application est en arrière-plan.
 */
export function AlertCenter() {
  const { state, device } = useStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow(15_000);
  const memory = useRef<AlertMemory | null>(null);
  const [shown, setShown] = useState<Shown[]>([]);
  const inLobby = !!device.lobby;
  const sound = device.alerts?.sound !== false;
  const system = device.alerts?.system === true;

  // Le son n'est autorisé qu'après un premier toucher (iPhone) ; le service worker sert aux notifications.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    registerServiceWorker();
    const doc = (globalThis as { document?: Document }).document;
    doc?.addEventListener('pointerdown', unlockSound, { passive: true });
    return () => doc?.removeEventListener('pointerdown', unlockSound);
  }, []);

  // Nouveau lobby, nouveau poste : on repart de zéro (pas d'alerte pour ce qui existe déjà).
  useEffect(() => {
    memory.current = null;
  }, [device.lobby?.lobbyId, device.role, device.currentServer]);

  useEffect(() => {
    if (!inLobby) return;
    const { memory: next, fresh } = detectAlerts(memory.current, state, { role: device.role, me: device.currentServer, now });
    memory.current = next;
    if (!fresh.length) return;
    const at = Date.now();
    setShown((prev) => [...fresh.map((a) => ({ ...a, at })), ...prev].slice(0, MAX_SHOWN));
    haptic.success();
    if (sound) {
      playAlertSound(fresh.some((a) => a.kind === 'nouveau_bon' || a.kind === 'retard') ? 'haut' : 'bas');
      vibrate();
    }
    const hidden = (globalThis as { document?: Document }).document?.visibilityState === 'hidden';
    if (system && hidden) fresh.forEach((a) => showSystemNotification(a.title, a.body, a.href, a.id));
  }, [state, now, inLobby, device.role, device.currentServer, sound, system]);

  // Disparition automatique.
  useEffect(() => {
    if (!shown.length) return;
    const t = setTimeout(() => setShown((prev) => prev.filter((a) => Date.now() - a.at < SHOW_MS)), 1000);
    return () => clearTimeout(t);
  }, [shown, now]);

  if (!inLobby || !shown.length) return null;
  const dismiss = (id: string) => setShown((prev) => prev.filter((a) => a.id !== id));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: safeInset('top', insets.top, 8) }]}>
      {shown.map((a) => {
        const look = LOOK[a.kind];
        return (
          <Pressable
            key={a.id}
            accessibilityRole="alert"
            accessibilityLabel={`${a.title}. ${a.body}`}
            onPress={() => {
              dismiss(a.id);
              router.push(a.href as never);
            }}
            style={({ pressed }) => [styles.alert, { borderColor: look.color }, pressed && styles.pressed]}
          >
            <Emoji3D emoji={look.emoji} size={30} />
            <View style={styles.flex}>
              <Text style={[styles.title, { color: look.color }]}>{a.title}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {a.body}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer l’alerte" hitSlop={10} onPress={() => dismiss(a.id)}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 50, alignItems: 'center' },
  alert: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(15, 18, 27, 0.94)',
    ...frosted,
  },
  pressed: { opacity: 0.85 },
  flex: { flex: 1 },
  title: { fontWeight: '900', fontSize: 15 },
  body: { color: colors.text, fontSize: 14, marginTop: 1 },
});
